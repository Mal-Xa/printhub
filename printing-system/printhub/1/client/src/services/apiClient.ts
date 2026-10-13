import { config } from "@/config/env";
import { getIdToken } from "@/lib/firebase";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions {
  idToken?: string;
}

export interface ApiClient {
  get<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  postForm<T>(path: string, form: FormData, options?: ApiRequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T>;
  delete<T>(path: string, options?: ApiRequestOptions): Promise<T>;
}

async function authHeader(idToken?: string): Promise<Record<string, string>> {
  const token = idToken ?? (await getIdToken());
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Join base URL and path, avoiding a duplicate `/api` segment when the Cloud Function URL already ends with `/api`. */
function buildUrl(path: string): string {
  const base = config.apiUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.slice(4)}`;
  }
  return `${base}${normalizedPath}`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  if (!config.apiUrl) throw new Error("VITE_API_URL is not set");
  const headers = await authHeader(options?.idToken);
  const res = await fetch(buildUrl(path), {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      (err as { message?: string }).message ?? `Request failed: ${res.status}`,
      res.status,
    );
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json() as { success: boolean; data?: T; message?: string };
  return json.data as T;
}

async function requestForm<T>(path: string, form: FormData, options?: ApiRequestOptions): Promise<T> {
  if (!config.apiUrl) throw new Error("VITE_API_URL is not set");
  const headers = await authHeader(options?.idToken); // no Content-Type — browser sets multipart boundary
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(
      (err as { message?: string }).message ?? `Request failed: ${res.status}`,
      res.status,
    );
  }
  const json = await res.json() as { success: boolean; data?: T; message?: string };
  return json.data as T;
}

export const apiClient: ApiClient = {
  get:      (p, o)    => request("GET",    p, undefined, o),
  post:     (p, b, o) => request("POST",   p, b, o),
  postForm: (p, f, o) => requestForm(p, f, o),
  patch:    (p, b, o) => request("PATCH",  p, b, o),
  put:      (p, b, o) => request("PUT",    p, b, o),
  delete:   (p, o)    => request("DELETE", p, undefined, o),
};
