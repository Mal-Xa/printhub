import { createFileRoute } from "@tanstack/react-router";
import { PublicFooter, PublicHeader } from "@/components/layout/PublicChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Sora Print Hub" },
      { name: "description", content: "Learn about Sora Print Hub — your online print shop for documents, photos, lamination and binding." },
      { property: "og:title", content: "About Sora Print Hub" },
      { property: "og:description", content: "About Sora Print Hub — students and professionals print faster." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Sora Print Hub</h1>
        <p className="mt-4 text-muted-foreground">
          Sora Print Hub is a modern online print-shop management platform built for the Indian market.
          Upload your documents, configure printing options, and collect your prints when ready — no
          more queues, no more confusion at the counter.
        </p>
        <h2 className="mt-10 text-xl font-semibold">Our mission</h2>
        <p className="mt-2 text-muted-foreground">
          Help students, professionals and small businesses get printing done in minutes — not hours.
          From a single PDF to bulk project reports with spiral binding, we make it effortless.
        </p>
        <h2 className="mt-10 text-xl font-semibold">What we offer</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Document printing in B&W and color</li>
          <li>Passport, visa and ID photo sheets</li>
          <li>Lamination for documents and cards</li>
          <li>Spiral binding (with or without printing)</li>
        </ul>
      </main>
      <PublicFooter />
    </div>
  );
}
