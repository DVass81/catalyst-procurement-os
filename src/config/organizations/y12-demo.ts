import type { OrganizationTheme } from "@/demo/model";

/**
 * Public-facing Y-12 brand references are used only in this private,
 * fictional sales demonstration. Catalyst ownership and non-endorsement
 * language remain visible throughout the experience.
 */
export const y12DemoTheme: OrganizationTheme = {
  organizationId: "org-y12-demo",
  organizationName: "Y-12 Credit Union",
  organizationShortName: "Y-12",
  legalName: "Y-12 Federal Credit Union",
  productName: "Catalyst Procurement OS",
  logoPath: "/brand/y12/Y-12-Logo-White.png",
  faviconPath: "/brand/y12/favicon.png",
  primaryColor: "#041A6C",
  secondaryColor: "#CF4427",
  accentColor: "#EBBF5D",
  neutrals: ["#101B3B", "#47506A", "#8C91A3", "#E5E1D8", "#F7F6F1"],
  backgroundColor: "#F7F6F1",
  sidebarColor: "#041A6C",
  buttonColor: "#CF4427",
  linkColor: "#041A6C",
  chartColors: ["#041A6C", "#CF4427", "#EBBF5D", "#404287", "#F0CB7C"],
  fiscalYear: "FY2026",
  currency: "USD",
  locale: "en-US",
  timezone: "America/New_York",
  supportContact: "demo-support@catalystinnovations.example",
  dashboardGreeting: "Good afternoon",
  requestTerm: "Purchase request",
  nonEndorsementNotice:
    "Fictional demonstration data. This environment is not connected to Y-12 Credit Union systems. Y-12 Credit Union has not endorsed, purchased, commissioned, approved, or implemented this software.",
  approvalThresholdCents: 2_500_000,
  budgetReviewThreshold: 0.8,
};
