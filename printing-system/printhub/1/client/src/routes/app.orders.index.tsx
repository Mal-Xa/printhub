import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { OrderCard } from "@/components/orders/OrderCard";
import { ORDER_STATUSES, orderStatusLabel } from "@/components/orders/OrderStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { orderService } from "@/services/orderService";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

export const Route = createFileRoute("/app/orders/")({
  head: () => ({ meta: [{ title: "My Orders — Sora Print Hub" }] }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => orderService.list(),
    enabled: Boolean(user),
  });

  const orders = (data ?? []).filter((o) => filter === "all" || o.status === filter);

  return (
    <>
      <PageHeader
        title="My orders"
        description="Track and manage all your print orders."
        actions={
          <Button asChild>
            <Link to="/app/orders/new"><Plus className="mr-2 h-4 w-4" /> New order</Link>
          </Button>
        }
      />

      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        {ORDER_STATUSES.map((s) => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {orderStatusLabel(s)}
          </Chip>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="h-5 w-5" />}
          title="No orders here"
          description="Try a different filter, or start a new order."
          action={<Button asChild><Link to="/app/orders/new">New order</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
