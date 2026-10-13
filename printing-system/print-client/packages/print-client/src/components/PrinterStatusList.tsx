import type { PrinterInfo } from "print-common";
import { PRINTER_STATUS_STYLES } from "../lib/status";
import { StatusBadge } from "./StatusBadge";

interface PrinterStatusListProps {
  printers: PrinterInfo[];
  loading: boolean;
  error: string | null;
}

export function PrinterStatusList({ printers, loading, error }: PrinterStatusListProps) {
  if (loading && printers.length === 0) {
    return <p className="text-sm text-slate-400">Looking for printers…</p>;
  }

  if (error && printers.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (printers.length === 0) {
    return <p className="text-sm text-slate-400">No printers found on this network yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {printers.map((printer) => {
        const style = PRINTER_STATUS_STYLES[printer.status];
        return (
          <li key={printer.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{printer.name}</p>
              {printer.location && <p className="text-xs text-slate-400">{printer.location}</p>}
              <p className="mt-0.5 text-xs text-slate-400">
                {printer.capabilities.supportsColor ? "Color" : "Mono"} ·{" "}
                {printer.capabilities.supportsDuplex ? "Duplex" : "Simplex"} · up to{" "}
                {printer.capabilities.maxCopiesPerJob} copies
              </p>
            </div>
            <StatusBadge label={style.label} className={style.className} />
          </li>
        );
      })}
    </ul>
  );
}
