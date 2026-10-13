import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListOrdered,
  Printer as PrinterIcon,
  IndianRupee,
  BarChart3,
  LogOut,
  Menu,
  ArrowLeftRight,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PrinterStatusWidget } from "@/components/layout/PrinterStatusWidget";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ListOrdered },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/printers", label: "Printers", icon: PrinterIcon },
  { to: "/admin/pricing", label: "Pricing", icon: IndianRupee },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((it) => {
        const active = it.exact
          ? pathname === it.to
          : pathname === it.to || pathname.startsWith(it.to + "/");
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

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Logo />
        </div>
        <div className="px-4 py-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Admin
          </span>
        </div>
        <NavList />
        <div className="border-t border-sidebar-border p-3">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <Link to="/app">
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Switch to user view
            </Link>
          </Button>
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
                  <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                    <Link to="/app" onClick={() => setOpen(false)}>
                      <ArrowLeftRight className="mr-2 h-4 w-4" /> Switch to user view
                    </Link>
                  </Button>
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
              Signed in as <span className="font-medium text-foreground">{user?.fullName}</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <PrinterStatusWidget />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
