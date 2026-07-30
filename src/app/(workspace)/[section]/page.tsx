import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { PhaseTwoPage } from "@/components/demo/phase-two-page";
import { PhaseThreePage } from "@/components/commercialization/phase-three-page";
import {
  canAccessWorkspaceSection,
  isWorkspaceSection,
  workspaceSections,
} from "@/config/module-access";
import { titleCase } from "@/lib/utils";
import { activeRoleAssignments } from "@/server/auth/authority";
import { getAppSession } from "@/server/auth/session";

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

export function generateStaticParams() {
  return workspaceSections.map((section) => ({ section }));
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
  if (!isWorkspaceSection(section)) notFound();
  const session = await getAppSession();
  if (!session) notFound();
  if (!session.presenter) {
    const cookieStore = await cookies();
    const selectedTenant = cookieStore.get("catalyst-active-tenant")?.value;
    const selectedRole = cookieStore.get("catalyst-active-role")?.value;
    const authority =
      (selectedTenant && session.authorities[selectedTenant]) ||
      (session.tenantIds.length === 1
        ? session.authorities[session.tenantIds[0]!]
        : undefined);
    const assignedRoles = activeRoleAssignments(authority?.roles ?? []).filter(
      (assignment) =>
        assignment.assignmentType !== "presenter_simulation",
    );
    const assignment =
      assignedRoles.find((candidate) => candidate.role === selectedRole) ??
      (assignedRoles.length === 1 ? assignedRoles[0] : undefined);
    if (!assignment && section !== "dashboard") notFound();
    if (
      assignment &&
      !canAccessWorkspaceSection(assignment.role, section)
    ) {
      notFound();
    }
  }

  if (
    commercializationSections.includes(
      section as (typeof commercializationSections)[number],
    )
  ) {
    return <PhaseThreePage section={section} />;
  }
  return <PhaseTwoPage section={section} />;
}
