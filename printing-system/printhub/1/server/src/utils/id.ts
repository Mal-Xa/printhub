import { v4 as uuidv4 } from 'uuid';
import { getFirestore, COLLECTIONS } from '../config/firebase';

/** Generate a random UUID */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generate a human-readable order ID in the format SPH-XXXX.
 * Reads the current counter from Firestore and atomically increments it.
 */
export async function generateOrderId(): Promise<string> {
  const db = getFirestore();
  const counterRef = db.collection('meta').doc('orderCounter');

  const newId = await db.runTransaction(async (txn) => {
    const snap = await txn.get(counterRef);
    const current: number = snap.exists ? (snap.data()?.count ?? 1000) : 1000;
    const next = current + 1;
    txn.set(counterRef, { count: next }, { merge: true });
    return next;
  });

  return `SPH-${newId}`;
}

/** ISO timestamp string for right now */
export function nowISO(): string {
  return new Date().toISOString();
}
