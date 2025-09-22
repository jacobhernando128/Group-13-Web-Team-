using Google.Cloud.Firestore;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Routing;
using System.Linq;

namespace HippoExchange
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // ---- Config ----
            var projectId =
                Environment.GetEnvironmentVariable("GOOGLE_CLOUD_PROJECT")
                ?? builder.Configuration["GoogleCloud:ProjectId"]
                ?? throw new InvalidOperationException("ProjectId not configured.");

            var databaseId =
                Environment.GetEnvironmentVariable("FIRESTORE_DATABASE_ID")
                ?? builder.Configuration["GoogleCloud:DatabaseId"]
                ?? "group13capstone"; // <- your confirmed DatabaseId

            // ---- Services ----
            builder.Services.AddSingleton(_ =>
                new FirestoreDbBuilder { ProjectId = projectId, DatabaseId = databaseId }.Build());

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "HippoExchange API",
                    Version = "v1",
                    Description = "Simple CRUD API backed by Firestore"
                });
            });

            // Optional CORS (safe since front-end is same-origin, but fine to keep)
            builder.Services.AddCors(o =>
            {
                o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
            });

            var app = builder.Build();

            // ---- Dev tooling ----
            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HippoExchange API v1"));
            }

            app.UseHttpsRedirection();

            // ---- Serve frontend (wwwroot) ----
            var defaults = new DefaultFilesOptions();
            defaults.DefaultFileNames.Clear();
            defaults.DefaultFileNames.Add("Login.html");
            defaults.DefaultFileNames.Add("Home.html");
            defaults.DefaultFileNames.Add("index.html");
            app.UseDefaultFiles(defaults);

            app.UseStaticFiles();
            app.UseCors();

            // ===================== API ENDPOINTS =====================

            // Health
            app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

            app.MapGet("/health/firestore", async (FirestoreDb db, ILogger<Program> logger) =>
            {
                try
                {
                    await db.Collection("users").Limit(1).GetSnapshotAsync();
                    return Results.Json(new { status = "ok", firestore = "ok", projectId = db.ProjectId });
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Firestore health check failed");
                    return Results.Problem(title: "Firestore check failed", detail: ex.Message, statusCode: 503);
                }
            });

            // ---------------- Items CRUD ----------------
            app.MapPost("/items", async (FirestoreDb db, Item item) =>
            {
                item.Id = Guid.NewGuid().ToString("n");
                item.CreatedUtc = DateTime.UtcNow;
                await db.Collection("items").Document(item.Id).SetAsync(item);
                return Results.Created($"/items/{item.Id}", item);
            });

            app.MapGet("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var snap = await db.Collection("items").Document(id).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<Item>()) : Results.NotFound();
            });

            app.MapGet("/items", async (FirestoreDb db, string? ownerId, bool? available) =>
            {
                Query q = db.Collection("items");
                if (!string.IsNullOrWhiteSpace(ownerId)) q = q.WhereEqualTo(nameof(Item.OwnerId), ownerId);
                if (available is not null) q = q.WhereEqualTo(nameof(Item.Available), available);
                var snaps = await q.Limit(50).GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            });

            app.MapPut("/items/{id}", async (FirestoreDb db, string id, Item update) =>
            {
                var doc = db.Collection("items").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var current = snap.ConvertTo<Item>();
                current.Title = update.Title ?? current.Title;
                current.Description = update.Description ?? current.Description;
                current.Available = update.Available;
                current.OwnerId = update.OwnerId ?? current.OwnerId;

                await doc.SetAsync(current, SetOptions.Overwrite);
                return Results.Ok(current);
            });

            app.MapDelete("/items/{id}", async (FirestoreDb db, string id) =>
            {
                await db.Collection("items").Document(id).DeleteAsync();
                return Results.NoContent();
            });

            // ---------------- Users (read/demo) ----------------
            app.MapGet("/users/{userId}/items", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("items").WhereEqualTo(nameof(Item.OwnerId), userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            });

            app.MapGet("/users/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snap = await db.Collection("users").Document(userId).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<User>()) : Results.NotFound();
            });

            app.MapPost("/users", async (FirestoreDb db, User user) =>
            {
                user.Id = Guid.NewGuid().ToString("n");
                user.CreatedUtc = DateTime.UtcNow;
                await db.Collection("users").Document(user.Id).SetAsync(user);
                return Results.Created($"/users/{user.Id}", user);
            });

            // ---------------- AUTH (new) ----------------
            app.MapPost("/auth/register", async (FirestoreDb db, AuthRegisterDto dto) =>
            {
                var email = (dto.Email ?? "").Trim().ToLowerInvariant();
                if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(dto.Password))
                    return Results.BadRequest(new { message = "Email and password are required." });

                var exists = await db.Collection("users")
                    .WhereEqualTo(nameof(UserAuth.Email), email)
                    .Limit(1).GetSnapshotAsync();

                if (exists.Any())
                    return Results.Conflict(new { message = "Email already registered." });

                var user = new UserAuth
                {
                    Id = Guid.NewGuid().ToString("n"),
                    Email = email,
                    Name = (dto.Name ?? "").Trim(),
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                    CreatedUtc = DateTime.UtcNow
                };

                await db.Collection("users").Document(user.Id).SetAsync(user);

                return Results.Created($"/users/{user.Id}", new { user.Id, user.Email, user.Name });
            });

            app.MapPost("/auth/login", async (FirestoreDb db, AuthLoginDto dto) =>
            {
                var email = (dto.Email ?? "").Trim().ToLowerInvariant();

                var snaps = await db.Collection("users")
                    .WhereEqualTo(nameof(UserAuth.Email), email)
                    .Limit(1).GetSnapshotAsync();

                if (!snaps.Any()) return Results.Unauthorized();

                var user = snaps.First().ConvertTo<UserAuth>();
                var ok = BCrypt.Net.BCrypt.Verify(dto.Password ?? "", user.PasswordHash);
                if (!ok) return Results.Unauthorized();

                return Results.Ok(new { user.Id, user.Email, user.Name });
            });

            // =====================================================

            app.Run();
        }
    }

    // ---------------- Models ----------------
    [FirestoreData]
    public class Item
    {
        [FirestoreDocumentId] public string? Id { get; set; }

        [FirestoreProperty] public string OwnerId { get; set; } = default!;
        [FirestoreProperty] public string Title { get; set; } = default!;
        [FirestoreProperty] public string? Description { get; set; }
        [FirestoreProperty] public bool Available { get; set; } = true;
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
    }

    [FirestoreData]
    public class User
    {
        [FirestoreDocumentId] public string? Id { get; set; }

        [FirestoreProperty] public string Email { get; set; } = default!;
        [FirestoreProperty] public string Name { get; set; } = default!;
        [FirestoreProperty] public string? ProfilePicture { get; set; }
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
    }

    // ---- Auth DTOs + Firestore model (with password hash) ----
    public record AuthRegisterDto(string Email, string Name, string Password);
    public record AuthLoginDto(string Email, string Password);

    [FirestoreData]
    public class UserAuth
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty] public string Email { get; set; } = default!;
        [FirestoreProperty] public string Name { get; set; } = default!;
        [FirestoreProperty] public string PasswordHash { get; set; } = default!;
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
    }
}
