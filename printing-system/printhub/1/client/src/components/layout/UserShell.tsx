import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FilePlus2,
  ListOrdered,
  FolderOpen,
  Camera,
  UserCircle2,
  LogOut,
  Menu,
  Shield,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const items = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/orders/new", label: "New Order", icon: FilePlus2 },
  { to: "/app/orders", label: "My Orders", icon: ListOrdered },
  { to: "/app/files", label: "My Files", icon: FolderOpen },
  { to: "/app/passport", label: "Passport Photos", icon: Camera },
  { to: "/app/profile", label: "Profile", icon: UserCircle2 },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((it) => {
        let active = it.exact
          ? pathname === it.to
          : pathname === it.to || pathname.startsWith(it.to + "/");
        // Don't activate "My Orders" while on the New Order wizard
        if (it.to === "/app/orders" && pathname.startsWith("/app/orders/new")) active = false;
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function UserShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-4">
          <Logo />
        </div>
        <NavList />
        <div className="border-t border-sidebar-border p-3">
          {user?.role === "admin" && (
            <Button asChild variant="ghost" size="sm" className="w-full justify-start">
              <Link to="/admin">
                <Shield className="mr-2 h-4 w-4" /> Admin console
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start text-muted-foreground"
            onClick={() => logout()}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0">
                <div className="flex h-16 items-center border-b border-sidebar-border px-4">
                  <Logo />
                </div>
                <NavList onNavigate={() => setOpen(false)} />
                <div className="border-t border-sidebar-border p-3">
                  {user?.role === "admin" && (
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                      <Link to="/admin" onClick={() => setOpen(false)}>
                        <Shield className="mr-2 h-4 w-4" /> Admin console
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full justify-start text-muted-foreground"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Hi,{" "}
              <span className="font-medium text-foreground">{user?.fullName.split(" ")[0]}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
