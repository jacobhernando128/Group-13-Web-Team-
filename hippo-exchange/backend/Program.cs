using Google.Cloud.Firestore;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;

namespace HippoExchange
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Project Id: env first, then appsettings
            var projectId =
                Environment.GetEnvironmentVariable("GOOGLE_CLOUD_PROJECT")
                ?? builder.Configuration["GoogleCloud:ProjectId"]
                ?? throw new InvalidOperationException("ProjectId not configured.");

            // Services
            builder.Services.AddSingleton(_ => FirestoreDb.Create(projectId));
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

            // (Optional) CORS for local fetch() from your pages
            builder.Services.AddCors(o =>
            {
                o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
            });

            var app = builder.Build();

            // Dev tooling
            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HippoExchange API v1"));
            }

            app.UseHttpsRedirection();

            // ---- Serve your frontend from backend/wwwroot ----
            var defaults = new DefaultFilesOptions();
            defaults.DefaultFileNames.Clear();
            // Pick the first one that exists in wwwroot:
            defaults.DefaultFileNames.Add("Login.html");
            defaults.DefaultFileNames.Add("Home.html");
            defaults.DefaultFileNames.Add("index.html");
            app.UseDefaultFiles(defaults);

            app.UseStaticFiles();       // serves backend/wwwroot/**

            app.UseCors();              // (optional) enable the CORS policy

            // ----------------- API endpoints -----------------
            app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

            // Create
            app.MapPost("/items", async (FirestoreDb db, Item item) =>
            {
                item.Id = Guid.NewGuid().ToString("n");
                item.CreatedUtc = DateTime.UtcNow;
                await db.Collection("items").Document(item.Id).SetAsync(item);
                return Results.Created($"/items/{item.Id}", item);
            });

            // Read (one)
            app.MapGet("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var snap = await db.Collection("items").Document(id).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<Item>()) : Results.NotFound();
            });

            // Read (many) with optional filters
            app.MapGet("/items", async (FirestoreDb db, string? ownerId, bool? available) =>
            {
                Query q = db.Collection("items");
                if (!string.IsNullOrWhiteSpace(ownerId)) q = q.WhereEqualTo(nameof(Item.OwnerId), ownerId);
                if (available is not null) q = q.WhereEqualTo(nameof(Item.Available), available);
                var snaps = await q.Limit(50).GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            });

            // Update
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

            // Delete
            app.MapDelete("/items/{id}", async (FirestoreDb db, string id) =>
            {
                await db.Collection("items").Document(id).DeleteAsync();
                return Results.NoContent();
            });

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
}
