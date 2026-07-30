import "server-only";

const forwardedHostPattern = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

function configuredOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    const candidate = new URL(value.trim());
    return candidate.protocol === "https:" || candidate.protocol === "http:"
      ? candidate.origin
      : null;
  } catch {
    return null;
  }
}

export function resolvePublicOrigin(
  request: Request,
  configuredBaseUrl = process.env.APP_BASE_URL,
) {
  const configured = configuredOrigin(configuredBaseUrl);
  if (configured) return configured;

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";

  if (
    forwardedHost &&
    forwardedHostPattern.test(forwardedHost) &&
    (forwardedProto === "https" || forwardedProto === "http")
  ) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}
