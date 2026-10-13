import jsPDF from "jspdf";
import type { Order, Pricing } from "@/types";
import { formatDateTime, formatINR } from "@/lib/format";
import { defaultPricing } from "@/lib/pricing";

const BRAND = "Sora Print Hub";
const BRAND_ADDRESS = [
  "NIELIT Boys' Hostel, Zuangtui",
  "Aizawl, Mizoram 796017",
  "soratechtip@gmail.com · +91 60335 41297",
];

function inr(n: number) {
  // jsPDF default fonts don't render ₹ — use "Rs."
  return formatINR(n).replace("₹", "Rs.");
}

export function generateInvoicePdf(order: Order, pricing: Pricing = defaultPricing): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor("#4F46E5");
  doc.text(BRAND, M, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor("#111827");
  doc.text("INVOICE", W - M, y, { align: "right" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#6B7280");
  BRAND_ADDRESS.forEach((line) => {
    y += 12;
    doc.text(line, M, y);
  });

  // Invoice meta (right)
  let ry = M + 20;
  doc.setFontSize(9);
  doc.setTextColor("#374151");
  const metaRows: [string, string][] = [
    ["Invoice #", `INV-${order.id.replace(/^o[-_]?/i, "").toUpperCase()}`],
    ["Order ID", order.id],
    ["Date", formatDateTime(order.createdAt)],
    ["Status", order.status.replace("_", " ").toUpperCase()],
  ];
  metaRows.forEach(([k, v]) => {
    ry += 14;
    doc.setFont("helvetica", "normal");
    doc.text(k, W - M - 140, ry);
    doc.setFont("helvetica", "bold");
    doc.text(v, W - M, ry, { align: "right" });
  });

  y = Math.max(y, ry) + 24;
  doc.setDrawColor("#E5E7EB");
  doc.line(M, y, W - M, y);
  y += 20;

  // Bill to
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor("#6B7280");
  doc.text("BILL TO", M, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#111827");
  doc.text(order.customer.name, M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#374151");
  y += 13;
  doc.text(order.customer.phone, M, y);
  y += 12;
  doc.text(order.customer.email, M, y);
  y += 24;

  // Line items
  const items: { desc: string; qty: string; amount: number }[] = [];

  if (order.binding.mode !== "binding_only") {
    const totalPages =
      order.files.reduce((s, f) => s + (f.pages ?? 0), 0) * order.printOptions.copies;
    if (totalPages > 0) {
      const rate =
        order.printOptions.paperType === "photo"
          ? order.printOptions.paperSize === "4x6"
            ? pricing.photoPaper4x6
            : pricing.photoPaperA4
          : order.printOptions.type === "color"
            ? pricing.colorPage
            : pricing.bwPage;
      const paperLabel =
        order.printOptions.paperType === "photo" ? "Photo paper" : order.printOptions.paperSize;
      items.push({
        desc: `${order.printOptions.type === "color" ? "Color" : "B&W"} print · ${paperLabel} (${order.printOptions.paperSize}) · ${order.printOptions.side === "double" ? "Double" : "Single"}-sided`,
        qty: `${totalPages} pages × ${inr(rate)}`,
        amount: totalPages * rate,
      });
    }
    if (order.printOptions.frontCoverColor) {
      items.push({
        desc: "Front cover (color)",
        qty: `1 × ${inr(pricing.frontCoverColor)}`,
        amount: pricing.frontCoverColor,
      });
    }
    if (order.printOptions.backCoverColor) {
      items.push({
        desc: "Back cover (color)",
        qty: `1 × ${inr(pricing.backCoverColor)}`,
        amount: pricing.backCoverColor,
      });
    }
  }
  order.lamination.forEach((l) => {
    const rate = pricing.lamination[l.type];
    items.push({
      desc: `Lamination — ${l.type.replace("_", " ")}`,
      qty: `${l.quantity} × ${inr(rate)}`,
      amount: rate * l.quantity,
    });
  });
  if (order.binding.mode !== "print_only") {
    const qty = order.binding.documentCount ?? 1;
    items.push({
      desc: "Spiral binding",
      qty: `${qty} × ${inr(pricing.spiralBinding)}`,
      amount: pricing.spiralBinding * qty,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.amount, 0) || order.total;
  const scale = subtotal === 0 ? 1 : order.total / subtotal;
  items.forEach((i) => (i.amount = Math.round(i.amount * scale)));

  // Table header
  doc.setFillColor("#F3F4F6");
  doc.rect(M, y, W - 2 * M, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor("#374151");
  doc.text("DESCRIPTION", M + 10, y + 15);
  doc.text("QTY / RATE", W - M - 180, y + 15);
  doc.text("AMOUNT", W - M - 10, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setTextColor("#111827");
  items.forEach((it) => {
    doc.text(it.desc, M + 10, y + 16, { maxWidth: 250 });
    doc.text(it.qty, W - M - 180, y + 16);
    doc.text(inr(it.amount), W - M - 10, y + 16, { align: "right" });
    y += 22;
    doc.setDrawColor("#E5E7EB");
    doc.line(M, y, W - M, y);
  });

  // Totals
  y += 16;
  const labelX = W - M - 140;
  const valX = W - M - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Subtotal", labelX, y);
  doc.text(inr(order.total), valX, y, { align: "right" });
  y += 16;
  doc.text("Tax (incl.)", labelX, y);
  doc.text(inr(0), valX, y, { align: "right" });
  y += 8;
  doc.setDrawColor("#111827");
  doc.line(labelX - 10, y, valX, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("TOTAL", labelX, y);
  doc.setTextColor("#4F46E5");
  doc.text(inr(order.total), valX, y, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor("#9CA3AF");
  doc.text(
    "Thank you for choosing Sora Print Hub. This is a computer-generated invoice and does not require a signature.",
    W / 2,
    doc.internal.pageSize.getHeight() - 24,
    { align: "center" },
  );

  return doc;
}

export function downloadInvoice(order: Order, pricing?: Pricing) {
  const doc = generateInvoicePdf(order, pricing);
  doc.save(`invoice-${order.id}.pdf`);
}
