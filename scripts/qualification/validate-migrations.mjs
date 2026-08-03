import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const migrationDirectory = join("supabase", "migrations");
const candidateMinimumVersion = "20260729200000";
const allNames = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const invalidNames = allNames.filter(
  (name) => !/^\d{12}(?:\d{2})?_[a-z0-9_]+\.sql$/.test(name),
);
const duplicateVersions = allNames
  .map((name) => name.slice(0, 14))
  .filter((version, index, versions) => versions.indexOf(version) !== index);
const candidateNames = allNames.filter(
  (name) => name.slice(0, 14) >= candidateMinimumVersion,
);
const findings = [];

if (invalidNames.length > 0) {
  findings.push(`Invalid migration filenames: ${invalidNames.join(", ")}`);
}
if (duplicateVersions.length > 0) {
  findings.push(
    `Duplicate migration versions: ${[...new Set(duplicateVersions)].join(", ")}`,
  );
}
if (candidateNames.length === 0) {
  findings.push("No pilot-readiness candidate migrations were found.");
}

for (const name of candidateNames) {
  const source = readFileSync(join(migrationDirectory, name), "utf8");
  const normalized = source.trim();
  if (!/^begin\s*;/i.test(normalized)) {
    findings.push(`${name}: migration must begin with an explicit transaction`);
  }
  if (!/commit\s*;$/i.test(normalized)) {
    findings.push(`${name}: migration must end with an explicit commit`);
  }
  for (const [label, pattern] of [
    ["DROP TABLE", /\bdrop\s+table\b/i],
    ["TRUNCATE", /\btruncate\b/i],
    ["DROP COLUMN", /\bdrop\s+column\b/i],
    [
      "authenticated all-privileges grant",
      /\bgrant\s+all\s+on\b[^;]+\bto\s+(?:anon|authenticated)\s*;/i,
    ],
  ]) {
    if (pattern.test(source)) findings.push(`${name}: prohibited ${label}`);
  }

  const functionBlocks =
    source.match(
      /create\s+or\s+replace\s+function[\s\S]*?\$\$[\s\S]*?\$\$\s*;/gi,
    ) ?? [];
  for (const block of functionBlocks) {
    if (!/\bsecurity\s+definer\b/i.test(block)) continue;
    const functionName = block.match(
      /create\s+or\s+replace\s+function\s+([a-z0-9_.]+)/i,
    )?.[1];
    if (!/\bset\s+search_path\s*=\s*''/i.test(block)) {
      findings.push(
        `${name}: SECURITY DEFINER ${functionName ?? "function"} must set an empty search_path`,
      );
    }
    if (
      functionName?.startsWith("private.") &&
      !new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+${functionName.replace(".", "\\.")}`,
        "i",
      ).test(source)
    ) {
      findings.push(
        `${name}: ${functionName} must be revoked from public callers`,
      );
    }
  }

  const publicTables = [
    ...source.matchAll(
      /create\s+table\s+if\s+not\s+exists\s+public\.([a-z0-9_]+)/gi,
    ),
  ].map((match) => match[1]);
  for (const table of publicTables) {
    const rlsPattern = new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    );
    if (!rlsPattern.test(source)) {
      findings.push(`${name}: public.${table} must enable RLS in the same migration`);
    }
  }
}

if (findings.length > 0) {
  process.stderr.write(
    `${JSON.stringify(
      {
        status: "failed",
        candidateMigrationCount: candidateNames.length,
        findings,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify({
      status: "passed",
      migrationCount: allNames.length,
      candidateMigrationCount: candidateNames.length,
      candidateMigrations: candidateNames,
      note:
        "Static validation passed. Isolated Supabase branch application remains mandatory.",
    })}\n`,
  );
}
