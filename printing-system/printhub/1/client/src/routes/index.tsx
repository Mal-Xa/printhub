import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Camera, Layers, BookOpen, Upload, Sliders, Send, PackageCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicFooter, PublicHeader } from "@/components/layout/PublicChrome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sora Print Hub — Upload • Print • Laminate • Bind" },
      {
        name: "description",
        content:
          "Sora Print Hub is your neighbourhood print shop online. Upload PDFs, choose print, lamination and binding options, then collect when ready. Pricing in INR (₹).",
      },
      { property: "og:title", content: "Sora Print Hub" },
      {
        property: "og:description",
        content: "Upload your files online and collect them when ready.",
      },
    ],
  }),
  component: LandingPage,
});

const SERVICES = [
  {
    icon: FileText,
    title: "Document Printing",
    desc: "Black & white or color, single or double sided, any page range.",
  },
  {
    icon: Camera,
    title: "Passport Photos",
    desc: "Generate a perfectly cut 4×6\" sheet with 9 photos in minutes.",
  },
  { icon: Layers, title: "Lamination", desc: "ID cards, Aadhaar, PAN, certificates and A4 documents." },
  { icon: BookOpen, title: "Spiral Binding", desc: "Print + bind together, or bring your own pages." },
];

const STEPS = [
  { icon: Upload, title: "Upload files", desc: "Drag and drop PDFs, Word, PowerPoint or images." },
  { icon: Sliders, title: "Select options", desc: "Choose copies, color, binding and lamination." },
  { icon: Send, title: "Submit order", desc: "Review the price in ₹ and place your order." },
  { icon: PackageCheck, title: "Collect when ready", desc: "We notify you when your order is ready for pickup." },
];

function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:py-32">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Now serving across India
              </span>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Sora <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">Print Hub</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">
                Upload your files online and collect them when ready. Document printing,
                passport photos, lamination and spiral binding — all in one place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="shadow-soft">
                  <Link to="/app/orders/new"><Upload className="mr-2 h-4 w-4" /> Upload Documents</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/app/passport"><Camera className="mr-2 h-4 w-4" /> Create Passport Photos</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                B&W from ₹2/page · Color from ₹8/page · Lamination from ₹20
              </p>
            </div>

            {/* Hero preview card */}
            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary-glow/10 to-transparent blur-2xl" />
              <Card className="overflow-hidden shadow-soft">
                <div className="border-b border-border bg-muted/50 px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Order Preview · SPH-1042
                  </p>
                </div>
                <CardContent className="space-y-3 p-5">
                  {[
                    { l: "Final_Year_Report.pdf · 86 pages × 1", v: "₹172" },
                    { l: "Front cover (color)", v: "₹10" },
                    { l: "Spiral binding", v: "₹40" },
                    { l: "Lamination — certificate × 1", v: "₹50" },
                  ].map((row) => (
                    <div key={row.l} className="flex items-center justify-between text-sm">
                      <span className="min-w-0 truncate text-muted-foreground">{row.l}</span>
                      <span className="font-medium">{row.v}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">₹272</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="border-t border-border/60 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything your print shop offers</h2>
              <p className="mt-3 text-muted-foreground">
                One place for all your printing, photo and binding needs.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((s) => (
                <Card key={s.title} className="shadow-soft transition hover:-translate-y-0.5">
                  <CardContent className="space-y-3 p-6">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                      <s.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
              <p className="mt-3 text-muted-foreground">From upload to pickup in four simple steps.</p>
            </div>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <Card className="h-full">
                    <CardContent className="space-y-3 p-6">
                      <div className="flex items-center justify-between">
                        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground">
                          <s.icon className="h-5 w-5" />
                        </div>
                        <span className="text-3xl font-extrabold text-primary/15">0{i + 1}</span>
                      </div>
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="text-sm text-muted-foreground">{s.desc}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>

            <div className="mt-12 flex justify-center">
              <Button asChild size="lg">
                <Link to="/register">Create your free account <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
