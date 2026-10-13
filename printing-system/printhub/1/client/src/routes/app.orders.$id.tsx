import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Download, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderStatusBadge, ORDER_STATUSES, orderStatusLabel } from "@/components/orders/OrderStatusBadge";
import { orderService } from "@/services/orderService";
import { formatBytes, formatDateTime, formatINR } from "@/lib/format";
import { downloadInvoice } from "@/lib/invoice";
import type { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const CANCELLABLE_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "printing",
  "ready",
  "awaiting_delivery",
];

export const Route = createFileRoute("/app/orders/$id")({
  head: () => ({ meta: [{ title: "Order details — Sora Print Hub" }] }),
  component: OrderDetailsPage,
});

function OrderDetailsPage() {
  const { id } = useParams({ from: "/app/orders/$id" });
  const qc = useQueryClient();
  const { data: order, isLoading } = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => orderService.get(id),
  });
  const cancel = useMutation({
    mutationFn: () => orderService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order cancelled");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel order");
    },
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!order) return <p className="text-muted-foreground">Order not found.</p>;

  const canCancel = CANCELLABLE_STATUSES.includes(order.status);

  const printedStages: OrderStatus[] = ["pending", "accepted", "printing", "ready", "completed"];
  const currentIdx = printedStages.indexOf(order.status);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/app/orders"><ArrowLeft className="mr-1 h-4 w-4" /> Back to orders</Link>
      </Button>
      <PageHeader
        title={`Order ${order.id}`}
        description={`Placed on ${formatDateTime(order.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadInvoice(order);
                toast.success("Invoice downloaded");
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Invoice
            </Button>
            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                disabled={cancel.isPending}
                onClick={() => {
                  if (window.confirm("Cancel this order? This cannot be undone.")) {
                    cancel.mutate();
                  }
                }}
              >
                <Ban className="mr-2 h-4 w-4" /> Cancel order
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Status timeline */}
          {order.status !== "awaiting_delivery" && order.status !== "cancelled" && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Progress</h3>
                <ol className="mt-4 grid grid-cols-5 gap-2">
                  {printedStages.map((s, i) => {
                    const done = i <= currentIdx;
                    return (
                      <li key={s} className="text-center">
                        <div
                          className={cn(
                            "mx-auto grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold",
                            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {i + 1}
                        </div>
                        <p className={cn("mt-2 text-[10px] sm:text-xs", done ? "text-foreground font-medium" : "text-muted-foreground")}>
                          {orderStatusLabel(s)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Files</h3>
              {order.files.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Binding-only order — customer brings printed pages.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {order.files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(f.sizeBytes)}{f.pages ? ` · ${f.pages} pages` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Print options</h3>
              <DefList
                items={[
                  ["Type", order.printOptions.type === "color" ? "Color" : "Black & White"],
                  ["Side", order.printOptions.side === "double" ? "Double-sided" : "Single-sided"],
                  ["Copies", String(order.printOptions.copies)],
                  ["Paper", order.printOptions.paperSize],
                  ["Paper Type", order.printOptions.paperType === "photo" ? "Photo Paper" : "Normal Paper"],
                  ["Pages", order.printOptions.pages.mode === "all" ? "All pages" : order.printOptions.pages.range ?? "Custom"],
                  ["Front cover color", order.printOptions.frontCoverColor ? "Yes" : "No"],
                  ["Back cover color", order.printOptions.backCoverColor ? "Yes" : "No"],
                  ["Remove blank pages", order.printOptions.removeBlankPages ? "Yes" : "No"],
                ]}
              />
            </CardContent>
          </Card>

          {(order.lamination.length > 0 || order.binding.mode !== "print_only") && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Additional services</h3>
                {order.lamination.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Lamination</p>
                    <ul className="mt-1 text-sm">
                      {order.lamination.map((l, i) => (
                        <li key={i}>{l.type.replace("_", " ")} × {l.quantity}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {order.binding.mode !== "print_only" && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Binding</p>
                    <p className="text-sm">{order.binding.mode === "binding_only" ? "Spiral binding only" : "Print + spiral binding"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {order.specialInstructions && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Special instructions</h3>
                <p className="mt-2 whitespace-pre-line text-sm">{order.specialInstructions}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Summary</h3>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">{formatINR(order.total)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">All amounts in INR.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Customer</h3>
              <p className="font-medium">{order.customer.name}</p>
              <p className="text-muted-foreground">{order.customer.phone}</p>
              <p className="text-muted-foreground">{order.customer.email}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function DefList({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 text-sm last:border-0">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
