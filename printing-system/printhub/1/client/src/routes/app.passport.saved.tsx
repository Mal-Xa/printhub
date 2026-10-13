import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { passportService } from "@/services/passportService";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/passport/saved")({
  head: () => ({ meta: [{ title: "Saved passport sheets — Sora Print Hub" }] }),
  component: SavedPassportPage,
});

function SavedPassportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["passport", user?.id],
    queryFn: () => passportService.list(),
    enabled: Boolean(user),
  });

  const del = useMutation({
    mutationFn: (id: string) => passportService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passport"] });
      toast.success("Sheet removed");
    },
  });

  return (
    <>
      <PageHeader
        title="Saved passport sheets"
        description="All photo sheets you've generated."
        actions={
          <Button asChild>
            <Link to="/app/passport"><Camera className="mr-2 h-4 w-4" /> New sheet</Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<Camera className="h-5 w-5" />}
          title="No saved sheets yet"
          description="Create your first passport photo sheet."
          action={<Button asChild><Link to="/app/passport">Open creator</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id}>
              <CardContent className="space-y-3 p-4">
                <div className="aspect-[4/6] overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted p-1">
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt="Passport sheet" className="h-full w-full rounded-sm object-contain" />
                  ) : (
                    <div className="grid h-full grid-cols-3 grid-rows-3 gap-1">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="rounded-sm border border-dashed border-muted-foreground/30 bg-card" />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold capitalize">{s.template} photo · 9 per sheet</p>
                  <p className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    disabled={!s.photoUrl}
                    onClick={() => s.photoUrl && window.open(s.photoUrl, "_blank", "noopener,noreferrer")}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" /> View
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                    <Link to="/app/orders/new"><Printer className="mr-1 h-3.5 w-3.5" /> Print</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    onClick={() => del.mutate(s.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
