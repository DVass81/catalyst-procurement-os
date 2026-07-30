import { readFileSync } from "node:fs";
import { join } from "node:path";

const templates = [
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
    "registry_type: DOCR",
    "repository: catalyst-procurement-os",
    "digest: __QUALIFIED_IMAGE_DIGEST__",
    "instance_count: 2",
    "key: DEMO_AUTH_BYPASS\n        value: \"0\"",
    "key: CATALYST_RELEASE_COMMIT\n        value: __QUALIFIED_GIT_COMMIT__",
    "key: SUPABASE_URL",
    "key: SUPABASE_PUBLISHABLE_KEY",
    "key: SUPABASE_SECRET_KEY",
  ];
  for (const required of [...common, ...template.required]) {
    if (!source.includes(required)) {
      throw new Error(
        `${template.name} is missing the fixed deployment control: ${required}`,
      );
    }
  }
  for (const prohibited of [
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
    instanceCount: 2,
  })}\n`,
);
