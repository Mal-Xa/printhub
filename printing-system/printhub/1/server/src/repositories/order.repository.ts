import { getFirestore, COLLECTIONS } from '../config/firebase';
import { Order, OrderStatus } from '../types';
import { nowISO } from '../utils/id';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.ORDERS);

export const OrderRepository = {
  async findById(id: string): Promise<Order | null> {
    const snap = await col().doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Order;
  },

  async findByUser(userId: string): Promise<Order[]> {
    const snap = await col()
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  },

  async findAll(limit = 50, startAfter?: string): Promise<Order[]> {
    let query = col().orderBy('createdAt', 'desc').limit(limit);
    if (startAfter) {
      const cursor = await col().doc(startAfter).get();
      if (cursor.exists) query = query.startAfter(cursor);
    }
    const snap = await query.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  },

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    const snap = await col()
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  },

  async findToday(): Promise<Order[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const snap = await col()
      .where('createdAt', '>=', start.toISOString())
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  },

  async findThisMonth(): Promise<Order[]> {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const snap = await col()
      .where('createdAt', '>=', start.toISOString())
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  },

  async create(order: Order): Promise<Order> {
    await col().doc(order.id).set(order);
    return order;
  },

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await col().doc(id).update({ status, updatedAt: nowISO() });
  },

  async update(id: string, data: Partial<Order>): Promise<void> {
    await col().doc(id).update({ ...data, updatedAt: nowISO() });
  },

  async count(): Promise<number> {
    const snap = await col().count().get();
    return snap.data().count;
  },

  async countByStatus(status: OrderStatus): Promise<number> {
    const snap = await col().where('status', '==', status).count().get();
    return snap.data().count;
  },
};
