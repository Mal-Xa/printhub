import { apiClient } from "./apiClient";
import type { PassportSheet } from "@/types";

export const passportService = {
  async list(): Promise<PassportSheet[]> {
    return apiClient.get<PassportSheet[]>("/api/passport");
  },

  async save(input: Omit<PassportSheet, "id" | "createdAt" | "userId">): Promise<PassportSheet> {
    return apiClient.post<PassportSheet>("/api/passport", input);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/api/passport/${id}`);
  },
};
