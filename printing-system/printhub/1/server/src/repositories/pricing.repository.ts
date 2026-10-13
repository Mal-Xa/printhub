import { getFirestore, COLLECTIONS, PRICING_DOC_ID } from '../config/firebase';
import { Pricing } from '../types';
import { nowISO } from '../utils/id';

const db = () => getFirestore();
const docRef = () => db().collection(COLLECTIONS.PRICING).doc(PRICING_DOC_ID);

/** Default pricing in Indian Rupees — kept in sync with frontend mockDb.ts */
const DEFAULT_PRICING: Pricing = {
  bwPage: 2,
  colorPage: 8,
  frontCoverColor: 10,
  backCoverColor: 10,
  passportSheet: 40,       // updated: was 60
  photoPaperA4: 25,
  photoPaper4x6: 15,
  lamination: {
    id_card: 20,
    aadhaar: 30,            // updated: was 20
    pan: 20,
    certificate: 50,        // updated: was 40
    a4: 80,                 // updated: was 40
  },
  spiralBinding: 40,        // updated: was 30
  doubleSideWorkCharge: 5,
  doubleSideWorkChargePageGroup: 5,
};

export const PricingRepository = {
  async get(): Promise<Pricing> {
    const snap = await docRef().get();
    if (!snap.exists) {
      await docRef().set(DEFAULT_PRICING);
      return DEFAULT_PRICING;
    }
    // Merge with defaults so docs saved before newer fields (e.g. the
    // double-side work charge) existed still come back fully populated.
    return { ...DEFAULT_PRICING, ...(snap.data() as Pricing) };
  },

  async update(data: Pricing, updatedBy: string): Promise<Pricing> {
    const updated: Pricing = { ...data, updatedAt: nowISO(), updatedBy };
    await docRef().set(updated);
    return updated;
  },
};
