import { describe, expect, it } from "vitest";

import {
  evaluateReliabilityWindow,
  type AvailabilitySample,
} from "@/server/operations/reliability-evidence";

const commit = "a".repeat(40);

describe("fixed-commit reliability evidence", () => {
  it("passes a complete fixed-interval window at the availability target", () => {
    const endedAt = new Date("2026-07-29T20:00:00.000Z");
    const samples: AvailabilitySample[] = Array.from(
      { length: 60 },
      (_, index) => ({
        observedAt: new Date(
          endedAt.getTime() - (59 - index) * 60_000,
        ).toISOString(),
        releaseCommit: commit,
        status: "passed" as const,
        latencyMs: 120 + index,
        authoritativeReadiness: true,
        exactArtifactAgreement: true,
      }),
    );
    expect(
      evaluateReliabilityWindow({
        samples,
        expectedCommit: commit,
        windowEndedAt: endedAt.toISOString(),
        requiredDays: 1 / 24,
      }),
    ).toMatchObject({
      passed: true,
      expectedSampleCount: 60,
      receivedSampleCount: 60,
      coveredIntervalCount: 60,
      passingSampleCount: 60,
      missingSampleCount: 0,
      availabilityPercent: 100,
      maximumLatencyMs: 179,
      blockers: [],
    });
  });

  it("does not let duplicate passing probes hide a failed or missing interval", () => {
    const endedAt = new Date("2026-07-29T20:00:00.000Z");
    const samples: AvailabilitySample[] = Array.from({ length: 60 }, (_, index) => ({
      observedAt: new Date(
        endedAt.getTime() - (59 - index) * 60_000,
      ).toISOString(),
      releaseCommit: commit,
      status: "passed" as const,
      latencyMs: 100,
      authoritativeReadiness: true,
      exactArtifactAgreement: true,
    }));
    samples.push({
      ...samples[0]!,
      observedAt: new Date(
        new Date(samples[0]!.observedAt).getTime() - 10_000,
      ).toISOString(),
      status: "failed",
    });
    const result = evaluateReliabilityWindow({
      samples,
      expectedCommit: commit,
      windowEndedAt: endedAt.toISOString(),
      requiredDays: 1 / 24,
    });
    expect(result.coveredIntervalCount).toBe(60);
    expect(result.receivedSampleCount).toBe(61);
    expect(result.passingSampleCount).toBe(59);
    expect(result.availabilityPercent).toBeCloseTo(98.33333, 5);
    expect(result.passed).toBe(false);
  });

  it("counts missing, failed, non-authoritative, and mixed-commit samples against the gate", () => {
    const endedAt = new Date("2026-07-29T20:00:00.000Z");
    const samples = Array.from({ length: 58 }, (_, index) => ({
      observedAt: new Date(
        endedAt.getTime() - (57 - index) * 60_000,
      ).toISOString(),
      releaseCommit: index === 0 ? "b".repeat(40) : commit,
      status: index === 1 ? ("failed" as const) : ("passed" as const),
      latencyMs: 200,
      authoritativeReadiness: index !== 2,
      exactArtifactAgreement: index !== 3,
    }));
    const result = evaluateReliabilityWindow({
      samples,
      expectedCommit: commit,
      windowEndedAt: endedAt.toISOString(),
      requiredDays: 1 / 24,
    });
    expect(result.passed).toBe(false);
    expect(result.missingSampleCount).toBe(2);
    expect(result.availabilityPercent).toBe(90);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "Reliability evidence is missing 2 expected samples.",
        "Reliability evidence spans more than the fixed release commit.",
        "One or more availability samples failed artifact agreement.",
        "One or more availability samples failed authoritative readiness.",
      ]),
    );
  });
});
