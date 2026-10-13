import { Router } from 'express';
import { PricingController } from '../controllers/pricing.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updatePricingSchema } from '../validators/pricing.validator';

const router = Router();

/** GET /api/pricing  — Public: anyone can read pricing */
router.get('/', PricingController.get);

/** PUT /api/pricing  — Admin only: update all pricing fields */
router.put(
  '/',
  authenticateUser,
  requireAdmin,
  validate(updatePricingSchema),
  PricingController.update,
);

export default router;
