import { Request } from 'express';

// ============================================================
// Domain primitives
// ============================================================

export type Role = 'user' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'printing'
  | 'ready'
  | 'completed'
  | 'awaiting_delivery'
  | 'cancelled';

export type PrintType = 'bw' | 'color';
export type PrintSide = 'single' | 'double';
export type BindingMode = 'print_only' | 'print_and_binding' | 'binding_only';
export type LaminationType = 'id_card' | 'aadhaar' | 'pan' | 'certificate' | 'a4';
export type PassportTemplate = 'passport' | 'visa' | 'id';

/** Matches frontend type exactly — 'cancelled' intentionally excluded */
export type PrintJobStatus = 'waiting' | 'printing' | 'printed' | 'failed';

export type PrinterStatus = 'online' | 'offline' | 'busy';
export type NotificationType = 'order_update' | 'file_ready' | 'admin_action' | 'system';

export type ActivityAction =
  | 'order_created'
  | 'order_updated'
  | 'order_status_changed'
  | 'order_printed'
  | 'file_uploaded'
  | 'file_replaced'
  | 'file_deleted'
  | 'pricing_updated'
  | 'user_registered'
  | 'admin_action'
  | 'passport_created'
  | 'passport_deleted'
  | 'print_job_created'
  | 'print_job_updated'
  | 'printer_created'
  | 'printer_updated'
  | 'user_deleted';

// ============================================================
// Firestore collection documents
// ============================================================

/** users/{uid} */
export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** files/{fileId} */
export interface StoredFile {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  pages?: number;
  uploadedAt: string;
  ownerId: string;
  /** Firebase Storage object path — not sent to client */
  storagePath: string;
  /**
   * Firebase Storage download token, set once at upload time and stored on
   * the object's metadata. Used to build the public download URL without
   * needing IAM signBlob permissions (which the Cloud Functions runtime
   * service account doesn't have by default).
   */
  downloadToken: string;
  /**
   * Signed download URL — generated on each GET, matches frontend `url` field.
   * Named `url` to mirror the frontend StoredFile interface.
   */
  url?: string;
  /**
   * Per-file print settings, editable independently of every other file on
   * the same order. Undefined until an admin edits this file explicitly (or
   * sends it to print for the first time) — until then, callers should fall
   * back to the order-level `printOptions` snapshot captured at checkout.
   * Reprinting/editing overwrites this in place; there is no history array.
   */
  printOptions?: PrintOptions;
  /** Printer this file is currently assigned to in the admin print review UI. */
  printerId?: string;
}

export type PaperType = 'normal' | 'photo';

export interface PrintOptions {
  type: PrintType;
  side: PrintSide;
  copies: number;
  paperSize: 'A4' | '4x6';
  /**
   * Normal paper is only offered in A4; photo paper is offered in both A4
   * and 4x6. Selecting 4x6 always implies photo paper + colour print.
   */
  paperType: PaperType;
  pages: { mode: 'all' | 'custom'; range?: string };
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
  documentCount?: number;
  estimatedPages?: number;
}

/** orders/{orderId} */
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

/** pricing/default — single document */
export interface Pricing {
  bwPage: number;
  colorPage: number;
  frontCoverColor: number;
  backCoverColor: number;
  passportSheet: number;
  /**
   * Photo paper is always billed at a flat colour rate per print, split by
   * size. Normal paper only comes in A4 and continues to use bwPage/colorPage.
   */
  photoPaperA4: number;
  photoPaper4x6: number;
  lamination: Record<LaminationType, number>;
  spiralBinding: number;
  /**
   * B&W double-sided only: flat work charge added on top of the per-paper
   * print cost, billed in groups of `doubleSideWorkChargePageGroup` document
   * pages (rounded up). E.g. rate=5, group=5 → ₹5 per 5 pages of the
   * document (not per paper). Color double-sided pricing is unaffected.
   */
  doubleSideWorkCharge: number;
  doubleSideWorkChargePageGroup: number;
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * passportSheets/{sheetId}
 * Simplified to match updated frontend type — single photoUrl field.
 */
export interface PassportSheet {
  id: string;
  userId: string;
  template: PassportTemplate;
  /** Signed URL for the uploaded / generated photo */
  photoUrl?: string;
  /** Firebase Storage path for the photo (internal, not sent to client) */
  photoPath?: string;
  photosPerSheet: number;
  createdAt: string;
}

/**
 * Snapshot of the source document as resolved at the moment a print job was
 * submitted — enough for the print queue worker to (re)fetch the bytes and
 * for status polling to know what it's tracking. `sourceUrl` is Sora's own
 * (Firebase Storage) download URL, not print-server's.
 */
export interface PrintJobDocumentRef {
  sourceUrl: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * printJobs/{jobId}
 * One doc per print attempt (send/resend), created by the admin print
 * review page. Linked back to the order + file it came from so status
 * polling can be scoped per-order.
 */
export interface PrintJob {
  id: string;
  orderId: string;
  /** id of the StoredFile within order.files[] this job prints */
  fileId: string;
  fileName: string;
  /** Chosen printer, or omitted so print-server can assign one automatically. */
  printerId?: string;
  status: PrintJobStatus;
  queuedAt: string;
  updatedAt?: string;
  /** The per-file print options resolved at send time (already defaulted). */
  printOptions: PrintOptions;
  documentRef: PrintJobDocumentRef;
  /** print-server's own job id, once RealPrinterAdapter has created it there. */
  remoteJobId?: string;
  /** Populated when status === 'failed'. */
  lastError?: string;
}

/** printers/{printerId} */
export interface Printer {
  id: string;
  name: string;
  model: string;
  color: boolean;
  status: PrinterStatus;
  createdAt: string;
  updatedAt: string;
}

/** notifications/{notificationId} */
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/** activityLogs/{logId} */
export interface ActivityLog {
  id: string;
  action: ActivityAction;
  userId: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ============================================================
// Valid order-status transitions
// ============================================================

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'completed', 'cancelled'],
  accepted: ['printing', 'pending', 'completed', 'cancelled'],
  printing: ['ready', 'awaiting_delivery', 'completed', 'cancelled'],
  ready: ['completed', 'cancelled'],
  awaiting_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/** Statuses a customer is allowed to cancel from (anything not already terminal). */
export const CANCELLABLE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'printing',
  'ready',
  'awaiting_delivery',
];

// ============================================================
// HTTP request/response helpers
// ============================================================

export interface AuthTokenPayload {
  uid: string;
  email?: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthTokenPayload;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================
// Statistics
// ============================================================

export interface AdminStats {
  ordersToday: number;
  revenueToday: number;
  revenueThisMonth: number;
  pendingOrders: number;
  completedOrders: number;
  totalOrders: number;
  mostPopularService: string;
}

export interface UserStats {
  active: number;
  completed: number;
  total: number;
}

/** Admin-facing user record enriched with usage stats (files/orders/spend). */
export interface AdminUserDetail extends User {
  fileCount: number;
  totalFileSizeBytes: number;
  orderCount: number;
  activeOrders: number;
  completedOrders: number;
  totalSpent: number;
}

// ============================================================
// Pricing calculation helpers
// ============================================================

export interface PriceLine {
  label: string;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  total: number;
}
