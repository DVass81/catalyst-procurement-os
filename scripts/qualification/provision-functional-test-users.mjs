import { createClient } from "@supabase/supabase-js";
import { URL } from "node:url";

const tenantDefinitions = [
  { key: "y12", id: "org-y12-demo" },
  { key: "community", id: "org-catalyst-community-demo" },
];

const personaDefinitions = [
  ["requester", "requester"],
  ["department-manager", "department_manager"],
  ["it-reviewer", "it_reviewer"],
  ["purchasing-specialist", "purchasing_specialist"],
  ["purchasing-manager", "purchasing_manager"],
  ["receiving-clerk", "receiving_clerk"],
  ["accounts-payable", "accounts_payable"],
  ["finance-reviewer", "finance_reviewer"],
  ["supplier-a", "supplier_user"],
  ["supplier-b", "supplier_user"],
  ["auditor", "auditor"],
  ["system-administrator", "system_administrator"],
];

const identities = tenantDefinitions.flatMap((tenant) =>
  personaDefinitions.map(([persona, role]) => ({
    tenantId: tenant.id,
    persona,
    role,
    email: `catalyst-ft-${tenant.key}-${persona}@iccinternational.com`,
    displayName: `${tenant.key === "y12" ? "Y-12" : "Community"} ${persona
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(" ")} Tester`,
    supplier:
      persona === "supplier-a"
        ? {
            id: "vendor-001",
            organizationId: "supplier-org-volunteer",
          }
        : persona === "supplier-b"
          ? {
              id: "vendor-003",
              organizationId: "supplier-org-blue-ridge",
            }
          : null,
  })),
);

function requiredEnvironment(key) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

if (process.env.CATALYST_ENVIRONMENT_KIND !== "functional_test") {
  throw new Error(
    "Refusing to provision identities outside CATALYST_ENVIRONMENT_KIND=functional_test.",
  );
}
if (process.env.FUNCTIONAL_TEST_CONFIRM_PROVISION !== "1") {
  throw new Error(
    "Set FUNCTIONAL_TEST_CONFIRM_PROVISION=1 after verifying the isolated project reference.",
  );
}

const url = requiredEnvironment("SUPABASE_URL");
const secret = requiredEnvironment("SUPABASE_SECRET_KEY");
const expectedProjectReference = requiredEnvironment(
  "FUNCTIONAL_TEST_SUPABASE_PROJECT_REF",
);
if (new URL(url).hostname.split(".")[0] !== expectedProjectReference) {
  throw new Error("The Supabase URL does not match the approved project reference.");
}

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw listed.error;
const byEmail = new Map(
  listed.data.users.map((user) => [user.email?.toLowerCase(), user]),
);

const results = [];
for (const identity of identities) {
  let user = byEmail.get(identity.email);
  const appMetadata = {
    tenant_ids: [identity.tenantId],
    role: "viewer",
    presenter: false,
    functional_test_persona: identity.persona,
  };
  if (!user) {
    const created = await supabase.auth.admin.createUser({
      email: identity.email,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: { display_name: identity.displayName },
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error(`Could not create ${identity.email}.`);
    }
    user = created.data.user;
    byEmail.set(identity.email, user);
  } else {
    const updated = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: { display_name: identity.displayName },
    });
    if (updated.error) throw updated.error;
  }

  const profile = await supabase.from("user_profiles").upsert(
    { user_id: user.id, display_name: identity.displayName },
    { onConflict: "user_id" },
  );
  if (profile.error) throw profile.error;

  const tenant = await supabase.from("tenant_assignments").upsert(
    { user_id: user.id, tenant_id: identity.tenantId, role: "viewer" },
    { onConflict: "user_id,tenant_id" },
  );
  if (tenant.error) throw tenant.error;

  const role = await supabase.from("tenant_role_assignments").upsert(
    {
      tenant_id: identity.tenantId,
      user_id: user.id,
      role: identity.role,
      assignment_type: "direct",
      department_ids: identity.supplier ? [] : ["dept-lending"],
      location_ids: identity.supplier ? [] : ["loc-riverstone"],
      category_ids: [],
      workflow_owner_ids: [],
      approval_limit_cents: [
        "department_manager",
        "purchasing_manager",
        "finance_reviewer",
      ].includes(identity.role)
        ? 10_000_000
        : null,
      last_reviewed_at: new Date().toISOString(),
      suspended_at: null,
      suspended_reason: null,
    },
    { onConflict: "tenant_id,user_id,role" },
  );
  if (role.error) throw role.error;

  if (identity.supplier) {
    const supplier = await supabase.from("supplier_identity_assignments").upsert(
      {
        tenant_id: identity.tenantId,
        user_id: user.id,
        supplier_organization_id: identity.supplier.organizationId,
        supplier_id: identity.supplier.id,
        status: "active",
        scopes: [
          "supplier_profile:read",
          "supplier_profile:update",
          "supplier_evidence:submit",
          "supplier_response:submit",
          "supplier_po:acknowledge",
          "supplier_banking:submit",
        ],
        accepted_at: new Date().toISOString(),
        suspended_at: null,
        suspension_reason: null,
        last_reviewed_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,user_id,supplier_organization_id" },
    );
    if (supplier.error) throw supplier.error;
  }

  const assignments = await supabase
    .from("tenant_role_assignments")
    .select("tenant_id,role,assignment_type,suspended_at")
    .eq("user_id", user.id)
    .is("suspended_at", null);
  if (assignments.error) throw assignments.error;
  if (
    assignments.data.length !== 1 ||
    assignments.data[0]?.tenant_id !== identity.tenantId ||
    assignments.data[0]?.role !== identity.role ||
    assignments.data[0]?.assignment_type !== "direct"
  ) {
    throw new Error(
      `${identity.email} does not have exactly one direct functional-test role.`,
    );
  }
  results.push({ email: identity.email, tenantId: identity.tenantId, role: identity.role });
}

process.stdout.write(
  `${JSON.stringify(
    {
      status: "provisioned",
      projectReference: expectedProjectReference,
      identityCount: results.length,
      tenantCounts: Object.fromEntries(
        tenantDefinitions.map((tenant) => [
          tenant.id,
          results.filter((result) => result.tenantId === tenant.id).length,
        ]),
      ),
      note:
        "Authentication users and authoritative fixed-role assignments are ready. Mailbox existence and link delivery must still be verified externally.",
    },
    null,
    2,
  )}\n`,
);
