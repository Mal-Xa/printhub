import type { PrintJob } from "print-common";
import { listJobs } from "../api/printApi";
import { usePolling } from "./usePolling";

export function useJobs() {
  const { data, error, loading, refresh } = usePolling((signal) => listJobs({ pageSize: 50 }, signal), 4000);

  const jobs: PrintJob[] = data?.data ?? [];
  const sorted = [...jobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return { jobs: sorted, error, loading, refresh };
}
