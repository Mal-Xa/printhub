import { useState } from "react";
import { TERMINAL_JOB_STATUSES } from "print-common";
import type { PrintJob } from "print-common";
import { JOB_STATUS_STYLES } from "../lib/status";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime, shortId } from "../lib/format";
import { cancelJob } from "../api/printApi";
import { PrintServerError } from "../api/http";

interface JobQueueListProps {
  jobs: PrintJob[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
}

export function JobQueueList({ jobs, loading, error, onChanged }: JobQueueListProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const handleCancel = async (job: PrintJob) => {
    setCancellingId(job.id);
    setRowError(null);
    try {
      await cancelJob(job.id);
      onChanged();
    } catch (err) {
      setRowError({
        id: job.id,
        message: err instanceof PrintServerError ? err.message : "Couldn't cancel this job.",
      });
    } finally {
      setCancellingId(null);
    }
  };

  if (loading && jobs.length === 0) {
    return <p className="text-sm text-slate-400">Loading jobs…</p>;
  }

  if (error && jobs.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (jobs.length === 0) {
    return <p className="text-sm text-slate-400">No print jobs yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {jobs.map((job) => {
        const style = JOB_STATUS_STYLES[job.status];
        const canCancel = !TERMINAL_JOB_STATUSES.includes(job.status);
        return (
          <li key={job.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{job.document.fileName}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {job.options.copies} {job.options.copies === 1 ? "copy" : "copies"} · Job {shortId(job.id)} ·{" "}
                  {formatRelativeTime(job.createdAt)}
                </p>
              </div>
              <StatusBadge label={style.label} className={style.className} />
            </div>

            {canCancel && (
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleCancel(job)}
                  disabled={cancellingId === job.id}
                  className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                >
                  {cancellingId === job.id ? "Cancelling…" : "Cancel job"}
                </button>
                {rowError?.id === job.id && <span className="text-xs text-red-600">{rowError.message}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
