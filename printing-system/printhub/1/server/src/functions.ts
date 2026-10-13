/**
 * functions.ts — Firebase Cloud Functions entrypoint
 *
 * Exports the Express app as a single Firebase HTTPS function called `api`.
 * All routes are served under:
 *   https://asia-south1-sora-s-print.cloudfunctions.net/api
 *
 * Or if you set up a rewrite in firebase.json:
 *   https://sora-s-print.web.app/api/...
 *
 * Firebase Functions v2 uses Application Default Credentials automatically —
 * no service account file or env vars needed in production.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import app from './app';
import { RealPrinterAdapter, setPrinterAdapter } from './jobs/printQueue.job';

// ── Initialise Firebase Admin (once, at cold-start) ──────────────────────────
// In the Functions runtime, initializeApp() with no arguments automatically
// uses the project's service account — no credentials file needed.

if (admin.apps.length === 0) {
  admin.initializeApp({
    storageBucket: process.env['STORAGE_BUCKET'] ?? 'sora-s-print.firebasestorage.app',
  });
}

// The controller triggers a one-off queue cycle after a print request.
// Configure that cycle with the real print-server bridge at cold start.
setPrinterAdapter(new RealPrinterAdapter());

// ── Global Function options ───────────────────────────────────────────────────

setGlobalOptions({
  region: 'asia-south1',   // Mumbai — closest to India
  memory: '512MiB',
  timeoutSeconds: 60,
  maxInstances: 10,
  minInstances: 0,          // scale to zero when idle
});

// ── Export the Express app as an HTTPS function ───────────────────────────────

export const api = onRequest(app);
