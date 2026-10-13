import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ShieldCheck, Users as UsersIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { userService } from "@/services/userService";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/users/")({
  head: () => ({ meta: [{ title: "Users — Admin · Sora Print Hub" }] }),
  component: AdminUsersPage,
});

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function AdminUsersPage() {
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => userService.list(),
  });

  const users = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q),
    );
  }, [data, query]);

  return (
    <>
      <PageHeader
        title="Users"
        description="View customer profiles and manage their files and access."
      />

      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!isLoading && users.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="h-5 w-5" />}
          title={query ? "No matching users" : "No users yet"}
          description={
            query ? "Try a different search term." : "Registered customers will show up here."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead className="hidden sm:table-cell">Role</TableHead>
                      <TableHead className="hidden lg:table-cell">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow
                        key={u.id}
                        className="cursor-pointer"
                        onClick={() => navigate({ to: "/admin/users/$id", params: { id: u.id } })}
                      >
                        <TableCell>
                          <Link
                            to="/admin/users/$id"
                            params={{ id: u.id }}
                            className="flex items-center gap-3 hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={u.avatarUrl} alt={u.fullName} />
                              <AvatarFallback className="text-xs">
                                {initials(u.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span className="truncate">{u.fullName}</span>
                                {u.id === me?.id && (
                                  <span className="text-xs font-normal text-muted-foreground">
                                    (you)
                                  </span>
                                )}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {u.email}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {u.phone || "—"}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {u.role === "admin" ? (
                            <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                              <ShieldCheck className="h-3 w-3" /> Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">User</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {u.createdAt ? formatDate(u.createdAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
