/**
 * Print Queue Job — bridges Sora's print jobs to the real printing-system
 * (print-server / print-agent) via RealPrinterAdapter.
 *
 * Polls the `printJobs` Firestore collection and:
 *  - submits newly-`waiting` jobs to print-server (uploads the file, creates
 *    the remote job, stores the returned remoteJobId), one at a time so
 *    queue order is preserved;
 *  - polls print-server for status on every job currently `printing`, and
 *    reflects real state (waiting/printing/printed/failed) back onto Sora's
 *    own record — submission is fire-and-forget from print-server's point
 *    of view, so completion is only ever observed via polling, never
 *    assumed synchronously after submit.
 *
 * Run as a built-in worker: startPrintQueueWorker() is called from
 * server.ts's standalone (Docker/VPS) boot path — NOT from functions.ts,
 * since Cloud Functions v2 scales to zero between requests and can't host
 * a persistent setInterval poller. Swap adapters via setPrinterAdapter().
 * Run standalone: ts-node src/jobs/printQueue.job.ts
 */

import { PrintJobRepository } from '../repositories/printJob.repository';
import { PrintJob, PrintJobStatus } from '../types';
import { nowISO } from '../utils/id';
import { env } from '../config/env';
import { PrinterBridgeService } from '../services/printerBridge.service';
import { toPrintServerOptions } from '../lib/printOptionsMapper';
import {
  PrintServerJobStatus,
  PrintServerJobStatusResponse,
  PrintServerPrintRequest,
  PrintServerSuccessResponse,
  PrintServerUploadResponse,
} from '../lib/printServerContracts';

const POLL_INTERVAL_MS = 10_000;

// ── Printer adapter interface ─────────────────────────────────────────────────

export type AdapterUnavailableReason = 'print_server_unreachable' | 'no_printers_online';

export interface PrinterAdapterAvailability {
  ok: boolean;
  reason?: AdapterUnavailableReason;
}

interface PrinterAdapter {
  isAvailable(): Promise<PrinterAdapterAvailability>;
  submitJob(job: PrintJob): Promise<{ remoteJobId: string }>;
  pollStatus(remoteJobId: string): Promise<{ status: PrintJobStatus; message?: string }>;
}

const noOpAdapter: PrinterAdapter = {
  async isAvailable() {
    return { ok: false, reason: 'print_server_unreachable' };
  },
  async submitJob(job) {
    console.log(`[PrintQueue] No-op: would submit job ${job.id} (${job.fileName})`);
    throw new Error('No printer adapter configured');
  },
  async pollStatus() {
    throw new Error('No printer adapter configured');
  },
};

// ── Real adapter — bridges to printing-system's print-server ─────────────────

function baseUrl(): string {
  return env.printServer.baseUrl.replace(/\/$/, '');
}

function mapRemoteStatus(status: PrintServerJobStatus): PrintJobStatus {
  switch (status) {
    case PrintServerJobStatus.PENDING:
    case PrintServerJobStatus.QUEUED:
    case PrintServerJobStatus.ASSIGNED:
    case PrintServerJobStatus.RETRYING:
      return 'waiting';
    case PrintServerJobStatus.PRINTING:
    case PrintServerJobStatus.PAUSED:
      return 'printing';
    case PrintServerJobStatus.COMPLETED:
      return 'printed';
    case PrintServerJobStatus.FAILED:
    case PrintServerJobStatus.CANCELLED:
      return 'failed';
    default:
      return 'waiting';
  }
}

export class RealPrinterAdapter implements PrinterAdapter {
  async isAvailable(): Promise<PrinterAdapterAvailability> {
    const reachable = await PrinterBridgeService.isReachable();
    if (!reachable) {
      return { ok: false, reason: 'print_server_unreachable' };
    }
    const { printers } = await PrinterBridgeService.getLivePrinters();
    const anyOnline = printers.some((p) => p.status === 'ONLINE' || p.status === 'WARNING');
    if (!anyOnline) {
      return { ok: false, reason: 'no_printers_online' };
    }
    return { ok: true };
  }

  /**
   * Fetches the file's bytes from Sora's own (Firebase Storage) download
   * URL, then forwards them to print-server's real upload endpoint —
   * print-server has no route to accept an externally-hosted URL directly,
   * only an already-uploaded fileId (see server/src/jobs/printQueue.job.ts
   * discussion with the requester). This does mean print-server briefly
   * holds its own copy of the file; that's inherent to its actual API.
   */
  async submitJob(job: PrintJob): Promise<{ remoteJobId: string }> {
    const sourceRes = await fetch(job.documentRef.sourceUrl);
    if (!sourceRes.ok) {
      throw new Error(`Could not fetch source file (${sourceRes.status}) from ${job.documentRef.sourceUrl}`);
    }
    const arrayBuffer = await sourceRes.arrayBuffer();

    const form = new FormData();
    form.append('ownerId', env.printServer.ownerId);
    form.append(
      'file',
      new Blob([arrayBuffer], { type: job.documentRef.mimeType || 'application/octet-stream' }),
      job.fileName,
    );

    const uploadRes = await fetch(`${baseUrl()}/api/uploads`, { method: 'POST', body: form });
    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '');
      throw new Error(`print-server upload failed (${uploadRes.status}): ${text}`);
    }
    const uploaded = (await uploadRes.json()) as PrintServerSuccessResponse<PrintServerUploadResponse>;

    const printRequest: PrintServerPrintRequest = {
      ownerId: env.printServer.ownerId,
      fileId: uploaded.data.fileId,
      printerId: job.printerId,
      options: toPrintServerOptions(job.printOptions),
    };

    const jobRes = await fetch(`${baseUrl()}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(printRequest),
    });
    if (!jobRes.ok) {
      const text = await jobRes.text().catch(() => '');
      throw new Error(`print-server job creation failed (${jobRes.status}): ${text}`);
    }
    const created = (await jobRes.json()) as { job: { id: string } };

    return { remoteJobId: created.job.id };
  }

  async pollStatus(remoteJobId: string): Promise<{ status: PrintJobStatus; message?: string }> {
    const res = await fetch(`${baseUrl()}/api/jobs/${encodeURIComponent(remoteJobId)}/status`);
    if (!res.ok) {
      throw new Error(`print-server status check failed (${res.status}) for job ${remoteJobId}`);
    }
    const body = (await res.json()) as PrintServerJobStatusResponse;
    const last = body.history[body.history.length - 1];
    return { status: mapRemoteStatus(body.status), message: last?.message };
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────

let adapter: PrinterAdapter = noOpAdapter;

export function setPrinterAdapter(a: PrinterAdapter): void {
  adapter = a;
  console.log('[PrintQueue] Printer adapter registered');
}

async function pollInFlightJobs(): Promise<void> {
  const printing = await PrintJobRepository.findByStatus('printing');
  for (const job of printing) {
    if (!job.remoteJobId) continue;
    try {
      const remote = await adapter.pollStatus(job.remoteJobId);
      if (remote.status !== job.status) {
        console.log(`[PrintQueue] Job ${job.id} (${job.fileName}): ${job.status} -> ${remote.status}`);
        await PrintJobRepository.updateFields(job.id, {
          status: remote.status,
          updatedAt: nowISO(),
          lastError: remote.status === 'failed' ? remote.message : undefined,
        });
      }
    } catch (err) {
      console.error(`[PrintQueue] Failed to poll status for job ${job.id}:`, err);
    }
  }
}

async function submitNextWaitingJob(): Promise<void> {
  const waiting = await PrintJobRepository.findByStatus('waiting');
  if (waiting.length === 0) return;

  const availability = await adapter.isAvailable();
  if (!availability.ok) {
    console.log(`[PrintQueue] Adapter unavailable (${availability.reason}) — skipping submission this cycle`);
    return;
  }

  // Process one job at a time to preserve queue order
  const job = waiting[0]!;
  console.log(`[PrintQueue] Submitting job ${job.id} (${job.fileName})`);

  try {
    const { remoteJobId } = await adapter.submitJob(job);
    await PrintJobRepository.updateFields(job.id, {
      status: 'printing',
      remoteJobId,
      updatedAt: nowISO(),
      lastError: undefined,
    });
    console.log(`[PrintQueue] Job ${job.id} submitted to print-server as ${remoteJobId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await PrintJobRepository.updateFields(job.id, {
      status: 'failed',
      updatedAt: nowISO(),
      lastError: message,
    });
    console.error(`[PrintQueue] Job ${job.id} failed to submit:`, message);
  }
}

async function processQueue(): Promise<void> {
  try {
    await pollInFlightJobs();
    await submitNextWaitingJob();
  } catch (err) {
    console.error('[PrintQueue] Queue processing error:', err);
  }
}

/**
 * Run a single queue cycle on demand. Cloud Functions cannot rely on the
 * persistent interval because instances can scale to zero between requests.
 */
export async function processPrintQueueOnce(): Promise<void> {
  await processQueue();
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startPrintQueueWorker(): void {
  if (timer) return;
  console.log(`[PrintQueue] Worker started — polling every ${POLL_INTERVAL_MS / 1000}s`);
  timer = setInterval(() => { void processPrintQueueOnce(); }, POLL_INTERVAL_MS);
}

export function stopPrintQueueWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[PrintQueue] Worker stopped');
  }
}

if (require.main === module) {
  (async () => {
    const { initFirebase } = await import('../config/firebase');
    initFirebase();
    setPrinterAdapter(new RealPrinterAdapter());
    startPrintQueueWorker();
    console.log('[PrintQueue] Standalone worker running — Ctrl+C to stop');
  })();
}
