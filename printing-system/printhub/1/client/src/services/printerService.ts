import { apiClient } from "./apiClient";
import type { PrintJob, PrintJobStatus, Printer } from "@/types";

export const printerService = {
  /** Live printer list — proxied + cached server-side from print-server. Single source of truth everywhere. */
  async listPrinters(): Promise<Printer[]> {
    return apiClient.get<Printer[]>("/api/printers");
  },

  /** Distinguishes "print-server unreachable" (bridge/infra problem) from per-printer offline. */
  async getBridgeHealth(): Promise<{ printServerReachable: boolean }> {
    return apiClient.get<{ printServerReachable: boolean }>("/api/printers/health");
  },

  async getPrinter(id: string): Promise<Printer> {
    return apiClient.get<Printer>(`/api/printers/${id}`);
  },

  /** Admin-wide queue monitoring (all orders) */
  async listQueue(): Promise<PrintJob[]> {
    return apiClient.get<PrintJob[]>("/api/print-jobs");
  },

  /** Jobs for one order — used by the per-order print review page for live per-file status. */
  async listJobsForOrder(orderId: string): Promise<PrintJob[]> {
    return apiClient.get<PrintJob[]>(`/api/orders/${orderId}/print-jobs`);
  },

  /** "Send" one file to print. */
  async sendPrint(
    orderId: string,
    input: { fileId: string; printerId?: string },
  ): Promise<PrintJob> {
    return apiClient.post<PrintJob>(`/api/orders/${orderId}/print-jobs`, input);
  },

  /** "Send all" — every file on the order, each with its own settings/printer. */
  async sendAll(orderId: string): Promise<PrintJob[]> {
    return apiClient.post<PrintJob[]>(`/api/orders/${orderId}/print-jobs/send-all`, {});
  },

  /** Persists an edit to one file's print options and/or assigned printer (overwrites in place). */
  async updateFilePrintSettings(
    orderId: string,
    fileId: string,
    patch: { printOptions?: import("@/types").PrintOptions; printerId?: string },
  ) {
    return apiClient.patch(`/api/orders/${orderId}/files/${fileId}/print-settings`, patch);
  },

  async setJobStatus(id: string, status: PrintJobStatus): Promise<PrintJob> {
    return apiClient.patch<PrintJob>(`/api/print-jobs/${id}/status`, { status });
  },

  async cancel(id: string): Promise<void> {
    return apiClient.delete(`/api/print-jobs/${id}`);
  },
};
