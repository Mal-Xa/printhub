import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderStatusBadge, ORDER_STATUSES, orderStatusLabel } from "@/components/orders/OrderStatusBadge";
import { orderService } from "@/services/orderService";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

export const Route = createFileRoute("/admin/orders/")({
  head: () => ({ meta: [{ title: "Orders — Admin · Sora Print Hub" }] }),
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => orderService.list() });
  const orders = (data ?? []).filter((o) => filter === "all" || o.status === filter);

  return (
    <>
      <PageHeader title="Orders" description="Manage incoming print orders." />
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-2">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        {ORDER_STATUSES.map((s) => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {orderStatusLabel(s)}
          </Chip>
        ))}
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => navigate({ to: "/admin/orders/$id", params: { id: o.id } })}
                    >
                      <TableCell className="font-medium">
                        <Link
                          to="/admin/orders/$id"
                          params={{ id: o.id }}
                          className="hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>{o.customer.name}</div>
                        <div className="text-xs text-muted-foreground">{o.customer.phone}</div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(o.createdAt)}</TableCell>
                      <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right font-medium">{formatINR(o.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
