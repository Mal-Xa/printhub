import multer from "multer";

/**
 * Builds a multer middleware that buffers a single uploaded file
 * (field name `file`) in memory, capped at `maxSizeBytes`. The buffer
 * is handed to `UploadService`, which is the only place file-size and
 * mime-type validation is enforced authoritatively.
 */
export function buildUploadMiddleware(maxSizeBytes: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSizeBytes },
  }).single("file");
}
