import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Printer as PrinterIcon,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrintOptionsForm } from "@/components/orders/PrintOptionsForm";
import { orderService } from "@/services/orderService";
import { printerService } from "@/services/printerService";
import { formatBytes } from "@/lib/format";
import type { PrintJob, PrintJobStatus, PrintOptions, Printer, StoredFile } from "@/types";

export const Route = createFileRoute("/admin/orders/$id/print")({
  head: () => ({ meta: [{ title: "Print Review — Admin · Sora Print Hub" }] }),
  component: PrintReviewPage,
});

// print-server's own PaperSize enum values, for comparing against a
// printer's supportedPaperSizes without needing the print-server package.
const PAPER_SIZE_WIRE_VALUE: Record<PrintOptions["paperSize"], string> = {
  A4: "A4",
  "4x6": "4x6in",
};

function capabilityWarnings(opts: PrintOptions, printer: Printer | undefined): string[] {
  if (!printer) return [];
  const warnings: string[] = [];
  if (opts.type === "color" && !printer.capabilities.supportsColor) {
    warnings.push(`${printer.name} is monochrome-only — color print will likely come out B&W.`);
  }
  if (opts.side === "double" && !printer.capabilities.supportsDuplex) {
    warnings.push(
      `${printer.name} doesn't support duplex — double-sided may not work as expected.`,
    );
  }
  if (opts.copies > printer.capabilities.maxCopiesPerJob) {
    warnings.push(
      `${opts.copies} copies exceeds ${printer.name}'s max of ${printer.capabilities.maxCopiesPerJob} per job.`,
    );
  }
  if (
    printer.capabilities.supportedPaperSizes.length > 0 &&
    !printer.capabilities.supportedPaperSizes.includes(PAPER_SIZE_WIRE_VALUE[opts.paperSize])
  ) {
    warnings.push(`${printer.name} may not support ${opts.paperSize} paper.`);
  }
  return warnings;
}

function PrintReviewPage() {
  const { id } = useParams({ from: "/admin/orders/$id/print" });
  const qc = useQueryClient();

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => orderService.get(id),
  });

  const { data: printers, isLoading: printersLoading } = useQuery({
    queryKey: ["printers"],
    queryFn: () => printerService.listPrinters(),
    refetchInterval: 30_000,
  });

  const { data: jobs } = useQuery({
    queryKey: ["orders", id, "print-jobs"],
    queryFn: () => printerService.listJobsForOrder(id),
    // Keep polling while anything on this order is still in flight — cheap
    // and lets the admin watch progress without leaving the page.
    refetchInterval: (query) => {
      const active = query.state.data?.some(
        (j) => j.status === "waiting" || j.status === "printing",
      );
      return active ? 3_000 : 8_000;
    },
  });

  const latestJobByFile = useMemo(() => {
    const map = new Map<string, PrintJob>();
    for (const j of jobs ?? []) {
      // jobs come back newest-first; keep only the first (latest) per file
      if (!map.has(j.fileId)) map.set(j.fileId, j);
    }
    return map;
  }, [jobs]);

  const saveSettings = useMutation({
    mutationFn: (vars: {
      fileId: string;
      patch: { printOptions?: PrintOptions; printerId?: string };
    }) => printerService.updateFilePrintSettings(id, vars.fileId, vars.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "detail", id] });
    },
    onError: () => toast.error("Couldn't save print settings"),
  });

  const send = useMutation({
    mutationFn: (vars: { fileId: string; printerId: string }) => printerService.sendPrint(id, vars),
    onSuccess: (job, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", id, "print-jobs"] });
      const file = order?.files.find((f) => f.id === vars.fileId);
      if (job.status === "failed") {
        toast.error(job.lastError ?? `Couldn't send "${file?.name ?? "file"}" to print`);
        return;
      }
      toast.success(
        job.status === "waiting"
          ? `"${file?.name ?? "file"}" is queued for printing`
          : `"${file?.name ?? "file"}" was sent to print`,
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't send to print"),
  });

  const sendAll = useMutation({
    mutationFn: () => printerService.sendAll(id),
    onSuccess: (jobsCreated) => {
      qc.invalidateQueries({ queryKey: ["orders", id, "print-jobs"] });
      const failed = jobsCreated.filter((job) => job.status === "failed");
      if (failed.length > 0) {
        toast.error(
          failed[0]?.lastError ?? `${failed.length} file(s) could not be sent to print`,
        );
        return;
      }
      toast.success(`${jobsCreated.length} file(s) queued for printing`);
    },
    onError: (err) =>
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't send all files — check every file has a printer selected",
      ),
  });

  if (orderLoading) return <Skeleton className="h-96 w-full" />;
  if (!order) return <p className="text-muted-foreground">Order not found.</p>;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin/orders/$id" params={{ id: order.id }}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to order
        </Link>
      </Button>
      <PageHeader
        title="Print review"
        description={`Order ${order.id} — review each file, pick a printer, and send.`}
        actions={
          <Button
            onClick={() => sendAll.mutate()}
            disabled={sendAll.isPending || order.files.length === 0}
          >
            {sendAll.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Send all
          </Button>
        }
      />

      {order.files.length === 0 ? (
        <p className="text-muted-foreground">This order has no files to print.</p>
      ) : (
        <div className="space-y-6">
          {order.files.map((file) => (
            <FileReviewCard
              key={file.id}
              file={file}
              fallbackOptions={order.printOptions}
              printers={printers ?? []}
              printersLoading={printersLoading}
              job={latestJobByFile.get(file.id)}
              onSaveSettings={(patch) => saveSettings.mutate({ fileId: file.id, patch })}
              onSend={(printerId) => send.mutate({ fileId: file.id, printerId })}
              sending={send.isPending}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FileReviewCard({
  file,
  fallbackOptions,
  printers,
  printersLoading,
  job,
  onSaveSettings,
  onSend,
  sending,
}: {
  file: StoredFile;
  fallbackOptions: PrintOptions;
  printers: Printer[];
  printersLoading: boolean;
  job: PrintJob | undefined;
  onSaveSettings: (patch: { printOptions?: PrintOptions; printerId?: string }) => void;
  onSend: (printerId: string) => void;
  sending: boolean;
}) {
  const [options, setOptions] = useState<PrintOptions>(file.printOptions ?? fallbackOptions);
  const [printerId, setPrinterId] = useState<string>(file.printerId ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist edits in place — debounced so typing in the custom page-range
  // field doesn't fire a request per keystroke. This is not a one-off
  // override: the file's stored printOptions are updated directly.
  const handleOptionsChange = (next: PrintOptions) => {
    setOptions(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSaveSettings({ printOptions: next }), 600);
  };

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const handlePrinterChange = (id: string) => {
    setPrinterId(id);
    onSaveSettings({ printerId: id });
  };

  const selectedPrinter = printers.find((p) => p.id === printerId);
  const warnings = capabilityWarnings(options, selectedPrinter);

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(file.sizeBytes)}
                {file.pages ? ` · ${file.pages} pages` : ""}
                {!file.printOptions && " · using checkout defaults"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={job?.status} lastError={job?.lastError} />
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen((v) => !v)}>
              {previewOpen ? (
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Eye className="mr-1.5 h-3.5 w-3.5" />
              )}
              {previewOpen ? "Hide preview" : "Preview"}
            </Button>
          </div>
        </div>

        {previewOpen && (
          <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
            {file.url ? (
              <iframe
                src={file.url}
                title={`Preview of ${file.name}`}
                className="h-[480px] w-full"
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">No preview available yet.</p>
            )}
          </div>
        )}

        <PrintOptionsForm value={options} onChange={handleOptionsChange} />

        <div className="grid gap-2 sm:max-w-xs">
          <label className="text-sm font-medium">Printer</label>
          <Select
            value={printerId || undefined}
            onValueChange={handlePrinterChange}
            disabled={printersLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={printersLoading ? "Loading printers…" : "Choose a printer"}
              />
            </SelectTrigger>
            <SelectContent>
              {printers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} —{" "}
                  {p.status === "ONLINE" ? "Online" : p.status === "BUSY" ? "Busy" : "Offline"}
                  {p.capabilities.supportsColor ? "" : " · Mono"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPrinter && (
            <p className="text-xs text-muted-foreground">
              {selectedPrinter.capabilities.supportsColor ? "Color" : "Monochrome"}
              {selectedPrinter.capabilities.supportsDuplex ? " · Duplex" : " · Simplex only"}
              {" · "}max {selectedPrinter.capabilities.maxCopiesPerJob} copies/job
            </p>
          )}
        </div>

        {warnings.length > 0 && (
          <Alert className="border-warning/40 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <AlertDescription className="space-y-1 text-warning-foreground">
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
              <p className="text-xs opacity-80">
                You can still send — this is a warning, not a block.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button onClick={() => onSend(printerId)} disabled={!printerId || sending}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PrinterIcon className="mr-2 h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  status,
  lastError,
}: {
  status: PrintJobStatus | undefined;
  lastError?: string;
}) {
  if (!status) return null;
  const map: Record<PrintJobStatus, { label: string; className: string }> = {
    waiting: { label: "Waiting", className: "bg-muted text-muted-foreground border-border" },
    printing: { label: "Printing…", className: "bg-primary/15 text-primary border-primary/30" },
    printed: { label: "Printed", className: "bg-success/15 text-success border-success/30" },
    failed: {
      label: "Failed",
      className: "bg-destructive/15 text-destructive border-destructive/30",
    },
  };
  const m = map[status];
  return (
    <Badge variant="outline" className={m.className} title={lastError}>
      {m.label}
    </Badge>
  );
}
