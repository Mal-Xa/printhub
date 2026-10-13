import { createFileRoute, Link } from "@tanstack/react-router";
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
import { authService } from "@/services/authService";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Sora Print Hub" },
      { name: "description", content: "Reset your Sora Print Hub password." },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().email("Enter a valid email") });

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <Card className="shadow-soft">
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a link to reset it.
              </p>
            </div>
            {sent ? (
              <div className="rounded-lg border border-success/40 bg-success/10 p-4 text-sm text-success-foreground">
                If an account exists, you'll receive a reset link shortly.
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(async (v) => {
                  await authService.forgotPassword(v.email);
                  setSent(true);
                  toast.success("Reset link sent");
                })}
                className="space-y-4"
                noValidate
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            )}
            <div className="text-center text-sm text-muted-foreground">
              Remembered it? <Link to="/login" className="font-medium text-primary hover:underline">Login</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
