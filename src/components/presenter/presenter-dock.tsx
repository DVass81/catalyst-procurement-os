"use client";

import {
  Activity,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  CloudOff,
  Power,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Health {
  status: "ready" | "degraded";
  providers: Record<string, string>;
  fallback: {
    global: boolean;
    capabilities: Record<string, boolean>;
    changedAt: string;
  };
  usage: {
    ceilingUsd: number;
    spentUsd: number;
    remainingUsd: number;
    utilization: number;
    warningLevel: number;
    paidSessionsAllowed: boolean;
    administratorKillSwitch: boolean;
  };
}

export function PresenterDock() {
  const [health, setHealth] = useState<Health | null>(null);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  async function refresh() {
    const response = await fetch("/api/provider-health", { cache: "no-store" });
    if (!response.ok) {
      setHealth(null);
      return;
    }
    setHealth((await response.json()) as Health);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/provider-health", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as Health;
      })
      .then((next) => {
        if (!cancelled) setHealth(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleFallback() {
    if (!health) return;
    setWorking(true);
    await fetch("/api/presenter/fallback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        global: !health.fallback.global,
        capabilities: health.fallback.capabilities,
      }),
    });
    await refresh();
    setWorking(false);
  }

  async function toggleKillSwitch() {
    if (!health) return;
    setWorking(true);
    await fetch("/api/usage/kill-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: !health.usage.administratorKillSwitch,
      }),
    });
    await refresh();
    setWorking(false);
  }

  if (!health) return null;

  return (
    <div className="fixed bottom-5 left-5 z-40 hidden w-[22rem] overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/95 text-white shadow-2xl backdrop-blur-xl 2xl:block">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span
          className={`size-2.5 rounded-full ${
            health.status === "ready" && !health.fallback.global
              ? "bg-emerald-400"
              : "bg-amber-400"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
            Presenter only
          </span>
          <span className="block truncate text-xs font-black">
            {health.fallback.global
              ? "Reliable fallback active"
              : health.status === "ready"
                ? "Live providers ready"
                : "Degraded · fallback ready"}
          </span>
        </span>
        {open ? (
          <ChevronDown className="size-4 text-white/50" />
        ) : (
          <ChevronUp className="size-4 text-white/50" />
        )}
      </button>
      {open && (
        <div className="border-t border-white/10 p-4">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(health.providers).map(([provider, status]) => (
              <div key={provider} className="rounded-xl bg-white/[0.06] p-2.5">
                <p className="text-[9px] font-black uppercase tracking-wider text-white/40">
                  {provider}
                </p>
                <p className="mt-1 text-xs font-bold">{status}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-white/[0.06] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs font-black">
                <CircleDollarSign className="size-4 text-emerald-400" />
                Monthly AI
              </span>
              <Badge className="border-white/10 bg-white/10 text-white">
                ${health.usage.spentUsd.toFixed(2)} / $
                {health.usage.ceilingUsd}
              </Badge>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{
                  width: `${Math.min(100, health.usage.utilization * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void toggleFallback()}
              disabled={working}
              className="text-[10px]"
            >
              <CloudOff className="size-3.5" />
              {health.fallback.global ? "Return live" : "Use fallback"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void toggleKillSwitch()}
              disabled={working}
              className="text-[10px]"
            >
              <Power className="size-3.5" />
              {health.usage.administratorKillSwitch
                ? "Enable paid AI"
                : "Stop paid AI"}
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-white/45">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              Prospects never see this panel
            </span>
            <button
              onClick={() => void refresh()}
              className="flex items-center gap-1 hover:text-white"
            >
              <RefreshCw className="size-3" />
              Refresh
            </button>
          </div>
          {health.usage.warningLevel > 0 && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-400/10 px-2.5 py-2 text-[10px] font-bold text-amber-300">
              <Activity className="size-3.5" />
              Usage warning at {health.usage.warningLevel}%.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
