import "dotenv/config";
import path from "node:path";
import { MAX_DOCUMENT_SIZE_BYTES } from "print-common";

/**
 * Centralized, validated application configuration. Every other module
 * reads config from here instead of touching `process.env` directly.
 */
export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  host: string;
  corsOrigin: string | string[];
  uploadDir: string;
  maxDocumentSizeBytes: number;
  wsPath: string;
  logLevel: string;
  /**
   * Fully-qualified base URL other services (print-agent, print-client)
   * use to reach this server, e.g. "http://192.168.1.50:4000". Needed
   * because `host` above is a bind address (commonly "0.0.0.0"), which
   * is not itself a usable URL host for outbound requests.
   */
  publicBaseUrl: string;
}

function parseNodeEnv(value: string | undefined): AppConfig["nodeEnv"] {
  if (value === "production" || value === "test") return value;
  return "development";
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Supports a comma-separated allow-list in CORS_ORIGIN. */
function parseCorsOrigins(value: string | undefined): string | string[] {
  if (!value || value.trim() === "*") return "*";
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0]! : origins;
}

export function loadConfig(): AppConfig {
  const port = parseIntEnv(process.env.PORT, 4000);
  return {
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
    port,
    host: process.env.HOST ?? "0.0.0.0",
    corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
    uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads"),
    maxDocumentSizeBytes: parseIntEnv(
      process.env.MAX_DOCUMENT_SIZE_BYTES,
      MAX_DOCUMENT_SIZE_BYTES
    ),
    wsPath: process.env.WS_PATH ?? "/ws",
    logLevel: process.env.LOG_LEVEL ?? "info",
    // In production, set PUBLIC_BASE_URL to the LAN/public address
    // print-agent and print-client actually use to reach this server.
    publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`).replace(/\/+$/, ""),
  };
}

export const config: AppConfig = loadConfig();
