import { Router } from 'express';
import { PrintJobController } from '../controllers/printJob.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updatePrintJobStatusSchema } from '../validators/printJob.validator';

const router = Router();

router.use(authenticateUser, requireAdmin);

// Job creation now lives under /orders/:id/print-jobs (see order.routes.ts) since
// every job is scoped to a specific order + file. This router covers
// cross-order monitoring and per-job actions.

/** GET /api/print-jobs — admin-wide queue monitoring page — returns all jobs */
router.get('/', PrintJobController.getAll);

/** GET /api/print-jobs/queue — waiting jobs only (internal / queue worker) */
router.get('/queue', PrintJobController.getQueue);

/** GET /api/print-jobs/:id */
router.get('/:id', PrintJobController.getById);

/** PATCH /api/print-jobs/:id/status — manual override */
router.patch('/:id/status', validate(updatePrintJobStatusSchema), PrintJobController.updateStatus);

/** DELETE /api/print-jobs/:id — cancel */
router.delete('/:id', PrintJobController.cancel);

export default router;
