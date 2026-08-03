"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  isTenantId,
  tenantThemes,
  type TenantId,
} from "@/config/organizations";
import type { CatalystEnvironmentKind } from "@/config/runtime-environment";
import type { DemoState } from "@/demo/model";
import { createDemoState } from "@/demo/seed";
import { CatalystApiError, readApiJson } from "@/lib/http/api-json";
import type {
  PhaseTwoCommand,
  PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import type { PhaseThreeCommand } from "@/phase-three/commands";

const ACTIVE_TENANT_KEY = "catalyst-procurement-os-active-tenant-v1";
const ACTIVE_ROLE_KEY_PREFIX = "catalyst-procurement-os-active-role-v1:";
const HYDRATION_SAFE_SESSION_DATE = "2026-07-29";

class ActiveRoleRequiredError extends Error {
  availableRoles: DemoState["activeRole"][];

  constructor(availableRoles: DemoState["activeRole"][]) {
    super("ACTIVE_ROLE_REQUIRED");
    this.availableRoles = availableRoles;
  }
}

function commandRationale(command: PhaseTwoCommand | PhaseThreeCommand) {
  if ("reason" in command && typeof command.reason === "string") {
    return command.reason;
  }
  if ("rationale" in command && typeof command.rationale === "string") {
    return command.rationale;
  }
  if ("justification" in command && typeof command.justification === "string") {
    return (
      command.justification ||
      `Authorized ${command.type.replaceAll("_", " ")} workflow action.`
    );
  }
  if ("comments" in command && typeof command.comments === "string") {
    return (
      command.comments ||
      `Authorized ${command.type.replaceAll("_", " ")} workflow action.`
    );
  }
  return `Authorized ${command.type.replaceAll("_", " ")} workflow action.`;
}

interface DemoContextValue {
  state: DemoState;
  dispatch: (command: PhaseTwoCommand | PhaseThreeCommand) => Promise<DemoState>;
  switchTenant: (tenantId: TenantId) => Promise<void>;
  activeTenantId: TenantId;
  hydrated: boolean;
  pending: boolean;
  persistence: "supabase" | "preview" | "unavailable";
  durability: "authoritative" | "temporary" | "read_only";
  operationalReadiness: PhaseTwoStateEnvelope["operationalReadiness"];
  revision: number;
  error: string | null;
  availableRoles: DemoState["activeRole"][];
  selectActiveRole: (role: DemoState["activeRole"]) => Promise<void>;
  environmentKind: CatalystEnvironmentKind;
}

const DemoContext = createContext<DemoContextValue | null>(null);

async function requestState(
  tenantId: TenantId,
  activeRole?: DemoState["activeRole"],
) {
  const response = await fetch(
    `/api/phase-two/state?tenantId=${encodeURIComponent(tenantId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(activeRole
          ? { "x-catalyst-active-role": activeRole }
          : {}),
      },
      cache: "no-store",
    },
  );
  try {
    return await readApiJson<
      PhaseTwoStateEnvelope & {
        message?: string;
        code?: string;
        availableRoles?: DemoState["activeRole"][];
      }
    >(response, "The authoritative Catalyst state is unavailable.");
  } catch (error) {
    if (
      error instanceof CatalystApiError &&
      error.status === 409 &&
      error.code === "ACTIVE_ROLE_REQUIRED" &&
      Array.isArray(error.payload?.availableRoles)
    ) {
      throw new ActiveRoleRequiredError(
        error.payload.availableRoles as DemoState["activeRole"][],
      );
    }
    throw error;
  }
}

async function requestWorkspaceContext() {
  const response = await fetch("/api/auth/workspace-context", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return readApiJson<{
    tenantIds?: string[];
    defaultTenantId?: string | null;
    environmentKind?: CatalystEnvironmentKind;
    fixedRole?: DemoState["activeRole"] | null;
  }>(response, "Workspace access is unavailable.");
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [activeTenantId, setActiveTenantId] =
    useState<TenantId>("org-y12-demo");
  const [state, setState] = useState<DemoState>(() =>
    createDemoState(
      tenantThemes["org-y12-demo"],
      HYDRATION_SAFE_SESSION_DATE,
    ),
  );
  const [revision, setRevision] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [persistence, setPersistence] =
    useState<DemoContextValue["persistence"]>("unavailable");
  const [durability, setDurability] =
    useState<DemoContextValue["durability"]>("read_only");
  const [error, setError] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<
    DemoState["activeRole"][]
  >([]);
  const [roleSelectionRequired, setRoleSelectionRequired] = useState(false);
  const [environmentKind, setEnvironmentKind] =
    useState<CatalystEnvironmentKind>("development_preview");
  const [operationalReadiness, setOperationalReadiness] = useState<
    PhaseTwoStateEnvelope["operationalReadiness"]
  >({
    ready: false,
    mode: "blocked",
    checkedAt: new Date(0).toISOString(),
    reasons: ["authoritative_state_not_loaded"],
  });
  const tenantRef = useRef<TenantId>("org-y12-demo");
  const revisionRef = useRef(0);
  const activeRoleRef = useRef<DemoState["activeRole"]>("requester");

  const acceptEnvelope = useCallback(
    (tenantId: TenantId, envelope: PhaseTwoStateEnvelope) => {
      const next = {
        ...envelope.state,
        presenterMode: envelope.presenter === true,
      };
      if (next.organization.organizationId !== tenantId) {
        throw new Error("The server returned state for a different tenant.");
      }
      tenantRef.current = tenantId;
      revisionRef.current = envelope.revision;
      activeRoleRef.current = next.activeRole;
      setActiveTenantId(tenantId);
      setState(next);
      setRevision(envelope.revision);
      setPersistence(envelope.persistence);
      setDurability(envelope.durability);
      setOperationalReadiness(envelope.operationalReadiness);
      setAvailableRoles((current) =>
        envelope.availableRoles ??
        (current.length > 0 ? current : [next.activeRole]),
      );
      setRoleSelectionRequired(false);
      setError(
        envelope.operationalReadiness.ready
          ? null
          : `Controlled actions are blocked: ${
              envelope.operationalReadiness.reasons
                .map((reason) => reason.replaceAll("_", " "))
                .join(", ") || "authoritative transaction checks did not pass"
            }.`,
      );
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const storedTenant = window.localStorage.getItem(ACTIVE_TENANT_KEY);
      let tenantId: TenantId = "org-y12-demo";
      try {
        const workspace = await requestWorkspaceContext();
        const selectedTenant =
          storedTenant &&
          isTenantId(storedTenant) &&
          workspace.tenantIds?.includes(storedTenant)
            ? storedTenant
            : workspace.defaultTenantId;
        if (!selectedTenant || !isTenantId(selectedTenant)) {
          throw new Error(
            "No configured Catalyst workspace is assigned to this account.",
          );
        }
        if (workspace.environmentKind) {
          setEnvironmentKind(workspace.environmentKind);
        }
        tenantId = selectedTenant;
        tenantRef.current = tenantId;
        const storedRole =
          workspace.environmentKind === "functional_test"
            ? null
            : (window.localStorage.getItem(
                `${ACTIVE_ROLE_KEY_PREFIX}${tenantId}`,
              ) as DemoState["activeRole"] | null);
        if (workspace.environmentKind === "functional_test") {
          window.localStorage.removeItem(
            `${ACTIVE_ROLE_KEY_PREFIX}${tenantId}`,
          );
        }
        const envelope = await requestState(
          tenantId,
          workspace.fixedRole ?? storedRole ?? undefined,
        );
        if (!cancelled) acceptEnvelope(tenantId, envelope);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ActiveRoleRequiredError) {
          setAvailableRoles(loadError.availableRoles);
          setRoleSelectionRequired(true);
          setPersistence("unavailable");
          setDurability("read_only");
          setOperationalReadiness({
            ready: false,
            mode: "blocked",
            checkedAt: new Date().toISOString(),
            reasons: ["active_role_selection_required"],
          });
          setError(null);
          return;
        }
        setState({
          ...createDemoState(tenantThemes[tenantId]),
          presenterMode: false,
        });
        setPersistence("unavailable");
        setDurability("read_only");
        setOperationalReadiness({
          ready: false,
          mode: "blocked",
          checkedAt: new Date().toISOString(),
          reasons: ["authoritative_state_unavailable"],
        });
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The authoritative demo state is unavailable.",
        );
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [acceptEnvelope]);

  const dispatch = useCallback(
    async (command: PhaseTwoCommand | PhaseThreeCommand) => {
      if (durability === "read_only") {
        throw new Error(
          "The workspace is in read-only fallback because authoritative state is unavailable.",
        );
      }
      const tenantId = tenantRef.current;
      setPending(true);
      setError(null);
      try {
        const idempotencyKey = crypto.randomUUID();
        const correlationId =
          "correlationId" in command
            ? command.correlationId
            : crypto.randomUUID();
        const requestedAt = new Date().toISOString();
        const endpoint = command.type.startsWith("phase3_")
          ? "/api/phase-three/state"
          : command.type === "generate_audit_package"
            ? "/api/phase-two/audit-packages"
            : "/api/phase-two/state";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-catalyst-active-role": activeRoleRef.current,
            "x-catalyst-correlation-id": correlationId,
          },
          body: JSON.stringify({
            tenantId,
            expectedRevision: revisionRef.current,
            idempotencyKey,
            correlationId,
            requestedAt,
            rationale: commandRationale(command),
            command,
          }),
        });
        let result: PhaseTwoStateEnvelope;
        try {
          result = await readApiJson<PhaseTwoStateEnvelope>(
            response,
            "The workflow command failed.",
          );
        } catch (responseError) {
          if (
            responseError instanceof CatalystApiError &&
            responseError.status === 409
          ) {
            const latest = await requestState(
              tenantId,
              activeRoleRef.current,
            );
            acceptEnvelope(tenantId, latest);
          }
          throw responseError;
        }
        acceptEnvelope(tenantId, result);
        return result.state;
      } catch (commandError) {
        const message =
          commandError instanceof Error
            ? commandError.message
            : "The workflow command failed.";
        setError(message);
        throw commandError;
      } finally {
        setPending(false);
      }
    },
    [acceptEnvelope, durability],
  );

  const switchTenant = useCallback(
    async (tenantId: TenantId) => {
      if (!state.presenterMode || tenantId === tenantRef.current) return;
      setPending(true);
      setError(null);
      try {
        const storedRole = window.localStorage.getItem(
          `${ACTIVE_ROLE_KEY_PREFIX}${tenantId}`,
        ) as DemoState["activeRole"] | null;
        const envelope = await requestState(
          tenantId,
          storedRole ?? undefined,
        );
        acceptEnvelope(tenantId, envelope);
        window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
      } catch (tenantError) {
        const message =
          tenantError instanceof Error
            ? tenantError.message
            : "The requested tenant is unavailable.";
        setError(message);
        throw tenantError;
      } finally {
        setPending(false);
      }
    },
    [acceptEnvelope, state.presenterMode],
  );

  const selectActiveRole = useCallback(
    async (role: DemoState["activeRole"]) => {
      if (environmentKind === "functional_test") return;
      if (!availableRoles.includes(role)) return;
      const tenantId = tenantRef.current;
      setPending(true);
      setError(null);
      try {
        const envelope = await requestState(tenantId, role);
        window.localStorage.setItem(
          `${ACTIVE_ROLE_KEY_PREFIX}${tenantId}`,
          role,
        );
        acceptEnvelope(tenantId, envelope);
        window.location.assign("/dashboard");
      } catch (selectionError) {
        setError(
          selectionError instanceof Error
            ? selectionError.message
            : "The selected role could not be activated.",
        );
      } finally {
        setPending(false);
      }
    },
    [acceptEnvelope, availableRoles, environmentKind],
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
      switchTenant,
      activeTenantId,
      hydrated,
      pending,
      persistence,
      durability,
      operationalReadiness,
      revision,
      error,
      availableRoles,
      selectActiveRole,
      environmentKind,
    }),
    [
      activeTenantId,
      availableRoles,
      dispatch,
      durability,
      error,
      environmentKind,
      hydrated,
      pending,
      persistence,
      operationalReadiness,
      revision,
      state,
      selectActiveRole,
      switchTenant,
    ],
  );

  return (
    <DemoContext.Provider value={value}>
      {!hydrated ? (
        <main
          className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6"
          aria-busy="true"
          aria-live="polite"
        >
          <section className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-secondary-text)]">
              Secure workspace resolver
            </p>
            <h1 className="mt-2 text-2xl font-black">
              Verifying your assigned workspace
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Catalyst is validating authentication, tenant, role, permissions,
              and authoritative state before displaying any procurement record.
            </p>
          </section>
        </main>
      ) : persistence === "unavailable" && !roleSelectionRequired ? (
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
          <section className="w-full max-w-xl rounded-3xl border border-rose-300 bg-[var(--surface)] p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-rose-700">
              Workspace unavailable
            </p>
            <h1 className="mt-2 text-2xl font-black">
              No procurement data was displayed
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]" role="alert">
              {error ??
                "Catalyst could not verify an authoritative workspace for this session."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 rounded-xl bg-[var(--brand-primary)] px-4 text-sm font-black text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            >
              Retry secure verification
            </button>
          </section>
        </main>
      ) : roleSelectionRequired ? (
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
          <section className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brand-secondary-text)]">
              Active role required
            </p>
            <h1 className="mt-2 text-2xl font-black">
              Choose how you are working
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Catalyst will load only the records and actions assigned to the
              selected role. Choosing a role does not grant new authority.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {availableRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  disabled={pending}
                  onClick={() => void selectActiveRole(role)}
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] px-4 text-left text-sm font-bold outline-none transition hover:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-50"
                >
                  {role.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            {error ? (
              <p className="mt-4 text-sm text-rose-700" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </main>
      ) : (
        children
      )}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used within DemoProvider.");
  return value;
}
