import { z } from 'zod';

const positiveNum = z.number().min(0, 'Price must be >= 0');

export const updatePricingSchema = z.object({
  bwPage: positiveNum,
  colorPage: positiveNum,
  frontCoverColor: positiveNum,
  backCoverColor: positiveNum,
  passportSheet: positiveNum,
  photoPaperA4: positiveNum,
  photoPaper4x6: positiveNum,
  lamination: z.object({
    id_card: positiveNum,
    aadhaar: positiveNum,
    pan: positiveNum,
    certificate: positiveNum,
    a4: positiveNum,
  }),
  spiralBinding: positiveNum,
  doubleSideWorkCharge: positiveNum,
  doubleSideWorkChargePageGroup: z
    .number()
    .int('Page group must be a whole number')
    .min(1, 'Page group must be at least 1'),
});

export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;
