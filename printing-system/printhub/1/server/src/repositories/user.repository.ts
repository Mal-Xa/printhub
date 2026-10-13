import { getFirestore, COLLECTIONS } from '../config/firebase';
import { User, Role } from '../types';
import { nowISO } from '../utils/id';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.USERS);

export const UserRepository = {
  async findById(uid: string): Promise<User | null> {
    const snap = await col().doc(uid).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as User;
  },

  async findByEmail(email: string): Promise<User | null> {
    const snap = await col().where('email', '==', email).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0]!;
    return { id: doc.id, ...doc.data() } as User;
  },

  async create(uid: string, data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = nowISO();
    const user: User = { id: uid, ...data, createdAt: now, updatedAt: now };
    await col().doc(uid).set(user);
    return user;
  },

  async update(uid: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    const ref = col().doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const updates = { ...data, updatedAt: nowISO() };
    await ref.update(updates);
    return { id: uid, ...snap.data(), ...updates } as User;
  },

  async setRole(uid: string, role: Role): Promise<void> {
    await col().doc(uid).update({ role, updatedAt: nowISO() });
  },

  async exists(uid: string): Promise<boolean> {
    const snap = await col().doc(uid).get();
    return snap.exists;
  },

  /** Returns every registered user, newest first. */
  async findAll(): Promise<User[]> {
    const snap = await col().orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
  },

  async delete(uid: string): Promise<void> {
    await col().doc(uid).delete();
  },
};
