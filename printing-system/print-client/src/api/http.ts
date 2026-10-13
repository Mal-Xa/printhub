import type { ApiErrorResponse, AppError } from "print-common";
import { PRINT_SERVER_URL } from "../lib/env";

/** Thrown for any non-2xx response from print-server. */
export class PrintServerError extends Error {
  readonly appError: AppError | null;
  readonly status: number;

  constructor(status: number, appError: AppError | null, fallbackMessage: string) {
    super(appError?.message ?? fallbackMessage);
    this.name = "PrintServerError";
    this.status = status;
    this.appError = appError;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Set when sending a FormData body (file uploads); skips JSON stringify/headers. */
  formData?: FormData;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${PRINT_SERVER_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, formData, signal } = options;

  const res = await fetch(buildUrl(path, query), {
    method,
    signal,
    headers: formData ? undefined : { "Content-Type": "application/json" },
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (!res.ok) {
    let parsed: ApiErrorResponse | null = null;
    try {
      parsed = (await res.json()) as ApiErrorResponse;
    } catch {
      parsed = null;
    }
    throw new PrintServerError(res.status, parsed?.error ?? null, `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string, query?: RequestOptions["query"], signal?: AbortSignal) =>
    request<T>(path, { method: "GET", query, signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),
  postForm: <T>(path: string, formData: FormData, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", formData, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body, signal }),
  del: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "DELETE", body, signal }),
};
