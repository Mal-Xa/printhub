import type {
  UploadResponse,
  PrintRequest,
  PrintResponse,
  CancelJobRequest,
  CancelJobResponse,
  JobStatusResponse,
  GetJobResponse,
  ListJobsResponse,
  ListPrintersResponse,
  GetPrinterResponse,
  PrinterStatusResponse,
  ApiSuccessResponse,
  ApiListResponse,
  QueueItem,
  JobId,
  PrinterId,
} from "print-common";
import { asUserId } from "print-common";
import { http } from "./http";
import { CLIENT_USER_ID } from "../lib/env";

const OWNER_ID = asUserId(CLIENT_USER_ID);

/** print-client -> print-server: upload a document ahead of creating a print job. */
export async function uploadDocument(file: File, signal?: AbortSignal): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("ownerId", OWNER_ID);
  formData.append("fileName", file.name);
  formData.append("mimeType", file.type || "application/octet-stream");
  formData.append("sizeBytes", String(file.size));

  const response = await http.postForm<ApiSuccessResponse<UploadResponse>>("/api/uploads", formData, signal);
  return response.data;
}

/** print-client -> print-server: create a print job for an already-uploaded document. */
export function submitPrintJob(request: Omit<PrintRequest, "ownerId">, signal?: AbortSignal): Promise<PrintResponse> {
  const body: PrintRequest = { ownerId: OWNER_ID, ...request };
  return http.post<PrintResponse>("/api/jobs", body, signal);
}

/** print-client -> print-server: list jobs, defaulting to this client's own jobs. */
export function listJobs(
  params: { page?: number; pageSize?: number; printerId?: PrinterId; status?: string[] } = {},
  signal?: AbortSignal,
): Promise<ListJobsResponse> {
  return http.get<ListJobsResponse>(
    "/api/jobs",
    {
      ownerId: OWNER_ID,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
      printerId: params.printerId,
      status: params.status?.join(","),
    },
    signal,
  );
}

export function getJob(jobId: JobId, signal?: AbortSignal): Promise<GetJobResponse> {
  return http.get<GetJobResponse>(`/api/jobs/${jobId}`, undefined, signal);
}

export function getJobStatus(jobId: JobId, signal?: AbortSignal): Promise<JobStatusResponse> {
  return http.get<JobStatusResponse>(`/api/jobs/${jobId}/status`, undefined, signal);
}

export function cancelJob(jobId: JobId, reason?: string, signal?: AbortSignal): Promise<CancelJobResponse> {
  const body: CancelJobRequest = { jobId, reason };
  return http.post<CancelJobResponse>(`/api/jobs/${jobId}/cancel`, body, signal);
}

export function listPrinters(
  params: { page?: number; pageSize?: number; status?: string[] } = {},
  signal?: AbortSignal,
): Promise<ListPrintersResponse> {
  return http.get<ListPrintersResponse>(
    "/api/printers",
    { page: params.page ?? 1, pageSize: params.pageSize ?? 50, status: params.status?.join(",") },
    signal,
  );
}

export function getPrinter(printerId: PrinterId, signal?: AbortSignal): Promise<GetPrinterResponse> {
  return http.get<GetPrinterResponse>(`/api/printers/${printerId}`, undefined, signal);
}

export function getPrinterStatus(printerId: PrinterId, signal?: AbortSignal): Promise<PrinterStatusResponse> {
  return http.get<PrinterStatusResponse>(`/api/printers/${printerId}/status`, undefined, signal);
}

/** print-client -> print-server: lightweight scheduling queue for a given printer. */
export function getPrinterQueue(printerId: PrinterId, signal?: AbortSignal): Promise<ApiListResponse<QueueItem>> {
  return http.get<ApiListResponse<QueueItem>>(`/api/printers/${printerId}/queue`, undefined, signal);
}
