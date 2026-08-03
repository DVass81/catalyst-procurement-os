import type { PurchaseRequest } from "@/demo/model";

export interface NaturalWorkflowProfile {
  id: "loan-officer-equipment" | "cybersecurity-renewal" | "emergency-network";
  title: string;
  requestChannel: NonNullable<PurchaseRequest["requestChannel"]>;
  priority: PurchaseRequest["priority"];
  requiredDate: string;
  businessJustification: string;
  emergencyJustification?: string;
  recurringSchedule?: {
    cadence: "monthly" | "quarterly" | "annually";
    startsOn: string;
  };
  attachments: string[];
  vendorId: string;
  contractReference: string;
  invoiceFreightCents: number;
  partialReceiving: boolean;
  lines: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    glAccount: string;
  }>;
}

export const naturalWorkflowProfiles: readonly NaturalWorkflowProfile[] = [
  {
    id: "loan-officer-equipment",
    title: "Loan officer workstation equipment",
    requestChannel: "catalog_goods",
    priority: "normal",
    requiredDate: "2026-09-15",
    businessJustification:
      "Equip four loan officers with approved secure workstations while preserving competitive sourcing, technology review, receiving, and invoice evidence.",
    attachments: ["loan-officer-equipment-specification.pdf"],
    vendorId: "vendor-001",
    contractReference: "contract-001",
    invoiceFreightCents: 7_500,
    partialReceiving: true,
    lines: [
      {
        description: "Approved secure loan officer computer technology",
        quantity: 4,
        unitPriceCents: 120_000,
        glAccount: "6100-EQUIPMENT",
      },
    ],
  },
  {
    id: "cybersecurity-renewal",
    title: "Managed cybersecurity monitoring renewal",
    requestChannel: "recurring",
    priority: "high",
    requiredDate: "2026-10-01",
    businessJustification:
      "Renew governed cybersecurity monitoring and incident support with contract reference, explicit service acceptance, invoice reconciliation, and renewal evidence.",
    recurringSchedule: { cadence: "annually", startsOn: "2026-10-01" },
    attachments: ["managed-cybersecurity-renewal-sow.pdf"],
    vendorId: "vendor-003",
    contractReference: "contract-003",
    invoiceFreightCents: 0,
    partialReceiving: false,
    lines: [
      {
        description: "Annual managed cybersecurity monitoring service renewal",
        quantity: 1,
        unitPriceCents: 480_000,
        glAccount: "6200-IT-SERVICES",
      },
    ],
  },
  {
    id: "emergency-network",
    title: "Emergency branch network replacement",
    requestChannel: "emergency",
    priority: "urgent",
    requiredDate: "2026-08-03",
    businessJustification:
      "Replace failed branch network equipment required for continuity of approved operations while retaining independent review and complete exception evidence.",
    emergencyJustification:
      "The branch network failed unexpectedly and no ordinary sourcing timeline can restore essential branch connectivity before the documented operational deadline.",
    attachments: ["branch-network-incident-record.pdf"],
    vendorId: "vendor-001",
    contractReference: "contract-001",
    invoiceFreightCents: 2_500,
    partialReceiving: false,
    lines: [
      {
        description: "Emergency secure branch network replacement technology",
        quantity: 1,
        unitPriceCents: 150_000,
        glAccount: "6100-NETWORK-EQUIPMENT",
      },
    ],
  },
] as const;
