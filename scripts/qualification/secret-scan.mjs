import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);

const forbiddenNames = trackedFiles.filter(
  (file) =>
    /(^|\/)\.env(\.|$)/i.test(file) &&
    !/(^|\/)\.env\.example$/i.test(file),
);
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["OpenAI secret", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["GitHub token", /\bgh[opusr]_[A-Za-z0-9_]{30,}\b/],
  [
    "credentialed PostgreSQL URL",
    /\bpostgres(?:ql)?:\/\/[^:\s/]+:[^@\s/]+@[^/\s]+/i,
  ],
];
const findings = forbiddenNames.map((file) => ({
  file,
  kind: "environment file",
}));

for (const file of trackedFiles) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [kind, pattern] of patterns) {
    if (pattern.test(content)) findings.push({ file, kind });
  }
}

if (findings.length > 0) {
  process.stderr.write(
    `${JSON.stringify(
      {
        status: "failed",
        findingCount: findings.length,
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
      scannedCandidateFiles: trackedFiles.length,
      findingCount: 0,
    })}\n`,
  );
}
