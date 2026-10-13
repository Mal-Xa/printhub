import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Printer as PrinterIcon, RotateCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { printerService } from "@/services/printerService";
import { cn } from "@/lib/utils";
import type { PrintJobStatus, PrinterStatus } from "@/types";

export const Route = createFileRoute("/admin/printers")({
  head: () => ({ meta: [{ title: "Printers — Admin · Sora Print Hub" }] }),
  component: PrintersPage,
});

function PrintersPage() {
  const qc = useQueryClient();
  // Same live data source (proxied + cached from print-server) used by the
  // print review page and the navbar widget — one source of truth.
  const printers = useQuery({
    queryKey: ["printers"],
    queryFn: () => printerService.listPrinters(),
    refetchInterval: 30_000,
  });
  const queue = useQuery({
    queryKey: ["printQueue"],
    queryFn: () => printerService.listQueue(),
    refetchInterval: 10_000,
  });

  const reprint = useMutation({
    mutationFn: (job: { orderId: string; fileId: string; printerId: string }) =>
      printerService.sendPrint(job.orderId, { fileId: job.fileId, printerId: job.printerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["printQueue"] });
      toast.success("Reprint queued");
    },
    onError: () => toast.error("Couldn't queue the reprint"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => printerService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["printQueue"] });
      toast.success("Job cancelled");
    },
  });

  return (
    <>
      <PageHeader
        title="Printers"
        description="Live printer status & queue, proxied from the print server."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Printers
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {printers.isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </>
        ) : printers.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No printers reachable right now.</p>
        ) : (
          printers.data?.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                      <PrinterIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.capabilities.supportsColor ? "Color" : "Monochrome"}
                        {p.capabilities.supportsDuplex ? " · Duplex" : ""}
                        {p.location ? ` · ${p.location}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusDot status={p.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Last seen {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleString() : "unknown"}
                </p>
                {p.consumables?.paperTrayEmpty && (
                  <p className="text-xs font-medium text-destructive">Paper tray empty</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Print queue
      </h2>
      <p className="mb-3 -mt-2 text-xs text-muted-foreground">
        To send a new job, open the order's print review page from the order detail view.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {queue.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : queue.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in the queue.</p>
        ) : (
          queue.data?.map((j) => (
            <Card key={j.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{j.fileName}</p>
                  <JobBadge status={j.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {printers.data?.find((p) => p.id === j.printerId)?.name ?? j.printerId}
                </p>
                {j.lastError && <p className="text-xs text-destructive">{j.lastError}</p>}
                <div className="flex items-center justify-between">
                  <Link
                    to="/admin/orders/$id/print"
                    params={{ id: j.orderId }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open order <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  {j.status === "waiting" || j.status === "printing" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => cancel.mutate(j.id)}
                    >
                      <XCircle className="mr-1 h-4 w-4" /> Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={reprint.isPending}
                      onClick={() =>
                        reprint.mutate({
                          orderId: j.orderId,
                          fileId: j.fileId,
                          printerId: j.printerId,
                        })
                      }
                    >
                      <RotateCw className="mr-1 h-4 w-4" /> Reprint
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

function StatusDot({ status }: { status: PrinterStatus }) {
  const map: Record<PrinterStatus, { label: string; className: string }> = {
    ONLINE: { label: "Online", className: "bg-success/15 text-success border-success/30" },
    BUSY: { label: "Busy", className: "bg-warning/20 text-warning-foreground border-warning/30" },
    WARNING: {
      label: "Warning",
      className: "bg-warning/20 text-warning-foreground border-warning/30",
    },
    OFFLINE: { label: "Offline", className: "bg-muted text-muted-foreground border-border" },
    ERROR: {
      label: "Error",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
    MAINTENANCE: {
      label: "Maintenance",
      className: "bg-muted text-muted-foreground border-border",
    },
    UNKNOWN: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={cn(m.className)}>
      {m.label}
    </Badge>
  );
}

function JobBadge({ status }: { status: PrintJobStatus }) {
  const map: Record<PrintJobStatus, { label: string; className: string }> = {
    waiting: { label: "Waiting", className: "bg-muted text-muted-foreground border-border" },
    printing: { label: "Printing", className: "bg-primary/15 text-primary border-primary/30" },
    printed: { label: "Printed", className: "bg-success/15 text-success border-success/30" },
    failed: {
      label: "Failed",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={cn(m.className)}>
      {m.label}
    </Badge>
  );
}
