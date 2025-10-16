# HippoExchange 

**HippoExchange** is a full-stack web application designed to enable **peer-to-peer item sharing and exchange** within a trusted community. Built using **.NET 8 (Web API)** with **Google Cloud Firestore** for data storage and **Google Cloud Storage** for media hosting, the platform provides a secure and scalable backend for managing users, listings, and transactions.

The application supports a full lifecycle of exchanges — from **listing items** and **sending requests**, to **approvals**, **messaging**, and **early return handling** — all accessible through RESTful API endpoints and interactive documentation via Swagger UI.

---

## Features

### Authentication & Authorization
- JWT-based login and secure route access.
- Firebase Admin support for token validation.
- BCrypt password hashing for stored credentials.

### Users
- Create, update, and delete user profiles.
- Upload profile pictures to Google Cloud Storage.
- Role-safe deletion (prevents deleting users with active exchanges).

### Items
- Full CRUD operations (`/items`).
- Supports images and video attachments via GCS.
- Pagination, filtering by owner, and Firestore indexing.

### Exchanges
- Borrowing/lending management between users.
- Approvals, early-return handling, and conflict detection.
- Linked notification and message-thread creation.

### Messaging
- Automated conversation threads between borrower and owner.
- Real-time message creation upon approvals and return actions.
- Thread previews and unread tracking.

### Notifications
- Firestore-based alert system for:
  - Exchange approvals
  - Early return requests
  - Item return confirmations

### Swagger & Health Checks
- Auto-generated API docs via Swagger/OpenAPI.
- `/health` and `/health/firestore` endpoints for liveness checks.

---

## Tech Stack

| Layer | Technology |
|-------|-------------|
| Language | C# (.NET 8 Minimal API) |
| Database | Google Cloud Firestore |
| Media Storage | Google Cloud Storage |
| Auth | JWT + Firebase Admin SDK |
| Hosting | Kestrel / Cloud Run compatible |
| Config | `appsettings.json` + Environment Variables |

---

## Environment Configuration

| Variable | Description | Example |
|-----------|--------------|----------|
| `GOOGLE_CLOUD_PROJECT` | GCP Project ID | `group-13-capstone` |
| `FIRESTORE_DATABASE_ID` | Firestore DB name | `(default)` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | `/etc/secrets/service.json` |
| `Jwt:Key` | Symmetric signing key | `supersecretkey123` |
| `Jwt:Issuer` | JWT issuer | `HippoExchange` |
| `Jwt:Audience` | JWT audience | `HippoExchangeUsers` |

Make sure your service account file has **Firestore** and **Storage Admin** permissions.

---

## `appsettings.json` Configuration

Your backend project uses `appsettings.json` for local configuration of Google Cloud and JWT settings.  
This file should be placed in the backend root directory.

> ⚠️ **Important:** Never commit real credentials, service account JSON paths, or JWT keys to GitHub.  
> Use placeholders and store actual secrets as **environment variables** in deployment.

### Example Template

```json
{
  "GoogleCloud": {
    "ProjectId": "<your_project_id>",
    "DatabaseId": "(default)",
    "CredentialPath": "<absolute_path_to_service_account_json>"
  },
  "Jwt": {
    "Key": "<jwt_signing_key>",
    "Issuer": "HippoExchange",
    "Audience": "HippoExchangeUsers"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

### Field Reference

| Section | Key | Description |
|----------|-----|-------------|
| **GoogleCloud** | `ProjectId` | Your GCP project ID for Firestore and     Storage |
| **GoogleCloud** | `DatabaseId` | Firestore database name, usually `(default)` |
| **GoogleCloud** | `CredentialPath` | Path to the Google Cloud service account JSON file |
| **Jwt** | `Key` | Symmetric signing key for JWT authentication |
| **Jwt** | `Issuer` | Identifies the issuing authority for tokens |
| **Jwt** | `Audience` | Audience for which the token is intended |
| **Logging** | `LogLevel` | Controls verbosity for application logs |
| **AllowedHosts** | — | Defines which hosts are allowed (for Kestrel) |

### Local Development

### 1. Prerequisites
- [.NET SDK 8.0+](https://dotnet.microsoft.com/download)
- [Google Cloud SDK](https://cloud.google.com/sdk)
- Valid **service account JSON** with Firestore & Storage access.

### 2. Clone & Build
```bash
git clone https://github.com/<your-username>/HippoExchange.git
cd HippoExchange/backend
dotnet restore
dotnet build
```

### 3. Run the Server
```bash 
dotnet run
```

The API will start at:
```bash
http://localhost:5000
``` 

Access Swagger UI at:
```bash
http://localhost:5000/swagger
```
## Project structure 
```bash
hippo-exchange/
│
├── backend/
│ ├── Program.cs # Main API entry point (Minimal API configuration)
│ ├── appsettings.json # Local configuration (Firestore, JWT, etc.)
│ ├── wwwroot/ # Frontend static assets served by Kestrel
│ │ ├── about-us.html
│ │ ├── asset-hub.html / asset-hub.js
│ │ ├── calendar.html / calendar.js
│ │ ├── create-listing.html / create-listing.js
│ │ ├── forgot-password.html / forgot-password.js
│ │ ├── global-notifications.js
│ │ ├── hippo_clicker.html
│ │ ├── Home.html / home.js
│ │ ├── inbox.html / inbox.js
│ │ ├── listing.html / listing-api.js
│ │ ├── Login.html / login.v4.js
│ │ ├── notifications.html / notifications.js
│ │ ├── otheruser.html / otheruser.js
│ │ ├── profile.html / profile.js / profile-utils.js
│ │ ├── styles.css
│ │ └── hippo-exchange-logo.png
│ │
│ ├── bin/ 
│ ├── obj/ 
│ └── .gitignore 
│
├── BackEnd/wwwroot/ 
│ ├── forgot-password.html
│ ├── listing-api.js
│ └── terms-of-service.html
├── README.md 

```
---

### Notes

- **`Program.cs`** – Core application logic; configures Firestore, JWT, routes, and services.  
- **`wwwroot/`** – Contains all frontend HTML, JS, and CSS files served directly by Kestrel.  
- **`appsettings.json`** – Local development configuration.  
- **`Group-13-Web-Team.sln`** – Solution file for opening the project in Visual Studio.  
- **`README.md`** – Documentation for setup, configuration, and contribution.  

---

## Key Endpoints (Summary)

| Category | Method | Route | Description |
|-----------|---------|--------|-------------|
| **Health** | `GET` | `/health` | API status check |
| **Users** | `POST` | `/users` | Create new user |
| **Users** | `PUT` | `/users/{id}` | Update user info or photo |
| **Items** | `GET` | `/items` | List items (with pagination) |
| **Items** | `POST` | `/items` | Create a new item |
| **Media** | `POST` | `/media/uploadAndAttach` | Upload image/video |
| **Exchanges** | `POST` | `/exchanges` | Create exchange request |
| **Exchanges** | `PUT` | `/exchanges/{id}/approval` | Approve or decline an exchange |
| **Exchanges** | `PUT` | `/exchanges/{id}/early-return` | Approve early return |
| **Messages** | `POST` | `/messages` | Send message between users |

## License
```
MIT License  

Copyright (c) 2025  

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

**THE SOFTWARE IS PROVIDED "AS IS"**, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Contributors 

### Tennessee Technological University – CSC Capstone Group 13
#### Web
- Matt Hazelwood
- Jacob Hernando
- Joey Milton
- Justin Nelson
- Michael Serdar
- Vishnu Yadali 

#### Mobile
- 
-
-
-
-
-