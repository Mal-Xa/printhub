import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { PrintJobController } from '../controllers/printJob.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema, updateOrderStatusSchema, updateFilePrintSettingsSchema } from '../validators/order.validator';
import { createPrintJobSchema } from '../validators/printJob.validator';

const router = Router();

router.use(authenticateUser);

/** POST /api/orders — create a new order */
router.post('/', validate(createOrderSchema), OrderController.create);

/** GET /api/orders/stats — user stats: { active, completed, total } */
router.get('/stats', OrderController.stats);

/** GET /api/orders — own orders for users, all for admins */
router.get('/', OrderController.list);

/** GET /api/orders/:id */
router.get('/:id', OrderController.getById);

/** PATCH /api/orders/:id/status — admin only */
router.patch('/:id/status', requireAdmin, validate(updateOrderStatusSchema), OrderController.updateStatus);

/** PATCH /api/orders/:id/cancel — order owner or admin, only while not yet completed */
router.patch('/:id/cancel', OrderController.cancel);

/** PATCH /api/orders/:id/files/:fileId/print-settings — admin print review page, per-file options/printer */
router.patch(
  '/:id/files/:fileId/print-settings',
  requireAdmin,
  validate(updateFilePrintSettingsSchema),
  OrderController.updateFilePrintSettings,
);

/** GET /api/orders/:id/print-jobs — live per-file status for the print review page */
router.get('/:id/print-jobs', requireAdmin, PrintJobController.getForOrder);

/** POST /api/orders/:id/print-jobs — "Send" one file */
router.post(
  '/:id/print-jobs',
  requireAdmin,
  validate(createPrintJobSchema),
  PrintJobController.createForOrder,
);

/** POST /api/orders/:id/print-jobs/send-all — "Send all" action */
router.post('/:id/print-jobs/send-all', requireAdmin, PrintJobController.sendAll);

export default router;
