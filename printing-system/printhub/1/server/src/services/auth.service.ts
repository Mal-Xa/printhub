import { getAuth } from '../config/firebase';
import { UserRepository } from '../repositories/user.repository';
import { ActivityLogService } from './activityLog.service';
import { User, Role } from '../types';
import { ConflictError, UnauthorizedError, NotFoundError } from '../utils/errors';
import { RegisterInput, UpdateProfileInput } from '../validators/auth.validator';

export const AuthService = {
  /**
   * Verifies a Firebase ID token, creates a Firestore user profile if it doesn't
   * exist yet (first-time registration), and returns the user document.
   */
  async register(input: RegisterInput): Promise<User> {
    const auth = getAuth();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(input.idToken);
    } catch {
      throw new UnauthorizedError('Invalid Firebase ID token');
    }

    const existing = await UserRepository.findById(decoded.uid);
    if (existing) throw new ConflictError('A user with this account already exists');

    const user = await UserRepository.create(decoded.uid, {
      fullName: input.fullName,
      phone: input.phone ?? '',
      email: decoded.email ?? '',
      role: 'user' as Role,
    });

    await ActivityLogService.log({
      action: 'user_registered',
      userId: user.id,
      targetId: user.id,
      targetType: 'user',
      metadata: { email: user.email },
    });

    return user;
  },

  /**
   * Verifies a Firebase ID token and returns the existing Firestore user profile.
   * Throws if the user has not been registered yet.
   */
  async login(idToken: string): Promise<User> {
    const auth = getAuth();
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedError('Invalid Firebase ID token');
    }

    const user = await UserRepository.findById(decoded.uid);
    if (!user) throw new NotFoundError('User profile not found — please register first');
    return user;
  },

  async getProfile(uid: string): Promise<User> {
    const user = await UserRepository.findById(uid);
    if (!user) throw new NotFoundError('User profile');
    return user;
  },

  async setRole(uid: string, role: Role, adminUid: string): Promise<void> {
    const user = await UserRepository.findById(uid);
    if (!user) throw new NotFoundError('User');
    await UserRepository.setRole(uid, role);
    await ActivityLogService.log({
      action: 'admin_action',
      userId: adminUid,
      targetId: uid,
      targetType: 'user',
      metadata: { newRole: role },
    });
  },

  /**
   * Update own profile fields (fullName, phone, email).
   * Mirrors authService.updateProfile() on the frontend.
   */
  async updateProfile(uid: string, input: UpdateProfileInput): Promise<User> {
    const existing = await UserRepository.findById(uid);
    if (!existing) throw new NotFoundError('User profile');

    const updated = await UserRepository.update(uid, {
      fullName: input.fullName ?? existing.fullName,
      phone: input.phone ?? existing.phone,
      email: input.email ?? existing.email,
    });

    if (!updated) throw new NotFoundError('User profile');

    await ActivityLogService.log({
      action: 'user_registered',   // reuse closest action — extend ActivityAction if desired
      userId: uid,
      targetId: uid,
      targetType: 'user',
      metadata: { updated: input },
    });

    return updated;
  },
};
