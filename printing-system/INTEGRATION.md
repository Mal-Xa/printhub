# Integration Report — Distributed Printing System

This document records the integration work done to turn four
independently-developed projects (`print-common`, `print-server`,
`print-agent`, `print-client`) into one working, buildable, runnable
system, without redesigning any of them.

## 1. Architecture diagram

```
                         ┌─────────────────────────┐
                         │       print-common      │
                         │  (types / enums / zod /  │
                         │   constants / WS events) │
                         └────────────┬────────────┘
                     imported by all three services
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
   ┌──────────▼──────────┐ ┌──────────▼──────────┐ ┌──────────▼──────────┐
   │     print-client     │ │     print-server     │ │     print-agent      │
   │  React + Vite (SPA)  │ │  Express + ws (API)  │ │  Node.js daemon      │
   │  runs in a browser   │ │  runs on a server /   │ │  runs next to a     │
   │  on the LAN          │ │  container            │ │  physical printer   │
   └──────────┬───────────┘ └──────────┬───────────┘ └──────────┬───────────┘
              │                        │                        │
              │  REST (poll, no WS)    │                        │  REST (register,
              │  GET/POST /api/*       │                        │  heartbeat, job
              │─────────────────────► │ ◄─────────────────────│  status, file GET)
              │                        │                        │
              │                        │  WebSocket /ws         │
              │                        │  (job dispatch/cancel, │
              │                        │◄──────────────────────►│  status/queue events)
              │                        │                        │
              │                        │                        │
              │                        │   1. print-client uploads a document
              │                        │      → POST /api/uploads
              │                        │   2. print-client creates a job
              │                        │      → POST /api/jobs { fileId, printerId, options }
              │                        │   3. print-server enqueues the job, tells the
              │                        │      right print-agent via WS: agent:dispatch_job
              │                        │   4. print-agent downloads the file over HTTP
              │                        │      → GET {PUBLIC_BASE_URL}/api/files/:fileId
              │                        │   5. print-agent sends job progress / completion
              │                        │      back over WS: job:status_changed / job:progress
              │                        │   6. print-client polls
              │                        │      GET /api/jobs/:jobId/status for live updates
              └────────────────────────┴────────────────────────┘
```

Design intent preserved from the original projects:
- **print-client deliberately has no WebSocket client** — it polls REST endpoints. This keeps the LAN-facing browser app dependency-light (documented in its own `useJobs`/`usePrinters` hooks). Not a bug — left as-is.
- **print-server never talks to a printer directly** — only print-agent does. print-server is transport/coordination only.
- **print-agent is the only process with local filesystem/CUPS access.** It downloads job documents over HTTP rather than sharing a filesystem with print-server, so the two can run on entirely separate machines.

## 2. What was wrong, and what was fixed

| # | Problem | Where | Fix |
|---|---|---|---|
| 1 | No root workspace; 4 unlinked projects, 4 lockfiles | repo root | Added root `package.json` with npm `workspaces` |
| 2 | `print-common` duplicated byte-for-byte inside `print-client/packages/print-common` | print-client | Removed the duplicate; flattened `print-client` out of its nested workspace |
| 3 | Three different dependency mechanisms for the same package (`file:../print-common`, pinned version in a nested workspace) | print-server, print-agent, print-client | Normalized all three to `"print-common": "*"` resolved via the npm workspace |
| 4 | Stray stale `vite.config.js` committed next to the real `vite.config.ts` | print-client | Removed the duplicate |
| 5 | Client calls `GET /api/jobs/:jobId/status`, `GET /api/printers/:printerId/status`, `GET /api/printers/:printerId/queue` — **none existed** on the server | print-server routes | Added all three; the queue endpoint just exposes the already-existing `QueueService.getQueue()` |
| 6 | Agent POSTs heartbeats to `/api/agents/heartbeat`; server only exposes `/api/agents/:agentId/heartbeat` → every heartbeat 404'd | print-agent `backend-api-client.ts` | Route builder now embeds the agent id in the path |
| 7 | Agent's `WebSocketClient` captured `agentId` once at construction, **before** registration ran. On a fresh install (no persisted identity) the first WS connection authenticated with the machine hostname instead of the server-assigned id and was rejected forever | print-agent `websocket-client.ts`, `register-agent.use-case.ts`, `app.ts` | Added `setAgentId()` to the transport; `RegisterAgentUseCase` now returns the real id; `Application.start()` calls `setAgentId()` before `connect()` |
| 8 | Server stored uploaded files as `storageUri: "file://<server-local-path>"` and exposed **no route** to fetch file bytes at all — but `print-agent`'s `HttpFileDownloader` does `fetch(document.storageUri)` directly | print-server upload/job services, routes | Added `PUBLIC_BASE_URL` config, a new `GET /api/files/:fileId` route, and rewired `UploadService`/`JobService` to expose a fully-qualified, fetchable URL in every `DocumentRef` that leaves the server, while keeping the internal `file://` URI for the server's own bookkeeping |
| 9 | `AgentRegistrationRequest.printers` was validated with `.min(1)` — a freshly-provisioned agent with zero local printers (a completely normal state) could never register | print-common validation schema | Removed the `.min(1)` constraint |
| 10 | `print-agent/.env.example` defaulted to port 3000; `print-server`'s real default is 4000 | env examples | Aligned defaults; documented `PUBLIC_BASE_URL` |

All ten fixes were verified by actually **running** the built system (see "Verification performed" below), not just by reading the code.

## 3. Folder structure (after integration)

```
printing-system/
├── package.json                 # root npm workspace: joins all 4 packages
├── INTEGRATION.md                # this document
│
├── print-common/                 # shared contracts — no business logic
│   ├── package.json               # dual CJS+ESM build (see note below)
│   ├── tsconfig.json               # CJS build → dist/cjs
│   ├── tsconfig.esm.json           # ESM build → dist/esm
│   └── src/
│       ├── enums/                  # JobStatus, PrinterStatus, AgentStatus, ...
│       ├── interfaces/              # Printer, PrintJob, AgentInfo, QueueItem, ...
│       ├── api/                     # request/response models
│       ├── errors/                  # AppError, ErrorCode
│       ├── websocket/                # WsEvent discriminated union
│       ├── validation/                # zod schemas mirroring every model
│       ├── constants/                  # defaults, retry policy, WS channel names
│       └── utils/                       # branded IDs, PaginatedResult, etc.
│
├── print-server/                  # Express + ws API, in-memory persistence
│   ├── package.json                 # depends on "print-common": "*"
│   └── src/
│       ├── domain/                    # entities, repository/gateway interfaces, errors
│       ├── application/services/       # JobService, PrinterService, AgentService, QueueService, UploadService
│       ├── infrastructure/               # in-memory repos, LocalFileStorage, WsGateway
│       ├── presentation/http/             # controllers, routes, middlewares, app.ts
│       └── config/                         # env.ts, container.ts (composition root)
│
├── print-agent/                   # Node.js daemon, runs beside a printer
│   ├── package.json                 # depends on "print-common": "*"
│   └── src/
│       ├── domain/                    # ports (ws transport, backend API, file downloader)
│       ├── application/use-cases/      # RegisterAgent, SendHeartbeat, DownloadJobFile, ...
│       ├── infrastructure/               # BackendApiClient, WebSocketClient, HttpFileDownloader
│       ├── bootstrap/container.ts         # composition root
│       └── app.ts, main.ts                 # orchestration + entrypoint
│
└── print-client/                  # React + Vite SPA (flattened; no more nested workspace)
    ├── package.json                 # depends on "print-common": "*"
    ├── vite.config.ts
    └── src/
        ├── api/                       # http.ts, printApi.ts
        ├── hooks/                      # useJobs, usePrinters, usePolling (REST polling, no WS)
        ├── components/                   # FileDropzone, JobQueueList, PrinterPicker, ...
        └── lib/                            # status.ts, format.ts, env.ts
```

**Note on `print-common`'s dual build:** `print-server`/`print-agent` run under Node and `require()` this package (CommonJS); `print-client` is bundled by Vite/Rollup, which does static analysis of named exports and could not reliably see them through the CJS re-export chain (`export * from` compiled to `__exportStar(require(...))`, several barrels deep). Rather than change every consumer, `print-common` now builds **both** `dist/cjs` and `dist/esm`, and `package.json#exports` gives each consumer the format it actually understands (`require` → CJS, `import` → ESM). No source code changed to work around this — only the build output.

## 4. Commands to run

From the repo root:

```bash
# one-time setup
npm install                 # installs and links all 4 workspace packages

# build (order matters: print-common must build before the other three)
npm run build                # builds all four in the correct order
# or individually:
npm run build:common
npm run build:server
npm run build:agent
npm run build:client

# type-check without emitting (fast CI check)
npm run typecheck
```

Running each service (in separate terminals), after `npm run build`:

```bash
# 1. print-server
cd print-server
cp .env.example .env        # edit PUBLIC_BASE_URL if agent/client run on other machines
mkdir -p uploads
node dist/index.js          # listens on :4000 (HTTP) and /ws (WebSocket)

# 2. print-agent (on the machine physically connected to a printer)
cd print-agent
cp .env.example .env        # set PRINT_SERVER_HTTP_URL / PRINT_SERVER_WS_URL to point at print-server
node dist/main.js

# 3. print-client (development)
cd print-client
cp .env.example .env        # set the API base URL to print-server's address
npm run dev                  # Vite dev server on :5173
# or for a production build:
npm run build && npm run preview
```

## 5. Verification performed

This wasn't just read-through review — the fixes were exercised against the real, built artifacts:
- `npm run build` succeeds cleanly for all four packages (including the Vite production bundle).
- Booted `print-server` and confirmed `GET /api/printers`, CORS preflight, and structured logging all work.
- Booted `print-agent` against the live server and confirmed, in order: successful registration (even with **zero** local printers), an accepted WebSocket connection using the **correct server-assigned agent id on the very first boot**, and successful heartbeats hitting `/api/agents/:agentId/heartbeat`.
- Uploaded a file, confirmed the returned `storageUri` is a fully-qualified URL, and confirmed `curl`-ing that URL returns the original file bytes.
- Registered an agent with one printer, created a print job against it, and confirmed all three new endpoints (`/api/jobs/:id/status`, `/api/printers/:id/status`, `/api/printers/:id/queue`) return correctly-shaped, correct data — including the queue updating once a job was created.

## 6. Remaining issues (not fixed — out of scope for "integrate, don't redesign")

- **No real authentication.** `print-agent` sends `x-api-key` on every request and print-server's `.env.example` documents `PRINT_SERVER_API_KEY`, but the server never actually validates it. Anyone who can reach the server's port can register fake agents, cancel jobs, or download any uploaded file by guessing/enumerating `fileId`s. Fine for a trusted LAN prototype; not production-ready.
- **In-memory persistence.** All server-side repositories (`InMemoryJobRepository`, `InMemoryPrinterRepository`, etc.) lose all state on restart. There's no database.
- **No file cleanup policy on the server.** Uploaded files accumulate in `uploads/` forever; there's no equivalent of print-agent's own `TEMP_FILE_MAX_AGE_MINUTES` sweep on the server side.
- **`print-client` uses polling, not push.** This was an intentional, documented design choice in the original code, but it does mean job/printer updates can lag up to one polling interval behind reality. Left as-is per "don't redesign," but worth knowing.
- **No end-to-end/integration test suite.** Verification for this task was done manually against running processes; there's no automated test that would catch a regression of any of the 10 fixes above.
- **CORS defaults to `*`.** Fine for local development; should be locked down to the real client origin(s) before any real deployment.

## 7. Suggestions for future improvement

1. **Add an integration test suite** (e.g. a lightweight script that boots print-server + print-agent + hits the REST API, similar to the manual verification above but automated and run in CI) — this is the highest-leverage next step, since it would have caught fixes #5–#9 automatically.
2. **Real auth**: a shared secret or per-agent API key checked by real middleware on print-server, plus signed/expiring download URLs for `/api/files/:fileId` instead of a guessable UUID.
3. **Swap in-memory repositories for a real datastore** (Postgres/SQLite) — the existing repository *interfaces* in `domain/repositories` were clearly designed for exactly this kind of swap; no application-layer changes should be needed.
4. **Server-side file retention policy** mirroring the agent's own cleanup sweep.
5. **Consider a typed API client generated from `print-common`'s zod schemas** (e.g. via `zod-to-openapi` or similar) so print-client's `printApi.ts` and print-server's routes can be checked against each other automatically instead of relying on manual review — this class of bug (endpoints the client calls that the server never defined) is exactly what happened here and is easy to reintroduce.
6. **Document the WS protocol formally** (an AsyncAPI spec generated from `print-common`'s `WsEvent` union) alongside a possible future move of `print-client` from polling to a real WS subscription, if update latency ever becomes a problem.
