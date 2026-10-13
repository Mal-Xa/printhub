import admin from 'firebase-admin';
import { env } from './env';

/**
 * Initialise Firebase Admin SDK.
 *
 * Called by server.ts (standalone) or directly by functions.ts (Cloud Functions).
 * Safe to call multiple times — guards against double-init.
 *
 * Credential resolution order:
 *  1. Service account JSON file  (FIREBASE_SERVICE_ACCOUNT_PATH — local dev)
 *  2. Individual env vars         (FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY — Docker/VPS)
 *  3. Application Default Creds   (Cloud Run / Firebase Functions — automatic)
 */
export function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  let credential: admin.credential.Credential;

  if (env.firebase.serviceAccountPath) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(env.firebase.serviceAccountPath);
    credential = admin.credential.cert(serviceAccount);
    console.log('[Firebase] Using service account key file');
  } else if (env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey) {
    credential = admin.credential.cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    });
    console.log('[Firebase] Using env-var service account');
  } else {
    // Firebase Functions / Cloud Run — runtime provides credentials automatically
    credential = admin.credential.applicationDefault();
    console.log('[Firebase] Using Application Default Credentials');
  }

  const app = admin.initializeApp({
    credential,
    storageBucket: env.firebase.storageBucket,
  });

  console.log(`[Firebase] Initialised — bucket: ${env.firebase.storageBucket}`);
  return app;
}

export function getFirestore(): admin.firestore.Firestore {
  return admin.firestore();
}

export function getAuth(): admin.auth.Auth {
  return admin.auth();
}

export function getStorage(): admin.storage.Storage {
  return admin.storage();
}

// ── Collection name constants ─────────────────────────────────────────────────

export const COLLECTIONS = {
  USERS: 'users',
  ORDERS: 'orders',
  FILES: 'files',
  PASSPORT_SHEETS: 'passportSheets',
  PRICING: 'pricing',
  NOTIFICATIONS: 'notifications',
  PRINT_JOBS: 'printJobs',
  PRINTERS: 'printers',
  ACTIVITY_LOGS: 'activityLogs',
} as const;

export const PRICING_DOC_ID = 'default';
