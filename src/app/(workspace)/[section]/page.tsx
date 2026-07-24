import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AiWorkspace } from "@/components/ai/ai-workspace";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import { ModulePage } from "@/components/modules/module-page";
import { titleCase } from "@/lib/utils";

const sections = [
  "dashboard",
  "ai-procurement",
  "purchase-requests",
  "approvals",
  "purchase-orders",
  "receiving",
  "inventory",
  "vendors",
  "vendor-risk",
  "contracts",
  "invoices",
  "analytics",
  "audit-center",
  "administration",
  "settings",
] as const;

type Section = (typeof sections)[number];

export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return {
    title:
      section === "ai-procurement" ? "AI Procurement" : titleCase(section),
  };
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as Section)) notFound();

  if (section === "dashboard") return <ExecutiveDashboard />;
  if (section === "ai-procurement") return <AiWorkspace />;
  return <ModulePage section={section} />;
}
