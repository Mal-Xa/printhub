import { z } from 'zod';

export const registerSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
});

export const loginSchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
});

/**
 * PATCH /api/auth/profile
 * Mirrors authService.updateProfile(patch) on the frontend.
 * All fields optional — only send what's changed.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email').optional(),
}).refine(
  (data) => data.fullName !== undefined || data.phone !== undefined || data.email !== undefined,
  { message: 'At least one field (fullName, phone, email) must be provided' },
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
