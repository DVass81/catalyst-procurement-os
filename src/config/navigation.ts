import {
  BarChart3,
  Boxes,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  Landmark,
  PackageCheck,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
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
        label: "Audit Center",
        href: "/audit-center",
        icon: Landmark,
        description: "Controls and audit trail",
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
        label: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Personal preferences",
      },
    ],
  },
] satisfies NavigationSection[];

export const navigationItems = navigationSections.flatMap((section) => section.items);
