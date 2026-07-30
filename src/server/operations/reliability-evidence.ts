export interface AvailabilitySample {
  observedAt: string;
  releaseCommit: string;
  status: "passed" | "failed";
  latencyMs: number;
  authoritativeReadiness: boolean;
  exactArtifactAgreement: boolean;
}

export interface ReliabilityWindowDecision {
  passed: boolean;
  windowStartedAt: string;
  windowEndedAt: string;
  expectedSampleCount: number;
  receivedSampleCount: number;
  coveredIntervalCount: number;
  passingSampleCount: number;
  missingSampleCount: number;
  availabilityPercent: number;
  maximumLatencyMs: number | null;
  blockers: string[];
}

export function evaluateReliabilityWindow(input: {
  samples: readonly AvailabilitySample[];
  expectedCommit: string;
  windowEndedAt: string;
  requiredDays?: number;
  intervalMinutes?: number;
  requiredAvailabilityPercent?: number;
}): ReliabilityWindowDecision {
  const requiredDays = input.requiredDays ?? 30;
  const intervalMinutes = input.intervalMinutes ?? 1;
  const requiredAvailabilityPercent =
    input.requiredAvailabilityPercent ?? 99.95;
  const endedAt = new Date(input.windowEndedAt);
  if (
    !Number.isFinite(endedAt.getTime()) ||
    requiredDays <= 0 ||
    intervalMinutes <= 0
  ) {
    throw new Error("RELIABILITY_WINDOW_CONFIGURATION_INVALID");
  }
  const windowMilliseconds = requiredDays * 86_400_000;
  const startedAt = new Date(endedAt.getTime() - windowMilliseconds);
  const expectedSampleCount = Math.ceil(
    windowMilliseconds / (intervalMinutes * 60_000),
  );
  const samples = input.samples.filter((sample) => {
    const observedAt = new Date(sample.observedAt).getTime();
    return (
      Number.isFinite(observedAt) &&
      observedAt >= startedAt.getTime() &&
      observedAt <= endedAt.getTime()
    );
  });
  const intervalMilliseconds = intervalMinutes * 60_000;
  const buckets = new Map<number, AvailabilitySample[]>();
  for (const sample of samples) {
    const elapsed =
      new Date(sample.observedAt).getTime() - startedAt.getTime();
    const index = Math.min(
      expectedSampleCount - 1,
      Math.max(0, Math.ceil(elapsed / intervalMilliseconds) - 1),
    );
    const bucket = buckets.get(index) ?? [];
    bucket.push(sample);
    buckets.set(index, bucket);
  }
  const passingSampleCount = [...buckets.values()].filter((bucket) =>
    bucket.every(
      (sample) =>
        sample.status === "passed" &&
        sample.releaseCommit === input.expectedCommit &&
        sample.authoritativeReadiness &&
        sample.exactArtifactAgreement,
    ),
  ).length;
  const missingSampleCount = Math.max(
    0,
    expectedSampleCount - buckets.size,
  );
  const availabilityPercent =
    expectedSampleCount === 0
      ? 0
      : Number(
          ((passingSampleCount / expectedSampleCount) * 100).toFixed(5),
        );
  const blockers: string[] = [];
  if (buckets.size < expectedSampleCount) {
    blockers.push(
      `Reliability evidence is missing ${missingSampleCount} expected samples.`,
    );
  }
  if (availabilityPercent < requiredAvailabilityPercent) {
    blockers.push(
      `Measured availability ${availabilityPercent}% is below ${requiredAvailabilityPercent}%.`,
    );
  }
  if (
    samples.some((sample) => sample.releaseCommit !== input.expectedCommit)
  ) {
    blockers.push("Reliability evidence spans more than the fixed release commit.");
  }
  if (samples.some((sample) => !sample.exactArtifactAgreement)) {
    blockers.push("One or more availability samples failed artifact agreement.");
  }
  if (samples.some((sample) => !sample.authoritativeReadiness)) {
    blockers.push(
      "One or more availability samples failed authoritative readiness.",
    );
  }

  return {
    passed: blockers.length === 0,
    windowStartedAt: startedAt.toISOString(),
    windowEndedAt: endedAt.toISOString(),
    expectedSampleCount,
    receivedSampleCount: samples.length,
    coveredIntervalCount: buckets.size,
    passingSampleCount,
    missingSampleCount,
    availabilityPercent,
    maximumLatencyMs: samples.length
      ? Math.max(...samples.map((sample) => sample.latencyMs))
      : null,
    blockers: [...new Set(blockers)],
  };
}
