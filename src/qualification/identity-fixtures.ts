import type { DemoRole } from "@/demo/model";

export const qualificationTenantIds = [
  "org-y12-demo",
  "org-catalyst-community-demo",
] as const;

export type QualificationTenantId = (typeof qualificationTenantIds)[number];
export type QualificationPersona =
  | "requester"
  | "approver"
  | "buyer"
  | "receiver"
  | "accounts_payable"
  | "supplier"
  | "auditor"
  | "administrator";

export interface QualificationIdentityFixture {
  id: string;
  tenantId: QualificationTenantId;
  persona: QualificationPersona;
  role: DemoRole;
  emailEnvironmentKey: string;
  assurance: "aal2";
  supplierId?: string;
  scopes: string[];
}

const personaRoles: Record<QualificationPersona, DemoRole> = {
  requester: "requester",
  approver: "department_manager",
  buyer: "purchasing_specialist",
  receiver: "receiving_clerk",
  accounts_payable: "accounts_payable",
  supplier: "supplier_user",
  auditor: "auditor",
  administrator: "system_administrator",
};

const personas = Object.keys(personaRoles) as QualificationPersona[];

function environmentKey(
  tenantId: QualificationTenantId,
  persona: QualificationPersona,
) {
  const tenant =
    tenantId === "org-y12-demo" ? "Y12" : "CATALYST_COMMUNITY";
  return `PILOT_QUAL_${tenant}_${persona.toUpperCase()}_EMAIL`;
}

export const qualificationIdentityFixtures: QualificationIdentityFixture[] =
  qualificationTenantIds.flatMap((tenantId) =>
    personas.map((persona) => ({
      id: `${tenantId}:${persona}`,
      tenantId,
      persona,
      role: personaRoles[persona],
      emailEnvironmentKey: environmentKey(tenantId, persona),
      assurance: "aal2" as const,
      supplierId:
        persona === "supplier"
          ? tenantId === "org-y12-demo"
            ? "vendor-001"
            : "vendor-021"
          : undefined,
      scopes:
        persona === "supplier"
          ? [
              "supplier_profile:read",
              "supplier_profile:update",
              "supplier_evidence:submit",
              "supplier_response:submit",
              "supplier_banking:submit",
            ]
          : ["tenant:authenticated"],
    })),
  );

export interface IdentityFixtureReadiness {
  ready: boolean;
  configuredCount: number;
  requiredCount: number;
  missingEnvironmentKeys: string[];
  invalidEnvironmentKeys: string[];
  duplicateEnvironmentKeys: string[];
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function evaluateIdentityFixtureConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): IdentityFixtureReadiness {
  const missingEnvironmentKeys: string[] = [];
  const invalidEnvironmentKeys: string[] = [];
  const duplicateEnvironmentKeys: string[] = [];
  const addresses = new Map<string, string>();

  for (const fixture of qualificationIdentityFixtures) {
    const raw = environment[fixture.emailEnvironmentKey]?.trim().toLowerCase();
    if (!raw) {
      missingEnvironmentKeys.push(fixture.emailEnvironmentKey);
      continue;
    }
    if (!emailPattern.test(raw)) {
      invalidEnvironmentKeys.push(fixture.emailEnvironmentKey);
      continue;
    }
    const existing = addresses.get(raw);
    if (existing) {
      duplicateEnvironmentKeys.push(existing, fixture.emailEnvironmentKey);
      continue;
    }
    addresses.set(raw, fixture.emailEnvironmentKey);
  }

  const uniqueDuplicateKeys = [...new Set(duplicateEnvironmentKeys)].sort();
  return {
    ready:
      missingEnvironmentKeys.length === 0 &&
      invalidEnvironmentKeys.length === 0 &&
      uniqueDuplicateKeys.length === 0,
    configuredCount: addresses.size,
    requiredCount: qualificationIdentityFixtures.length,
    missingEnvironmentKeys: missingEnvironmentKeys.sort(),
    invalidEnvironmentKeys: invalidEnvironmentKeys.sort(),
    duplicateEnvironmentKeys: uniqueDuplicateKeys,
  };
}
