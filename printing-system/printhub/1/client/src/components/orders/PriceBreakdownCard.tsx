import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatINR } from "@/lib/format";
import type { PriceBreakdown } from "@/lib/pricing";

export function PriceBreakdownCard({
  breakdown,
  isCalculating,
}: {
  breakdown: PriceBreakdown;
  isCalculating?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Price Breakdown
          </h3>
          {isCalculating && (
            <span className="text-xs font-medium text-muted-foreground animate-pulse">
              Calculating…
            </span>
          )}
        </div>
        {breakdown.lines.length === 0 && (
          <p className="text-sm text-muted-foreground">Add files or services to see pricing.</p>
        )}
        <ul className="space-y-1.5 text-sm">
          {breakdown.lines.map((line, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-muted-foreground">{line.label}</span>
              <span className="font-medium">{formatINR(line.amount)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <div className="flex items-center justify-between text-base">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold text-primary">{formatINR(breakdown.total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
