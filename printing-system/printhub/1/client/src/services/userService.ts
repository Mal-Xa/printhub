import { apiClient } from "./apiClient";
import type { AdminUserDetail, Role, StoredFile, User } from "@/types";

export const userService = {
  /** All registered users, newest first. Admin only. */
  async list(): Promise<User[]> {
    return apiClient.get<User[]>("/api/admin/users");
  },

  /** A single user's profile plus their file/order usage stats. Admin only. */
  async getDetail(uid: string): Promise<AdminUserDetail> {
    return apiClient.get<AdminUserDetail>(`/api/admin/users/${uid}`);
  },

  /** A user's stored files, with the same view/download URLs as /api/files. Admin only. */
  async getFiles(uid: string): Promise<StoredFile[]> {
    return apiClient.get<StoredFile[]>(`/api/admin/users/${uid}/files`);
  },

  /** Promotes/demotes a user between "user" and "admin". */
  async setRole(uid: string, role: Role): Promise<void> {
    await apiClient.patch("/api/admin/users/role", { uid, role });
  },

  /** Permanently deletes a user's account, profile, and stored files. */
  async remove(uid: string): Promise<void> {
    await apiClient.delete(`/api/admin/users/${uid}`);
  },
};
