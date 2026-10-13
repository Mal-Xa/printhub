import { Request, Response, NextFunction } from 'express';
import { PricingService } from '../services/pricing.service';
import { AuthenticatedRequest } from '../types';
import { ok } from '../utils/response';
import { UpdatePricingInput } from '../validators/pricing.validator';

export const PricingController = {
  async get(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pricing = await PricingService.get();
      ok(res, pricing);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const updated = await PricingService.update(req.body as UpdatePricingInput, uid);
      ok(res, updated, 'Pricing updated successfully');
    } catch (err) {
      next(err);
    }
  },
};
