import type { DocumentRef, FileId } from "print-common";
import type { UploadedFileRepository } from "../../../domain/repositories";

/** In-memory `UploadedFileRepository`. See `InMemoryJobRepository` for swap-out notes. */
export class InMemoryUploadedFileRepository implements UploadedFileRepository {
  private readonly files = new Map<string, DocumentRef>();

  async save(doc: DocumentRef): Promise<DocumentRef> {
    this.files.set(doc.fileId, doc);
    return doc;
  }

  async findById(fileId: FileId): Promise<DocumentRef | null> {
    return this.files.get(fileId) ?? null;
  }
}
