import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicHeader } from "@/components/layout/PublicChrome";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Sora Print Hub" },
      { name: "description", content: "Terms of service for using Sora Print Hub." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 23 June 2026</p>
        <div className="prose prose-sm mt-6 max-w-none text-muted-foreground dark:prose-invert">
          <p>
            By using Sora Print Hub you agree to provide accurate information when placing orders and
            to collect your prints within 7 days of the ready notification. Orders not collected
            within 30 days may be recycled.
          </p>
          <h2 className="mt-6 text-base font-semibold text-foreground">Acceptable use</h2>
          <p>You must own the rights to any content you upload. Illegal or copyrighted material may be rejected.</p>
          <h2 className="mt-6 text-base font-semibold text-foreground">Pricing</h2>
          <p>All prices are in Indian Rupees (₹) and inclusive of applicable taxes.</p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
