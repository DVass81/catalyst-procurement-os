import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
          <Compass className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-primary)]">
          404 · Workspace route
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--foreground)]">
          This view is not in the demo.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
          Return to the executive dashboard to continue exploring Catalyst
          Procurement OS.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </main>
  );
}
