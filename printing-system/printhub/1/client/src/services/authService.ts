import {
  firebaseAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  getIdToken,
  type FirebaseUser,
} from "@/lib/firebase";
import { ApiError, apiClient } from "./apiClient";
import type { User } from "@/types";

export interface Session {
  user: User;
  firebaseUser: FirebaseUser;
}

type ProfilePatch = Partial<Pick<User, "fullName" | "phone" | "email">>;

function firebaseAuthErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code;
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 8 characters).";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/user-not-found":
      return "No account found with this email.";
    default:
      return err instanceof Error ? err.message : "Something went wrong. Try again.";
  }
}

async function createServerProfile(
  firebaseUser: FirebaseUser,
  profile: { fullName: string; phone: string },
): Promise<User> {
  const idToken = await firebaseUser.getIdToken();
  try {
    return await apiClient.post<User>("/api/auth/register", {
      idToken,
      fullName: profile.fullName,
      phone: profile.phone,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new Error("This email is already registered. Try signing in instead.");
    }
    throw err;
  }
}

export const authService = {
  /** Subscribe to Firebase auth state. Returns unsubscribe fn. */
  onAuthStateChanged(cb: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(firebaseAuth(), cb);
  },

  /** Sign in with email/password, then fetch the server-side profile. */
  async login(email: string, password: string): Promise<Session> {
    const cred = await signInWithEmailAndPassword(firebaseAuth(), email, password);
    const user = await apiClient.post<User>("/api/auth/login", {
      idToken: await cred.user.getIdToken(),
    });
    return { user, firebaseUser: cred.user };
  },

  /**
   * Create a Firebase account, then POST to /api/auth/register to create the
   * Firestore profile. The server verifies the ID token itself.
   */
  async register(input: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
  }): Promise<Session> {
    let firebaseUser: FirebaseUser;
    try {
      firebaseUser = (
        await createUserWithEmailAndPassword(firebaseAuth(), input.email, input.password)
      ).user;
    } catch (err) {
      if ((err as { code?: string }).code !== "auth/email-already-in-use") {
        throw new Error(firebaseAuthErrorMessage(err));
      }

      // Firebase account exists without a server profile — sign in and finish setup.
      try {
        firebaseUser = (
          await signInWithEmailAndPassword(firebaseAuth(), input.email, input.password)
        ).user;
      } catch {
        throw new Error(
          "This email is already registered. Sign in with your password, or use forgot password to reset it.",
        );
      }
    }

    const user = await createServerProfile(firebaseUser, {
      fullName: input.fullName,
      phone: input.phone,
    });
    return { user, firebaseUser };
  },

  /**
   * Fetch the authenticated user's profile from the server.
   * Returns null when Firebase auth exists but no Firestore profile was created yet.
   */
  async getMe(idToken?: string): Promise<User | null> {
    try {
      return await apiClient.get<User>("/api/auth/me", { idToken });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  async logout(): Promise<void> {
    await signOut(firebaseAuth());
  },

  async forgotPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(firebaseAuth(), email);
  },

  async updateProfile(patch: ProfilePatch): Promise<User> {
    return apiClient.patch<User>("/api/auth/profile", patch);
  },

  /** Utility: get the current Firebase ID token (for manual use). */
  getIdToken,
};
