import { OrderRepository } from '../repositories/order.repository';
import { FileRepository } from '../repositories/file.repository';
import { PricingRepository } from '../repositories/pricing.repository';
import { ActivityLogService } from './activityLog.service';
import { NotificationService } from './notification.service';
import { calculateOrderTotal } from '../utils/pricing';
import { getStorage } from '../config/firebase';
import { buildDownloadUrl } from '../utils/storageUrl';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_TRANSITIONS,
  CANCELLABLE_ORDER_STATUSES,
  StoredFile,
  UserStats,
} from '../types';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { generateOrderId, nowISO } from '../utils/id';
import { CreateOrderInput } from '../validators/order.validator';

/**
 * Order documents store the full StoredFile sub-object (including
 * storagePath/downloadToken) at creation time, but never a live `url` —
 * that's only ever built on the fly. Without this, admins have no way to
 * actually open/print the files attached to an order.
 */
function withFileUrls(order: Order): Order {
  if (!order.files?.length) return order;
  const bucketName = getStorage().bucket().name;
  return {
    ...order,
    files: order.files.map(f => ({
      ...f,
      url: f.storagePath && f.downloadToken ? buildDownloadUrl(bucketName, f.storagePath, f.downloadToken) : f.url,
    })),
  };
}

export const OrderService = {
  async create(input: CreateOrderInput, userId: string): Promise<Order> {
    // 1. Resolve file documents
    const fileIds = input.fileIds.map(f => f.id);
    let files: StoredFile[] = [];

    if (fileIds.length > 0) {
      files = await FileRepository.findManyByIds(fileIds);

      const unowned = files.filter(f => f.ownerId !== userId);
      if (unowned.length > 0) {
        throw new ForbiddenError('One or more files do not belong to you');
      }
    }

    // 2. Validate files requirement
    if (input.binding.mode !== 'binding_only' && files.length === 0) {
      throw new BadRequestError('At least one file is required for print orders');
    }

    // 3. Server-side price calculation — client total is ignored
    const pricing = await PricingRepository.get();
    const { total } = calculateOrderTotal(
      { files, printOptions: input.printOptions, lamination: input.lamination, binding: input.binding },
      pricing,
    );

    // 4. Build order document
    const id = await generateOrderId();
    const now = nowISO();

    const order: Order = {
      id,
      userId,
      customer: input.customer,
      files,
      printOptions: input.printOptions,
      lamination: input.lamination,
      binding: input.binding,
      specialInstructions: input.specialInstructions,
      status: 'pending',
      total,
      createdAt: now,
      updatedAt: now,
    };

    await OrderRepository.create(order);

    await ActivityLogService.log({
      action: 'order_created',
      userId,
      targetId: id,
      targetType: 'order',
      metadata: { total, fileCount: files.length },
    });

    await NotificationService.send(
      userId,
      `Order ${id} placed`,
      `Your order has been received and is pending confirmation.`,
      'order_update',
      { orderId: id, status: 'pending' },
    );

    return order;
  },

  async getById(id: string, requesterId: string, requesterRole: string): Promise<Order> {
    const order = await OrderRepository.findById(id);
    if (!order) throw new NotFoundError('Order');
    if (requesterRole !== 'admin' && order.userId !== requesterId) {
      throw new ForbiddenError('You do not have access to this order');
    }
    return withFileUrls(order);
  },

  async listForUser(userId: string): Promise<Order[]> {
    const orders = await OrderRepository.findByUser(userId);
    return orders.map(withFileUrls);
  },

  async listAll(limit?: number, startAfter?: string): Promise<Order[]> {
    const orders = await OrderRepository.findAll(limit, startAfter);
    return orders.map(withFileUrls);
  },

  async updateStatus(orderId: string, newStatus: OrderStatus, adminId: string): Promise<Order> {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order');

    const allowed = ORDER_STATUS_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestError(
        `Cannot transition from "${order.status}" to "${newStatus}". Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    await OrderRepository.updateStatus(orderId, newStatus);
    const updated = { ...order, status: newStatus, updatedAt: nowISO() };

    await ActivityLogService.log({
      action: 'order_status_changed',
      userId: adminId,
      targetId: orderId,
      targetType: 'order',
      metadata: { from: order.status, to: newStatus },
    });

    await NotificationService.notifyOrderStatusChanged(order.userId, orderId, newStatus);

    return withFileUrls(updated);
  },

  /**
   * Cancel an order. Allowed for the order's owner or an admin, and only
   * while the order hasn't already reached a terminal state (completed or
   * already cancelled).
   */
  async cancel(orderId: string, requesterId: string, requesterRole: string): Promise<Order> {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order');

    if (requesterRole !== 'admin' && order.userId !== requesterId) {
      throw new ForbiddenError('You do not have access to this order');
    }

    if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestError(
        `Order cannot be cancelled from its current status ("${order.status}")`,
      );
    }

    await OrderRepository.updateStatus(orderId, 'cancelled');
    const updated = { ...order, status: 'cancelled' as OrderStatus, updatedAt: nowISO() };

    await ActivityLogService.log({
      action: 'order_status_changed',
      userId: requesterId,
      targetId: orderId,
      targetType: 'order',
      metadata: { from: order.status, to: 'cancelled' },
    });

    await NotificationService.notifyOrderStatusChanged(order.userId, orderId, 'cancelled');

    return withFileUrls(updated);
  },

  /**
   * Persists an admin's edits to one file's print settings (options and/or
   * assigned printer) from the print review page. Overwrites in place —
   * there is no per-file history/versioning. Recomputes and persists the
   * order total afterwards since pricing is now a sum of per-file line
   * items and this file's settings may have changed its cost.
   */
  async updateFilePrintSettings(
    orderId: string,
    fileId: string,
    patch: { printOptions?: Order['printOptions']; printerId?: string },
    adminId: string,
  ): Promise<Order> {
    const order = await OrderRepository.findById(orderId);
    if (!order) throw new NotFoundError('Order');

    const fileIndex = order.files.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) throw new NotFoundError('File on this order');

    const files = order.files.map((f, i) =>
      i === fileIndex
        ? {
            ...f,
            printOptions: patch.printOptions ?? f.printOptions,
            printerId: patch.printerId ?? f.printerId,
          }
        : f,
    );

    const pricing = await PricingRepository.get();
    const { total } = calculateOrderTotal(
      { files, printOptions: order.printOptions, lamination: order.lamination, binding: order.binding },
      pricing,
    );

    await OrderRepository.update(orderId, { files, total });

    await ActivityLogService.log({
      action: 'order_updated',
      userId: adminId,
      targetId: orderId,
      targetType: 'order',
      metadata: { fileId, printerId: patch.printerId },
    });

    return withFileUrls({ ...order, files, total, updatedAt: nowISO() });
  },

  /** User-facing stats — mirrors orderService.stats() in the frontend */
  async statsForUser(userId: string): Promise<UserStats> {
    const orders = await OrderRepository.findByUser(userId);
    const active = orders.filter(o =>
      ['pending', 'accepted', 'printing', 'awaiting_delivery'].includes(o.status),
    ).length;
    const completed = orders.filter(o => o.status === 'completed').length;
    return { active, completed, total: orders.length };
  },
};
