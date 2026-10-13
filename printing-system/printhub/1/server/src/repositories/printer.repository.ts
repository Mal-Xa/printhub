import { getFirestore, COLLECTIONS } from '../config/firebase';
import { Printer, PrinterStatus } from '../types';
import { nowISO } from '../utils/id';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.PRINTERS);

export const PrinterRepository = {
  async findById(id: string): Promise<Printer | null> {
    const snap = await col().doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as Printer;
  },

  async findAll(): Promise<Printer[]> {
    const snap = await col().orderBy('createdAt', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Printer));
  },

  async create(printer: Printer): Promise<Printer> {
    await col().doc(printer.id).set(printer);
    return printer;
  },

  async updateStatus(id: string, status: PrinterStatus): Promise<void> {
    await col().doc(id).update({ status, updatedAt: nowISO() });
  },

  async update(id: string, data: Partial<Printer>): Promise<void> {
    await col().doc(id).update({ ...data, updatedAt: nowISO() });
  },

  async delete(id: string): Promise<void> {
    await col().doc(id).delete();
  },
};
