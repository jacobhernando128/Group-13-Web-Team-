using System.Security.Cryptography;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Google.Cloud.Storage.V1;
using FirebaseAdmin;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
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

            // Optional: expose HTTP on a fixed port for local/dev
            builder.WebHost.ConfigureKestrel(options =>
            {
                options.ListenAnyIP(5000);
                // For HTTPS with a cert:
                // options.ListenAnyIP(443, lo => lo.UseHttps("cert.pfx", "password"));
            });

            // ---- Config ----
            var projectId =
                Environment.GetEnvironmentVariable("GOOGLE_CLOUD_PROJECT")
                ?? builder.Configuration["GoogleCloud:ProjectId"]
                ?? throw new InvalidOperationException("ProjectId not configured.");

            var databaseId =
                Environment.GetEnvironmentVariable("FIRESTORE_DATABASE_ID")
                ?? "(default)";

            var credPath =
                Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
                ?? builder.Configuration["GoogleCloud:CredentialPath"];

            if (string.IsNullOrWhiteSpace(credPath) || !File.Exists(credPath))
            {
                throw new InvalidOperationException(
                    "Credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or GoogleCloud:CredentialPath " +
                    $"to a valid service-account JSON file. Current: '{credPath ?? "<empty>"}'");
            }

            var googleCred = GoogleCredential.FromFile(credPath);

            static string PublicUrl(string bucket, string objectName)
                => $"https://storage.googleapis.com/{bucket}/{Uri.EscapeDataString(objectName)}";

            // ---- Services ----
            builder.Services.AddSingleton(_ => new FirestoreDbBuilder
            {
                ProjectId = projectId,
                DatabaseId = databaseId,
                Credential = googleCred
            }.Build());

            // You can pass credentials to StorageClient:
            builder.Services.AddSingleton(_ => StorageClient.Create(googleCred));

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "HippoExchange API",
                    Version = "v1",
                    Description = "CRUD API backed by Firestore; BCrypt auth; GCS media upload"
                });
            });

            builder.Services.AddCors(o =>
            {
                // TODO: tighten for prod
                o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
            });

            // Firebase Admin (optional, present for future token work)
            if (FirebaseApp.DefaultInstance is null)
            {
                FirebaseApp.Create(new FirebaseAdmin.AppOptions
                {
                    Credential = googleCred
                });
            }

            var app = builder.Build();

            // ---- Dev tooling ----
            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HippoExchange API v1"));
            }

            app.UseHttpsRedirection();
            app.UseCors();

            // ---- Serve frontend ----
            var defaults = new DefaultFilesOptions();
            defaults.DefaultFileNames.Clear();
            defaults.DefaultFileNames.Add("Login.html");
            defaults.DefaultFileNames.Add("Home.html");
            defaults.DefaultFileNames.Add("index.html");
            app.UseDefaultFiles(defaults);
            app.UseStaticFiles();

            // ===================== API =====================

            // ---- Health ----
            app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
               .WithName("Health");

            app.MapGet("/health/firestore", async (FirestoreDb db, ILogger<Program> logger) =>
            {
                try
                {
                    await db.Collection("users").Limit(1).GetSnapshotAsync();
                    return Results.Json(new
                    {
                        status = "ok",
                        firestore = "ok",
                        projectId = db.ProjectId,
                        databaseId = db.DatabaseId
                    });
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Firestore health check failed");
                    return Results.Problem(title: "Firestore check failed", detail: ex.Message, statusCode: 503);
                }
            }).WithName("Health_Firestore");

            // Show credential path/existence
            app.MapGet("/debug/adc", () =>
            {
                var exists = !string.IsNullOrWhiteSpace(credPath) && File.Exists(credPath);
                return Results.Ok(new { credentialPath = credPath, exists });
            }).WithName("Debug_ADC");

            // -------- Items --------

            // Create item
            app.MapPost("/items", async (FirestoreDb db, Item item) =>
            {
                item.Id = Guid.NewGuid().ToString("n");
                item.CreatedUtc = DateTime.UtcNow;
                await db.Collection("itemID").Document(item.Id).SetAsync(item);
                return Results.Created($"/items/{item.Id}", item);
            }).WithName("CreateItem");

            // Get item by id
            app.MapGet("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var snap = await db.Collection("itemID").Document(id).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<Item>()) : Results.NotFound();
            }).WithName("GetItemById");

            // List items (optional filter ownerId aka userID)
            app.MapGet("/items", async (FirestoreDb db, string? ownerId) =>
            {
                Query q = db.Collection("itemID");
                if (!string.IsNullOrWhiteSpace(ownerId))
                    q = q.WhereEqualTo("userID", ownerId);

                var snaps = await q.Limit(50).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Item>()));
            }).WithName("ListItems");

            // Update item
            app.MapPut("/items/{id}", async (FirestoreDb db, string id, Item update) =>
            {
                var doc = db.Collection("itemID").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var current = snap.ConvertTo<Item>();
                current.Title = update.Title ?? current.Title;
                current.Description = update.Description ?? current.Description;
                current.UserId = update.UserId ?? current.UserId;
                current.Condition = update.Condition ?? current.Condition;
                current.Location = update.Location ?? current.Location;
                current.DollarCost = update.DollarCost ?? current.DollarCost;
                current.RepCost = update.RepCost ?? current.RepCost;

                if (update.Categories?.Count > 0) current.Categories = update.Categories;
                if (update.Pictures?.Count > 0) current.Pictures = update.Pictures;
                if (update.Videos?.Count > 0) current.Videos = update.Videos;

                await doc.SetAsync(current, SetOptions.Overwrite);
                return Results.Ok(current);
            }).WithName("UpdateItem");

            // Delete item
            app.MapDelete("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var doc = db.Collection("itemID").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.DeleteAsync();
                return Results.NoContent();
            }).WithName("DeleteItem");

            // Upload pictures
            app.MapPost("/items/{id}/pictures", async (HttpRequest req, FirestoreDb db, StorageClient storage, string id) =>
            {
                var itemDoc = db.Collection("itemID").Document(id);
                var snap = await itemDoc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                if (!req.HasFormContentType) return Results.BadRequest("multipart/form-data required");
                var form = await req.ReadFormAsync();
                if (form.Files.Count == 0) return Results.BadRequest("No files provided");

                var bucket = "hippo-exchange-media";
                var urls = new List<string>();

                foreach (var file in form.Files)
                {
                    await using var stream = file.OpenReadStream();
                    var objectName = $"items/{id}/pictures/{Guid.NewGuid():n}-{file.FileName}";
                    await storage.UploadObjectAsync(
                        bucket,
                        objectName,
                        file.ContentType ?? "application/octet-stream",
                        stream
                    );

                    urls.Add(PublicUrl(bucket, objectName));
                }

                await itemDoc.UpdateAsync("Pictures", FieldValue.ArrayUnion(urls.Cast<object>().ToArray()));
                return Results.Ok(new { added = urls.Count, urls });
            }).WithName("AddItemPictures");

            // Upload videos
            app.MapPost("/items/{id}/videos", async (HttpRequest req, FirestoreDb db, StorageClient storage, string id) =>
            {
                var itemDoc = db.Collection("itemID").Document(id);
                var snap = await itemDoc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                if (!req.HasFormContentType) return Results.BadRequest("multipart/form-data required");
                var form = await req.ReadFormAsync();
                if (form.Files.Count == 0) return Results.BadRequest("No files provided");

                var bucket = "hippo-exchange-media";
                var urls = new List<string>();

                foreach (var file in form.Files)
                {
                    await using var stream = file.OpenReadStream();
                    var objectName = $"items/{id}/videos/{Guid.NewGuid():n}-{file.FileName}";
                    await storage.UploadObjectAsync(
                        bucket,
                        objectName,
                        file.ContentType ?? "application/octet-stream",
                        stream
                    );

                    urls.Add(PublicUrl(bucket, objectName));
                }

                await itemDoc.UpdateAsync("Videos", FieldValue.ArrayUnion(urls.Cast<object>().ToArray()));
                return Results.Ok(new { added = urls.Count, urls });
            }).WithName("AddItemVideos");

            // -------- Users --------

            app.MapGet("/users/{userId}/items", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("itemID").WhereEqualTo("userID", userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            }).WithName("GetUserItems");

            app.MapGet("/users/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snap = await db.Collection("users").Document(userId).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<UserAuth>()) : Results.NotFound();
            }).WithName("GetUserById");

            app.MapPost("/users", async (FirestoreDb db, UserAuth user) =>
            {
                user.Id = Guid.NewGuid().ToString("n");
                user.CreatedUtc = DateTime.UtcNow;
                await db.Collection("users").Document(user.Id).SetAsync(user);
                return Results.Created($"/users/{user.Id}", user);
            }).WithName("CreateUser");

            // -------- Exchanges --------

            app.MapGet("/exchanges/owner/{ownerId}", async (FirestoreDb db, string ownerId) =>
            {
                var snaps = await db.Collection("exchanges").WhereEqualTo("ownerID", ownerId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Exchange>()));
            }).WithName("GetExchangesByOwner");

            app.MapGet("/exchanges/borrower/{borrowerId}", async (FirestoreDb db, string borrowerId) =>
            {
                var snaps = await db.Collection("exchanges").WhereEqualTo("borrowerID", borrowerId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Exchange>()));
            }).WithName("GetExchangesByBorrower");

            app.MapPost("/exchanges", async (FirestoreDb db, CreateExchangeDto dto) =>
            {
                var ex = new Exchange
                {
                    Id = Guid.NewGuid().ToString("n"),
                    OwnerId = dto.OwnerId.Trim(),
                    BorrowerId = dto.BorrowerId.Trim(),
                    ItemId = dto.ItemId.Trim(),
                    Approved = false,
                    RequestCreated = DateTime.UtcNow
                };

                await db.Collection("exchanges").Document(ex.Id).SetAsync(ex);
                return Results.Created($"/exchanges/{ex.Id}", ex);
            }).WithName("CreateExchange");

            app.MapPut("/exchanges/{id}/approval", async (FirestoreDb db, string id, UpdateExchangeApprovalDto dto) =>
            {
                var doc = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.UpdateAsync(new Dictionary<string, object> { ["approved"] = dto.Approved });
                var updated = await doc.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Exchange>());
            }).WithName("UpdateExchangeApproval");

            app.MapDelete("/exchanges/{id}", async (FirestoreDb db, string id) =>
            {
                var doc = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.DeleteAsync();
                return Results.NoContent();
            }).WithName("DeleteExchange");

            // -------- Notifications --------

            app.MapGet("/notifications/receiver/{receiverId}", async (FirestoreDb db, string receiverId) =>
            {
                var snaps = await db.Collection("notifications").WhereEqualTo("receiverID", receiverId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Notification>()));
            }).WithName("GetNotificationsByReceiver");

            app.MapPost("/notifications", async (FirestoreDb db, CreateNotificationDto dto) =>
            {
                var notif = new Notification
                {
                    Id = Guid.NewGuid().ToString("n"),
                    CreatedUtc = DateTime.UtcNow,
                    SenderId = dto.SenderId.Trim(),
                    ReceiverId = dto.ReceiverId.Trim(),
                    Message = dto.Message.Trim(),
                    Title = dto.Title.Trim(),
                    Type = dto.Type.Trim(),
                    ListingId = (dto.ListingId ?? "").Trim(),
                    SenderAvatar = dto.SenderAvatar?.Trim()
                };

                await db.Collection("notifications").Document(notif.Id).SetAsync(notif);
                return Results.Created($"/notifications/{notif.Id}", notif);
            }).WithName("CreateNotification");

            // -------- Listings --------

            app.MapGet("/listings/user/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snaps = await db.Collection("listings").WhereEqualTo("userID", userId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Listing>()));
            }).WithName("GetListingsByUser");

            app.MapPost("/listings", async (FirestoreDb db, CreateListingDto dto) =>
            {
                var listing = new Listing
                {
                    Id = Guid.NewGuid().ToString("n"),
                    ItemId = dto.ItemId.Trim(),
                    UserId = dto.UserId.Trim(),
                    CreatedUtc = DateTime.UtcNow
                };

                await db.Collection("listings").Document(listing.Id).SetAsync(listing);
                return Results.Created($"/listings/{listing.Id}", listing);
            }).WithName("CreateListing");

            app.MapDelete("/listings/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("listings").WhereEqualTo("itemID", itemId).GetSnapshotAsync();
                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            }).WithName("DeleteListingsByItemId");

            // -------- Maintenance --------

            app.MapGet("/maintenance/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("maintenance").WhereEqualTo("itemID", itemId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Maintenance>()));
            }).WithName("GetMaintenanceByItemId");

            app.MapPut("/maintenance/{maintenanceId}/description", async (FirestoreDb db, string maintenanceId, UpdateMaintenanceDescriptionDto dto) =>
            {
                var snaps = await db.Collection("maintenance")
                                    .WhereEqualTo("maintenanceID", maintenanceId)
                                    .Limit(1).GetSnapshotAsync();

                if (!snaps.Any()) return Results.NotFound();

                var docRef = snaps.First().Reference;
                await docRef.UpdateAsync(new Dictionary<string, object> { ["description"] = dto.Description.Trim() });

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Maintenance>());
            }).WithName("UpdateMaintenanceDescription");

            app.MapPost("/maintenance", async (FirestoreDb db, CreateMaintenanceDto dto) =>
            {
                var m = new Maintenance
                {
                    Id = Guid.NewGuid().ToString("n"),
                    ItemId = dto.ItemId.Trim(),
                    MaintenanceId = dto.MaintenanceId.Trim(),
                    Description = dto.Description.Trim(),
                    CreatedUtc = DateTime.UtcNow
                };

                await db.Collection("maintenance").Document(m.Id).SetAsync(m);
                return Results.Created($"/maintenance/{m.Id}", m);
            }).WithName("CreateMaintenance");

            app.MapDelete("/maintenance/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("maintenance").WhereEqualTo("itemID", itemId).GetSnapshotAsync();
                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            }).WithName("DeleteMaintenanceByItemId");

            // -------- Reviews --------

            app.MapGet("/reviews/user/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snaps = await db.Collection("reviews").WhereEqualTo("userID", userId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Review>()));
            }).WithName("GetReviewsByUserId");

            app.MapPost("/reviews", async (FirestoreDb db, CreateReviewDto dto) =>
            {
                var rating = dto.Rating;
                var rater = (dto.RaterId ?? "").Trim();
                var user = (dto.UserId ?? "").Trim();
                var desc = (dto.Description ?? "").Trim();

                if (rating == 0 || string.IsNullOrWhiteSpace(rater) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(desc))
                    return Results.BadRequest(new { message = "Rating, raterId, userId, and description are required." });

                var review = new Review
                {
                    Id = Guid.NewGuid().ToString("n"),
                    Rating = rating,
                    RaterId = rater,
                    UserId = user,
                    Description = desc
                };

                await db.Collection("reviews").Document(review.Id).SetAsync(review);
                return Results.Created($"/reviews/{review.Id}", review);
            }).WithName("CreateReview");

            app.MapPut("/reviews/{id}", async (FirestoreDb db, string id, UpdateReviewDto dto) =>
            {
                var docRef = db.Collection("reviews").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var rating = dto.Rating;
                var desc = (dto.Description ?? "").Trim();

                if (rating == 0 || string.IsNullOrWhiteSpace(desc))
                    return Results.BadRequest(new { message = "Both rating and description are required." });

                await docRef.UpdateAsync(new Dictionary<string, object>
                {
                    ["Rating"] = rating,
                    ["description"] = desc
                });

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Review>());
            }).WithName("UpdateReview");

            app.MapDelete("/reviews/{id}", async (FirestoreDb db, string id) =>
            {
                var docRef = db.Collection("reviews").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await docRef.DeleteAsync();
                return Results.NoContent();
            }).WithName("DeleteReview");

            // -------- Documents --------

            app.MapGet("/documents/maintenance/{maintenanceId}", async (FirestoreDb db, string maintenanceId) =>
            {
                var snaps = await db.Collection("Document").WhereEqualTo("maintenanceID", maintenanceId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<DocumentEntry>()));
            }).WithName("GetDocumentsByMaintenanceId");

            app.MapPost("/documents", async (FirestoreDb db, CreateDocumentDto dto) =>
            {
                var docEnt = new DocumentEntry
                {
                    Id = Guid.NewGuid().ToString("n"),
                    MaintenanceId = dto.MaintenanceId.Trim(),
                    Description = dto.Description.Trim(),
                    DocumentContent = dto.Document.Trim(),
                    CreatedUtc = DateTime.UtcNow
                };

                await db.Collection("Document").Document(docEnt.Id).SetAsync(docEnt);
                return Results.Created($"/documents/{docEnt.Id}", docEnt);
            }).WithName("CreateDocument");

            app.MapPut("/documents/{id}", async (FirestoreDb db, string id, UpdateDocumentDto dto) =>
            {
                var docRef = db.Collection("Document").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var updates = new Dictionary<string, object>();
                if (!string.IsNullOrWhiteSpace(dto.Description)) updates["description"] = dto.Description.Trim();
                if (!string.IsNullOrWhiteSpace(dto.Document)) updates["Document"] = dto.Document.Trim();

                if (updates.Count == 0) return Results.BadRequest(new { message = "No fields to update." });

                await docRef.UpdateAsync(updates);
                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<DocumentEntry>());
            }).WithName("UpdateDocument");

            app.MapDelete("/documents/maintenance/{maintenanceId}", async (FirestoreDb db, string maintenanceId) =>
            {
                var snaps = await db.Collection("Document").WhereEqualTo("maintenanceID", maintenanceId).GetSnapshotAsync();
                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            }).WithName("DeleteDocumentsByMaintenanceId");

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
                        FirstName = (dto.FirstName ?? "").Trim(),
                        LastName = (dto.LastName ?? "").Trim(),
                        Phone = (dto.Phone ?? "").Trim(),
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                        CreatedUtc = DateTime.UtcNow
                    };

                    await db.Collection("users").Document(user.Id).SetAsync(user);
                    return Results.Created($"/users/{user.Id}", new
                    {
                        user.Id,
                        user.Email,
                        user.FirstName,
                        user.LastName
                    });
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Register failed");
                    return Results.Problem(title: "Register failed", detail: ex.Message, statusCode: 500);
                }
            }).WithName("Register");

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

                    return Results.Ok(new
                    {
                        user.Id,
                        user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName
                    });
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Login failed");
                    return Results.Problem(title: "Login failed", detail: ex.Message, statusCode: 500);
                }
            }).WithName("Login");

            app.Run();
        }
    }

    // ---------------- Firestore models ----------------
    [FirestoreData]
    public class Item
    {
        [FirestoreDocumentId] public string? Id { get; set; }

        [FirestoreProperty("userID")] public string UserId { get; set; } = default!;
        [FirestoreProperty("Title")] public string Title { get; set; } = default!;
        [FirestoreProperty("Description")] public string? Description { get; set; }
        [FirestoreProperty("Condition")] public string? Condition { get; set; }
        [FirestoreProperty("Location")] public string? Location { get; set; }
        [FirestoreProperty("DollarCost")] public double? DollarCost { get; set; }
        [FirestoreProperty("RepCost")] public double? RepCost { get; set; }
        [FirestoreProperty] public List<string> Categories { get; set; } = new();
        [FirestoreProperty] public List<string> Pictures { get; set; } = new();
        [FirestoreProperty] public List<string> Videos { get; set; } = new();
        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }
    }

    [FirestoreData]
    public class UserAuth
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("Email")] public string Email { get; set; } = default!;
        [FirestoreProperty("Phone")] public string Phone { get; set; } = default!;
        [FirestoreProperty("FirstName")] public string FirstName { get; set; } = default!;
        [FirestoreProperty("LastName")] public string LastName { get; set; } = default!;
        [FirestoreProperty("PasswordHash")] public string PasswordHash { get; set; } = default!;
        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty("ProfilePicture")] public string? ProfilePicture { get; set; }
        [FirestoreProperty("TotalLended")] public double TotalLended { get; set; } = 0;
        [FirestoreProperty("TotalBorrowed")] public double TotalBorrowed { get; set; } = 0;
        [FirestoreProperty("Description")] public string? Description { get; set; }
    }

    [FirestoreData]
    public class Exchange
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("approved")] public bool Approved { get; set; } = false;
        [FirestoreProperty("borrowerID")] public string BorrowerId { get; set; } = default!;
        [FirestoreProperty("ownerID")] public string OwnerId { get; set; } = default!;
        [FirestoreProperty("itemID")] public string ItemId { get; set; } = default!;
        [FirestoreProperty("startDate")] public DateTime? StartDate { get; set; }
        [FirestoreProperty("endDate")] public DateTime? EndDate { get; set; }
        [FirestoreProperty("requestCreated")] public DateTime RequestCreated { get; set; }
        [FirestoreProperty("requestHandled")] public DateTime? RequestHandled { get; set; }
    }

    [FirestoreData]
    public class Notification
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty("listingID")] public string ListingId { get; set; } = default!;
        [FirestoreProperty("message")] public string Message { get; set; } = default!;
        [FirestoreProperty("receiverID")] public string ReceiverId { get; set; } = default!;
        [FirestoreProperty("senderAvatar")] public string? SenderAvatar { get; set; }
        [FirestoreProperty("senderID")] public string SenderId { get; set; } = default!;
        [FirestoreProperty("title")] public string Title { get; set; } = default!;
        [FirestoreProperty("type")] public string Type { get; set; } = default!;
    }

    [FirestoreData]
    public class Listing
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty("itemID")] public string ItemId { get; set; } = default!;
        [FirestoreProperty("userID")] public string UserId { get; set; } = default!;
    }

    [FirestoreData]
    public class Maintenance
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty("description")] public string Description { get; set; } = default!;
        [FirestoreProperty("itemID")] public string ItemId { get; set; } = default!;
        [FirestoreProperty("maintenanceID")] public string MaintenanceId { get; set; } = default!;
    }

    [FirestoreData]
    public class DocumentEntry
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty("description")] public string Description { get; set; } = default!;
        [FirestoreProperty("Document")] public string DocumentContent { get; set; } = default!;
        [FirestoreProperty("maintenanceID")] public string MaintenanceId { get; set; } = default!;
    }

    [FirestoreData]
    public class Review
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("Rating")] public int Rating { get; set; }
        [FirestoreProperty("raterID")] public string RaterId { get; set; } = default!;
        [FirestoreProperty("description")] public string Description { get; set; } = default!;
        [FirestoreProperty("userID")] public string UserId { get; set; } = default!;
    }

    // ---------------- DTOs ----------------
    public record AuthRegisterDto(string Email, string Phone, string FirstName, string LastName, string Password);
    public record AuthLoginDto(string Email, string Password);

    public record CreateExchangeDto(string OwnerId, string BorrowerId, string ItemId);
    public record UpdateExchangeApprovalDto(bool Approved);

    public record CreateNotificationDto(string SenderId, string ReceiverId, string Message, string Title, string Type, string? ListingId = null, string? SenderAvatar = null);

    public record CreateListingDto(string ItemId, string UserId);

    public record CreateMaintenanceDto(string ItemId, string MaintenanceId, string Description);
    public record UpdateMaintenanceDescriptionDto(string Description);

    public record CreateDocumentDto(string MaintenanceId, string Description, string Document);
    public record UpdateDocumentDto(string? Description, string? Document);

    // ---- Review DTOs ----
    public record CreateReviewDto(
        int Rating,
        string RaterId,
        string UserId,
        string Description
    );

    public record UpdateReviewDto(
        int Rating,
        string Description
    );
}
