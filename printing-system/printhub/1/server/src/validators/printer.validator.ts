import { z } from 'zod';

export const createPrinterSchema = z.object({
  name: z.string().min(1, 'Printer name is required').max(100),
  model: z.string().min(1, 'Model is required').max(100),
  color: z.boolean(),
});

export const updatePrinterStatusSchema = z.object({
  status: z.enum(['online', 'offline', 'busy']),
});

export type CreatePrinterInput = z.infer<typeof createPrinterSchema>;
export type UpdatePrinterStatusInput = z.infer<typeof updatePrinterStatusSchema>;
