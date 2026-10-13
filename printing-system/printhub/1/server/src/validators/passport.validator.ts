import { z } from 'zod';

export const createPassportSchema = z.object({
  template: z.enum(['passport', 'visa', 'id']),
  photosPerSheet: z.number().int().min(1).max(32).default(9),
  /**
   * Optional canvas-generated data URL (data:image/jpeg;base64,...)
   * or a plain https:// URL. If omitted, only the metadata record is created.
   */
  photoUrl: z.string().optional(),
});

export type CreatePassportInput = z.infer<typeof createPassportSchema>;
