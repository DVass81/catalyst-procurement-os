import type { DemoRole } from "@/demo/model";

export const qualificationTenantIds = [
  "org-y12-demo",
  "org-catalyst-community-demo",
] as const;

export type QualificationTenantId = (typeof qualificationTenantIds)[number];
export type QualificationPersona =
  | "requester"
  | "department_manager"
  | "it_reviewer"
  | "purchasing_specialist"
  | "purchasing_manager"
  | "receiving_clerk"
  | "accounts_payable"
  | "finance_reviewer"
  | "supplier_a"
  | "supplier_b"
  | "auditor"
  | "system_administrator";

export interface QualificationIdentityFixture {
  id: string;
  tenantId: QualificationTenantId;
  persona: QualificationPersona;
  role: DemoRole;
  emailEnvironmentKey: string;
  expectedEmail: string;
  assurance: "aal1" | "aal2";
  supplierId?: string;
  scopes: string[];
}

const personaRoles: Record<QualificationPersona, DemoRole> = {
  requester: "requester",
  department_manager: "department_manager",
  it_reviewer: "it_reviewer",
  purchasing_specialist: "purchasing_specialist",
  purchasing_manager: "purchasing_manager",
  receiving_clerk: "receiving_clerk",
  accounts_payable: "accounts_payable",
  finance_reviewer: "finance_reviewer",
  supplier_a: "supplier_user",
  supplier_b: "supplier_user",
  auditor: "auditor",
  system_administrator: "system_administrator",
};

const personas = Object.keys(personaRoles) as QualificationPersona[];

function environmentKey(
  tenantId: QualificationTenantId,
  persona: QualificationPersona,
) {
  const tenant = tenantId === "org-y12-demo" ? "Y12" : "COMMUNITY";
  return `FUNCTIONAL_TEST_${tenant}_${persona.toUpperCase()}_EMAIL`;
}

function expectedEmail(
  tenantId: QualificationTenantId,
  persona: QualificationPersona,
) {
  const tenant = tenantId === "org-y12-demo" ? "y12" : "community";
  return `catalyst-ft-${tenant}-${persona.replaceAll("_", "-")}@iccinternational.com`;
}

export const qualificationIdentityFixtures: QualificationIdentityFixture[] =
  qualificationTenantIds.flatMap((tenantId) =>
    personas.map((persona) => ({
      id: `${tenantId}:${persona}`,
      tenantId,
      persona,
      role: personaRoles[persona],
      emailEnvironmentKey: environmentKey(tenantId, persona),
      expectedEmail: expectedEmail(tenantId, persona),
      assurance: ([
        "purchasing_manager",
        "finance_reviewer",
        "system_administrator",
      ] as QualificationPersona[]).includes(persona)
        ? ("aal2" as const)
        : ("aal1" as const),
      supplierId:
        persona === "supplier_a"
          ? "vendor-001"
          : persona === "supplier_b"
            ? "vendor-003"
          : undefined,
      scopes:
        persona === "supplier_a" || persona === "supplier_b"
          ? [
              "supplier_profile:read",
              "supplier_profile:update",
              "supplier_evidence:submit",
              "supplier_response:submit",
              "supplier_po:acknowledge",
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
