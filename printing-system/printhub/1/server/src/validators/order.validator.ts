import { z } from 'zod';
import { OrderStatus, ORDER_STATUS_TRANSITIONS } from '../types';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const printOptionsSchema = z
  .object({
    type: z.enum(['bw', 'color']),
    side: z.enum(['single', 'double']),
    copies: z.number().int().min(1).max(500),
    paperSize: z.enum(['A4', '4x6']),
    paperType: z.enum(['normal', 'photo']),
    pages: z.object({
      mode: z.enum(['all', 'custom']),
      range: z.string().optional(),
    }),
    frontCoverColor: z.boolean(),
    backCoverColor: z.boolean(),
    removeBlankPages: z.boolean(),
  })
  .refine((v) => v.paperType === 'photo' || v.paperSize === 'A4', {
    message: 'Normal paper is only available in A4',
    path: ['paperSize'],
  })
  .refine((v) => v.paperSize !== '4x6' || v.paperType === 'photo', {
    message: '4x6 paper must use photo paper',
    path: ['paperType'],
  })
  .refine((v) => v.paperType !== 'photo' || v.type === 'color', {
    message: 'Photo paper is colour print only',
    path: ['type'],
  });

const laminationItemSchema = z.object({
  type: z.enum(['id_card', 'aadhaar', 'pan', 'certificate', 'a4']),
  quantity: z.number().int().min(1).max(1000),
});

const bindingOptionsSchema = z.object({
  mode: z.enum(['print_only', 'print_and_binding', 'binding_only']),
  documentCount: z.number().int().min(1).max(100).optional(),
  estimatedPages: z.number().int().min(1).optional(),
});

// ── File reference (sent from client after upload) ────────────────────────────

const fileRefSchema = z.object({
  id: z.string().min(1),
});

/** PATCH /api/orders/:id/files/:fileId/print-settings — admin print review page */
export const updateFilePrintSettingsSchema = z
  .object({
    printOptions: printOptionsSchema.optional(),
    printerId: z.string().min(1).optional(),
  })
  .refine((v) => v.printOptions !== undefined || v.printerId !== undefined, {
    message: 'At least one of printOptions or printerId is required',
  });

export type UpdateFilePrintSettingsInput = z.infer<typeof updateFilePrintSettingsSchema>;

// ── Customer info ─────────────────────────────────────────────────────────────

const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(100),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')).transform(v => v ?? ''),
});

// ── Create order ──────────────────────────────────────────────────────────────

export const createOrderSchema = z.object({
  customer: customerSchema,
  /** Array of already-uploaded file IDs */
  fileIds: z.array(fileRefSchema).min(0),
  printOptions: printOptionsSchema,
  lamination: z.array(laminationItemSchema).default([]),
  binding: bindingOptionsSchema,
  specialInstructions: z.string().max(500).optional(),
});

// ── Status update ─────────────────────────────────────────────────────────────

export const updateOrderStatusSchema = z
  .object({
    status: z.enum([
      'pending',
      'accepted',
      'printing',
      'ready',
      'completed',
      'awaiting_delivery',
      'cancelled',
    ]),
  })
  .superRefine((data, ctx) => {
    // Status transitions are validated in the service layer where we have the current status.
    // The schema just ensures the value is a valid OrderStatus enum member.
    void data; void ctx;
  });

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
