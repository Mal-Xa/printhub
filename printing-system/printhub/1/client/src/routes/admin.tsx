import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AdminShell } from "@/components/layout/AdminShell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <RequireAuth requireRole="admin">
      <AdminShell>
        <Outlet />
      </AdminShell>
    </RequireAuth>
  );
}
