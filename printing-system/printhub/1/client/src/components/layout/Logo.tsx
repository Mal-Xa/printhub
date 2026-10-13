import { Printer } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-soft">
        <Printer className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-base font-bold tracking-tight">Sora Print Hub</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Upload • Print • Laminate • Bind
          </span>
        </span>
      )}
    </Link>
  );
}
