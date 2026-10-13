import type {
  Order,
  OrderStatus,
  PassportSheet,
  Pricing,
  PrintJob,
  PrintOptions,
  Printer,
  StoredFile,
  User,
} from "@/types";

// In-memory mock database. Persists for the lifetime of the page.
// Designed to be swapped for Firebase / REST without changing the service signatures.

export const defaultPricing: Pricing = {
  bwPage: 2,
  colorPage: 8,
  frontCoverColor: 10,
  backCoverColor: 10,
  passportSheet: 40,
  photoPaperA4: 25,
  photoPaper4x6: 15,
  lamination: {
    id_card: 20,
    aadhaar: 30,
    pan: 20,
    certificate: 50,
    a4: 80,
  },
  spiralBinding: 40,
  doubleSideWorkCharge: 5,
  doubleSideWorkChargePageGroup: 5,
};

export const mockUsers: User[] = [
  {
    id: "u_demo",
    fullName: "Arjun Sharma",
    phone: "+91 98765 43210",
    email: "demo@sora.in",
    role: "user",
  },
  {
    id: "u_admin",
    fullName: "Sora Admin",
    phone: "+91 99887 76655",
    email: "admin@sora.in",
    role: "admin",
  },
];

function iso(daysAgo = 0, hoursAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

let fileSeq = 1;
const mkFile = (
  name: string,
  mimeType: string,
  sizeBytes: number,
  pages?: number,
  daysAgo = 0,
): StoredFile => ({
  id: `f_${fileSeq++}`,
  name,
  sizeBytes,
  mimeType,
  pages,
  uploadedAt: iso(daysAgo),
  ownerId: "u_demo",
});

export const mockFiles: StoredFile[] = [
  mkFile("DBMS_Unit_1_Notes.pdf", "application/pdf", 1_240_000, 24, 1),
  mkFile("Resume_Arjun_Sharma.pdf", "application/pdf", 220_000, 2, 3),
  mkFile("Project_Proposal.docx", "application/vnd.openxmlformats", 540_000, 12, 4),
  mkFile("Internship_Certificate.jpg", "image/jpeg", 880_000, 1, 5),
  mkFile("Aadhaar_Front.jpg", "image/jpeg", 320_000, 1, 6),
  mkFile("Aadhaar_Back.jpg", "image/jpeg", 305_000, 1, 6),
  mkFile("Final_Year_Report.pdf", "application/pdf", 4_400_000, 86, 8),
  mkFile("Class_Presentation.pptx", "application/vnd.openxmlformats", 2_100_000, 18, 10),
];

const customers = [
  { name: "Arjun Sharma", phone: "+91 98765 43210", email: "demo@sora.in" },
  { name: "Priya Patel", phone: "+91 98123 45678", email: "priya@example.in" },
  { name: "Rahul Verma", phone: "+91 90909 11221", email: "rahul.v@example.in" },
  { name: "Ananya Iyer", phone: "+91 97000 11223", email: "ananya@example.in" },
  { name: "Karthik Nair", phone: "+91 99887 76655", email: "karthik@example.in" },
];

let orderSeq = 1001;
const mkOrder = (
  status: OrderStatus,
  files: StoredFile[],
  total: number,
  daysAgo: number,
  custIdx = 0,
  overrides: Partial<Order> = {},
): Order => {
  const id = `SPH-${orderSeq++}`;
  const c = customers[custIdx % customers.length];
  return {
    id,
    userId: custIdx === 0 ? "u_demo" : `u_${custIdx}`,
    customer: c,
    files,
    printOptions: {
      type: "bw",
      side: "double",
      copies: 1,
      paperSize: "A4",
      paperType: "normal",
      pages: { mode: "all" },
      frontCoverColor: false,
      backCoverColor: false,
      removeBlankPages: true,
    },
    lamination: [],
    binding: { mode: "print_only" },
    specialInstructions: "",
    status,
    total,
    createdAt: iso(daysAgo, 2),
    updatedAt: iso(daysAgo, 1),
    ...overrides,
  };
};

export const mockOrders: Order[] = [
  mkOrder("pending", [mockFiles[0]], 96, 0, 0, {
    printOptions: {
      ...mkOrder("pending", [], 0, 0).printOptions,
      copies: 2,
    },
  }),
  mkOrder("accepted", [mockFiles[1]], 16, 0, 1),
  mkOrder("printing", [mockFiles[2]], 148, 1, 2, {
    binding: { mode: "print_and_binding" },
    lamination: [{ type: "id_card", quantity: 1 }],
  }),
  mkOrder("ready", [mockFiles[3]], 40, 2, 3, {
    lamination: [{ type: "a4", quantity: 1 }],
  }),
  mkOrder("completed", [mockFiles[4], mockFiles[5]], 80, 4, 4, {
    lamination: [
      { type: "aadhaar", quantity: 1 },
      { type: "id_card", quantity: 1 },
    ],
  }),
  mkOrder("completed", [mockFiles[6]], 380, 6, 0),
  mkOrder("awaiting_delivery", [], 80, 0, 1, {
    binding: { mode: "binding_only", documentCount: 1, estimatedPages: 80 },
  }),
  mkOrder("completed", [mockFiles[7]], 144, 10, 2, {
    printOptions: {
      ...mkOrder("completed", [], 0, 0).printOptions,
      type: "color",
    },
  }),
  mkOrder("pending", [mockFiles[0]], 48, 0, 3),
  mkOrder("printing", [mockFiles[1]], 36, 0, 4),
  mkOrder("ready", [mockFiles[2]], 264, 1, 1, {
    binding: { mode: "print_and_binding" },
  }),
  mkOrder("completed", [mockFiles[6]], 172, 14, 0),
];

export const mockPassportSheets: PassportSheet[] = [
  {
    id: "ps_1",
    userId: "u_demo",
    template: "passport",
    createdAt: iso(2),
    photosPerSheet: 9,
  },
  {
    id: "ps_2",
    userId: "u_demo",
    template: "visa",
    createdAt: iso(7),
    photosPerSheet: 9,
  },
  {
    id: "ps_3",
    userId: "u_demo",
    template: "id",
    createdAt: iso(12),
    photosPerSheet: 9,
  },
];

export const mockPrinters: Printer[] = [
  {
    id: "p_canon",
    name: "Canon LBP2900",
    status: "ONLINE",
    capabilities: {
      supportsColor: false,
      supportsDuplex: false,
      maxDpi: 600,
      supportedPaperSizes: ["A4"],
      maxCopiesPerJob: 50,
      maxDocumentSizeBytes: 50_000_000,
    },
    lastSeenAt: iso(0, 0),
  },
  {
    id: "p_epson",
    name: "Epson Color Printer",
    status: "BUSY",
    capabilities: {
      supportsColor: true,
      supportsDuplex: true,
      maxDpi: 4800,
      supportedPaperSizes: ["A4", "4x6in"],
      maxCopiesPerJob: 50,
      maxDocumentSizeBytes: 50_000_000,
    },
    lastSeenAt: iso(0, 0),
  },
];

const mockPrintOptions: PrintOptions = {
  type: "bw",
  side: "single",
  copies: 1,
  paperSize: "A4",
  paperType: "normal",
  pages: { mode: "all" },
  frontCoverColor: false,
  backCoverColor: false,
  removeBlankPages: false,
};

export const mockPrintQueue: PrintJob[] = [
  {
    id: "j_1",
    orderId: "o_mock",
    fileId: "f_1",
    fileName: "DBMS_Unit_1_Notes.pdf",
    printerId: "p_canon",
    status: "printing",
    queuedAt: iso(0, 1),
    printOptions: mockPrintOptions,
    documentRef: { sourceUrl: "", mimeType: "application/pdf", sizeBytes: 0 },
  },
  {
    id: "j_2",
    orderId: "o_mock",
    fileId: "f_2",
    fileName: "Project_Proposal.docx",
    printerId: "p_canon",
    status: "waiting",
    queuedAt: iso(0, 0),
    printOptions: mockPrintOptions,
    documentRef: { sourceUrl: "", mimeType: "application/octet-stream", sizeBytes: 0 },
  },
  {
    id: "j_3",
    orderId: "o_mock",
    fileId: "f_3",
    fileName: "Class_Presentation.pptx",
    printerId: "p_epson",
    status: "waiting",
    queuedAt: iso(0, 0),
    printOptions: mockPrintOptions,
    documentRef: { sourceUrl: "", mimeType: "application/octet-stream", sizeBytes: 0 },
  },
  {
    id: "j_4",
    orderId: "o_mock",
    fileId: "f_4",
    fileName: "Resume_Arjun_Sharma.pdf",
    printerId: "p_canon",
    status: "printed",
    queuedAt: iso(0, 2),
    printOptions: mockPrintOptions,
    documentRef: { sourceUrl: "", mimeType: "application/pdf", sizeBytes: 0 },
  },
  {
    id: "j_5",
    orderId: "o_mock",
    fileId: "f_5",
    fileName: "Aadhaar_Front.jpg",
    printerId: "p_epson",
    status: "failed",
    queuedAt: iso(0, 3),
    printOptions: mockPrintOptions,
    documentRef: { sourceUrl: "", mimeType: "image/jpeg", sizeBytes: 0 },
  },
];

// Mutable store
export const db = {
  users: [...mockUsers],
  files: [...mockFiles],
  orders: [...mockOrders],
  passportSheets: [...mockPassportSheets],
  printers: [...mockPrinters],
  printQueue: [...mockPrintQueue],
  pricing: { ...defaultPricing },
};

// ---- localStorage persistence (mock backend survives reloads) ----
const PERSIST_KEY = "sora.db.v1";

type PersistShape = {
  files: StoredFile[];
  orders: Order[];
  passportSheets: PassportSheet[];
  printers: Printer[];
  printQueue: PrintJob[];
  pricing: Pricing;
};

function stripFileUrls(files: StoredFile[]): StoredFile[] {
  // object URLs are not valid after reload — drop them
  return files.map(({ url: _url, ...rest }) => rest);
}

if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistShape>;
      if (parsed.files) db.files = parsed.files;
      if (parsed.orders) db.orders = parsed.orders;
      if (parsed.passportSheets) db.passportSheets = parsed.passportSheets;
      if (parsed.printers) db.printers = parsed.printers;
      if (parsed.printQueue) db.printQueue = parsed.printQueue;
      if (parsed.pricing) db.pricing = parsed.pricing;
    }
  } catch {
    /* ignore corrupt cache */
  }
}

export function persistDb(): void {
  if (typeof window === "undefined") return;
  try {
    const snapshot: PersistShape = {
      files: stripFileUrls(db.files),
      orders: db.orders.map((o) => ({ ...o, files: stripFileUrls(o.files) })),
      passportSheets: db.passportSheets,
      printers: db.printers,
      printQueue: db.printQueue,
      pricing: db.pricing,
    };
    window.localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota exceeded — silently drop */
  }
}

export function resetDb(): void {
  db.files = [...mockFiles];
  db.orders = [...mockOrders];
  db.passportSheets = [...mockPassportSheets];
  db.printers = [...mockPrinters];
  db.printQueue = [...mockPrintQueue];
  db.pricing = { ...defaultPricing };
  if (typeof window !== "undefined") window.localStorage.removeItem(PERSIST_KEY);
}

export function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
