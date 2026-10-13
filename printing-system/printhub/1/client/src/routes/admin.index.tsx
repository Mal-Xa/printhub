import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, IndianRupee, ListOrdered } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { orderService } from "@/services/orderService";
import { formatDate, formatINR } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Sora Print Hub" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => orderService.list() });
  const all = data ?? [];
  const today = new Date().toDateString();
  const todayOrders = all.filter((o) => new Date(o.createdAt).toDateString() === today);
  const revenueToday = todayOrders.reduce((s, o) => s + o.total, 0);
  const pending = all.filter((o) => o.status === "pending").length;
  const completed = all.filter((o) => o.status === "completed").length;

  return (
    <>
      <PageHeader title="Admin dashboard" description="Today's print-shop activity at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders today" value={todayOrders.length} icon={<ListOrdered className="h-5 w-5" />} accent="primary" />
        <StatCard label="Revenue today" value={formatINR(revenueToday)} icon={<IndianRupee className="h-5 w-5" />} accent="success" />
        <StatCard label="Pending" value={pending} icon={<Activity className="h-5 w-5" />} accent="warning" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} accent="info" />
      </div>

      <Card className="mt-8">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/admin/orders">View all</Link>
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.slice(0, 8).map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        <Link to="/admin/orders/$id" params={{ id: o.id }} className="hover:text-primary">{o.id}</Link>
                      </TableCell>
                      <TableCell>{o.customer.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(o.createdAt)}</TableCell>
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
