import { useState } from "react";
import { DEFAULT_PRINT_OPTIONS } from "print-common";
import type { PrinterId, PrintOptions } from "print-common";
import { FileDropzone } from "./FileDropzone";
import { PrinterPicker } from "./PrinterPicker";
import { PrintOptionsForm } from "./PrintOptionsForm";
import { usePrinters } from "../hooks/usePrinters";
import { uploadDocument, submitPrintJob } from "../api/printApi";
import { PrintServerError } from "../api/http";

type SubmitPhase = "idle" | "uploading" | "submitting" | "success" | "error";

interface NewJobPanelProps {
  onJobSubmitted: () => void;
}

export function NewJobPanel({ onJobSubmitted }: NewJobPanelProps) {
  const { printableOnly, loading: printersLoading } = usePrinters();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [printerId, setPrinterId] = useState<PrinterId | null>(null);
  const [options, setOptions] = useState<PrintOptions>({ ...DEFAULT_PRINT_OPTIONS });
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const selectedPrinter = printableOnly.find((p) => p.id === printerId) ?? null;
  const maxCopies = selectedPrinter?.capabilities.maxCopiesPerJob ?? 9999;
  const isBusy = phase === "uploading" || phase === "submitting";

  const resetForm = () => {
    setFile(null);
    setFileError(null);
    setPrinterId(null);
    setOptions({ ...DEFAULT_PRINT_OPTIONS });
  };

  const handleSubmit = async () => {
    if (!file) {
      setFileError("Choose a file to print first.");
      return;
    }
    setPhase("uploading");
    setMessage(null);
    try {
      const upload = await uploadDocument(file);
      setPhase("submitting");
      const result = await submitPrintJob({
        fileId: upload.fileId,
        printerId: printerId ?? undefined,
        options,
      });
      setPhase("success");
      setMessage(`Job submitted (status: ${result.job.status.toLowerCase()}).`);
      resetForm();
      onJobSubmitted();
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof PrintServerError ? err.message : "Couldn't submit the job. Try again.");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-800">New print job</h2>

      <div className="flex flex-col gap-5">
        <div>
          <FieldGroupLabel>Document</FieldGroupLabel>
          <FileDropzone
            file={file}
            onFileSelected={(f) => {
              setFile(f);
              setFileError(null);
            }}
            onClear={() => setFile(null)}
            disabled={isBusy}
            error={fileError}
          />
        </div>

        <div>
          <FieldGroupLabel>Printer</FieldGroupLabel>
          <PrinterPicker
            printers={printableOnly}
            selectedId={printerId}
            onSelect={setPrinterId}
            loading={printersLoading}
            disabled={isBusy}
          />
          <p className="mt-2 text-xs text-slate-400">
            Leave unselected to let print-server assign the next available printer.
          </p>
        </div>

        <div>
          <FieldGroupLabel>Options</FieldGroupLabel>
          <PrintOptionsForm options={options} onChange={setOptions} maxCopies={maxCopies} disabled={isBusy} />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy || !file}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "uploading" ? "Uploading…" : phase === "submitting" ? "Submitting…" : "Print"}
        </button>

        {message && (
          <p className={`text-sm ${phase === "error" ? "text-red-600" : "text-green-700"}`} role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function FieldGroupLabel({ children }: { children: string }) {
  return <h3 className="mb-2 text-sm font-medium text-slate-700">{children}</h3>;
}
