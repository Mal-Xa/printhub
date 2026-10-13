import type { PrinterId, PrinterInfo } from "print-common";
import { PRINTER_STATUS_STYLES } from "../lib/status";
import { StatusBadge } from "./StatusBadge";

interface PrinterPickerProps {
  printers: PrinterInfo[];
  selectedId: PrinterId | null;
  onSelect: (id: PrinterId) => void;
  loading: boolean;
  disabled?: boolean;
}

export function PrinterPicker({ printers, selectedId, onSelect, loading, disabled }: PrinterPickerProps) {
  if (loading && printers.length === 0) {
    return <p className="text-sm text-slate-400">Looking for printers…</p>;
  }

  if (printers.length === 0) {
    return <p className="text-sm text-slate-400">No printers are available right now.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {printers.map((printer) => {
        const style = PRINTER_STATUS_STYLES[printer.status];
        const selected = printer.id === selectedId;
        return (
          <button
            key={printer.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(printer.id)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              selected ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"
            }`}
          >
            <span className="flex flex-col">
              <span className="font-medium text-slate-800">{printer.name}</span>
              {printer.location && <span className="text-xs text-slate-400">{printer.location}</span>}
            </span>
            <StatusBadge label={style.label} className={style.className} />
          </button>
        );
      })}
    </div>
  );
}
