import { env } from '../config/env';
import {
  PrintServerListResponse,
  PrintServerPrinter,
  PrintServerPrinterInfo,
  PrintServerQueueItem,
  PrintServerSuccessResponse,
} from '../lib/printServerContracts';

/**
 * Printer shape exposed by Sora's server to every printer-related surface
 * (print review page, navbar widget, admin printers page). One shared
 * source of truth so all three read the exact same live data instead of
 * three independently-mocked paths.
 */
export interface LivePrinter {
  id: string;
  name: string;
  location?: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR' | 'WARNING' | 'MAINTENANCE' | 'UNKNOWN';
  capabilities: {
    supportsColor: boolean;
    supportsDuplex: boolean;
    maxDpi: number;
    supportedPaperSizes: string[];
    maxCopiesPerJob: number;
    maxDocumentSizeBytes: number;
  };
  consumables?: { tonerOrInkPercent?: number; paperTrayEmpty: boolean };
  lastSeenAt: string;
}

export interface LivePrinterList {
  /** false if print-server itself could not be reached at all — distinct from "0 printers online". */
  printServerReachable: boolean;
  printers: LivePrinter[];
  fetchedAt: string;
}

function baseUrl(): string {
  return env.printServer.baseUrl.replace(/\/$/, '');
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.printServer.requestTimeoutMs);
  try {
    const res = await fetch(`${baseUrl()}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`print-server ${path} responded ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

let cache: { data: LivePrinterList; expiresAt: number } | null = null;
let inFlight: Promise<LivePrinterList> | null = null;

async function fetchLivePrinters(): Promise<LivePrinterList> {
  try {
    const list = await fetchJson<PrintServerListResponse<PrintServerPrinterInfo>>(
      '/api/printers?pageSize=200',
    );

    // The list endpoint only returns a lightweight PrinterInfo projection
    // (no capabilities beyond color/duplex/maxCopies, no lastSeenAt/
    // consumables) — fetch each printer's full record in parallel so the
    // print review page's capability-mismatch warnings and the navbar's
    // last-seen timestamps have what they need.
    const full = await Promise.all(
      list.data.map(async (p): Promise<LivePrinter | null> => {
        try {
          const detail = await fetchJson<PrintServerSuccessResponse<PrintServerPrinter>>(
            `/api/printers/${encodeURIComponent(p.id)}`,
          );
          const printer = detail.data;
          return {
            id: printer.id,
            name: printer.name,
            location: printer.location,
            status: printer.status,
            capabilities: printer.capabilities,
            consumables: printer.consumables,
            lastSeenAt: printer.lastSeenAt,
          };
        } catch {
          // Fall back to the lightweight projection rather than dropping
          // the printer entirely — better to show partial info than none.
          return {
            id: p.id,
            name: p.name,
            location: p.location,
            status: p.status,
            capabilities: {
              supportsColor: p.capabilities.supportsColor,
              supportsDuplex: p.capabilities.supportsDuplex,
              maxDpi: 0,
              supportedPaperSizes: [],
              maxCopiesPerJob: p.capabilities.maxCopiesPerJob,
              maxDocumentSizeBytes: 0,
            },
            lastSeenAt: new Date(0).toISOString(),
          };
        }
      }),
    );

    return {
      printServerReachable: true,
      printers: full.filter((p): p is LivePrinter => p !== null),
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      printServerReachable: false,
      printers: [],
      fetchedAt: new Date().toISOString(),
    };
  }
}

export const PrinterBridgeService = {
  /**
   * Returns the live printer list, cached for a few seconds so the print
   * page / admin printers page / navbar widget (all polling independently)
   * don't hammer print-server on every client request.
   */
  async getLivePrinters(opts?: { forceRefresh?: boolean }): Promise<LivePrinterList> {
    const now = Date.now();
    if (!opts?.forceRefresh && cache && cache.expiresAt > now) {
      return cache.data;
    }
    // Coalesce concurrent refreshes into a single upstream call.
    if (!inFlight) {
      inFlight = fetchLivePrinters().finally(() => {
        inFlight = null;
      });
    }
    const data = await inFlight;
    cache = { data, expiresAt: now + env.printServer.printerCacheTtlMs };
    return data;
  },

  async getPrinterById(id: string): Promise<LivePrinter | null> {
    const { printers } = await this.getLivePrinters();
    return printers.find((p) => p.id === id) ?? null;
  },

  async getPrinterQueue(id: string): Promise<PrintServerQueueItem[]> {
    const res = await fetchJson<PrintServerListResponse<PrintServerQueueItem>>(
      `/api/printers/${encodeURIComponent(id)}/queue`,
    );
    return res.data;
  },

  /** Cheap standalone reachability check — used by the queue worker's isAvailable(). */
  async isReachable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.printServer.requestTimeoutMs);
      try {
        const res = await fetch(`${baseUrl()}/healthz`, { signal: controller.signal });
        return res.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return false;
    }
  },
};
