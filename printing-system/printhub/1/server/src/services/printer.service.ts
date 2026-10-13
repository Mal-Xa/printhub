import { PrinterBridgeService, LivePrinter, LivePrinterList } from './printerBridge.service';
import { NotFoundError } from '../utils/errors';

/**
 * Printer data now comes live from print-server (via PrinterBridgeService)
 * instead of Sora's own hand-entered `printers` Firestore collection. This
 * is the one place every printer-related surface (print review page, admin
 * printers page, navbar widget) reads from.
 */
export const PrinterService = {
  async list(): Promise<LivePrinter[]> {
    const { printers } = await PrinterBridgeService.getLivePrinters();
    return printers;
  },

  async listLive(forceRefresh = false): Promise<LivePrinterList> {
    return PrinterBridgeService.getLivePrinters({ forceRefresh });
  },

  async getById(id: string): Promise<LivePrinter> {
    const printer = await PrinterBridgeService.getPrinterById(id);
    if (!printer) throw new NotFoundError('Printer');
    return printer;
  },

  async getQueue(id: string) {
    // Ensures a 404 for an unknown printer instead of silently returning [].
    await this.getById(id);
    return PrinterBridgeService.getPrinterQueue(id);
  },

  async isBridgeReachable(): Promise<boolean> {
    return PrinterBridgeService.isReachable();
  },
};
