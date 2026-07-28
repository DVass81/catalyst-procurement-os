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
import type { DemoState } from "@/demo/model";
import { createDemoState } from "@/demo/seed";
import type {
  PhaseTwoCommand,
  PhaseTwoStateEnvelope,
} from "@/phase-two/commands";
import type { PhaseThreeCommand } from "@/phase-three/commands";

const ACTIVE_TENANT_KEY = "catalyst-procurement-os-active-tenant-v1";

interface DemoContextValue {
  state: DemoState;
  dispatch: (command: PhaseTwoCommand | PhaseThreeCommand) => Promise<DemoState>;
  switchTenant: (tenantId: TenantId) => Promise<void>;
  activeTenantId: TenantId;
  hydrated: boolean;
  pending: boolean;
  persistence: "supabase" | "preview" | "unavailable";
  durability: "authoritative" | "temporary" | "read_only";
  revision: number;
  error: string | null;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function presenterMode() {
  return new URLSearchParams(window.location.search).get("presenter") === "1";
}

async function requestState(tenantId: TenantId) {
  const response = await fetch(
    `/api/phase-two/state?tenantId=${encodeURIComponent(tenantId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  const result = (await response.json()) as PhaseTwoStateEnvelope & {
    message?: string;
  };
  if (!response.ok) {
    throw new Error(result.message ?? "The authoritative demo state is unavailable.");
  }
  return result;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [activeTenantId, setActiveTenantId] =
    useState<TenantId>("org-y12-demo");
  const [state, setState] = useState<DemoState>(() =>
    createDemoState(tenantThemes["org-y12-demo"]),
  );
  const [revision, setRevision] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [persistence, setPersistence] =
    useState<DemoContextValue["persistence"]>("unavailable");
  const [durability, setDurability] =
    useState<DemoContextValue["durability"]>("read_only");
  const [error, setError] = useState<string | null>(null);
  const tenantRef = useRef<TenantId>("org-y12-demo");
  const revisionRef = useRef(0);

  const acceptEnvelope = useCallback(
    (tenantId: TenantId, envelope: PhaseTwoStateEnvelope) => {
      const next = {
        ...envelope.state,
        presenterMode: presenterMode(),
      };
      if (next.organization.organizationId !== tenantId) {
        throw new Error("The server returned state for a different tenant.");
      }
      tenantRef.current = tenantId;
      revisionRef.current = envelope.revision;
      setActiveTenantId(tenantId);
      setState(next);
      setRevision(envelope.revision);
      setPersistence(envelope.persistence);
      setDurability(envelope.durability);
      setError(null);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const storedTenant = window.localStorage.getItem(ACTIVE_TENANT_KEY);
      const tenantId =
        presenterMode() && storedTenant && isTenantId(storedTenant)
          ? storedTenant
          : "org-y12-demo";
      try {
        const envelope = await requestState(tenantId);
        if (!cancelled) acceptEnvelope(tenantId, envelope);
      } catch (loadError) {
        if (cancelled) return;
        setState({
          ...createDemoState(tenantThemes[tenantId]),
          presenterMode: presenterMode(),
        });
        setPersistence("unavailable");
        setDurability("read_only");
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
          },
          body: JSON.stringify({
            tenantId,
            expectedRevision: revisionRef.current,
            idempotencyKey: crypto.randomUUID(),
            command,
          }),
        });
        const result = (await response.json()) as PhaseTwoStateEnvelope & {
          message?: string;
        };
        if (!response.ok) {
          if (response.status === 409) {
            const latest = await requestState(tenantId);
            acceptEnvelope(tenantId, latest);
          }
          throw new Error(result.message ?? "The workflow command failed.");
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
        const envelope = await requestState(tenantId);
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
      revision,
      error,
    }),
    [
      activeTenantId,
      dispatch,
      durability,
      error,
      hydrated,
      pending,
      persistence,
      revision,
      state,
      switchTenant,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used within DemoProvider.");
  return value;
}
