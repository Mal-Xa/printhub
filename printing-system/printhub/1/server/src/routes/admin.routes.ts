import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateUser, requireAdmin);

/** GET /api/admin/stats  — Dashboard statistics */
router.get('/stats', AdminController.getStats);

/** GET /api/admin/orders  — Paginated list of all orders */
router.get('/orders', AdminController.getAllOrders);

/** GET /api/admin/logs  — Activity logs */
router.get('/logs', AdminController.getActivityLogs);

/** PATCH /api/admin/users/role  — Set a user's role */
router.patch('/users/role', AdminController.setUserRole);

/** GET /api/admin/users  — List every registered user */
router.get('/users', AdminController.getAllUsers);

/** GET /api/admin/users/:id  — A user's profile + usage stats */
router.get('/users/:id', AdminController.getUserDetail);

/** GET /api/admin/users/:id/files  — A user's stored files */
router.get('/users/:id/files', AdminController.getUserFiles);

/** DELETE /api/admin/users/:id  — Permanently remove a user */
router.delete('/users/:id', AdminController.deleteUser);

export default router;
