import Busboy from 'busboy';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { BadRequestError } from '../utils/errors';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const ALLOWED_EXTENSIONS = /\.(pdf|docx|pptx|jpg|jpeg|png)$/i;

function isAllowedFile(originalname: string, mimetype: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimetype) && ALLOWED_EXTENSIONS.test(originalname);
}

/**
 * Firebase Cloud Functions (both v1 and v2) reads and buffers the entire
 * request body into `req.rawBody` BEFORE Express or any of its middleware
 * ever sees the request. This drains the underlying HTTP stream.
 *
 * Multer parses multipart data by piping the live `req` stream into its
 * internal `busboy` parser (`req.pipe(busboy)`). Inside Cloud Functions,
 * that stream has already been fully consumed by the time multer touches
 * it, so busboy receives zero bytes and throws "Unexpected end of form".
 * This is a well-documented incompatibility between multer and Cloud
 * Functions/Cloud Run (see expressjs/multer#1104).
 *
 * The fix: parse with busboy directly, and feed it `req.rawBody` (a Buffer)
 * via `busboy.end(rawBody)` whenever it's present — this is the case when
 * running as a Cloud Function. When rawBody is absent (e.g. running the
 * standalone dev server via `npm run dev` / server.ts, where no
 * pre-buffering happens), we fall back to piping the live request stream.
 */
function getRawBody(req: Request): Buffer | undefined {
  return (req as unknown as { rawBody?: Buffer }).rawBody;
}

interface ParsedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

function parseMultipart(req: Request, maxFiles: number): Promise<ParsedFile[]> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'];
    if (!contentType?.startsWith('multipart/form-data')) {
      reject(new BadRequestError('Expected multipart/form-data request'));
      return;
    }

    let bb: Busboy.Busboy;
    try {
      bb = Busboy({
        headers: req.headers,
        limits: { fileSize: env.maxFileSizeBytes, files: maxFiles },
      });
    } catch {
      reject(new BadRequestError('Malformed multipart request'));
      return;
    }

    const files: ParsedFile[] = [];
    let settled = false;

    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    bb.on('file', (fieldname, stream, info) => {
      const { filename, mimeType, encoding } = info;
      const chunks: Buffer[] = [];
      let truncated = false;

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => {
        truncated = true;
      });
      stream.on('close', () => {
        if (settled) return;
        if (truncated) {
          fail(
            new BadRequestError(
              `File exceeds the maximum allowed size of ${Math.round(env.maxFileSizeBytes / (1024 * 1024))}MB`,
            ),
          );
          return;
        }
        if (!isAllowedFile(filename, mimeType)) {
          fail(
            new BadRequestError(
              `Unsupported file type: ${mimeType}. Allowed: PDF, DOCX, PPTX, JPG, PNG`,
            ),
          );
          return;
        }
        const buffer = Buffer.concat(chunks);
        files.push({ fieldname, originalname: filename, encoding, mimetype: mimeType, buffer, size: buffer.length });
      });
    });

    bb.on('error', (err) => fail(err instanceof Error ? err : new Error(String(err))));
    bb.on('close', () => {
      if (!settled) {
        settled = true;
        resolve(files);
      }
    });

    const rawBody = getRawBody(req);
    if (rawBody) {
      bb.end(rawBody);
    } else {
      req.pipe(bb);
    }
  });
}

/** Builds Express middleware that parses a single-file multipart field into `req.file`. */
function createSingleUpload(fieldName: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = await parseMultipart(req, 1);
      const file = files.find((f) => f.fieldname === fieldName);
      if (!file) {
        next(new BadRequestError('No file provided'));
        return;
      }
      (req as Request & { file?: Express.Multer.File }).file = file as Express.Multer.File;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Builds Express middleware that parses a multi-file multipart field into `req.files`. */
function createArrayUpload(fieldName: string, maxCount: number) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = await parseMultipart(req, maxCount);
      const matched = files.filter((f) => f.fieldname === fieldName);
      (req as Request & { files?: Express.Multer.File[] }).files = matched as Express.Multer.File[];
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Single document upload (field name: "file") */
export const uploadSingle = createSingleUpload('file');

/** Multiple document uploads (field name: "files", max 10) */
export const uploadMultiple = createArrayUpload('files', 10);

/** Passport / ID photo upload (field name: "photo") */
export const uploadPhoto = createSingleUpload('photo');
