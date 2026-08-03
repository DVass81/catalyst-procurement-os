import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name, pattern) {
  const value = option(name);
  if (!value || !pattern.test(value)) {
    throw new Error(`A valid --${name} value is required.`);
  }
  return value;
}

const replacements = new Map([
  [
    "__QUALIFIED_IMAGE_DIGEST__",
    required("digest", /^sha256:[0-9a-f]{64}$/),
  ],
  ["__QUALIFIED_GIT_COMMIT__", required("commit", /^[0-9a-f]{40}$/)],
  [
    "__MIGRATION_LEDGER_SHA256__",
    required("migration-ledger-sha256", /^[0-9a-f]{64}$/),
  ],
  [
    "__ENVIRONMENT_FINGERPRINT_SHA256__",
    required("environment-fingerprint-sha256", /^[0-9a-f]{64}$/),
  ],
  [
    "__APPROVED_CONFIGURATION_SHA256__",
    required("approved-configuration-sha256", /^[0-9a-f]{64}$/),
  ],
]);

const outputDirectory = join("outputs", "qualification", "deployment-specs");
mkdirSync(outputDirectory, { recursive: true });
const rendered = ["sales-demo.yaml", "secure-pilot.yaml"].map((name) => {
  let source = readFileSync(join(".do", "templates", name), "utf8");
  for (const [token, value] of replacements) {
    source = source.replaceAll(token, value);
  }
  if (/__[A-Z0-9_]+__/.test(source)) {
    throw new Error(`Unresolved deployment token remains in ${name}.`);
  }
  const outputPath = join(outputDirectory, name);
  writeFileSync(outputPath, source, "utf8");
  return {
    path: outputPath.replaceAll("\\", "/"),
    sha256: createHash("sha256").update(source).digest("hex"),
  };
});

const evidencePath = join(outputDirectory, "deployment-spec-evidence.json");
writeFileSync(
  evidencePath,
  `${JSON.stringify(
    {
      schema: "catalyst.deployment-spec-evidence.v1",
      createdAt: new Date().toISOString(),
      imageDigest: replacements.get("__QUALIFIED_IMAGE_DIGEST__"),
      sourceCommit: replacements.get("__QUALIFIED_GIT_COMMIT__"),
      rendered,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
process.stdout.write(`${evidencePath}\n`);
