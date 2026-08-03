export const COMMAND_MAX_AGE_MS = 15 * 60_000;
export const COMMAND_MAX_FUTURE_SKEW_MS = 2 * 60_000;

export function assertFreshCommandTimestamp(
  requestedAt: string,
  now = new Date(),
) {
  const requestedTime = new Date(requestedAt).getTime();
  if (!Number.isFinite(requestedTime)) {
    throw new Error("COMMAND_TIMESTAMP_INVALID");
  }
  const age = now.getTime() - requestedTime;
  if (age > COMMAND_MAX_AGE_MS || age < -COMMAND_MAX_FUTURE_SKEW_MS) {
    throw new Error("COMMAND_TIMESTAMP_STALE");
  }
}
