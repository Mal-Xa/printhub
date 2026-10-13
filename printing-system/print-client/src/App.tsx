import { Header } from "./components/Header";
import { NewJobPanel } from "./components/NewJobPanel";
import { JobQueueList } from "./components/JobQueueList";
import { PrinterStatusList } from "./components/PrinterStatusList";
import { useJobs } from "./hooks/useJobs";
import { usePrinters } from "./hooks/usePrinters";

export default function App() {
  const { jobs, loading: jobsLoading, error: jobsError, refresh: refreshJobs } = useJobs();
  const { printers, loading: printersLoading, error: printersError } = usePrinters();

  return (
    <div className="min-h-full">
      <Header />
      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <NewJobPanel onJobSubmitted={refreshJobs} />

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Queue</h2>
            <JobQueueList jobs={jobs} loading={jobsLoading} error={jobsError} onChanged={refreshJobs} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-800">Printers</h2>
            <PrinterStatusList printers={printers} loading={printersLoading} error={printersError} />
          </section>
        </div>
      </main>
    </div>
  );
}
