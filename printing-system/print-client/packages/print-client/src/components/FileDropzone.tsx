import { useCallback, useRef, useState } from "react";
import { MAX_DOCUMENT_SIZE_BYTES, SUPPORTED_MIME_TYPES } from "print-common";
import { formatBytes } from "../lib/format";

interface FileDropzoneProps {
  file: File | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
  error: string | null;
}

const ACCEPTED = SUPPORTED_MIME_TYPES.filter((m) => m.startsWith("image/") || m === "application/pdf");

function validate(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) {
    return "Unsupported file type. Upload a PDF or an image.";
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return `File is too large. Max size is ${formatBytes(MAX_DOCUMENT_SIZE_BYTES)}.`;
  }
  return null;
}

export function FileDropzone({ file, onFileSelected, onClear, disabled, error }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const selected = fileList?.[0];
      if (!selected) return;
      const validationError = validate(selected);
      setLocalError(validationError);
      if (!validationError) onFileSelected(selected);
    },
    [onFileSelected],
  );

  const combinedError = error ?? localError;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${isDragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-400"}`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED.join(",")}
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        {file ? (
          <>
            <p className="text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="mt-1 text-xs font-medium text-brand-600 hover:underline"
            >
              Choose a different file
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">Drop a PDF or image here, or click to browse</p>
            <p className="text-xs text-slate-400">PDF, PNG, JPEG · up to {formatBytes(MAX_DOCUMENT_SIZE_BYTES)}</p>
          </>
        )}
      </div>
      {combinedError && <p className="mt-2 text-xs font-medium text-red-600">{combinedError}</p>}
    </div>
  );
}
