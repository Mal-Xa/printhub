export type Role = "user" | "admin";

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  createdAt?: string;
}

/** Admin-facing user record enriched with usage stats — returned by /api/admin/users/:id */
export interface AdminUserDetail extends User {
  fileCount: number;
  totalFileSizeBytes: number;
  orderCount: number;
  activeOrders: number;
  completedOrders: number;
  totalSpent: number;
}

export type OrderStatus =
  | "pending"
  | "accepted"
  | "printing"
  | "ready"
  | "completed"
  | "awaiting_delivery"
  | "cancelled";

export type PrintType = "bw" | "color";
export type PrintSide = "single" | "double";
export type BindingMode = "print_only" | "print_and_binding" | "binding_only";
export type LaminationType = "id_card" | "aadhaar" | "pan" | "certificate" | "a4";

export interface StoredFile {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  pages?: number;
  uploadedAt: string;
  ownerId: string;
  /** object URL for mock preview; not persisted on a real backend */
  url?: string;
  /**
   * Per-file print settings — independent of every other file on the same
   * order. Undefined until an admin edits this file explicitly; until then,
   * fall back to the order-level `printOptions` snapshot captured at
   * checkout. Editing overwrites this in place; there's no history array.
   */
  printOptions?: PrintOptions;
  /** Printer this file is currently assigned to in the admin print review UI. */
  printerId?: string;
}

export type PaperType = "normal" | "photo";

export interface PrintOptions {
  type: PrintType;
  side: PrintSide;
  copies: number;
  paperSize: "A4" | "4x6";
  /**
   * Normal paper is only offered in A4; photo paper is offered in both A4
   * and 4x6. Selecting 4x6 always implies photo paper + colour print.
   */
  paperType: PaperType;
  pages: { mode: "all" | "custom"; range?: string };
  frontCoverColor: boolean;
  backCoverColor: boolean;
  removeBlankPages: boolean;
}

export interface LaminationItem {
  type: LaminationType;
  quantity: number;
}

export interface BindingOptions {
  mode: BindingMode;
  /** for binding_only */
  documentCount?: number;
  estimatedPages?: number;
}

export interface Order {
  id: string;
  userId: string;
  customer: { name: string; phone: string; email: string };
  files: StoredFile[];
  printOptions: PrintOptions;
  lamination: LaminationItem[];
  binding: BindingOptions;
  specialInstructions?: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pricing {
  bwPage: number;
  colorPage: number;
  frontCoverColor: number;
  backCoverColor: number;
  passportSheet: number;
  photoPaperA4: number;
  photoPaper4x6: number;
  lamination: Record<LaminationType, number>;
  spiralBinding: number;
  /**
   * B&W double-sided only: flat work charge added on top of the per-paper
   * print cost, billed per group of `doubleSideWorkChargePageGroup`
   * document pages (rounded up). Color double-sided pricing is unaffected.
   */
  doubleSideWorkCharge: number;
  doubleSideWorkChargePageGroup: number;
}

export interface PassportSheet {
  id: string;
  userId: string;
  template: "passport" | "visa" | "id";
  photoUrl?: string;
  createdAt: string;
  photosPerSheet: number;
}

/** Live status as reported by print-server — richer than the old 3-state mock. */
export type PrinterStatus =
  | "ONLINE"
  | "OFFLINE"
  | "BUSY"
  | "ERROR"
  | "WARNING"
  | "MAINTENANCE"
  | "UNKNOWN";
export type PrintJobStatus = "waiting" | "printing" | "printed" | "failed";

export interface PrinterCapabilities {
  supportsColor: boolean;
  supportsDuplex: boolean;
  maxDpi: number;
  supportedPaperSizes: string[];
  maxCopiesPerJob: number;
  maxDocumentSizeBytes: number;
}

/** Live printer record, proxied + cached from print-server — the single source of truth everywhere printer data is shown. */
export interface Printer {
  id: string;
  name: string;
  location?: string;
  status: PrinterStatus;
  capabilities: PrinterCapabilities;
  consumables?: { tonerOrInkPercent?: number; paperTrayEmpty: boolean };
  lastSeenAt: string;
}

export interface PrintJobDocumentRef {
  sourceUrl: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PrintJob {
  id: string;
  orderId: string;
  fileId: string;
  fileName: string;
  printerId?: string;
  status: PrintJobStatus;
  queuedAt: string;
  updatedAt?: string;
  printOptions: PrintOptions;
  documentRef: PrintJobDocumentRef;
  /** print-server's own job id, once submitted */
  remoteJobId?: string;
  lastError?: string;
}
