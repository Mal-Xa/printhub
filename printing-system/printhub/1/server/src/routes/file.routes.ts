import { Router } from 'express';
import { FileController } from '../controllers/file.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { uploadSingle } from '../middleware/upload.middleware';

const router = Router();

// All file routes require authentication
router.use(authenticateUser);

/** POST /api/files/upload  — Upload a single file to Firebase Storage */
router.post('/upload', uploadSingle, FileController.upload);

/** GET /api/files  — List files (own for users, all for admins) */
router.get('/', FileController.list);

/** GET /api/files/:id  — Get file metadata + signed download URL */
router.get('/:id', FileController.getById);

/** GET /api/files/:id/content  — Stream the file's raw bytes (auth'd, avoids storage CORS issues) */
router.get('/:id/content', FileController.getContent);

/** DELETE /api/files/:id  — Delete file from Storage and Firestore */
router.delete('/:id', FileController.delete);

export default router;
