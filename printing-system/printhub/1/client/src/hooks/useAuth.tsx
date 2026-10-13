import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { authService } from "@/services/authService";
import type { FirebaseUser } from "@/lib/firebase";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    fullName: string;
    phone: string;
    email: string;
    password: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, "fullName" | "phone" | "email">>) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const registeringRef = useRef(false);

  // Sync with Firebase auth state — fetch server profile on sign-in
  useEffect(() => {
    const unsub = authService.onAuthStateChanged(async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const idToken = await fbUser.getIdToken();
        const profile = await authService.getMe(idToken);
        if (profile) {
          setUser(profile);
          return;
        }

        // Firebase session without a server profile (orphaned account or register race).
        setUser(null);
        if (!registeringRef.current) {
          await authService.logout();
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u } = await authService.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(
    async (input: { fullName: string; phone: string; email: string; password: string }) => {
      registeringRef.current = true;
      try {
        const { user: u } = await authService.register(input);
        setUser(u);
        return u;
      } finally {
        registeringRef.current = false;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, "fullName" | "phone" | "email">>) => {
      const updated = await authService.updateProfile(patch);
      setUser(updated);
      return updated;
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
