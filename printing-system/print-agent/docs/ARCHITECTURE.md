# print-agent architecture

## What this service is (and isn't)

print-agent is a long-running background daemon. It has no HTTP server,
no frontend, and no authentication/payments/customer-management logic
of its own -- all of that lives in print-server. print-agent's only
job is: stay connected to print-server, receive print jobs meant for
the printers attached to *this* machine, and get them printed.

It runs today on Ubuntu and is intended to later run unmodified on a
Raspberry Pi Zero 2 W, which shaped a few choices below (no native
Node addons, no heavy dependencies, modest memory footprint).

## Why both REST and WebSocket to the same backend

print-common defines both HTTP API request/response DTOs *and*
WebSocket event types, and both are used here, split by traffic
pattern:

- **REST (`BackendApiClient`)**: request/response, occasional --
  agent registration (`AgentRegistrationRequest/Response`), heartbeats
  (`HeartbeatRequest/Response`), and fetching a job's full record
  (`GetJobResponse`) after a dispatch. print-agent is only ever a
  *client* of this API -- it exposes no REST API of its own, per the
  brief.
- **WebSocket (`WebSocketClient`)**: push, real-time -- print-server
  telling the agent to start (`agent:dispatch_job`) or stop
  (`agent:cancel_job`) a job, plus the agent reporting status/progress
  back (see `docs/PRINT_COMMON_GAPS.md` #1 for how that reuses
  server-outbound event types).

A `DispatchJobEvent` only carries a `jobId` + `printerId`; the full
job record (document location, print options) is fetched via the REST
`GET /api/jobs/:id` endpoint, using `GetJobResponse`. This keeps the
WS payload small and reuses print-common's existing DTOs rather than
inventing a fatter dispatch event.

## Layering

```
src/
  domain/            entities + port (interface) definitions -- no I/O, no framework code
  application/        use cases -- orchestrate ports, hold all business rules
  infrastructure/      concrete adapters: CUPS, the filesystem, ws, fetch
  interface/           translates external WebSocket traffic into use-case calls
  bootstrap/           composition root -- the only place concrete classes are `new`-ed up
  config/, shared/     env loading, small cross-cutting helpers
  app.ts, main.ts      process lifecycle
```

Dependencies point inward: `infrastructure` and `interface` depend on
`domain` and `application`; nothing in `domain` or `application` ever
imports from `infrastructure`. Every external dependency (CUPS, the
local filesystem, `ws`, `fetch`) sits behind a `domain/ports/*`
interface, so swapping an implementation (e.g. a SQLite-backed queue
repository instead of the JSON-file one) never touches a use case.

## The local job queue

Every dispatched job gets a `LocalJobRecord` (see
`domain/entities/local-job-record.entity.ts`) persisted to
`<state-dir>/queue.json`, moving through:

```
PENDING_DOWNLOAD -> DOWNLOADING -> READY_TO_PRINT -> SUBMITTING -> PRINTING -> DONE
                                                                       |
                                                                       v (any stage)
                                                                    FAILED / CANCELLED
```

`ProcessJobQueueUseCase` runs on a timer (`QUEUE_POLL_INTERVAL_MS`),
advancing at most one in-flight action per local printer per tick
(download, submit, or poll-for-completion), ordered by job priority
then arrival time. This durability is what lets the agent survive a
crash or restart mid-job: on the next tick, whatever was in
`DOWNLOADING`/`READY_TO_PRINT` simply resumes.

Failures (download or print) go through `HandleJobFailureUseCase`,
which applies print-common's own `RETRY_POLICY` constants
(`MAX_RETRIES`, `BACKOFF_BASE_MS`, `BACKOFF_MULTIPLIER`) rather than
inventing agent-local retry numbers.

## Resilience

- **Registration** retries indefinitely with capped exponential
  backoff (`RegisterAgentUseCase`), so the service comes up cleanly
  even if it starts before print-server (or the network) is reachable
  -- common at boot on a Pi.
- **WebSocket** reconnects automatically with capped exponential
  backoff (`WebSocketClient`), and re-answers `connection:ping` with
  `connection:pong` at the transport layer.
- **Heartbeat reconciliation**: `HeartbeatResponse.pendingJobIds` is
  cross-checked against the local queue every heartbeat, so a dispatch
  event missed during a brief disconnect still gets picked up
  (`SendHeartbeatUseCase` -> `EnqueueDispatchedJobUseCase`).
- **Temp files**: cleaned up immediately when a job finishes
  (success, failure, or cancellation), plus a periodic sweep
  (`CleanupTempFilesUseCase`) for anything orphaned by a crash.

## Local persistence choice

Agent state (identity, printer cache, job queue) is stored as flat
JSON files (`infrastructure/persistence/json-file-store.ts`) rather
than SQLite. For the data volumes involved (a handful of printers, at
most a few dozen in-flight jobs), this is durable enough and avoids a
native dependency that can be awkward to prebuild for a Pi Zero 2 W's
armv7/aarch64 target. The `JobQueueRepository` /
`PrinterRepository` / `AgentIdentityRepository` interfaces don't leak
this choice, so a SQLite-backed implementation could be dropped in
later without touching any use case.

## Local printing via CUPS CLI, not a native binding

`CupsPrintingSystem` shells out to `lpstat`, `lp`, `lpoptions`, and
`cancel` rather than linking against `libcups` through a native Node
addon. Slightly more string-parsing, but zero native compilation --
again, chosen with the Pi Zero 2 W target in mind. Its known
limitation (can't cheaply distinguish "printed successfully" from
"CUPS dropped it after a driver error") is documented in
`docs/PRINT_COMMON_GAPS.md` #5.
