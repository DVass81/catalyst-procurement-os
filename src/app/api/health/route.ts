export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "catalyst-procurement-os",
      phase: 3,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
