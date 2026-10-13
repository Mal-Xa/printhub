import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        {icon && (
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div>
          <p className="text-base font-semibold">{title}</p>
          {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
