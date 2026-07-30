import {
  BarChart3,
  Accessibility,
  Boxes,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  GitBranch,
  KeyRound,
  Landmark,
  Network,
  PackageCheck,
  ReceiptText,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
};

export type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export const navigationSections = [
  {
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: Gauge,
        description: "Executive procurement overview",
      },
      {
        label: "AI Procurement",
        href: "/ai-procurement",
        icon: BrainCircuit,
        description: "Procurement intelligence assistant",
        badge: "AI",
      },
      {
        label: "Golden Thread",
        href: "/golden-thread",
        icon: GitBranch,
        description: "Presenter story, preflight, and evidence",
      },
    ],
  },
  {
    label: "Procure to Pay",
    items: [
      {
        label: "Purchase Requests",
        href: "/purchase-requests",
        icon: ShoppingCart,
        description: "Requests and intake",
      },
      {
        label: "RFQs & Sourcing",
        href: "/rfqs",
        icon: Send,
        description: "Solicitations, sealed responses, evaluation, and award",
      },
      {
        label: "Approvals",
        href: "/approvals",
        icon: ClipboardCheck,
        description: "Review and decision queue",
        badge: "4",
      },
      {
        label: "Purchase Orders",
        href: "/purchase-orders",
        icon: FileCheck2,
        description: "Issued orders and fulfillment",
      },
      {
        label: "Receiving",
        href: "/receiving",
        icon: PackageCheck,
        description: "Deliveries and receipts",
      },
      {
        label: "Mobile Work",
        href: "/mobile-work",
        icon: Smartphone,
        description: "Responsive approval and receiving",
      },
      {
        label: "Inventory",
        href: "/inventory",
        icon: Boxes,
        description: "Stock and replenishment",
      },
      {
        label: "Invoices",
        href: "/invoices",
        icon: ReceiptText,
        description: "Invoice review and matching",
      },
    ],
  },
  {
    label: "Suppliers & Agreements",
    items: [
      {
        label: "Vendor Management",
        href: "/vendors",
        icon: Building2,
        description: "Supplier relationships",
      },
      {
        label: "Supplier Onboarding",
        href: "/supplier-onboarding",
        icon: Users,
        description: "Supplier evidence and lifecycle controls",
      },
      {
        label: "Vendor Risk",
        href: "/vendor-risk",
        icon: ShieldCheck,
        description: "Third-party risk posture",
      },
      {
        label: "Contracts",
        href: "/contracts",
        icon: FileText,
        description: "Agreements and renewals",
      },
      {
        label: "Contract Intelligence",
        href: "/contract-intelligence",
        icon: FileText,
        description: "Cited findings, obligations, and conflicts",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        label: "Analytics",
        href: "/analytics",
        icon: BarChart3,
        description: "Spend and performance insights",
      },
      {
        label: "Reporting Studio",
        href: "/reporting-studio",
        icon: BarChart3,
        description: "Certified measures and governed reports",
      },
      {
        label: "Audit Center",
        href: "/audit-center",
        icon: Landmark,
        description: "Controls and audit trail",
      },
      {
        label: "Trust Center",
        href: "/trust-center",
        icon: ShieldCheck,
        description: "Capability truth and assurance evidence",
      },
      {
        label: "Accessibility",
        href: "/accessibility-center",
        icon: Accessibility,
        description: "Inclusive experience evidence",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Administration",
        href: "/administration",
        icon: SlidersHorizontal,
        description: "Organization configuration",
      },
      {
        label: "Integration Center",
        href: "/integration-center",
        icon: Network,
        description: "Mappings, runs, and reconciliation",
      },
      {
        label: "Enterprise Access",
        href: "/enterprise-access",
        icon: KeyRound,
        description: "Identity templates and Catalyst authority",
      },
      {
        label: "Workflow Studio",
        href: "/workflow-studio",
        icon: Workflow,
        description: "Governed workflow configuration",
      },
      {
        label: "Operations Center",
        href: "/operations-center",
        icon: Gauge,
        description: "Health, incidents, support, and fallback",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Personal preferences",
      },
    ],
  },
] satisfies NavigationSection[];

export const navigationItems = navigationSections.flatMap((section) => section.items);
