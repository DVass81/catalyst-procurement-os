import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const outputDirectory = join("outputs", "qualification");
const sbomPath = join(outputDirectory, "sbom.cdx.json");
const evidencePath = join(outputDirectory, "candidate-source-evidence.json");

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

const status = git("status", "--porcelain=v1", "--untracked-files=all");
if (status) {
  throw new Error(
    "Candidate evidence requires a clean committed worktree. Commit or remove every intended change first.",
  );
}

const branch = git("branch", "--show-current");
if (
  branch !== "codex/pilot-readiness-95" &&
  branch !== "codex/audit-recovery-87" &&
  branch !== "main"
) {
  throw new Error(`Candidate evidence is not allowed from branch ${branch}.`);
}

const commit = git("rev-parse", "HEAD");
if (!/^[0-9a-f]{40}$/.test(commit)) {
  throw new Error("The source commit is not a full Git commit identifier.");
}

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean)
  .sort();
const treeEntries = trackedFiles.map((path) => ({
  path,
  sha256: fileSha256(path),
  bytes: statSync(path).size,
}));
const treeSha256 = sha256(
  treeEntries
    .map((entry) => `${entry.path}\0${entry.sha256}\0${entry.bytes}`)
    .join("\n"),
);

const migrations = readdirSync(join("supabase", "migrations"))
  .filter((name) => /^\d{12}(?:\d{2})?_[a-z0-9_]+\.sql$/.test(name))
  .sort()
  .map((name) => ({
    name: basename(name, ".sql"),
    sha256: fileSha256(join("supabase", "migrations", name)),
  }));
const migrationSourceSha256 = sha256(
  migrations
    .map((migration) => `${migration.name}\0${migration.sha256}`)
    .join("\n"),
);

mkdirSync(outputDirectory, { recursive: true });
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const sbom = execFileSync(
  npmCommand,
  ["sbom", "--package-lock-only", "--omit=dev", "--sbom-format", "cyclonedx"],
  {
    encoding: "utf8",
    shell: process.platform === "win32",
  },
);
writeFileSync(sbomPath, sbom, "utf8");

const recovery87 = branch === "codex/audit-recovery-87";
const evidence = {
  schema: "catalyst.candidate-source-evidence.v1",
  createdAt: new Date().toISOString(),
  source: {
    branch,
    commit,
    treeSha256,
    fileCount: treeEntries.length,
  },
  dependencies: {
    lockfileSha256: fileSha256("package-lock.json"),
    sbomPath: sbomPath.replaceAll("\\", "/"),
    sbomSha256: fileSha256(sbomPath),
  },
  database: {
    migrationCount: migrations.length,
    migrationSourceSha256,
    migrations,
    deployedMigrationLedgerSha256: null,
  },
  qualification: {
    rubricVersion: recovery87
      ? "august-2-regression-87-v1"
      : "p95-pilot-readiness-v1",
    datasetVersion: recovery87
      ? "august-2-six-workflow-v1"
      : "p95-synthetic-qualification-v1",
    independentEvidenceIncluded: false,
    releaseQualified: false,
  },
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
process.stdout.write(`${evidencePath}\n`);
