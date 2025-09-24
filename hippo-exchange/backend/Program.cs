// Program.cs
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;

namespace HippoExchange
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
             builder.WebHost.ConfigureKestrel(options =>
             {
                options.ListenAnyIP(5000); // change 5000 to whatever port you want
                // If you want HTTPS with a cert:
                // // options.ListenAnyIP(443, listenOptions => listenOptions.UseHttps("cert.pfx", "password"));
             });


            // -------- Config --------
            var projectId =
                Environment.GetEnvironmentVariable("GOOGLE_CLOUD_PROJECT")
                ?? builder.Configuration["GoogleCloud:ProjectId"]
                ?? throw new InvalidOperationException("GoogleCloud:ProjectId not configured.");

            var databaseId =
                Environment.GetEnvironmentVariable("FIRESTORE_DATABASE_ID")
                ?? builder.Configuration["GoogleCloud:DatabaseId"]
                ?? "(default)";

            // Credentials: env var first, then appsettings (GoogleCloud:CredentialPath)
            var credPath =
                Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
                ?? builder.Configuration["GoogleCloud:CredentialPath"];

            if (string.IsNullOrWhiteSpace(credPath) || !File.Exists(credPath))
            {
                throw new InvalidOperationException(
                    "Firestore credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS " +
                    "or GoogleCloud:CredentialPath to a valid service-account JSON file. " +
                    $"Current value: '{credPath ?? "<empty>"}'");
            }

            var googleCred = GoogleCredential.FromFile(credPath);

            // -------- Services --------
            builder.Services.AddSingleton(_ => new FirestoreDbBuilder
            {
                ProjectId = projectId,
                DatabaseId = databaseId,
                Credential = googleCred
            }.Build());

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "HippoExchange API",
                    Version = "v1",
                    Description = "Simple CRUD + Auth API backed by Firestore"
                });
            });

            // CORS (relaxed for local dev / file:// testing)
            builder.Services.AddCors(o =>
            {
                o.AddDefaultPolicy(p => p
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .SetIsOriginAllowed(_ => true));
            });

            var app = builder.Build();

            // -------- Dev tooling --------
            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HippoExchange API v1"));
            }

            // Only redirect if HTTPS is actually bound
            var urls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS") ?? "";
            var hasHttps = urls.Contains("https://", StringComparison.OrdinalIgnoreCase);
            if (hasHttps) app.UseHttpsRedirection();

            // -------- Static frontend (wwwroot) --------
            var defaults = new DefaultFilesOptions();
            defaults.DefaultFileNames.Clear();
            defaults.DefaultFileNames.Add("Login.html");
            defaults.DefaultFileNames.Add("Home.html");
            defaults.DefaultFileNames.Add("index.html");
            app.UseDefaultFiles(defaults);

            app.UseStaticFiles();
            app.UseCors();

            // ===================== API =====================

            // Health
            app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

            app.MapGet("/health/firestore", async (FirestoreDb db, ILogger<Program> logger) =>
            {
                try
                {
                    await db.Collection("users").Limit(1).GetSnapshotAsync();
                    return Results.Json(new { status = "ok", firestore = "ok", projectId = db.ProjectId, databaseId = db.DatabaseId });
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Firestore health check failed");
                    return Results.Problem(title: "Firestore check failed", detail: ex.Message, statusCode: 503);
                }
            });

            // Helpful debug to confirm ADC path at runtime
            app.MapGet("/debug/adc", () =>
            {
                var p = Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
                        ?? builder.Configuration["GoogleCloud:CredentialPath"];
                return Results.Ok(new
                {
                    credentialPath = p,
                    exists = !string.IsNullOrWhiteSpace(p) && File.Exists(p)
                });
            });

            // -------- Items CRUD --------
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

            // -------- Users (demo reads) --------
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

            // -------- Auth (BCrypt) --------
            app.MapPost("/auth/register", async (FirestoreDb db, AuthRegisterDto dto, ILogger<Program> log) =>
            {
                var email = (dto.Email ?? "").Trim().ToLowerInvariant();
                if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(dto.Password))
                    return Results.BadRequest(new { message = "Email and password are required." });

                try
                {
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
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Register failed");
                    return Results.Problem(title: "Register failed", detail: ex.Message, statusCode: 500);
                }
            });

            app.MapPost("/auth/login", async (FirestoreDb db, AuthLoginDto dto, ILogger<Program> log) =>
            {
                var email = (dto.Email ?? "").Trim().ToLowerInvariant();
                try
                {
                    var snaps = await db.Collection("users")
                        .WhereEqualTo(nameof(UserAuth.Email), email)
                        .Limit(1).GetSnapshotAsync();

                    if (!snaps.Any()) return Results.Unauthorized();

                    var user = snaps.First().ConvertTo<UserAuth>();
                    var ok = BCrypt.Net.BCrypt.Verify(dto.Password ?? "", user.PasswordHash);
                    if (!ok) return Results.Unauthorized();

                    return Results.Ok(new { user.Id, user.Email, user.Name });
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Login failed");
                    return Results.Problem(title: "Login failed", detail: ex.Message, statusCode: 500);
                }
            });

            // ------------------------------------------------
            app.UseDeveloperExceptionPage();
            app.UseSwagger();
            app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HippoExchange API v1"));

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
