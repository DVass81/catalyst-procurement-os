export const targetBrowsers = [
  "chrome",
  "edge",
  "firefox",
  "safari",
] as const;
export const targetDevices = ["desktop", "tablet", "mobile"] as const;
export const assistiveModes = [
  "keyboard",
  "screen_reader",
  "zoom_200",
  "contrast",
  "reduced_motion",
] as const;

export type TargetBrowser = (typeof targetBrowsers)[number];
export type TargetDevice = (typeof targetDevices)[number];
export type AssistiveMode = (typeof assistiveModes)[number];

export interface AccessibilityEvidence {
  browser: TargetBrowser;
  device: TargetDevice;
  mode: "standard" | AssistiveMode;
  result: "not_run" | "failed" | "passed";
  criticalViolations: number;
  seriousViolations: number;
  artifactId?: string;
  testedCommit?: string;
}

export interface AccessibilityEvidenceDecision {
  passed: boolean;
  requiredCount: number;
  passedCount: number;
  blockers: string[];
}

function key(
  evidence: Pick<AccessibilityEvidence, "browser" | "device" | "mode">,
) {
  return `${evidence.browser}:${evidence.device}:${evidence.mode}`;
}

export const requiredAccessibilityMatrix = [
  ...targetBrowsers.flatMap((browser) =>
    targetDevices.map((device) => ({
      browser,
      device,
      mode: "standard" as const,
    })),
  ),
  ...targetBrowsers.flatMap((browser) =>
    (["keyboard", "screen_reader"] as const).map((mode) => ({
      browser,
      device: "desktop" as const,
      mode,
    })),
  ),
  ...targetDevices.flatMap((device) =>
    (["zoom_200", "contrast", "reduced_motion"] as const).map((mode) => ({
      browser: "chrome" as const,
      device,
      mode,
    })),
  ),
] as const;

export function evaluateAccessibilityEvidence(
  evidence: readonly AccessibilityEvidence[],
): AccessibilityEvidenceDecision {
  const required = new Set(requiredAccessibilityMatrix.map(key));
  const byKey = new Map<string, AccessibilityEvidence>();
  const blockers: string[] = [];
  for (const item of evidence) {
    const itemKey = key(item);
    if (byKey.has(itemKey)) {
      blockers.push(`Duplicate accessibility evidence: ${itemKey}.`);
      continue;
    }
    byKey.set(itemKey, item);
    if (!required.has(itemKey)) {
      blockers.push(`Unknown accessibility matrix entry: ${itemKey}.`);
    }
  }
  for (const target of requiredAccessibilityMatrix) {
    const targetKey = key(target);
    const item = byKey.get(targetKey);
    if (!item) {
      blockers.push(`Missing accessibility evidence: ${targetKey}.`);
      continue;
    }
    if (
      item.result !== "passed" ||
      item.criticalViolations !== 0 ||
      item.seriousViolations !== 0
    ) {
      blockers.push(`Accessibility target has not passed: ${targetKey}.`);
    }
    if (
      !item.artifactId?.trim() ||
      !item.testedCommit?.match(/^[0-9a-f]{40}$/)
    ) {
      blockers.push(
        `Accessibility evidence identity is incomplete: ${targetKey}.`,
      );
    }
  }
  const passedCount = requiredAccessibilityMatrix.filter((target) => {
    const item = byKey.get(key(target));
    return (
      item?.result === "passed" &&
      item.criticalViolations === 0 &&
      item.seriousViolations === 0 &&
      Boolean(item.artifactId?.trim()) &&
      Boolean(item.testedCommit?.match(/^[0-9a-f]{40}$/))
    );
  }).length;
  return {
    passed: blockers.length === 0,
    requiredCount: requiredAccessibilityMatrix.length,
    passedCount,
    blockers: [...new Set(blockers)],
  };
}

export interface PerformanceEvidence {
  testedCommit: string;
  artifactId: string;
  modeledUsers: number;
  concurrentSessions: number;
  operationalRecords: number;
  readP95Milliseconds: number;
  commandP95Milliseconds: number;
  goodCoreWebVitals: boolean;
  runtimeErrorCount: number;
  hydrationErrorCount: number;
}

export function evaluatePerformanceEvidence(evidence: PerformanceEvidence) {
  const blockers: string[] = [];
  if (!evidence.testedCommit.match(/^[0-9a-f]{40}$/)) {
    blockers.push("Performance evidence requires an exact 40-character commit.");
  }
  if (!evidence.artifactId.trim()) {
    blockers.push("Performance evidence requires a retained artifact.");
  }
  if (evidence.modeledUsers < 300) {
    blockers.push("Performance qualification must model at least 300 users.");
  }
  if (evidence.concurrentSessions < 50) {
    blockers.push(
      "Performance qualification must sustain at least 50 concurrent sessions.",
    );
  }
  if (evidence.operationalRecords < 250_000) {
    blockers.push(
      "Performance qualification must include at least 250,000 operational records.",
    );
  }
  if (evidence.readP95Milliseconds > 750) {
    blockers.push("Read latency must be at or below 750 ms p95.");
  }
  if (evidence.commandP95Milliseconds > 1_500) {
    blockers.push("Command latency must be at or below 1.5 seconds p95.");
  }
  if (!evidence.goodCoreWebVitals) {
    blockers.push("Core Web Vitals have not met the Good thresholds.");
  }
  if (evidence.runtimeErrorCount !== 0) {
    blockers.push("Runtime error count must be zero.");
  }
  if (evidence.hydrationErrorCount !== 0) {
    blockers.push("Hydration error count must be zero.");
  }
  return {
    passed: blockers.length === 0,
    blockers,
  };
}
