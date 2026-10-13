import type { DocumentRef, FileId } from "print-common";

/**
 * Persistence contract for metadata of an uploaded-but-not-yet-printed
 * document. A `PrintRequest` references a file by id; this repository
 * lets `JobService` resolve that id back into a full `DocumentRef`
 * without re-reading the file from disk.
 */
export interface UploadedFileRepository {
  save(doc: DocumentRef): Promise<DocumentRef>;
  findById(fileId: FileId): Promise<DocumentRef | null>;
}
