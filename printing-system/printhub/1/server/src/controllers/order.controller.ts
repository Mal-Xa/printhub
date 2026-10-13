import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { AuthenticatedRequest } from '../types';
import { ok, created } from '../utils/response';
import { CreateOrderInput, UpdateOrderStatusInput, UpdateFilePrintSettingsInput } from '../validators/order.validator';

export const OrderController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const order = await OrderService.create(req.body as CreateOrderInput, uid);
      created(res, order, 'Order created successfully');
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      const orders =
        role === 'admin'
          ? await OrderService.listAll()
          : await OrderService.listForUser(uid);
      ok(res, orders);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      const order = await OrderService.getById(req.params['id']!, uid, role);
      ok(res, order);
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const { status } = req.body as UpdateOrderStatusInput;
      const updated = await OrderService.updateStatus(req.params['id']!, status, uid);
      ok(res, updated, `Order status updated to ${status}`);
    } catch (err) {
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid, role } = (req as AuthenticatedRequest).user;
      const updated = await OrderService.cancel(req.params['id']!, uid, role);
      ok(res, updated, 'Order cancelled');
    } catch (err) {
      next(err);
    }
  },

  /** PATCH /api/orders/:id/files/:fileId/print-settings — admin print review page */
  async updateFilePrintSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const patch = req.body as UpdateFilePrintSettingsInput;
      const updated = await OrderService.updateFilePrintSettings(
        req.params['id']!,
        req.params['fileId']!,
        patch,
        uid,
      );
      ok(res, updated, 'Print settings updated');
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/orders/stats — matches frontend orderService.stats(userId) */
  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uid } = (req as AuthenticatedRequest).user;
      const data = await OrderService.statsForUser(uid);
      ok(res, data);
    } catch (err) {
      next(err);
    }
  },
};
