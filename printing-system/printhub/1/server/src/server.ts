/**
 * server.ts — Standalone HTTP server (Docker / VPS / local dev)
 *
 * This file is the entrypoint when running outside Firebase Functions.
 * It initialises Firebase, then starts Express on the configured PORT.
 *
 * Usage:
 *   npm run dev          → ts-node-dev src/server.ts
 *   npm start            → node lib/server.js
 */

import 'dotenv/config';
import { initFirebase } from './config/firebase';
import { env } from './config/env';
import app from './app';
import { RealPrinterAdapter, setPrinterAdapter, startPrintQueueWorker } from './jobs/printQueue.job';

// Initialise Firebase Admin SDK before the server starts
initFirebase();

// Bridge the print queue to the real printing-system (print-server). Only
// wired up here (the standalone/Docker/VPS entrypoint) — NOT in
// functions.ts, since Cloud Functions v2 scales to zero between requests
// and can't host a persistent setInterval poller.
setPrinterAdapter(new RealPrinterAdapter());
startPrintQueueWorker();

const server = app.listen(env.port, () => {
  console.log(`[Server] Sora Print Hub API running on port ${env.port} (${env.nodeEnv})`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

export default server;
