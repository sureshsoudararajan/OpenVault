<p align="center">
  <img src="https://img.shields.io/badge/OpenVault-Cloud%20Storage-6366f1?style=for-the-badge&logo=icloud&logoColor=white" alt="OpenVault" />
</p>

<h1 align="center">🔐 OpenVault</h1>

<p align="center">
  <strong>Self-hostable, privacy-focused, open-source cloud storage platform</strong>
</p>

<p align="center">
  A production-grade alternative to Google Drive, Dropbox &amp; Nextcloud — with built-in collaboration, version control, and end-to-end encryption.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#%EF%B8%8F-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-docker-deployment">Docker</a> •
  <a href="#-api-reference">API</a> •
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
- **Upload & Download** — Chunked uploads for large files, presigned download URLs
- **Folder Hierarchy** — Nested folder tree with materialized paths
- **Grid / List View** — Toggle between views with sorting options
- **File Preview** — In-browser preview for images, PDFs, and videos
- **Trash & Restore** — Soft delete with recovery option
- **Drag & Move** — Move files between folders with ease

### 🔗 Sharing & Collaboration
- **Public Share Links** — Generate shareable URLs for any file or folder
- **Password Protection** — Secure shared links with passwords
- **Expiry & Download Limits** — Auto-expire links or cap downloads
- **Permission Control** — Viewer / Editor / Owner role-based sharing
- **Threaded Comments** — Comment on files with reply threads
- **Activity Timeline** — Track every action (upload, download, share, delete)
- **Live Presence** — WebSocket-powered real-time user presence

### 🔒 Security
- **AES-256-GCM Encryption** — Files encrypted at rest before storage
- **Distributed Key Model** — Each file key split between user and server (prevents centralized compromise)
- **Argon2id Passwords** — Memory-hard password hashing (64MB, 3 iterations)
- **JWT + Refresh Rotation** — 15-min access tokens with automatic refresh
- **TOTP MFA** — Two-factor authentication with any authenticator app
- **RBAC** — Role-based access control (Admin / Member / Guest)
- **Rate Limiting** — Protection against brute force attacks
- **SHA-256 Integrity** — File integrity verification on every upload

### 🧠 Smart Features
- **AI Deduplication** — Detect duplicate files by hash, merge to save storage
- **Version Control** — Git-like file versioning with rollback support
- **Full-Text Search** — MeiliSearch integration with PostgreSQL fallback
- **Background Processing** — Thumbnail generation, compression, dedup scanning

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite, TypeScript | Single-page application |
| **Styling** | TailwindCSS 3 | Utility-first CSS framework |
| **State** | Zustand | Lightweight state management |
| **Backend** | Node.js 20, Fastify 5 | High-performance API server |
| **Database** | PostgreSQL 16 | Metadata & relational data |
| **ORM** | Prisma | Type-safe database access |
| **Object Storage** | MinIO (S3-compatible) | File blob storage |
| **Search** | MeiliSearch | Full-text search engine |
| **Cache & Queue** | Redis 7 + BullMQ | Background jobs & caching |
| **Auth** | JWT + Argon2 + TOTP | Authentication & MFA |
| **Encryption** | AES-256-GCM | Client & server-side encryption |
| **DevOps** | Docker, Docker Compose | Containerized deployment |
| **CI/CD** | GitHub Actions | Automated testing & builds |

---

## 📁 Project Structure

```
OpenVault/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── prisma/             #   Database schema & migrations
│   │   └── src/
│   │       ├── modules/        #   Feature modules (auth, files, folders, etc.)
│   │       ├── storage/        #   MinIO storage abstraction
│   │       ├── jobs/           #   BullMQ background workers
│   │       ├── middleware/     #   Auth guards & RBAC
│   │       └── app.ts          #   Fastify app factory
│   │
│   └── web/                    # React frontend
│       └── src/
│           ├── pages/          #   Page components
│           ├── layouts/        #   App shell & auth layout
│           ├── stores/         #   Zustand state stores
│           └── services/       #   API client
│
├── packages/
│   ├── shared-types/           # Shared TypeScript interfaces
│   ├── crypto/                 # AES-256, SHA-256, key management
│   └── config/                 # Environment configuration
│
├── infra/
│   └── docker/                 # Dockerfiles & nginx config
│
├── docker-compose.yml          # Production deployment
├── docker-compose.dev.yml      # Development (infra only)
└── .github/workflows/ci.yml   # CI/CD pipeline
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | >= 20 | [nodejs.org](https://nodejs.org) |
| **Docker** | Latest | [docker.com](https://docs.docker.com/get-docker/) |
| **Docker Compose** | v2+ | Included with Docker Desktop |

### Step 1 — Clone the repository

```bash
git clone https://github.com/sureshsoudararajan/OpenVault.git
cd OpenVault
```

### Step 2 — Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` to customise your setup. The defaults work for local development.

<details>
<summary>📋 Key environment variables</summary>

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://openvault:openvault_secret@localhost:5432/openvault` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_ACCESS_KEY` | `openvault_minio` | MinIO access key |
| `MINIO_SECRET_KEY` | `openvault_minio_secret` | MinIO secret key |
| `JWT_ACCESS_SECRET` | (change me!) | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | (change me!) | Secret for signing refresh tokens |
| `GOOGLE_CLIENT_ID` | *(optional)* | For Google OAuth login |
| `GITHUB_CLIENT_ID` | *(optional)* | For GitHub OAuth login |

</details>

### Step 3 — Start infrastructure services

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts **PostgreSQL**, **Redis**, **MinIO**, and **MeiliSearch** in Docker containers.

Verify services are running:
```bash
docker compose -f docker-compose.dev.yml ps
```

### Step 4 — Install dependencies

```bash
npm install
```

### Step 5 — Set up the database

```bash
# Generate Prisma client
npx prisma generate --schema=apps/api/prisma/schema.prisma

# Run migrations to create database tables
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name init
```

### Step 6 — Start development servers

```bash
# Start both API and frontend concurrently
npm run dev
```

Or start them individually:
```bash
npm run dev:api   # Backend  → http://localhost:4000
npm run dev:web   # Frontend → http://localhost:5173
```

### Step 7 — Open in your browser

| Service | URL | Credentials |
|---|---|---|
| **Frontend** | [http://localhost:5173](http://localhost:5173) | Register a new account |
| **API Health** | [http://localhost:4000/health](http://localhost:4000/health) | — |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | `openvault_minio` / `openvault_minio_secret` |
| **Prisma Studio** | Run `npm run db:studio -w apps/api` | — |

---

## 🐳 Docker Deployment

### One-Command Production Deployment

```bash
# Build and start everything
docker compose up -d --build
```

This starts **all 6 services** in production mode:

| Container | Port | Service |
|---|---|---|
| `openvault-web` | 3000 | Frontend |
| `openvault-api` | 4000 | Backend API |
| `openvault-postgres` | 5432 | PostgreSQL |
| `openvault-redis` | 6379 | Redis |
| `openvault-minio` | 9000, 9001 | MinIO (S3 Storage) |
| `openvault-meili` | 7700 | MeiliSearch |

### Verify deployment

```bash
# Check all containers are healthy
docker compose ps

# Test the API
curl http://localhost:4000/health

# Open the frontend
open http://localhost:3000
```

### Stop everything

```bash
docker compose down          # Stop containers (keep data)
docker compose down -v       # Stop containers AND delete data
```

---

## 📡 API Reference

All API endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create a new account | ❌ |
| `POST` | `/api/auth/login` | Login with email & password | ❌ |
| `POST` | `/api/auth/refresh` | Refresh access token | ❌ |
| `POST` | `/api/auth/logout` | Invalidate session | ❌ |
| `GET` | `/api/auth/mfa/setup` | Get TOTP secret for MFA | ✅ |
| `POST` | `/api/auth/mfa/enable` | Verify & enable MFA | ✅ |

### Files

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/files/upload` | Upload a file (multipart) | ✅ |
| `GET` | `/api/files` | List files in folder | ✅ |
| `GET` | `/api/files/:id` | Get file details | ✅ |
| `GET` | `/api/files/:id/download` | Get download URL | ✅ |
| `DELETE` | `/api/files/:id` | Move to trash | ✅ |
| `PATCH` | `/api/files/:id/restore` | Restore from trash | ✅ |
| `PATCH` | `/api/files/:id/rename` | Rename a file | ✅ |
| `PATCH` | `/api/files/:id/move` | Move to another folder | ✅ |
| `GET` | `/api/files/trash/list` | List trashed files | ✅ |

### Folders

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/folders` | Create a folder | ✅ |
| `GET` | `/api/folders` | List subfolders | ✅ |
| `GET` | `/api/folders/tree` | Get full folder tree | ✅ |
| `GET` | `/api/folders/:id` | Folder details + contents | ✅ |
| `PATCH` | `/api/folders/:id` | Rename folder | ✅ |
| `DELETE` | `/api/folders/:id` | Delete folder | ✅ |

### Sharing

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/sharing/link` | Create share link | ✅ |
| `GET` | `/api/sharing/link/:token` | Access share link | ❌ |
| `POST` | `/api/sharing/link/:token/verify` | Verify link password | ❌ |
| `POST` | `/api/sharing/permission` | Grant user permission | ✅ |
| `GET` | `/api/sharing/permissions/:id` | List permissions | ✅ |

### Other

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/search?q=` | Search files | ✅ |
| `GET` | `/api/versions/:fileId` | List file versions | ✅ |
| `POST` | `/api/versions/:fileId/rollback/:v` | Rollback to version | ✅ |
| `GET` | `/api/dedup/scan` | Scan for duplicates | ✅ |
| `POST` | `/api/collaboration/comments` | Add comment | ✅ |
| `GET` | `/api/collaboration/activity` | Activity timeline | ✅ |

---

## 🗄️ Database Schema

OpenVault uses **PostgreSQL** with **Prisma ORM** and 10 database models:

```
User ──┬── Session (JWT refresh tokens)
       ├── File ──── FileVersion (version history)
       ├── Folder ── (self-referencing hierarchy)
       ├── Permission (ACL for files/folders)
       ├── ShareLink (public share tokens)
       ├── Comment (threaded discussions)
       ├── ActivityLog (audit trail)
       └── EncryptionKey (distributed key fragments)
```

To explore the database visually:
```bash
npm run db:studio -w apps/api
```

---

## 🔒 Security Architecture

| Layer | Implementation |
|---|---|
| **In Transit** | TLS 1.3 via Nginx reverse proxy |
| **At Rest** | AES-256-GCM encryption before MinIO storage |
| **Passwords** | Argon2id (64MB memory, 3 iterations, 4 parallelism) |
| **File Integrity** | SHA-256 hash computed on upload, verified on download |
| **Access Tokens** | JWT (15-min expiry) with automatic refresh rotation |
| **MFA** | TOTP (RFC 6238) — compatible with Google Authenticator, Authy |
| **Rate Limiting** | 100 requests/min per IP via `@fastify/rate-limit` |
| **Download Security** | Time-limited presigned URLs from MinIO |

### Distributed Encryption Key Model

Each file is encrypted with a unique **File Encryption Key (FEK)**, which is then split:

```
┌─────────────────────────────────────────┐
│           File Encryption Key           │
│              (32 bytes)                 │
├────────────────────┬────────────────────┤
│  User Fragment     │  Server Fragment   │
│  (encrypted with   │  (stored on        │
│   user passphrase) │   server DB)       │
└────────────────────┴────────────────────┘
```

Both fragments are required to decrypt. This prevents any single-point compromise.

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

```bash
# Fork & clone
git clone https://github.com/sureshsoudararajan/OpenVault.git
cd OpenVault

# Install & setup
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npm install
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma --name init

# Create a feature branch
git checkout -b feature/your-feature

# Make changes & commit
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

Then open a **Pull Request** on GitHub.

### Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start all dev servers |
| `npm run dev:api` | Start backend only |
| `npm run dev:web` | Start frontend only |
| `npm run build` | Build all packages |
| `npm run lint` | TypeScript type checking |
| `npm run test` | Run all tests |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/sureshsoudararajan">sureshsoudararajan</a>
</p>
