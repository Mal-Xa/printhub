import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  File as FileIcon,
  FolderOpen,
  IndianRupee,
  ListOrdered,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { StatCard } from "@/components/layout/StatCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { userService } from "@/services/userService";
import { fileService } from "@/services/fileService";
import { useAuth } from "@/hooks/useAuth";
import { formatBytes, formatDate, formatINR } from "@/lib/format";

export const Route = createFileRoute("/admin/users/$id")({
  head: () => ({ meta: [{ title: "User — Admin · Sora Print Hub" }] }),
  component: AdminUserDetail,
});

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function AdminUserDetail() {
  const { id } = useParams({ from: "/admin/users/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me } = useAuth();

  const { data: detail, isLoading } = useQuery({
    queryKey: ["admin", "users", "detail", id],
    queryFn: () => userService.getDetail(id),
  });
  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["admin", "users", "files", id],
    queryFn: () => userService.getFiles(id),
  });

  const [pendingDeleteFile, setPendingDeleteFile] = useState<string | null>(null);
  const [confirmRemoveUser, setConfirmRemoveUser] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isSelf = detail?.id === me?.id;

  const toggleRole = useMutation({
    mutationFn: () => userService.setRole(id, detail?.role === "admin" ? "user" : "admin"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFile = useMutation({
    mutationFn: (fileId: string) => fileService.delete(fileId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users", "files", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users", "detail", id] });
      toast.success("File deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: () => userService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User deleted");
      navigate({ to: "/admin/users" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleView = async (fileId: string, name: string) => {
    setViewingId(fileId);
    try {
      await fileService.view(fileId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't open ${name}`);
    } finally {
      setViewingId(null);
    }
  };

  const handleDownload = async (fileId: string, name: string) => {
    setDownloadingId(fileId);
    try {
      await fileService.download(fileId, name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Couldn't download ${name}`);
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!detail) return <p className="text-muted-foreground">User not found.</p>;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin/users">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
      </Button>

      <PageHeader
        title={detail.fullName}
        description={detail.email}
        actions={
          detail.role === "admin" ? (
            <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
              <ShieldCheck className="h-3 w-3" /> Admin
            </Badge>
          ) : (
            <Badge variant="outline">User</Badge>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <Avatar className="h-16 w-16">
                <AvatarImage src={detail.avatarUrl} alt={detail.fullName} />
                <AvatarFallback className="text-lg">{initials(detail.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Profile
                </h3>
                <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2 border-b border-border/60 pb-1.5 sm:border-0 sm:pb-0">
                    <dt className="text-muted-foreground">Phone</dt>
                    <dd className="font-medium">{detail.phone || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-border/60 pb-1.5 sm:border-0 sm:pb-0">
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="truncate font-medium">{detail.email}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd className="font-medium">
                      {detail.createdAt ? formatDate(detail.createdAt) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">User ID</dt>
                    <dd className="truncate font-mono text-xs font-medium">{detail.id}</dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Files
            </h3>
            {filesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !files || files.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="h-5 w-5" />}
                title="No files"
                description="This user hasn't uploaded any files yet."
              />
            ) : (
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <FileIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(f.sizeBytes)} · {formatDate(f.uploadedAt)}
                          {f.pages ? ` · ${f.pages} pages` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={viewingId === f.id}
                          onClick={() => handleView(f.id, f.name)}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />{" "}
                          {viewingId === f.id ? "Opening…" : "View"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          disabled={downloadingId === f.id}
                          onClick={() => handleDownload(f.id, f.name)}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />{" "}
                          {downloadingId === f.id ? "Downloading…" : "Download"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:text-destructive"
                          onClick={() => setPendingDeleteFile(f.id)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Files"
              value={detail.fileCount}
              icon={<FolderOpen className="h-5 w-5" />}
              accent="info"
            />
            <StatCard
              label="Orders"
              value={detail.orderCount}
              icon={<ListOrdered className="h-5 w-5" />}
              accent="primary"
            />
            <StatCard
              label="Storage used"
              value={formatBytes(detail.totalFileSizeBytes)}
              icon={<FileIcon className="h-5 w-5" />}
            />
            <StatCard
              label="Total spent"
              value={formatINR(detail.totalSpent)}
              icon={<IndianRupee className="h-5 w-5" />}
              accent="success"
            />
          </div>

          <Card>
            <CardContent className="space-y-2 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Access
              </h3>
              <Button
                variant="outline"
                className="w-full"
                disabled={isSelf || toggleRole.isPending}
                onClick={() => toggleRole.mutate()}
              >
                {detail.role === "admin" ? (
                  <>
                    <ShieldOff className="mr-2 h-4 w-4" /> Revoke admin access
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Make admin
                  </>
                )}
              </Button>
              {isSelf && (
                <p className="text-xs text-muted-foreground">You can't change your own role.</p>
              )}

              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive"
                disabled={isSelf}
                onClick={() => setConfirmRemoveUser(true)}
              >
                <UserRound className="mr-2 h-4 w-4" /> Delete user
              </Button>
              {isSelf && (
                <p className="text-xs text-muted-foreground">You can't delete your own account.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={Boolean(pendingDeleteFile)}
        onOpenChange={(o) => !o && setPendingDeleteFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteFile) deleteFile.mutate(pendingDeleteFile);
                setPendingDeleteFile(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRemoveUser} onOpenChange={setConfirmRemoveUser}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {detail.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes their account and all {detail.fileCount} of their stored
              files. Their past orders are kept for records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                removeUser.mutate();
                setConfirmRemoveUser(false);
              }}
            >
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
