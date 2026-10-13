import { Router } from 'express';
import { PassportController } from '../controllers/passport.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPassportSchema } from '../validators/passport.validator';

const router = Router();

router.use(authenticateUser);

/** POST /api/passport — JSON body: { template, photosPerSheet, photoUrl? } */
router.post('/', validate(createPassportSchema), PassportController.create);

/** GET /api/passport — own sheets for users, all for admins */
router.get('/', PassportController.list);

/** DELETE /api/passport/:id */
router.delete('/:id', PassportController.delete);

export default router;
