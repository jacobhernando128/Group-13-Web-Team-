// ---------- Program.cs  ----------
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;

using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Google.Cloud.Storage.V1;

using FirebaseAdmin;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

using System.IdentityModel.Tokens.Jwt;

namespace HippoExchange
{
    public class Program
    {
        // ---- Small helpers available inside Main via local functions, but declared here for clarity ----
        private static string PublicUrl(string bucket, string objectName)
            => $"https://storage.googleapis.com/{bucket}/{Uri.EscapeDataString(objectName)}";

        private static string CanonicalKeyFor(params string[] ids) =>
            string.Join("|", ids.Where(s => !string.IsNullOrWhiteSpace(s))
                                .Select(s => s.Trim())
                                .OrderBy(s => s, StringComparer.Ordinal));

        private static string Preview(string body, int max = 120)
        {
            if (string.IsNullOrWhiteSpace(body)) return "";
            body = body.Trim();
            return body.Length <= max ? body : body.Substring(0, max) + "…";
        }

        private static string GenerateJwtToken(
            UserAuth user,
            string jwtKey,
            string jwtIssuer,
            string jwtAudience,
            int expiryMinutes)
        {
            var key = Encoding.UTF8.GetBytes(jwtKey);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id ?? string.Empty),
                new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                new Claim(ClaimTypes.GivenName, user.FirstName ?? string.Empty),
                new Claim(ClaimTypes.Surname, user.LastName ?? string.Empty),
                new Claim("phone", user.Phone ?? string.Empty),
            };

            var creds = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature);
            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
        // ---------- MAIN + PIPELINE + ENDPOINTS ----------
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Port for local/dev (HTTP). Add HTTPS binding if you have a cert.
            // To avoid 'address already in use' when another process uses port 5000,
            // only bind to 5000 when the environment variable USE_FIXED_PORT=true
            var useFixedPort = Environment.GetEnvironmentVariable("USE_FIXED_PORT") == "true";
            if (useFixedPort)
            {
                builder.WebHost.ConfigureKestrel(o =>
                {
                    o.ListenAnyIP(5000);
                    // o.ListenAnyIP(443, lo => lo.UseHttps("cert.pfx", "password"));
                });
            }
            else
            {
                // Optionally, you can configure other ports or settings here if needed
            }

            // ---- Config ----
            var projectId =
                Environment.GetEnvironmentVariable("GOOGLE_CLOUD_PROJECT")
                ?? builder.Configuration["GoogleCloud:ProjectId"]
                ?? throw new InvalidOperationException("ProjectId not configured.");

            var databaseId =
                Environment.GetEnvironmentVariable("FIRESTORE_DATABASE_ID")
                ?? builder.Configuration["GoogleCloud:DatabaseId"]
                ?? "(default)";

            var credPath =
                Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
                ?? builder.Configuration["GoogleCloud:CredentialPath"];

            if (string.IsNullOrWhiteSpace(credPath) || !System.IO.File.Exists(credPath))
            {
                throw new InvalidOperationException(
                    "Credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or GoogleCloud:CredentialPath " +
                    $"to a valid service-account JSON file. Current: '{credPath ?? "<empty>"}'");
            }

            var googleCred = GoogleCredential.FromFile(credPath);

            // ---- Services ----
            builder.Services.AddSingleton(_ => new FirestoreDbBuilder
            {
                ProjectId = projectId,
                DatabaseId = databaseId,
                Credential = googleCred
            }.Build());

            builder.Services.AddSingleton(_ => StorageClient.Create(googleCred));

            // JWT config
            var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key not configured.");
            var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "HippoExchange";
            var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "HippoExchangeUsers";
            var jwtExpiry = int.TryParse(builder.Configuration["Jwt:ExpiryMinutes"], out var m) ? m : 60;

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(o =>
                {
                    o.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwtIssuer,
                        ValidAudience = jwtAudience,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
                    };
                });

            builder.Services.AddAuthorization();

            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen(c =>
            {
                c.SwaggerDoc("v1", new OpenApiInfo
                {
                    Title = "HippoExchange API",
                    Version = "v1",
                    Description = "CRUD API backed by Firestore; JWT auth; GCS media uploads; Inbox"
                });
            });

            builder.Services.AddCors(o =>
            {
                // For production, restrict origins.
                o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
            });

            // Firebase Admin (optional)
            if (FirebaseApp.DefaultInstance is null)
            {
                FirebaseApp.Create(new FirebaseAdmin.AppOptions { Credential = googleCred });
            }

            var app = builder.Build();

            // Diagnostic lifecycle logs to help understand unexpected shutdowns
            try
            {
                var startupLogger = app.Services.GetService(typeof(ILogger<Program>)) as ILogger<Program>;
                startupLogger?.LogInformation("App built. Environment: {env}. Beginning to wire middleware and endpoints.", app.Environment.EnvironmentName);

                var lifetime = app.Lifetime;
                lifetime.ApplicationStarted.Register(() => startupLogger?.LogInformation("Application lifetime event: Started"));
                lifetime.ApplicationStopping.Register(() => startupLogger?.LogInformation("Application lifetime event: Stopping"));
                lifetime.ApplicationStopped.Register(() => startupLogger?.LogInformation("Application lifetime event: Stopped"));
            }
            catch { }

            // ---- Dev tooling ----
            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HippoExchange API v1"));
            }

            app.UseHttpsRedirection();
            app.UseCors();
            app.UseAuthentication();
            app.UseAuthorization();

            // Diagnostics: log every incoming request and final response status.
            app.Use(async (context, next) =>
            {
                var logger = context.RequestServices.GetService(typeof(ILogger<Program>)) as ILogger<Program>;
                try
                {
                    logger?.LogInformation("Incoming request: {method} {path}{query}", context.Request.Method, context.Request.Path, context.Request.QueryString);
                }
                catch { }
                await next();
                try
                {
                    logger?.LogInformation("Response {status} for {path}{query}", context.Response.StatusCode, context.Request.Path, context.Request.QueryString);
                }
                catch { }
            });

            // Compatibility: rewrite legacy "/messages/*" requests to "/inbox/*"
            // Some older frontend files still call /messages/... — rewrite so they continue to work.
            app.Use(async (context, next) =>
            {
                var path = context.Request.Path;
                if (path.HasValue && path.Value.StartsWith("/messages", StringComparison.OrdinalIgnoreCase))
                {
                    var newPath = "/inbox" + path.Value.Substring("/messages".Length);
                    context.Request.Path = newPath;
                    var logger = context.RequestServices.GetService(typeof(ILogger<Program>)) as ILogger<Program>;
                    logger?.LogInformation("Rewrote path {old} -> {new}", path.Value, newPath);
                }
                await next();
            });

            // ---- Serve static frontend ----
            var defaults = new DefaultFilesOptions();
            defaults.DefaultFileNames.Clear();
            defaults.DefaultFileNames.Add("Login.html");
            defaults.DefaultFileNames.Add("Home.html");
            defaults.DefaultFileNames.Add("index.html");
            app.UseDefaultFiles(defaults);
            app.UseStaticFiles();

            // ===================== API =====================

            // ---- Health ----
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

            // -------- Items --------
            app.MapPost("/items", async (FirestoreDb db, Item item) =>
            {
                item.Id = Guid.NewGuid().ToString("n");
                item.CreatedUtc = DateTime.UtcNow;
                await db.Collection("itemID").Document(item.Id).SetAsync(item);
                return Results.Created($"/items/{item.Id}", item);
            });

            app.MapGet("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var snap = await db.Collection("itemID").Document(id).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<Item>()) : Results.NotFound();
            });

            app.MapGet("/items", async (FirestoreDb db, string? ownerId) =>
            {
                Query q = db.Collection("itemID");
                if (!string.IsNullOrWhiteSpace(ownerId)) q = q.WhereEqualTo("userID", ownerId);
                var snaps = await q.Limit(50).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Item>()));
            });

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
            });

            app.MapDelete("/items/{id}", async (FirestoreDb db, string id) =>
            {
                var doc = db.Collection("itemID").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();
                await doc.DeleteAsync();
                return Results.NoContent();
            });

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
                    await storage.UploadObjectAsync(bucket, objectName, file.ContentType ?? "application/octet-stream", stream);
                    urls.Add(PublicUrl(bucket, objectName));
                }

                await itemDoc.UpdateAsync("Pictures", FieldValue.ArrayUnion(urls.Cast<object>().ToArray()));
                return Results.Ok(new { added = urls.Count, urls });
            });

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
                    await storage.UploadObjectAsync(bucket, objectName, file.ContentType ?? "application/octet-stream", stream);
                    urls.Add(PublicUrl(bucket, objectName));
                }

                await itemDoc.UpdateAsync("Videos", FieldValue.ArrayUnion(urls.Cast<object>().ToArray()));
                return Results.Ok(new { added = urls.Count, urls });
            });

            // -------- Users --------
            app.MapGet("/users/{userId}/items", async (FirestoreDb db, string userId) =>
            {
                var q = db.Collection("itemID").WhereEqualTo("userID", userId);
                var snaps = await q.GetSnapshotAsync();
                return snaps.Select(s => s.ConvertTo<Item>());
            });

            app.MapGet("/users/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snap = await db.Collection("users").Document(userId).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<UserAuth>()) : Results.NotFound();
            });

            app.MapPost("/users", async (FirestoreDb db, UserAuth user) =>
            {
                user.Id = Guid.NewGuid().ToString("n");
                user.CreatedUtc = DateTime.UtcNow;
                await db.Collection("users").Document(user.Id).SetAsync(user);
                return Results.Created($"/users/{user.Id}", user);
            });

            // -------- Exchanges --------
            app.MapGet("/exchanges/owner/{ownerId}", async (FirestoreDb db, string ownerId) =>
            {
                var snaps = await db.Collection("exchanges").WhereEqualTo("ownerID", ownerId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Exchange>()));
            });

            app.MapGet("/exchanges/borrower/{borrowerId}", async (FirestoreDb db, string borrowerId) =>
            {
                var snaps = await db.Collection("exchanges").WhereEqualTo("borrowerID", borrowerId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Exchange>()));
            });

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
            });

            app.MapPut("/exchanges/{id}/approval", async (FirestoreDb db, string id, UpdateExchangeApprovalDto dto) =>
            {
                var doc = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.UpdateAsync(new Dictionary<string, object> { ["approved"] = dto.Approved });
                var updated = await doc.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Exchange>());
            });

            app.MapDelete("/exchanges/{id}", async (FirestoreDb db, string id) =>
            {
                var doc = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.DeleteAsync();
                return Results.NoContent();
            });

            // -------- Notifications --------
            app.MapGet("/notifications/receiver/{receiverId}", async (FirestoreDb db, string receiverId) =>
            {
                var snaps = await db.Collection("notifications").WhereEqualTo("receiverID", receiverId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Notification>()));
            });

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
            });

            // -------- Listings --------
            app.MapGet("/listings/user/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snaps = await db.Collection("listings").WhereEqualTo("userID", userId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Listing>()));
            });

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
            });

            app.MapDelete("/listings/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("listings").WhereEqualTo("itemID", itemId).GetSnapshotAsync();
                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            });

            // -------- Maintenance --------
            app.MapGet("/maintenance/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("maintenance").WhereEqualTo("itemID", itemId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Maintenance>()));
            });

            app.MapPut("/maintenance/{maintenanceId}/description", async (FirestoreDb db, string maintenanceId, UpdateMaintenanceDescriptionDto dto) =>
            {
                var snaps = await db.Collection("maintenance").WhereEqualTo("maintenanceID", maintenanceId).Limit(1).GetSnapshotAsync();
                if (!snaps.Any()) return Results.NotFound();

                var docRef = snaps.First().Reference;
                await docRef.UpdateAsync(new Dictionary<string, object> { ["description"] = dto.Description.Trim() });

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Maintenance>());
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
            });

            app.MapDelete("/maintenance/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("maintenance").WhereEqualTo("itemID", itemId).GetSnapshotAsync();
                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            });

            // -------- Reviews --------
            app.MapGet("/reviews/user/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snaps = await db.Collection("reviews").WhereEqualTo("userID", userId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<Review>()));
            });

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
            });

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
            });

            app.MapDelete("/reviews/{id}", async (FirestoreDb db, string id) =>
            {
                var docRef = db.Collection("reviews").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await docRef.DeleteAsync();
                return Results.NoContent();
            });

            // ========== Inbox (threads + messages) ==========
            const string ThreadsCol = "messageThreads";
            const string MessagesSubcol = "messages";

            // List threads for a user (newest first)
            app.MapGet("/inbox/threads", async (FirestoreDb db, string userId) =>
            {
                if (string.IsNullOrWhiteSpace(userId)) return Results.BadRequest(new { error = "userId required" });

                // Firestore requires a composite index for queries that combine
                // array-contains with an orderBy on another field. To avoid
                // requiring an index in development, fetch the matching documents
                // and sort them in-memory by updatedUtc.
                var snaps = await db.Collection(ThreadsCol)
                    .WhereArrayContains("participants", userId)
                    .Limit(500) // limit to a reasonable number to avoid large reads
                    .GetSnapshotAsync();

                var threads = snaps.Select(s =>
                {
                    var t = s.ConvertTo<MessageThread>();
                    t.Id = s.Id;
                    return t;
                })
                .OrderByDescending(t => t.UpdatedUtc)
                .Take(100); // return top 100 after sorting

                return Results.Ok(threads);
            });

            // Create (or reuse) a thread by participant IDs
            app.MapPost("/inbox/threads", async (FirestoreDb db, CreateThreadDto dto) =>
            {
                var participants = dto.ParticipantIds?.Where(p => !string.IsNullOrWhiteSpace(p)).Distinct().ToList() ?? new();
                if (participants.Count < 2) return Results.BadRequest(new { error = "At least two participant IDs are required." });

                var canonical = CanonicalKeyFor(participants.ToArray());

                // Try to find an existing thread with same canonical key
                var q = await db.Collection(ThreadsCol)
                    .WhereEqualTo("canonicalKey", canonical)
                    .Limit(1)
                    .GetSnapshotAsync();

                DocumentReference threadRef;
                MessageThread thread;

                if (q.Any())
                {
                    var snap = q.First();
                    threadRef = snap.Reference;
                    thread = snap.ConvertTo<MessageThread>();
                    thread.Id = snap.Id;
                }
                else
                {
                    thread = new MessageThread
                    {
                        Participants = participants,
                        CanonicalKey = canonical,
                        Subject = string.IsNullOrWhiteSpace(dto.Subject) ? null : dto.Subject!.Trim(),
                        LastMessagePreview = null,
                        UpdatedUtc = DateTime.UtcNow
                    };
                    threadRef = await db.Collection(ThreadsCol).AddAsync(thread);
                    thread.Id = threadRef.Id;
                }

                return Results.Created($"/inbox/threads/{threadRef.Id}", thread);
            });

            // Get a thread (plus last N messages)
            app.MapGet("/inbox/threads/{threadId}", async (FirestoreDb db, string threadId, int take = 50) =>
            {
                var threadRef = db.Collection(ThreadsCol).Document(threadId);
                var snap = await threadRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var thread = snap.ConvertTo<MessageThread>();
                thread.Id = snap.Id;

                take = Math.Clamp(take, 1, 200);

                var msgSnaps = await threadRef.Collection(MessagesSubcol)
                    .OrderByDescending("sentUtc")
                    .Limit(take)
                    .GetSnapshotAsync();

                var messages = msgSnaps.Select(s =>
                {
                    var mdoc = s.ConvertTo<MessageDoc>();
                    mdoc.Id = s.Id;
                    return mdoc;
                })
                .OrderBy(m => m.SentUtc)
                .ToList();

                return Results.Ok(new { thread, messages });
            });

            // Send a message to a thread
            app.MapPost("/inbox/threads/{threadId}/messages", async (FirestoreDb db, string threadId, SendMessageDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.SenderId) || string.IsNullOrWhiteSpace(dto.Body))
                    return Results.BadRequest(new { error = "senderId and body are required." });

                var threadRef = db.Collection(ThreadsCol).Document(threadId);
                var threadSnap = await threadRef.GetSnapshotAsync();
                if (!threadSnap.Exists) return Results.NotFound();

                var msg = new MessageDoc
                {
                    SenderId = dto.SenderId.Trim(),
                    Body = dto.Body.Trim(),
                    SentUtc = DateTime.UtcNow
                };

                await threadRef.Collection(MessagesSubcol).AddAsync(msg);

                // Update thread summary
                var updates = new Dictionary<string, object>
                {
                    ["lastMessagePreview"] = Preview(msg.Body),
                    ["updatedUtc"] = msg.SentUtc,
                    [$"lastReadBy.{dto.SenderId.Trim()}"] = msg.SentUtc
                };

                await threadRef.UpdateAsync(updates);

                return Results.Accepted($"/inbox/threads/{threadId}");
            });

            // Mark a thread read for a user
            app.MapPost("/inbox/threads/{threadId}/read", async (FirestoreDb db, string threadId, MarkReadDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.UserId)) return Results.BadRequest(new { error = "userId required." });

                var threadRef = db.Collection(ThreadsCol).Document(threadId);
                var snap = await threadRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await threadRef.UpdateAsync(new Dictionary<string, object>
                {
                    [$"lastReadBy.{dto.UserId.Trim()}"] = DateTime.UtcNow
                });

                return Results.NoContent();
            });

            // Star / unstar a thread for a user
            app.MapPost("/inbox/threads/{threadId}/star", async (FirestoreDb db, string threadId, StarDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.UserId)) return Results.BadRequest(new { error = "userId required." });

                var threadRef = db.Collection(ThreadsCol).Document(threadId);
                var snap = await threadRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                if (dto.Starred)
                    await threadRef.UpdateAsync("starredBy", FieldValue.ArrayUnion(dto.UserId.Trim()));
                else
                    await threadRef.UpdateAsync("starredBy", FieldValue.ArrayRemove(dto.UserId.Trim()));

                return Results.NoContent();
            });

            // Convenience: get-or-create 1:1 thread between two users
            app.MapPost("/inbox/with", async (FirestoreDb db, string userA, string userB, string? subject) =>
            {
                if (string.IsNullOrWhiteSpace(userA) || string.IsNullOrWhiteSpace(userB))
                    return Results.BadRequest(new { error = "userA and userB required." });

                var participants = new List<string> { userA.Trim(), userB.Trim() };
                var canonical = CanonicalKeyFor(participants.ToArray());

                var q = await db.Collection(ThreadsCol)
                    .WhereEqualTo("canonicalKey", canonical)
                    .Limit(1)
                    .GetSnapshotAsync();

                if (q.Any())
                {
                    var snap = q.First();
                    var existing = snap.ConvertTo<MessageThread>();
                    existing.Id = snap.Id;
                    return Results.Ok(existing);
                }

                var thread = new MessageThread
                {
                    Participants = participants,
                    CanonicalKey = canonical,
                    Subject = string.IsNullOrWhiteSpace(subject) ? null : subject!.Trim(),
                    UpdatedUtc = DateTime.UtcNow
                };
                var added = await db.Collection(ThreadsCol).AddAsync(thread);
                thread.Id = added.Id;

                return Results.Created($"/inbox/threads/{thread.Id}", thread);
            });

            // -------- Documents --------
            app.MapGet("/documents/maintenance/{maintenanceId}", async (FirestoreDb db, string maintenanceId) =>
            {
                var snaps = await db.Collection("Document").WhereEqualTo("maintenanceID", maintenanceId).GetSnapshotAsync();
                return Results.Ok(snaps.Select(s => s.ConvertTo<DocumentEntry>()));
            });

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
            });

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
            });

            app.MapDelete("/documents/maintenance/{maintenanceId}", async (FirestoreDb db, string maintenanceId) =>
            {
                var snaps = await db.Collection("Document").WhereEqualTo("maintenanceID", maintenanceId).GetSnapshotAsync();
                if (!snaps.Any()) return Results.NotFound();

                var batch = db.StartBatch();
                foreach (var s in snaps) batch.Delete(s.Reference);
                await batch.CommitAsync();

                return Results.Ok(new { deleted = snaps.Count });
            });

            // -------- Auth (BCrypt + JWT) --------
            app.MapPost("/auth/register", async (FirestoreDb db, AuthRegisterDto dto) =>
            {
                var email = (dto.Email ?? "").Trim().ToLowerInvariant();
                if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(dto.Password))
                    return Results.BadRequest(new { message = "Email and password are required." });

                var exists = await db.Collection("users")
                                     .WhereEqualTo(nameof(UserAuth.Email), email)
                                     .Limit(1).GetSnapshotAsync();
                if (exists.Any()) return Results.Conflict(new { message = "Email already registered." });

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
                await db.Collection("users").Document(user.Id!).SetAsync(user);

                var token = GenerateJwtToken(user, jwtKey, jwtIssuer, jwtAudience, jwtExpiry);

                return Results.Created($"/users/{user.Id}", new
                {
                    user.Id,
                    user.Email,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Token = token
                });
            });

            app.MapPost("/auth/login", async (FirestoreDb db, AuthLoginDto dto) =>
            {
                var email = (dto.Email ?? "").Trim().ToLowerInvariant();

                var snaps = await db.Collection("users")
                                    .WhereEqualTo(nameof(UserAuth.Email), email)
                                    .Limit(1).GetSnapshotAsync();
                if (!snaps.Any()) return Results.Unauthorized();

                var user = snaps.First().ConvertTo<UserAuth>();
                if (string.IsNullOrEmpty(user.PasswordHash) ||
                    !BCrypt.Net.BCrypt.Verify(dto.Password ?? "", user.PasswordHash))
                    return Results.Unauthorized();

                var token = GenerateJwtToken(user, jwtKey, jwtIssuer, jwtAudience, jwtExpiry);

                return Results.Ok(new
                {
                    user.Id,
                    user.Email,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Token = token
                });
            });

            app.MapGet("/auth/me", (ClaimsPrincipal user) =>
            {
                if (user?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
                return Results.Ok(new
                {
                    Id = user.FindFirst(ClaimTypes.NameIdentifier)?.Value,
                    Email = user.FindFirst(ClaimTypes.Email)?.Value,
                    FirstName = user.FindFirst(ClaimTypes.GivenName)?.Value,
                    LastName = user.FindFirst(ClaimTypes.Surname)?.Value,
                    Phone = user.FindFirst("phone")?.Value
                });
            }).RequireAuthorization();

            try
            {
                app.Run();
            }
            catch (Exception ex)
            {
                var logger = app.Services.GetService(typeof(ILogger<Program>)) as ILogger<Program>;
                logger?.LogError(ex, "Host terminated unexpectedly");
                throw;
            }
        }
        // ---------- Program.cs (Part 3: MODELS & DTOs) ----------

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

        // ---------------- Messaging (Inbox) models ----------------
        [FirestoreData]
        public class MessageThread
        {
            [FirestoreDocumentId] public string? Id { get; set; }

            [FirestoreProperty("participants")] public List<string> Participants { get; set; } = new();
            [FirestoreProperty("canonicalKey")] public string CanonicalKey { get; set; } = default!;
            [FirestoreProperty("subject")] public string? Subject { get; set; }
            [FirestoreProperty("lastMessagePreview")] public string? LastMessagePreview { get; set; }
            [FirestoreProperty("updatedUtc")] public DateTime UpdatedUtc { get; set; }

            // per-user read timestamp
            [FirestoreProperty("lastReadBy")] public Dictionary<string, DateTime> LastReadBy { get; set; } = new();
            // starring
            [FirestoreProperty("starredBy")] public List<string> StarredBy { get; set; } = new();
        }

        [FirestoreData]
        public class MessageDoc
        {
            [FirestoreDocumentId] public string? Id { get; set; }
            [FirestoreProperty("senderId")] public string SenderId { get; set; } = default!;
            [FirestoreProperty("body")] public string Body { get; set; } = default!;
            [FirestoreProperty("sentUtc")] public DateTime SentUtc { get; set; }
        }

        // ---------------- Users / Auth ----------------
        [FirestoreData]
        public class UserAuth
        {
            [FirestoreDocumentId] public string? Id { get; set; }
            [FirestoreProperty("Email")] public string Email { get; set; } = default!;
            [FirestoreProperty("Phone")] public string Phone { get; set; } = default!;
            [FirestoreProperty("FirstName")] public string FirstName { get; set; } = default!;
            [FirestoreProperty("LastName")] public string LastName { get; set; } = default!;
            [FirestoreProperty("PasswordHash")] public string? PasswordHash { get; set; }
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

        public record CreateReviewDto(int Rating, string RaterId, string UserId, string Description);
        public record UpdateReviewDto(int Rating, string Description);

        // Inbox DTOs
        public record CreateThreadDto(List<string> ParticipantIds, string? Subject);
        public record SendMessageDto(string SenderId, string Body);
        public record MarkReadDto(string UserId);
        public record StarDto(string UserId, bool Starred);
    }
}
