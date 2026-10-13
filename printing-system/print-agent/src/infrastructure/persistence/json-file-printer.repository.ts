import { PrinterRepository } from "../../domain/repositories/printer.repository";
import { LocalPrinterRecord } from "../../domain/entities/local-printer-record.entity";
import { JsonFileStore } from "./json-file-store";

type StoredValue = Record<string, LocalPrinterRecord>;

export class JsonFilePrinterRepository implements PrinterRepository {
  private readonly store: JsonFileStore<StoredValue>;

  constructor(filePath: string) {
    this.store = new JsonFileStore<StoredValue>(filePath, {});
  }

  async upsert(record: LocalPrinterRecord): Promise<void> {
    const all = await this.store.read();
    all[record.localName] = record;
    await this.store.write(all);
  }

  async get(localName: string): Promise<LocalPrinterRecord | null> {
    const all = await this.store.read();
    return all[localName] ?? null;
  }

  async list(): Promise<LocalPrinterRecord[]> {
    const all = await this.store.read();
    return Object.values(all);
  }

  async remove(localName: string): Promise<void> {
    const all = await this.store.read();
    delete all[localName];
    await this.store.write(all);
  }
}
