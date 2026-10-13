import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { UserShell } from "@/components/layout/UserShell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <RequireAuth>
      <UserShell>
        <Outlet />
      </UserShell>
    </RequireAuth>
  );
}
