import { apiClient } from "./apiClient";
import type { Pricing } from "@/types";

export { computePriceBreakdown, computeOrderTotal } from "@/lib/pricing";
export type { PriceBreakdown, PriceLine } from "@/lib/pricing";

export const pricingService = {
  async get(): Promise<Pricing> {
    return apiClient.get<Pricing>("/api/pricing");
  },

  async update(next: Pricing): Promise<Pricing> {
    return apiClient.put<Pricing>("/api/pricing", next);
  },
};
