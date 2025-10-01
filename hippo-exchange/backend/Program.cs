<<<<<<< Updated upstream
using Google.Cloud.Firestore;
=======
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Google.Cloud.Storage.V1;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.Extensions.Hosting;
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
            builder.WebHost.ConfigureKestrel(options =>
            {
                options.ListenAnyIP(5000); // change 5000 to whatever port you want
                                           // If you want HTTPS with a cert:
                                           // // options.ListenAnyIP(443, listenOptions => listenOptions.UseHttps("cert.pfx", "password"));
            });
>>>>>>> Stashed changes

            // ---- Config ----
            var projectId =
                Environment.GetEnvironmentVariable("GOOGLE_CLOUD_PROJECT")
                ?? builder.Configuration["GoogleCloud:ProjectId"]
                ?? throw new InvalidOperationException("ProjectId not configured.");

            var databaseId =
                Environment.GetEnvironmentVariable("FIRESTORE_DATABASE_ID")
                ?? "(default)";

<<<<<<< Updated upstream
            // ---- Services ----
            builder.Services.AddSingleton(_ =>
                new FirestoreDbBuilder { ProjectId = projectId, DatabaseId = databaseId }.Build());
=======
            static string PublicUrl(string bucket, string objectName)
            => $"https://storage.googleapis.com/{bucket}/{Uri.EscapeDataString(objectName)}";


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
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
            // ----------------- Health -----------------
            app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
=======
            // ===================== API =====================

            // Health
            app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
            .WithName("Health")
            .WithTags("Health")
            .Produces(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "Service health";
                op.Description = "Lightweight liveness check for the API.";
                return op;
            });
>>>>>>> Stashed changes

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
            })
            .WithName("Health_Firestore")
            .WithTags("Health")
            .Produces(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable)
            .WithOpenApi(op =>
            {
                op.Summary = "Firestore health";
                op.Description = "Probes Firestore by reading 1 doc from the users collection. Returns project/database IDs on success.";
                return op;
            });

<<<<<<< Updated upstream
            // ----------------- Auth (register/login) -----------------
            // Password hashing helper (PBKDF2)
            const int PBKDF2_ITERATIONS = 100_000;
            const int SALT_SIZE = 16;
            const int KEY_SIZE = 32;
            static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

            static string HashPassword(string password)
=======
            // ---- Debug ----
            app.MapGet("/debug/adc", () =>
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
=======
                    credentialPath = p,
                    exists = !string.IsNullOrWhiteSpace(p) && File.Exists(p)
                });
            })
            .WithName("Debug_ADC")
            .WithTags("Debug")
            .Produces(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "Show ADC credential path";
                op.Description = "Returns the resolved Application Default Credentials (ADC) file path and whether it exists on disk.";
                return op;
            });

            // -------- Items --------

            // Create a new item and return it (assigns Id and CreatedUtc)
>>>>>>> Stashed changes
            app.MapPost("/items", async (FirestoreDb db, Item item) =>
            {
                item.Id = Guid.NewGuid().ToString("n");
                item.CreatedUtc = DateTime.UtcNow;
                await db.Collection("itemID").Document(item.Id).SetAsync(item);
                return Results.Created($"/items/{item.Id}", item);
            })
            .WithName("CreateItem")
            .WithTags("Items")
            .Accepts<Item>("application/json")
            .Produces<Item>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a new item";
                op.Description = "Creates a new item document in Firestore. Assigns a generated Id and CreatedUtc timestamp.";
                return op;
            });

            // Get a single item by its id
            app.MapGet("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var snap = await db.Collection("itemID").Document(id).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<Item>()) : Results.NotFound();
            })
            .WithName("GetItemById")
            .WithTags("Items")
            .Produces<Item>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Get item by id";
                op.Description = "Retrieves a single item document from Firestore using its unique id.";
                return op;
            });

<<<<<<< Updated upstream
            app.MapPut("/items/{id}", async (FirestoreDb db, string id, ItemUpdate update) =>
=======
            // List items (optionally filter by ownerId)
            app.MapGet("/items", async (FirestoreDb db, string? ownerId) =>
            {
                Query q = db.Collection("itemID");
                if (!string.IsNullOrWhiteSpace(ownerId))
                    q = q.WhereEqualTo("userID", ownerId);

                var snaps = await q.Limit(50).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Item>()));
            })
            .WithName("ListItems")
            .WithTags("Items")
            .Produces<IEnumerable<Item>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List items";
                op.Description = "Lists up to 50 items. Optionally filter results by ownerId.";
                return op;
            });


            // Update an existing item by id (partial update of fields)
            // Update an existing item by id (partial update of fields)
            app.MapPut("/items/{id}", async (FirestoreDb db, string id, Item update) =>
>>>>>>> Stashed changes
            {
                var doc = db.Collection("itemID").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var current = snap.ConvertTo<Item>();
                current.Title       = update.Title       ?? current.Title;
                current.Description = update.Description ?? current.Description;
<<<<<<< Updated upstream
                if (update.Available is not null) current.Available = update.Available.Value;
                current.OwnerId = update.OwnerId ?? current.OwnerId;
=======
                current.UserId      = update.UserId      ?? current.UserId;
>>>>>>> Stashed changes

                await doc.SetAsync(current, SetOptions.Overwrite);
                return Results.Ok(current);
            })
            .WithName("UpdateItem")
            .WithTags("Items")
            .Accepts<Item>("application/json")
            .Produces<Item>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Update an item";
                op.Description = "Updates an item document by id. Supports partial updates for Title, Description, and UserId.";
                return op;
            });


            // Delete an item by id
            app.MapDelete("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var doc = db.Collection("itemID").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.DeleteAsync();
                return Results.NoContent();
            })
            .WithName("DeleteItem")
            .WithTags("Items")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete an item";
                op.Description = "Deletes an item document from Firestore by id.";
                return op;
            });

<<<<<<< Updated upstream
=======
            // Add one or more picture URLs
            app.MapPost("/items/{id}/pictures", async (HttpRequest req, FirestoreDb db, string id) =>
            {
                var itemDoc = db.Collection("itemID").Document(id);
                var snap = await itemDoc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                if (!req.HasFormContentType) return Results.BadRequest("multipart/form-data required");
                var form = await req.ReadFormAsync();
                if (form.Files.Count == 0) return Results.BadRequest("No files provided");

                var bucket = "hippo-exchange-media";              // bucket for uploaded pictures/videos
                var storage = StorageClient.Create();
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
            })
            .WithName("AddItemPictures")
            .WithTags("Items", "Media")
            .Accepts<IFormFileCollection>("multipart/form-data")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Upload picture(s) for an item";
                op.Description = "Accepts multipart/form-data files, uploads to GCS, and appends public URLs to the item's Pictures array.";
                return op;
            });

            // Add one or more video URLs
            app.MapPost("/items/{id}/videos", async (HttpRequest req, FirestoreDb db, string id) =>
            {
                var itemDoc = db.Collection("itemID").Document(id);
                var snap = await itemDoc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                if (!req.HasFormContentType) return Results.BadRequest("multipart/form-data required");
                var form = await req.ReadFormAsync();
                if (form.Files.Count == 0) return Results.BadRequest("No files provided");

                var bucket = "hippo-exchange-media";
                var storage = StorageClient.Create();
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
            })
            .WithName("AddItemVideos")
            .WithTags("Items", "Media")
            .Accepts<IFormFileCollection>("multipart/form-data")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Upload video(s) for an item";
                op.Description = "Accepts multipart/form-data files, uploads to GCS, and appends public URLs to the item's Videos array.";
                return op;
            });

            // -------- Users --------

>>>>>>> Stashed changes
            app.MapGet("/users/{userId}/items", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("itemID").WhereEqualTo("userID", userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            })
            .WithName("GetUserItems")
            .WithTags("Users", "Items")
            .Produces<IEnumerable<Item>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "List items owned by a user";
                op.Description = "Queries the itemID collection for documents where userID matches the provided userId.";
                return op;
            });

            // ----------------- Users -----------------
            app.MapGet("/users/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snap = await db.Collection("users").Document(userId).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<UserAuth>()) : Results.NotFound();
            })
            .WithName("GetUserById")
            .WithTags("Users")
            .Produces<UserAuth>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Get a user profile by id";
                op.Description = "Reads the users document and returns it as UserAuth.";
                return op;
            });

            app.MapPost("/users", async (FirestoreDb db, UserAuth user) =>
            {
                user.Id = Guid.NewGuid().ToString("n");
                user.CreatedUtc = DateTime.UtcNow;
                await db.Collection("users").Document(user.Id).SetAsync(user);
                return Results.Created($"/users/{user.Id}", user);
            })
            .WithName("CreateUser")
            .WithTags("Users")
            .Accepts<UserAuth>("application/json")
            .Produces<UserAuth>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a user profile";
                op.Description = "Creates a users document directly from a UserAuth payload. Prefer /auth/register if you want password hashing.";
                return op;
            });

<<<<<<< Updated upstream
            // ----------------- Borrowings -----------------
            app.MapGet("/users/{userId}/borrowed", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("borrowings").WhereEqualTo(nameof(Borrowing.BorrowerId), userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Borrowing>());
=======
            // -------- Exchanges --------

            // GET /exchanges/owner/{ownerId}  — all exchanges for an owner
            app.MapGet("/exchanges/owner/{ownerId}", async (FirestoreDb db, string ownerId) =>
            {
                var snaps = await db.Collection("exchanges")
                                    .WhereEqualTo("ownerID", ownerId)
                                    .GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Exchange>()));
            })
            .WithName("GetExchangesByOwner")
            .WithTags("Exchanges")
            .Produces<IEnumerable<Exchange>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List exchanges by owner";
                op.Description = "Returns all exchange documents where ownerID matches the provided ownerId.";
                return op;
            });

            // GET /exchanges/borrower/{borrowerId}  — all exchanges for a borrower
            app.MapGet("/exchanges/borrower/{borrowerId}", async (FirestoreDb db, string borrowerId) =>
            {
                var snaps = await db.Collection("exchanges")
                                    .WhereEqualTo("borrowerID", borrowerId)
                                    .GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Exchange>()));
            })
            .WithName("GetExchangesByBorrower")
            .WithTags("Exchanges")
            .Produces<IEnumerable<Exchange>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List exchanges by borrower";
                op.Description = "Returns all exchange documents where borrowerID matches the provided borrowerId.";
                return op;
            });

            // POST /exchanges  — create exchange (ownerID, borrowerID, itemID, requestCreated auto)
            app.MapPost("/exchanges", async (FirestoreDb db, CreateExchangeDto dto) =>
            {
                var ex = new Exchange
                {
                    Id = Guid.NewGuid().ToString("n"),
                    OwnerId = dto.OwnerId.Trim(),
                    BorrowerId = dto.BorrowerId.Trim(),
                    ItemId = dto.ItemId.Trim(),
                    Approved = false,                    // defaults false per your model
                    RequestCreated = DateTime.UtcNow,    // auto timestamp (UTC)
                    StartDate = null,
                    EndDate = null,
                    RequestHandled = null
                };

                await db.Collection("exchanges").Document(ex.Id).SetAsync(ex);
                return Results.Created($"/exchanges/{ex.Id}", ex);
            })
            .WithName("CreateExchange")
            .WithTags("Exchanges")
            .Accepts<CreateExchangeDto>("application/json")
            .Produces<Exchange>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create an exchange";
                op.Description = "Creates a new exchange with ownerID, borrowerID, and itemID. Sets requestCreated automatically.";
                return op;
            });

            // PUT /exchanges/{id}/approval  — update only the Approved flag
            app.MapPut("/exchanges/{id}/approval", async (FirestoreDb db, string id, UpdateExchangeApprovalDto dto) =>
            {
                var doc = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                // Update Approved, and if you consider this 'handled', optionally set RequestHandled
                var updates = new Dictionary<string, object>
                {
                    ["approved"] = dto.Approved
                    // ,["requestHandled"] = DateTime.UtcNow   // uncomment if 'approval' implies handled
                };
                await doc.UpdateAsync(updates);

                var updated = await doc.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Exchange>());
            })
            .WithName("UpdateExchangeApproval")
            .WithTags("Exchanges")
            .Accepts<UpdateExchangeApprovalDto>("application/json")
            .Produces<Exchange>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Update approval status";
                op.Description = "Updates the boolean approved field on an exchange by id.";
                return op;
            });

            // DELETE /exchanges/{id}  — delete exchange by id
            app.MapDelete("/exchanges/{id}", async (FirestoreDb db, string id) =>
            {
                var doc = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.DeleteAsync();
                return Results.NoContent();
            })
            .WithName("DeleteExchange")
            .WithTags("Exchanges")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete an exchange";
                op.Description = "Deletes an exchange document by id.";
                return op;
            });

            // -------- Notifications --------

            // GET /notifications/receiver/{receiverId} — all notifications for a receiver
            app.MapGet("/notifications/receiver/{receiverId}", async (FirestoreDb db, string receiverId) =>
            {
                var snaps = await db.Collection("notifications")
                                    .WhereEqualTo("receiverID", receiverId)
                                    .GetSnapshotAsync();

                return Results.Ok(snaps.Select(s => s.ConvertTo<Notification>()));
            })
            .WithName("GetNotificationsByReceiver")
            .WithTags("Notifications")
            .Produces<IEnumerable<Notification>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List notifications by receiver";
                op.Description = "Returns all notification documents where receiverID matches the provided receiverId.";
                return op;
            });


            // POST /notifications — create a notification (senderID, receiverID required)
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
                    ListingId = dto.ListingId?.Trim() ?? "",
                    SenderAvatar = dto.SenderAvatar?.Trim()
                };

                await db.Collection("notifications").Document(notif.Id).SetAsync(notif);

                return Results.Created($"/notifications/{notif.Id}", notif);
            })
            .WithName("CreateNotification")
            .WithTags("Notifications")
            .Accepts<CreateNotificationDto>("application/json")
            .Produces<Notification>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a notification";
                op.Description = "Creates a new notification with senderID and receiverID required. The server sets the timestamp automatically.";
                return op;
            });

            // -------- Listings --------

            // GET /listings/user/{userId} — all listings for a user
            app.MapGet("/listings/user/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snaps = await db.Collection("listings")
                                    .WhereEqualTo("userID", userId)
                                    .GetSnapshotAsync();

                return Results.Ok(snaps.Select(s => s.ConvertTo<Listing>()));
            })
            .WithName("GetListingsByUser")
            .WithTags("Listings")
            .Produces<IEnumerable<Listing>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List listings by user";
                op.Description = "Returns all listing documents where userID matches the provided userId.";
                return op;
            });


            // POST /listings — create a listing (itemID, userID; CreatedUtc auto)
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
            })
            .WithName("CreateListing")
            .WithTags("Listings")
            .Accepts<CreateListingDto>("application/json")
            .Produces<Listing>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a listing";
                op.Description = "Creates a new listing for a user and item. The server sets CreatedUtc automatically.";
                return op;
            });


            // DELETE /listings/item/{itemId} — delete listing(s) by itemID
            app.MapDelete("/listings/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("listings")
                                    .WhereEqualTo("itemID", itemId)
                                    .GetSnapshotAsync();

                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            })
            .WithName("DeleteListingsByItemId")
            .WithTags("Listings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete listing(s) by itemID";
                op.Description = "Deletes all listing documents that reference the given itemID.";
                return op;
            });

            // -------- Maintenance --------

            app.MapGet("/maintenance/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("maintenance")
                                    .WhereEqualTo("itemID", itemId)
                                    .GetSnapshotAsync();

                return Results.Ok(snaps.Select(s => s.ConvertTo<Maintenance>()));
            })
            .WithName("GetMaintenanceByItemId")
            .WithTags("Maintenance")
            .Produces<IEnumerable<Maintenance>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List maintenance by itemID";
                op.Description = "Returns all maintenance documents where itemID matches the provided itemId.";
                return op;
            });

            app.MapPut("/maintenance/{maintenanceId}/description", async (FirestoreDb db, string maintenanceId, UpdateMaintenanceDescriptionDto dto) =>
            {
                var snaps = await db.Collection("maintenance")
                                    .WhereEqualTo("maintenanceID", maintenanceId)
                                    .Limit(1)
                                    .GetSnapshotAsync();

                if (!snaps.Any()) return Results.NotFound();

                var docRef = snaps.First().Reference;
                await docRef.UpdateAsync(new Dictionary<string, object>
                {
                    ["description"] = dto.Description.Trim()
                });

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Maintenance>());
            })
            .WithName("UpdateMaintenanceDescription")
            .WithTags("Maintenance")
            .Accepts<UpdateMaintenanceDescriptionDto>("application/json")
            .Produces<Maintenance>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Update maintenance description";
                op.Description = "Updates the description field for the maintenance document identified by maintenanceID.";
                return op;
            });

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
            })
            .WithName("CreateMaintenance")
            .WithTags("Maintenance")
            .Accepts<CreateMaintenanceDto>("application/json")
            .Produces<Maintenance>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a maintenance record";
                op.Description = "Creates a new maintenance document with itemID, maintenanceID, and description. The server sets CreatedUtc.";
                return op;
            });

            app.MapDelete("/maintenance/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("maintenance")
                                    .WhereEqualTo("itemID", itemId)
                                    .GetSnapshotAsync();

                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            })
            .WithName("DeleteMaintenanceByItemId")
            .WithTags("Maintenance")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete maintenance by itemID";
                op.Description = "Deletes all maintenance documents that reference the given itemID.";
                return op;
            });

            // -------- Reviews --------

            // GET /reviews/user/{userId} — all reviews written about a specific user
            app.MapGet("/reviews/user/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snaps = await db.Collection("reviews")
                                    .WhereEqualTo("userID", userId)
                                    .GetSnapshotAsync();

                return Results.Ok(snaps.Select(s => s.ConvertTo<Review>()));
            })
            .WithName("GetReviewsByUserId")
            .WithTags("Reviews")
            .Produces<IEnumerable<Review>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List reviews by userID";
                op.Description = "Returns all review documents where userID matches the provided userId.";
                return op;
            });

            // POST /reviews — create a review (all fields required)
            app.MapPost("/reviews", async (FirestoreDb db, CreateReviewDto dto) =>
            {
                var rating = dto.Rating;
                var rater  = (dto.RaterId ?? "").Trim();
                var user   = (dto.UserId  ?? "").Trim();
                var desc   = (dto.Description ?? "").Trim();

                if (rating == 0 || string.IsNullOrWhiteSpace(rater) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(desc))
                    return Results.BadRequest(new { message = "Rating, raterId, userId, and description are required." });

                var review = new Review
                {
                    Id          = Guid.NewGuid().ToString("n"),
                    Rating      = rating,
                    RaterId     = rater,
                    UserId      = user,
                    Description = desc
                };

                await db.Collection("reviews").Document(review.Id).SetAsync(review);
                return Results.Created($"/reviews/{review.Id}", review);
            })
            .WithName("CreateReview")
            .WithTags("Reviews")
            .Accepts<CreateReviewDto>("application/json")
            .Produces<Review>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a review";
                op.Description = "Creates a new review document. All fields are required.";
                return op;
            });

            // PUT /reviews/{id} — edit rating and description for a specific review
            app.MapPut("/reviews/{id}", async (FirestoreDb db, string id, UpdateReviewDto dto) =>
            {
                var docRef = db.Collection("reviews").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var rating = dto.Rating;
                var desc   = (dto.Description ?? "").Trim();

                if (rating == 0 || string.IsNullOrWhiteSpace(desc))
                    return Results.BadRequest(new { message = "Both rating and description are required." });

                await docRef.UpdateAsync(new Dictionary<string, object>
                {
                    ["Rating"]      = rating,
                    ["description"] = desc
                });

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Review>());
            })
            .WithName("UpdateReview")
            .WithTags("Reviews")
            .Accepts<UpdateReviewDto>("application/json")
            .Produces<Review>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Update a review";
                op.Description = "Updates the rating and description of the specified review.";
                return op;
            });

            // DELETE /reviews/{id} — delete a review by id
            app.MapDelete("/reviews/{id}", async (FirestoreDb db, string id) =>
            {
                var docRef = db.Collection("reviews").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await docRef.DeleteAsync();
                return Results.NoContent();
            })
            .WithName("DeleteReview")
            .WithTags("Reviews")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete a review";
                op.Description = "Deletes the review document identified by id.";
                return op;
            });

            // -------- DocumentEntry --------

            // GET /documents/maintenance/{maintenanceId}
            app.MapGet("/documents/maintenance/{maintenanceId}", async (FirestoreDb db, string maintenanceId) =>
            {
                var snaps = await db.Collection("Document")
                                    .WhereEqualTo("maintenanceID", maintenanceId)
                                    .GetSnapshotAsync();

                return Results.Ok(snaps.Select(s => s.ConvertTo<DocumentEntry>()));
            })
            .WithName("GetDocumentsByMaintenanceId")
            .WithTags("Documents")
            .Produces<IEnumerable<DocumentEntry>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List documents by maintenanceID";
                op.Description = "Returns all documents in the Document collection where maintenanceID matches the provided value.";
                return op;
            });


            // POST /documents
            app.MapPost("/documents", async (FirestoreDb db, CreateDocumentDto dto) =>
            {
                var doc = new DocumentEntry
                {
                    Id = Guid.NewGuid().ToString("n"),
                    MaintenanceId = dto.MaintenanceId.Trim(),
                    Description = dto.Description.Trim(),
                    DocumentContent = dto.Document.Trim(),   // maps to Firestore field "Document"
                    CreatedUtc = DateTime.UtcNow
                };

                await db.Collection("Document").Document(doc.Id).SetAsync(doc);
                return Results.Created($"/documents/{doc.Id}", doc);
            })
            .WithName("CreateDocument")
            .WithTags("Documents")
            .Accepts<CreateDocumentDto>("application/json")
            .Produces<DocumentEntry>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a document entry";
                op.Description = "Creates a new document in the Document collection. The server populates CreatedUtc.";
                return op;
            });


            // PUT /documents/{id}
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
            })
            .WithName("UpdateDocument")
            .WithTags("Documents")
            .Accepts<UpdateDocumentDto>("application/json")
            .Produces<DocumentEntry>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Update a document entry";
                op.Description = "Updates description and/or the Document field for the specified document id.";
                return op;
            });


            // DELETE /documents/maintenance/{maintenanceId}
            app.MapDelete("/documents/maintenance/{maintenanceId}", async (FirestoreDb db, string maintenanceId) =>
            {
                var snaps = await db.Collection("Document")
                                    .WhereEqualTo("maintenanceID", maintenanceId)
                                    .GetSnapshotAsync();

                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            })
            .WithName("DeleteDocumentsByMaintenanceId")
            .WithTags("Documents")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete documents by maintenanceID";
                op.Description = "Deletes all documents in the Document collection that match the given maintenanceID.";
                return op;
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
            })
            .WithName("Register")
            .WithTags("Auth")
            .Accepts<AuthRegisterDto>("application/json")
            .Produces(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status500InternalServerError)
            .WithOpenApi(op =>
            {
                op.Summary = "Register a new user";
                op.Description = "Creates a new user document with hashed password. Returns 201 with user identifiers.";
                return op;
>>>>>>> Stashed changes
            });

            app.MapPost("/borrowings", async (FirestoreDb db, Borrowing borrowing) =>
            {
<<<<<<< Updated upstream
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

=======
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

                    var first = user.FirstName;
                    var last = user.LastName;

                    return Results.Ok(new { user.Id, user.Email, FirstName = first, LastName = last });
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Login failed");
                    return Results.Problem(title: "Login failed", detail: ex.Message, statusCode: 500);
                }
            })
            .WithName("Login")
            .WithTags("Auth")
            .Accepts<AuthLoginDto>("application/json")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status500InternalServerError)
            .WithOpenApi(op =>
            {
                op.Summary = "Log in";
                op.Description = "Verifies credentials against stored password hash and returns basic user info on success.";
                return op;
            });

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
=======

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
>>>>>>> Stashed changes
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
    // ---- Auth DTOs + Firestore model (with password hash) ----
    public record AuthRegisterDto(string Email, string Phone, string FirstName, string LastName, string Password);
    public record AuthLoginDto(string Email, string Password);
    
    // ---- Exchange DTOs ----
    public record CreateExchangeDto(string OwnerId, string BorrowerId, string ItemId);
    public record UpdateExchangeApprovalDto(bool Approved);

    // ---- Notification DTOs ----
    public record CreateNotificationDto(string SenderId, string ReceiverId, string Message, string Title, string Type, string? ListingId = null, string? SenderAvatar = null);

    // ---- Listings DTOs ----
    public record CreateListingDto(string ItemId, string UserId);

    // ---- Maintenance DTOs ----
    public record CreateMaintenanceDto(string ItemId, string MaintenanceId, string Description);
    public record UpdateMaintenanceDescriptionDto(string Description);

    // ---- DocumentEntry DTOs ----
    public record CreateDocumentDto(string MaintenanceId, string Description, string Document);
    public record UpdateDocumentDto(string? Description, string? Document);

}