import { NotificationRepository } from '../repositories/notification.repository';
import { Notification, NotificationType, OrderStatus } from '../types';
import { generateId, nowISO } from '../utils/id';

export const NotificationService = {
  async send(
    userId: string,
    title: string,
    body: string,
    type: NotificationType,
    metadata?: Record<string, unknown>,
  ): Promise<Notification> {
    const notification: Notification = {
      id: generateId(),
      userId,
      title,
      body,
      type,
      read: false,
      createdAt: nowISO(),
      metadata,
    };

    await NotificationRepository.create(notification);

    // ── Future extension points ───────────────────────────────────────────────
    // await PushNotificationAdapter.send(userId, title, body);
    // await EmailAdapter.send(userId, title, body);
    // await WhatsAppAdapter.send(userId, body);
    // ────────────────────────────────────────────────────────────────────────

    return notification;
  },

  async notifyOrderStatusChanged(
    userId: string,
    orderId: string,
    newStatus: OrderStatus,
  ): Promise<void> {
    const statusLabels: Record<OrderStatus, string> = {
      pending: 'Pending',
      accepted: 'Accepted',
      printing: 'Printing',
      ready: 'Ready for Pickup',
      completed: 'Completed',
      awaiting_delivery: 'Awaiting Document Delivery',
      cancelled: 'Cancelled',
    };

    const label = statusLabels[newStatus];

    await NotificationService.send(
      userId,
      `Order ${orderId} — ${label}`,
      `Your order status has been updated to: ${label}.`,
      'order_update',
      { orderId, newStatus },
    );
  },

  async getForUser(userId: string): Promise<Notification[]> {
    return NotificationRepository.findByUser(userId);
  },

  async markRead(id: string): Promise<void> {
    return NotificationRepository.markRead(id);
  },

  async markAllRead(userId: string): Promise<void> {
    return NotificationRepository.markAllRead(userId);
  },
};
