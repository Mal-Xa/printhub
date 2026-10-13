import { PricingRepository } from '../repositories/pricing.repository';
import { ActivityLogService } from './activityLog.service';
import { Pricing } from '../types';
import { UpdatePricingInput } from '../validators/pricing.validator';

export const PricingService = {
  async get(): Promise<Pricing> {
    return PricingRepository.get();
  },

  async update(input: UpdatePricingInput, adminUid: string): Promise<Pricing> {
    const updated = await PricingRepository.update(input as Pricing, adminUid);

    await ActivityLogService.log({
      action: 'pricing_updated',
      userId: adminUid,
      targetType: 'pricing',
      metadata: { newPricing: input },
    });

    return updated;
  },
};
