import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Printer as PrinterIcon,
  PackageCheck,
  Check,
  Download,
  Truck,
  Eye,
  Ban,
  Settings2,
  Loader2,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PrintOptionsForm } from "@/components/orders/PrintOptionsForm";
import { orderService } from "@/services/orderService";
import { printerService } from "@/services/printerService";
import { formatBytes, formatDateTime, formatINR } from "@/lib/format";
import { downloadInvoice } from "@/lib/invoice";
import { viewFile } from "@/lib/printFile";
import type { Order, OrderStatus, PrintOptions, Printer, StoredFile } from "@/types";

export const Route = createFileRoute("/admin/orders/$id")({
  head: () => ({ meta: [{ title: "Order — Admin · Sora Print Hub" }] }),
  component: AdminOrderDetail,
});

// Mirrors the backend's ORDER_STATUS_TRANSITIONS (server/src/types/index.ts) exactly —
// every active status can now also jump straight to "completed" via the
// "Mark as Done" action, in addition to its normal next step.
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["accepted", "completed", "cancelled"],
  accepted: ["printing", "pending", "completed", "cancelled"],
  printing: ["ready", "awaiting_delivery", "completed", "cancelled"],
  ready: ["completed", "cancelled"],
  awaiting_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

const CANCELLABLE_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "printing",
  "ready",
  "awaiting_delivery",
];

const NEXT_STATUS: Partial<
  Record<OrderStatus, { next: OrderStatus; label: string; icon: typeof Check }>
> = {
  pending: { next: "accepted", label: "Accept order", icon: Check },
  accepted: { next: "printing", label: "Start printing", icon: PrinterIcon },
  printing: { next: "ready", label: "Mark ready", icon: CheckCircle2 },
  ready: { next: "completed", label: "Complete order", icon: PackageCheck },
  awaiting_delivery: { next: "completed", label: "Mark delivered / complete", icon: PackageCheck },
};

function printOptionsRows(opts: import("@/types").PrintOptions): [string, string][] {
  return [
    ["Type", opts.type === "color" ? "Color" : "Black & White"],
    ["Side", opts.side === "double" ? "Double-sided" : "Single-sided"],
    ["Copies", String(opts.copies)],
    ["Paper", opts.paperSize],
    ["Paper Type", opts.paperType === "photo" ? "Photo Paper" : "Normal Paper"],
    ["Pages", opts.pages.mode === "all" ? "All" : (opts.pages.range ?? "Custom")],
    ["Front cover color", opts.frontCoverColor ? "Yes" : "No"],
    ["Back cover color", opts.backCoverColor ? "Yes" : "No"],
    ["Remove blanks", opts.removeBlankPages ? "Yes" : "No"],
  ];
}

function AdminOrderDetail() {
  const { id } = useParams({ from: "/admin/orders/$id" });
  const qc = useQueryClient();
  const [printReviewOpen, setPrintReviewOpen] = useState(false);
  const { data: order, isLoading } = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => orderService.get(id),
  });
  const update = useMutation({
    mutationFn: (next: OrderStatus) => orderService.updateStatus(id, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order updated");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't update order status");
    },
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

  const next = NEXT_STATUS[order.status];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin/orders">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
      </Button>
      <PageHeader
        title={`Order ${order.id}`}
        description={`Placed on ${formatDateTime(order.createdAt)}`}
        actions={<OrderStatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Customer
              </h3>
              <div className="mt-3 grid gap-1 text-sm">
                <p className="font-medium">{order.customer.name}</p>
                <p className="text-muted-foreground">{order.customer.phone}</p>
                <p className="text-muted-foreground">{order.customer.email}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Files
              </h3>
              {order.files.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Binding-only order — pages provided by customer.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {order.files.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(f.sizeBytes)}
                          {f.pages ? ` · ${f.pages} pages` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            try {
                              viewFile(f.url ?? "", f.name);
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Couldn't open file",
                              );
                            }
                          }}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Button>
                        <Button size="sm" onClick={() => setPrintReviewOpen(true)}>
                          <PrinterIcon className="mr-1.5 h-3.5 w-3.5" /> Review & print
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {order.files.length > 0 && (
                <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setPrintReviewOpen(true)}>
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Edit print settings & select printer
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-5 text-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Print settings
              </h3>
              {order.files.length === 0 ? (
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {printOptionsRows(order.printOptions).map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-border/60 pb-1.5">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="space-y-4">
                  {order.files.map((f) => (
                    <div key={f.id}>
                      <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" /> {f.name}
                        {!f.printOptions && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal">
                            using checkout defaults
                          </span>
                        )}
                      </p>
                      {f.printerId && (
                        <p className="mb-1.5 text-xs text-muted-foreground">
                          Assigned printer: <span className="font-medium text-foreground">{f.printerId}</span>
                        </p>
                      )}
                      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                        {printOptionsRows(f.printOptions ?? order.printOptions).map(([k, v]) => (
                          <div
                            key={k}
                            className="flex justify-between border-b border-border/60 pb-1"
                          >
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="font-medium">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Edit any file's settings from the print review page — the checkout snapshot
                    above is kept for reference and never overwritten.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {(order.lamination.length > 0 || order.binding.mode !== "print_only") && (
            <Card>
              <CardContent className="space-y-3 p-5 text-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Services
                </h3>
                {order.lamination.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Lamination</p>
                    <ul>
                      {order.lamination.map((l, i) => (
                        <li key={i}>
                          {l.type.replace("_", " ")} × {l.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {order.binding.mode !== "print_only" && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Binding</p>
                    <p>
                      {order.binding.mode === "binding_only"
                        ? "Spiral binding only"
                        : "Print + spiral binding"}
                    </p>
                    {order.binding.documentCount && (
                      <p className="text-xs text-muted-foreground">
                        {order.binding.documentCount} document(s) ·{" "}
                        {order.binding.estimatedPages ?? "—"} est. pages
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {order.specialInstructions && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Special instructions
                </h3>
                <p className="mt-2 whitespace-pre-line text-sm">{order.specialInstructions}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Summary
                </h3>
                <p className="mt-3 text-2xl font-bold text-primary">{formatINR(order.total)}</p>
              </div>
              <div className="space-y-2">
                {next && (
                  <Button
                    className="w-full"
                    disabled={update.isPending}
                    onClick={() => update.mutate(next.next)}
                  >
                    <next.icon className="mr-2 h-4 w-4" /> {next.label}
                  </Button>
                )}
                {order.status === "printing" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={update.isPending}
                    onClick={() => update.mutate("awaiting_delivery")}
                  >
                    <Truck className="mr-2 h-4 w-4" /> Send for delivery instead
                  </Button>
                )}
                {order.status !== "completed" &&
                  order.status !== "cancelled" &&
                  next?.next !== "completed" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={update.isPending}
                      onClick={() => update.mutate("completed")}
                    >
                      <PackageCheck className="mr-2 h-4 w-4" /> Mark as Done
                    </Button>
                  )}
                {ORDER_STATUS_TRANSITIONS[order.status].length === 0 && (
                  <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
                    {order.status === "cancelled"
                      ? "This order was cancelled — no further actions."
                      : "This order is complete — no further actions."}
                  </p>
                )}

                {CANCELLABLE_STATUSES.includes(order.status) && (
                  <Button
                    variant="destructive"
                    className="w-full"
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

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    downloadInvoice(order);
                    toast.success("Invoice downloaded");
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <PrintReviewDialog
        open={printReviewOpen}
        onOpenChange={setPrintReviewOpen}
        order={order}
        onOrderChanged={() => qc.invalidateQueries({ queryKey: ["orders", "detail", id] })}
      />
    </>
  );
}

function PrintReviewDialog({
  open,
  onOpenChange,
  order,
  onOrderChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  onOrderChanged: () => void;
}) {
  const { data: printers = [], isLoading: printersLoading, isError: printersError } = useQuery({
    queryKey: ["printers"],
    queryFn: () => printerService.listPrinters(),
    enabled: open,
  });
  const save = useMutation({
    mutationFn: ({ fileId, patch }: { fileId: string; patch: { printOptions?: PrintOptions; printerId?: string } }) =>
      printerService.updateFilePrintSettings(order.id, fileId, patch),
    onSuccess: onOrderChanged,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save print settings"),
  });
  const send = useMutation({
    mutationFn: ({ fileId, printerId }: { fileId: string; printerId: string }) =>
      printerService.sendPrint(order.id, { fileId, printerId }),
    onSuccess: (job) => {
      if (job.status === "failed") {
        toast.error(job.lastError ?? "The print job could not be submitted");
      } else {
        toast.success("Print job queued successfully");
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't send the print job"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review print settings</DialogTitle>
          <DialogDescription>Edit each file, choose a printer, then send it to print.</DialogDescription>
        </DialogHeader>
        {printersError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Printers could not be loaded. Check the print-server connection and try again.
          </p>
        ) : (
          <div className="space-y-5">
            {order.files.map((file) => (
              <PrintFileEditor
                key={file.id}
                file={file}
                fallbackOptions={order.printOptions}
                printers={printers}
                printersLoading={printersLoading}
                saving={save.isPending}
                sending={send.isPending}
                onSave={(patch) => save.mutate({ fileId: file.id, patch })}
                onSend={(printerId) => send.mutate({ fileId: file.id, printerId })}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrintFileEditor({
  file,
  fallbackOptions,
  printers,
  printersLoading,
  saving,
  sending,
  onSave,
  onSend,
}: {
  file: StoredFile;
  fallbackOptions: PrintOptions;
  printers: Printer[];
  printersLoading: boolean;
  saving: boolean;
  sending: boolean;
  onSave: (patch: { printOptions?: PrintOptions; printerId?: string }) => void;
  onSend: (printerId: string) => void;
}) {
  const [options, setOptions] = useState(file.printOptions ?? fallbackOptions);
  const [printerId, setPrinterId] = useState(file.printerId ?? "");

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <p className="font-medium">{file.name}</p>
      <PrintOptionsForm
        value={options}
        onChange={(next) => {
          setOptions(next);
          onSave({ printOptions: next });
        }}
      />
      <div className="space-y-2">
        <label className="text-sm font-medium">Printer</label>
        <Select
          value={printerId || undefined}
          onValueChange={(next) => {
            setPrinterId(next);
            onSave({ printerId: next });
          }}
          disabled={printersLoading || saving}
        >
          <SelectTrigger><SelectValue placeholder={printersLoading ? "Loading printers…" : "Choose a printer"} /></SelectTrigger>
          <SelectContent>
            {printers.map((printer) => (
              <SelectItem key={printer.id} value={printer.id}>
                {printer.name} — {printer.status === "ONLINE" ? "Online" : printer.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full" disabled={!printerId || sending} onClick={() => onSend(printerId)}>
        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Send to printer
      </Button>
    </div>
  );
}
