export function allowedSsoDomains(value: string | undefined) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) =>
          /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
            domain,
          ),
        ),
    ),
  ].sort();
}

export function resolveApprovedSsoDomain(
  email: string,
  configuredDomains: string | undefined,
) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  const domain = at > 0 ? normalized.slice(at + 1) : "";
  if (!domain || !allowedSsoDomains(configuredDomains).includes(domain)) {
    throw new Error("SSO_DOMAIN_NOT_APPROVED");
  }
  return domain;
}
