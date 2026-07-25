import type { TenantDemoConfig } from "@/ai/types";
import type { OrganizationTheme } from "@/demo/model";

import { catalystCommunityTheme } from "./catalyst-community";
import { y12DemoTheme } from "./y12-demo";

export const tenantThemes = {
  "org-y12-demo": y12DemoTheme,
  "org-catalyst-community-demo": catalystCommunityTheme,
} satisfies Record<string, OrganizationTheme>;

export type TenantId = keyof typeof tenantThemes;

export const tenantDemoConfigs: Record<TenantId, TenantDemoConfig> = {
  "org-y12-demo": {
    id: "org-y12-demo",
    organizationName: "Y-12 Credit Union",
    organizationShortName: "Y-12",
    logoPath: y12DemoTheme.logoPath,
    primaryColor: y12DemoTheme.primaryColor,
    secondaryColor: y12DemoTheme.secondaryColor,
    accentColor: y12DemoTheme.accentColor,
    terminology: {
      request: "purchase request",
      member: "member",
      location: "branch",
    },
    policyProfile: "y12-fictional-demo-policy-v1",
    dataPackId: "y12-demo-2026",
    aiContext:
      "A private, fictional procurement demonstration personalized for Y-12 Credit Union. Never imply endorsement or connection to Y-12 systems.",
    disclaimer: y12DemoTheme.nonEndorsementNotice,
    narrationGreeting:
      "Welcome to the Y-12 Credit Union demonstration environment. Everything we explore uses fictional data and remains under human control.",
  },
  "org-catalyst-community-demo": {
    id: "org-catalyst-community-demo",
    organizationName: "Catalyst Community Credit Union",
    organizationShortName: "Catalyst Community",
    logoPath: catalystCommunityTheme.logoPath,
    primaryColor: catalystCommunityTheme.primaryColor,
    secondaryColor: catalystCommunityTheme.secondaryColor,
    accentColor: catalystCommunityTheme.accentColor,
    terminology: {
      request: "purchase request",
      member: "member",
      location: "service center",
    },
    policyProfile: "catalyst-community-fictional-policy-v1",
    dataPackId: "catalyst-community-demo-2026",
    aiContext:
      "A wholly fictional credit-union tenant used to demonstrate white-label tenant isolation and configurable procurement policies.",
    disclaimer: catalystCommunityTheme.nonEndorsementNotice,
    narrationGreeting:
      "Welcome to Catalyst Community Credit Union, our completely fictional tenant. This shows how the same platform adapts to another credit union without sharing any tenant data.",
  },
};

export function isTenantId(value: string): value is TenantId {
  return value in tenantThemes;
}
