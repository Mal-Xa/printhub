import { getFirestore, COLLECTIONS } from '../config/firebase';
import { PassportSheet } from '../types';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.PASSPORT_SHEETS);

export const PassportRepository = {
  async findById(id: string): Promise<PassportSheet | null> {
    const snap = await col().doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as PassportSheet;
  },

  async findByUser(userId: string): Promise<PassportSheet[]> {
    const snap = await col()
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PassportSheet));
  },

  async findAll(): Promise<PassportSheet[]> {
    const snap = await col().orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PassportSheet));
  },

  async create(sheet: PassportSheet): Promise<PassportSheet> {
    await col().doc(sheet.id).set(sheet);
    return sheet;
  },

  async update(id: string, data: Partial<PassportSheet>): Promise<void> {
    await col().doc(id).update(data);
  },

  async delete(id: string): Promise<void> {
    await col().doc(id).delete();
  },
};
