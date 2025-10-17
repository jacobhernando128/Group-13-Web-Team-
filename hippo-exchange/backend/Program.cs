using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Google.Cloud.Storage.V1;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using Microsoft.OpenApi.Any;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using System.Text;
using FirebaseAdmin;
using BCrypt.Net;

namespace HippoExchange
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            builder.WebHost.ConfigureKestrel(options =>
            {
                options.ListenAnyIP(5000); 
                                         
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
            builder.Services.AddSingleton(StorageClient.Create(googleCred));

            // JWT Token Generation
            static string GenerateJwtToken(UserAuth user, string jwtKey, string jwtIssuer, string jwtAudience, int expiryMinutes)
            {
                if (user == null) throw new ArgumentNullException(nameof(user));
                
                var tokenHandler = new JwtSecurityTokenHandler();
                var key = Encoding.UTF8.GetBytes(jwtKey);
                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Subject = new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, user.Id ?? string.Empty),
                        new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                        new Claim(ClaimTypes.GivenName, user.FirstName ?? string.Empty),
                        new Claim(ClaimTypes.Surname, user.LastName ?? string.Empty),
                        new Claim("phone", user.Phone ?? string.Empty)
                    }),
                    Expires = DateTime.UtcNow.AddMinutes(expiryMinutes),
                    Issuer = jwtIssuer,
                    Audience = jwtAudience,
                    SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
                };
                var token = tokenHandler.CreateToken(tokenDescriptor);
                return tokenHandler.WriteToken(token);
            }

            // -------- Services --------
            builder.Services.AddSingleton(_ => new FirestoreDbBuilder
            {
                ProjectId = projectId,
                DatabaseId = databaseId,
                Credential = googleCred
            }.Build());
            
            // You can pass credentials to StorageClient:
            builder.Services.AddSingleton(_ => StorageClient.Create(googleCred));

            // Add background services
            builder.Services.AddHostedService<ReturnDateNotificationService>();
            builder.Services.AddHostedService<MaintenanceNotificationService>();

            // JWT Authentication
            var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured.");
            var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "HippoExchange";
            var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "HippoExchangeUsers";

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
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
                    Description = "Simple CRUD + Auth API backed by Firestore"
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

            // -------- Dev tooling --------


            if (app.Environment.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
                app.UseSwagger();
                app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "HippoExchange API v1"));
            }

            // app.UseHttpsRedirection();

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

            // Authentication and Authorization middleware (must come before static files for API routes)
            app.UseAuthentication();
            app.UseAuthorization();
            
            app.UseStaticFiles();
            app.UseCors();

            // ---------- Helper functions ----------

            static bool IsImage(IFormFile f) =>     // basic image check (MIME or extension)
            f.ContentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true
            || new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff" }
                .Contains(Path.GetExtension(f.FileName).ToLowerInvariant());


            static bool IsVideo(IFormFile f) =>     // basic video check (MIME or extension)
                f.ContentType?.StartsWith("video/", StringComparison.OrdinalIgnoreCase) == true
                || new[] { ".mp4", ".mov", ".avi", ".mkv", ".webm" }
                    .Contains(Path.GetExtension(f.FileName).ToLowerInvariant());

            static bool IsPhotoUrl(string url)      // checks to see if pulled URL from bucket is an image
            {
                var exts = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff" };
                return !string.IsNullOrWhiteSpace(url) &&
                    exts.Any(e => url.EndsWith(e, StringComparison.OrdinalIgnoreCase));
            }


            static string CanonicalKeyFor(params string[] ids)      // deterministic key from ids (trim, sort, join)
            => string.Join("|", ids.Where(s => !string.IsNullOrWhiteSpace(s))
                                .Select(s => s.Trim())
                                .OrderBy(s => s, StringComparer.Ordinal));


            static string Preview(string body, int max = 120)       // short text preview with ellipsis
            {
                if (string.IsNullOrWhiteSpace(body)) return "";
                body = body.Trim();
                return body.Length <= max ? body : body.Substring(0, max) + "…";
            }


            // ---------- Picture/Video Functions ----------

            app.MapPost("/media/uploadAndAttach",
            async (HttpRequest request,
                    [FromServices] FirestoreDb db,
                    [FromServices] StorageClient storage) =>
            {
                if (!request.HasFormContentType)
                    return Results.BadRequest(new { error = "Must be multipart/form-data" });

                var form = await request.ReadFormAsync();
                var file = form.Files.GetFile("file");
                var userId = form["userId"].ToString();
                var itemId = form["itemId"].ToString();
                var target = form["target"].ToString();

                if (file is null || file.Length == 0)
                    return Results.BadRequest(new { error = "No file uploaded." });

                var isImg = IsImage(file);
                var isVid = IsVideo(file);
                if (!isImg && !isVid)
                    return Results.BadRequest(new { error = "Only image/* or video/* files are allowed." });

                var targetField = !string.IsNullOrWhiteSpace(target)
                    ? (target.Trim().Equals("video", StringComparison.OrdinalIgnoreCase) ? "Videos" : "Pictures")
                    : (isVid ? "Videos" : "Pictures");

                const string bucket = "hippo-exchange-media";
                var ext = Path.GetExtension(file.FileName);
                if (string.IsNullOrWhiteSpace(ext)) ext = isImg ? ".jpg" : ".mp4";

                var objectName = $"users/{userId}/items/{itemId}/original/{Guid.NewGuid()}{ext}";
                var contentType = string.IsNullOrWhiteSpace(file.ContentType)
                    ? (isImg ? "image/jpeg" : "video/mp4")
                    : file.ContentType;

                await using (var stream = file.OpenReadStream())
                    await storage.UploadObjectAsync(bucket, objectName, contentType, stream);

                var publicUrl = $"https://storage.googleapis.com/{bucket}/{objectName}";

                var doc = db.Collection("itemID").Document(itemId);
                var snap = await doc.GetSnapshotAsync();

                if (snap.Exists)
                    await doc.UpdateAsync(new Dictionary<string, object>
                    {
                        [targetField] = FieldValue.ArrayUnion(publicUrl)
                    });
                else
                    await doc.SetAsync(new Dictionary<string, object>
                    {
                        [targetField] = new[] { publicUrl }
                    }, SetOptions.MergeAll);

                return Results.Ok(new { addedTo = targetField, url = publicUrl, itemId });
            })
            .WithName("AddItemPhotoOrVideo")
            .WithTags("Items", "Media")
            .DisableAntiforgery()
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Upload photo or video for an item";
                op.Description = "Accepts multipart/form-data files, uploads to GCS, and appends public URLs to the item's Pictures/Videos array.";

                op.RequestBody = new Microsoft.OpenApi.Models.OpenApiRequestBody
                {
                    Required = true,
                    Content = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>
                    {
                        ["multipart/form-data"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                        {
                            Schema = new Microsoft.OpenApi.Models.OpenApiSchema
                            {
                                Type = "object",
                                Properties = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiSchema>
                                {
                                    ["file"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string",
                                        Format = "binary"
                                    },
                                    ["userId"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string"
                                    },
                                    ["itemId"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string"
                                    },
                                    ["target"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string",
                                        Nullable = true,
                                        Description = "Optional: 'video' or 'picture'"
                                    }
                                },
                                Required = new HashSet<string> { "file", "userId", "itemId" }
                            }
                        }
                    }
                };

                return op;
            });


            app.MapGet("/items/{itemId}/media", async (string itemId, FirestoreDb db) =>
            {
                var snap = await db.Collection("itemID").Document(itemId).GetSnapshotAsync(); // <-- collection fixed
                if (!snap.Exists)
                    return Results.Ok(new { Pictures = Array.Empty<string>(), Videos = Array.Empty<string>() });

                var data = snap.ToDictionary();

                string[] GetArray(string field) =>
                    data.TryGetValue(field, out var raw) && raw is IEnumerable<object> arr
                        ? arr.Select(x => x?.ToString()).Where(s => !string.IsNullOrWhiteSpace(s)).Cast<string>().ToArray()
                        : Array.Empty<string>();

                var pictures = GetArray("Pictures");
                var videos = GetArray("Videos");

                return Results.Ok(new { Pictures = pictures, Videos = videos, counts = new { pictures = pictures.Length, videos = videos.Length } });
            }).DisableAntiforgery();


            app.MapDelete("/items/{itemId}/media", async (string itemId,
                                                        [FromQuery] string url,
                                                        [FromQuery] string? target,
                                                        FirestoreDb db) =>
            {
                if (string.IsNullOrWhiteSpace(url))
                    return Results.BadRequest(new { error = "url is required." });

                // Normalize to the stored field names
                var t = (target ?? "").Trim().ToLowerInvariant();
                var field = t switch
                {
                    "video" or "videos" => "Videos",
                    "photo" or "photos" => "Pictures", // legacy synonyms
                    "picture" or "pictures" => "Pictures",
                    _ => null
                };

                var doc = db.Collection("itemID").Document(itemId);

                if (field is not null)
                {
                    await doc.UpdateAsync(field, FieldValue.ArrayRemove(url));
                    return Results.Ok(new { removedFrom = field, url });
                }

                // If no target provided, try both
                await doc.UpdateAsync(new Dictionary<string, object>
                {
                    ["Pictures"] = FieldValue.ArrayRemove(url),
                    ["Videos"] = FieldValue.ArrayRemove(url)
                });
                return Results.Ok(new { removedFrom = "Pictures|Videos", url });
            });


            // ---------- API Testing ----------

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


            app.MapGet("/debug/adc", () =>
            {
                var p = Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS")
                        ?? builder.Configuration["GoogleCloud:CredentialPath"];
                return Results.Ok(new
                {
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


            app.MapGet("/items", async (FirestoreDb db, string? ownerId, int limit = 100, int offset = 0) =>
            {
                Query q = db.Collection("itemID");
                if (!string.IsNullOrWhiteSpace(ownerId))
                    q = q.WhereEqualTo("userID", ownerId);

                // Apply pagination
                q = q.Limit(limit).Offset(offset);

                var snaps = await q.GetSnapshotAsync();
                var items = snaps.Documents.Select(s => s.ConvertTo<Item>()).ToList();

                // Get total count for pagination info
                Query countQuery = db.Collection("itemID");
                if (!string.IsNullOrWhiteSpace(ownerId))
                    countQuery = countQuery.WhereEqualTo("userID", ownerId);
                var countSnaps = await countQuery.GetSnapshotAsync();
                var totalCount = countSnaps.Count;

                return Results.Ok(new
                {
                    items = items,
                    totalCount = totalCount,
                    limit = limit,
                    offset = offset,
                    hasMore = offset + items.Count < totalCount
                });
            })
            .WithName("ListItems")
            .WithTags("Items")
            .Produces(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List items";
                op.Description = "Lists items with optional ownerId filter and pagination (limit/offset), including totalCount and hasMore.";
                return op;
            });



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


            app.MapPut("/items/{id}", async (FirestoreDb db, string id, Item update) =>
            {
                var doc = db.Collection("itemID").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var current = snap.ConvertTo<Item>();

                current.Title = update.Title ?? current.Title;
                current.Description = update.Description ?? current.Description;
                current.Condition = update.Condition ?? current.Condition;
                current.Location = update.Location ?? current.Location;
                current.DollarCost = update.DollarCost ?? current.DollarCost;
                current.RepCost = update.RepCost ?? current.RepCost;

                if (update.Categories?.Count > 0) current.Categories = update.Categories;
                if (update.Pictures?.Count > 0) current.Pictures = update.Pictures;
                if (update.Videos?.Count > 0) current.Videos = update.Videos;

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
                op.Description = "Updates an item document by id. Supports partial updates for Title, Description, Condition, Location, DollarCost, RepCost, Categories, Pictures, and Videos. UserId cannot be changed via this endpoint.";
                return op;
            });


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


            // -------- Users --------

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


            app.MapGet("/users/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snap = await db.Collection("users").Document(userId).GetSnapshotAsync();
                return snap.Exists ? Results.Ok(snap.ConvertTo<UserAuth>()) : Results.NotFound();
            })
            .WithName("GetUserProfileById")
            .WithTags("Users")
            .Produces<UserAuth>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Get a user profile by id";
                op.Description = "Reads the users document and returns it as UserAuth.";
                return op;
            });


            app.MapGet("/users/{senderId}/profile-picture", async (FirestoreDb db, string senderId) =>
            {
                var snap = await db.Collection("users").Document(senderId).GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { error = "User not found." });

                var user = snap.ConvertTo<UserAuth>();
                return Results.Ok(new { userId = senderId, profilePicture = user.ProfilePicture ?? "" });
            })
            .WithName("GetUserProfilePicture")
            .WithTags("Users")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Get user's profile picture URL";
                op.Description = "Returns the profile picture URL for the specified user (senderID).";
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


            app.MapPost("/users/{userId}/profile-picture",
            async (HttpRequest request,
                string userId,
                [FromServices] FirestoreDb db,
                [FromServices] StorageClient storage) =>
            {
                if (!request.HasFormContentType)
                    return Results.BadRequest(new { error = "Must be multipart/form-data" });

                var form = await request.ReadFormAsync();
                var file = form.Files.GetFile("file");

                if (file is null || file.Length == 0)
                    return Results.BadRequest(new { error = "No file uploaded." });

                var isImg = IsImage(file);
                if (!isImg)
                    return Results.BadRequest(new { error = "Only image files are allowed for profile pictures." });

                var userDoc = db.Collection("users").Document(userId);
                var snap = await userDoc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { error = "User not found." });

                const string bucket = "hippo-exchange-media";
                var ext = Path.GetExtension(file.FileName);
                if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

                var objectName = $"users/{userId}/profile/{Guid.NewGuid()}{ext}";
                var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "image/jpeg" : file.ContentType;

                await using (var stream = file.OpenReadStream())
                    await storage.UploadObjectAsync(bucket, objectName, contentType, stream);

                var publicUrl = $"https://storage.googleapis.com/{bucket}/{objectName}";

                await userDoc.UpdateAsync("ProfilePicture", publicUrl);

                return Results.Ok(new { userId, profilePicture = publicUrl });
            })
            .WithName("UploadProfilePicture")
            .WithTags("Users")
            .DisableAntiforgery()
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Upload user profile picture";
                op.Description = "Uploads a profile picture to GCS and stores the URL in the user's ProfilePicture field.";

                op.RequestBody = new Microsoft.OpenApi.Models.OpenApiRequestBody
                {
                    Required = true,
                    Content = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>
                    {
                        ["multipart/form-data"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                        {
                            Schema = new Microsoft.OpenApi.Models.OpenApiSchema
                            {
                                Type = "object",
                                Properties = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiSchema>
                                {
                                    ["file"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string",
                                        Format = "binary"
                                    }
                                },
                                Required = new HashSet<string> { "file" }
                            }
                        }
                    }
                };

                return op;
            });


            app.MapPut("/users/{userId}",
                [RequestSizeLimit(50_000_000)]
            async (
                    string userId,
                    [FromForm] UpdateUserForm form,
                    [FromServices] FirestoreDb db,
                    [FromServices] StorageClient storage
                ) =>
            {
                // locate user
                var userDoc = db.Collection("users").Document((userId ?? "").Trim());
                var snap = await userDoc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { error = "User not found." });

                var updates = new Dictionary<string, object>();

                if (form.FirstName is not null)
                {
                    var v = form.FirstName.Trim();
                    if (v.Length == 0) return Results.BadRequest(new { error = "FirstName cannot be empty when provided." });
                    updates["FirstName"] = v;
                }
                if (form.LastName is not null)
                {
                    var v = form.LastName.Trim();
                    if (v.Length == 0) return Results.BadRequest(new { error = "LastName cannot be empty when provided." });
                    updates["LastName"] = v;
                }
                if (form.PhoneNumber is not null)
                {
                    var v = form.PhoneNumber.Trim();
                    if (v.Length == 0) return Results.BadRequest(new { error = "PhoneNumber cannot be empty when provided." });
                    updates["PhoneNumber"] = v;
                }
                if (form.Description is not null)
                {
                    var v = form.Description.Trim();
                    if (v.Length == 0) return Results.BadRequest(new { error = "Description cannot be empty when provided." });
                    updates["Description"] = v;
                }

                if (form.File is not null)
                {
                    var file = form.File;
                    if (file.Length == 0) return Results.BadRequest(new { error = "Uploaded file is empty." });

                    // uses your existing IsImage(IFormFile) helper
                    if (!IsImage(file))
                        return Results.BadRequest(new { error = "Only image files are allowed for profile pictures." });

                    const string bucket = "hippo-exchange-media";
                    var ext = Path.GetExtension(file.FileName);
                    if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

                    var objectName = $"users/{userId}/profile/{Guid.NewGuid()}{ext}";
                    var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "image/jpeg" : file.ContentType;

                    await using var stream = file.OpenReadStream();
                    await storage.UploadObjectAsync(bucket, objectName, contentType, stream);

                    var publicUrl = $"https://storage.googleapis.com/{bucket}/{objectName}";
                    updates["ProfilePicture"] = publicUrl;
                }

                if (updates.Count == 0)
                    return Results.BadRequest(new { error = "Provide at least one field to update (file, FirstName, LastName, PhoneNumber, Description)." });

                await userDoc.UpdateAsync(updates);

                var updated = await userDoc.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<UserAuth>());
            })
            .WithName("UpdateUser")
            .WithTags("Users")
            .DisableAntiforgery()
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Partially update a user (profile & picture)";
                op.Description = "Updates any provided user fields and optionally replaces the profile picture. Accepts multipart/form-data.";
                op.RequestBody = new Microsoft.OpenApi.Models.OpenApiRequestBody
                {
                    Required = true,
                    Content = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>
                    {
                        ["multipart/form-data"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                        {
                            Schema = new Microsoft.OpenApi.Models.OpenApiSchema
                            {
                                Type = "object",
                                Properties = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiSchema>
                                {
                                    ["file"] = new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string", Format = "binary" },
                                    ["FirstName"] = new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string" },
                                    ["LastName"] = new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string" },
                                    ["PhoneNumber"] = new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string" },
                                    ["Description"] = new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string" }
                                }
                                // none are required → partial updates allowed
                            }
                        }
                    }
                };
                return op;
            });


            app.MapDelete("/users/{userId}", async (FirestoreDb db, string userId) =>
            {
                var userDoc = db.Collection("users").Document(userId);
                var userSnap = await userDoc.GetSnapshotAsync();
                if (!userSnap.Exists) return Results.NotFound(new { error = "User not found." });

                var nowUtc = DateTime.UtcNow;

                // Check for active exchanges as owner
                var ownerExchanges = await db.Collection("exchanges")
                    .WhereEqualTo("ownerID", userId)
                    .GetSnapshotAsync();

                var activeAsOwner = ownerExchanges.Any(ex =>
                {
                    var exchange = ex.ConvertTo<Exchange>();
                    return exchange.Approved == true
                        && exchange.StartDate.HasValue
                        && exchange.EndDate.HasValue
                        && exchange.StartDate.Value <= nowUtc
                        && exchange.EndDate.Value >= nowUtc;
                });

                if (activeAsOwner)
                    return Results.BadRequest(new { error = "Cannot delete user with active exchanges as owner." });

                // Check for active exchanges as borrower
                var borrowerExchanges = await db.Collection("exchanges")
                    .WhereEqualTo("borrowerID", userId)
                    .GetSnapshotAsync();

                var activeAsBorrower = borrowerExchanges.Any(ex =>
                {
                    var exchange = ex.ConvertTo<Exchange>();
                    return exchange.Approved == true
                        && exchange.StartDate.HasValue
                        && exchange.EndDate.HasValue
                        && exchange.StartDate.Value <= nowUtc
                        && exchange.EndDate.Value >= nowUtc;
                });

                if (activeAsBorrower)
                    return Results.BadRequest(new { error = "Cannot delete user with active exchanges as borrower." });

                // Safe to delete
                await userDoc.DeleteAsync();

                // Also delete auth record
                var user = userSnap.ConvertTo<UserAuth>();
                var authDoc = db.Collection("auth").Document(user.Email.ToLowerInvariant());
                await authDoc.DeleteAsync();

                return Results.NoContent();
            })
            .WithName("DeleteUser")
            .WithTags("Users")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete a user account";
                op.Description = "Deletes a user if they have no active exchanges (between start and end dates). Also removes auth record.";
                return op;
            });    


            // -------- Exchanges --------

            // GET /exchanges/owner/{ownerId}  — all exchanges for an owner
            app.MapGet("/exchanges/owner/{ownerId}", async (FirestoreDb db, string ownerId) =>
            {
                var snaps = await db.Collection("exchanges")
                                    .WhereEqualTo("ownerID", ownerId)
                                    .GetSnapshotAsync();
                
                var exchanges = new List<Exchange>();
                foreach (var snap in snaps)
                {
                    var exchange = snap.ConvertTo<Exchange>();
                    
                    // Fetch item details to get the title
                    if (!string.IsNullOrEmpty(exchange.ItemId))
                    {
                        try
                        {
                            var itemSnap = await db.Collection("items").Document(exchange.ItemId).GetSnapshotAsync();
                            if (itemSnap.Exists)
                            {
                                var item = itemSnap.ConvertTo<Item>();
                                exchange.Title = item.Title;
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error fetching item {exchange.ItemId}: {ex.Message}");
                        }
                    }
                    
                    // Fetch borrower details to get the name
                    if (!string.IsNullOrEmpty(exchange.BorrowerId))
                    {
                        try
                        {
                            var borrowerSnap = await db.Collection("users").Document(exchange.BorrowerId).GetSnapshotAsync();
                            if (borrowerSnap.Exists)
                            {
                                var borrower = borrowerSnap.ConvertTo<UserAuth>();
                                exchange.BorrowerName = $"{borrower.FirstName} {borrower.LastName}";
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error fetching borrower {exchange.BorrowerId}: {ex.Message}");
                        }
                    }
                    
                    exchanges.Add(exchange);
                }
                
                return Results.Ok(exchanges);
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
                
                var exchanges = new List<Exchange>();
                foreach (var snap in snaps)
                {
                    var exchange = snap.ConvertTo<Exchange>();
                    
                    // Fetch item details to get the title
                    if (!string.IsNullOrEmpty(exchange.ItemId))
                    {
                        try
                        {
                            var itemSnap = await db.Collection("items").Document(exchange.ItemId).GetSnapshotAsync();
                            if (itemSnap.Exists)
                            {
                                var item = itemSnap.ConvertTo<Item>();
                                exchange.Title = item.Title;
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error fetching item {exchange.ItemId}: {ex.Message}");
                        }
                    }
                    
                    // Fetch owner details to get the name
                    if (!string.IsNullOrEmpty(exchange.OwnerId))
                    {
                        try
                        {
                            var ownerSnap = await db.Collection("users").Document(exchange.OwnerId).GetSnapshotAsync();
                            if (ownerSnap.Exists)
                            {
                                var owner = ownerSnap.ConvertTo<UserAuth>();
                                exchange.OwnerName = $"{owner.FirstName} {owner.LastName}";
                            }
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error fetching owner {exchange.OwnerId}: {ex.Message}");
                        }
                    }
                    
                    exchanges.Add(exchange);
                }
                
                return Results.Ok(exchanges);
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
                    Approved = null,                    // defaults false per your model
                    RequestCreated = DateTime.UtcNow,    // auto timestamp (UTC)
                    StartDate = dto.StartDate.HasValue ? DateTime.SpecifyKind(dto.StartDate.Value, DateTimeKind.Utc) : null,
                    EndDate = dto.EndDate.HasValue ? DateTime.SpecifyKind(dto.EndDate.Value, DateTimeKind.Utc) : null,
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


            // GET /items/{itemId}/scheduled-periods — get approved exchange periods for an item
            app.MapGet("/items/{itemId}/scheduled-periods", async ([FromServices] FirestoreDb db, string itemId) =>
            {
                var exchanges = await db.Collection("exchanges")
                    .WhereEqualTo("itemID", itemId)
                    .WhereEqualTo("approved", true)
                    .GetSnapshotAsync();

                var scheduledPeriods = exchanges.Documents
                    .Select(doc => doc.ConvertTo<Exchange>())
                    .Where(ex => ex.StartDate.HasValue && ex.EndDate.HasValue)
                    .Select(ex => new { 
                        startDate  = ex.StartDate.GetValueOrDefault(),  // ✅ removes CS8629
                        endDate    = ex.EndDate.GetValueOrDefault(),    // ✅ removes CS8629
                        borrowerId = ex.BorrowerId
                    })
                    .OrderBy(p => p.startDate)
                    .ToList();

                return Results.Ok(scheduledPeriods);
            });



            // PUT /exchanges/{id}/approval — approve/decline with server-side invariants
            app.MapPut("/exchanges/{id}/approval", async (
                [FromServices] FirestoreDb db,
                string id,
                [FromBody] UpdateExchangeApprovalDto dto) =>
            {
                try
            {
                    var doc  = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { error = "Exchange not found." });

                    // Convert once so we can safely use properties below
                    var exchange = snap.ConvertTo<Exchange>();
                    if (exchange is null)
                        return Results.BadRequest(new { error = "Invalid exchange payload." });

                    // Require explicit decision
                    if (dto.Approved is null)
                        return Results.BadRequest(new { error = "approved is required (true or false)." });

                    var nowUtc   = DateTime.UtcNow;
                    var approved = dto.Approved.Value;

                var updates = new Dictionary<string, object>
                {
                        ["approved"]       = approved,
                    ["requestHandled"] = nowUtc
                };

                    if (approved)
                {
                        // Validate and set dates on approval
                    if (dto.StartDate is null || dto.EndDate is null)
                        return Results.BadRequest(new { error = "startDate and endDate are required when approving." });

                    var startUtc = DateTime.SpecifyKind(dto.StartDate.Value, DateTimeKind.Utc);
                        var endUtc   = DateTime.SpecifyKind(dto.EndDate.Value,   DateTimeKind.Utc);

                    if (endUtc <= startUtc)
                        return Results.BadRequest(new { error = "endDate must be after startDate." });

                        // Check scheduling conflicts for this item (simple in-memory filter)
                    var allExchanges = await db.Collection("exchanges")
                        .WhereEqualTo("itemID", exchange.ItemId)
                        .GetSnapshotAsync();
                        
                        var conflict = allExchanges.Documents
                            .Select(d => d.ConvertTo<Exchange>())
                            .Where(ex => (ex.Approved ?? false) && ex.Id != id)
                            .FirstOrDefault(ex =>
                                ex.StartDate.HasValue && ex.EndDate.HasValue &&
                                startUtc < ex.EndDate.Value && endUtc > ex.StartDate.Value);

                        if (conflict != null)
                        {
                            return Results.BadRequest(new
                            {
                                error = $"This item is already scheduled for the period " +
                                        $"{conflict.StartDate!.Value:yyyy-MM-dd} to {conflict.EndDate!.Value:yyyy-MM-dd}. " +
                                        "Please choose a different time period."
                            });
                    }

                    updates["startDate"] = startUtc;
                        updates["endDate"]   = endUtc;

                        // Update user counters on approval
                    await UpdateUserCounters(db, exchange.OwnerId, exchange.BorrowerId, true);
                }
                else
                {
                        // Declined: clear dates
                    updates["startDate"] = FieldValue.Delete;
                        updates["endDate"]   = FieldValue.Delete;
                }

                await doc.UpdateAsync(updates);

                // Send a message to the borrower about the approval decision
                try
                {
                    Console.WriteLine($"[DEBUG] Starting message creation for approval decision");
                    Console.WriteLine($"[DEBUG] Exchange details - BorrowerId: {exchange.BorrowerId}, OwnerId: {exchange.OwnerId}, ItemId: {exchange.ItemId}");
                    Console.WriteLine($"[DEBUG] Decision: {(dto.Approved == true ? "Approved" : "Declined")}");

                    // Get owner details for the message
                    var ownerDoc = await db.Collection("users").Document(exchange.OwnerId).GetSnapshotAsync();
                    var ownerName = "The owner";
                    if (ownerDoc.Exists)
                    {
                        var owner = ownerDoc.ConvertTo<UserAuth>();
                        ownerName = $"{owner.FirstName} {owner.LastName}".Trim();
                        if (string.IsNullOrEmpty(ownerName))
                            ownerName = owner.Email;
                        Console.WriteLine($"[DEBUG] Owner name: {ownerName}");
                    }
                    else
                    {
                        Console.WriteLine($"[DEBUG] Owner document not found for ID: {exchange.OwnerId}");
                    }

                    // Find or create message thread between borrower and owner for this item
                    Console.WriteLine($"[DEBUG] Searching for existing message thread...");
                    var threadQuery = await db.Collection("messageThreads")
                        .WhereEqualTo("itemID", exchange.ItemId)
                        .WhereArrayContains("participants", exchange.BorrowerId)
                        .WhereArrayContains("participants", exchange.OwnerId)
                        .Limit(1)
                        .GetSnapshotAsync();

                    string threadId;
                    if (threadQuery.Count > 0)
                    {
                        threadId = threadQuery[0].Id;
                        Console.WriteLine($"[DEBUG] Found existing thread: {threadId}");
                    }
                    else
                    {
                        Console.WriteLine($"[DEBUG] No existing thread found, creating new one...");
                        // Create new thread
                        var thread = new MessageThread
                        {
                            Participants = new List<string> { exchange.BorrowerId, exchange.OwnerId },
                            CanonicalKey = CanonicalKeyFor(new[] { exchange.BorrowerId, exchange.OwnerId, exchange.ItemId }),
                            Subject = "Item Exchange",
                            UpdatedUtc = DateTime.UtcNow,
                            LastMessagePreview = null,
                            LastReadBy = new Dictionary<string, DateTime>(),
                            StarredBy = new List<string>(),
                            ItemId = exchange.ItemId
                        };

                        var threadDoc = await db.Collection("messageThreads").AddAsync(thread);
                        threadId = threadDoc.Id;
                        Console.WriteLine($"[DEBUG] Created new thread: {threadId}");
                    }

                    // Send message about approval decision
                    Console.WriteLine($"[DEBUG] Sending message to thread: {threadId}");
                    var message = new MessageDoc
                    {
                        SenderId = exchange.OwnerId,
                        Body = dto.Approved == true 
                            ? $"Great! I've approved your request to borrow my item. The borrowing period is from {dto.StartDate?.ToString("yyyy-MM-dd")} to {dto.EndDate?.ToString("yyyy-MM-dd")}. Let's arrange a time to meet up!"
                            : "I'm sorry, but I can't approve your request to borrow my item at this time. Please feel free to reach out if you have any questions.",
                        SentUtc = DateTime.UtcNow
                    };

                    await db.Collection("messageThreads").Document(threadId).Collection("messages").AddAsync(message);
                    Console.WriteLine($"[DEBUG] Message sent successfully");

                    // Update thread with new message preview
                    var threadRef = db.Collection("messageThreads").Document(threadId);
                    await threadRef.UpdateAsync(new Dictionary<string, object>
                    {
                        ["lastMessagePreview"] = Preview(message.Body),
                        ["updatedUtc"] = message.SentUtc,
                        [$"lastReadBy.{message.SenderId}"] = message.SentUtc
                    });
                    Console.WriteLine($"[DEBUG] Thread updated successfully");
                }
                catch (Exception msgEx)
                {
                    Console.WriteLine($"[ERROR] Could not send message for approval decision: {msgEx.Message}");
                    Console.WriteLine($"[ERROR] Stack trace: {msgEx.StackTrace}");
                    // Don't fail the whole request if message sending fails
                }

                var updated = await doc.GetSnapshotAsync();
                try
                {
                return Results.Ok(updated.ConvertTo<Exchange>());
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error converting updated exchange: {ex.Message}");
                    return Results.Ok(new { message = "Exchange updated successfully", id = id });
                }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in approval endpoint: {ex.Message}");
                    return Results.BadRequest(new { error = $"An error occurred: {ex.Message}" });
                }
            })
            .WithName("UpdateExchangeApproval")
            .WithTags("Exchanges")
            .Accepts<UpdateExchangeApprovalDto>("application/json")
            .Produces<Exchange>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Approve or decline an exchange";
                op.Description = "Sets 'approved' (true/false) and 'requestHandled'. If approved, requires startDate/endDate; if declined, clears dates. New exchanges default to approved = null.";
                return op;
            });


            // PUT /exchanges/{id}/early-return — approve/decline early return request
            app.MapPut("/exchanges/{id}/early-return", async (
                [FromServices] FirestoreDb db,
                string id,
                [FromBody] EarlyReturnApprovalDto dto) =>
            {
                try
                {
                    var doc  = db.Collection("exchanges").Document(id);
                    var snap = await doc.GetSnapshotAsync();
                    if (!snap.Exists) return Results.NotFound(new { error = "Exchange not found." });

                    var exchange = snap.ConvertTo<Exchange>();
                    if (exchange is null)
                        return Results.BadRequest(new { error = "Invalid exchange payload." });

                    var nowUtc = DateTime.UtcNow;

                    // Minimal updates for early return
                    var updates = new Dictionary<string, object>
                    {
                        ["endDate"]             = nowUtc,     // early return ends now
                        ["requestHandled"]      = nowUtc,     // mark handled
                        ["earlyReturnApproved"] = dto.Approved
                    };

                    if (dto.Approved)
                    {
                        // Update user counters only when approved
                        await UpdateUserCountersOnReturn(db, exchange.OwnerId, exchange.BorrowerId);
                    }

                    await doc.UpdateAsync(updates);

                    // Send a message to the borrower about the early return decision
                    try
                    {
                        Console.WriteLine($"[DEBUG] Starting message creation for early return decision");
                        Console.WriteLine($"[DEBUG] Exchange details - BorrowerId: {exchange.BorrowerId}, OwnerId: {exchange.OwnerId}, ItemId: {exchange.ItemId}");
                        Console.WriteLine($"[DEBUG] Decision: {(dto.Approved ? "Approved" : "Declined")}");

                        // Get owner details for the message
                        var ownerDoc = await db.Collection("users").Document(exchange.OwnerId).GetSnapshotAsync();
                        var ownerName = "The owner";
                        if (ownerDoc.Exists)
                        {
                            var owner = ownerDoc.ConvertTo<UserAuth>();
                            ownerName = $"{owner.FirstName} {owner.LastName}".Trim();
                            if (string.IsNullOrEmpty(ownerName))
                                ownerName = owner.Email;
                            Console.WriteLine($"[DEBUG] Owner name: {ownerName}");
                        }
                        else
                        {
                            Console.WriteLine($"[DEBUG] Owner document not found for ID: {exchange.OwnerId}");
                        }

                        // Find message thread between borrower and owner for this item
                        Console.WriteLine($"[DEBUG] Searching for existing message thread...");
                        var threadQuery = await db.Collection("messageThreads")
                            .WhereEqualTo("itemID", exchange.ItemId)
                            .WhereArrayContains("participants", exchange.BorrowerId)
                            .WhereArrayContains("participants", exchange.OwnerId)
                            .Limit(1)
                            .GetSnapshotAsync();

                        if (threadQuery.Count > 0)
                        {
                            var threadId = threadQuery[0].Id;
                            Console.WriteLine($"[DEBUG] Found existing thread: {threadId}");
                            
                            // Send message about early return decision
                            Console.WriteLine($"[DEBUG] Sending decision message to thread: {threadId}");
                            var message = new MessageDoc
                            {
                                SenderId = exchange.OwnerId,
                                Body = dto.Approved 
                                    ? "Great! I've approved your early return request. Let's arrange a time to meet up so you can return the item."
                                    : "I'm sorry, but I can't approve the early return request at this time. Please return the item by the original due date.",
                                SentUtc = DateTime.UtcNow
                            };

                            await db.Collection("messageThreads").Document(threadId).Collection("messages").AddAsync(message);
                            Console.WriteLine($"[DEBUG] Decision message sent successfully");

                            // Update thread with new message preview
                            var threadRef = db.Collection("messageThreads").Document(threadId);
                            await threadRef.UpdateAsync(new Dictionary<string, object>
                            {
                                ["lastMessagePreview"] = Preview(message.Body),
                                ["updatedUtc"] = message.SentUtc,
                                [$"lastReadBy.{message.SenderId}"] = message.SentUtc
                            });
                            Console.WriteLine($"[DEBUG] Thread updated successfully");
                        }
                        else
                        {
                            Console.WriteLine($"[DEBUG] No existing thread found for early return decision - creating new thread");
                            // Create new thread if none exists
                            var thread = new MessageThread
                            {
                                Participants = new List<string> { exchange.BorrowerId, exchange.OwnerId },
                                CanonicalKey = CanonicalKeyFor(new[] { exchange.BorrowerId, exchange.OwnerId, exchange.ItemId }),
                                Subject = "Item Exchange",
                                UpdatedUtc = DateTime.UtcNow,
                                LastMessagePreview = null,
                                LastReadBy = new Dictionary<string, DateTime>(),
                                StarredBy = new List<string>(),
                                ItemId = exchange.ItemId
                            };

                            var threadDoc = await db.Collection("messageThreads").AddAsync(thread);
                            var threadId = threadDoc.Id;
                            Console.WriteLine($"[DEBUG] Created new thread for decision: {threadId}");
                            
                            // Send message about early return decision
                            Console.WriteLine($"[DEBUG] Sending decision message to new thread: {threadId}");
                            var message = new MessageDoc
                            {
                                SenderId = exchange.OwnerId,
                                Body = dto.Approved 
                                    ? "Great! I've approved your early return request. Let's arrange a time to meet up so you can return the item."
                                    : "I'm sorry, but I can't approve the early return request at this time. Please return the item by the original due date.",
                                SentUtc = DateTime.UtcNow
                            };

                            await db.Collection("messageThreads").Document(threadId).Collection("messages").AddAsync(message);
                            Console.WriteLine($"[DEBUG] Decision message sent successfully to new thread");

                            // Update thread with new message preview
                            var threadRef = db.Collection("messageThreads").Document(threadId);
                            await threadRef.UpdateAsync(new Dictionary<string, object>
                            {
                                ["lastMessagePreview"] = Preview(message.Body),
                                ["updatedUtc"] = message.SentUtc,
                                [$"lastReadBy.{message.SenderId}"] = message.SentUtc
                            });
                            Console.WriteLine($"[DEBUG] New thread updated successfully");
                        }
                    }
                    catch (Exception msgEx)
                    {
                        Console.WriteLine($"[ERROR] Could not send message for early return decision: {msgEx.Message}");
                        Console.WriteLine($"[ERROR] Stack trace: {msgEx.StackTrace}");
                        // Don't fail the whole request if message sending fails
                    }

                    var updated = await doc.GetSnapshotAsync();
                    try
                    {
                        var updatedExchange = updated.ConvertTo<Exchange>();
                        return Results.Ok(updatedExchange);
                    }
                    catch
                    {
                        return Results.Ok(new { message = "Early return request processed successfully", id });
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in early return endpoint: {ex.Message}");
                    return Results.BadRequest(new { error = $"An error occurred: {ex.Message}" });
                }
            })
            .WithName("ApproveEarlyReturn")
            .WithTags("Exchanges")
            .Accepts<EarlyReturnApprovalDto>("application/json")
            .Produces<Exchange>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Approve or decline an early return request";
                op.Description = "Processes an early return by moving endDate to now; updates user counters when approved.";
                return op;
            });

            // POST /exchanges/{id}/request-item-back-early — owner requests item back early
            app.MapPost("/exchanges/{id}/request-item-back-early", async ([FromServices] FirestoreDb db, string id) =>
            {
                try
                {
                    var doc = db.Collection("exchanges").Document(id);
                    var snap = await doc.GetSnapshotAsync();
                    if (!snap.Exists) return Results.NotFound(new { error = "Exchange not found." });

                    Exchange exchange;
                    try
                    {
                        exchange = snap.ConvertTo<Exchange>();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error converting exchange document {id}: {ex.Message}");
                        return Results.BadRequest(new { error = $"Error processing exchange data: {ex.Message}" });
                    }

                    // Check if exchange is approved and not already returned
                    if (!(exchange.Approved ?? false))
                    {
                        return Results.BadRequest(new { error = "Can only request item back early for approved exchanges." });
                    }

                    // Check if already returned
                    if (exchange.EndDate.HasValue && exchange.EndDate.Value <= DateTime.UtcNow)
                    {
                        return Results.BadRequest(new { error = "This item has already been returned." });
                    }

                    // Check if it's actually early (before end date)
                    if (exchange.EndDate.HasValue && DateTime.UtcNow >= exchange.EndDate.Value)
                    {
                        return Results.BadRequest(new { error = "Cannot request item back early on or after the return date." });
                    }

                    // Check if there's already a pending item back request
                    var existingNotificationQuery = await db.Collection("notifications")
                        .WhereEqualTo("type", "item_back_request")
                        .WhereEqualTo("senderId", exchange.OwnerId)
                        .WhereEqualTo("receiverId", exchange.BorrowerId)
                        .WhereEqualTo("listingId", exchange.ItemId)
                        .WhereEqualTo("dismissed", false)
                        .Limit(1)
                        .GetSnapshotAsync();

                    if (existingNotificationQuery.Count > 0)
                    {
                        return Results.BadRequest(new { error = "You have already sent a request to get this item back early." });
                    }

                    // Create item back request notification
                    var notification = new Notification
                    {
                        Id = Guid.NewGuid().ToString("n"),
                        SenderId = exchange.OwnerId,
                        ReceiverId = exchange.BorrowerId,
                        Title = "Item Back Request",
                        Message = $"The owner wants to get their item back early.",
                        Type = "item_back_request",
                        ListingId = exchange.ItemId,
                        CreatedUtc = DateTime.UtcNow,
                        Dismissed = false
                    };

                    await db.Collection("notifications").Document(notification.Id).SetAsync(notification);

                    // Send a message to the borrower about the item back request
                    try
                    {
                        Console.WriteLine($"[DEBUG] Starting message creation for item back request");
                        Console.WriteLine($"[DEBUG] Exchange details - BorrowerId: {exchange.BorrowerId}, OwnerId: {exchange.OwnerId}, ItemId: {exchange.ItemId}");

                        // Get owner details for the message
                        var ownerDoc = await db.Collection("users").Document(exchange.OwnerId).GetSnapshotAsync();
                        var ownerName = "The owner";
                        if (ownerDoc.Exists)
                        {
                            var owner = ownerDoc.ConvertTo<UserAuth>();
                            ownerName = $"{owner.FirstName} {owner.LastName}".Trim();
                            if (string.IsNullOrEmpty(ownerName))
                                ownerName = owner.Email;
                            Console.WriteLine($"[DEBUG] Owner name: {ownerName}");
                        }
                        else
                        {
                            Console.WriteLine($"[DEBUG] Owner document not found for ID: {exchange.OwnerId}");
                        }

                        // Find or create message thread between borrower and owner for this item
                        Console.WriteLine($"[DEBUG] Searching for existing message thread...");
                        var threadQuery = await db.Collection("messageThreads")
                            .WhereEqualTo("itemID", exchange.ItemId)
                            .WhereArrayContains("participants", exchange.BorrowerId)
                            .WhereArrayContains("participants", exchange.OwnerId)
                            .Limit(1)
                            .GetSnapshotAsync();

                        string threadId;
                        if (threadQuery.Count > 0)
                        {
                            threadId = threadQuery[0].Id;
                            Console.WriteLine($"[DEBUG] Found existing thread: {threadId}");
                        }
                        else
                        {
                            Console.WriteLine($"[DEBUG] No existing thread found, creating new one...");
                            // Create new thread
                            var thread = new MessageThread
                            {
                                Participants = new List<string> { exchange.BorrowerId, exchange.OwnerId },
                                CanonicalKey = CanonicalKeyFor(new[] { exchange.BorrowerId, exchange.OwnerId, exchange.ItemId }),
                                Subject = "Item Exchange",
                                UpdatedUtc = DateTime.UtcNow,
                                LastMessagePreview = null,
                                LastReadBy = new Dictionary<string, DateTime>(),
                                StarredBy = new List<string>(),
                                ItemId = exchange.ItemId
                            };

                            var threadDoc = await db.Collection("messageThreads").AddAsync(thread);
                            threadId = threadDoc.Id;
                            Console.WriteLine($"[DEBUG] Created new thread: {threadId}");
                        }

                        // Send message about item back request
                        Console.WriteLine($"[DEBUG] Sending message to thread: {threadId}");
                        var message = new MessageDoc
                        {
                            SenderId = exchange.OwnerId,
                            Body = $"Hi! I'd like to get my item back early. Could we arrange a time to meet up?",
                            SentUtc = DateTime.UtcNow
                        };

                        await db.Collection("messageThreads").Document(threadId).Collection("messages").AddAsync(message);
                        Console.WriteLine($"[DEBUG] Message sent successfully");

                        // Update thread with new message preview
                        var threadRef = db.Collection("messageThreads").Document(threadId);
                        await threadRef.UpdateAsync(new Dictionary<string, object>
                        {
                            ["lastMessagePreview"] = Preview(message.Body),
                            ["updatedUtc"] = message.SentUtc,
                            [$"lastReadBy.{message.SenderId}"] = message.SentUtc
                        });
                        Console.WriteLine($"[DEBUG] Thread updated successfully");
                    }
                    catch (Exception msgEx)
                    {
                        Console.WriteLine($"[ERROR] Could not send message for item back request: {msgEx.Message}");
                        Console.WriteLine($"[ERROR] Stack trace: {msgEx.StackTrace}");
                        // Don't fail the whole request if message sending fails
                    }

                    return Results.Ok(new { message = "Item back request sent successfully", notificationId = notification.Id });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in item back request endpoint: {ex.Message}");
                    return Results.BadRequest(new { error = $"An error occurred: {ex.Message}" });
                }
            })
            .WithName("RequestItemBackEarly")
            .WithTags("Exchanges")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Request item back early";
                op.Description = "Allows owners to request their loaned items back early.";
                return op;
            });

            // POST /exchanges/{id}/request-early-return — borrower requests early return
            app.MapPost("/exchanges/{id}/request-early-return", async ([FromServices] FirestoreDb db, string id) =>
            {
                try
                {
                    var doc = db.Collection("exchanges").Document(id);
                    var snap = await doc.GetSnapshotAsync();
                    if (!snap.Exists) return Results.NotFound(new { error = "Exchange not found." });

                    Exchange exchange;
                    try
                    {
                        exchange = snap.ConvertTo<Exchange>();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error converting exchange document {id}: {ex.Message}");
                        return Results.BadRequest(new { error = $"Error processing exchange data: {ex.Message}" });
                    }

                    // Check if exchange is approved and not already returned
                    if (!(exchange.Approved ?? false))
                    {
                        return Results.BadRequest(new { error = "Can only request early return for approved exchanges." });
                    }

                    // Check if already returned
                    if (exchange.EndDate.HasValue && exchange.EndDate.Value <= DateTime.UtcNow)
                    {
                        return Results.BadRequest(new { error = "This item has already been returned." });
                    }

                    // Check if it's actually early (before end date)
                    if (exchange.EndDate.HasValue && DateTime.UtcNow >= exchange.EndDate.Value)
                    {
                        return Results.BadRequest(new { error = "Cannot request early return on or after the return date." });
                    }

                    // Check if there's already a pending early return request
                    var existingNotificationQuery = await db.Collection("notifications")
                        .WhereEqualTo("type", "early_return_request")
                        .WhereEqualTo("senderId", exchange.BorrowerId)
                        .WhereEqualTo("receiverId", exchange.OwnerId)
                        .WhereEqualTo("listingId", exchange.ItemId)
                        .WhereEqualTo("dismissed", false)
                        .Limit(1)
                        .GetSnapshotAsync();

                    if (existingNotificationQuery.Count > 0)
                    {
                        return Results.BadRequest(new { error = "You have already sent an early return request for this item." });
                    }

                    // Create early return request notification
                    var notification = new Notification
                    {
                        Id = Guid.NewGuid().ToString("n"),
                        SenderId = exchange.BorrowerId,
                        ReceiverId = exchange.OwnerId,
                        Title = "Early Return Request",
                        Message = $"The borrower wants to return your item early.",
                        Type = "early_return_request",
                        ListingId = exchange.ItemId,
                        CreatedUtc = DateTime.UtcNow,
                        Dismissed = false
                    };

                    await db.Collection("notifications").Document(notification.Id).SetAsync(notification);

                    // Send a message to the owner about the early return request
                    try
                    {
                        Console.WriteLine($"[DEBUG] Starting message creation for early return request");
                        Console.WriteLine($"[DEBUG] Exchange details - BorrowerId: {exchange.BorrowerId}, OwnerId: {exchange.OwnerId}, ItemId: {exchange.ItemId}");

                        // Get borrower details for the message
                        var borrowerDoc = await db.Collection("users").Document(exchange.BorrowerId).GetSnapshotAsync();
                        var borrowerName = "The borrower";
                        if (borrowerDoc.Exists)
                        {
                            var borrower = borrowerDoc.ConvertTo<UserAuth>();
                            borrowerName = $"{borrower.FirstName} {borrower.LastName}".Trim();
                            if (string.IsNullOrEmpty(borrowerName))
                                borrowerName = borrower.Email;
                            Console.WriteLine($"[DEBUG] Borrower name: {borrowerName}");
                        }
                        else
                        {
                            Console.WriteLine($"[DEBUG] Borrower document not found for ID: {exchange.BorrowerId}");
                        }

                        // Find or create message thread between borrower and owner for this item
                        Console.WriteLine($"[DEBUG] Searching for existing message thread...");
                        var threadQuery = await db.Collection("messageThreads")
                            .WhereEqualTo("itemID", exchange.ItemId)
                            .WhereArrayContains("participants", exchange.BorrowerId)
                            .WhereArrayContains("participants", exchange.OwnerId)
                            .Limit(1)
                            .GetSnapshotAsync();

                        string threadId;
                        if (threadQuery.Count > 0)
                        {
                            threadId = threadQuery[0].Id;
                            Console.WriteLine($"[DEBUG] Found existing thread: {threadId}");
                        }
                        else
                        {
                            Console.WriteLine($"[DEBUG] No existing thread found, creating new one...");
                            // Create new thread
                            var thread = new MessageThread
                            {
                                Participants = new List<string> { exchange.BorrowerId, exchange.OwnerId },
                                CanonicalKey = CanonicalKeyFor(new[] { exchange.BorrowerId, exchange.OwnerId, exchange.ItemId }),
                                Subject = "Item Exchange",
                                UpdatedUtc = DateTime.UtcNow,
                                LastMessagePreview = null,
                                LastReadBy = new Dictionary<string, DateTime>(),
                                StarredBy = new List<string>(),
                                ItemId = exchange.ItemId
                            };

                            var threadDoc = await db.Collection("messageThreads").AddAsync(thread);
                            threadId = threadDoc.Id;
                            Console.WriteLine($"[DEBUG] Created new thread: {threadId}");
                        }

                        // Send message about early return request
                        Console.WriteLine($"[DEBUG] Sending message to thread: {threadId}");
                        var message = new MessageDoc
                        {
                            SenderId = exchange.BorrowerId,
                            Body = $"Hi! I'd like to return your item early. Could we arrange a time to meet up?",
                            SentUtc = DateTime.UtcNow
                        };

                        await db.Collection("messageThreads").Document(threadId).Collection("messages").AddAsync(message);
                        Console.WriteLine($"[DEBUG] Message sent successfully");

                        // Update thread with new message preview
                        var threadRef = db.Collection("messageThreads").Document(threadId);
                        await threadRef.UpdateAsync(new Dictionary<string, object>
                        {
                            ["lastMessagePreview"] = Preview(message.Body),
                            ["updatedUtc"] = message.SentUtc,
                            [$"lastReadBy.{message.SenderId}"] = message.SentUtc
                        });
                        Console.WriteLine($"[DEBUG] Thread updated successfully");
                    }
                    catch (Exception msgEx)
                    {
                        Console.WriteLine($"[ERROR] Could not send message for early return request: {msgEx.Message}");
                        Console.WriteLine($"[ERROR] Stack trace: {msgEx.StackTrace}");
                        // Don't fail the whole request if message sending fails
                    }

                    return Results.Ok(new { message = "Early return request sent successfully", notificationId = notification.Id });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in early return request endpoint: {ex.Message}");
                    return Results.BadRequest(new { error = $"An error occurred: {ex.Message}" });
                }
            })
            .WithName("RequestEarlyReturn")
            .WithTags("Exchanges")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Request early return of a borrowed item";
                op.Description = "Allows borrowers to request early return of their borrowed items.";
                return op;
            });


            // POST /exchanges/{id}/mark-returned — borrower marks item as returned (requires owner approval)
            app.MapPost("/exchanges/{id}/mark-returned", async ([FromServices] FirestoreDb db, string id) =>
            {
                try
                {
                    var doc = db.Collection("exchanges").Document(id);
                    var snap = await doc.GetSnapshotAsync();
                    if (!snap.Exists) return Results.NotFound(new { error = "Exchange not found." });

                    Exchange exchange;
                    try
                    {
                        exchange = snap.ConvertTo<Exchange>();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error converting exchange document {id}: {ex.Message}");
                        return Results.BadRequest(new { error = $"Error processing exchange data: {ex.Message}" });
                    }

                    // Check if exchange is approved and not already returned
                    if (!(exchange.Approved ?? false))
                    {
                        return Results.BadRequest(new { error = "Can only mark returned for approved exchanges." });
                    }

                    // Check if already returned
                    if (exchange.EndDate.HasValue && exchange.EndDate.Value <= DateTime.UtcNow)
                    {
                        return Results.BadRequest(new { error = "This item has already been returned." });
                    }

                    // Create return confirmation notification for owner
                    var notification = new Notification
                    {
                        Id = Guid.NewGuid().ToString("n"),
                        SenderId = exchange.BorrowerId,
                        ReceiverId = exchange.OwnerId,
                        Title = "Item Returned",
                        Message = $"The borrower has marked your item as returned. Please confirm receipt.",
                        Type = "item_returned",
                        ListingId = exchange.ItemId,
                        CreatedUtc = DateTime.UtcNow,
                        Dismissed = false
                    };

                    await db.Collection("notifications").Document(notification.Id).SetAsync(notification);

                    // Mark the exchange as pending return confirmation
                    var updates = new Dictionary<string, object>
                    {
                        ["returnPendingConfirmation"] = true,
                        ["returnRequestedAt"] = DateTime.UtcNow
                    };

                    await doc.UpdateAsync(updates);

                    return Results.Ok(new { message = "Item marked as returned. Waiting for owner confirmation.", notificationId = notification.Id });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in mark returned endpoint: {ex.Message}");
                    return Results.BadRequest(new { error = $"An error occurred: {ex.Message}" });
                }
            })
            .WithName("MarkItemReturned")
            .WithTags("Exchanges")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Mark an item as returned (requires owner confirmation)";
                op.Description = "Allows borrowers to mark items as returned, which requires owner confirmation.";
                return op;
            });

            // PUT /exchanges/{id}/confirm-return — owner confirms item return
            app.MapPut("/exchanges/{id}/confirm-return", async ([FromServices] FirestoreDb db, string id, [FromBody] ConfirmReturnDto dto) =>
            {
                try
                {
                    var doc = db.Collection("exchanges").Document(id);
                    var snap = await doc.GetSnapshotAsync();
                    if (!snap.Exists) return Results.NotFound(new { error = "Exchange not found." });

                    Exchange exchange;
                    try
                    {
                        exchange = snap.ConvertTo<Exchange>();
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error converting exchange document {id}: {ex.Message}");
                        return Results.BadRequest(new { error = $"Error processing exchange data: {ex.Message}" });
                    }

                    var nowUtc = DateTime.UtcNow;

                    var updates = new Dictionary<string, object>
                    {
                        ["endDate"] = nowUtc,
                        ["returnConfirmed"] = dto.Confirmed,
                        ["returnConfirmedAt"] = nowUtc,
                        ["returnPendingConfirmation"] = false
                    };

                    if (dto.Confirmed)
                    {
                        // Update user counters when confirming return
                        await UpdateUserCountersOnReturn(db, exchange.OwnerId, exchange.BorrowerId);
                        
                        // Create confirmation notification for borrower
                        var notification = new Notification
                        {
                            Id = Guid.NewGuid().ToString("n"),
                            SenderId = exchange.OwnerId,
                            ReceiverId = exchange.BorrowerId,
                            Title = "Return Confirmed",
                            Message = $"Your item return has been confirmed by the owner.",
                            Type = "return_confirmed",
                            ListingId = exchange.ItemId,
                            CreatedUtc = nowUtc,
                            Dismissed = false
                        };

                        await db.Collection("notifications").Document(notification.Id).SetAsync(notification);
                    }
                    else
                    {
                        // Create dispute notification for borrower
                        var notification = new Notification
                        {
                            Id = Guid.NewGuid().ToString("n"),
                            SenderId = exchange.OwnerId,
                            ReceiverId = exchange.BorrowerId,
                            Title = "Return Disputed",
                            Message = $"The owner has disputed your item return. Please contact support.",
                            Type = "return_disputed",
                            ListingId = exchange.ItemId,
                            CreatedUtc = nowUtc,
                            Dismissed = false
                        };

                        await db.Collection("notifications").Document(notification.Id).SetAsync(notification);
                    }

                    await doc.UpdateAsync(updates);

                    var updated = await doc.GetSnapshotAsync();
                    try
                    {
                        return Results.Ok(updated.ConvertTo<Exchange>());
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error converting updated exchange: {ex.Message}");
                        return Results.Ok(new { message = "Return confirmation processed successfully", id = id });
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in confirm return endpoint: {ex.Message}");
                    return Results.BadRequest(new { error = $"An error occurred: {ex.Message}" });
                }
            })
            .WithName("ConfirmReturn")
            .WithTags("Exchanges")
            .Accepts<ConfirmReturnDto>("application/json")
            .Produces<Exchange>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Confirm or dispute an item return";
                op.Description = "Allows owners to confirm or dispute item returns from borrowers.";
                return op;
            });

            // PUT /exchanges/{id}/return — mark exchange as returned
            app.MapPut("/exchanges/{id}/return", async ([FromServices] FirestoreDb db, string id) =>
            {
                var doc = db.Collection("exchanges").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { error = "Exchange not found." });

                var exchange = snap.ConvertTo<Exchange>();
                if (!(exchange.Approved ?? false))
                {
                    return Results.BadRequest(new { error = "Cannot return an unapproved exchange." });
                }

                // Mark as returned by setting endDate to now
                var nowUtc = DateTime.UtcNow;
                await doc.UpdateAsync("endDate", nowUtc);

                // Update user counters when item is returned
                await UpdateUserCountersOnReturn(db, exchange.OwnerId, exchange.BorrowerId);

                var updated = await doc.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Exchange>());
            })
            .WithName("ReturnExchange")
            .WithTags("Exchanges")
            .Produces<Exchange>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Mark an exchange as returned";
                op.Description = "Marks an approved exchange as returned by updating the endDate to current time.";
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
                    SenderAvatar = dto.SenderAvatar?.Trim(),
                    Dismissed = false
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


            // PUT /notifications/{id}/dismiss — mark a notification as dismissed
            app.MapPut("/notifications/{id}/dismiss", async (FirestoreDb db, string id) =>
            {
                var doc = db.Collection("notifications").Document(id);
                var snap = await doc.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await doc.UpdateAsync(new Dictionary<string, object> { ["dismissed"] = true });

                var updated = await doc.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Notification>());
            })
            .WithName("DismissNotification")
            .WithTags("Notifications")
            .Produces<Notification>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Dismiss a notification";
                op.Description = "Updates a notification's 'Dismissed' field to true.";
                return op;
            });


            // -------- Listings --------

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

            // GET /maintenance/item/{itemId}
            app.MapGet("/maintenance/item/{itemId}", async (FirestoreDb db, string itemId) =>
            {
                var snaps = await db.Collection("maintenance")
                                    .WhereEqualTo("itemID", itemId)
                                    .GetSnapshotAsync();

                var maints = snaps.Documents
                                .Select(s => s.ConvertTo<Maintenance>())
                                .ToList();

                return Results.Ok(maints);
            })
            .WithName("GetMaintenanceByItemId")
            .WithTags("Maintenance")
            .Produces<IEnumerable<Maintenance>>(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "List maintenance by itemID";
                op.Description = "Returns all maintenance documents where itemID matches the provided itemId. Includes the 'types' array.";
                return op;
            });


            app.MapGet("/maintenance/{maintenanceId}/photos", async (FirestoreDb db, string maintenanceId) =>
            {
                var snaps = await db.Collection("Document")
                                    .WhereEqualTo("maintenanceID", maintenanceId)   // Firestore field name (case-sensitive)
                                    .GetSnapshotAsync();

                var photos = snaps.Documents
                    .Select(s => s.ConvertTo<DocumentEntry>())
                    .Where(d => !string.IsNullOrWhiteSpace(d.DocumentContent))       // has a URL
                    .Where(d => IsPhotoUrl(d.DocumentContent))                       // keep images only
                    .OrderByDescending(d => d.CreatedUtc)                            // optional ordering
                    .Select(d => new
                    {
                        id = d.Id,
                        url = d.DocumentContent,
                        description = d.Description,                                  // mapped from "Description"
                        createdUtc = d.CreatedUtc
                    })
                    .ToList();

                return Results.Ok(new { maintenanceId, count = photos.Count, photos });
            })
            .WithName("GetMaintenancePhotos")
            .WithTags("Maintenance", "Documents")
            .Produces(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "Get all photos for a maintenance record";
                op.Description = "Returns image documents from 'Document' where 'maintenanceID' matches the given maintenanceId.";
                return op;
            });


            // Compute nextMaintenanceDate on create using (lastMaintenanceDate ?? CreatedUtc) + frequency (days).
            app.MapPost("/maintenance", async (FirestoreDb db, CreateMaintenanceDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.ItemId) || string.IsNullOrWhiteSpace(dto.Description))
                    return Results.BadRequest(new { message = "ItemId and Description are required." });

                string? type     = string.IsNullOrWhiteSpace(dto.Type)     ? null : dto.Type.Trim();
                string? category = string.IsNullOrWhiteSpace(dto.Category) ? null : dto.Category.Trim();

                var createdUtc = DateTime.UtcNow;
                DateTime? lastUtc = dto.LastMaintenanceDate.HasValue
                    ? DateTime.SpecifyKind(dto.LastMaintenanceDate.Value, DateTimeKind.Utc)
                    : (DateTime?)null;

                int? freq = dto.Frequency;
                DateTime? nextUtc = (freq.HasValue && freq.Value > 0)
                    ? (lastUtc ?? createdUtc).AddDays(freq.Value)
                    : (DateTime?)null;

                var m = new Maintenance
                {
                    Id                  = Guid.NewGuid().ToString("n"),
                    ItemId              = dto.ItemId.Trim(),
                    Description         = dto.Description.Trim(),
                    Frequency           = freq,                 // int? (days)
                    CreatedUtc          = createdUtc,
                    MaintenanceHistory  = new List<DateTime>(),
                    LastMaintenanceDate = lastUtc,              // may be null on create
                    NextMaintenanceDate = nextUtc,              // NEW: computed above
                    Type                = type,
                    Category            = category
                };

                var docRef = db.Collection("maintenance").Document(m.Id);
                await docRef.SetAsync(m);

                var updated = await docRef.GetSnapshotAsync();
                return Results.Created($"/maintenance/{m.Id}", updated.ConvertTo<Maintenance>());
            })
            .WithName("CreateMaintenance")
            .WithTags("Maintenance")
            .Accepts<CreateMaintenanceDto>("application/json")
            .Produces<Maintenance>(StatusCodes.Status201Created, "application/json")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a maintenance record";
                op.Description =
                    "Creates a new maintenance document. Optional fields: frequency (days), " +
                    "type, category, lastMaintenanceDate (UTC). The server computes nextMaintenanceDate.";
                op.RequestBody!.Content["application/json"].Example = new Microsoft.OpenApi.Any.OpenApiObject
                {
                    ["itemId"]             = new Microsoft.OpenApi.Any.OpenApiString("abc123"),
                    ["description"]        = new Microsoft.OpenApi.Any.OpenApiString("Quarterly inspection"),
                    ["frequency"]          = new Microsoft.OpenApi.Any.OpenApiInteger(7),
                    ["lastMaintenanceDate"]= new Microsoft.OpenApi.Any.OpenApiString("2025-10-01T00:00:00Z"),
                    ["type"]               = new Microsoft.OpenApi.Any.OpenApiString("Inspection"),
                    ["category"]           = new Microsoft.OpenApi.Any.OpenApiString("Preventive")
                };
                return op;
            });


            // Recompute nextMaintenanceDate whenever Frequency or LastMaintenanceDate changes.
            app.MapPut("/maintenance/{id}", async (FirestoreDb db, string id, UpdateMaintenanceDto dto) =>
            {
                var docRef = db.Collection("maintenance").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { message = "Maintenance record not found." });

                var current = snap.ConvertTo<Maintenance>();
                var updates = new Dictionary<string, object>();

                // Description
                if (dto.Description is not null)
                {
                    var d = dto.Description.Trim();
                    if (string.IsNullOrWhiteSpace(d))
                        return Results.BadRequest(new { message = "description cannot be empty" });
                    updates["description"] = d;
                }

                // Type
                if (dto.Type is not null)
                {
                    var t = dto.Type.Trim();
                    if (string.IsNullOrWhiteSpace(t))
                        return Results.BadRequest(new { message = "type cannot be empty" });
                    updates["type"] = t;
                }

                // Category
                if (dto.Category is not null)
                {
                    var c = dto.Category.Trim();
                    if (string.IsNullOrWhiteSpace(c))
                        return Results.BadRequest(new { message = "category cannot be empty" });
                    updates["category"] = c;
                }

                // MaintenanceHistory (full replace if provided)
                if (dto.MaintenanceHistory is not null)
                    updates["maintenanceHistory"] = dto.MaintenanceHistory;

                // Frequency & LastMaintenanceDate (and recompute nextMaintenanceDate)
                if (dto.Frequency.HasValue) updates["frequency"] = dto.Frequency.Value;

                DateTime? effectiveLast = null;
                bool lastWasProvided = false;

                if (dto.LastMaintenanceDate.HasValue)
                {
                    effectiveLast = DateTime.SpecifyKind(dto.LastMaintenanceDate.Value, DateTimeKind.Utc);
                    updates["lastMaintenanceDate"] = effectiveLast.Value;
                    lastWasProvided = true;
                }
                else if (dto.LastMaintenanceDateExplicitlyNull)
                {
                    updates["lastMaintenanceDate"] = FieldValue.Delete;
                    effectiveLast = null; // treated as null
                    lastWasProvided = true;
                }

                // Decide when to recompute: if freq changed OR last changed/cleared
                bool freqChanged = dto.Frequency.HasValue;
                bool lastChanged = lastWasProvided;

                if (freqChanged || lastChanged)
                {
                    int? freq = dto.Frequency ?? current.Frequency;
                    DateTime? last = lastWasProvided ? effectiveLast : current.LastMaintenanceDate;

                    DateTime? next = (freq.HasValue && freq.Value > 0)
                        ? ((last ?? current.CreatedUtc).AddDays(freq.Value))
                        : (DateTime?)null;

                    if (next.HasValue) updates["nextMaintenanceDate"] = next.Value;
                    else updates["nextMaintenanceDate"] = FieldValue.Delete;
                }

                if (updates.Count == 0)
                    return Results.BadRequest(new { message = "No fields provided to update." });

                await docRef.UpdateAsync(updates);

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Maintenance>());
            })
            .WithName("UpdateMaintenance")
            .WithTags("Maintenance")
            .Accepts<UpdateMaintenanceDto>("application/json")
            .Produces<Maintenance>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Update a maintenance record (partial)";
                op.Description =
                    "Allows partial updates to description, frequency, type, category, maintenanceHistory, and lastMaintenanceDate. " +
                    "The server recalculates nextMaintenanceDate when frequency or lastMaintenanceDate changes.";
                op.RequestBody!.Content["application/json"].Example = new Microsoft.OpenApi.Any.OpenApiObject
                {
                    ["frequency"] = new Microsoft.OpenApi.Any.OpenApiInteger(7),
                    ["lastMaintenanceDate"] = new Microsoft.OpenApi.Any.OpenApiString("2025-10-01T00:00:00Z")
                };
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

            // GET /maintenance/calendar/{userId} - Get maintenance events for calendar
            app.MapGet("/maintenance/calendar/{userId}", async (FirestoreDb db, string userId) =>
            {
                try
                {
                    // Get user's items first
                    var userItemsSnap = await db.Collection("itemID")
                        .WhereEqualTo("userID", userId)
                        .GetSnapshotAsync();

                    Console.WriteLine($"Found {userItemsSnap.Count} items for user {userId}");
                    var maintenanceEvents = new List<object>();

                    foreach (var itemDoc in userItemsSnap.Documents)
                    {
                        var item = itemDoc.ConvertTo<Item>();
                        Console.WriteLine($"Processing item: {item.Title} (ID: {item.Id})");
                        
                        // Get maintenance for this item (only required type)
                        var maintenanceSnaps = await db.Collection("maintenance")
                            .WhereEqualTo("itemID", item.Id)
                            .WhereEqualTo("type", "required")
                            .GetSnapshotAsync();

                        Console.WriteLine($"Found {maintenanceSnaps.Count} maintenance records for item {item.Id}");

                        foreach (var maintenanceDoc in maintenanceSnaps.Documents)
                        {
                            var maintenance = maintenanceDoc.ConvertTo<Maintenance>();
                            Console.WriteLine($"Processing maintenance: {maintenance.Description}, Frequency: {maintenance.Frequency}, Type: {maintenance.Type}");
                            
                            // Use nextMaintenanceDate directly for required maintenance
                            if (maintenance.NextMaintenanceDate.HasValue)
                            {
                                var nextDueDate = maintenance.NextMaintenanceDate.Value;
                                
                                // Only show maintenance that's due within 30 days (for calendar view)
                                if (DateTime.UtcNow >= nextDueDate.AddDays(-30))
                                {
                                    maintenanceEvents.Add(new
                                    {
                                        id = $"maintenance-{maintenance.Id}",
                                        title = $"Maintenance: {item.Title}",
                                        description = maintenance.Description,
                                        date = nextDueDate,
                                        type = "required-maintenance",
                                        itemId = item.Id,
                                        itemTitle = item.Title,
                                        maintenanceId = maintenance.Id,
                                        category = maintenance.Category,
                                        frequency = maintenance.Frequency,
                                        lastMaintenanceDate = maintenance.LastMaintenanceDate,
                                        nextMaintenanceDate = nextDueDate
                                    });
                                }
                            }
                        }
                    }

                    return Results.Ok(maintenanceEvents);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error getting maintenance calendar events: {ex.Message}");
                    return Results.Problem($"Error getting maintenance calendar events: {ex.Message}");
                }
            })
            .WithName("GetMaintenanceCalendar")
            .WithTags("Maintenance")
            .Produces<List<object>>(StatusCodes.Status200OK, "application/json")
            .ProducesProblem(StatusCodes.Status500InternalServerError)
            .WithOpenApi(op =>
            {
                op.Summary = "Get maintenance calendar events for a user";
                op.Description = "Returns all maintenance events for items owned by the specified user";
                return op;
            });

            // POST /maintenance/{id}/complete - Mark maintenance as completed and update dates
            app.MapPost("/maintenance/{id}/complete", async (FirestoreDb db, string id) =>
            {
                try
                {
                    var maintenanceDoc = await db.Collection("maintenance").Document(id).GetSnapshotAsync();
                    if (!maintenanceDoc.Exists)
                    {
                        return Results.NotFound(new { message = "Maintenance record not found." });
                    }

                    var maintenance = maintenanceDoc.ConvertTo<Maintenance>();
                    var completedDate = DateTime.UtcNow;

                    // Update lastMaintenanceDate to now
                    // Calculate nextMaintenanceDate as completedDate + frequency
                    var nextMaintenanceDate = maintenance.Frequency.HasValue && maintenance.Frequency.Value > 0
                        ? completedDate.AddDays(maintenance.Frequency.Value)
                        : (DateTime?)null;

                    // Add to maintenance history
                    var updatedHistory = maintenance.MaintenanceHistory ?? new List<DateTime>();
                    updatedHistory.Add(completedDate);

                    await maintenanceDoc.Reference.UpdateAsync(new Dictionary<string, object>
                    {
                        ["lastMaintenanceDate"] = completedDate,
                        ["nextMaintenanceDate"] = nextMaintenanceDate ?? DateTime.UtcNow,
                        ["maintenanceHistory"] = updatedHistory
                    });

                    return Results.Ok(new
                    {
                        message = "Maintenance completed successfully",
                        lastMaintenanceDate = completedDate,
                        nextMaintenanceDate = nextMaintenanceDate,
                        maintenanceHistory = updatedHistory
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error completing maintenance: {ex.Message}");
                    return Results.Problem($"Error completing maintenance: {ex.Message}");
                }
            });

            // POST /maintenance/check-due - Check for due maintenance and create notifications
            app.MapPost("/maintenance/check-due", async (FirestoreDb db) =>
            {
                try
                {
                    // Only check "required" maintenance records
                    var maintenanceSnaps = await db.Collection("maintenance")
                        .WhereEqualTo("type", "required")
                        .GetSnapshotAsync();

                    var dueMaintenance = new List<object>();
                    var notificationsCreated = 0;

                    foreach (var maintenanceDoc in maintenanceSnaps.Documents)
                    {
                        var maintenance = maintenanceDoc.ConvertTo<Maintenance>();
                        
                        if (maintenance.Frequency.HasValue && maintenance.Frequency.Value > 0)
                        {
                            // Prefer persisted nextMaintenanceDate, otherwise compute it now
                            var baseDate = maintenance.LastMaintenanceDate ?? maintenance.CreatedUtc;
                            var computedNext = baseDate.AddDays(maintenance.Frequency.Value);
                            var nextDueDate = maintenance.NextMaintenanceDate ?? computedNext;

                            // OPTIONAL: back-fill nextMaintenanceDate if it's missing (keeps data consistent going forward)
                            if (!maintenance.NextMaintenanceDate.HasValue)
                            {
                                await maintenanceDoc.Reference.UpdateAsync(new Dictionary<string, object>
                                {
                                    ["nextMaintenanceDate"] = nextDueDate
                                });
                            }

                            // Due if we're within 2 days of due date (or past it)
                            if (DateTime.UtcNow >= nextDueDate.AddDays(-2))
                            {
                                // Load the item
                                var itemSnap = await db.Collection("items").Document(maintenance.ItemId).GetSnapshotAsync();
                                if (itemSnap.Exists)
                                {
                                    var item = itemSnap.ConvertTo<Item>();
                                    
                                    // Build the notification
                                    var notification = new Notification
                                    {
                                        Id          = Guid.NewGuid().ToString("n"),
                                        SenderId    = "system",
                                        ReceiverId  = item.UserId,
                                        Message     = $"Maintenance due for '{item.Title}': {maintenance.Description}",
                                        Title       = "Maintenance Due",
                                        Type        = "maintenance_due",
                                        ListingId   = maintenance.ItemId,
                                        CreatedUtc  = DateTime.UtcNow,
                                        Dismissed   = false
                                    };

                                    // Deduplicate: same receiver + type + listing and still not dismissed
                                    var existingNotification = await db.Collection("notifications")
                                        .WhereEqualTo("receiverId", item.UserId)
                                        .WhereEqualTo("type", "maintenance_due")
                                        .WhereEqualTo("listingId", maintenance.ItemId)
                                        .WhereEqualTo("dismissed", false)
                                        .GetSnapshotAsync();

                                    if (existingNotification.Documents.Count == 0)
                                    {
                                        await db.Collection("notifications").Document(notification.Id).SetAsync(notification);
                                        notificationsCreated++;
                                    }

                                    dueMaintenance.Add(new
                                    {
                                        maintenanceId       = maintenance.Id,
                                        itemId              = maintenance.ItemId,
                                        itemTitle           = item.Title,
                                        description         = maintenance.Description,
                                        frequency           = maintenance.Frequency,
                                        lastMaintenanceDate = maintenance.LastMaintenanceDate,
                                        nextDueDate         = nextDueDate,
                                        ownerId             = item.UserId
                                    });
                                }
                            }
                        }
                    }

                    return Results.Ok(new
                    {
                        message = $"Checked {maintenanceSnaps.Count} maintenance records",
                        dueCount = dueMaintenance.Count,
                        notificationsCreated = notificationsCreated,
                        dueMaintenance = dueMaintenance
                    });
                }
                catch (Exception ex)
                {
                    return Results.Problem($"Error checking due maintenance: {ex.Message}");
                }
            })
            .WithName("CheckDueMaintenance")
            .WithTags("Maintenance")
            .Produces(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "Check for due maintenance and create notifications";
                op.Description =
                    "Checks all required maintenance records using nextMaintenanceDate when available; " +
                    "falls back to (lastMaintenanceDate ?? CreatedUtc) + frequency. " +
                    "Creates notifications for owners when maintenance is due (within 1 day).";
                return op;
            });


            // -------- Reviews --------

            // GET /reviews/user/{userId} — all reviews written about a specific user
            app.MapGet("/reviews/user/{userId}", async (FirestoreDb db, string userId) =>
            {
                var snaps = await db.Collection("review")
                                    .WhereEqualTo("userID", userId)
                                    .GetSnapshotAsync();

                var reviews = snaps.Select(s => s.ConvertTo<Review>())
                       .OrderByDescending(r => r.CreatedUtc);  

                return Results.Ok(reviews);
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
                    Description = desc,
                    CreatedUtc  = DateTime.UtcNow
                };

                await db.Collection("review").Document(review.Id).SetAsync(review);
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


            // PUT /reviews/{id} — partial update: rating and/or description
            app.MapPut("/reviews/{id}", async (FirestoreDb db, string id, [FromBody] UpdateReviewPartialDto dto) =>
            {
                var docRef = db.Collection("review").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var updates = new Dictionary<string, object>();

                if (dto.Rating.HasValue)
                {
                    if (dto.Rating.Value <= 0)
                        return Results.BadRequest(new { message = "rating must be > 0" });
                    updates["Rating"] = dto.Rating.Value;
                }

                if (dto.Description is not null)
                {
                    var desc = dto.Description.Trim();
                    if (string.IsNullOrWhiteSpace(desc))
                        return Results.BadRequest(new { message = "description cannot be empty" });
                    updates["description"] = desc;
                }

                if (updates.Count == 0)
                    return Results.BadRequest(new { message = "Provide at least one field to update: rating or description." });

                await docRef.UpdateAsync(updates);

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<Review>());
            })
            .WithName("UpdateReview")
            .WithTags("Reviews")
            .Accepts<UpdateReviewPartialDto>("application/json")
            .Produces<Review>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Partially update a review";
                op.Description = "Updates one or both fields (rating, description) for the specified review.";
                return op;
            });


            // DELETE /reviews/{id} — delete a review by id
            app.MapDelete("/reviews/{id}", async (FirestoreDb db, string id) =>
            {
                var docRef = db.Collection("review").Document(id);
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


            // POST /documents - with optional photo upload
            app.MapPost("/documents",
            async (HttpRequest request,
                [FromServices] FirestoreDb db,
                [FromServices] StorageClient storage) =>
            {
                if (!request.HasFormContentType)
                    return Results.BadRequest(new { error = "Must be multipart/form-data" });

                var form = await request.ReadFormAsync();

                // NOTE: Read "Description" with capital D to match your Firestore field naming choice
                var maintenanceId = form["maintenanceId"].ToString();
                var description = form["Description"].ToString(); // <-- capital D
                var file = form.Files.GetFile("file");

                if (string.IsNullOrWhiteSpace(maintenanceId) || string.IsNullOrWhiteSpace(description))
                    return Results.BadRequest(new { error = "maintenanceId and Description are required." });

                string? documentUrl = null;

                // Optional: upload photo if provided
                if (file is not null && file.Length > 0)
                {
                    var isImg = IsImage(file);
                    if (!isImg)
                        return Results.BadRequest(new { error = "Only image files are allowed for documents." });

                    const string bucket = "hippo-exchange-media";
                    var ext = Path.GetExtension(file.FileName);
                    if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

                    var objectName = $"documents/{maintenanceId}/{Guid.NewGuid()}{ext}";
                    var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "image/jpeg" : file.ContentType;

                    await using (var stream = file.OpenReadStream())
                        await storage.UploadObjectAsync(bucket, objectName, contentType, stream);

                    documentUrl = $"https://storage.googleapis.com/{bucket}/{objectName}";
                }

                var doc = new DocumentEntry
                {
                    Id = Guid.NewGuid().ToString("n"),
                    MaintenanceId = maintenanceId.Trim(),
                    Description = description.Trim(),      // <-- capital D property
                    DocumentContent = documentUrl ?? "",
                    CreatedUtc = DateTime.UtcNow
                };

                await db.Collection("Document").Document(doc.Id).SetAsync(doc);
                return Results.Created($"/documents/{doc.Id}", doc);
            })
            .WithName("CreateDocument")
            .WithTags("Documents")
            .DisableAntiforgery()
            .Produces<DocumentEntry>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a document entry with optional photo";
                op.Description = "Creates a new document in the Document collection. Optionally uploads a photo to GCS and stores its public URL.";

                // Swagger: multipart/form-data body with "Description" (capital D)
                op.RequestBody = new Microsoft.OpenApi.Models.OpenApiRequestBody
                {
                    Required = true,
                    Content = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>
                    {
                        ["multipart/form-data"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                        {
                            Schema = new Microsoft.OpenApi.Models.OpenApiSchema
                            {
                                Type = "object",
                                Properties = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiSchema>
                                {
                                    ["maintenanceId"] = new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string" },
                                    ["Description"] = new Microsoft.OpenApi.Models.OpenApiSchema { Type = "string" }, // <-- capital D
                                    ["file"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string",
                                        Format = "binary",
                                        Nullable = true,
                                        Description = "Optional document photo"
                                    }
                                },
                                Required = new HashSet<string> { "maintenanceId", "Description" } // <-- capital D
                            }
                        }
                    }
                };

                return op;
            });


            // PUT /documents/{id} - partial update with optional photo
            app.MapPut("/documents/{id}",
            async (HttpRequest request,
                string id,
                [FromServices] FirestoreDb db,
                [FromServices] StorageClient storage) =>
            {
                if (!request.HasFormContentType)
                    return Results.BadRequest(new { error = "Must be multipart/form-data" });

                id = (id ?? "").Trim();
                if (id.Length == 0) return Results.BadRequest(new { error = "Invalid id." });

                var form = await request.ReadFormAsync();

                // Accept either "Description" or "description" from the form; prefer capital D
                var description = form["Description"].ToString();
                if (string.IsNullOrWhiteSpace(description))
                    description = form["description"].ToString();

                var file = form.Files.GetFile("file");

                var docRef = db.Collection("Document").Document(id);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                var updates = new Dictionary<string, object>();

                // Update Description if provided
                if (!string.IsNullOrWhiteSpace(description))
                    updates["Description"] = description.Trim(); // <-- correct Firestore field name

                // Update photo if provided
                if (file is not null && file.Length > 0)
                {
                    if (!IsImage(file))
                        return Results.BadRequest(new { error = "Only image files are allowed for documents." });

                    var current = snap.ConvertTo<DocumentEntry>();
                    const string bucket = "hippo-exchange-media";
                    var ext = Path.GetExtension(file.FileName);
                    if (string.IsNullOrWhiteSpace(ext)) ext = ".jpg";

                    var objectName = $"documents/{current.MaintenanceId}/{Guid.NewGuid()}{ext}";
                    var contentType = string.IsNullOrWhiteSpace(file.ContentType) ? "image/jpeg" : file.ContentType;

                    await using (var stream = file.OpenReadStream())
                        await storage.UploadObjectAsync(bucket, objectName, contentType, stream);

                    var documentUrl = $"https://storage.googleapis.com/{bucket}/{objectName}";
                    updates["Document"] = documentUrl;     // <-- match what POST writes
                }

                if (updates.Count == 0)
                    return Results.BadRequest(new { error = "No fields to update." });

                await docRef.UpdateAsync(updates);

                var updated = await docRef.GetSnapshotAsync();
                return Results.Ok(updated.ConvertTo<DocumentEntry>());
            })
            .WithName("UpdateDocument")
            .WithTags("Documents")
            .DisableAntiforgery()
            .Produces<DocumentEntry>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Update a document entry (partial)";
                op.Description = "Partially updates Description and/or document photo. Uploads a new photo to GCS if provided and stores its public URL.";

                op.RequestBody = new Microsoft.OpenApi.Models.OpenApiRequestBody
                {
                    Required = true,
                    Content = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>
                    {
                        ["multipart/form-data"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                        {
                            Schema = new Microsoft.OpenApi.Models.OpenApiSchema
                            {
                                Type = "object",
                                Properties = new Dictionary<string, Microsoft.OpenApi.Models.OpenApiSchema>
                                {
                                    // Show capital-D since that’s the Firestore field you persist
                                    ["Description"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string",
                                        Nullable = true
                                    },
                                    ["file"] = new Microsoft.OpenApi.Models.OpenApiSchema
                                    {
                                        Type = "string",
                                        Format = "binary",
                                        Nullable = true,
                                        Description = "Optional replacement document photo"
                                    }
                                }
                                // No required fields -> partial updates allowed
                            }
                        }
                    }
                };

                return op;
            });


            // DELETE /documents/{documentId}
            app.MapDelete("/documents/{documentId}", async (FirestoreDb db, string documentId) =>
            {
                var docRef = db.Collection("Document").Document(documentId);
                var snap = await docRef.GetSnapshotAsync();

                if (!snap.Exists) return Results.NotFound(new { error = "Document not found." });

                await docRef.DeleteAsync();
                return Results.NoContent();
            })
            .WithName("DeleteDocument")
            .WithTags("Documents")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Delete a document entry";
                op.Description = "Deletes a single document (photo) by its document ID.";
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

            app.MapGet("/users/{userId}/claims", async (FirestoreDb db, string userId) =>
            {
                var snap = await db.Collection("users").Document(userId).GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { message = "User not found." });

                var user = snap.ConvertTo<UserAuth>();
                var claimsHelper = new UserClaims
                {
                    Id = user.Id ?? string.Empty,
                    Email = user.Email ?? string.Empty,
                    FirstName = user.FirstName ?? string.Empty,
                    LastName = user.LastName ?? string.Empty,
                    Phone = user.Phone ?? string.Empty
                };

                var claims = claimsHelper.BuildClaims();

                var result = claims.Select(c => new { Type = c.Type, Value = c.Value });
                return Results.Ok(result);
            })
            .WithName("GetUserClaims")
            .WithTags("Users")
            .Produces<IEnumerable<object>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "Get user claims";
                op.Description = "Returns a list of identity claims (ID, email, first name, last name, phone) for the specified user.";
                return op;
            });


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
                    
                    // Generate JWT token for new user
                    var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured.");
                    var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "HippoExchange";
                    var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "HippoExchangeUsers";
                    var expiryMinutes = int.Parse(builder.Configuration["Jwt:ExpiryMinutes"] ?? "60");
                    
                    var token = GenerateJwtToken(user, jwtKey, jwtIssuer, jwtAudience, expiryMinutes);
                    
                    return Results.Created($"/users/{user.Id}", new
                    {
                        user.Id,
                        user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        Token = token
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

                    // Generate JWT token
                    var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not configured.");
                    var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "HippoExchange";
                    var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "HippoExchangeUsers";
                    var expiryMinutes = int.Parse(builder.Configuration["Jwt:ExpiryMinutes"] ?? "60");

                    var token = GenerateJwtToken(user, jwtKey, jwtIssuer, jwtAudience, expiryMinutes);

                    return Results.Ok(new
                    {
                        user.Id,
                        user.Email,
                        FirstName = user.FirstName,
                        LastName = user.LastName,
                        Token = token
                    });
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
            
            app.MapGet("/auth/me", async (ClaimsPrincipal user, HttpContext context, FirestoreDb db) =>
            {
                // Debug logging
                var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
                Console.WriteLine($"[DEBUG] /auth/me called - Auth header: {authHeader?.Substring(0, Math.Min(20, authHeader?.Length ?? 0))}...");
                Console.WriteLine($"[DEBUG] User authenticated: {user?.Identity?.IsAuthenticated}");
                Console.WriteLine($"[DEBUG] User identity name: {user?.Identity?.Name}");
                
                if (user?.Identity?.IsAuthenticated != true)
                {
                    Console.WriteLine("[DEBUG] User not authenticated, returning 401");
                    return Results.Unauthorized();
                }

                var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId))
                {
                    Console.WriteLine("[DEBUG] No user ID found in claims, returning 401");
                    return Results.Unauthorized();
                }

                try
                {
                    // Fetch complete user data from Firestore
                    var userDoc = await db.Collection("users").Document(userId).GetSnapshotAsync();
                    if (!userDoc.Exists)
                    {
                        Console.WriteLine($"[DEBUG] User document not found for ID: {userId}");
                        return Results.NotFound();
                    }

                    var userData = userDoc.ConvertTo<UserAuth>();
                    Console.WriteLine($"[DEBUG] Fetched user data from Firestore for: {userData.Email}");
                    
                    var result = new
                    {
                        Id = userData.Id,
                        Email = userData.Email,
                        FirstName = userData.FirstName,
                        LastName = userData.LastName,
                        Phone = userData.Phone,
                        ProfilePicture = userData.ProfilePicture
                    };
                    
                    Console.WriteLine($"[DEBUG] Returning complete user data for: {result.Email}");
                    return Results.Ok(result);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[DEBUG] Error fetching user data: {ex.Message}");
                    // Fallback to JWT claims if Firestore fails
                    var fallbackResult = new
                    {
                        Id = user.FindFirst(ClaimTypes.NameIdentifier)?.Value,
                        Email = user.FindFirst(ClaimTypes.Email)?.Value,
                        FirstName = user.FindFirst(ClaimTypes.GivenName)?.Value,
                        LastName = user.FindFirst(ClaimTypes.Surname)?.Value,
                        Phone = user.FindFirst("phone")?.Value,
                        ProfilePicture = (string?)null
                    };
                    
                    Console.WriteLine($"[DEBUG] Returning fallback user data for: {fallbackResult.Email}");
                    return Results.Ok(fallbackResult);
                }
            }).RequireAuthorization().WithName("GetCurrentUser");

            // -------- Messaging --------

            // GET /messages/threads?userId=...&filter=all|unread|starred|archived|active[&itemId=...]
            app.MapGet("/messages/threads", async (FirestoreDb db, string userId, string? filter, string? itemId) =>
            {
                if (string.IsNullOrWhiteSpace(userId)) return Results.BadRequest(new { error = "userId required" });

                // Get all threads and filter in memory to avoid index requirements
                var q = db.Collection("messageThreads").Limit(100);
                var snaps = await q.GetSnapshotAsync();
                var allThreads = snaps.Select(s =>
                {
                    var t = s.ConvertTo<MessageThread>();
                    t.Id = s.Id;       // ensure Id is populated for clients
                    return t;
                }).ToList();

                // Filter threads where user is a participant
                var threads = allThreads.Where(t => t.Participants?.Contains(userId) == true).ToList();

                // Optional: narrow to a specific item
                if (!string.IsNullOrWhiteSpace(itemId))
                    threads = threads.Where(t => string.Equals(t.ItemId, itemId, StringComparison.Ordinal)).ToList();

                // Sort in memory
                threads = threads.OrderByDescending(t => t.UpdatedUtc).ToList();

                filter = (filter ?? "all").ToLowerInvariant();
                if (filter == "starred")
                    threads = threads.Where(t => t.StarredBy?.Contains(userId) == true).ToList();
                else if (filter == "unread")
                    threads = threads.Where(t => !t.LastReadBy.TryGetValue(userId, out var last) || t.UpdatedUtc > last).ToList();
                else if (filter == "archived")
                    threads = threads.Where(t => t.ArchivedParticipants?.Contains(userId) == true).ToList(); 
                else if (filter == "active")
                    threads = threads.Where(t => !(t.ArchivedParticipants?.Contains(userId) == true)).ToList(); 

                return Results.Ok(threads);
            })
            .WithName("GetMessageThreads")
            .WithTags("Messaging")
            .Produces<List<MessageThread>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "List message threads for a user";
                op.Description = "Returns up to 100 threads for the user. filter=(all|unread|starred|archived|active), itemId (restrict to a specific item). Sorting & filtering are done in-memory.";
                return op;
            });


            // GET /messages/threads/{threadId}/messages
            app.MapGet("/messages/threads/{threadId}/messages", async (FirestoreDb db, string threadId) =>
            {
                var threadRef = db.Collection("messageThreads").Document(threadId);
                var threadSnap = await threadRef.GetSnapshotAsync();
                if (!threadSnap.Exists) return Results.NotFound();

                var msgsSnap = await threadRef.Collection("messages")
                                            .OrderBy("sentUtc")
                                            .Limit(500)
                                            .GetSnapshotAsync();

                var msgs = msgsSnap.Select(s => s.ConvertTo<MessageDoc>()).ToList();
                return Results.Ok(msgs);
            })
            .WithName("GetThreadMessages")
            .WithTags("Messaging")
            .Produces<List<MessageDoc>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .WithOpenApi(op =>
            {
                op.Summary = "List messages in a thread";
                op.Description = "Returns messages for the specified thread ordered by sentUtc.";
                return op;
            });


            // GET /users/by-email
            app.MapGet("/users/by-email", async (FirestoreDb db, string email) =>
            {
                if (string.IsNullOrWhiteSpace(email)) return Results.BadRequest(new { error = "email required" });
                var e = email.Trim().ToLowerInvariant();

                var snaps = await db.Collection("users")
                                    .WhereEqualTo("Email", e)
                                    .Limit(1)
                                    .GetSnapshotAsync();

                if (snaps.Count == 0) return Results.NotFound(new { error = "user not found" });

                var u = snaps[0].ConvertTo<UserAuth>();
                u.Id = snaps[0].Id; // ensure Id populated
                return Results.Ok(new { id = u.Id, email = u.Email, firstName = u.FirstName, lastName = u.LastName });
            })
            .WithName("GetUserByEmail")
            .WithTags("Users")
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status200OK)
            .WithOpenApi(op =>
            {
                op.Summary = "Find a user by email";
                op.Description = "Returns a minimal user record (id, email, firstName, lastName) for the given email.";
                return op;
            });


            // POST /messages/threads  { participantIds: [meId, themId], itemId, subject? }
            // returns the existing thread if it already exists (same participants + item), otherwise creates it.
            app.MapPost("/messages/threads", async (FirestoreDb db, CreateThreadDto dto) =>
            {
                if (dto.ParticipantIds is null || dto.ParticipantIds.Count < 2)
                    return Results.BadRequest(new { error = "At least 2 participantIds are required" });

                if (string.IsNullOrWhiteSpace(dto.ItemId))
                    return Results.BadRequest(new { error = "itemId is required" });

                // Canonical key now includes the item as well as all participants
                var canon = CanonicalKeyFor(dto.ParticipantIds.Concat(new[] { dto.ItemId }).ToArray());

                // Find existing (participants + item)
                var existing = await db.Collection("messageThreads")
                                    .WhereEqualTo("canonicalKey", canon)
                                    .Limit(1)
                                    .GetSnapshotAsync();

                if (existing.Count > 0)
                {
                    var t = existing[0].ConvertTo<MessageThread>();
                    t.Id = existing[0].Id;
                    return Results.Ok(t);
                }

                // Create new
                var thread = new MessageThread
                {
                    Participants = dto.ParticipantIds.Distinct(StringComparer.Ordinal).ToList(),
                    CanonicalKey = canon,
                    Subject = dto.Subject?.Trim(),
                    UpdatedUtc = DateTime.UtcNow,
                    LastMessagePreview = null,
                    LastReadBy = new(),
                    StarredBy = new(),
                    ArchivedParticipants = new(),
                    ItemId = dto.ItemId.Trim()
                };

                var added = await db.Collection("messageThreads").AddAsync(thread);
                thread.Id = added.Id;
                return Results.Created($"/messages/threads/{thread.Id}", thread);
            })
            .WithName("CreateMessageThread")
            .WithTags("Messaging")
            .Accepts<CreateThreadDto>("application/json")
            .Produces<MessageThread>(StatusCodes.Status201Created)
            .Produces<MessageThread>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Create a thread or return an existing one";
                op.Description = "Creates a message thread by canonical participant set **and itemId**. If one exists already, returns it instead.";
                // Example body
                op.RequestBody ??= new Microsoft.OpenApi.Models.OpenApiRequestBody();
                op.RequestBody.Content ??= new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>();
                op.RequestBody.Content["application/json"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                {
                    Example = new OpenApiObject
                    {
                        ["participantIds"] = new OpenApiArray {
                            new OpenApiString("user_123"),
                            new OpenApiString("user_456")
                        },
                        ["itemId"] = new OpenApiString("item_abc123"),
                        ["subject"] = new OpenApiString("Questions about your drill press")
                    }
                };
                return op;
            });


            // POST /messages/threads/{threadId}/messages  { senderId, body }
            app.MapPost("/messages/threads/{threadId}/messages", async (FirestoreDb db, string threadId, SendMessageDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.SenderId) || string.IsNullOrWhiteSpace(dto.Body))
                    return Results.BadRequest(new { error = "senderId and body are required" });

                var threadRef = db.Collection("messageThreads").Document(threadId);
                var threadSnap = await threadRef.GetSnapshotAsync();
                if (!threadSnap.Exists) return Results.NotFound(new { error = "thread not found" });

                var msg = new MessageDoc
                {
                    SenderId = dto.SenderId.Trim(),
                    Body = dto.Body.Trim(),
                    SentUtc = DateTime.UtcNow
                };

                // add message
                await threadRef.Collection("messages").AddAsync(msg);

                // update thread preview + timestamp, and mark sender as 'read' up to now
                var updates = new Dictionary<string, object>
                {
                    ["lastMessagePreview"] = Preview(msg.Body),
                    ["updatedUtc"] = msg.SentUtc,
                    [$"lastReadBy.{msg.SenderId}"] = msg.SentUtc
                };
                await threadRef.UpdateAsync(updates);

                return Results.Ok(msg);
            })
            .WithName("SendMessageInThread")
            .WithTags("Messaging")
            .Produces<MessageDoc>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Send a message to a thread";
                op.Description = "Adds a message to the thread and updates lastMessagePreview/updatedUtc and lastReadBy for the sender.";
                return op;
            });


            // POST /messages/threads/{threadId}/read  { userId }
            app.MapPost("/messages/threads/{threadId}/read", async (FirestoreDb db, string threadId, MarkReadDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.UserId))
                    return Results.BadRequest(new { error = "userId required" });

                var threadRef = db.Collection("messageThreads").Document(threadId);
                var snap = await threadRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                await threadRef.UpdateAsync(new Dictionary<string, object>
                {
                    [$"lastReadBy.{dto.UserId}"] = DateTime.UtcNow
                });

                return Results.NoContent();
            })
            .WithName("MarkThreadRead")
            .WithTags("Messaging")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Mark a thread as read for a user";
                op.Description = "Sets lastReadBy[userId] to the current time.";
                return op;
            });

            // POST /messages/threads/{threadId}/archive  { userId, archived }
            app.MapPost("/messages/threads/{threadId}/archive", async (FirestoreDb db, string threadId, StarDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.UserId)) return Results.BadRequest(new { error = "userId required" });

                var threadRef = db.Collection("messageThreads").Document(threadId);
                var snap = await threadRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                if (dto.Starred)
                    await threadRef.UpdateAsync("archivedBy", FieldValue.ArrayUnion(dto.UserId));
                else
                    await threadRef.UpdateAsync("archivedBy", FieldValue.ArrayRemove(dto.UserId));

                return Results.NoContent();
            })
            .WithName("ArchiveThread")
            .WithTags("Messaging")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Archive or unarchive a thread for a user";
                op.Description = "Adds or removes the userId from the archivedBy array on the thread.";
                return op;
            });



            // POST /messages/threads/{threadId}/star  { userId, starred }
            app.MapPost("/messages/threads/{threadId}/star", async (FirestoreDb db, string threadId, StarDto dto) =>
            {
                if (string.IsNullOrWhiteSpace(dto.UserId)) return Results.BadRequest(new { error = "userId required" });

                var threadRef = db.Collection("messageThreads").Document(threadId);
                var snap = await threadRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound();

                if (dto.Starred)
                    await threadRef.UpdateAsync("starredBy", FieldValue.ArrayUnion(dto.UserId));
                else
                    await threadRef.UpdateAsync("starredBy", FieldValue.ArrayRemove(dto.UserId));

                return Results.NoContent();
            })
            .WithName("StarThread")
            .WithTags("Messaging")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Star or unstar a thread for a user";
                op.Description = "Adds or removes the userId from the starredBy array on the thread.";
                return op;
            });


            // GET /users/by-id?id=...
            app.MapGet("/users/by-id", async (FirestoreDb db, string id) =>
            {
                if (string.IsNullOrWhiteSpace(id)) return Results.BadRequest(new { error = "id required" });

                var doc = await db.Collection("users").Document(id).GetSnapshotAsync();
                if (!doc.Exists) return Results.NotFound(new { error = "user not found" });

                var u = doc.ConvertTo<UserAuth>();
                u.Id = doc.Id;
                return Results.Ok(new
                {
                    id = u.Id, 
                    email = u.Email, 
                    firstName = u.FirstName, 
                    lastName = u.LastName,
                    name = $"{u.FirstName} {u.LastName}".Trim() 
                });
            })
            .WithName("GetUserById")
            .WithTags("Users")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.Summary = "Find a user by id";
                op.Description = "Returns a minimal user record (id, email, firstName, lastName, name) for the given id.";
                return op;
            });


            // PUT /messages/threads/{threadId}/archive   { "userId": "..." }
            app.MapPut("/messages/threads/{threadId}/archive", async (FirestoreDb db, string threadId, [FromBody] ArchiveParticipantDto dto) =>
            {
                if (dto is null || string.IsNullOrWhiteSpace(dto.UserId))
                    return Results.BadRequest(new { error = "userId required" });

                var docRef = db.Collection("messageThreads").Document(threadId);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { error = "thread not found" });

                // Idempotent add; do NOT touch updatedUtc
                await docRef.UpdateAsync("archivedParticipants", FieldValue.ArrayUnion(dto.UserId));

                return Results.NoContent();
            })
            .WithName("ArchiveThreadForUser")
            .WithTags("Messaging")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.OperationId = "ArchiveThreadForUser";
                op.Summary = "Archive a thread for a specific user";
                op.Description = "Adds userId to archivedParticipants using FieldValue.ArrayUnion (per-user archive).";
                op.RequestBody ??= new Microsoft.OpenApi.Models.OpenApiRequestBody();
                op.RequestBody.Content ??= new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>();
                op.RequestBody.Content["application/json"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                {
                    Example = new OpenApiObject { ["userId"] = new OpenApiString("user_123") }
                };
                return op;
            });


            // DELETE /messages/threads/{threadId}/archive   { "userId": "..." }
            app.MapDelete("/messages/threads/{threadId}/archive", async (FirestoreDb db, string threadId, [FromBody] ArchiveParticipantDto dto) =>
            {
                if (dto is null || string.IsNullOrWhiteSpace(dto.UserId))
                    return Results.BadRequest(new { error = "userId required" });

                var docRef = db.Collection("messageThreads").Document(threadId);
                var snap = await docRef.GetSnapshotAsync();
                if (!snap.Exists) return Results.NotFound(new { error = "thread not found" });

                // Idempotent remove; do NOT touch updatedUtc
                await docRef.UpdateAsync("archivedParticipants", FieldValue.ArrayRemove(dto.UserId));

                return Results.NoContent();
            })
            .WithName("UnarchiveThreadForUser")
            .WithTags("Messaging")
            .Produces(StatusCodes.Status204NoContent)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status400BadRequest)
            .WithOpenApi(op =>
            {
                op.OperationId = "UnarchiveThreadForUser";
                op.Summary = "Unarchive a thread for a specific user";
                op.Description = "Removes userId from archivedParticipants using FieldValue.ArrayRemove (per-user archive).";
                op.RequestBody ??= new Microsoft.OpenApi.Models.OpenApiRequestBody();
                op.RequestBody.Content ??= new Dictionary<string, Microsoft.OpenApi.Models.OpenApiMediaType>();
                op.RequestBody.Content["application/json"] = new Microsoft.OpenApi.Models.OpenApiMediaType
                {
                    Example = new OpenApiObject { ["userId"] = new OpenApiString("user_123") }
                };
                return op;
            });

            app.Run();
        }

        // Helper method to update user counters when exchanges are approved
        private static async Task UpdateUserCounters(FirestoreDb db, string ownerId, string borrowerId, bool isApproved)
        {
            try
            {
                if (isApproved)
                {
                    // Update owner's TotalLended counter
                    var ownerDoc = db.Collection("users").Document(ownerId);
                    var ownerSnap = await ownerDoc.GetSnapshotAsync();
                    if (ownerSnap.Exists)
                    {
                        var owner = ownerSnap.ConvertTo<UserAuth>();
                        if (owner != null)
                        {
                            await ownerDoc.UpdateAsync("TotalLended", owner.TotalLended + 1);
                        }
                    }

                    // Update borrower's TotalBorrowed counter
                    var borrowerDoc = db.Collection("users").Document(borrowerId);
                    var borrowerSnap = await borrowerDoc.GetSnapshotAsync();
                    if (borrowerSnap.Exists)
                    {
                        var borrower = borrowerSnap.ConvertTo<UserAuth>();
                        if (borrower != null)
                        {
                            await borrowerDoc.UpdateAsync("TotalBorrowed", borrower.TotalBorrowed + 1);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // Log error but don't fail the exchange approval
                Console.WriteLine($"Error updating user counters: {ex.Message}");
            }
        }

        // Helper method to update user counters when items are returned
        private static Task UpdateUserCountersOnReturn(FirestoreDb db, string ownerId, string borrowerId)
        {
            try
            {
                // Note: We don't decrease counters on return since the exchange still counts as a completed transaction
                // The counters represent total lifetime exchanges, not current active exchanges
                // This method is here for future use if we want to track active vs completed exchanges
            }
            catch (Exception ex)
            {
                // Log error but don't fail the return process
                Console.WriteLine($"Error updating user counters on return: {ex.Message}");
            }
            return Task.CompletedTask;
        }
    }

    // ---------------- Models ----------------
    
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

        [FirestoreProperty("approved")] public bool? Approved { get; set; } = null;

        [FirestoreProperty("borrowerID")] public string BorrowerId { get; set; } = default!;

        [FirestoreProperty("ownerID")] public string OwnerId { get; set; } = default!;

        [FirestoreProperty("itemID")] public string ItemId { get; set; } = default!;

        [FirestoreProperty("startDate")] public DateTime? StartDate { get; set; }

        [FirestoreProperty("endDate")] public DateTime? EndDate { get; set; }

        [FirestoreProperty("requestCreated")] public DateTime RequestCreated { get; set; }

        [FirestoreProperty("requestHandled")] public DateTime? RequestHandled { get; set; }

        [FirestoreProperty("title")] public string Title { get; set; } = default!;

        [FirestoreProperty("type")] public string Type { get; set; } = default!;

        [FirestoreProperty("dismissed")] public bool? Dismissed { get; set; } = false;

        [FirestoreProperty("earlyReturnApproved")] public bool? EarlyReturnApproved { get; set; } = null;

        [FirestoreProperty("returnPendingConfirmation")] public bool? ReturnPendingConfirmation { get; set; } = null;

        [FirestoreProperty("returnRequestedAt")] public DateTime? ReturnRequestedAt { get; set; } = null;

        [FirestoreProperty("returnConfirmed")] public bool? ReturnConfirmed { get; set; } = null;

        [FirestoreProperty("returnConfirmedAt")] public DateTime? ReturnConfirmedAt { get; set; } = null;

        // Additional properties for calendar display (not stored in Firestore)
        public string? BorrowerName { get; set; }
        public string? OwnerName { get; set; }
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

        [FirestoreProperty("dismissed")] public bool? Dismissed { get; set; } = false;

        [FirestoreProperty("earlyReturnApproved")] public bool? EarlyReturnApproved { get; set; } = null;
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

        [FirestoreProperty("frequency")] public int? Frequency { get; set; }

        [FirestoreProperty("maintenanceHistory")] public List<DateTime> MaintenanceHistory { get; set; } = new();

        [FirestoreProperty("nextMaintenanceDate")] public DateTime? NextMaintenanceDate { get; set; }

        [FirestoreProperty("lastMaintenanceDate")] public DateTime? LastMaintenanceDate { get; set; }

        [FirestoreProperty("type")] public string? Type { get; set; }

        [FirestoreProperty("category")] public string? Category { get; set; }
    }


    [FirestoreData]
    public class DocumentEntry
    {
        [FirestoreDocumentId] public string? Id { get; set; }

        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }

        [FirestoreProperty("Description")] public string Description { get; set; } = default!;

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

        [FirestoreProperty("CreatedUtc")] public DateTime CreatedUtc { get; set; }
    }


    [FirestoreData]
    public class MessageThread
    {
        [FirestoreDocumentId] public string? Id { get; set; }

        [FirestoreProperty("participants")] public List<string> Participants { get; set; } = new();

        [FirestoreProperty("canonicalKey")] public string CanonicalKey { get; set; } = default!;

        [FirestoreProperty("subject")] public string? Subject { get; set; }

        [FirestoreProperty("lastMessagePreview")] public string? LastMessagePreview { get; set; }

        [FirestoreProperty("updatedUtc")] public DateTime UpdatedUtc { get; set; }

        [FirestoreProperty("lastReadBy")] public Dictionary<string, DateTime> LastReadBy { get; set; } = new();

        [FirestoreProperty("starredBy")] public List<string> StarredBy { get; set; } = new();

        [FirestoreProperty("itemID")] public string ItemId { get; set; } = default!;

        [FirestoreProperty("archivedParticipants")] public List<string> ArchivedParticipants { get; set; } = new();
    }


    [FirestoreData]
    public class MessageDoc
    {
        [FirestoreDocumentId] public string? Id { get; set; }
        [FirestoreProperty("senderId")] public string SenderId { get; set; } = default!;
        [FirestoreProperty("body")] public string Body { get; set; } = default!;
        [FirestoreProperty("sentUtc")] public DateTime SentUtc { get; set; }
    }


    public class UserClaims
    {
        public string Id { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;

        public List<Claim> BuildClaims()
        {
            return new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, Id ?? string.Empty),
                new Claim(ClaimTypes.Email, Email ?? string.Empty),
                new Claim(ClaimTypes.GivenName, FirstName ?? string.Empty),
                new Claim(ClaimTypes.Surname, LastName ?? string.Empty),
                new Claim("phone", Phone ?? string.Empty)
            };
        }
    }

    // ---- Auth DTOs + Firestore model (with password hash) ----
    public record AuthRegisterDto(string Email, string Phone, string FirstName, string LastName, string Password);
    public record AuthLoginDto(string Email, string Password);
    public sealed class UpdateUserForm
    {
        [FromForm(Name = "file")] public IFormFile? File { get; set; }           // optional image
        [FromForm] public string? FirstName { get; set; }                         // optional
        [FromForm] public string? LastName { get; set; }                          // optional
        [FromForm] public string? PhoneNumber { get; set; }                       // optional
        [FromForm] public string? Description { get; set; }                       // optional
    }
    
    // ---- Exchange DTOs ----
    public record CreateExchangeDto(string OwnerId, string BorrowerId, string ItemId, DateTime? StartDate = null, DateTime? EndDate = null);
    public sealed class UpdateExchangeApprovalDto
    {
        public bool? Approved { get; set; }
        public DateTime? StartDate { get; set; }  // allow null when declining
        public DateTime? EndDate { get; set; }    // allow null when declining
    }

    public sealed class EarlyReturnApprovalDto
    {
        public bool Approved { get; set; }
    }

    public sealed class ConfirmReturnDto
    {
        public bool Confirmed { get; set; }
    }


    // ---- Notification DTOs ----
    public record CreateNotificationDto(string SenderId, string ReceiverId, string Message, string Title, string Type, string? ListingId = null, string? SenderAvatar = null);


    // ---- Listings DTOs ----
    public record CreateListingDto(string ItemId, string UserId);


    // ---- Maintenance DTOs ----
    public record CreateMaintenanceDto
    (
        string ItemId,
        string Description,
        int? Frequency,
        string? Type,
        string? Category,
        DateTime? LastMaintenanceDate = null
    );


    public record UpdateMaintenanceDto
    (
        string? Description,
        int? Frequency,
        string? Type,
        List<DateTime>? MaintenanceHistory,
        DateTime? LastMaintenanceDate,
        bool LastMaintenanceDateExplicitlyNull = false,
        string? Category = null
    );  


    // ---- DocumentEntry DTOs ----
    public record CreateDocumentDto(string MaintenanceId, string Description, string Document);
    public record UpdateDocumentDto(string? Description, string? Document);
    

    // ---- Review DTOs ----
    public record CreateReviewDto(int Rating, string RaterId, string UserId, string Description);
    public sealed class UpdateReviewPartialDto
    {
        public int? Rating { get; set; }         // optional
        public string? Description { get; set; } // optional
    }


    // ---- Messaging DTOs ----
    public record CreateThreadDto(List<string> ParticipantIds, string ItemId, string? Subject);
    public record SendMessageDto(string SenderId, string Body);
    public record MarkReadDto(string UserId);
    public record StarDto(string UserId, bool Starred);
    public record ArchiveParticipantDto(string UserId);

    // Background service for maintenance notifications
    public class MaintenanceNotificationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MaintenanceNotificationService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(6); // Check every 6 hours

        public MaintenanceNotificationService(IServiceProvider serviceProvider, ILogger<MaintenanceNotificationService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Maintenance Notification Service started");
            
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    _logger.LogInformation("Checking for due maintenance notifications...");
                    
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var db = scope.ServiceProvider.GetRequiredService<FirestoreDb>();
                        
                        // Call the maintenance check endpoint
                        var httpClient = new HttpClient();
                        var response = await httpClient.PostAsync("http://localhost:5000/maintenance/check-due", null, stoppingToken);
                        
                        if (response.IsSuccessStatusCode)
                        {
                            var result = await response.Content.ReadAsStringAsync();
                            _logger.LogInformation($"Maintenance check completed: {result}");
                        }
                        else
                        {
                            _logger.LogWarning($"Maintenance check failed: {response.StatusCode}");
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    // Expected when cancellation is requested
                    _logger.LogInformation("Maintenance Notification Service is stopping");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error checking maintenance notifications");
                }

                try
                {
                    await Task.Delay(_checkInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Expected when cancellation is requested
                    _logger.LogInformation("Maintenance Notification Service is stopping");
                    break;
                }
            }
        }
    }

    // Background service for return date notifications
    public class ReturnDateNotificationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ReturnDateNotificationService> _logger;
        private readonly TimeSpan _checkInterval = TimeSpan.FromHours(6); // Check every 6 hours

        public ReturnDateNotificationService(IServiceProvider serviceProvider, ILogger<ReturnDateNotificationService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Return Date Notification Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CheckForUpcomingReturnDates();
                }
                catch (OperationCanceledException)
                {
                    // Expected when cancellation is requested
                    _logger.LogInformation("Return Date Notification Service is stopping");
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while checking for upcoming return dates");
                }

                try
                {
                    await Task.Delay(_checkInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Expected when cancellation is requested
                    _logger.LogInformation("Return Date Notification Service is stopping");
                    break;
                }
            }
        }

        private async Task CheckForUpcomingReturnDates()
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<FirestoreDb>();

            try
            {
                // Query approved exchanges, then filter by date range in-memory (no composite index required)
                var tomorrow = DateTime.UtcNow.AddDays(1);
                var twoDaysFromNow = DateTime.UtcNow.AddDays(2);

                var exchangesSnapshot = await db.Collection("exchanges")
                    .WhereEqualTo("approved", true)
                    .GetSnapshotAsync();

                var upcomingExchanges = exchangesSnapshot
                    .Where(doc => 
                    {
                        var exchange = doc.ConvertTo<Exchange>();
                        return exchange?.EndDate != null && 
                               exchange.EndDate >= tomorrow && 
                               exchange.EndDate <= twoDaysFromNow;
                    })
                    .ToList();

                _logger.LogInformation("Found {Count} exchanges with upcoming return dates", upcomingExchanges.Count);

                foreach (var exchangeDoc in upcomingExchanges)
                {
                    var exchange = exchangeDoc.ConvertTo<Exchange>();
                    if (exchange?.EndDate == null) continue;

                    // Rate-limit: skip if a recent reminder was sent in last 24h
                    var existingNotification = await db.Collection("notifications")
                        .WhereEqualTo("receiverID", exchange.BorrowerId)
                        .WhereEqualTo("type", "return_reminder")
                        .WhereEqualTo("listingID", exchange.ItemId)
                        .GetSnapshotAsync();

                    if (existingNotification.Count > 0)
                    {
                        var recent = existingNotification.Documents.FirstOrDefault(d =>
                            {
                            var n = d.ConvertTo<Notification>();
                            return n.CreatedUtc > DateTime.UtcNow.AddDays(-1);
                            });
                        if (recent != null) continue;
                    }

                    // Fetch item for a nice message
                    var itemDoc = await db.Collection("items").Document(exchange.ItemId).GetSnapshotAsync();
                    if (!itemDoc.Exists) continue;

                    var item = itemDoc.ConvertTo<Item>();
                    if (item == null) continue;

                    // Create and store the notification
                    var notification = new Notification
                    {
                        Id = Guid.NewGuid().ToString("n"),
                        CreatedUtc = DateTime.UtcNow,
                        SenderId = "system",
                        ReceiverId = exchange.BorrowerId,
                        Message = $"Your borrowed item '{item.Title}' is due for return on {exchange.EndDate.Value:MMM dd, yyyy}. Please make arrangements to return it.",
                        Title = "Return Date Reminder",
                        Type = "return_reminder",
                        ListingId = exchange.ItemId,
                        SenderAvatar = "hippo-exchange-logo.png",
                        Dismissed = false
                    };

                    await db.Collection("notifications").Document(notification.Id).SetAsync(notification);
                    _logger.LogInformation("Sent return reminder notification to user {UserId} for item {ItemTitle}",
                        exchange.BorrowerId, item.Title);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking for upcoming return dates");
            }
        }
    }

    
        
    

}