import { createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DocumentRef, HTTP_HEADERS, SUPPORTED_MIME_TYPES } from "print-common";
import { DownloadResult, FileDownloaderPort } from "../../domain/ports/file-downloader.port";
import { LoggerPort } from "../../domain/ports/logger.port";

/**
 * Downloads a job's source document over HTTP(S) from the storage URI
 * print-server hands back in the job's `DocumentRef`. Uses Node's
 * built-in `fetch` and stream pipeline rather than an HTTP client
 * dependency -- one less thing to keep compatible on constrained
 * hardware.
 */
export class HttpFileDownloader implements FileDownloaderPort {
  constructor(
    private readonly logger: LoggerPort,
    private readonly apiKey: string
  ) {}

  async download(document: DocumentRef, destinationDir: string): Promise<DownloadResult> {
    if (!SUPPORTED_MIME_TYPES.includes(document.mimeType)) {
      throw new Error(`Unsupported MIME type for file ${document.fileId}: ${document.mimeType}`);
    }

    await fs.mkdir(destinationDir, { recursive: true });
    const destPath = path.join(destinationDir, `${document.fileId}-${sanitizeFileName(document.fileName)}`);

    const response = await fetch(document.storageUri, {
      headers: { [HTTP_HEADERS.API_KEY]: this.apiKey },
    });
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download file ${document.fileId}: HTTP ${response.status}`);
    }

    const nodeStream = Readable.fromWeb(response.body as never);
    const writeStream = createWriteStream(destPath);
    await pipeline(nodeStream, writeStream);

    const stat = await fs.stat(destPath);
    if (stat.size !== document.sizeBytes) {
      this.logger.warn("Downloaded file size does not match DocumentRef.sizeBytes", {
        fileId: document.fileId,
        expected: document.sizeBytes,
        actual: stat.size,
      });
    }

    return { filePath: destPath, bytesWritten: stat.size };
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
