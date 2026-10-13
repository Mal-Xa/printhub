import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/layout/PublicChrome";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Sora Print Hub" },
      { name: "description", content: "Get in touch with the Sora Print Hub team." },
      { property: "og:title", content: "Contact Sora Print Hub" },
      { property: "og:description", content: "Reach out by phone, email or visit our shop." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const items = [
    { icon: Phone, label: "Phone", value: "+91 60335 41297" },
    { icon: Mail, label: "Email", value: "soratechtip@gmail.com" },
    { icon: MapPin, label: "Address", value: "NIELIT Boys' Hostel, Zuangtui, Aizawl, Mizoram 796017" },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact us</h1>
        <p className="mt-3 text-muted-foreground">We're here to help with orders, pricing and pickup.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {items.map((i) => (
            <Card key={i.label}>
              <CardContent className="space-y-2 p-5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <i.icon className="h-5 w-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{i.label}</p>
                <p className="font-medium">{i.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
