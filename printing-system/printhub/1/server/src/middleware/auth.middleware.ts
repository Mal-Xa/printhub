import { Request, Response, NextFunction } from 'express';
import { getAuth, getFirestore, COLLECTIONS } from '../config/firebase';
import { AuthenticatedRequest, AuthTokenPayload, Role } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

// ── Core token verification ───────────────────────────────────────────────────

/**
 * Verifies the Firebase ID token in the Authorization header.
 * On success, attaches `req.user` and calls `next()`.
 * On failure, passes an UnauthorizedError to the next error handler.
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const idToken = header.slice(7);
    const decoded = await getAuth().verifyIdToken(idToken);

    // Fetch role from Firestore (the token custom claim may not be set yet)
    const db = getFirestore();
    const userSnap = await db.collection(COLLECTIONS.USERS).doc(decoded.uid).get();

    let role: Role = 'user';
    if (userSnap.exists) {
      role = (userSnap.data()?.role as Role) ?? 'user';
    }

    const payload: AuthTokenPayload = {
      uid: decoded.uid,
      email: decoded.email,
      role,
    };

    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}

// ── Role guards ───────────────────────────────────────────────────────────────

/**
 * Must be used AFTER `authenticateUser`.
 * Rejects the request with 403 if the caller is not an admin.
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const user = (req as AuthenticatedRequest).user;
  if (!user || user.role !== 'admin') {
    next(new ForbiddenError('Admin access required'));
    return;
  }
  next();
}

/**
 * Factory: only allow requests from the owner of a resource OR an admin.
 * Reads `req.params[paramName]` and compares it to `req.user.uid`.
 */
export function requireOwnerOrAdmin(paramName = 'userId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    const resourceOwnerId = req.params[paramName];

    if (!user) {
      next(new UnauthorizedError());
      return;
    }
    if (user.role === 'admin' || user.uid === resourceOwnerId) {
      next();
      return;
    }
    next(new ForbiddenError('You do not have access to this resource'));
  };
}
