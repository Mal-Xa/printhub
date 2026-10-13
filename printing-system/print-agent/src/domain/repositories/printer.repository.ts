import { LocalPrinterRecord } from "../entities/local-printer-record.entity";

export interface PrinterRepository {
  upsert(record: LocalPrinterRecord): Promise<void>;
  get(localName: string): Promise<LocalPrinterRecord | null>;
  list(): Promise<LocalPrinterRecord[]>;
  remove(localName: string): Promise<void>;
}
