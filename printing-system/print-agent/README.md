# print-agent

Background service that connects to print-server, maintains a local
print queue, detects printers attached to this machine, and executes
print jobs through the local printing system (CUPS). Runs on Ubuntu
today; the Raspberry Pi Zero 2 W is a supported future target (see
`docs/ARCHITECTURE.md` for the choices made with that in mind).

It is **not** a printer-sharing service, not a web server, and does
not implement authentication, payments, customer management, or any
UI -- all of that belongs to print-server / print-client. print-agent
only waits for work and does it.

Every message this service sends or receives, and every job/printer/
agent model it works with, comes from `print-common`. See
`docs/PRINT_COMMON_GAPS.md` for the handful of places print-common
didn't have quite what was needed, and how that was handled without
duplicating any shared model.

## Requirements

- Node.js >= 18
- CUPS installed and at least one printer configured (`lpstat -p` should list it)
- A reachable print-server instance (REST + WebSocket)

## Setup

```bash
npm install
cp .env.example .env   # then edit .env with your print-server URL/API key
npm run build
npm start
```

For local iteration without a build step:

```bash
npm run dev
```

## Configuration

All configuration is environment variables, validated at startup (see
`src/config/env.ts`). See `.env.example` for the full list with
defaults and descriptions.

## Running as a systemd service

```bash
npm run build
sudo ./scripts/install-systemd.sh          # installs to /opt/print-agent
sudo nano /opt/print-agent/.env            # fill in real values
sudo systemctl start print-agent
sudo journalctl -u print-agent -f          # tail logs
```

See `systemd/print-agent.service` for the unit file itself (restart
policy, resource limits, and the dedicated `printagent` system user it
expects).

## Project layout

```
src/
  domain/          entities + port interfaces (no I/O)
  application/      use cases (business rules)
  infrastructure/    CUPS, filesystem, WebSocket, HTTP adapters
  interface/         WebSocket event routing
  bootstrap/         composition root (dependency injection)
  config/, shared/    env loading, small utilities
  app.ts, main.ts     process lifecycle, entry point
docs/
  ARCHITECTURE.md      full write-up of the design above
  PRINT_COMMON_GAPS.md  gaps found in print-common while building this, and how they were handled
systemd/, scripts/    systemd unit + install helper
```

See `docs/ARCHITECTURE.md` for the full design write-up: layering,
the local job queue's state machine, resilience/retry behavior, and
why both REST and WebSocket are used against the same backend.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # compile to dist/
```
