import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { Logo } from "@/components/layout/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — Sora Print Hub" },
      { name: "description", content: "Create your free Sora Print Hub account." },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    phone: z.string().min(7, "Enter a valid phone number"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await signUp(values);
      toast.success("Account created — welcome!");
      navigate({ to: "/app" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <Card className="shadow-soft">
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">It only takes a minute.</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Field id="fullName" label="Full Name" error={errors.fullName?.message}>
                <Input id="fullName" autoComplete="name" {...register("fullName")} />
              </Field>
              <Field id="phone" label="Phone Number" error={errors.phone?.message}>
                <Input id="phone" type="tel" autoComplete="tel" placeholder="+91" {...register("phone")} />
              </Field>
              <Field id="email" label="Email" error={errors.email?.message}>
                <Input id="email" type="email" autoComplete="email" {...register("email")} />
              </Field>
              <Field id="password" label="Password" error={errors.password?.message}>
                <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
              </Field>
              <Field id="confirmPassword" label="Confirm Password" error={errors.confirmPassword?.message}>
                <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
              </Field>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating…" : "Create account"}
              </Button>
            </form>
            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">Login</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
