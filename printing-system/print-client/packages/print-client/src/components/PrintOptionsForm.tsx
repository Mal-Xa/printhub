import { ColorMode, DuplexMode, PaperSize, PaperType, PrintQuality } from "print-common";
import type { PrintOptions } from "print-common";

interface PrintOptionsFormProps {
  options: PrintOptions;
  onChange: (options: PrintOptions) => void;
  maxCopies?: number;
  disabled?: boolean;
}

const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  [ColorMode.COLOR]: "Color",
  [ColorMode.GRAYSCALE]: "Grayscale",
  [ColorMode.MONOCHROME]: "Black & white",
};

const DUPLEX_MODE_LABELS: Record<DuplexMode, string> = {
  [DuplexMode.SIMPLEX]: "Single-sided",
  [DuplexMode.DUPLEX_LONG_EDGE]: "Double-sided (long edge)",
  [DuplexMode.DUPLEX_SHORT_EDGE]: "Double-sided (short edge)",
};

const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  [PaperSize.A4]: "A4",
  [PaperSize.A3]: "A3",
  [PaperSize.LETTER]: "Letter",
  [PaperSize.LEGAL]: "Legal",
  [PaperSize.TABLOID]: "Tabloid",
};

const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  [PaperType.NORMAL]: "Normal (plain paper)",
  [PaperType.PHOTO_PAPER_GLOSSY]: "Photo Paper Glossy",
  [PaperType.PHOTO_PAPER_MATTE]: "Photo Paper Matte",
  [PaperType.EPSON_PREMIUM_GLOSSY]: "Epson Premium Glossy Photo Paper",
  [PaperType.EPSON_PREMIUM_SEMIGLOSS]: "Epson Premium Semi-Gloss Photo Paper",
  [PaperType.EPSON_PREMIUM_LUSTER]: "Epson Premium Luster Photo Paper",
  [PaperType.EPSON_ULTRA_PREMIUM_GLOSSY]: "Epson Ultra Premium Glossy Photo Paper",
  [PaperType.EPSON_PREMIUM_PRESENTATION_MATTE]: "Epson Premium Presentation Paper Matte",
  [PaperType.EPSON_ARCHIVAL_MATTE]: "Epson Archival Matte Paper",
  [PaperType.CARDSTOCK]: "Cardstock",
  [PaperType.ENVELOPE]: "Envelope",
};

const QUALITY_LABELS: Record<PrintQuality, string> = {
  [PrintQuality.DRAFT]: "Draft",
  [PrintQuality.NORMAL]: "Normal",
  [PrintQuality.HIGH]: "High",
};

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-1 block text-xs font-medium text-slate-600">{children}</label>;
}

const selectClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60";

export function PrintOptionsForm({ options, onChange, maxCopies = 9999, disabled }: PrintOptionsFormProps) {
  const update = <K extends keyof PrintOptions>(key: K, value: PrintOptions[K]) =>
    onChange({ ...options, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Copies</FieldLabel>
        <input
          type="number"
          min={1}
          max={maxCopies}
          value={options.copies}
          disabled={disabled}
          onChange={(e) => update("copies", Math.min(maxCopies, Math.max(1, Number(e.target.value) || 1)))}
          className={selectClasses}
        />
      </div>

      <div>
        <FieldLabel>Quality</FieldLabel>
        <select
          value={options.quality}
          disabled={disabled}
          onChange={(e) => update("quality", e.target.value as PrintQuality)}
          className={selectClasses}
        >
          {Object.values(PrintQuality).map((q) => (
            <option key={q} value={q}>
              {QUALITY_LABELS[q]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel>Color</FieldLabel>
        <select
          value={options.colorMode}
          disabled={disabled}
          onChange={(e) => update("colorMode", e.target.value as ColorMode)}
          className={selectClasses}
        >
          {Object.values(ColorMode).map((c) => (
            <option key={c} value={c}>
              {COLOR_MODE_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel>Sides</FieldLabel>
        <select
          value={options.duplexMode}
          disabled={disabled}
          onChange={(e) => update("duplexMode", e.target.value as DuplexMode)}
          className={selectClasses}
        >
          {Object.values(DuplexMode).map((d) => (
            <option key={d} value={d}>
              {DUPLEX_MODE_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel>Paper size</FieldLabel>
        <select
          value={options.paperSize}
          disabled={disabled}
          onChange={(e) => update("paperSize", e.target.value as PaperSize)}
          className={selectClasses}
        >
          {Object.values(PaperSize).map((p) => (
            <option key={p} value={p}>
              {PAPER_SIZE_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel>Paper type</FieldLabel>
        <select
          value={options.paperType}
          disabled={disabled}
          onChange={(e) => update("paperType", e.target.value as PaperType)}
          className={selectClasses}
        >
          {Object.values(PaperType).map((p) => (
            <option key={p} value={p}>
              {PAPER_TYPE_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel>Page ranges (optional)</FieldLabel>
        <input
          type="text"
          placeholder="e.g. 1-5,8,11-13"
          value={options.pageRanges ?? ""}
          disabled={disabled}
          onChange={(e) => update("pageRanges", e.target.value || undefined)}
          className={selectClasses}
        />
      </div>
    </div>
  );
}
