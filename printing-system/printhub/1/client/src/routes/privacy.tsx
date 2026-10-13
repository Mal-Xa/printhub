import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicHeader } from "@/components/layout/PublicChrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Sora Print Hub" },
      { name: "description", content: "Privacy policy for Sora Print Hub users." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 23 June 2026</p>
        <div className="prose prose-sm mt-6 max-w-none text-muted-foreground dark:prose-invert">
          <p>
            Sora Print Hub respects your privacy. We only collect the data needed to fulfil your
            print orders — your name, contact details, and the files you upload. Files are deleted
            from our servers after your order is completed unless you explicitly save them to your
            account.
          </p>
          <h2 className="mt-6 text-base font-semibold text-foreground">What we collect</h2>
          <ul className="list-disc pl-5">
            <li>Account information: name, phone, email.</li>
            <li>Uploaded files for printing.</li>
            <li>Order history and preferences.</li>
          </ul>
          <h2 className="mt-6 text-base font-semibold text-foreground">How we use it</h2>
          <p>Only to process orders, notify you about pickup, and improve our service.</p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
