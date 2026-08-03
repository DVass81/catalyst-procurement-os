import { readFileSync } from "node:fs";
import { join } from "node:path";

const templates = [
  {
    name: "functional-test.yaml",
    sourceDeployment: true,
    required: [
      "name: catalyst-functional-test",
      "branch: codex/audit-recovery-87",
      "deploy_on_push: true",
      "instance_count: 1",
      "value: functional_test",
      "value: functional-test",
      "key: CATALYST_SYNTHETIC_ONLY\n        value: \"1\"",
      "key: CATALYST_PRESENTER_SIMULATION\n        value: \"0\"",
      "key: CATALYST_RESET_ENABLED\n        value: \"1\"",
      "key: CATALYST_MFA_REQUIRED\n        value: \"1\"",
      "key: CATALYST_AUTH_LINK_MODE\n        value: scanner-resistant",
      "key: CATALYST_EMAIL_PROVIDER\n        value: resend",
      "key: RESEND_API_KEY",
      "key: NOTIFICATION_WORKER_SECRET",
      "value: august-2-regression-87-v1",
      "value: august-2-six-workflow-v1",
    ],
  },
  {
    name: "sales-demo.yaml",
    required: [
      "name: catalyst-sales-demo",
      "value: sales_demo",
      "value: sales-demo",
      "key: CATALYST_SYNTHETIC_ONLY\n        value: \"1\"",
      "key: CATALYST_RESET_ENABLED\n        value: \"1\"",
    ],
  },
  {
    name: "secure-pilot.yaml",
    required: [
      "name: catalyst-secure-pilot",
      "value: secure_pilot",
      "value: secure-pilot",
      "key: CATALYST_SYNTHETIC_ONLY\n        value: \"0\"",
      "key: CATALYST_PRESENTER_SIMULATION\n        value: \"0\"",
      "key: CATALYST_RESET_ENABLED\n        value: \"0\"",
      "key: CATALYST_SSO_ENABLED\n        value: \"1\"",
    ],
  },
];

for (const template of templates) {
  const source = readFileSync(
    join(".do", "templates", template.name),
    "utf8",
  ).replaceAll("\r\n", "\n");
  const common = [
    "key: DEMO_AUTH_BYPASS\n        value: \"0\"",
    "key: SUPABASE_URL",
    "key: SUPABASE_PUBLISHABLE_KEY",
    "key: SUPABASE_SECRET_KEY",
  ];
  const deploymentControls = template.sourceDeployment
    ? [
        "github:",
        "repo: DVass81/catalyst-procurement-os",
        "key: CATALYST_RELEASE_COMMIT\n        value: ${_self.COMMIT_HASH}",
      ]
    : [
        "registry_type: DOCR",
        "repository: catalyst-procurement-os",
        "digest: __QUALIFIED_IMAGE_DIGEST__",
        "instance_count: 2",
        "key: CATALYST_RELEASE_COMMIT\n        value: __QUALIFIED_GIT_COMMIT__",
      ];
  for (const required of [...common, ...deploymentControls, ...template.required]) {
    if (!source.includes(required)) {
      throw new Error(
        `${template.name} is missing the fixed deployment control: ${required}`,
      );
    }
  }
  for (const prohibited of template.sourceDeployment ? [
    "NEXT_PUBLIC_",
    "BUILD_TIME",
    "RUN_AND_BUILD_TIME",
  ] : [
    "NEXT_PUBLIC_",
    "deploy_on_push",
    "branch:",
    "github:",
    "BUILD_TIME",
    "RUN_AND_BUILD_TIME",
  ]) {
    if (source.includes(prohibited)) {
      throw new Error(
        `${template.name} contains prohibited same-image content: ${prohibited}`,
      );
    }
  }
}

process.stdout.write(
  `${JSON.stringify({
    status: "passed",
    templateCount: templates.length,
    sameImagePromotion: true,
    runtimeOnlyConfiguration: true,
    sourceQualificationInstanceCount: 1,
    promotedReleaseInstanceCount: 2,
  })}\n`,
);
