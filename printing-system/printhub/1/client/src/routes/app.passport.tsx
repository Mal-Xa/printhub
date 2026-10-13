import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Camera, RotateCw, RotateCcw, Image as ImageIcon, Plus, Save, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { PageHeader } from "@/components/layout/PageHeader";
import { passportService } from "@/services/passportService";
import { fileService } from "@/services/fileService";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/** Turns the composited data URL from the canvas editor into a real File so it can be uploaded like any other document. */
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Print-sheet resolution: 4×6in at 300dpi.
const SHEET_PX_W = 1200;
const SHEET_PX_H = 1800;
const SHEET_COLS = 3;
const SHEET_ROWS = 3;

/**
 * Composites the single cropped passport photo into an actual print-ready
 * 4×6in sheet: a 3×3 grid of the photo with dashed cutting guides between
 * each cell. This is what actually gets uploaded/saved/ordered, so the
 * output always matches what "9 photos on a 4×6 sheet" promises.
 */
async function composeSheet(croppedDataUrl: string, ratio: number): Promise<string> {
  const img = await loadImage(croppedDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_PX_W;
  canvas.height = SHEET_PX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create sheet canvas");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SHEET_PX_W, SHEET_PX_H);

  const margin = 48;
  const gutter = 24;

  const availW = SHEET_PX_W - margin * 2 - gutter * (SHEET_COLS - 1);
  const availH = SHEET_PX_H - margin * 2 - gutter * (SHEET_ROWS - 1);

  // Fit each cell to the template's aspect ratio within the available grid area.
  let cellH = availH / SHEET_ROWS;
  let cellW = cellH * ratio;
  if (cellW * SHEET_COLS > availW) {
    cellW = availW / SHEET_COLS;
    cellH = cellW / ratio;
  }

  const gridW = cellW * SHEET_COLS + gutter * (SHEET_COLS - 1);
  const gridH = cellH * SHEET_ROWS + gutter * (SHEET_ROWS - 1);
  const startX = (SHEET_PX_W - gridW) / 2;
  const startY = (SHEET_PX_H - gridH) / 2;

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  for (let r = 0; r < SHEET_ROWS; r++) {
    for (let c = 0; c < SHEET_COLS; c++) {
      const x = startX + c * (cellW + gutter);
      const y = startY + r * (cellH + gutter);
      ctx.drawImage(img, x, y, cellW, cellH);
      ctx.strokeRect(x, y, cellW, cellH);
    }
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}

export const Route = createFileRoute("/app/passport")({
  head: () => ({ meta: [{ title: "Passport Photos — Sora Print Hub" }] }),
  component: PassportPage,
});

type Template = "passport" | "visa" | "id";

const TEMPLATES: { id: Template; label: string; size: string; ratio: number }[] = [
  { id: "passport", label: "Passport Photo", size: "35×45 mm", ratio: 35 / 45 },
  { id: "visa", label: "Visa Photo", size: "51×51 mm", ratio: 1 },
  { id: "id", label: "ID Photo", size: "25×35 mm", ratio: 25 / 35 },
];

function PassportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [template, setTemplate] = useState<Template>("passport");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  // The actual composited 4×6in, 9-photo print sheet (generated from croppedUrl on demand).
  const [sheetDataUrl, setSheetDataUrl] = useState<string | null>(null);
  // Id of the StoredFile (in My Files) backing the current sheet, once uploaded.
  const [linkedFileId, setLinkedFileId] = useState<string | null>(null);

  const { data: sheets } = useQuery({
    queryKey: ["passport", user?.id],
    queryFn: () => passportService.list(),
    enabled: Boolean(user),
  });

  // Reset transforms whenever the photo or template changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  }, [photoUrl, template]);

  // Any time the actual crop changes, the previously composited sheet (and
  // any file already uploaded for it) is stale — clear both so the next
  // save/order regenerates and re-uploads the up-to-date sheet.
  useEffect(() => {
    setSheetDataUrl(null);
    setLinkedFileId(null);
  }, [croppedUrl]);

  const activeTemplate = TEMPLATES.find((t) => t.id === template)!;

  // Builds (and caches) the actual print-ready 4×6in sheet — a 3×3 grid of
  // the cropped photo — from the current crop. Cached in sheetDataUrl so
  // repeated calls (save, then add-to-order) don't recompute it.
  const ensureSheetComposed = async (): Promise<string> => {
    if (sheetDataUrl) return sheetDataUrl;
    if (!croppedUrl) throw new Error("No cropped photo to lay out");
    const composed = await composeSheet(croppedUrl, activeTemplate.ratio);
    setSheetDataUrl(composed);
    return composed;
  };

  // Uploads the composited sheet as a real file (once) so it shows up in
  // My Files and can be attached to a print order. Reused by both Save and
  // Add to print order so we never upload the same sheet twice.
  const ensureFileUploaded = async (): Promise<string> => {
    if (linkedFileId) return linkedFileId;
    const composed = await ensureSheetComposed();
    const file = await dataUrlToFile(composed, `passport-${template}-sheet-${Date.now()}.jpg`);
    const uploaded = await fileService.upload(file);
    setLinkedFileId(uploaded.id);
    qc.invalidateQueries({ queryKey: ["files"] });
    return uploaded.id;
  };

  const save = useMutation({
    mutationFn: async () => {
      const composed = await ensureSheetComposed();
      await ensureFileUploaded();
      return passportService.save({
        template,
        photoUrl: composed,
        photosPerSheet: 9,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["passport"] });
      toast.success("Sheet saved to your library");
    },
    onError: () => toast.error("Couldn't save the sheet. Try again."),
  });

  const addToOrder = useMutation({
    mutationFn: () => ensureFileUploaded(),
    onSuccess: (fileId) => {
      navigate({ to: "/app/orders/new", search: { fileId } });
    },
    onError: () => toast.error("Couldn't add the sheet to a print order."),
  });

  return (
    <>
      <PageHeader
        title="Passport photo creator"
        description="Upload a photo, pick a template and we'll lay out a print-ready sheet."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/passport/saved">Saved sheets</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Upload */}
          <Card>
            <CardContent className="p-5">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card p-6 text-center transition hover:border-primary/60">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhotoUrl(URL.createObjectURL(f));
                      setCroppedUrl(null);
                    }
                  }}
                />
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Camera className="h-6 w-6" />
                </div>
                <p className="mt-3 font-medium">{photoUrl ? "Replace photo" : "Upload your photo"}</p>
                <p className="text-xs text-muted-foreground">JPG or PNG, well-lit, plain background</p>
              </label>
            </CardContent>
          </Card>

          {/* Editor */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Editor</h3>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Rotate left"
                    disabled={!photoUrl}
                    onClick={() => setRotation((r) => r - 90)}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Rotate right"
                    disabled={!photoUrl}
                    onClick={() => setRotation((r) => r + 90)}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="Reset"
                    disabled={!photoUrl}
                    onClick={() => {
                      setZoom(1);
                      setRotation(0);
                      setOffset({ x: 0, y: 0 });
                    }}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <PhotoEditor
                photoUrl={photoUrl}
                zoom={zoom}
                rotation={rotation}
                offset={offset}
                onOffsetChange={setOffset}
                aspectRatio={activeTemplate.ratio}
                onCropChange={setCroppedUrl}
              />

              {photoUrl && (
                <div className="space-y-3 pt-1">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">Zoom</span>
                      <span className="text-muted-foreground">{zoom.toFixed(2)}×</span>
                    </div>
                    <Slider
                      value={[zoom]}
                      min={0.5}
                      max={3}
                      step={0.01}
                      onValueChange={(v) => setZoom(v[0])}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Drag the photo to reposition · use the slider to zoom · rotate buttons for orientation.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Templates */}
          <Card>
            <CardContent className="space-y-3 p-5">
              <h3 className="font-semibold">Templates</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={cn(
                      "rounded-xl border bg-card p-4 text-left transition",
                      template === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.size}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview / actions */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div>
                <h3 className="font-semibold">Sheet preview</h3>
                <p className="text-xs text-muted-foreground">4×6 inch · 9 photos · cutting guides</p>
              </div>
              <SheetPreview photoUrl={croppedUrl} ratio={activeTemplate.ratio} />
            </CardContent>
          </Card>
          <div className="space-y-2">
            <Button className="w-full" disabled={!croppedUrl || save.isPending} onClick={() => save.mutate()}>
              <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Saving…" : "Save sheet"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={!croppedUrl || addToOrder.isPending}
              onClick={() => addToOrder.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" /> {addToOrder.isPending ? "Adding…" : "Add to print order"}
            </Button>
          </div>
          {sheets && sheets.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              You have {sheets.length} saved {sheets.length === 1 ? "sheet" : "sheets"}.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------- Photo editor with drag + canvas crop ----------------

interface PhotoEditorProps {
  photoUrl: string | null;
  zoom: number;
  rotation: number;
  offset: { x: number; y: number };
  onOffsetChange: (o: { x: number; y: number }) => void;
  aspectRatio: number;
  onCropChange: (url: string | null) => void;
}

function PhotoEditor({ photoUrl, zoom, rotation, offset, onOffsetChange, aspectRatio, onCropChange }: PhotoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // A new photo means the previous <img>'s decoded bitmap is stale until
  // onLoad fires again — without this the crop effect below could briefly
  // run against the old image while `photoUrl` already points at the new one.
  useEffect(() => {
    setLoaded(false);
  }, [photoUrl]);

  // Regenerate cropped image whenever inputs change
  useEffect(() => {
    if (!photoUrl || !loaded) {
      onCropChange(null);
      return;
    }
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    const rect = container.getBoundingClientRect();
    // Crop window is centered, with the configured aspect ratio, height-fit
    const cropH = rect.height * 0.9;
    const cropW = cropH * aspectRatio;
    const cropX = (rect.width - cropW) / 2;
    const cropY = (rect.height - cropH) / 2;

    // Render the visible container into a canvas at output resolution
    const outH = 600;
    const outW = Math.round(outH * aspectRatio);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);

    // Compute base scale to "contain" the image in the container, then apply zoom
    const baseScale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
    const scale = baseScale * zoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    // Map crop window coords -> output canvas coords
    const sx = outW / cropW;
    const sy = outH / cropH;

    ctx.save();
    // Translate origin to where center of container is in the crop space
    const centerX = rect.width / 2 - cropX;
    const centerY = rect.height / 2 - cropY;
    // Offset must be applied in unrotated screen space (same as the CSS
    // transform: translate(offset) rotate(rotation) scale(zoom), where
    // translate is outermost), so it has to happen BEFORE ctx.rotate.
    ctx.translate(centerX * sx + offset.x * sx, centerY * sy + offset.y * sy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2 * sx, -drawH / 2 * sy, drawW * sx, drawH * sy);
    ctx.restore();

    onCropChange(canvas.toDataURL("image/jpeg", 0.9));
  }, [photoUrl, loaded, zoom, rotation, offset, aspectRatio, onCropChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!photoUrl) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    onOffsetChange({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // Crop overlay size (matches crop math above visually)
  const cropHeightPct = 90;
  const cropWidthPct = cropHeightPct * aspectRatio * (3 / 4); // container is 4:3, so width % = (h% * ratio) / (w/h)

  return (
    <div
      ref={containerRef}
      className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-muted touch-none select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: photoUrl ? "grab" : "default" }}
    >
      {photoUrl ? (
        <>
          <img
            ref={imgRef}
            src={photoUrl}
            alt="Editing"
            onLoad={() => setLoaded(true)}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transformOrigin: "center",
              transition: dragRef.current ? "none" : "transform 60ms linear",
            }}
          />
          {/* Crop frame */}
          <div
            className="pointer-events-none absolute rounded-md border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
            style={{
              height: `${cropHeightPct}%`,
              width: `${cropWidthPct}%`,
            }}
          />
        </>
      ) : (
        <div className="text-center text-sm text-muted-foreground">
          <ImageIcon className="mx-auto h-8 w-8" />
          <p className="mt-2">Upload a photo to start editing</p>
        </div>
      )}
    </div>
  );
}

function SheetPreview({ photoUrl, ratio }: { photoUrl: string | null; ratio: number }) {
  return (
    <div className="mx-auto aspect-[4/6] w-full max-w-[240px] rounded-md border-2 border-dashed border-muted-foreground/40 bg-card p-2">
      <div className="grid h-full grid-cols-3 grid-rows-3 gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-sm border border-dashed border-muted-foreground/40 bg-muted"
            style={{ aspectRatio: ratio }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-[9px] text-muted-foreground">
                {i + 1}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
