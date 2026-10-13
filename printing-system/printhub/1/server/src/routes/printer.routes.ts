import { Router } from 'express';
import { PrinterController } from '../controllers/printer.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

// All printer data is now read-only from Sora's perspective — it's live
// state proxied from print-server, not something Sora's admins create or
// edit directly (print-agent registration is what adds/removes printers).
router.use(authenticateUser);

/** GET /api/printers — live printer list (cached a few seconds server-side) */
router.get('/', PrinterController.list);

/** GET /api/printers/health — print-server reachability, for the navbar widget */
router.get('/health', PrinterController.health);

/** GET /api/printers/:id */
router.get('/:id', PrinterController.get);

/** GET /api/printers/:id/queue */
router.get('/:id/queue', PrinterController.getQueue);

export default router;
