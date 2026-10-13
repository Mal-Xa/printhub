import { JobStatus, PrinterStatus } from "print-common";

interface StatusStyle {
  label: string;
  className: string;
}

export const JOB_STATUS_STYLES: Record<JobStatus, StatusStyle> = {
  [JobStatus.PENDING]: { label: "Pending", className: "bg-slate-100 text-slate-700" },
  [JobStatus.QUEUED]: { label: "Queued", className: "bg-blue-100 text-blue-700" },
  [JobStatus.ASSIGNED]: { label: "Assigned", className: "bg-indigo-100 text-indigo-700" },
  [JobStatus.PRINTING]: { label: "Printing", className: "bg-amber-100 text-amber-800" },
  [JobStatus.PAUSED]: { label: "Paused", className: "bg-orange-100 text-orange-700" },
  [JobStatus.COMPLETED]: { label: "Completed", className: "bg-green-100 text-green-700" },
  [JobStatus.CANCELLED]: { label: "Cancelled", className: "bg-slate-200 text-slate-600" },
  [JobStatus.FAILED]: { label: "Failed", className: "bg-red-100 text-red-700" },
  [JobStatus.RETRYING]: { label: "Retrying", className: "bg-amber-100 text-amber-800" },
};

export const PRINTER_STATUS_STYLES: Record<PrinterStatus, StatusStyle> = {
  [PrinterStatus.ONLINE]: { label: "Online", className: "bg-green-100 text-green-700" },
  [PrinterStatus.OFFLINE]: { label: "Offline", className: "bg-slate-200 text-slate-600" },
  [PrinterStatus.BUSY]: { label: "Busy", className: "bg-amber-100 text-amber-800" },
  [PrinterStatus.ERROR]: { label: "Error", className: "bg-red-100 text-red-700" },
  [PrinterStatus.WARNING]: { label: "Warning", className: "bg-orange-100 text-orange-700" },
  [PrinterStatus.MAINTENANCE]: { label: "Maintenance", className: "bg-purple-100 text-purple-700" },
  [PrinterStatus.UNKNOWN]: { label: "Unknown", className: "bg-slate-100 text-slate-500" },
};
