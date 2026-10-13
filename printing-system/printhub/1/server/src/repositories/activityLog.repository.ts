import { getFirestore, COLLECTIONS } from '../config/firebase';
import { ActivityLog } from '../types';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.ACTIVITY_LOGS);

export const ActivityLogRepository = {
  async create(log: ActivityLog): Promise<ActivityLog> {
    await col().doc(log.id).set(log);
    return log;
  },

  async findAll(limit = 100): Promise<ActivityLog[]> {
    const snap = await col().orderBy('createdAt', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
  },

  async findByUser(userId: string, limit = 50): Promise<ActivityLog[]> {
    const snap = await col()
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
  },

  async findByTarget(targetId: string): Promise<ActivityLog[]> {
    const snap = await col()
      .where('targetId', '==', targetId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
  },
};
