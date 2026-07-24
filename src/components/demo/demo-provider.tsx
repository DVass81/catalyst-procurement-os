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

const STORAGE_KEY = "catalyst-procurement-os-y12-demo-v2";

interface DemoContextValue {
  state: DemoState;
  apply: (command: (current: DemoState) => DemoState) => void;
  replace: (next: DemoState) => void;
  hydrated: boolean;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function isDemoState(value: unknown): value is DemoState {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === 2 &&
    "featuredRequestId" in value
  );
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(() => createDemoState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isDemoState(parsed)) setState(parsed);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const apply = useCallback(
    (command: (current: DemoState) => DemoState) => {
      setState((current) => command(current));
    },
    [],
  );

  const value = useMemo(
    () => ({ state, apply, replace: setState, hydrated }),
    [apply, hydrated, state],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used within DemoProvider.");
  return value;
}
