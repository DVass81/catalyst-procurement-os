import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmSignInScreen } from "@/components/auth/confirm-sign-in-screen";

export const metadata: Metadata = {
  title: "Confirm secure access",
};

export const dynamic = "force-dynamic";

function safeNextPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/dashboard";
}

export default async function ConfirmSignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string | string[];
    type?: string | string[];
    next?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const tokenHash = Array.isArray(params.token_hash)
    ? params.token_hash[0]
    : params.token_hash;
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  const validToken =
    type === "email" &&
    typeof tokenHash === "string" &&
    tokenHash.length >= 16 &&
    tokenHash.length <= 512 &&
    /^[A-Za-z0-9._~-]+$/.test(tokenHash);

  if (!validToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5">
        <section className="max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-elevated)]">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Secure link unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
            This link is incomplete. Return to Catalyst and request a fresh
            sign-in email.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-5 text-sm font-bold text-white"
          >
            Return to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <ConfirmSignInScreen
      tokenHash={tokenHash}
      next={safeNextPath(params.next)}
    />
  );
}
