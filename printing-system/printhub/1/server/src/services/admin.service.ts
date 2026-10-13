import { getAuth, getStorage } from '../config/firebase';
import { OrderRepository } from '../repositories/order.repository';
import { UserRepository } from '../repositories/user.repository';
import { FileRepository } from '../repositories/file.repository';
import { ActivityLogService } from './activityLog.service';
import { AdminStats, AdminUserDetail, OrderStatus, User } from '../types';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { buildDownloadUrl } from '../utils/storageUrl';

export const AdminService = {
  /** All registered users, newest first — used by the admin Users page. */
  async listUsers(): Promise<User[]> {
    return UserRepository.findAll();
  },

  /** A single user's profile plus their file/order usage stats. */
  async getUserDetail(uid: string): Promise<AdminUserDetail> {
    const user = await UserRepository.findById(uid);
    if (!user) throw new NotFoundError('User');

    const [files, orders] = await Promise.all([
      FileRepository.findByUser(uid),
      OrderRepository.findByUser(uid),
    ]);

    const activeOrders = orders.filter(o =>
      ['pending', 'accepted', 'printing', 'awaiting_delivery'].includes(o.status),
    ).length;
    const completedOrders = orders.filter(o => o.status === 'completed');

    return {
      ...user,
      fileCount: files.length,
      totalFileSizeBytes: files.reduce((sum, f) => sum + f.sizeBytes, 0),
      orderCount: orders.length,
      activeOrders,
      completedOrders: completedOrders.length,
      totalSpent: completedOrders.reduce((sum, o) => sum + o.total, 0),
    };
  },

  /** A user's stored files — reuses the same URL-building shape as FileService. */
  async getUserFiles(uid: string) {
    const user = await UserRepository.findById(uid);
    if (!user) throw new NotFoundError('User');

    const files = await FileRepository.findByUser(uid);
    const bucketName = getStorage().bucket().name;
    return files.map(f => {
      f.url = buildDownloadUrl(bucketName, f.storagePath, f.downloadToken);
      return f;
    });
  },

  /**
   * Permanently removes a user: deletes their stored files (Storage + Firestore),
   * their Firestore profile, and their Firebase Auth account. Orders are left
   * intact for historical/accounting records.
   */
  async deleteUser(uid: string, adminUid: string): Promise<void> {
    if (uid === adminUid) {
      throw new BadRequestError('You cannot delete your own admin account');
    }

    const user = await UserRepository.findById(uid);
    if (!user) throw new NotFoundError('User');

    const files = await FileRepository.findByUser(uid);
    const bucket = getStorage().bucket();
    await Promise.all(
      files.map(async f => {
        await bucket.file(f.storagePath).delete({ ignoreNotFound: true });
        await FileRepository.delete(f.id);
      }),
    );

    await UserRepository.delete(uid);

    try {
      await getAuth().deleteUser(uid);
    } catch {
      // Auth account may already be gone — Firestore/storage cleanup above still succeeded.
    }

    await ActivityLogService.log({
      action: 'user_deleted',
      userId: adminUid,
      targetId: uid,
      targetType: 'user',
      metadata: { email: user.email, fullName: user.fullName, filesRemoved: files.length },
    });
  },

  async getStats(): Promise<AdminStats> {
    const [todayOrders, monthOrders, pendingCount, completedCount, totalCount] =
      await Promise.all([
        OrderRepository.findToday(),
        OrderRepository.findThisMonth(),
        OrderRepository.countByStatus('pending'),
        OrderRepository.countByStatus('completed'),
        OrderRepository.count(),
      ]);

    const revenueToday = todayOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.total, 0);

    const revenueThisMonth = monthOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.total, 0);

    // Determine most popular service from today's orders
    const serviceCounts: Record<string, number> = {
      'Print Only': 0,
      'Print + Binding': 0,
      'Binding Only': 0,
      'Lamination': 0,
      'Passport Photo': 0,
    };

    for (const order of monthOrders) {
      if (order.binding.mode === 'print_and_binding') serviceCounts['Print + Binding']!++;
      else if (order.binding.mode === 'binding_only') serviceCounts['Binding Only']!++;
      else serviceCounts['Print Only']!++;

      if (order.lamination.length > 0) serviceCounts['Lamination']!++;
    }

    const mostPopularService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Print Only';

    return {
      ordersToday: todayOrders.length,
      revenueToday,
      revenueThisMonth,
      pendingOrders: pendingCount,
      completedOrders: completedCount,
      totalOrders: totalCount,
      mostPopularService,
    };
  },
};
