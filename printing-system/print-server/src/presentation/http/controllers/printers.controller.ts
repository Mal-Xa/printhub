import type { NextFunction, Request, Response } from "express";
import {
  asPrinterId,
  type ApiListResponse,
  type ApiSuccessResponse,
  type ListPrintersRequest,
  type ListPrintersResponse,
  type Printer,
  type PrinterInfo,
  type PrinterStatusResponse,
  type QueueItem,
} from "print-common";
import type { PrinterService } from "../../../application/services/printer.service";
import type { QueueService } from "../../../application/services/queue.service";

function toPrinterInfo(printer: Printer): PrinterInfo {
  return {
    id: printer.id,
    name: printer.name,
    status: printer.status,
    location: printer.location,
    capabilities: {
      supportsColor: printer.capabilities.supportsColor,
      supportsDuplex: printer.capabilities.supportsDuplex,
      maxCopiesPerJob: printer.capabilities.maxCopiesPerJob,
    },
  };
}

interface PrinterIdParams {
  printerId: string;
}

export class PrintersController {
  constructor(
    private readonly printerService: PrinterService,
    private readonly queueService: QueueService
  ) {}

  get = async (req: Request<PrinterIdParams>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const printer = await this.printerService.getPrinter(asPrinterId(req.params.printerId));
      const body: ApiSuccessResponse<Printer> = { data: printer };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request = req.query as unknown as ListPrintersRequest;
      const result = await this.printerService.listPrinters(request);
      const body: ListPrintersResponse = {
        data: result.items.map(toPrinterInfo),
        pagination: result.pagination,
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };

  getStatus = async (req: Request<PrinterIdParams>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const printer = await this.printerService.getPrinter(asPrinterId(req.params.printerId));
      const body: PrinterStatusResponse = {
        printerId: printer.id,
        status: printer.status,
        consumables: printer.consumables,
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };

  getQueue = async (req: Request<PrinterIdParams>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const printerId = asPrinterId(req.params.printerId);
      // Ensures a 404 for an unknown printer instead of silently
      // returning an empty queue.
      await this.printerService.getPrinter(printerId);
      const items = await this.queueService.getQueue(printerId);
      const body: ApiListResponse<QueueItem> = {
        data: items,
        pagination: { page: 1, pageSize: items.length, totalItems: items.length, totalPages: 1 },
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  };
}
