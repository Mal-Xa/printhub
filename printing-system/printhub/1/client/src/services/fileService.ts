import { config } from "@/config/env";
import { getIdToken } from "@/lib/firebase";
import { ApiError } from "./apiClient";
import { apiClient } from "./apiClient";
import type { StoredFile } from "@/types";

/** Same base-URL joining logic as apiClient, kept local since content fetches need raw Response access. */
function buildUrl(path: string): string {
  const base = config.apiUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (base.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    return `${base}${normalizedPath.slice(4)}`;
  }
  return `${base}${normalizedPath}`;
}

async function fetchFileBlob(id: string, disposition: "inline" | "attachment"): Promise<Blob> {
  const token = await getIdToken();
  const res = await fetch(buildUrl(`/api/files/${id}/content?disposition=${disposition}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError((err as { message?: string }).message ?? `Request failed: ${res.status}`, res.status);
  }
  return res.blob();
}

export const fileService = {
  async list(): Promise<StoredFile[]> {
    return apiClient.get<StoredFile[]>("/api/files");
  },

  async getById(id: string): Promise<StoredFile> {
    return apiClient.get<StoredFile>(`/api/files/${id}`);
  },

  async upload(file: File): Promise<StoredFile> {
    const form = new FormData();
    form.append("file", file);
    return apiClient.postForm<StoredFile>("/api/files/upload", form);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/files/${id}`);
  },

  /** Opens the file in a new tab for previewing, fetched through our own authenticated API. */
  async view(id: string): Promise<void> {
    const blob = await fetchFileBlob(id, "inline");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    // Give the new tab time to load the blob before it's revoked.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  /** Forces a save-as download of the file with its original name. */
  async download(id: string, name: string): Promise<void> {
    const blob = await fetchFileBlob(id, "attachment");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
