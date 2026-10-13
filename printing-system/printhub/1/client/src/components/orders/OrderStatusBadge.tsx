import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const map: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/15 text-warning-foreground border border-warning/30" },
  accepted: { label: "Accepted", className: "bg-info/15 text-info border border-info/30" },
  printing: { label: "Printing", className: "bg-primary/15 text-primary border border-primary/30" },
  ready: { label: "Ready for Pickup", className: "bg-success/15 text-success border border-success/30" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground border border-border" },
  awaiting_delivery: {
    label: "Awaiting Document Delivery",
    className: "bg-accent text-accent-foreground border border-accent",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/15 text-destructive border border-destructive/30",
  },
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const m = map[status];
  return (
    <Badge variant="outline" className={cn("font-medium", m.className, className)}>
      {m.label}
    </Badge>
  );
}

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "printing",
  "ready",
  "completed",
  "awaiting_delivery",
  "cancelled",
];

export function orderStatusLabel(s: OrderStatus) {
  return map[s].label;
}
