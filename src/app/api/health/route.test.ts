import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

const originalEnvironment = {
  releaseChannel: process.env.CATALYST_RELEASE_CHANNEL,
  releaseCommit: process.env.CATALYST_RELEASE_COMMIT,
  syntheticOnly: process.env.CATALYST_SYNTHETIC_ONLY,
};

function restoreEnvironment(
  key: keyof NodeJS.ProcessEnv,
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnvironment(
    "CATALYST_RELEASE_CHANNEL",
    originalEnvironment.releaseChannel,
  );
  restoreEnvironment("CATALYST_RELEASE_COMMIT", originalEnvironment.releaseCommit);
  restoreEnvironment(
    "CATALYST_SYNTHETIC_ONLY",
    originalEnvironment.syntheticOnly,
  );
});

describe("Phase 3 health evidence", () => {
  it("reports the exact release channel, commit, and data classification", async () => {
    process.env.CATALYST_RELEASE_CHANNEL = "commercialization-staging";
    process.env.CATALYST_RELEASE_COMMIT = "a61eaafa1849eb02af8e28f5e12ac0e1fe77385a";
    process.env.CATALYST_SYNTHETIC_ONLY = "1";

    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      releaseChannel: "commercialization-staging",
      releaseCommit: "a61eaafa1849eb02af8e28f5e12ac0e1fe77385a",
      dataClassification: "synthetic-only",
    });
  });
});
