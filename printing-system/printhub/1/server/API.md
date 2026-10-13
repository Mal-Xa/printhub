# Sora Print Hub — API Documentation

Base URL: `http://localhost:4000/api`

All authenticated routes require the header:
```
Authorization: Bearer <Firebase ID Token>
```

All responses follow:
```json
{ "success": true, "data": { ... }, "message": "Optional message" }
{ "success": false, "message": "Error description", "error": "ERROR_CODE" }
```

---

## Health

### GET `/health`
No auth required.

**Response 200**
```json
{ "status": "ok", "version": "1.0.0" }
```

---

## Authentication

### POST `/auth/register`

Creates a Firestore user profile linked to an existing Firebase Auth account.
Call this once after the user signs up on the frontend.

**Body**
```json
{
  "idToken": "<Firebase ID token>",
  "fullName": "Priya Sharma",
  "phone": "+919876543210"
}
```

**Response 201**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "id": "uid_abc123",
    "fullName": "Priya Sharma",
    "phone": "+919876543210",
    "email": "priya@example.com",
    "role": "user",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Errors**
- `409` — User already registered
- `401` — Invalid Firebase token
- `422` — Validation error

---

### POST `/auth/login`

Verifies a Firebase ID token and returns the existing user profile.

**Body**
```json
{ "idToken": "<Firebase ID token>" }
```

**Response 200**
```json
{
  "success": true,
  "message": "Login successful",
  "data": { /* User object */ }
}
```

---

### GET `/auth/me`  🔒 User

Returns the authenticated user's profile.

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": "uid_abc123",
    "fullName": "Priya Sharma",
    "role": "user",
    ...
  }
}
```

---

## Files

### POST `/files/upload`  🔒 User

Upload a file to Firebase Storage.

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | File | Allowed: PDF, DOCX, PPTX, JPG, PNG (max 50 MB) |

**Response 201**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "id": "uuid-here",
    "name": "thesis.pdf",
    "sizeBytes": 2048000,
    "mimeType": "application/pdf",
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "ownerId": "uid_abc123",
    "storagePath": "files/uid_abc123/uuid-here.pdf",
    "downloadUrl": "https://storage.googleapis.com/..."
  }
}
```

**Errors**
- `400` — No file / unsupported type
- `413` — File too large

---

### GET `/files`  🔒 User / Admin

- Users see only their own files
- Admins see all files

**Response 200** — Array of `StoredFile`

---

### GET `/files/:id`  🔒 User / Admin

Returns file metadata + a fresh signed download URL (valid 60 min).

**Response 200** — `StoredFile` with `downloadUrl`

**Errors**
- `404` — File not found
- `403` — File does not belong to you

---

### DELETE `/files/:id`  🔒 User / Admin

Deletes from both Firebase Storage and Firestore.

**Response 204** — No content

---

## Orders

### POST `/orders`  🔒 User

Create a new print order. The server recalculates the total — client totals are ignored.

**Body**
```json
{
  "customer": {
    "name": "Priya Sharma",
    "phone": "+919876543210",
    "email": "priya@example.com"
  },
  "fileIds": [
    { "id": "uuid-of-uploaded-file" }
  ],
  "printOptions": {
    "type": "bw",
    "side": "double",
    "copies": 2,
    "paperSize": "A4",
    "pages": { "mode": "all" },
    "frontCoverColor": false,
    "backCoverColor": false,
    "removeBlankPages": false
  },
  "lamination": [
    { "type": "id_card", "quantity": 2 }
  ],
  "binding": {
    "mode": "print_and_binding",
    "documentCount": 1,
    "estimatedPages": 50
  },
  "specialInstructions": "Please staple separately"
}
```

**Response 201**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "SPH-1001",
    "status": "pending",
    "total": 240,
    ...
  }
}
```

**Pricing logic (B&W double-sided, 50 pages, 2 copies + binding + 2 ID laminations)**
```
B&W Print:   25pp × 2 copies × ₹2  = ₹100
Binding:     1 doc × ₹30            = ₹30
Lamination:  2 × ₹20               = ₹40
──────────────────────────────────────────
Total                               = ₹170
```

**Errors**
- `400` — No files for non-binding-only orders
- `403` — File does not belong to you
- `404` — File ID not found
- `422` — Validation error

---

### GET `/orders`  🔒 User / Admin

- Users see their own orders
- Admins see all orders, sorted by `createdAt` descending

**Response 200** — Array of `Order`

---

### GET `/orders/:id`  🔒 User / Admin

**Response 200** — Single `Order`

**Errors**
- `404` — Not found
- `403` — Not your order

---

### PATCH `/orders/:id/status`  🔒 Admin

Update order status with transition validation.

**Body**
```json
{ "status": "accepted" }
```

Valid transitions:
```
pending → accepted
accepted → printing | pending
printing → ready | awaiting_delivery
ready → completed
awaiting_delivery → completed
```

**Response 200**
```json
{
  "success": true,
  "message": "Order status updated to accepted",
  "data": { /* Updated order */ }
}
```

**Errors**
- `400` — Invalid status transition
- `404` — Order not found

---

## Passport Photos

### POST `/passport`  🔒 User

Upload a photo to create a passport sheet record.

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `photo` | File | JPG or PNG |
| `template` | string | `passport` / `visa` / `id` |
| `photosPerSheet` | number | Default 8 |

**Response 201**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uid_abc123",
    "template": "passport",
    "photosPerSheet": 8,
    "originalImageUrl": "https://storage.googleapis.com/...",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### GET `/passport`  🔒 User / Admin

- Users see their own sheets
- Admins see all sheets

**Response 200** — Array of `PassportSheet`

---

### DELETE `/passport/:id`  🔒 User / Admin

Deletes sheet record + all Storage files.

**Response 204**

---

## Pricing

### GET `/pricing`  🌐 Public

**Response 200**
```json
{
  "success": true,
  "data": {
    "bwPage": 2,
    "colorPage": 8,
    "frontCoverColor": 10,
    "backCoverColor": 10,
    "passportSheet": 60,
    "lamination": {
      "id_card": 20,
      "aadhaar": 20,
      "pan": 20,
      "certificate": 40,
      "a4": 40
    },
    "spiralBinding": 30
  }
}
```

---

### PUT `/pricing`  🔒 Admin

Replace the entire pricing document.

**Body** — Same shape as the GET response `data`

**Response 200**
```json
{
  "success": true,
  "message": "Pricing updated successfully",
  "data": { /* Updated pricing */ }
}
```

---

## Admin

### GET `/admin/stats`  🔒 Admin

**Response 200**
```json
{
  "success": true,
  "data": {
    "ordersToday": 12,
    "revenueToday": 1840,
    "revenueThisMonth": 38200,
    "pendingOrders": 4,
    "completedOrders": 87,
    "totalOrders": 101,
    "mostPopularService": "Print + Binding"
  }
}
```

---

### GET `/admin/orders`  🔒 Admin

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | number | 50 | Max results |
| `startAfter` | string | — | Order ID for cursor pagination |

**Response 200** — Array of `Order`

---

### GET `/admin/logs`  🔒 Admin

**Query params**
| Param | Type | Default |
|---|---|---|
| `limit` | number | 100 |

**Response 200** — Array of `ActivityLog`

---

### PATCH `/admin/users/role`  🔒 Admin

**Body**
```json
{ "uid": "firebase-user-uid", "role": "admin" }
```

**Response 200**

---

## Print Jobs

### POST `/print-jobs`  🔒 Admin

**Body**
```json
{
  "orderId": "SPH-1001",
  "fileName": "thesis.pdf",
  "printerName": "Brother MFC-L2750DW"
}
```

**Response 201** — `PrintJob`

---

### GET `/print-jobs`  🔒 Admin

List all print jobs. Query: `?limit=100`

---

### GET `/print-jobs/queue`  🔒 Admin

Returns only jobs with status `waiting`, oldest first.

---

### GET `/print-jobs/order/:orderId`  🔒 Admin

Get all print jobs for a specific order.

---

### GET `/print-jobs/:jobId`  🔒 Admin

Get single print job.

---

### PATCH `/print-jobs/:jobId/status`  🔒 Admin

**Body**
```json
{
  "status": "printing",
  "printerName": "Brother MFC-L2750DW"
}
```

Valid transitions:
```
waiting  → printing | cancelled
printing → printed  | failed
failed   → waiting  (retry)
```

**Response 200** — Updated `PrintJob`

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `NOT_FOUND` | 404 | Resource does not exist |
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 422 | Request body failed Zod validation |
| `BAD_REQUEST` | 400 | Logical error (e.g. invalid status transition) |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
