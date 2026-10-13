import { apiClient } from "./apiClient";
import type { Order, OrderStatus } from "@/types";

export interface CreateOrderPayload {
  customer: { name: string; phone: string; email: string };
  fileIds: { id: string }[];
  printOptions: Order["printOptions"];
  lamination: Order["lamination"];
  binding: Order["binding"];
  specialInstructions?: string;
}

export const orderService = {
  async list(): Promise<Order[]> {
    return apiClient.get<Order[]>("/api/orders");
  },

  async get(id: string): Promise<Order> {
    return apiClient.get<Order>(`/api/orders/${id}`);
  },

  async create(input: CreateOrderPayload): Promise<Order> {
    return apiClient.post<Order>("/api/orders", input);
  },

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    return apiClient.patch<Order>(`/api/orders/${id}/status`, { status });
  },

  async cancel(id: string): Promise<Order> {
    return apiClient.patch<Order>(`/api/orders/${id}/cancel`, {});
  },

  async stats(): Promise<{ active: number; completed: number; total: number }> {
    return apiClient.get("/api/orders/stats");
  },
};
