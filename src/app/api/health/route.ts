import { resolveDevelopmentBypass } from "@/server/auth/development-bypass";

export const dynamic = "force-dynamic";

export function GET() {
  const releaseChannel =
    process.env.CATALYST_RELEASE_CHANNEL ?? "audit-phase-2";
  const syntheticOnly = process.env.CATALYST_SYNTHETIC_ONLY === "1";
  const bypass = resolveDevelopmentBypass();

  return Response.json(
    {
      status: "ok",
      service: "catalyst-procurement-os",
      releaseProgram: releaseChannel,
      releaseChannel,
      releaseCommit: process.env.CATALYST_RELEASE_COMMIT ?? "unknown",
      dataClassification: syntheticOnly ? "synthetic-only" : "unspecified",
      accessMode: bypass.active
        ? "staging-bypass"
        : "invite-magic-link",
      bypassStatus: bypass.status,
      bypassExpiresAt: bypass.expiresAt,
      capabilities: {
        authoritativeWorkflow:
          Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
          Boolean(process.env.SUPABASE_SECRET_KEY),
        cate:
          process.env.OPENAI_API_KEY
            ? "live-with-deterministic-fallback"
            : "deterministic-fallback",
        documentScanning: "simulated",
        transactionalEmail: "simulated",
        paymentExecution: "not-implemented",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
