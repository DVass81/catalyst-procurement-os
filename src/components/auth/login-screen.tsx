"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";
import { organization } from "@/data/mock-data";

export function LoginScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function enterDemo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => router.push("/dashboard"), 450);
  }

  return (
    <main className="grid min-h-screen bg-[var(--surface)] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-[#041a6c] px-12 py-10 text-white lg:flex lg:flex-col xl:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(64,66,135,0.72),transparent_38%),radial-gradient(circle_at_82%_78%,rgba(207,68,39,0.34),transparent_36%),radial-gradient(circle_at_52%_42%,rgba(235,191,93,0.12),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.09] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="absolute -left-20 bottom-20 size-72 rounded-full border-[52px] border-[#ebbf5d]/10" />

        <div className="relative z-10 flex items-center justify-between">
          <BrandMark className="[&_p]:text-white [&_p:last-child]:text-white/55" />
          <Badge className="border-[#ebbf5d]/25 bg-[#ebbf5d]/10 text-[#f0cb7c]">
            Private sales demonstration
          </Badge>
        </div>

        <div className="relative z-10 my-auto max-w-2xl py-16">
          <div className="mb-8 flex items-center gap-5">
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-2xl backdrop-blur">
              <Image
                src={organization.logoPath}
                alt="Y-12 Credit Union"
                width={176}
                height={88}
                priority
                className="h-auto w-44"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f0cb7c]">
                Personalized for
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                Y-12 Credit Union
              </p>
              <p className="mt-0.5 text-[10px] text-white/45">
                Fictional demonstration data
              </p>
            </div>
          </div>
          <Badge className="mb-6 border-white/15 bg-white/10 text-white">
            <Sparkles className="mr-1.5 size-3.5" />
            Catalyst Guide Live is ready
          </Badge>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-white xl:text-5xl">
            Procurement that feels ten years ahead.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            One connected operating system for purchasing, approvals, vendor
            risk, receiving, invoices, savings, and examiner-ready evidence.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="mt-10 max-w-xl rounded-3xl border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  FY 2026 YTD spend
                </p>
                <p className="mt-1 text-3xl font-bold tracking-[-0.04em] text-white">
                  $18.42M
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
                <TrendingUp className="size-3.5" />
                4.1% under plan
              </span>
            </div>
            <div className="mt-7 flex h-32 items-end gap-2">
              {[42, 55, 48, 66, 59, 76, 71, 82, 68, 88, 79, 92].map(
                (height, index) => (
                  <motion.span
                    key={`${height}-${index}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{
                      duration: 0.45,
                      delay: 0.25 + index * 0.025,
                    }}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-[#cf4427]/55 to-[#ebbf5d]"
                  />
                ),
              )}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                { label: "Savings", value: "$742K", icon: BarChart3 },
                { label: "Vendors", value: "186", icon: Building2 },
                { label: "Controls", value: "98.6%", icon: ShieldCheck },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.06] p-3"
                  >
                    <Icon className="size-4 text-[#f0cb7c]" />
                    <p className="mt-3 text-lg font-bold text-white">{item.value}</p>
                    <p className="text-[10px] text-slate-400">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400">
          <span>© 2026 Catalyst Innovations</span>
          <span>Private demonstration environment</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 flex items-center justify-between lg:hidden">
            <BrandMark />
            <Badge tone="info">Demo</Badge>
          </div>

          <div className="mb-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm">
              <span className="flex h-12 w-24 items-center justify-center rounded-xl bg-[#041A6C] px-2.5 shadow-lg">
                <Image
                  src={organization.logoPath}
                  alt="Y-12 Credit Union"
                  width={96}
                  height={48}
                  className="h-auto w-full"
                />
              </span>
              <span className="text-sm font-bold text-[var(--foreground)]">
                {organization.name}
              </span>
              <Badge className="ml-1" tone="info">
                Demo
              </Badge>
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.035em] text-[var(--foreground)] sm:text-3xl">
              Welcome to Catalyst
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Sign in to the fictional Y-12 workspace or enter the guided
              product demonstration.
            </p>
          </div>

          <form onSubmit={enterDemo} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-bold text-[var(--foreground)]"
              >
                Work email
              </label>
              <input
                id="email"
                type="email"
                defaultValue="maya.chen@y12cu.example"
                autoComplete="username"
                className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-xs font-bold text-[var(--foreground)]"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs font-bold text-[var(--brand-primary)] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  defaultValue="catalyst-demo"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 pr-12 text-sm text-[var(--foreground)] outline-none transition-shadow focus:ring-2 focus:ring-[var(--brand-primary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Opening workspace...
                </>
              ) : (
                <>
                  Enter demonstration
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-[var(--background)] px-3 text-[var(--muted-foreground)]">
                  Enterprise access
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={() => setLoading(false)}
            >
              <LockKeyhole className="size-4" />
              Continue with SSO
              <Badge className="ml-auto">Preview</Badge>
            </Button>
          </form>

          <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 size-4.5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-bold text-[var(--foreground)]">
                  Safe fictional environment
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted-foreground)]">
                  This private demo uses fictional records and is not connected
                  to Y-12 systems. Financial actions remain human-controlled.
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-[10px] leading-5 text-[var(--muted-foreground)]">
            By continuing, you acknowledge this is a fictional product
            demonstration for Catalyst Innovations.
          </p>
        </motion.div>
      </section>
    </main>
  );
}
