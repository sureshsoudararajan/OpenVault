<p align="center">
  <img src="https://img.shields.io/badge/OpenVault-Cloud%20Storage-6366f1?style=for-the-badge&logo=icloud&logoColor=white" alt="OpenVault" />
</p>

<h1 align="center">🔐 OpenVault</h1>

<p align="center">
  <strong>Self-hostable, privacy-focused, open-source cloud storage platform</strong>
</p>

<p align="center">
  A production-grade alternative to Google Drive, Dropbox &amp; Nextcloud —<br/>
  with built-in collaboration, version control, file tagging, and end-to-end encryption.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#%EF%B8%8F-tech-stack">Tech Stack</a> •
  <a href="#-project-structure">Structure</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-docker-deployment">Docker</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-database-schema">Schema</a> •
  <a href="#-security-architecture">Security</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Fastify-5-000?style=flat-square&logo=fastify" alt="Fastify" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

---

## ✨ Features

### 📁 File Management
- **Upload & Download** — Multi-file uploads up to 5 GB each; up to 20 files per request
- **Chunked Uploads** — Powered by [Uppy](https://uppy.io/) with TUS protocol support and drag-and-drop support
- **Folder Hierarchy** — Nested folder tree with materialized path indexing for fast lookups
- **Grid / List View** — Toggle between card and table views with sortable columns
- **Rich File Preview** — In-browser preview for images, PDFs, videos, Markdown (rendered), DOCX (via Mammoth), and Excel/XLSX (via SheetJS)
- **Thumbnail Generation** — Automatic 256×256 WebP thumbnails for images; FFmpeg-powered video frame extraction at 1s mark
- **Trash & Restore** — Soft delete with 30-day retention; auto-purged by scheduled background worker at 3:00 AM daily
- **Drag & Move** — Move files between folders
- **Tags** — Create color-coded tags to label and organize files
- **File Metadata** — Background extraction of image EXIF metadata (dimensions, format, channels, density) stored as JSONB

### 🔗 Sharing & Collaboration
- **Public Share Links** — Generate token-based shareable URLs for any file or folder
- **Password Protection** — Secure shared links with Argon2id-hashed passwords
- **OTP Verification** — Optional 6-digit OTP code for shared links
- **Expiry & Download Limits** — Auto-expire links, set opens-at date, or cap total download count
- **Permission Control** — Viewer / Editor / Owner role-based sharing per file/folder, with optional expiry
- **Threaded Comments** — Add comments on files with nested reply threads
- **Activity Timeline** — Full audit trail of every action (upload, download, share, delete, dedup found)
- **Share Access Logs** — Per-link logs of view, download, OTP verify, and password verify events
- **Live Presence** — WebSocket-powered real-time user presence via `@fastify/websocket`

### 🔒 Security
- **AES-256-GCM Encryption** — Files encrypted at rest before being stored in MinIO
- **Distributed Key Model** — Each file's encryption key is split between a user fragment (encrypted with user passphrase) and a server fragment — both required to decrypt
- **Argon2id Passwords** — Memory-hard password hashing (64 MB memory, 3 iterations, 4-lane parallelism)
- **JWT + Refresh Rotation** — 15-minute access tokens with 7-day rotating refresh tokens stored as signed HttpOnly cookies
- **TOTP Multi-Factor Authentication** — Time-based OTP (RFC 6238) compatible with Google Authenticator, Authy, and 1Password; QR code provisioning included
- **MFA Recovery Codes** — Pre-generated one-time recovery codes for MFA bypass
- **RBAC** — Role-based access control: `admin`, `member`, `guest`
- **Rate Limiting** — 100 requests per minute per IP via `@fastify/rate-limit`
- **HTTP Security Headers** — Helmet.js with Content Security Policy in production
- **SHA-256 Integrity** — File hash computed on upload and stored; verified on re-download
- **Presigned Download URLs** — Time-limited MinIO presigned URLs — files never served directly through the API
- **Account Activation** — Email-based account activation flow with expiring tokens
- **Password Reset** — Time-limited password reset tokens delivered via SMTP

### 📧 Email (SMTP)
- Account activation emails
- Password reset emails
- Configurable SMTP (host, port, TLS, credentials)

### 🔐 OAuth2 Social Login
- **Google OAuth2** — Sign in with Google
- **GitHub OAuth2** — Sign in with GitHub

### 🧠 Smart Features
- **Deduplication Scanning** — Background SHA-256 hash comparison detects duplicate files per user; results logged to activity timeline
- **Version Control** — Git-like file versioning: every re-upload creates a new `FileVersion` record with change summary and rollback support
- **Full-Text Search** — MeiliSearch primary with automatic indexing; PostgreSQL `ILIKE` fallback
- **Background Processing** — BullMQ workers (concurrency-controlled) for: thumbnail generation, metadata extraction, dedup scanning, and trash cleanup
- **Storage Quota** — Per-user configurable storage quota (default 5 GB); tracks `storageUsed` in real time; incremented on upload, decremented on trash cleanup

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite 5, TypeScript 5.4 | Single-page application |
| **Styling** | TailwindCSS 3, `@tailwindcss/typography` | Utility-first CSS |
| **State** | Zustand 4 | Lightweight client state management |
| **Data Fetching** | TanStack React Query 5 | Server-state, caching & invalidation |
| **File Uploads** | Uppy 3 (XHR + TUS) | Chunked, resumable uploads with UI |
| **File Parsing** | Mammoth (DOCX), SheetJS XLSX, marked (MD) | In-browser document preview |
| **Icons** | Lucide React | Consistent icon library |
| **Backend** | Node.js 20, Fastify 5, TypeScript | High-performance API server |
| **Validation** | Zod | Runtime schema validation |
| **Database** | PostgreSQL 16 | Relational metadata & auth store |
| **ORM** | Prisma 6 | Type-safe database access & migrations |
| **Object Storage** | MinIO (S3-compatible) | File blob & thumbnail storage |
| **Search** | MeiliSearch v1.6 | Full-text search with typo-tolerance |
| **Cache & Queue** | Redis 7 + BullMQ 5 + IORedis | Background jobs & session caching |
| **Auth** | JWT (jsonwebtoken), Argon2, otplib | Auth, hashing, TOTP |
| **Email** | Nodemailer | Transactional email via SMTP |
| **Encryption** | AES-256-GCM (`@openvault/crypto`) | Client & server-side encryption |
| **Media** | Sharp (image resize/WebP), fluent-ffmpeg | Thumbnail & frame generation |
| **Real-time** | `@fastify/websocket` | Live presence & notifications |
| **DevOps** | Docker, Docker Compose | Containerized deployment |
| **CI/CD** | GitHub Actions | Lint, test, Docker build on push |

---

## 📁 Project Structure

```
OpenVault/                          # npm workspaces monorepo root
│
├── apps/
│   ├── api/                        # Fastify backend (@openvault/api)
│   │   ├── prisma/
│   │   │   ├── schema.prisma       #   14-model database schema
│   │   │   └── migrations/         #   Prisma migration history
│   │   └── src/
│   │       ├── app.ts              #   Fastify app factory & plugin registration
│   │       ├── index.ts            #   Server entrypoint
│   │       ├── db/                 #   Prisma client singleton
│   │       ├── storage/            #   MinIO abstraction (getObject, uploadObject, deleteObject)
│   │       ├── middleware/
│   │       │   └── auth.ts         #   JWT auth guard (verifyJWT decorator)
│   │       ├── jobs/
│   │       │   └── index.ts        #   BullMQ queue definitions & workers
│   │       └── modules/            #   Feature route modules
│   │           ├── auth/           #     Register, login, refresh, logout, MFA, OAuth
│   │           ├── users/          #     Profile, storage quota, settings
│   │           ├── files/          #     Upload, list, download, rename, move, trash, restore
│   │           ├── folders/        #     CRUD, folder tree
│   │           ├── versions/       #     File version history & rollback
│   │           ├── sharing/        #     Share links, OTP, permissions
│   │           ├── collaboration/  #     Comments, activity timeline
│   │           ├── search/         #     MeiliSearch + PostgreSQL fallback
│   │           ├── dedup/          #     Duplicate detection API
│   │           └── tags/           #     Tag CRUD & file tagging
│   │
│   └── web/                        # React frontend (@openvault/web)
│       └── src/
│           ├── App.tsx             #   React Router route tree
│           ├── layouts/
│           │   ├── AppShell.tsx    #   Authenticated shell (sidebar, header)
│           │   └── AuthLayout.tsx  #   Unauthenticated centered layout
│           ├── pages/
│           │   ├── DashboardPage.tsx    # Main file browser with grid/list view
│           │   ├── TrashPage.tsx        # Trash management
│           │   ├── SharedPage.tsx       # Items shared with me
│           │   ├── SettingsPage.tsx     # Profile, MFA, storage quota, theme
│           │   ├── ShareLinkPage.tsx    # Public share link access page
│           │   ├── LoginPage.tsx        # Login with OAuth + MFA support
│           │   ├── RegisterPage.tsx     # User registration
│           │   ├── ForgotPasswordPage.tsx
│           │   ├── ResetPasswordPage.tsx
│           │   └── ActivatePage.tsx     # Email activation
│           ├── components/
│           │   ├── FilePreview.tsx      # Multi-format file preview modal
│           │   ├── ShareDialog.tsx      # Share link creation & permission management
│           │   ├── DetailsDialog.tsx    # File/folder metadata panel
│           │   ├── TagDialog.tsx        # Tag management UI
│           │   ├── Thumbnail.tsx        # Lazy-loaded file thumbnail
│           │   └── UploadProgressPanel.tsx # Multi-file upload progress overlay
│           ├── stores/
│           │   ├── authStore.ts         # User auth state (Zustand)
│           │   ├── fileManagerStore.ts  # Current folder, selection, view mode
│           │   ├── uploadStore.ts       # Upload queue state
│           │   └── themeStore.ts        # Dark/light mode preference
│           └── services/
│               ├── api.ts              # Typed Axios API client for all endpoints
│               └── uploadManager.ts    # Uppy upload orchestration & progress events
│
├── packages/
│   ├── crypto/                     # @openvault/crypto — AES-256-GCM, SHA-256, key utils
│   ├── config/                     # @openvault/config — Typed env config loader (Zod)
│   └── shared-types/               # @openvault/shared-types — Shared TypeScript interfaces
│
├── infra/
│   └── docker/
│       ├── Dockerfile.api          # Multi-stage Node.js API image
│       ├── Dockerfile.web          # Multi-stage Nginx + React build image
│       └── nginx.conf              # Nginx reverse proxy config
│
├── .github/
│   └── workflows/ci.yml            # GitHub Actions: lint → test → docker build
│
├── docker-compose.yml              # Production: all 6 services, health checks, resource limits
├── docker-compose.dev.yml          # Development: infra-only (Postgres, Redis, MinIO, MeiliSearch)
├── package.json                    # Root workspace scripts
├── tsconfig.base.json              # Shared TypeScript compiler base config
└── .env.example                    # Environment variable reference template
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | >= 20 | [nodejs.org](https://nodejs.org) |
| **npm** | >= 10 | Included with Node.js 20 |
| **Docker** | Latest | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | v2+ | Included with Docker Desktop |

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/sureshsoudararajan/OpenVault.git
cd OpenVault
```

---

### Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and update the following **critical secrets** before running anything:

```bash
# Generate secure random secrets (run these commands, copy output into .env)
npm run gen-secret   # paste into JWT_ACCESS_SECRET
npm run gen-secret   # paste into JWT_REFRESH_SECRET
npm run gen-secret   # paste into ENCRYPTION_SERVER_KEY (first 32 chars)
```

<details>
<summary>📋 Full environment variable reference</summary>

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set to `production` in production |
| `PORT` | `4000` | API server port |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `DATABASE_URL` | `postgresql://openvault:openvault_secret@localhost:5432/openvault` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MINIO_ENDPOINT` | `localhost` | MinIO host (use `minio` inside Docker) |
| `MINIO_PORT` | `9000` | MinIO API port |
| `MINIO_ACCESS_KEY` | `openvault_minio` | MinIO access key |
| `MINIO_SECRET_KEY` | `openvault_minio_secret` | MinIO secret key |
| `MINIO_BUCKET` | `openvault-files` | MinIO bucket name |
| `MINIO_USE_SSL` | `false` | Enable TLS for MinIO |
| `MEILI_HOST` | `http://localhost:7700` | MeiliSearch host URL |
| `MEILI_MASTER_KEY` | `openvault_meili_master_key` | MeiliSearch master key |
| `JWT_ACCESS_SECRET` | *(set this!)* | Secret for signing 15-min access tokens |
| `JWT_REFRESH_SECRET` | *(set this!)* | Secret for signing 7-day refresh tokens |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token lifetime |
| `ENCRYPTION_SERVER_KEY` | *(set this!)* | 32-char server-side encryption fragment |
| `GOOGLE_CLIENT_ID` | *(optional)* | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | *(optional)* | Google OAuth2 client secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/api/auth/google/callback` | Google OAuth2 redirect URI |
| `GITHUB_CLIENT_ID` | *(optional)* | GitHub OAuth2 client ID |
| `GITHUB_CLIENT_SECRET` | *(optional)* | GitHub OAuth2 client secret |
| `GITHUB_CALLBACK_URL` | `http://localhost:4000/api/auth/github/callback` | GitHub OAuth2 redirect URI |
| `SMTP_HOST` | `smtp.example.com` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (587 = STARTTLS, 465 = SSL) |
| `SMTP_SECURE` | `false` | Use TLS on connect (true for port 465) |
| `SMTP_USER` | — | SMTP username / email address |
| `SMTP_PASS` | — | SMTP password or app password |
| `MAX_FILE_SIZE` | `5368709120` | Max upload size in bytes (default: 5 GB) |
| `MAX_CHUNK_SIZE` | `10485760` | Max chunk size in bytes (default: 10 MB) |
| `DEFAULT_STORAGE_QUOTA` | `5368709120` | Default per-user quota in bytes (5 GB) |

</details>

---

### Step 3 — Start infrastructure services (dev only)

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts **PostgreSQL**, **Redis**, **MinIO**, and **MeiliSearch** locally with all ports exposed for development. Verify they are running:

```bash
docker compose -f docker-compose.dev.yml ps
```

| Service | URL |
|---|---|
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` (`openvault_minio` / `openvault_minio_secret`) |
| MeiliSearch | `http://localhost:7700` |

---

### Step 4 — Install dependencies

```bash
npm install
```

This installs all workspace packages (`apps/api`, `apps/web`, `packages/*`) in a single pass.

---

### Step 5 — Initialize the database

```bash
# Generate the Prisma client from the schema
npx prisma generate --schema=apps/api/prisma/schema.prisma

# Run all migrations to create tables
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name init
```

---

### Step 6 — Start development servers

```bash
# Start API and frontend concurrently
npm run dev
```

Or run them individually in separate terminals:

```bash
npm run dev:api   # Backend  → http://localhost:4000
npm run dev:web   # Frontend → http://localhost:5173
```

---

### Step 7 — Open in your browser

| Service | URL | Notes |
|---|---|---|
| **Frontend** | [http://localhost:5173](http://localhost:5173) | Register a new account to start |
| **API Health** | [http://localhost:4000/health](http://localhost:4000/health) | Returns `{ status: "ok" }` |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Browse uploaded file blobs |
| **Prisma Studio** | Run `npm run db:studio -w apps/api` | Visual database browser |

---

## 🐳 Docker Deployment

### One-Command Production Deployment

```bash
# Build and start all 6 services
docker compose up -d --build
```

> **Before deploying to production**, make sure you have set secure values for all secrets in `.env`. See [Step 2](#step-2--configure-environment-variables) above.

#### Services overview

| Container | Exposed Port | Service | Resource Limit |
|---|---|---|---|
| `openvault-web` | `3000` | Frontend (Nginx + React) | — |
| `openvault-api` | `4000` | Fastify backend API | — |
| `openvault-postgres` | *(internal)* | PostgreSQL 16 | 512 MB RAM |
| `openvault-redis` | *(internal)* | Redis 7 | 256 MB RAM |
| `openvault-minio` | `9000` | MinIO object storage | 512 MB RAM |
| `openvault-meili` | *(internal)* | MeiliSearch v1.6 (production mode) | 512 MB RAM |

> In production, **PostgreSQL**, **Redis**, and **MeiliSearch** ports are **not exposed to the host** — they are only reachable within the Docker network. MinIO exposes port 9000 for API access; the admin console (9001) is disabled in production.

All services have **Docker healthchecks** configured. The API container waits for Postgres, Redis, and MinIO to report healthy before starting.

Log rotation is configured for all services (`json-file`, max 10 MB × 3 files).

#### Useful commands

```bash
# Check all containers are healthy
docker compose ps

# Stream logs from all services
docker compose logs -f

# Stream API logs only
docker compose logs -f api

# Stop containers (data is preserved in named volumes)
docker compose down

# Stop containers AND destroy all persistent data
docker compose down -v
```

#### Named volumes (persistent data)

| Volume | Contents |
|---|---|
| `pgdata` | PostgreSQL database files |
| `redis-data` | Redis AOF/RDB snapshots |
| `minio-data` | All uploaded file blobs & thumbnails |
| `meili-data` | MeiliSearch index data |

---

## 📡 API Reference

All endpoints are prefixed with `/api`. Protected routes (`✅`) require a valid `Authorization: Bearer <access_token>` header.

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Create a new account | ❌ |
| `POST` | `/auth/login` | Login with email & password (+ MFA token if enabled) | ❌ |
| `POST` | `/auth/refresh` | Exchange refresh token for a new access token | ❌ |
| `POST` | `/auth/logout` | Invalidate the current session | ❌ |
| `GET` | `/auth/me` | Get currently authenticated user | ✅ |
| `GET` | `/auth/mfa/setup` | Get TOTP secret + QR code URI for MFA enrollment | ✅ |
| `POST` | `/auth/mfa/enable` | Verify TOTP token to activate MFA | ✅ |
| `POST` | `/auth/mfa/disable` | Disable MFA (requires verification) | ✅ |
| `GET` | `/auth/google` | Redirect to Google OAuth2 | ❌ |
| `GET` | `/auth/google/callback` | Google OAuth2 callback | ❌ |
| `GET` | `/auth/github` | Redirect to GitHub OAuth2 | ❌ |
| `GET` | `/auth/github/callback` | GitHub OAuth2 callback | ❌ |
| `POST` | `/auth/forgot-password` | Send password reset email | ❌ |
| `POST` | `/auth/reset-password` | Reset password with token | ❌ |
| `POST` | `/auth/activate` | Activate account with email token | ❌ |

### Users (`/api/users`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/users/profile` | Get own profile | ✅ |
| `PATCH` | `/users/profile` | Update name / avatar | ✅ |
| `GET` | `/users/storage` | Get storage quota and used space | ✅ |

### Files (`/api/files`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/files/upload` | Upload files (multipart, up to 20 files × 5 GB) | ✅ |
| `GET` | `/files` | List files in a folder (`?folderId=`) | ✅ |
| `GET` | `/files/:id` | Get file details + metadata | ✅ |
| `GET` | `/files/:id/download` | Get presigned MinIO download URL | ✅ |
| `PATCH` | `/files/:id/rename` | Rename a file | ✅ |
| `PATCH` | `/files/:id/move` | Move file to another folder | ✅ |
| `DELETE` | `/files/:id` | Soft delete (move to trash) | ✅ |
| `PATCH` | `/files/:id/restore` | Restore from trash | ✅ |
| `GET` | `/files/trash/list` | List trashed files | ✅ |

### Folders (`/api/folders`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/folders` | Create a new folder | ✅ |
| `GET` | `/folders` | List subfolders (`?parentId=`) | ✅ |
| `GET` | `/folders/tree` | Get full folder tree | ✅ |
| `GET` | `/folders/:id` | Get folder details + contents | ✅ |
| `PATCH` | `/folders/:id` | Rename folder | ✅ |
| `DELETE` | `/folders/:id` | Delete folder | ✅ |

### File Versions (`/api/versions`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/versions/:fileId` | List all versions of a file | ✅ |
| `POST` | `/versions/:fileId/rollback/:versionNumber` | Rollback file to a previous version | ✅ |

### Sharing (`/api/sharing`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/sharing/link` | Create a share link (with optional password, OTP, expiry, download limit) | ✅ |
| `GET` | `/sharing/link/:token` | Access a share link (public) | ❌ |
| `POST` | `/sharing/link/:token/verify` | Verify share link password | ❌ |
| `DELETE` | `/sharing/link/:token` | Revoke a share link | ✅ |
| `POST` | `/sharing/permission` | Grant a user permission on a file/folder | ✅ |
| `GET` | `/sharing/permissions/:resourceId` | List permissions on a resource | ✅ |
| `DELETE` | `/sharing/permissions/:permId` | Revoke a user permission | ✅ |

### Collaboration (`/api/collaboration`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/collaboration/comments/:fileId` | List comments on a file (with threads) | ✅ |
| `POST` | `/collaboration/comments` | Add a comment (or reply) | ✅ |
| `DELETE` | `/collaboration/comments/:id` | Delete a comment | ✅ |
| `GET` | `/collaboration/activity` | Get activity timeline for the current user | ✅ |
| `GET` | `/collaboration/presence` | WebSocket endpoint for live presence | ✅ |

### Search (`/api/search`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/search?q=<query>` | Full-text search (MeiliSearch primary, PostgreSQL fallback) | ✅ |

### Deduplication (`/api/dedup`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/dedup/scan` | Manually trigger a dedup scan for all user files | ✅ |

### Tags (`/api/tags`)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/tags` | List all tags for the current user | ✅ |
| `POST` | `/tags` | Create a new tag (name + hex color) | ✅ |
| `DELETE` | `/tags/:id` | Delete a tag | ✅ |
| `POST` | `/tags/:tagId/files/:fileId` | Attach a tag to a file | ✅ |
| `DELETE` | `/tags/:tagId/files/:fileId` | Remove a tag from a file | ✅ |

---

## 🗄️ Database Schema

OpenVault uses **PostgreSQL 16** with **Prisma 6 ORM** and **14 models**:

```
User
 ├── Session              — JWT refresh token storage (per-device)
 ├── RecoveryCode         — Hashed MFA recovery codes (one-time use)
 ├── File                 — File metadata (MIME type, size, SHA-256, storage key, JSONB metadata)
 │    └── FileVersion     — Version history records with rollback storage key
 ├── Folder               — Self-referencing hierarchy with materialized path
 ├── Tag                  — User-created color-coded labels
 │    └── FileTag         — Many-to-many file ↔ tag association
 ├── Permission           — ACL: viewer/editor/owner per file or folder, with expiry
 ├── ShareLink            — Public token links with password, OTP, expiry & download cap
 │    └── ShareAccessLog  — Per-access log (view, download, otp_verify, password_verify)
 ├── Comment              — Threaded file comments (self-referencing parentId)
 ├── ActivityLog          — Immutable audit trail (action + JSONB metadata + IP)
 └── EncryptionKey        — Distributed key fragments (encrypted user key + server fragment)
```

Notable design choices:
- All IDs are **UUID v4** (`@db.Uuid`)
- `File.sha256Hash` is indexed for fast dedup lookups
- `Folder.path` uses a **materialized path** string (indexed) for efficient subtree queries
- `File.metadata` is a **JSONB** column for flexible extracted metadata storage
- `ActivityLog` and `ShareAccessLog` are append-only with `createdAt` indexes for timeline queries
- All foreign keys use `onDelete: Cascade` so deleting a user removes all their data

To browse the database visually:

```bash
npm run db:studio -w apps/api
# Opens Prisma Studio → http://localhost:5555
```

---

## 🔒 Security Architecture

| Layer | Implementation |
|---|---|
| **In Transit** | TLS 1.3 via Nginx reverse proxy (production) |
| **At Rest** | AES-256-GCM encryption applied before upload to MinIO |
| **Passwords** | Argon2id — 64 MB memory cost, 3 iterations, 4-lane parallelism |
| **File Integrity** | SHA-256 hash computed on every upload, stored in DB |
| **Access Tokens** | JWT HS256, 15-minute expiry, signed with `JWT_ACCESS_SECRET` |
| **Refresh Tokens** | JWT HS256, 7-day expiry, rotated on use, stored in DB as `Session` |
| **MFA** | TOTP RFC 6238 with QR code provisioning + one-time recovery codes |
| **Rate Limiting** | 100 req/min per IP (`@fastify/rate-limit`) |
| **HTTP Headers** | Helmet.js with CSP, X-Frame-Options, HSTS (production) |
| **Downloads** | Time-limited MinIO presigned URLs — no direct API file serving |
| **Share Links** | Optional Argon2id password hash + optional 6-digit OTP code |

### Distributed Encryption Key Model

Every file is encrypted with a unique **File Encryption Key (FEK)**, which is then split:

```
┌─────────────────────────────────────────────────────────────┐
│                    File Encryption Key (FEK)                │
│                          32 bytes                           │
├────────────────────────────┬────────────────────────────────┤
│    User Key Fragment       │    Server Key Fragment         │
│  (encrypted with user's    │  (stored in EncryptionKey      │
│   derived passphrase key)  │   table, server-side only)     │
└────────────────────────────┴────────────────────────────────┘
```

Both fragments are required to reconstruct the FEK. This means:
- A database breach alone cannot decrypt files (server fragment is useless without user fragment)
- A stolen user passphrase alone cannot decrypt files (needs server fragment too)

---

## ⚙️ Background Workers

OpenVault uses **BullMQ** backed by **Redis** to run four async workers:

| Queue | Concurrency | Trigger | What it does |
|---|---|---|---|
| `thumbnail` | 2 workers | After file upload | Downloads file from MinIO → generates 256×256 WebP thumbnail (Sharp for images, FFmpeg for video frames) → uploads to `thumbnails/<fileId>.webp` → updates DB `thumbnailKey` |
| `file-processing` | 3 workers | After file upload | Runs `extract_metadata` action: reads image via Sharp, extracts format/dimensions/channels/density, stores as JSONB in `File.metadata` |
| `dedup-scan` | 1 worker | After file upload | Compares `sha256Hash` against all non-trashed user files; logs duplicates to `ActivityLog` with `action: "dedup_found"` |
| `trash-cleanup` | 1 worker | Cron: daily 3:00 AM | Deletes files trashed > 30 days: removes from MinIO, decrements user `storageUsed`, deletes DB rows |

---

## 🔄 CI/CD Pipeline

GitHub Actions runs on every push to `main`/`develop` and every PR targeting `main`:

```
push / pull_request
    │
    ▼
lint-and-test
    ├── Spin up PostgreSQL 16 + Redis 7 as service containers
    ├── npm ci
    ├── npx prisma generate
    ├── npm run lint  (TypeScript type check across all workspaces)
    └── npm run test  (Vitest across all workspaces)
    │
    ▼  (only if lint-and-test passes)
docker-build
    ├── docker build infra/docker/Dockerfile.api
    └── docker build infra/docker/Dockerfile.web
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/OpenVault.git
cd OpenVault

# 2. Set up the development environment
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npm install
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name init

# 3. Create a feature branch
git checkout -b feature/your-feature-name

# 4. Make your changes, then commit
git add .
git commit -m "feat: describe your changes"

# 5. Push and open a Pull Request
git push origin feature/your-feature-name
```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use case |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `refactor:` | Code refactor (no feature/fix) |
| `test:` | Adding or updating tests |
| `chore:` | Tooling, config, dependency updates |

### Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start all dev servers concurrently |
| `npm run dev:api` | Start backend API only (`tsx watch`) |
| `npm run dev:web` | Start frontend Vite dev server only |
| `npm run build` | Build all packages for production |
| `npm run lint` | TypeScript type-check all workspaces |
| `npm run test` | Run Vitest across all workspaces |
| `npm run db:migrate` | Run pending Prisma migrations (dev) |
| `npm run db:generate` | Re-generate Prisma client after schema changes |
| `npm run db:seed` | Run database seed script |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run gen-secret` | Generate a cryptographically secure 32-byte hex secret |
| `npm run docker:up` | Start production Docker Compose stack |
| `npm run docker:down` | Stop production Docker Compose stack |
| `npm run docker:build` | Rebuild all Docker images |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/sureshsoudararajan">sureshsoudararajan</a>
</p>