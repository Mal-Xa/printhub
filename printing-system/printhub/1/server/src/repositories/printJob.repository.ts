import { getFirestore, COLLECTIONS } from '../config/firebase';
import { PrintJob, PrintJobStatus } from '../types';
import { nowISO } from '../utils/id';

const db = () => getFirestore();
const col = () => db().collection(COLLECTIONS.PRINT_JOBS);

export const PrintJobRepository = {
  async findById(id: string): Promise<PrintJob | null> {
    const snap = await col().doc(id).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as PrintJob;
  },

  async findByStatus(status: PrintJobStatus): Promise<PrintJob[]> {
    const snap = await col()
      .where('status', '==', status)
      .orderBy('queuedAt', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PrintJob));
  },

  async findByPrinter(printerId: string): Promise<PrintJob[]> {
    const snap = await col()
      .where('printerId', '==', printerId)
      .orderBy('queuedAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PrintJob));
  },

  async findByOrder(orderId: string): Promise<PrintJob[]> {
    const snap = await col()
      .where('orderId', '==', orderId)
      .orderBy('queuedAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PrintJob));
  },

  async findAll(limit = 100): Promise<PrintJob[]> {
    const snap = await col().orderBy('queuedAt', 'desc').limit(limit).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PrintJob));
  },

  async create(job: PrintJob): Promise<PrintJob> {
    await col().doc(job.id).set(job);
    return job;
  },

  async updateStatus(id: string, status: PrintJobStatus): Promise<void> {
    await col().doc(id).update({ status });
  },

  /** Partial update — used by the print queue worker to record remoteJobId, status transitions, errors, etc. */
  async updateFields(id: string, data: Partial<PrintJob>): Promise<void> {
    await col().doc(id).update({ ...data });
  },

  /** Hard-delete — used by cancel action */
  async delete(id: string): Promise<void> {
    await col().doc(id).delete();
  },
};
