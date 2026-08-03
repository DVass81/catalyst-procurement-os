"use client";

import { ArrowRight, MailCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { readApiJson } from "@/lib/http/api-json";

export function ConfirmSignInScreen({
  tokenHash,
  next,
}: {
  tokenHash: string;
  next: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    "Your email link is ready. Continue only if you requested access to Catalyst.",
  );

  async function confirm() {
    setPending(true);
    try {
      const response = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tokenHash, type: "email", next }),
      });
      const result = await readApiJson<{ redirectTo: string; message: string }>(
        response,
        "This secure sign-in link could not be confirmed.",
      );
      window.location.assign(result.redirectTo);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This link is invalid, expired, or has already been used. Request a new link.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)] sm:p-8">
        <BrandMark />
        <div className="mt-8 flex items-start gap-4">
          <span className="rounded-2xl bg-[var(--brand-soft)] p-3 text-[var(--brand-primary)]">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
              Confirm your sign-in
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Catalyst has not used this one-time link yet. This confirmation
              protects your access when an email security scanner previews the
              message before you open it.
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--muted-foreground)]"
        >
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          {message}
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-6 w-full"
          disabled={pending}
          onClick={() => void confirm()}
        >
          {pending ? "Confirming secure access..." : "Continue to Catalyst"}
          {!pending ? <ArrowRight className="size-4" /> : null}
        </Button>

        <p className="mt-5 text-center text-xs leading-5 text-[var(--muted-foreground)]">
          If you did not request this email, close this page. No Catalyst
          session will be created.
        </p>
      </section>
    </main>
  );
}
