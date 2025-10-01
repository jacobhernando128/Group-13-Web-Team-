using Google.Cloud.Firestore;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Routing;
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using System.Security.Cryptography;
using System.Text;

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
                ?? "(default)";

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
                    Description = "Simple CRUD API backed by Firestore + Firebase custom tokens"
                });
            });

            builder.Services.AddCors(o =>
            {
                // For dev. In prod, restrict origins.
                o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
            });

            // ---- Initialize Firebase Admin SDK ----
            if (FirebaseApp.DefaultInstance is null)
            {
                FirebaseApp.Create(new AppOptions
                {
                    Credential = GoogleCredential.GetApplicationDefault()
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

            // ---- Static files (serve frontend) ----
            var defaults = new DefaultFilesOptions();
            defaults.DefaultFileNames.Clear();
            defaults.DefaultFileNames.Add("Login.html");
            defaults.DefaultFileNames.Add("Home.html");
            defaults.DefaultFileNames.Add("index.html");
            app.UseDefaultFiles(defaults);
            app.UseStaticFiles();

            app.UseCors();

            // ----------------- Health -----------------
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

            // ----------------- Auth (register/login) -----------------
            // Password hashing helper (PBKDF2)
            const int PBKDF2_ITERATIONS = 100_000;
            const int SALT_SIZE = 16;
            const int KEY_SIZE = 32;
            static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

            static string HashPassword(string password)
            {
                using var rng = RandomNumberGenerator.Create();
                var salt = new byte[SALT_SIZE];
                rng.GetBytes(salt);
                using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, PBKDF2_ITERATIONS, HashAlgorithmName.SHA256);
                var hash = pbkdf2.GetBytes(KEY_SIZE);
                return $"v1${PBKDF2_ITERATIONS}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
            }

            static bool VerifyPassword(string password, string stored)
            {
                try
                {
                    var parts = stored.Split('$', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length != 4 || parts[0] != "v1") return false;
                    var iterations = int.Parse(parts[1]);
                    var salt = Convert.FromBase64String(parts[2]);
                    var expected = Convert.FromBase64String(parts[3]);
                    using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
                    var actual = pbkdf2.GetBytes(expected.Length);
                    return CryptographicOperations.FixedTimeEquals(actual, expected);
                }
                catch { return false; }
            }

            // POST /auth/register  { email, password, (optional) name, firstName, lastName, phone, username }
            app.MapPost("/auth/register", async (FirestoreDb db, RegisterRequest req) =>
            {
                if (string.IsNullOrWhiteSpace(req.Email) ||
                    string.IsNullOrWhiteSpace(req.Password) ||
                    req.Password.Length < 8)
                {
                    return Results.BadRequest(new { error = "Invalid input." });
                }

                var emailNorm = NormalizeEmail(req.Email);
                var authDoc = db.Collection("auth").Document(emailNorm);
                var authSnap = await authDoc.GetSnapshotAsync();
                if (authSnap.Exists)
                    return Results.Conflict(new { error = "Email already registered." });

                // Derive display Name if not explicitly provided
                var name =
                    !string.IsNullOrWhiteSpace(req.Name) ? req.Name!.Trim()
                    : $"{req.FirstName ?? ""} {req.LastName ?? ""}".Trim();

                if (string.IsNullOrWhiteSpace(name))
                    return Results.BadRequest(new { error = "Name or first/last name required." });

                // Create user profile doc
                var user = new User
                {
                    Id = Guid.NewGuid().ToString("n"),
                    Email = emailNorm,
                    Name = name,
                    FirstName = string.IsNullOrWhiteSpace(req.FirstName) ? null : req.FirstName!.Trim(),
                    LastName = string.IsNullOrWhiteSpace(req.LastName) ? null : req.LastName!.Trim(),
                    Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone!.Trim(),
                    Username = string.IsNullOrWhiteSpace(req.Username) ? null : req.Username!.Trim(),
                    CreatedUtc = DateTime.UtcNow
                };
                await db.Collection("users").Document(user.Id).SetAsync(user);

                // Create credential doc (separate from profile)
                var authRecord = new AuthRecord
                {
                    UserId = user.Id,
                    PasswordHash = HashPassword(req.Password),
                    CreatedUtc = DateTime.UtcNow
                };
                await authDoc.SetAsync(authRecord);

                return Results.Created($"/users/{user.Id}", new { id = user.Id, email = user.Email, name = user.Name });
            });

            // POST /auth/login  { email, password }
            app.MapPost("/auth/login", async (FirestoreDb db, LoginRequest req) =>
            {
                if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
                    return Results.BadRequest(new { error = "Email and password are required." });

                var emailNorm = NormalizeEmail(req.Email);
                var authDoc = db.Collection("auth").Document(emailNorm);
                var authSnap = await authDoc.GetSnapshotAsync();
                if (!authSnap.Exists)
                    return Results.Unauthorized();

                var auth = authSnap.ConvertTo<AuthRecord>();
                if (!VerifyPassword(req.Password, auth.PasswordHash))
                    return Results.Unauthorized();

                var userSnap = await db.Collection("users").Document(auth.UserId).GetSnapshotAsync();
                if (!userSnap.Exists)
                    return Results.Problem(statusCode: 500, title: "User missing", detail: "Auth record has no user.");

                var user = userSnap.ConvertTo<User>();
                return Results.Ok(new { id = user.Id, email = user.Email, name = user.Name });
            });

            // POST /auth/custom-token  { userId, claims? }
            app.MapPost("/auth/custom-token", async (FirestoreDb db, CustomTokenRequest req) =>
            {
                if (string.IsNullOrWhiteSpace(req.UserId))
                    return Results.BadRequest(new { error = "UserId is required." });

                var snap = await db.Collection("users").Document(req.UserId).GetSnapshotAsync();
                if (!snap.Exists)
                    return Results.NotFound(new { error = "User not found." });

                var user = snap.ConvertTo<User>();

                var claims = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                if (req.Claims is not null)
                {
                    foreach (var kv in req.Claims)
                        claims[kv.Key] = kv.Value;
                }

                // Example derived claim
                if (!claims.ContainsKey("role"))
                {
                    var role = (user.Email?.EndsWith("@ttu.edu", StringComparison.OrdinalIgnoreCase) == true)
                        ? "student" : "user";
                    claims["role"] = role;
                }

                var token = await FirebaseAuth.DefaultInstance.CreateCustomTokenAsync(req.UserId, claims);
                return Results.Ok(new CustomTokenResponse { Token = token });
            });

            // ----------------- Items -----------------
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

            app.MapPut("/items/{id}", async (FirestoreDb db, string id, ItemUpdate update) =>
            {
                var doc = db.Collection("items").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var current = snap.ConvertTo<Item>();
                current.Title = update.Title ?? current.Title;
                current.Description = update.Description ?? current.Description;
                if (update.Available is not null) current.Available = update.Available.Value;
                current.OwnerId = update.OwnerId ?? current.OwnerId;

                await doc.SetAsync(current, SetOptions.Overwrite);
                return Results.Ok(current);
            });

            app.MapDelete("/items/{id}", async (FirestoreDb db, string id) =>
            {
                await db.Collection("items").Document(id).DeleteAsync();
                return Results.NoContent();
            });

            app.MapGet("/users/{userId}/items", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("items").WhereEqualTo(nameof(Item.OwnerId), userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            });

            // ----------------- Users -----------------
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

            // ----------------- Borrowings -----------------
            app.MapGet("/users/{userId}/borrowed", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("borrowings").WhereEqualTo(nameof(Borrowing.BorrowerId), userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Borrowing>());
            });

            app.MapPost("/borrowings", async (FirestoreDb db, Borrowing borrowing) =>
            {
                borrowing.Id = Guid.NewGuid().ToString("n");
                borrowing.CreatedUtc = DateTime.UtcNow;
                borrowing.Status = "pending";
                await db.Collection("borrowings").Document(borrowing.Id).SetAsync(borrowing);
                return Results.Created($"/borrowings/{borrowing.Id}", borrowing);
            });

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

            // ----------------- Maintenance -----------------
            app.MapGet("/items/{itemId}/maintenance", async (FirestoreDb db, string itemId) =>
            {
                var q = db.Collection("maintenance").WhereEqualTo(nameof(MaintenanceEntry.ItemId), itemId);
                var snaps = await q.OrderByDescending(nameof(MaintenanceEntry.Date)).GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<MaintenanceEntry>());
            });

            app.MapPost("/maintenance", async (FirestoreDb db, MaintenanceEntry maintenance) =>
            {
                maintenance.Id = Guid.NewGuid().ToString("n");
                maintenance.CreatedUtc = DateTime.UtcNow;
                await db.Collection("maintenance").Document(maintenance.Id).SetAsync(maintenance);
                return Results.Created($"/maintenance/{maintenance.Id}", maintenance);
            });

            app.MapDelete("/maintenance/{id}", async (FirestoreDb db, string id) =>
            {
                await db.Collection("maintenance").Document(id).DeleteAsync();
                return Results.NoContent();
            });

            app.Run();
        }
    }

    // ---------------- DTOs ----------------
    public class RegisterRequest
    {
        public string Email { get; set; } = default!;
        public string Password { get; set; } = default!;

        public string? Name { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Phone { get; set; }
        public string? Username { get; set; }
    }

    public class LoginRequest
    {
        public string Email { get; set; } = default!;
        public string Password { get; set; } = default!;
    }

    public class CustomTokenRequest
    {
        public string UserId { get; set; } = default!;
        public Dictionary<string, object>? Claims { get; set; }
    }

    public class CustomTokenResponse
    {
        public string Token { get; set; } = default!;
    }

    [FirestoreData]
    public class AuthRecord
    {
        public AuthRecord() { } // explicit parameterless ctor helps Firestore's converter

        [FirestoreProperty] public string UserId { get; set; } = default!;
        [FirestoreProperty] public string PasswordHash { get; set; } = default!;
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
    }

    public class ItemUpdate
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public bool? Available { get; set; }
        public string? OwnerId { get; set; }
    }

    // ---------------- Firestore models ----------------
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

        // Optional profile fields
        [FirestoreProperty] public string? FirstName { get; set; }
        [FirestoreProperty] public string? LastName { get; set; }
        [FirestoreProperty] public string? Phone { get; set; }
        [FirestoreProperty] public string? Username { get; set; }

        [FirestoreProperty] public string? ProfilePicture { get; set; }
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
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
        [FirestoreProperty] public double Cost { get; set; } = 0;
        [FirestoreProperty] public DateTime CreatedUtc { get; set; }
        [FirestoreProperty] public string? Notes { get; set; }
    }
}
