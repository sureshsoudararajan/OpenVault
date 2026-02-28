# 🔐 OpenVault

**Self-hostable, open-source cloud storage platform.**

A privacy-focused alternative to Google Drive, Dropbox, and Nextcloud — with built-in collaboration, version control, and end-to-end encryption.

---

## ✨ Features

- 📁 **File Management** — Upload, download, preview, organize in folders
- 🔗 **Sharing** — Public links, password protection, expiry dates, permission control
- 👥 **Collaboration** — Shared folders, comments, activity timeline, live presence
- 🔄 **Version Control** — Git-like file versioning with rollback support
- 🔒 **Security** — AES-256 encryption at rest, TLS 1.3, Argon2 passwords, MFA
- 🧠 **Smart Dedup** — AI-powered duplicate detection to save storage
- 📡 **P2P Transfer** — WebRTC-based LAN sharing for faster transfers
- 🐳 **Self-Hostable** — One-command deployment with Docker Compose

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, TailwindCSS, Zustand |
| Backend | Node.js, Fastify, Prisma, BullMQ |
| Database | PostgreSQL |
| Storage | MinIO (S3-compatible) |
| Search | MeiliSearch |
| Cache/Queue | Redis |

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20
- Docker & Docker Compose

### Development

```bash
# Clone the repository
git clone https://github.com/yourusername/openvault.git
cd openvault

# Copy environment config
cp .env.example .env

# Start infrastructure services
docker compose -f docker-compose.dev.yml up -d

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start development servers
npm run dev
```

The frontend will be at `http://localhost:5173` and the API at `http://localhost:4000`.

### Production (Docker)

```bash
docker compose up -d
```

## 📁 Project Structure

```
OpenVault/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Fastify backend
├── packages/
│   ├── shared-types/ # Shared TypeScript types
│   ├── crypto/       # Encryption utilities
│   └── config/       # Shared configuration
├── infra/            # Docker, K8s, scripts
└── docker-compose.yml
```

## 📄 License

MIT — see [LICENSE](./LICENSE)
