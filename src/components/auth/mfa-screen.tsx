"use client";

import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Factor = {
  id: string;
  friendlyName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type MfaStatus = {
  assuranceLevel: string;
  nextAssuranceLevel: string;
  factors: Factor[];
  protectedActionReady: boolean;
};

export function MfaScreen({
  initialAssuranceLevel,
}: {
  initialAssuranceLevel: string;
}) {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [factorId, setFactorId] = useState<string>();
  const [qrCode, setQrCode] = useState<string>();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(
    "Loading your multi-factor security status.",
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/mfa", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as MfaStatus & {
          message?: string;
        };
        if (!response.ok) throw new Error(result.message);
        if (!active) return;
        setStatus(result);
        const verifiedFactor = result.factors.find(
          (factor) => factor.status === "verified",
        );
        if (verifiedFactor) setFactorId(verifiedFactor.id);
        setMessage(
          result.protectedActionReady
            ? "This session has AAL2 multi-factor assurance."
            : verifiedFactor
              ? "Enter the six-digit code from your authenticator app to step up this session."
              : "Enroll an authenticator app before protected pilot actions are enabled.",
        );
      })
      .catch(() => {
        if (active) {
          setMessage("Multi-factor status could not be loaded. Try again.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function send(body: Record<string, string>) {
    setPending(true);
    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        factorId?: string;
        qrCode?: string;
        assuranceLevel?: string;
        message?: string;
      };
      if (!response.ok) {
        setMessage(result.message ?? "Multi-factor action failed.");
        return;
      }
      if (result.factorId) setFactorId(result.factorId);
      if (result.qrCode) setQrCode(result.qrCode);
      setMessage(result.message ?? "Multi-factor security was updated.");
      if (result.assuranceLevel === "aal2") {
        window.location.assign("/dashboard");
      }
    } catch {
      setMessage("Multi-factor security could not be reached. Try again.");
    } finally {
      setPending(false);
    }
  }

  const ready =
    status?.protectedActionReady || initialAssuranceLevel === "aal2";
  const verifiedFactor = status?.factors.some(
    (factor) => factor.status === "verified",
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-elevated)] sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <Badge tone={ready ? "success" : "warning"}>
            {ready ? "AAL2 verified" : "Step-up required"}
          </Badge>
        </div>

        <div className="mt-8 flex items-start gap-4">
          <span className="rounded-2xl bg-[var(--brand-soft)] p-3 text-[var(--brand-primary)]">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-[var(--foreground)]">
              Protect sensitive decisions
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              A second factor is required for protected pilot actions. The
              synthetic presenter demonstration remains explicitly simulated.
            </p>
          </div>
        </div>

        <div
          role="status"
          className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--muted-foreground)]"
        >
          {message}
        </div>

        {ready ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
            <CheckCircle2
              className="size-5 text-emerald-600"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Protected actions are available for this verified session.
            </p>
          </div>
        ) : null}

        {!ready && !verifiedFactor && !qrCode ? (
          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            disabled={pending || status === null}
            onClick={() => void send({ action: "enroll" })}
          >
            <KeyRound className="size-4" />
            Set up authenticator
          </Button>
        ) : null}

        {qrCode ? (
          <div className="mt-6 rounded-2xl border border-[var(--border)] p-5 text-center">
            <Image
              src={qrCode}
              alt="Authenticator enrollment QR code"
              width={240}
              height={240}
              unoptimized
              className="mx-auto size-60 rounded-xl bg-white p-2"
            />
            <p className="mt-4 text-xs leading-5 text-[var(--muted-foreground)]">
              Scan this one-time enrollment code with an authenticator app. Do
              not share or save it in screenshots.
            </p>
          </div>
        ) : null}

        {!ready && factorId ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send({ action: "verify", factorId, code });
            }}
          >
            <label
              htmlFor="mfa-code"
              className="block text-xs font-bold text-[var(--foreground)]"
            >
              Six-digit authenticator code
            </label>
            <input
              id="mfa-code"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              required
              className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-center text-lg font-bold tracking-[0.35em] text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending || code.length !== 6}
            >
              Verify and continue
            </Button>
          </form>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="mt-4 w-full"
          onClick={() => window.location.assign("/dashboard")}
        >
          Return to dashboard
        </Button>
      </section>
    </main>
  );
}
