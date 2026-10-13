# print-common (v1.0)

Source-of-truth shared TypeScript package for the distributed printing
system. This is a **pure contract library** — types, enums, constants,
and `zod` validation schemas only. It contains **no business logic, no
I/O, no HTTP/WebSocket clients, and no printing logic**.

Consumed by:

- **print-server** — central coordinator/API
- **print-agent** — process running alongside physical/virtual printers
- **print-client** — end-user-facing app

## Folder structure

```
print-common/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                     # root barrel export
    ├── enums/
    │   ├── job-status.enum.ts        # JobStatus
    │   ├── printer-status.enum.ts    # PrinterStatus
    │   ├── agent-status.enum.ts      # AgentStatus
    │   ├── print-options.enum.ts     # ColorMode, DuplexMode, PaperSize, PrintQuality, ConnectionProtocol
    │   └── error-code.enum.ts        # ErrorCode
    ├── interfaces/
    │   ├── printer.interface.ts      # Printer, PrinterCapabilities, PrinterInfo
    │   ├── job.interface.ts          # PrintJob, QueueItem, PrintOptions, DocumentRef
    │   └── agent.interface.ts        # AgentInfo, UserRef
    ├── api/
    │   ├── api-requests.model.ts     # UploadRequest, PrintRequest, CancelJobRequest, AgentRegistrationRequest, HeartbeatRequest, ...
    │   └── api-responses.model.ts    # UploadResponse, PrintResponse, CancelJobResponse, JobStatusResponse, PrinterStatusResponse, AgentRegistrationResponse, HeartbeatResponse, ...
    ├── errors/
    │   └── error.model.ts            # ErrorDetail, AppError, ApiErrorResponse
    ├── websocket/
    │   └── ws-events.model.ts        # WsEvent discriminated union + isWsEventType guard
    ├── validation/
    │   ├── common.schema.ts          # shared zod primitives + enum schemas
    │   ├── domain.schema.ts          # zod schemas for Printer, PrintJob, AgentInfo, ...
    │   ├── api-requests.schema.ts    # zod schemas mirroring every request model
    │   ├── error.schema.ts           # zod schema for AppError
    │   └── ws-events.schema.ts       # zod discriminated union for WsEvent
    ├── constants/
    │   └── index.ts                  # defaults, retry policy, heartbeat intervals, WS channel names, HTTP headers
    └── utils/
        ├── types.ts                  # Nullable, Optional, DeepPartial, PaginatedResult, Brand<T>, JobId/PrinterId/AgentId/...
        └── brand.ts                  # asJobId/asPrinterId/... branded-id cast helpers
```

## Named exports (as required)

`JobStatus`, `PrinterStatus`, `AgentStatus`, `PrintJob`, `Printer`,
`PrinterCapabilities`, `PrinterInfo`, `AgentInfo`, `QueueItem`,
`UploadRequest`, `UploadResponse`, `PrintRequest`, `PrintResponse`,
`CancelJobRequest`, `CancelJobResponse`, `JobStatusResponse`,
`PrinterStatusResponse`, `AgentRegistrationRequest`,
`AgentRegistrationResponse`, `HeartbeatRequest`, `HeartbeatResponse`,
plus the full `WsEvent` union and matching `zod` schemas for every
model above.

## Install (within a monorepo/workspace)

```jsonc
// package.json of print-server / print-agent / print-client
{
  "dependencies": {
    "print-common": "workspace:^1.0.0"
  }
}
```

Or as a git/tarball dependency if not using workspaces:

```jsonc
{
  "dependencies": {
    "print-common": "file:../print-common"
  }
}
```

## Usage

```ts
import {
  JobStatus,
  PrintJob,
  PrintRequest,
  printRequestSchema,
  WsEvent,
  isWsEventType,
  DEFAULT_PRINT_OPTIONS,
  asJobId,
} from "print-common";

// Validate an incoming request body (print-server)
function handlePrintRequest(body: unknown): PrintRequest {
  return printRequestSchema.parse(body);
}

// Narrow a WebSocket event by type (print-client / print-agent)
function onEvent(event: WsEvent) {
  if (isWsEventType(event, "job:status_changed")) {
    console.log(event.payload.jobId, event.payload.status);
  }
}
```

Subpath imports are also available if you only need one slice of the
package, e.g. `import { JobStatus } from "print-common/enums"`.

## Build

```bash
npm install
npm run build       # emits dist/ with .js + .d.ts + source maps
npm run typecheck    # type-check only, no emit
```

Verified: builds cleanly under `strict: true` with
`noUnusedLocals`/`noUnusedParameters`/`noUncheckedIndexedAccess`
enabled, and all `zod` schemas round-trip correctly at runtime.

## Design rules for contributors

1. **No business logic.** No database calls, no HTTP/WebSocket
   clients, no filesystem access, no scheduling/queueing behavior —
   only types, enums, schemas, and pure constant values.
2. **`zod` is the only runtime dependency.** Everything else
   (TypeScript, linting, build tooling) stays a `devDependency`.
3. **Prefer additive changes.** Since three services depend on this
   package, prefer new optional fields / new enum members over
   breaking renames. Breaking changes require a coordinated version
   bump (`print-common` v2.0) across all three consumers.
4. **Every request/response model gets a matching zod schema** in
   `src/validation`, kept in the same shape as its TypeScript
   counterpart so `z.infer<>` and the hand-written interface never
   drift apart silently.
