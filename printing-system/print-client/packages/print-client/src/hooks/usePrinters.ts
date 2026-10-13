import { useMemo } from "react";
import type { PrinterInfo } from "print-common";
import { ASSIGNABLE_PRINTER_STATUSES } from "print-common";
import { listPrinters } from "../api/printApi";
import { usePolling } from "./usePolling";

export function usePrinters() {
  const { data, error, loading, refresh } = usePolling((signal) => listPrinters({}, signal), 6000);

  const printers: PrinterInfo[] = data?.data ?? [];
  const printableOnly = useMemo(
    () => printers.filter((p) => ASSIGNABLE_PRINTER_STATUSES.includes(p.status)),
    [printers],
  );

  return { printers, printableOnly, error, loading, refresh };
}
