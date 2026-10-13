import { useCallback, useState, type DragEvent as ReactDragEvent } from "react";
import { CloudUpload, File as FileIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACCEPT = [".pdf", ".docx", ".pptx", ".jpg", ".jpeg", ".png"];
const ACCEPT_ATTR = "application/pdf,.docx,.pptx,image/jpeg,image/png";

export interface DroppedFile {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  file?: File;
  url?: string;
  /** Real page count. Known instantly for images; for pdf/docx/pptx this is
   *  filled in once the file has been uploaded and the server has read it. */
  pages?: number;
  uploading?: boolean;
  uploadError?: boolean;
}

function toDropped(file: File): DroppedFile {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    file,
    url: typeof URL !== "undefined" ? URL.createObjectURL(file) : undefined,
    // Images are always a single page — no need to wait on the server for this one.
    pages: file.type.startsWith("image/") ? 1 : undefined,
  };
}

interface Props {
  value: DroppedFile[];
  onChange: (files: DroppedFile[]) => void;
}

export function FileDropzone({ value, onChange }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const accept = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming).filter((f) => {
        const lower = f.name.toLowerCase();
        return ACCEPT.some((ext) => lower.endsWith(ext));
      });
      const mapped = arr.map(toDropped);
      const dedup = [...value];
      for (const m of mapped) {
        if (!dedup.some((d) => d.id === m.id)) dedup.push(m);
      }
      onChange(dedup);
    },
    [value, onChange],
  );

  const onDrop = (e: ReactDragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) accept(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <label
        className={cn(
          "block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center transition",
          dragOver && "border-primary bg-primary/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => e.target.files && accept(e.target.files)}
        />
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <CloudUpload className="h-7 w-7" />
        </div>
        <p className="mt-4 text-base font-semibold">Drag and drop files here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          or click to browse — PDF, DOCX, PPTX, JPG, PNG
        </p>
        <Button type="button" variant="outline" size="sm" className="pointer-events-none mt-4">
          Choose files
        </Button>
      </label>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((f) => (
            <Card key={f.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(f.sizeBytes)}
                    {f.pages
                      ? ` · ${f.pages} page${f.pages === 1 ? "" : "s"}`
                      : f.uploadError
                        ? " · Couldn't read page count"
                        : " · Reading pages…"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => onChange(value.filter((v) => v.id !== f.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
