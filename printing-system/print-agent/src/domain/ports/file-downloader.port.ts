import { DocumentRef } from "print-common";

export interface DownloadResult {
  filePath: string;
  bytesWritten: number;
}

export interface FileDownloaderPort {
  /** Downloads the document referenced by `document.storageUri` into `destinationDir`. */
  download(document: DocumentRef, destinationDir: string): Promise<DownloadResult>;
}
