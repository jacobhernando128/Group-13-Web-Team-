using Google.Cloud.Firestore;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Routing;

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

            var databaseId = Environment.GetEnvironmentVariable("FIRESTORE_DATABASE_ID") ?? "group13capstone";

            // Services
            builder.Services.AddSingleton(_ =>
            {
                var credentialPath = Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
                    ?? builder.Configuration["GoogleCloud:CredentialPath"]
                    ?? Path.Combine(Directory.GetCurrentDirectory(), "firebase-key.json");
                
                return new FirestoreDbBuilder 
                { 
                    ProjectId = projectId, 
                    DatabaseId = databaseId,
                    CredentialsPath = credentialPath
                }.Build();
            });
            
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

            app.MapGet("/health/firestore", async (Google.Cloud.Firestore.FirestoreDb db, ILogger<Program> logger) =>
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

            // Read (one) - Fetch item by ID
            app.MapGet("/items/{id}", async (FirestoreDb db, string id) =>
            {
                try
                {
                    // Check if this is an item ID
                    var itemSnap = await db.Collection("itemID").Document(id).GetSnapshotAsync();
                    
                    if (itemSnap.Exists)
                    {
                        var item = itemSnap.ConvertTo<Item>();
                        item.Id = itemSnap.Id;
                        
                        // Try to find the listing to get the owner ID
                        var listingsQuery = db.Collection("listings").WhereEqualTo("itemID", id);
                        var listingsSnap = await listingsQuery.Limit(1).GetSnapshotAsync();
                        
                        if (listingsSnap.Documents.Count > 0)
                        {
                            var listing = listingsSnap.Documents[0].ConvertTo<Listing>();
                            item.OwnerId = listing.UserId;
                        }
                        
                        return Results.Ok(item);
                    }
                    
                    return Results.NotFound(new { message = $"Item {id} not found" });
                }
                catch (Exception ex)
                {
                    return Results.Problem(
                        title: "Failed to fetch item",
                        detail: ex.Message,
                        statusCode: 500
                    );
                }
            });

            // Read (many) - Query listings and fetch corresponding items
            app.MapGet("/items", async (FirestoreDb db, string? ownerId, bool? available) =>
            {
                try
                {
                    // Query the listings collection
                    Query listingsQuery = db.Collection("listings");
                    var listingsSnapshot = await listingsQuery.Limit(50).GetSnapshotAsync();
                    
                    var items = new List<Item>();
                    
                    foreach (var listingDoc in listingsSnapshot.Documents)
                    {
                        var listing = listingDoc.ConvertTo<Listing>();
                        
                        // Fetch the actual item from itemID collection
                        var itemDoc = await db.Collection("itemID").Document(listing.ItemId).GetSnapshotAsync();
                        
                        if (itemDoc.Exists)
                        {
                            var item = itemDoc.ConvertTo<Item>();
                            item.Id = itemDoc.Id;
                            item.OwnerId = listing.UserId;
                            item.Available = true; // Default, add logic as needed
                            
                            // Apply filters if provided
                            if (!string.IsNullOrWhiteSpace(ownerId) && item.OwnerId != ownerId)
                                continue;
                            if (available is not null && item.Available != available)
                                continue;
                            
                            items.Add(item);
                        }
                    }
                    
                    return Results.Ok(items);
                }
                catch (Exception ex)
                {
                    return Results.Problem(
                        title: "Failed to fetch items",
                        detail: ex.Message,
                        statusCode: 500
                    );
                }
            });

            // Create
            app.MapPost("/items", async (FirestoreDb db, Item item) =>
            {
                item.Id = Guid.NewGuid().ToString("n");
                item.CreatedUtc = DateTime.UtcNow;
                await db.Collection("items").Document(item.Id).SetAsync(item);
                return Results.Created($"/items/{item.Id}", item);
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

            // Get all items for a specific user
            app.MapGet("/users/{userId}/items", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("items").WhereEqualTo(nameof(Item.OwnerId), userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            });

            // Get user profile
            app.MapGet("/users/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snap = await db.Collection("users").Document(userId).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<User>()) : Results.NotFound();
            });

            // Create user endpoint
            app.MapPost("/users", async (FirestoreDb db, User user) =>
            {
                user.Id = Guid.NewGuid().ToString("n");
                user.CreatedUtc = DateTime.UtcNow;
                await db.Collection("users").Document(user.Id).SetAsync(user);
                return Results.Created($"/users/{user.Id}", user);
            });

            // Get borrowed items for a user
            app.MapGet("/users/{userId}/borrowed", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("borrowings").WhereEqualTo(nameof(Borrowing.BorrowerId), userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Borrowing>());
            });

            // Create borrowing transaction
            app.MapPost("/borrowings", async (FirestoreDb db, Borrowing borrowing) =>
            {
                borrowing.Id = Guid.NewGuid().ToString("n");
                borrowing.CreatedUtc = DateTime.UtcNow;
                borrowing.Status = "pending";
                await db.Collection("borrowings").Document(borrowing.Id).SetAsync(borrowing);
                return Results.Created($"/borrowings/{borrowing.Id}", borrowing);
            });

            // Update borrowing status
            app.MapPut("/borrowings/{id}", async (FirestoreDb db, string id, Borrowing update) =>
            {
                var doc = db.Collection("borrowings").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var current = snap.ConvertTo<Borrowing>();
                current.Status = update.Status ?? current.Status;
                current.StartDate = update.StartDate ?? current.StartDate;
                current.EndDate = update.EndDate ?? current.EndDate;

                await doc.SetAsync(current, SetOptions.Overwrite);
                return Results.Ok(current);
            });

            // Get maintenance history for an item
            app.MapGet("/items/{itemId}/maintenance", async (FirestoreDb db, string itemId) =>
            {
                var q = db.Collection("maintenance").WhereEqualTo(nameof(MaintenanceEntry.ItemId), itemId);
                var snaps = await q.OrderByDescending(nameof(MaintenanceEntry.Date)).GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<MaintenanceEntry>());
            });

            // Add maintenance entry
            app.MapPost("/maintenance", async (FirestoreDb db, MaintenanceEntry maintenance) =>
            {
                maintenance.Id = Guid.NewGuid().ToString("n");
                maintenance.CreatedUtc = DateTime.UtcNow;
                await db.Collection("maintenance").Document(maintenance.Id).SetAsync(maintenance);
                return Results.Created($"/maintenance/{maintenance.Id}", maintenance);
            });

            // Delete maintenance entry
            app.MapDelete("/maintenance/{id}", async (FirestoreDb db, string id) =>
            {
                await db.Collection("maintenance").Document(id).DeleteAsync();
                return Results.NoContent();
            });

            app.Run();
        }
    }

    // ---------------- Models ----------------
    
    [FirestoreData]
    public class Listing
    {
        [FirestoreDocumentId] 
        public string? Id { get; set; }
        
        [FirestoreProperty("itemID")] 
        public string ItemId { get; set; } = default!;
        
        [FirestoreProperty("userID")] 
        public string UserId { get; set; } = default!;
        
        [FirestoreProperty] 
        public DateTime CreatedUtc { get; set; }
    }
    
    [FirestoreData]
    public class Item
    {
        [FirestoreDocumentId] 
        public string? Id { get; set; }

        [FirestoreProperty] 
        public string OwnerId { get; set; } = default!;
        
        [FirestoreProperty] 
        public string Title { get; set; } = default!;
        
        [FirestoreProperty] 
        public string? Description { get; set; }
        
        [FirestoreProperty] 
        public bool Available { get; set; } = true;
        
        [FirestoreProperty] 
        public DateTime CreatedUtc { get; set; }

        // Properties matching your Firestore structure
        [FirestoreProperty("DollarCost")] 
        public double? Price { get; set; }
        
        [FirestoreProperty("Categories")] 
        public List<string>? CategoryList { get; set; }
        
        [FirestoreProperty] 
        public string? Condition { get; set; }
        
        [FirestoreProperty] 
        public string? Location { get; set; }
        
        [FirestoreProperty("Pictures")] 
        public List<string>? Images { get; set; }
        
        [FirestoreProperty] 
        public List<string>? Videos { get; set; }
        
        [FirestoreProperty] 
        public double? RepCost { get; set; }
        
        // Computed properties for frontend
        public string? Category => CategoryList?.FirstOrDefault();
        public string? LocationLabel => Location;
        public string? ImageUrl => Images?.FirstOrDefault();
        public bool IsNew => CreatedUtc > DateTime.UtcNow.AddDays(-7);
        public bool Ships => true;
        public string? Slug => Title?.ToLower().Replace(" ", "-") + "-" + Id?.Substring(0, 8);
    }

    [FirestoreData]
    public class User
    {
        [FirestoreDocumentId]
        public string? Id { get; set; }

        [FirestoreProperty]
        public string Email { get; set; } = default!;

        [FirestoreProperty]
        public string Name { get; set; } = default!;

        [FirestoreProperty]
        public string? ProfilePicture { get; set; }

        [FirestoreProperty]
        public DateTime CreatedUtc { get; set; }
    }

    [FirestoreData]
    public class Borrowing
    {
        [FirestoreDocumentId] public string? Id { get; set; }

        [FirestoreProperty] public string ItemId { get; set; } = default!;
        [FirestoreProperty] public string BorrowerId { get; set; } = default!;
        [FirestoreProperty] public string OwnerId { get; set; } = default!;
        [FirestoreProperty] public string Status { get; set; } = default!;
        [FirestoreProperty] public DateTime? StartDate { get; set; }
        [FirestoreProperty] public DateTime? EndDate { get; set; }
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty] public string? Notes { get; set; }
    }

    [FirestoreData]
    public class MaintenanceEntry
    {
        [FirestoreDocumentId] public string? Id { get; set; }

        [FirestoreProperty] public string ItemId { get; set; } = default!;
        [FirestoreProperty] public DateTime Date { get; set; }
        [FirestoreProperty] public string Type { get; set; } = default!;
        [FirestoreProperty] public string Description { get; set; } = default!;
        [FirestoreProperty] public decimal Cost { get; set; } = 0;
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty] public string? Notes { get; set; }
    }
}