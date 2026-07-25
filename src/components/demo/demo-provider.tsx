"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { DemoState } from "@/demo/model";
import { createDemoState } from "@/demo/seed";
import {
  isTenantId,
  tenantThemes,
  type TenantId,
} from "@/config/organizations";

const ACTIVE_TENANT_KEY = "catalyst-procurement-os-active-tenant-v1";

function storageKey(tenantId: TenantId) {
  return `catalyst-procurement-os-${tenantId}-v3`;
}

interface DemoContextValue {
  state: DemoState;
  apply: (command: (current: DemoState) => DemoState) => void;
  replace: (next: DemoState) => void;
  switchTenant: (tenantId: TenantId) => void;
  activeTenantId: TenantId;
  hydrated: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function isDemoState(value: unknown): value is DemoState {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 3 &&
    "featuredRequestId" in value
  );
}

function isTenantDemoState(
  value: unknown,
  tenantId: TenantId,
): value is DemoState {
  return (
    isDemoState(value) &&
    value.organization.organizationId === tenantId
  );
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [activeTenantId, setActiveTenantId] =
    useState<TenantId>("org-y12-demo");
  const [state, setState] = useState<DemoState>(() =>
    createDemoState(tenantThemes["org-y12-demo"]),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      try {
        const storedTenant = window.localStorage.getItem(ACTIVE_TENANT_KEY);
        const tenantId =
          storedTenant && isTenantId(storedTenant)
            ? storedTenant
            : "org-y12-demo";
        setActiveTenantId(tenantId);
        const stored = window.localStorage.getItem(storageKey(tenantId));
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isTenantDemoState(parsed, tenantId)) {
            setState(parsed);
          } else {
            window.localStorage.removeItem(storageKey(tenantId));
            setState(createDemoState(tenantThemes[tenantId]));
          }
        } else {
          setState(createDemoState(tenantThemes[tenantId]));
        }
      } catch {
        window.localStorage.removeItem(ACTIVE_TENANT_KEY);
        setState(createDemoState(tenantThemes["org-y12-demo"]));
      } finally {
        setHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(ACTIVE_TENANT_KEY, activeTenantId);
    window.localStorage.setItem(storageKey(activeTenantId), JSON.stringify(state));
  }, [activeTenantId, hydrated, state]);

  const apply = useCallback(
    (command: (current: DemoState) => DemoState) => {
      setState((current) => command(current));
    },
    [],
  );

  const switchTenant = useCallback(
    (tenantId: TenantId) => {
      if (!state.presenterMode || tenantId === activeTenantId) return;
      window.localStorage.setItem(storageKey(activeTenantId), JSON.stringify(state));
      const stored = window.localStorage.getItem(storageKey(tenantId));
      if (stored) {
        try {
          const parsed: unknown = JSON.parse(stored);
          if (isTenantDemoState(parsed, tenantId)) {
            setActiveTenantId(tenantId);
            setState(parsed);
            return;
          }
        } catch {
          window.localStorage.removeItem(storageKey(tenantId));
        }
      }
      setActiveTenantId(tenantId);
      setState(createDemoState(tenantThemes[tenantId]));
    },
    [activeTenantId, state],
  );

  const value = useMemo(
    () => ({
      state,
      apply,
      replace: setState,
      switchTenant,
      activeTenantId,
      hydrated,
    }),
    [activeTenantId, apply, hydrated, state, switchTenant],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used within DemoProvider.");
  return value;
}
