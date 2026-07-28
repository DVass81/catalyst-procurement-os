export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "catalyst-procurement-os",
      releaseProgram: "audit-phase-2",
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
