import { z } from 'zod';

/**
 * POST /api/orders/:orderId/print-jobs
 * "Send" one file. Omitting printerId matches print-client's behaviour:
 * print-server selects an available printer automatically.
 */
export const createPrintJobSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  printerId: z.string().min(1).optional(),
});

/**
 * PATCH /api/print-jobs/:id/status
 * Manual override — normally the queue worker drives this via polling
 * print-server, but an admin can still force a transition (e.g. to retry).
 */
export const updatePrintJobStatusSchema = z.object({
  status: z.enum(['waiting', 'printing', 'printed', 'failed']),
});

export type CreatePrintJobInput = z.infer<typeof createPrintJobSchema>;
export type UpdatePrintJobStatusInput = z.infer<typeof updatePrintJobStatusSchema>;
