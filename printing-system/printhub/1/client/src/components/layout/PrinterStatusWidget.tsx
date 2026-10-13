import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Printer as PrinterIcon, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { printerService } from "@/services/printerService";

const REFRESH_INTERVAL_MS = 45_000;
const PING_THROTTLE_MS = 5_000;

type OverallState = "green" | "amber" | "red";

export function PrinterStatusWidget() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const lastPing = useRef(0);

  const printers = useQuery({
    queryKey: ["printers"],
    queryFn: () => printerService.listPrinters(),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const health = useQuery({
    queryKey: ["printers", "health"],
    queryFn: () => printerService.getBridgeHealth(),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // Distinct from "0 printers online" — the bridge to print-server itself
  // could not be reached at all.
  const bridgeUnreachable = health.data ? !health.data.printServerReachable : printers.isError;

  const onlineCount = (printers.data ?? []).filter(
    (p) => p.status === "ONLINE" || p.status === "WARNING",
  ).length;
  const totalCount = printers.data?.length ?? 0;

  let state: OverallState = "red";
  if (!bridgeUnreachable) {
    if (totalCount > 0 && onlineCount === totalCount) state = "green";
    else if (onlineCount > 0) state = "amber";
    else state = "red";
  }

  const handlePing = () => {
    const now = Date.now();
    if (now - lastPing.current < PING_THROTTLE_MS) return;
    lastPing.current = now;
    qc.invalidateQueries({ queryKey: ["printers"] });
    qc.invalidateQueries({ queryKey: ["printers", "health"] });
  };

  const dotClass =
    state === "green" ? "bg-success" : state === "amber" ? "bg-warning" : "bg-destructive";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Printer status">
          <PrinterIcon className="h-5 w-5" />
          <span
            className={cn(
              "absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-background",
              dotClass,
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Printers</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handlePing}
            disabled={printers.isFetching || health.isFetching}
          >
            <RefreshCw
              className={cn(
                "mr-1 h-3.5 w-3.5",
                (printers.isFetching || health.isFetching) && "animate-spin",
              )}
            />
            Ping now
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {bridgeUnreachable ? (
          <div className="flex items-start gap-2 p-3 text-sm">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Print server unreachable</p>
              <p className="text-xs text-muted-foreground">
                This is a bridge/infra problem, not a specific printer being offline. Sending print
                jobs won't work until this is fixed.
              </p>
            </div>
          </div>
        ) : totalCount === 0 ? (
          <div className="flex items-start gap-2 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">
              The print server is reachable, but no printers are registered.
            </p>
          </div>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto p-1">
            {printers.data?.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Last seen{" "}
                    {p.lastSeenAt ? new Date(p.lastSeenAt).toLocaleTimeString() : "unknown"}
                  </p>
                </div>
                <PrinterStatusPill status={p.status} />
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PrinterStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
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
  const m = map[status] ?? map.UNKNOWN!;
  return (
    <Badge variant="outline" className={cn("shrink-0 text-[10px]", m.className)}>
      {m.label}
    </Badge>
  );
}
