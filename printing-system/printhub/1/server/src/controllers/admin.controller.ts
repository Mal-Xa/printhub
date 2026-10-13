import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { OrderService } from '../services/order.service';
import { ActivityLogService } from '../services/activityLog.service';
import { AuthService } from '../services/auth.service';
import { ok } from '../utils/response';
import { AuthenticatedRequest, Role } from '../types';
import { BadRequestError } from '../utils/errors';

export const AdminController = {
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await AdminService.getStats();
      ok(res, stats);
    } catch (err) {
      next(err);
    }
  },

  async getAllOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 50;
      const startAfter = req.query['startAfter'] as string | undefined;
      const orders = await OrderService.listAll(limit, startAfter);
      ok(res, orders);
    } catch (err) {
      next(err);
    }
  },

  async getActivityLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 100;
      const logs = await ActivityLogService.getAll(limit);
      ok(res, logs);
    } catch (err) {
      next(err);
    }
  },

  async setUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid: adminUid } = (req as AuthenticatedRequest).user;
      const { uid, role } = req.body as { uid: string; role: Role };

      if (!uid || !role) throw new BadRequestError('uid and role are required');
      if (!['user', 'admin'].includes(role)) throw new BadRequestError('Role must be user or admin');

      await AuthService.setRole(uid, role, adminUid);
      ok(res, null, `User ${uid} role updated to ${role}`);
    } catch (err) {
      next(err);
    }
  },

  async getAllUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await AdminService.listUsers();
      ok(res, users);
    } catch (err) {
      next(err);
    }
  },

  async getUserDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const detail = await AdminService.getUserDetail(req.params['id']!);
      ok(res, detail);
    } catch (err) {
      next(err);
    }
  },

  async getUserFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = await AdminService.getUserFiles(req.params['id']!);
      ok(res, files);
    } catch (err) {
      next(err);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid: adminUid } = (req as AuthenticatedRequest).user;
      await AdminService.deleteUser(req.params['id']!, adminUid);
      ok(res, null, 'User deleted');
    } catch (err) {
      next(err);
    }
  },
};
