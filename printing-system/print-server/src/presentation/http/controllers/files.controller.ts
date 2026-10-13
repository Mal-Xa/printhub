import type { NextFunction, Request, Response } from "express";
import { asFileId } from "print-common";
import type { UploadService } from "../../../application/services/upload.service";

interface FileIdParams {
  fileId: string;
}

/**
 * Streams a previously uploaded document's bytes back to the caller.
 * print-agent uses this to download a job's source document over
 * HTTP once print-server has dispatched the job to it -- the
 * `DocumentRef.storageUri` on a job always points here.
 */
export class FilesController {
  constructor(private readonly uploadService: UploadService) {}

  download = async (req: Request<FileIdParams>, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fsPath, fileName, mimeType } = await this.uploadService.getFileForDownload(
        asFileId(req.params.fileId)
      );
      res.status(200);
      res.type(mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.sendFile(fsPath, (err) => {
        if (err) next(err);
      });
    } catch (err) {
      next(err);
    }
  };
}
