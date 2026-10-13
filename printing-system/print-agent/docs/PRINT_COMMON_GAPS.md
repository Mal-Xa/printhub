# print-common: gaps found while building print-agent

Per the project brief ("never redefine shared models... if additional
shared models are needed, list them as additions to print-common
instead of creating duplicates"), this document lists every place
print-agent needed something print-common doesn't currently provide.
print-agent does **not** define any duplicate/parallel model for these
-- each is either worked around pragmatically (documented inline in
code, and again here) or is a pure suggestion for print-common's
maintainers.

## 1. No agent-originated job status/progress event

`JobStatusChangedEvent`, `JobProgressEvent`, and `PrinterStatusChangedEvent`
are documented in `websocket/ws-events.model.ts` as `print-server ->
print-client` (or `print-client/print-agent`) only. There is no
distinct event for the reverse direction print-agent actually needs:
"this job I'm printing just changed status" or "this printer I manage
just changed status."

**What print-agent does today:** reuses the existing event types
bidirectionally (`ReportJobStatusUseCase`, `ReportJobProgressUseCase`,
and the status-change branch of `SyncPrintersUseCase`). The wire shape
is identical either direction and validates against the same
`wsEventSchema`, so this works today with zero schema changes, on the
assumption print-server treats an inbound message of this type (over
an authenticated agent connection) as a report rather than something
to rebroadcast verbatim.

**Suggested addition:** either (a) document these three event types as
explicitly bidirectional, or (b) add distinct agent-outbound variants
(e.g. `agent:job_status_report`, `agent:job_progress_report`,
`agent:printer_status_report`) if server/client and agent-origin
traffic ever need to be told apart at the type level.

## 2. No contract for registering a single printer after startup

`AgentRegistrationRequest` is a full-batch, registration-time shape
(the whole printer list, once). `PrinterDiscoveredEvent` looks like it
might cover "found a new printer," but its payload
(`{ printerId, agentId }`) assumes a `PrinterId` already exists --
which a brand-new, never-registered local printer doesn't have.

**What print-agent does today:** when `SyncPrintersUseCase` detects a
local printer with no entry in the agent's `printerIdByLocalName` map,
it re-runs the *entire* registration flow with the current printer
set. This works because registration already accepts (and returns ids
for) the full list, but it's more than the operation conceptually
needs, and briefly re-sends capabilities for printers that haven't
changed.

**Suggested addition:** a lightweight `POST /api/agents/:id/printers`
(or an `agent:register_printer` WS event) that accepts one printer and
returns one `PrinterId`, for the hot-plug/newly-installed-printer case.

## 3. `AgentRegistrationRequest.printers[].capabilities` duplicates `PrinterCapabilities`

In `api/api-requests.model.ts`, the capabilities object on
`AgentRegistrationRequest` is a hand-written inline type that happens
to be structurally identical to `interfaces/printer.interface.ts`'s
`PrinterCapabilities`, rather than importing it. Same underlying data,
two independent definitions to keep in sync by hand.

**What print-agent does today:** nothing needed -- TypeScript's
structural typing means passing an actual `PrinterCapabilities` value
here type-checks fine. Flagging it because it's exactly the kind of
drift-prone duplication the "never redefine shared models" rule is
meant to prevent, just found inside print-common itself.

**Suggested fix:** change that field's type to `PrinterCapabilities`
imported from `../interfaces`.

## 4. `AgentRegistrationRequest.printers[].protocol` is `string`, not `ConnectionProtocol`

Same file: the field is typed `string`, even though
`agentRegistrationRequestSchema` already validates it at runtime with
`connectionProtocolSchema` (i.e. `z.nativeEnum(ConnectionProtocol)`).
The runtime contract is already a strict enum; the compile-time type
is looser than it needs to be.

**Suggested fix:** type the field as `ConnectionProtocol`.

## 5. No authoritative way to distinguish "completed" from "failed" via CUPS CLI

Not a print-common gap, but worth recording here since it shapes how
print-agent uses print-common's `JobStatus` enum: `CupsPrintingSystem`
polls `lpstat -W not-completed -o` and treats a job's disappearance
from that list as `JobStatus.COMPLETED`. CUPS doesn't expose a
job's terminal outcome (success vs. driver/hardware failure) through
its command-line tools in a way that's cheap to parse -- both look the
same: the job is just gone. A future revision could query CUPS's IPP
`job-state` attribute directly (via `ipptool` or a small IPP client)
for an authoritative result; that's an implementation detail local to
print-agent; print-common's `JobStatus` enum already has everything
needed (`COMPLETED`, `FAILED`) once the underlying signal is better.

## 6. No universal `PaperSize` -> CUPS `media` keyword mapping

`PaperSize` values (`A4`, `A3`, `LETTER`, `LEGAL`, `TABLOID`) are
passed to CUPS's `-o media=...` option close to verbatim.
Real-world PPDs vary in exactly which media keyword string they
expect (e.g. `Letter` vs `na_letter_8.5x11in`), so this is inherently
driver-specific and not something a shared model can fully solve --
noting it here only so it isn't mistaken for an oversight. CUPS
silently ignores an unrecognized `-o media=` value and falls back to
the driver's default, so worst case is a wrong paper size rather than
a hard failure.
