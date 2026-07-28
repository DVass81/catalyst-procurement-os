import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PhaseTwoPage } from "@/components/demo/phase-two-page";
import { PhaseThreePage } from "@/components/commercialization/phase-three-page";
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
  "integration-center",
  "enterprise-access",
  "supplier-onboarding",
  "contract-intelligence",
  "workflow-studio",
  "mobile-work",
  "reporting-studio",
  "trust-center",
  "accessibility-center",
  "operations-center",
  "golden-thread",
] as const;

const commercializationSections = [
  "integration-center",
  "enterprise-access",
  "supplier-onboarding",
  "contract-intelligence",
  "workflow-studio",
  "mobile-work",
  "reporting-studio",
  "trust-center",
  "accessibility-center",
  "operations-center",
  "golden-thread",
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

  if (
    commercializationSections.includes(
      section as (typeof commercializationSections)[number],
    )
  ) {
    return <PhaseThreePage section={section} />;
  }
  return <PhaseTwoPage section={section} />;
}
