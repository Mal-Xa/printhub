# print-server

Backend service that manages print jobs, connected Ubuntu print-agents, and
the print queue. **It never prints directly** — it accepts jobs over REST,
stores/queues them, and hands them off to connected print-agents over
WebSocket, tracking status/history along the way.

Depends on the shared **`print-common`** package for every domain model, API
DTO, validation schema, and WebSocket event definition. Nothing here
redefines a shared model — see "Suggested additions to print-common" below
for the one gap found while building this.

## Architecture

Clean Architecture, Repository Pattern, and constructor-based Dependency
Injection (a hand-wired composition root — no reflection/decorator DI
framework):

```
src/
  domain/            # Interfaces only — no I/O, no frameworks
    repositories/     # JobRepository, PrinterRepository, AgentRepository,
                       # QueueRepository, FileStorage, UploadedFileRepository
    gateways/          # RealtimeGateway (push/broadcast over WebSocket)
    errors/            # DomainError and subclasses, mapped to print-common's ErrorCode

  application/         # Business logic, depends only on domain interfaces
    services/          # JobService, PrinterService, AgentService,
                       # QueueService, UploadService

  infrastructure/      # Concrete adapters implementing domain interfaces
    persistence/in-memory/  # In-memory repository implementations
    storage/                 # LocalFileStorage (disk-backed FileStorage)
    websocket/                # ConnectionManager (RealtimeGateway impl), WsGateway
    logging/                  # pino logger

  presentation/http/    # Express: routes -> middlewares -> controllers -> services
    controllers/
    routes/
    middlewares/        # request-id, validation, error handling, upload (multer)

  config/
    env.ts             # Typed environment config
    container.ts       # Composition root: wires everything together

  index.ts             # Process entry point (HTTP + WS servers, graceful shutdown)
```

**Dependency direction:** `presentation -> application -> domain <- infrastructure`.
Application services never import from `infrastructure` or `presentation`;
they only see `domain/repositories` and `domain/gateways` interfaces, injected
via the constructor. Swapping the in-memory repositories for a database
(Postgres, Mongo, etc.) means writing new classes that implement the same
interfaces and changing a handful of `new InMemoryXxxRepository()` calls in
`config/container.ts` — no other file changes.

## Responsibilities

- **REST API** — jobs, printers, agents, uploads (`src/presentation/http`)
- **WebSocket server** — `WsGateway` at `config.wsPath` (default `/ws`)
- **File upload & storage** — multer (memory) -> `UploadService` -> `FileStorage` (disk)
- **Print queue** — `QueueService`, one ordered queue per printer (priority desc, FIFO within priority)
- **Connected agents** — `ConnectionManager` tracks live agent/client sockets
- **Push jobs to agents** — `agent:dispatch_job` / `agent:cancel_job` events
- **Receive status from agents** — `job:status_changed`, `job:progress`, `printer:status_changed`
- **Job history** — every status transition appended to `PrintJob.history`
- **Queue management** — enqueue, dequeue-on-dispatch, remove-on-cancel
- **Logging** — structured logging via `pino` (pretty-printed in development)

Explicitly **not** built (as scoped): authentication, payments, customer
accounts, dashboards, analytics, inventory, invoices.

## Running it

This package expects `print-common` to be a sibling directory:

```
workspace/
  print-common/
  print-server/
```

```bash
cd print-common && npm install && npm run build
cd ../print-server
cp .env.example .env
npm install
npm run dev        # ts-node-dev, auto-reload
# or
npm run build && npm start
```

Health check: `GET /healthz`.

## API surface

All request/response bodies are validated against **print-common**'s Zod
schemas and typed with its DTOs (`PrintRequest`, `PrintResponse`,
`AgentRegistrationRequest`, `UploadResponse`, `ApiErrorResponse`, etc.).

| Method | Path                          | Purpose                                   |
|--------|-------------------------------|--------------------------------------------|
| POST   | `/api/uploads`                | Upload a document (`multipart/form-data`, field `file`, plus `ownerId`) |
| POST   | `/api/jobs`                   | Create a print job (`PrintRequest`)        |
| GET    | `/api/jobs`                   | List jobs (pagination, filters, sort)      |
| GET    | `/api/jobs/:jobId`             | Get a job                                  |
| POST   | `/api/jobs/:jobId/cancel`      | Cancel a job                               |
| GET    | `/api/printers`               | List printers (lightweight `PrinterInfo`)  |
| GET    | `/api/printers/:printerId`     | Get full printer detail                    |
| POST   | `/api/agents/register`        | Register an agent + its printers           |
| POST   | `/api/agents/:agentId/heartbeat` | Agent heartbeat + printer status batch  |
| GET    | `/api/agents`                 | List agents                                |
| GET    | `/api/agents/:agentId`         | Get an agent                               |

Errors always come back as `ApiErrorResponse` (`{ error: { code, message,
details?, timestamp, requestId } }`) with an appropriate HTTP status.

## WebSocket protocol

Connect to `ws://<host>:<port>/ws`.

- **Print-agents** connect with an `x-agent-id` header set to the `agentId`
  returned from `POST /api/agents/register`. The server rejects the upgrade
  (code `4001`) if the agent id is unknown.
- **Print-clients** connect with no `x-agent-id` header and are treated as
  read-mostly subscribers to job/printer/agent/queue updates.

Every message is validated against print-common's `wsEventSchema` before
being routed. `connection:ping` is answered with `connection:pong`
automatically by the gateway. Malformed or unrecognized messages get a
`connection:error` reply rather than being silently dropped.

| Direction | Event | Purpose |
|---|---|---|
| agent -> server | `job:status_changed`, `job:progress` | Agent reports print progress/outcome |
| agent -> server | `printer:status_changed`, `printer:discovered` | Agent reports printer state |
| server -> agent | `agent:dispatch_job` | Server hands a queued job to the agent |
| server -> agent | `agent:cancel_job` | Server asks the agent to abort a job |
| server -> client | `job:status_changed`, `job:progress`, `printer:status_changed`, `agent:status_changed`, `queue:updated` | Live updates for UIs |

A transport-level (`ws` protocol) ping/pong sweep runs every 30s
independently of the above, to detect and terminate dead sockets.

## Design notes / trade-offs

- **In-memory persistence.** All repositories are in-memory (see
  `infrastructure/persistence/in-memory`) so the service runs with zero
  external dependencies out of the box. Every repository is defined as an
  interface in `domain/repositories` first — swapping in Postgres/Mongo/etc.
  is additive, not a rewrite.
- **Single-instance queue/dispatch.** `QueueService` and `ConnectionManager`
  hold state in the process. Running multiple instances behind a load
  balancer would need a shared queue (e.g. Redis) and sticky WebSocket
  routing or a pub/sub fan-out — out of scope for this deliverable but the
  `RealtimeGateway`/`QueueRepository` interfaces are the seams where that
  would plug in.
- **Auto-printer-selection.** If a `PrintRequest` omits `printerId`, the
  server assigns the first printer whose status is in
  `ASSIGNABLE_PRINTER_STATUSES`. There's no capability matching (paper size,
  color, etc.) — that would be a reasonable follow-up.
- **Retry policy.** `JobService` uses print-common's `RETRY_POLICY` /
  `JobStatus.RETRYING` to re-enqueue a job reported `FAILED` by an agent, up
  to `maxRetries`, before giving up.
- **Cross-package Zod instances.** Because `print-common` and `print-server`
  each resolve their own copy of the `zod` package (no dependency hoisting
  across the `file:` link), `err instanceof ZodError` is unreliable across
  the package boundary. The error handler checks the error's shape
  (`name === "ZodError"` + `issues` array) instead of its prototype chain.
  All request validation otherwise goes through `safeParse` + the service's
  own `ValidationError`, so this only matters as a defensive fallback.

## Suggested additions to print-common

While building this, one gap surfaced:

- **`ListAgentsRequest`** (or reusing `PaginationParams` directly) isn't
  currently exported alongside `ListJobsRequest`/`ListPrintersRequest`. This
  service validates `GET /api/agents` against the generic
  `paginationParamsSchema` instead; a dedicated type/schema would make the
  three list endpoints fully symmetric.

## Environment variables

See `.env.example`. Key ones: `PORT`, `HOST`, `CORS_ORIGIN`, `UPLOAD_DIR`,
`MAX_DOCUMENT_SIZE_BYTES`, `WS_PATH`, `LOG_LEVEL`.
