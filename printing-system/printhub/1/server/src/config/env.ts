import dotenv from 'dotenv';

dotenv.config();

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function optionalNum(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) throw new Error(`Env var ${key} must be a number, got: ${raw}`);
  return parsed;
}

// Returns '*' (wildcard string) when CORS_ORIGINS is unset, or a trimmed
// string[] when it is set.  The '*' string is what the cors package needs
// to emit Access-Control-Allow-Origin: * — an array ['*'] is NOT the same
// thing and would only allow the literal string '*' as an origin.
function parseCorsOrigins(): string | string[] {
  const raw = process.env['CORS_ORIGINS'];
  if (!raw || raw.trim() === '*') return '*';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(origin => {
      try {
        const url = new URL(origin);
        return url.origin;
      } catch {
        return origin.replace(/\/+$/, '');
      }
    });
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  port: optionalNum('PORT', 4000),
  corsOrigins: parseCorsOrigins(),

  firebase: {
    serviceAccountPath: process.env['FIREBASE_SERVICE_ACCOUNT_PATH'],
    projectId: process.env['FIREBASE_PROJECT_ID'],
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
    privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
    // Optional in Firebase Functions — runtime sets storageBucket automatically
    storageBucket: optional('FIREBASE_STORAGE_BUCKET', 'sora-s-print.firebasestorage.app'),
  },

  rateLimit: {
    windowMs: optionalNum('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    // Print status/printer polling can legitimately make hundreds of API
    // requests during a busy 15-minute window. This is still rate-limited,
    // but is high enough for normal shop use.
    max: optionalNum('RATE_LIMIT_MAX', 1000),
  },

  maxFileSizeBytes: optionalNum('MAX_FILE_SIZE_MB', 50) * 1024 * 1024,
  signedUrlExpiryMinutes: optionalNum('SIGNED_URL_EXPIRY_MINUTES', 60),

  logLevel: optional('LOG_LEVEL', 'info'),
  isDev: optional('NODE_ENV', 'development') === 'development',
  isProd: process.env['NODE_ENV'] === 'production',

  // ── printing-system bridge ─────────────────────────────────────────────
  printServer: {
    /** Base URL of print-server's HTTP API (no trailing slash, no /api suffix). */
    baseUrl: optional('PRINT_SERVER_URL', 'http://localhost:4000'),
    /**
     * print-server's PrintRequest/UploadRequest require a non-empty
     * `ownerId`. print-server has no concept of individual Sora users, so
     * every job is submitted under one fixed owner id representing this
     * whole integration.
     */
    ownerId: optional('PRINT_SERVER_OWNER_ID', 'sora-print-hub'),
    /** How long the live printer-list proxy cache is considered fresh. */
    printerCacheTtlMs: optionalNum('PRINT_SERVER_PRINTER_CACHE_TTL_MS', 5000),
    /** Timeout for any single HTTP call to print-server. */
    requestTimeoutMs: optionalNum('PRINT_SERVER_REQUEST_TIMEOUT_MS', 8000),
  },
} as const;
