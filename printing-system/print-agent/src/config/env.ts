import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import { AGENT_HEARTBEAT } from "print-common";
import { defaultStateDir } from "../shared/paths";

const envSchema = z.object({
  PRINT_SERVER_HTTP_URL: z.string().url(),
  PRINT_SERVER_WS_URL: z.string().url(),
  PRINT_SERVER_API_KEY: z.string().min(1),
  AGENT_HOSTNAME: z.string().optional(),
  AGENT_STATE_DIR: z.string().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  PRINTER_DETECTION_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(60),
  QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(3000),
  CLEANUP_INTERVAL_SECONDS: z.coerce.number().int().min(30).default(600),
  TEMP_FILE_MAX_AGE_MINUTES: z.coerce.number().int().min(1).default(120),
});

export interface AppConfig {
  serverHttpUrl: string;
  serverWsUrl: string;
  apiKey: string;
  hostname: string;
  agentVersion: string;
  stateDir: string;
  downloadDir: string;
  logLevel: "trace" | "debug" | "info" | "warn" | "error";
  /** Fallback heartbeat interval, used only until print-server confirms its own via AgentRegistrationResponse. */
  defaultHeartbeatIntervalMs: number;
  printerDetectionIntervalMs: number;
  queuePollIntervalMs: number;
  cleanupIntervalMs: number;
  tempFileMaxAgeMinutes: number;
}

/** Reads the running package.json version, so it stays in sync automatically. */
function readAgentVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require("../../package.json") as { version?: string };
  return pkg.version ?? "0.0.0";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const stateDir = parsed.AGENT_STATE_DIR ?? defaultStateDir();

  return {
    serverHttpUrl: parsed.PRINT_SERVER_HTTP_URL.replace(/\/+$/, ""),
    serverWsUrl: parsed.PRINT_SERVER_WS_URL,
    apiKey: parsed.PRINT_SERVER_API_KEY,
    hostname: parsed.AGENT_HOSTNAME ?? os.hostname(),
    agentVersion: readAgentVersion(),
    stateDir,
    downloadDir: path.join(stateDir, "downloads"),
    logLevel: parsed.LOG_LEVEL,
    defaultHeartbeatIntervalMs: AGENT_HEARTBEAT.INTERVAL_SECONDS * 1000,
    printerDetectionIntervalMs: parsed.PRINTER_DETECTION_INTERVAL_SECONDS * 1000,
    queuePollIntervalMs: parsed.QUEUE_POLL_INTERVAL_MS,
    cleanupIntervalMs: parsed.CLEANUP_INTERVAL_SECONDS * 1000,
    tempFileMaxAgeMinutes: parsed.TEMP_FILE_MAX_AGE_MINUTES,
  };
}
