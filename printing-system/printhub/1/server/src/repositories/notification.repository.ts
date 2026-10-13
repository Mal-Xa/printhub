import { getFirestore, COLLECTIONS } from '../config/firebase';
import { Notification } from '../types';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.NOTIFICATIONS);

export const NotificationRepository = {
  async findByUser(userId: string, limit = 50): Promise<Notification[]> {
    const snap = await col()
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
  },

  async create(notification: Notification): Promise<Notification> {
    await col().doc(notification.id).set(notification);
    return notification;
  },

  async markRead(id: string): Promise<void> {
    await col().doc(id).update({ read: true });
  },

  async markAllRead(userId: string): Promise<void> {
    const snap = await col()
      .where('userId', '==', userId)
      .where('read', '==', false)
      .get();

    const batch = db().batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  },

  async delete(id: string): Promise<void> {
    await col().doc(id).delete();
  },
};
