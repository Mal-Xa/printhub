import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const labels = ["Files", "Print", "Services", "Notes", "Review", "Payment"];

export function WizardStepper({ step, onStep }: { step: number; onStep?: (n: number) => void }) {
  return (
    <ol className="flex w-full items-center gap-1 sm:gap-2">
      {labels.map((label, idx) => {
        const n = idx + 1;
        const done = n < step;
        const active = n === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => onStep?.(n)}
              disabled={!onStep || n > step}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-medium transition sm:px-3 sm:py-2.5 sm:text-sm",
                active && "border-primary bg-primary/5 text-primary",
                done && "border-success/40 bg-success/10 text-success",
                !active && !done && "border-border text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-success text-success-foreground",
                  !active && !done && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
