import type {
  BindingOptions,
  LaminationItem,
  Order,
  PrintOptions,
  Pricing,
  StoredFile,
} from "@/types";

interface ComputeInput {
  files: Pick<StoredFile, "name" | "pages" | "printOptions">[];
  printOptions: PrintOptions;
  lamination: LaminationItem[];
  binding: BindingOptions;
}

export interface PriceLine {
  label: string;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  total: number;
}

function pagesFromRange(range: string, max: number): number {
  // "1-40, 45, 50-52"
  let count = 0;
  for (const part of range
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const [a, b] = part.split("-").map((n) => parseInt(n, 10));
    if (!isNaN(a) && !isNaN(b)) count += Math.max(0, b - a + 1);
    else if (!isNaN(a)) count += 1;
  }
  return Math.min(count, max);
}

/**
 * Per-file print-cost line items — each file uses its own `printOptions` if
 * it's been edited (e.g. via the admin print review page), falling back to
 * the order-level snapshot captured at checkout otherwise.
 */
function fileLineItems(
  file: Pick<StoredFile, "name" | "pages" | "printOptions">,
  fallbackOptions: PrintOptions,
  pricing: Pricing,
): PriceLine[] {
  const lines: PriceLine[] = [];
  const printOptions = file.printOptions ?? fallbackOptions;
  const documentPages = file.pages ?? 1;
  const totalPages =
    printOptions.pages.mode === "custom" && printOptions.pages.range
      ? pagesFromRange(printOptions.pages.range, documentPages)
      : documentPages;

  const copies = Math.max(1, printOptions.copies);
  const coverPages = (printOptions.frontCoverColor ? 1 : 0) + (printOptions.backCoverColor ? 1 : 0);
  const regularPages = Math.max(0, totalPages - coverPages);
  const isDoubleSided = printOptions.side === "double";
  // Physical papers used — halved on double-sided since each paper carries
  // two document pages. Billing is always per paper used; this is
  // unchanged for color in every case, and for B&W single-sided.
  const paperCount = isDoubleSided ? Math.ceil(regularPages / 2) : regularPages;

  const perPage =
    printOptions.paperType === "photo"
      ? printOptions.paperSize === "4x6"
        ? pricing.photoPaper4x6
        : pricing.photoPaperA4
      : printOptions.type === "color"
        ? pricing.colorPage
        : pricing.bwPage;
  const printing = perPage * paperCount * copies;
  const namePrefix = `${file.name} — `;
  lines.push({
    label:
      printOptions.paperType === "photo"
        ? `${namePrefix}Photo Paper (${printOptions.paperSize}) — ${isDoubleSided ? "Double-sided" : "Single-sided"} (${paperCount} print${paperCount === 1 ? "" : "s"} × ${copies})`
        : `${namePrefix}Printing — ${isDoubleSided ? "Double-sided" : "Single-sided"} (${paperCount} paper${paperCount === 1 ? "" : "s"} × ${copies})`,
    amount: printing,
  });

  // B&W double-sided only: extra flat work charge, billed per group of
  // document pages (not papers) — e.g. ₹5 per 5 pages of the document,
  // but only for pages beyond the first free threshold (the first
  // `groupSize` pages incur no work charge at all).
  if (isDoubleSided && printOptions.type === "bw" && regularPages > 0) {
    const groupSize = Math.max(1, pricing.doubleSideWorkChargePageGroup || 5);
    const rate = pricing.doubleSideWorkCharge ?? 0;
    const excessPages = Math.max(0, regularPages - groupSize);
    if (rate > 0 && excessPages > 0) {
      const groups = Math.ceil(excessPages / groupSize);
      lines.push({
        label: `${namePrefix}Double-side work charge (${regularPages} pages, ₹${rate}/${groupSize}pp after first ${groupSize}pp × ${copies})`,
        amount: groups * rate * copies,
      });
    }
  }

  if (printOptions.frontCoverColor && printOptions.type === "bw") {
    lines.push({
      label: `${namePrefix}Front cover (color)`,
      amount: pricing.frontCoverColor * copies,
    });
  }
  if (printOptions.backCoverColor && printOptions.type === "bw") {
    lines.push({
      label: `${namePrefix}Back cover (color)`,
      amount: pricing.backCoverColor * copies,
    });
  }

  return lines;
}

export function computePriceBreakdown(input: ComputeInput, pricing: Pricing): PriceBreakdown {
  const lines: PriceLine[] = [];

  if (input.binding.mode !== "binding_only" && input.files.length > 0) {
    for (const file of input.files) {
      lines.push(...fileLineItems(file, input.printOptions, pricing));
    }
  }

  for (const lam of input.lamination) {
    if (lam.quantity > 0) {
      const unit = pricing.lamination[lam.type];
      lines.push({
        label: `Lamination — ${lam.type.replace("_", " ")} × ${lam.quantity}`,
        amount: unit * lam.quantity,
      });
    }
  }

  if (input.binding.mode === "print_and_binding") {
    const docs = Math.max(1, input.binding.documentCount ?? 1);
    lines.push({ label: `Spiral binding × ${docs}`, amount: pricing.spiralBinding * docs });
  } else if (input.binding.mode === "binding_only") {
    const docs = Math.max(1, input.binding.documentCount ?? 1);
    lines.push({
      label: `Spiral binding × ${docs}`,
      amount: pricing.spiralBinding * docs,
    });
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total };
}

export function computeOrderTotal(order: Order, pricing: Pricing): number {
  return computePriceBreakdown(order, pricing).total;
}

export const defaultPricing: Pricing = {
  bwPage: 2,
  colorPage: 8,
  frontCoverColor: 10,
  backCoverColor: 10,
  passportSheet: 40,
  photoPaperA4: 25,
  photoPaper4x6: 15,
  lamination: {
    id_card: 20,
    aadhaar: 30,
    pan: 20,
    certificate: 50,
    a4: 80,
  },
  spiralBinding: 40,
  doubleSideWorkCharge: 5,
  doubleSideWorkChargePageGroup: 5,
};
