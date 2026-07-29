import "server-only";

export const DEVELOPMENT_BYPASS_EXPIRES_AT =
  "2026-08-12T23:59:59-04:00";
export const DEVELOPMENT_BYPASS_RELEASE_CHANNEL = "development-preview";
export const DEVELOPMENT_BYPASS_TENANT_IDS = [
  "org-y12-demo",
  "org-catalyst-community-demo",
] as const;

type BypassEnvironment = Partial<
  Record<
    | "DEMO_AUTH_BYPASS"
    | "DEMO_AUTH_BYPASS_ACTOR_ID"
    | "DEMO_AUTH_BYPASS_EXPIRES_AT"
    | "CATALYST_RELEASE_CHANNEL"
    | "CATALYST_SYNTHETIC_ONLY",
    string | undefined
  >
>;

export type DevelopmentBypassStatus =
  | "disabled"
  | "active"
  | "expired"
  | "misconfigured";

export interface DevelopmentBypassState {
  active: boolean;
  status: DevelopmentBypassStatus;
  actorId?: string;
  expiresAt: string | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDevelopmentBypassExpiration(value?: string | null) {
  if (!value) return false;
  const expected = new Date(DEVELOPMENT_BYPASS_EXPIRES_AT).getTime();
  const actual = new Date(value).getTime();
  return Number.isFinite(actual) && actual === expected;
}

export function resolveDevelopmentBypass(
  environment: BypassEnvironment = process.env as BypassEnvironment,
  now = new Date(),
): DevelopmentBypassState {
  const flag = environment.DEMO_AUTH_BYPASS;
  const expiresAt = environment.DEMO_AUTH_BYPASS_EXPIRES_AT ?? null;

  if (flag === undefined || flag === "" || flag === "0") {
    return { active: false, status: "disabled", expiresAt };
  }
  if (
    flag !== "1" ||
    environment.CATALYST_SYNTHETIC_ONLY !== "1" ||
    environment.CATALYST_RELEASE_CHANNEL !==
      DEVELOPMENT_BYPASS_RELEASE_CHANNEL ||
    expiresAt !== DEVELOPMENT_BYPASS_EXPIRES_AT ||
    !uuidPattern.test(environment.DEMO_AUTH_BYPASS_ACTOR_ID ?? "")
  ) {
    return { active: false, status: "misconfigured", expiresAt };
  }
  if (now.getTime() >= new Date(DEVELOPMENT_BYPASS_EXPIRES_AT).getTime()) {
    return { active: false, status: "expired", expiresAt };
  }
  return {
    active: true,
    status: "active",
    actorId: environment.DEMO_AUTH_BYPASS_ACTOR_ID,
    expiresAt,
  };
}
