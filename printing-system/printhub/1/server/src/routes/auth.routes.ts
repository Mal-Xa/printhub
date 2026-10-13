import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/auth.validator';

const router = Router();

/** POST /api/auth/register — Exchange Firebase ID token for a user profile */
router.post('/register', validate(registerSchema), AuthController.register);

/** POST /api/auth/login — Verify token and return existing profile */
router.post('/login', validate(loginSchema), AuthController.login);

/** GET /api/auth/me — Return authenticated user's own profile */
router.get('/me', authenticateUser, AuthController.me);

/**
 * PATCH /api/auth/profile — Update own profile (fullName, phone, email)
 * Mirrors authService.updateProfile() on the frontend.
 */
router.patch('/profile', authenticateUser, validate(updateProfileSchema), AuthController.updateProfile);

export default router;
