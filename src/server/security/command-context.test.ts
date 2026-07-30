import { describe, expect, it } from "vitest";

import { assertFreshCommandTimestamp } from "@/server/security/command-context";

describe("authoritative command timestamp", () => {
  const now = new Date("2026-07-29T16:00:00.000Z");

  it("accepts a current timestamp", () => {
    expect(() =>
      assertFreshCommandTimestamp("2026-07-29T15:59:00.000Z", now),
    ).not.toThrow();
  });

  it("rejects stale and future-skewed timestamps", () => {
    expect(() =>
      assertFreshCommandTimestamp("2026-07-29T15:44:59.999Z", now),
    ).toThrow("COMMAND_TIMESTAMP_STALE");
    expect(() =>
      assertFreshCommandTimestamp("2026-07-29T16:02:00.001Z", now),
    ).toThrow("COMMAND_TIMESTAMP_STALE");
  });

  it("rejects malformed timestamps", () => {
    expect(() => assertFreshCommandTimestamp("not-a-date", now)).toThrow(
      "COMMAND_TIMESTAMP_INVALID",
    );
  });
});
