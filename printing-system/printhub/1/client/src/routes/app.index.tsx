import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, FolderOpen, ListOrdered, Plus, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { orderService } from "@/services/orderService";
import { fileService } from "@/services/fileService";
import { formatDate, formatINR } from "@/lib/format";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sora Print Hub" },
      { name: "description", content: "Your Sora Print Hub dashboard." },
    ],
  }),
  component: UserDashboard,
});

function UserDashboard() {
  const { user } = useAuth();
  const orders = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => orderService.list(),
    enabled: Boolean(user),
  });
  const files = useQuery({
    queryKey: ["files", user?.id],
    queryFn: () => fileService.list(),
    enabled: Boolean(user),
  });

  const list = orders.data ?? [];
  const active = list.filter((o) =>
    ["pending", "accepted", "printing", "awaiting_delivery"].includes(o.status),
  ).length;
  const completed = list.filter((o) => o.status === "completed").length;

  return (
    <>
      <PageHeader
        title={`Welcome${user ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description="A snapshot of your printing activity."
        actions={
          <>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link to="/app/passport"><Camera className="mr-2 h-4 w-4" /> Passport photo</Link>
            </Button>
            <Button asChild>
              <Link to="/app/orders/new"><Plus className="mr-2 h-4 w-4" /> New order</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active orders" value={active} icon={<Activity className="h-5 w-5" />} accent="primary" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
        <StatCard label="Saved files" value={files.data?.length ?? "—"} icon={<FolderOpen className="h-5 w-5" />} accent="info" />
        <StatCard label="Total orders" value={list.length} icon={<ListOrdered className="h-5 w-5" />} accent="warning" />
      </div>

      <Card className="mt-8">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/orders">View all</Link>
            </Button>
          </div>

          {orders.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<ListOrdered className="h-5 w-5" />}
                title="No orders yet"
                description="Upload your first file to place an order."
                action={
                  <Button asChild>
                    <Link to="/app/orders/new">Start an order</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.slice(0, 5).map((o) => (
                    <TableRow key={o.id} className="cursor-pointer">
                      <TableCell className="font-medium">
                        <Link to="/app/orders/$id" params={{ id: o.id }} className="hover:text-primary">
                          {o.id}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatDate(o.createdAt)}
                      </TableCell>
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
