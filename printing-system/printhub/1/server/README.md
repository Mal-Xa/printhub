# Sora Print Hub — Backend API Server

> Node.js · Express · TypeScript · Firebase Firestore · Firebase Storage · Firebase Auth

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Firestore Schema](#firestore-schema)
4. [Prerequisites](#prerequisites)
5. [Local Development Setup](#local-development-setup)
6. [Environment Variables](#environment-variables)
7. [Firebase Setup](#firebase-setup)
8. [Running the Server](#running-the-server)
9. [Docker Deployment](#docker-deployment)
10. [Cloud Run Deployment](#cloud-run-deployment)
11. [API Reference](#api-reference)
12. [Print Queue Architecture](#print-queue-architecture)
13. [Adding a Real Printer Adapter](#adding-a-real-printer-adapter)
14. [Security Checklist](#security-checklist)

---

## Architecture Overview

```
React Frontend (Vite + Capacitor)
        │  HTTPS + Firebase ID Token
        ▼
┌────────────────────────────────┐
│  Express API  (this server)    │
│                                │
│  Routes → Controllers          │
│       → Services               │
│       → Repositories           │
│       → Firebase SDKs          │
└──────┬──────────────┬──────────┘
       │              │
  Firestore      Firebase Storage
  (NoSQL DB)     (File storage)
```

**Clean Architecture layers**

| Layer | Responsibility |
|---|---|
| `routes/` | HTTP routing, attach middleware |
| `controllers/` | Parse request, call service, send response |
| `services/` | Business logic, orchestrate repositories |
| `repositories/` | All Firestore / Storage calls |
| `validators/` | Zod schemas — validate & coerce input |
| `middleware/` | Auth, error handling, uploads |
| `utils/` | Pure helpers (errors, responses, pricing calc) |
| `jobs/` | Background workers (print queue) |

---

## Project Structure

```
server/
├── src/
│   ├── app.ts                    # Express app + server bootstrap
│   ├── config/
│   │   ├── env.ts                # Typed env vars with validation
│   │   └── firebase.ts           # Firebase Admin SDK init + collection names
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── file.controller.ts
│   │   ├── order.controller.ts
│   │   ├── passport.controller.ts
│   │   ├── pricing.controller.ts
│   │   ├── admin.controller.ts
│   │   └── printJob.controller.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts    # authenticateUser, requireAdmin
│   │   ├── error.middleware.ts   # Global error handler + asyncHandler
│   │   ├── upload.middleware.ts  # Multer (memory) + file-type guard
│   │   └── validate.middleware.ts# Zod schema middleware factory
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── file.routes.ts
│   │   ├── order.routes.ts
│   │   ├── passport.routes.ts
│   │   ├── pricing.routes.ts
│   │   ├── admin.routes.ts
│   │   └── printJob.routes.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── file.service.ts
│   │   ├── order.service.ts
│   │   ├── passport.service.ts
│   │   ├── pricing.service.ts
│   │   ├── notification.service.ts
│   │   ├── activityLog.service.ts
│   │   ├── admin.service.ts
│   │   └── printJob.service.ts
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   ├── order.repository.ts
│   │   ├── file.repository.ts
│   │   ├── passport.repository.ts
│   │   ├── pricing.repository.ts
│   │   ├── notification.repository.ts
│   │   ├── activityLog.repository.ts
│   │   └── printJob.repository.ts
│   ├── validators/
│   │   ├── auth.validator.ts
│   │   ├── order.validator.ts
│   │   ├── pricing.validator.ts
│   │   ├── passport.validator.ts
│   │   └── printJob.validator.ts
│   ├── types/
│   │   └── index.ts              # All shared TypeScript types
│   ├── utils/
│   │   ├── errors.ts             # AppError subclasses
│   │   ├── response.ts           # ok(), created(), fail() helpers
│   │   ├── id.ts                 # UUID + SPH-XXXX order ID generator
│   │   └── pricing.ts            # Server-side price calculator
│   └── jobs/
│       └── printQueue.job.ts     # Future-ready print queue worker
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

---

## Firestore Schema

### `users/{uid}`
```
{
  id:         string       // Firebase Auth UID
  fullName:   string
  phone:      string
  email:      string
  role:       "user" | "admin"
  avatarUrl?: string
  createdAt:  ISO string
  updatedAt:  ISO string
}
```

### `orders/{orderId}`
```
{
  id:          string          // SPH-XXXX
  userId:      string          // Firebase Auth UID
  customer: {
    name:   string
    phone:  string
    email:  string
  }
  files:       StoredFile[]    // Snapshot at order time
  printOptions: {
    type:             "bw" | "color"
    side:             "single" | "double"
    copies:           number
    paperSize:        "A4"
    pages:            { mode: "all"|"custom"; range?: string }
    frontCoverColor:  boolean
    backCoverColor:   boolean
    removeBlankPages: boolean
  }
  lamination: [{ type: LaminationType; quantity: number }]
  binding: {
    mode:           "print_only" | "print_and_binding" | "binding_only"
    documentCount?: number
    estimatedPages?: number
  }
  specialInstructions?: string
  status:    "pending" | "accepted" | "printing" | "ready" | "completed" | "awaiting_delivery"
  total:     number            // Server-calculated, INR
  createdAt: ISO string
  updatedAt: ISO string
}
```

**Order status transitions**
```
pending → accepted
accepted → printing | pending
printing → ready | awaiting_delivery
ready → completed
awaiting_delivery → completed
completed → (terminal)
```

### `files/{fileId}`
```
{
  id:           string   // UUID
  name:         string   // Original filename
  sizeBytes:    number
  mimeType:     string
  pages?:       number
  uploadedAt:   ISO string
  ownerId:      string   // Firebase Auth UID
  storagePath:  string   // Firebase Storage path
}
```

### `passportSheets/{sheetId}`
```
{
  id:                 string
  userId:             string
  template:           "passport" | "visa" | "id"
  originalImagePath?: string   // Storage path
  sheetPath?:         string   // Storage path (generated PDF)
  photosPerSheet:     number
  createdAt:          ISO string
}
```

### `pricing/default`  (single document)
```
{
  bwPage:          number   // per page, INR
  colorPage:       number
  frontCoverColor: number
  backCoverColor:  number
  passportSheet:   number
  lamination: {
    id_card:     number
    aadhaar:     number
    pan:         number
    certificate: number
    a4:          number
  }
  spiralBinding:   number   // per document
  updatedAt?:      ISO string
  updatedBy?:      string   // admin UID
}
```

### `printJobs/{jobId}`
```
{
  jobId:       string
  orderId:     string
  fileName:    string
  printerId?:  string
  printerName?: string
  status:      "waiting" | "printing" | "printed" | "failed" | "cancelled"
  createdAt:   ISO string
  updatedAt:   ISO string
}
```

**Print job status transitions**
```
waiting → printing | cancelled
printing → printed | failed
failed → waiting   (retry)
printed → (terminal)
cancelled → (terminal)
```

### `notifications/{notificationId}`
```
{
  id:        string
  userId:    string
  title:     string
  body:      string
  type:      "order_update" | "file_ready" | "admin_action" | "system"
  read:      boolean
  createdAt: ISO string
  metadata?: object
}
```

### `activityLogs/{logId}`
```
{
  id:          string
  action:      ActivityAction
  userId:      string
  targetId?:   string
  targetType?: string
  metadata?:   object
  createdAt:   ISO string
}
```

---

## Prerequisites

- Node.js 18+
- npm 9+
- A Firebase project with **Firestore**, **Storage**, and **Authentication** enabled

---

## Local Development Setup

```bash
# 1. Clone / copy the server folder
cd server

# 2. Install dependencies
npm install

# 3. Copy env template
cp .env.example .env

# 4. Fill in your Firebase credentials (see below)
nano .env

# 5. Start dev server with hot-reload
npm run dev
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `4000` | HTTP port |
| `NODE_ENV` | No | `development` | `development` / `production` |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated allowed origins |
| `FIREBASE_STORAGE_BUCKET` | **Yes** | — | e.g. `your-project.appspot.com` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Dev only | — | Path to JSON key file |
| `FIREBASE_PROJECT_ID` | Prod | — | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Prod | — | Service account email |
| `FIREBASE_PRIVATE_KEY` | Prod | — | Service account private key |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per window |
| `MAX_FILE_SIZE_MB` | No | `50` | Upload size limit |
| `SIGNED_URL_EXPIRY_MINUTES` | No | `60` | Firebase Storage signed URL TTL |

---

## Firebase Setup

### 1. Create project
Go to [console.firebase.google.com](https://console.firebase.google.com) → New project.

### 2. Enable services
- **Authentication** → Sign-in providers → Email/Password (and/or Google)
- **Firestore Database** → Create database → Production mode
- **Storage** → Get started → Production mode

### 3. Service account (local dev)
Project Settings → Service Accounts → Generate new private key → Save as `server/firebase-service-account.json`

### 4. Firestore indexes

Create these composite indexes in the Firebase Console (or `firestore.indexes.json`):

```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "files",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "uploadedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "printJobs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 5. Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Server-side access only — all writes via Admin SDK
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

> The backend uses the **Admin SDK** which bypasses all security rules.
> The rules above block all direct client access, forcing everything through the API.

### 6. Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Running the Server

```bash
# Development (hot-reload)
npm run dev

# Build
npm run build

# Production
npm start

# Type-check only
npm run type-check
```

---

## Docker Deployment

```bash
# Build image
docker build -t sora-print-hub-api .

# Run with env file
docker run -p 4000:4000 --env-file .env sora-print-hub-api

# Or use docker-compose
docker-compose up -d
```

---

## Cloud Run Deployment

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Build & push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/sora-print-hub-api

# Deploy
gcloud run deploy sora-print-hub-api \
  --image gcr.io/YOUR_PROJECT_ID/sora-print-hub-api \
  --platform managed \
  --region asia-south1 \
  --set-env-vars FIREBASE_STORAGE_BUCKET=your-project.appspot.com \
  --set-env-vars FIREBASE_PROJECT_ID=your-project-id \
  --set-env-vars FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com \
  --set-secrets FIREBASE_PRIVATE_KEY=firebase-private-key:latest \
  --allow-unauthenticated
```

> On Cloud Run with Workload Identity, you can omit the service account env vars
> and the SDK will use Application Default Credentials automatically.

---

## API Reference

See `API.md` for full endpoint documentation.

Base URL: `http://localhost:4000/api`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Login / verify token |
| GET | `/auth/me` | User | Get own profile |
| PATCH | `/auth/profile` | User | Update fullName / phone / email |
| POST | `/files/upload` | User | Upload file |
| GET | `/files` | User | List files |
| GET | `/files/:id` | User | Get file + signed URL |
| DELETE | `/files/:id` | User | Delete file |
| POST | `/orders` | User | Create order |
| GET | `/orders` | User | List orders |
| GET | `/orders/:id` | User | Get order |
| PATCH | `/orders/:id/status` | Admin | Update order status |
| POST | `/passport` | User | Upload passport photo |
| GET | `/passport` | User | List sheets |
| DELETE | `/passport/:id` | User | Delete sheet |
| GET | `/pricing` | Public | Get pricing |
| PUT | `/pricing` | Admin | Update pricing |
| GET | `/admin/stats` | Admin | Dashboard stats |
| GET | `/admin/orders` | Admin | All orders (paginated) |
| GET | `/admin/logs` | Admin | Activity logs |
| PATCH | `/admin/users/role` | Admin | Set user role |
| POST | `/print-jobs` | Admin | Send to printer (`sendPrint`) |
| GET | `/print-jobs` | Admin | All jobs — queue display |
| GET | `/print-jobs/queue` | Admin | Waiting jobs only |
| GET | `/print-jobs/:id` | Admin | Get single job |
| PATCH | `/print-jobs/:id/status` | Admin | Update job status (`setJobStatus`) |
| DELETE | `/print-jobs/:id` | Admin | Cancel / remove job |
| GET | `/printers` | User | List printers (`listPrinters`) |
| POST | `/printers` | Admin | Add printer |
| PATCH | `/printers/:id/status` | Admin | Set online / offline / busy |
| DELETE | `/printers/:id` | Admin | Remove printer |

---

## Print Queue Architecture

```
orders/{orderId}  ──►  POST /print-jobs  ──►  printJobs/{jobId}
                                                    │
                                         ┌──────────▼──────────────┐
                                         │   printQueue.job.ts      │
                                         │   polls every 10s        │
                                         │                          │
                                         │  waiting → printing      │
                                         │         → printed        │
                                         │         → failed         │
                                         └──────────────────────────┘
                                                    │
                                         ┌──────────▼──────────────┐
                                         │   PrinterAdapter         │
                                         │   (pluggable interface)  │
                                         │                          │
                                         │   • IPP adapter          │
                                         │   • REST adapter         │
                                         │   • Native SDK adapter   │
                                         └──────────────────────────┘
```

## Adding a Real Printer Adapter

Implement the `PrinterAdapter` interface in `src/jobs/printQueue.job.ts`:

```typescript
import { setPrinterAdapter } from './jobs/printQueue.job';

setPrinterAdapter({
  async isAvailable() {
    // Ping your printer / check queue
    return true;
  },
  async submitJob(job) {
    // Send job to IPP, REST endpoint, or native SDK
    await myPrinterSDK.print(job.fileName, { copies: 1 });
  },
});
```

---

## Security Checklist

- [x] Helmet HTTP headers
- [x] CORS restricted to listed origins
- [x] Rate limiting (global)
- [x] Firebase ID token verification on every protected route
- [x] Role-based access (user / admin)
- [x] File ownership validation — users only access their own files
- [x] File type whitelist (PDF, DOCX, PPTX, JPG, PNG)
- [x] File size limit (configurable, default 50 MB)
- [x] Server-side price calculation — client totals never trusted
- [x] Order status transition validation — no illegal jumps
- [x] Input validation via Zod on all mutation endpoints
- [x] Non-root Docker user
- [x] `.env` never committed (`.gitignore`)
- [x] Firestore security rules block direct client access
