import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, CreditCard, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardStepper } from "@/components/orders/WizardStepper";
import { FileDropzone } from "@/components/orders/FileDropzone";
import { PrintOptionsForm } from "@/components/orders/PrintOptionsForm";
import { ServicesForm } from "@/components/orders/ServicesForm";
import { PriceBreakdownCard } from "@/components/orders/PriceBreakdownCard";
import { useOrderWizard } from "@/hooks/useOrderWizard";
import { useAuth } from "@/hooks/useAuth";
import { pricingService } from "@/services/pricingService";
import { computePriceBreakdown } from "@/lib/pricing";
import { formatINR } from "@/lib/format";
import { orderService } from "@/services/orderService";
import { fileService } from "@/services/fileService";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  // Set when arriving via "Reprint" on the My Files page, to preselect an
  // already-uploaded file instead of asking the user to upload it again.
  fileId: z.string().optional(),
});

export const Route = createFileRoute("/app/orders/new")({
  head: () => ({ meta: [{ title: "New order — Sora Print Hub" }] }),
  validateSearch: searchSchema,
  component: NewOrderPage,
});

function NewOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { fileId } = Route.useSearch();
  const { state, setState, update, step, setStep, reset } = useOrderWizard();
  const { data: pricing } = useQuery({ queryKey: ["pricing"], queryFn: () => pricingService.get() });
  const [payment, setPayment] = useState<"upi" | "card" | "cod" | null>(null);
  const [upiId, setUpiId] = useState("");
  const [cardLast4, setCardLast4] = useState("");

  // Reprint flow: a fileId in the URL means we arrived from "Reprint" on My
  // Files. Preload that file into the wizard so the user doesn't have to
  // upload it again.
  const reprintFile = useQuery({
    queryKey: ["files", fileId],
    queryFn: () => fileService.getById(fileId!),
    enabled: Boolean(fileId),
  });

  useEffect(() => {
    if (!reprintFile.data) return;
    const sf = reprintFile.data;
    update({
      files: state.files.some((f) => f.id === sf.id)
        ? state.files
        : [
            ...state.files,
            {
              id: sf.id,
              name: sf.name,
              sizeBytes: sf.sizeBytes,
              mimeType: sf.mimeType,
              url: sf.url,
              pages: sf.pages,
            },
          ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprintFile.data]);

  // Newly-dropped files only exist as local File objects — upload them right
  // away (rather than waiting for final submit) so we get back the server's
  // real page count instead of guessing, and pricing reflects the actual
  // document as soon as possible.
  useEffect(() => {
    const toUpload = state.files.filter((f) => f.file && !f.uploading && !f.uploadError);
    if (toUpload.length === 0) return;

    setState((prev) => ({
      ...prev,
      files: prev.files.map((f) =>
        toUpload.some((t) => t.id === f.id) ? { ...f, uploading: true } : f,
      ),
    }));

    toUpload.forEach((f) => {
      fileService
        .upload(f.file!)
        .then((uploaded) => {
          setState((prev) => ({
            ...prev,
            files: prev.files.map((x) =>
              x.id === f.id
                ? {
                    id: uploaded.id,
                    name: uploaded.name,
                    sizeBytes: uploaded.sizeBytes,
                    mimeType: uploaded.mimeType,
                    url: uploaded.url,
                    pages: uploaded.pages,
                  }
                : x,
            ),
          }));
        })
        .catch(() => {
          setState((prev) => ({
            ...prev,
            files: prev.files.map((x) =>
              x.id === f.id ? { ...x, uploading: false, uploadError: true } : x,
            ),
          }));
          toast.error(`Couldn't read "${f.name}" — try re-uploading it.`);
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.files]);

  const breakdown = useMemo(() => {
    if (!pricing) return { lines: [], total: 0 };
    return computePriceBreakdown(
      {
        // Real page count when known (images instantly, others once the
        // upload above resolves); falls back to 1 rather than a guess while
        // a pdf/docx/pptx is still being read.
        files: state.files.map((f) => ({ name: f.name, pages: f.pages ?? 1 })),
        printOptions: state.printOptions,
        lamination: state.laminationEnabled ? state.lamination : [],
        binding: state.binding,
      },
      pricing,
    );
  }, [pricing, state]);

  // Anything that feeds computePriceBreakdown — changing print side/type in
  // particular changes the total (per-paper billing + B&W double-side work
  // charge), so briefly flag "recalculating" and block Next/Pay until the
  // new breakdown above has settled, rather than letting the user advance
  // on a stale price.
  const pricingInputsKey = JSON.stringify({
    printOptions: state.printOptions,
    lamination: state.laminationEnabled ? state.lamination : [],
    binding: state.binding,
    pages: state.files.map((f) => f.pages ?? 1),
  });
  const [isPriceCalculating, setIsPriceCalculating] = useState(false);
  const pricingInputsKeyRef = useRef(pricingInputsKey);

  useEffect(() => {
    if (pricingInputsKeyRef.current === pricingInputsKey) return;
    pricingInputsKeyRef.current = pricingInputsKey;
    setIsPriceCalculating(true);
    const t = setTimeout(() => setIsPriceCalculating(false), 300);
    return () => clearTimeout(t);
  }, [pricingInputsKey]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Newly-dropped files are only held as local File objects until now —
      // upload them to get real server-side StoredFile ids. Files that
      // already have a server id (e.g. preloaded via "Reprint") are already
      // uploaded, so reuse their id instead of re-uploading — and, crucially,
      // still include them in the order rather than dropping them.
      const resolvedIds = await Promise.all(
        state.files.map(async (f) => (f.file ? (await fileService.upload(f.file)).id : f.id)),
      );
      const fileIds = resolvedIds.map((id) => ({ id }));

      return orderService.create({
        customer: { name: user.fullName, phone: user.phone, email: user.email },
        fileIds,
        printOptions: state.printOptions,
        lamination: state.laminationEnabled ? state.lamination : [],
        binding: state.binding,
        specialInstructions: state.specialInstructions,
      });
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(payment === "cod" ? "Order placed! Pay on pickup." : "Payment received — order placed!");
      reset();
      setPayment(null);
      navigate({ to: "/app/orders/$id", params: { id: order.id } });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Couldn't place order. Try again."),
  });

  // True while any freshly-dropped file is still uploading / having its page
  // count read by the server (pages stays undefined until that resolves).
  const filesStillReading = state.files.some(
    (f) => (f.file || f.uploading) && f.pages === undefined && !f.uploadError,
  );

  const canNext = () => {
    if (isPriceCalculating) return false;
    if (step === 1) {
      if (state.binding.mode === "binding_only") return true;
      return state.files.length > 0 && !filesStillReading;
    }
    return true;
  };

  const canSubmit = () => {
    if (!payment) return false;
    if (payment === "upi" && !/^[\w.\-]+@[\w]+$/.test(upiId.trim())) return false;
    if (payment === "card" && cardLast4.replace(/\D/g, "").length < 4) return false;
    return true;
  };

  return (
    <>
      <PageHeader title="New order" description="Build your order in a few quick steps." />

      <WizardStepper step={step} onStep={(n) => n < step && setStep(n)} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {step === 1 && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <SectionTitle title="Upload files" subtitle="PDF, DOCX, PPTX, JPG, PNG" />
                <FileDropzone value={state.files} onChange={(files) => update({ files })} />
                {state.binding.mode === "binding_only" && (
                  <p className="text-xs text-muted-foreground">
                    You selected <span className="font-medium text-foreground">Spiral Binding Only</span> — no file upload needed.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <SectionTitle title="Printing options" subtitle="Choose how your documents should be printed." />
              <PrintOptionsForm
                value={state.printOptions}
                onChange={(printOptions) => update({ printOptions })}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <SectionTitle title="Additional services" subtitle="Add lamination or spiral binding." />
              <ServicesForm
                laminationEnabled={state.laminationEnabled}
                onLaminationEnabledChange={(laminationEnabled) => update({ laminationEnabled })}
                lamination={state.lamination}
                onLaminationChange={(lamination) => update({ lamination })}
                binding={state.binding}
                onBindingChange={(binding) => update({ binding })}
              />
            </div>
          )}

          {step === 4 && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <SectionTitle title="Special instructions" subtitle="Anything else we should know?" />
                <Textarea
                  rows={8}
                  value={state.specialInstructions}
                  onChange={(e) => update({ specialInstructions: e.target.value })}
                  placeholder={`Front page should be color.\nPrint only pages 1-40.\nEnsure pages are in correct order.`}
                />
              </CardContent>
            </Card>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <SectionTitle title="Review your order" subtitle="Make sure everything looks right." />
              <Card>
                <CardContent className="space-y-4 p-5 text-sm">
                  <ReviewBlock title="Files">
                    {state.files.length === 0 ? (
                      <p className="text-muted-foreground">No files (binding only).</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {state.files.map((f) => <li key={f.id} className="truncate">• {f.name}</li>)}
                      </ul>
                    )}
                  </ReviewBlock>
                  <Separator />
                  <ReviewBlock title="Printing">
                    <p>
                      {state.printOptions.type === "color" ? "Color" : "Black & White"} ·{" "}
                      {state.printOptions.side === "double" ? "Double-sided" : "Single-sided"} ·{" "}
                      {state.printOptions.copies} {state.printOptions.copies > 1 ? "copies" : "copy"} ·{" "}
                      {state.printOptions.paperSize} ·{" "}
                      {state.printOptions.paperType === "photo" ? "Photo Paper" : "Normal Paper"}
                    </p>
                    <p className="text-muted-foreground">
                      Pages: {state.printOptions.pages.mode === "all" ? "All" : state.printOptions.pages.range ?? "—"}
                    </p>
                  </ReviewBlock>
                  {state.laminationEnabled && state.lamination.length > 0 && (
                    <>
                      <Separator />
                      <ReviewBlock title="Lamination">
                        <ul className="space-y-0.5">
                          {state.lamination.map((l, i) => (
                            <li key={i}>{l.type.replace("_", " ")} × {l.quantity}</li>
                          ))}
                        </ul>
                      </ReviewBlock>
                    </>
                  )}
                  {state.binding.mode !== "print_only" && (
                    <>
                      <Separator />
                      <ReviewBlock title="Binding">
                        <p>{state.binding.mode === "binding_only" ? "Spiral binding only" : "Print + spiral binding"}</p>
                      </ReviewBlock>
                    </>
                  )}
                  {state.specialInstructions && (
                    <>
                      <Separator />
                      <ReviewBlock title="Instructions">
                        <p className="whitespace-pre-line">{state.specialInstructions}</p>
                      </ReviewBlock>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <SectionTitle title="Payment" subtitle="Pick how you want to pay. This is a demo — no money moves." />
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { id: "upi" as const, icon: Smartphone, label: "UPI", hint: "GPay, PhonePe, Paytm" },
                      { id: "card" as const, icon: CreditCard, label: "Card", hint: "Credit / Debit" },
                      { id: "cod" as const, icon: Wallet, label: "Pay at pickup", hint: "Cash on collection" },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setPayment(m.id)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition",
                          payment === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
                        )}
                      >
                        <m.icon className="mb-2 h-5 w-5 text-primary" />
                        <p className="font-medium">{m.label}</p>
                        <p className="text-xs text-muted-foreground">{m.hint}</p>
                      </button>
                    ))}
                  </div>

                  {payment === "upi" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="upi">UPI ID</Label>
                      <Input id="upi" placeholder="yourname@oksbi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
                    </div>
                  )}
                  {payment === "card" && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="card">Card number</Label>
                        <Input id="card" placeholder="•••• •••• •••• 4242" value={cardLast4} onChange={(e) => setCardLast4(e.target.value)} maxLength={19} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="exp">Expiry</Label>
                        <Input id="exp" placeholder="MM/YY" />
                      </div>
                    </div>
                  )}
                  {payment === "cod" && (
                    <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                      You'll pay <span className="font-semibold text-foreground">{formatINR(breakdown.total)}</span> in cash when you collect your order.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            {step < 6 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canNext()}
              >
                {step === 1 && filesStillReading
                  ? "Reading pages…"
                  : isPriceCalculating
                    ? "Calculating price…"
                    : "Continue"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => submit.mutate()}
                disabled={submit.isPending || !canSubmit() || isPriceCalculating}
              >
                <Check className="mr-1 h-4 w-4" />
                {submit.isPending ? "Processing…" : `Pay ${formatINR(breakdown.total)} & place order`}
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <PriceBreakdownCard breakdown={breakdown} isCalculating={isPriceCalculating} />
          <Card>
            <CardContent className="space-y-1 p-5 text-xs text-muted-foreground">
              <p className="font-semibold uppercase tracking-wider">Pickup</p>
              <p>You'll be notified when your order is ready. Most orders are ready within 2 hours.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
