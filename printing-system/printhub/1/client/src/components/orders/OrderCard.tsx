import { Link } from "@tanstack/react-router";
import { ArrowRight, Files } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { formatDate, formatINR } from "@/lib/format";
import type { Order } from "@/types";

export function OrderCard({ order }: { order: Order }) {
  return (
    <Link to="/app/orders/$id" params={{ id: order.id }} className="group">
      <Card className="transition hover:shadow-soft group-hover:border-primary/40">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold tracking-tight">{order.id}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(order.createdAt)}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Files className="h-4 w-4" />
              {order.files.length} {order.files.length === 1 ? "file" : "files"}
            </span>
            <span className="font-semibold">{formatINR(order.total)}</span>
          </div>
          <div className="mt-4 flex items-center justify-end text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
            View details <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
