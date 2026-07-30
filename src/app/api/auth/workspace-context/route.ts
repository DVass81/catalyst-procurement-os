import { NextResponse } from "next/server";

import { assessRuntimeEnvironment } from "@/config/runtime-environment";
import { activeRoleAssignments } from "@/server/auth/authority";
import { getAppSession } from "@/server/auth/session";

const noStore = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json(
      { message: "Authentication is required." },
      { status: 401, headers: noStore },
    );
  }
  const tenants = session.tenantIds.map((tenantId) => ({
    tenantId,
    roles: activeRoleAssignments(
      session.authorities[tenantId]?.roles ?? [],
    )
      .filter(
        (assignment) =>
          assignment.assignmentType !== "presenter_simulation",
      )
      .map((assignment) => assignment.role),
  }));
  const environment = assessRuntimeEnvironment();
  return NextResponse.json(
    {
      tenantIds: session.tenantIds,
      defaultTenantId: session.tenantIds[0] ?? null,
      tenants,
      presenter: session.presenter,
      securityAssurance: {
        assuranceLevel: session.assuranceLevel,
        phishingResistant: session.phishingResistant,
        identityProvider: session.identityProvider ?? null,
      },
      environmentKind: environment.kind,
      dataClassification: environment.syntheticOnly
        ? "synthetic_demo"
        : environment.kind === "secure_pilot"
          ? "approved_pilot_procurement"
          : "unavailable",
    },
    { headers: noStore },
  );
}
