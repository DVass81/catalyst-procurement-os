"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Lightbulb,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const spendTrend = [
  { month: "Feb", spend: 2.1, budget: 2.4 },
  { month: "Mar", spend: 2.35, budget: 2.5 },
  { month: "Apr", spend: 2.62, budget: 2.58 },
  { month: "May", spend: 2.48, budget: 2.66 },
  { month: "Jun", spend: 2.91, budget: 2.73 },
  { month: "Jul", spend: 2.76, budget: 2.82 },
];

const departmentSpend = [
  { department: "IT", spend: 5.42 },
  { department: "Branch Ops", spend: 3.18 },
  { department: "Facilities", spend: 2.44 },
  { department: "Marketing", spend: 1.86 },
  { department: "Risk", spend: 1.42 },
];

const vendorSpend = [
  { name: "Fiserv", value: 32, color: "#2547d0" },
  { name: "CDW-G", value: 24, color: "#5d7cff" },
  { name: "NCR Atleos", value: 18, color: "#8d9dff" },
  { name: "Other", value: 26, color: "#d6dcf7" },
];

const metricCards = [
  {
    label: "FY 2026 YTD Spend",
    value: "$18.42M",
    detail: "61.8% of $29.8M budget",
    trend: "+4.2%",
    icon: CircleDollarSign,
    positive: false,
  },
  {
    label: "Realized Savings",
    value: "$742K",
    detail: "$1.04M validated pipeline",
    trend: "+12.6%",
    icon: TrendingDown,
    positive: true,
  },
  {
    label: "Pending Approvals",
    value: "9",
    detail: "2 requests over SLA",
    trend: "3 urgent",
    icon: FileCheck2,
    positive: false,
  },
  {
    label: "Active Vendors",
    value: "186",
    detail: "3 require risk attention",
    trend: "97.2%",
    icon: Users,
    positive: true,
  },
];

const activity = [
  {
    title: "PR-2026-0148 submitted",
    detail: "Jordan Lee · 24 branch workstations · $38,640",
    time: "8 minutes ago",
    icon: FileCheck2,
    tone: "info" as const,
  },
  {
    title: "Approval completed",
    detail: "Priya Shah approved cybersecurity renewal · $126,000",
    time: "34 minutes ago",
    icon: PackageCheck,
    tone: "success" as const,
  },
  {
    title: "Receiving exception",
    detail: "PO-2026-0087 · 6 units are backordered",
    time: "1 hour ago",
    icon: ShieldAlert,
    tone: "warning" as const,
  },
  {
    title: "Contract notice approaching",
    detail: "Fiserv agreement · Notice due August 31",
    time: "2 hours ago",
    icon: Clock3,
    tone: "danger" as const,
  },
];

const quickActions = [
  { label: "New request", icon: Plus, href: "/purchase-requests" },
  { label: "Review approvals", icon: FileCheck2, href: "/approvals" },
  { label: "Add vendor", icon: Users, href: "/vendors" },
  { label: "Renewal review", icon: RefreshCw, href: "/contracts" },
];

function MetricCard({
  metric,
  index,
}: {
  metric: (typeof metricCards)[number];
  index: number;
}) {
  const Icon = metric.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5">
        <CardContent className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-bold",
                metric.positive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-[var(--muted-foreground)]",
              )}
            >
              {metric.positive && (
                <TrendingUp className="size-3.5" aria-hidden="true" />
              )}
              {metric.trend}
            </span>
          </div>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {metric.label}
          </p>
          <p className="mt-1 text-[1.7rem] font-bold tracking-[-0.04em] text-[var(--foreground)]">
            {metric.value}
          </p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {metric.detail}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ExecutiveDashboard() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-7 shadow-[var(--shadow-card)] lg:px-8">
        <div className="absolute inset-y-0 right-0 hidden w-[44%] bg-[radial-gradient(circle_at_70%_35%,color-mix(in_srgb,var(--brand-primary)_14%,transparent),transparent_62%)] lg:block" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <Badge tone="info" className="mb-4 gap-1.5">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Friday, July 24 · Executive overview
            </Badge>
            <h1 className="max-w-2xl text-2xl font-bold tracking-[-0.035em] text-[var(--foreground)] sm:text-3xl">
              Good afternoon, Maya.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-[15px]">
              Procurement is operating within plan. Two approvals need attention,
              and AI identified a new software consolidation opportunity.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" asChild>
              <Link href="/ai-procurement">
                <Bot className="size-4" aria-hidden="true" />
                Ask Catalyst AI
              </Link>
            </Button>
            <Button asChild>
              <Link href="/purchase-requests">
                <Plus className="size-4" aria-hidden="true" />
                New purchase request
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-label="Procurement key performance indicators"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {metricCards.map((metric, index) => (
          <MetricCard key={metric.label} metric={metric} index={index} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.9fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="text-base font-bold text-[var(--foreground)]">
                Spend trend
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Monthly actual versus operating plan · USD millions
              </p>
            </div>
            <Badge tone="success">4.1% under plan YTD</Badge>
          </CardHeader>
          <CardContent className="pt-6">
            <div
              className="h-[280px] w-full"
              role="img"
              aria-label="Monthly spend ranged from 2.1 to 2.91 million dollars, remaining 4.1 percent under plan year to date."
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendTrend}>
                  <defs>
                    <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3559e6" stopOpacity={0.24} />
                      <stop offset="100%" stopColor="#3559e6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickFormatter={(value: number) => `$${value}M`}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      boxShadow: "var(--shadow-card)",
                    }}
                    formatter={(value) => [`$${value}M`]}
                  />
                  <Area
                    type="monotone"
                    dataKey="budget"
                    stroke="#a7b0c7"
                    strokeDasharray="5 5"
                    fill="transparent"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="#3559e6"
                    fill="url(#spend-fill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-center gap-5 text-xs text-[var(--muted-foreground)]">
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 bg-[#3559e6]" /> Actual spend
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 border-t-2 border-dashed border-[#a7b0c7]" />
                Operating plan
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <p className="text-base font-bold text-[var(--foreground)]">
                Catalyst AI insight
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                New opportunity detected
              </p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
              <Lightbulb className="size-4.5" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.06] p-4">
              <Badge className="mb-3 border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                $96K estimated opportunity
              </Badge>
              <h2 className="text-base font-bold leading-6 text-[var(--foreground)]">
                Consolidate overlapping collaboration software
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Three active subscriptions across IT and Marketing appear to
                provide overlapping functionality. Renewal windows align within
                74 days.
              </p>
              <Link
                href="/ai-procurement"
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-primary)] hover:underline"
              >
                Review analysis
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted-foreground)]">
                  Confidence
                </span>
                <span className="font-bold text-[var(--foreground)]">92%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div className="h-full w-[92%] rounded-full bg-[var(--brand-primary)]" />
              </div>
              <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                Based on contract metadata, department ownership, and current
                license counts. Preview analysis only.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <p className="text-base font-bold text-[var(--foreground)]">
                Spend by department
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Top five departments · FY 2026 YTD
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/analytics">
                View analytics
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div
              className="h-[250px]"
              role="img"
              aria-label="IT leads department spend at 5.42 million dollars, followed by Branch Operations at 3.18 million."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentSpend} layout="vertical">
                  <CartesianGrid
                    horizontal={false}
                    stroke="var(--chart-grid)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickFormatter={(value: number) => `$${value}M`}
                  />
                  <YAxis
                    type="category"
                    dataKey="department"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    width={78}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-muted)" }}
                    contentStyle={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    formatter={(value) => [`$${value}M`, "Spend"]}
                  />
                  <Bar
                    dataKey="spend"
                    fill="#3559e6"
                    radius={[0, 8, 8, 0]}
                    barSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-base font-bold text-[var(--foreground)]">
                Spend by vendor
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Share of addressable spend
              </p>
            </div>
            <Badge>14.6% concentration</Badge>
          </CardHeader>
          <CardContent className="grid items-center gap-5 pt-3 sm:grid-cols-[0.9fr_1.1fr]">
            <div
              className="relative h-[220px]"
              role="img"
              aria-label="Fiserv represents 32 percent of addressable spend, CDW-G 24 percent, NCR Atleos 18 percent, and other vendors 26 percent."
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vendorSpend}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={83}
                    paddingAngle={3}
                    stroke="transparent"
                  >
                    {vendorSpend.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    formatter={(value) => [`${value}%`, "Share"]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-[var(--foreground)]">
                  $14.85M
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                  Addressable
                </span>
              </div>
            </div>
            <div className="space-y-3">
              {vendorSpend.map((vendor) => (
                <div
                  key={vendor.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2 text-[var(--muted-foreground)]">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: vendor.color }}
                    />
                    {vendor.name}
                  </span>
                  <span className="font-bold text-[var(--foreground)]">
                    {vendor.value}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <div>
              <p className="text-base font-bold text-[var(--foreground)]">
                Recent activity
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Live preview of purchasing events
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/audit-center">
                View audit center
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[var(--border)]">
              {activity.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 py-4 first:pt-1 last:pb-0"
                  >
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]">
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[var(--foreground)]">
                          {item.title}
                        </p>
                        <Badge tone={item.tone}>{item.time}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-base font-bold text-[var(--foreground)]">
                Quick actions
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Common procurement tasks
              </p>
            </div>
            <WalletCards
              className="size-5 text-[var(--brand-primary)]"
              aria-hidden="true"
            />
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="group flex w-full items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-[var(--foreground)]">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    {action.label}
                  </span>
                  <ArrowRight className="size-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
