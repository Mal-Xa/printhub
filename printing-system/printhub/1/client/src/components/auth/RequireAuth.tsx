import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  children: ReactNode;
  requireRole?: "user" | "admin";
  /** Where to send unauthenticated users */
  redirectTo?: string;
}

export function RequireAuth({ children, requireRole, redirectTo = "/login" }: Props) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: redirectTo, search: { from: pathname } as never });
    } else if (requireRole && user.role !== requireRole) {
      navigate({ to: "/app" });
    }
  }, [user, loading, requireRole, navigate, pathname, redirectTo]);

  if (loading || !user || (requireRole && user.role !== requireRole)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
