import {
  Order,
  Pricing,
  PriceBreakdown,
  PriceLine,
  LaminationType,
  PrintOptions,
} from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────

function laminationLabel(type: LaminationType): string {
  const labels: Record<LaminationType, string> = {
    id_card: 'ID Card Lamination',
    aadhaar: 'Aadhaar Card Lamination',
    pan: 'PAN Card Lamination',
    certificate: 'Certificate Lamination',
    a4: 'A4 Document Lamination',
  };
  return labels[type];
}

// ── main export ───────────────────────────────────────────────────────────────

/**
 * Per-file print-cost line items for one file. Pulled out of
 * `calculateOrderTotal` so it can be summed across every file on the order —
 * each file may now carry its own `printOptions`, falling back to the
 * order-level snapshot when it hasn't been edited yet.
 */
/** "1-40, 45, 50-52" → count of pages covered, capped at the document's actual page count. */
function pagesFromRange(range: string, max: number): number {
  let count = 0;
  for (const part of range.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [a, b] = part.split('-').map((n) => parseInt(n, 10));
    if (!isNaN(a) && !isNaN(b)) count += Math.max(0, b - a + 1);
    else if (!isNaN(a)) count += 1;
  }
  return Math.min(count, max);
}

function fileLineItems(
  file: Pick<Order['files'][number], 'name' | 'pages' | 'printOptions'>,
  fallbackOptions: PrintOptions,
  pricing: Pricing,
): PriceLine[] {
  const lines: PriceLine[] = [];
  const printOptions = file.printOptions ?? fallbackOptions;
  const documentPages = file.pages ?? 1;
  const totalPages =
    printOptions.pages.mode === 'custom' && printOptions.pages.range
      ? pagesFromRange(printOptions.pages.range, documentPages)
      : documentPages;

  // Front/back cover pages are billed separately at the cover rate below, so
  // exclude them from the regular per-page body count to avoid
  // double-charging the same physical page.
  const coverPages =
    (printOptions.frontCoverColor ? 1 : 0) + (printOptions.backCoverColor ? 1 : 0);
  const bodyPages = Math.max(0, totalPages - coverPages);
  const isDoubleSided = printOptions.side === 'double';
  // Physical papers used — halved on double-sided since each paper carries
  // two document pages.
  const effectivePages = isDoubleSided ? Math.ceil(bodyPages / 2) : bodyPages;
  const perPage =
    printOptions.paperType === 'photo'
      ? printOptions.paperSize === '4x6'
        ? pricing.photoPaper4x6
        : pricing.photoPaperA4
      : printOptions.type === 'bw'
        ? pricing.bwPage
        : pricing.colorPage;

  // Base cost is always billed per physical paper used (unchanged for color
  // in every case, and for B&W single-sided).
  const printCost = effectivePages * printOptions.copies * perPage;
  const namePrefix = `${file.name} — `;
  const label =
    printOptions.paperType === 'photo'
      ? `${namePrefix}Photo Paper (${printOptions.paperSize}) Print × ${effectivePages}pp × ${printOptions.copies} copy(ies)`
      : `${namePrefix}${printOptions.type === 'bw' ? 'B&W' : 'Colour'} Print × ${effectivePages}pp × ${printOptions.copies} copy(ies)`;
  lines.push({ label, amount: printCost });

  // B&W double-sided only: extra flat work charge, billed per group of
  // document pages (not papers) — e.g. ₹5 per 5 pages of the document, but
  // only for pages beyond the first free threshold (the first `groupSize`
  // pages incur no work charge at all). Applied per file now that each file
  // can have its own side/type settings.
  if (isDoubleSided && printOptions.type === 'bw' && bodyPages > 0) {
    const groupSize = Math.max(1, pricing.doubleSideWorkChargePageGroup || 5);
    const rate = pricing.doubleSideWorkCharge ?? 0;
    const excessPages = Math.max(0, bodyPages - groupSize);
    if (rate > 0 && excessPages > 0) {
      const groups = Math.ceil(excessPages / groupSize);
      const workCharge = groups * rate * printOptions.copies;
      lines.push({
        label: `${namePrefix}Double-side Work Charge × ${bodyPages}pp (₹${rate}/${groupSize}pp after first ${groupSize}pp) × ${printOptions.copies} copy(ies)`,
        amount: workCharge,
      });
    }
  }

  // Front cover
  if (printOptions.frontCoverColor && printOptions.type === 'bw') {
    const cost = printOptions.copies * pricing.frontCoverColor;
    lines.push({ label: `${namePrefix}Front Cover (Colour) × ${printOptions.copies}`, amount: cost });
  }

  // Back cover
  if (printOptions.backCoverColor && printOptions.type === 'bw') {
    const cost = printOptions.copies * pricing.backCoverColor;
    lines.push({ label: `${namePrefix}Back Cover (Colour) × ${printOptions.copies}`, amount: cost });
  }

  return lines;
}

/**
 * Calculate a fully itemised price breakdown for an order.
 * All arithmetic is done server-side; the returned `total` is what gets persisted.
 *
 * Print cost is a **sum of per-file line items**: each file uses its own
 * `printOptions` if it has been edited (e.g. via the admin print review
 * page), falling back to the order-level `printOptions` snapshot captured
 * at checkout otherwise. Lamination/binding remain order-level services.
 */
export function calculateOrderTotal(
  order: Pick<Order, 'files' | 'printOptions' | 'lamination' | 'binding'>,
  pricing: Pricing,
): PriceBreakdown {
  const lines: PriceLine[] = [];
  const { printOptions, lamination, binding, files } = order;

  // ── 1. Print cost — summed per file ─────────────────────────────────────
  if (binding.mode !== 'binding_only' && files.length > 0) {
    for (const file of files) {
      lines.push(...fileLineItems(file, printOptions, pricing));
    }
  }

  // ── 2. Lamination ────────────────────────────────────────────────────────
  for (const item of lamination) {
    if (item.quantity <= 0) continue;
    const unitPrice = pricing.lamination[item.type] ?? 0;
    const cost = unitPrice * item.quantity;
    lines.push({
      label: `${laminationLabel(item.type)} × ${item.quantity}`,
      amount: cost,
    });
  }

  // ── 3. Spiral binding ────────────────────────────────────────────────────
  if (binding.mode === 'print_and_binding' || binding.mode === 'binding_only') {
    const docCount = binding.documentCount ?? 1;
    const cost = pricing.spiralBinding * docCount;
    lines.push({
      label: `Spiral Binding × ${docCount} document(s)`,
      amount: cost,
    });
  }

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  return { lines, total };
}
