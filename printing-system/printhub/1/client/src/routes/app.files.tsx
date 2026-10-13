import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudUpload, Download, Eye, File as FileIcon, Plus, Trash2, FolderOpen, Printer } from "lucide-react";
import { useCallback, useState, type DragEvent as ReactDragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { fileService } from "@/services/fileService";
import { formatBytes, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/files")({
  head: () => ({ meta: [{ title: "My Files — Sora Print Hub" }] }),
  component: FilesPage,
});

const ACCEPT = [".pdf", ".docx", ".pptx", ".jpg", ".jpeg", ".png"];
const ACCEPT_ATTR = "application/pdf,.docx,.pptx,image/jpeg,image/png";

function FilesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["files", user?.id],
    queryFn: () => fileService.list(),
    enabled: Boolean(user),
  });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleView = async (id: string, name: string) => {
    setViewingId(id);
    try {
      await fileService.view(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't open ${name}`);
    } finally {
      setViewingId(null);
    }
  };

  const handleDownload = async (id: string, name: string) => {
    setDownloadingId(id);
    try {
      await fileService.download(id, name);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't download ${name}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const del = useMutation({
    mutationFn: (id: string) => fileService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["files"] });
      toast.success("File deleted");
    },
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      if (!user) throw new Error("Not signed in");
      for (const f of files) await fileService.upload(f);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["files"] });
      toast.success(`${vars.length} file${vars.length === 1 ? "" : "s"} uploaded`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list).filter((f) =>
        ACCEPT.some((ext) => f.name.toLowerCase().endsWith(ext)),
      );
      if (arr.length === 0) {
        toast.error("Unsupported file type");
        return;
      }
      upload.mutate(arr);
    },
    [upload],
  );

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) acceptFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={onDrop}
      className={cn(
        "relative rounded-2xl transition",
        dragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <PageHeader
        title="My files"
        description="Drag files anywhere on this page to upload."
        actions={
          <div className="flex gap-2">
            <label>
              <input
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="sr-only"
                onChange={(e) => e.target.files && acceptFiles(e.target.files)}
              />
              <Button asChild variant="outline">
                <span className="cursor-pointer">
                  <CloudUpload className="mr-2 h-4 w-4" /> Upload
                </span>
              </Button>
            </label>
            <Button asChild>
              <Link to="/app/orders/new"><Plus className="mr-2 h-4 w-4" /> New order</Link>
            </Button>
          </div>
        }
      />

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-primary/10 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-background px-8 py-6 text-center shadow-lg">
            <CloudUpload className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-2 text-base font-semibold">Drop files to upload</p>
            <p className="text-xs text-muted-foreground">PDF, DOCX, PPTX, JPG, PNG</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-5 w-5" />}
          title="No saved files yet"
          description="Drag files here or click Upload to add documents."
          action={
            <label>
              <input
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="sr-only"
                onChange={(e) => e.target.files && acceptFiles(e.target.files)}
              />
              <Button asChild>
                <span className="cursor-pointer">Upload a file</span>
              </Button>
            </label>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(f.sizeBytes)} · {formatDate(f.uploadedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={viewingId === f.id}
                      onClick={() => handleView(f.id, f.name)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" /> {viewingId === f.id ? "Opening…" : "View"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2"
                      disabled={downloadingId === f.id}
                      onClick={() => handleDownload(f.id, f.name)}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" /> {downloadingId === f.id ? "Downloading…" : "Download"}
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                      <Link to="/app/orders/new" search={{ fileId: f.id }}>
                        <Printer className="mr-1 h-3.5 w-3.5" /> Reprint
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(f.id)}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) del.mutate(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
