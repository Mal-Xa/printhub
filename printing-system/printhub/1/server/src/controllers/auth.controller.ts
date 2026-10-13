import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';
import { ok, created } from '../utils/response';
import { RegisterInput, LoginInput, UpdateProfileInput } from '../validators/auth.validator';

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.register(req.body as RegisterInput);
      created(res, user, 'Registration successful');
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { idToken } = req.body as LoginInput;
      const user = await AuthService.login(idToken);
      ok(res, user, 'Login successful');
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const user = await AuthService.getProfile(uid);
      ok(res, user);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/auth/profile
   * Mirrors authService.updateProfile(patch) from the frontend.
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const updated = await AuthService.updateProfile(uid, req.body as UpdateProfileInput);
      ok(res, updated, 'Profile updated');
    } catch (err) {
      next(err);
    }
  },
};
