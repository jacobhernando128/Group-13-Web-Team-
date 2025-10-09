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

            // Firebase Admin (optional, present for future token work)
            if (FirebaseApp.DefaultInstance is null)
            {
                FirebaseApp.Create(new FirebaseAdmin.AppOptions
                {
                    Credential = googleCred
                });
            }

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
            }).WithName("Health_Firestore");

            // Show credential path/existence
            app.MapGet("/debug/adc", () =>
            {
                var exists = !string.IsNullOrWhiteSpace(credPath) && File.Exists(credPath);
                return Results.Ok(new { credentialPath = credPath, exists });
            }).WithName("Debug_ADC");

            // -------- Items --------

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
                await db.Collection("itemID").Document(item.Id).SetAsync(item);
                return Results.Created($"/items/{item.Id}", item);
            }).WithName("CreateItem");

            app.MapGet("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var snap = await db.Collection("itemID").Document(id).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<Item>()) : Results.NotFound();
            }).WithName("GetItemById");

            app.MapGet("/items", async (FirestoreDb db, string? ownerId, bool? available) =>
            {
                Query q = db.Collection("itemID");
                if (!string.IsNullOrWhiteSpace(ownerId))
                    q = q.WhereEqualTo("userID", ownerId);

                var snaps = await q.Limit(50).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Item>()));
            }).WithName("ListItems");

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

            // -------- Users (demo reads) --------
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

            app.MapPost("/users", async (FirestoreDb db, User user) =>
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
