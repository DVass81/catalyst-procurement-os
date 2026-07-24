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
  primaryColor: "#003C79",
  secondaryColor: "#0077D4",
  accentColor: "#F37120",
  neutrals: ["#111827", "#475467", "#98A2B3", "#EAECF0", "#F8FAFC"],
  backgroundColor: "#F5F8FC",
  sidebarColor: "#003C79",
  buttonColor: "#003C79",
  linkColor: "#003C79",
  chartColors: ["#003C79", "#0077D4", "#F37120", "#FFC726", "#98CCC9"],
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
