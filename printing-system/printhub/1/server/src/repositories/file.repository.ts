import { getFirestore, COLLECTIONS } from '../config/firebase';
import { StoredFile } from '../types';
import { nowISO } from '../utils/id';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.FILES);

export const FileRepository = {
  async findById(id: string): Promise<StoredFile | null> {
    const snap = await col().doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as StoredFile;
  },

  async findByUser(userId: string): Promise<StoredFile[]> {
    const snap = await col()
      .where('ownerId', '==', userId)
      .orderBy('uploadedAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StoredFile));
  },

  /**
   * Looks up a user's existing file by its original filename, so re-uploads
   * of the same document can replace it in place instead of creating a
   * duplicate entry.
   */
  async findByOwnerAndName(ownerId: string, name: string): Promise<StoredFile | null> {
    const snap = await col()
      .where('ownerId', '==', ownerId)
      .where('name', '==', name)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0]!;
    return { id: doc.id, ...doc.data() } as StoredFile;
  },

  async findManyByIds(ids: string[]): Promise<StoredFile[]> {
    if (ids.length === 0) return [];
    // Firestore 'in' supports up to 30 items per query
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

    const results: StoredFile[] = [];
    for (const chunk of chunks) {
      const snap = await col().where('id', 'in', chunk).get();
      snap.docs.forEach(d => results.push({ id: d.id, ...d.data() } as StoredFile));
    }
    return results;
  },

  async create(file: StoredFile): Promise<StoredFile> {
    await col().doc(file.id).set(file);
    return file;
  },

  async update(id: string, data: Partial<StoredFile>): Promise<void> {
    await col().doc(id).update({ ...data, uploadedAt: nowISO() });
  },

  async delete(id: string): Promise<void> {
    await col().doc(id).delete();
  },

  async findAll(): Promise<StoredFile[]> {
    const snap = await col().orderBy('uploadedAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StoredFile));
  },
};
