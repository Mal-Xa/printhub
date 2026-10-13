import type { NextFunction, Request, Response } from "express";
import { asUserId, uploadRequestSchema, type ApiSuccessResponse, type UploadResponse } from "print-common";
import { ValidationError } from "../../../domain/errors";
import type { UploadService } from "../../../application/services/upload.service";

export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError("A file is required (multipart field name 'file')", [
          { field: "file", message: "No file was uploaded" },
        ]);
      }

      const result = uploadRequestSchema.safeParse({
        ownerId: req.body.ownerId,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      });
      if (!result.success) {
        const details = result.error.issues.map((issue) => ({
          field: issue.path.join(".") || undefined,
          message: issue.message,
        }));
        throw new ValidationError("Upload request validation failed", details);
      }
      const request = { ...result.data, ownerId: asUserId(result.data.ownerId) };

      const uploaded = await this.uploadService.upload(request, req.file.buffer);
      const body: ApiSuccessResponse<UploadResponse> = { data: uploaded };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  };
}
