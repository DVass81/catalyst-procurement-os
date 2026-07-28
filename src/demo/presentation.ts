import type { BadgeTone } from "@/components/ui/badge";

export interface StatusPresentation {
  label: string;
  tone: BadgeTone;
}

const statuses: Record<string, StatusPresentation> = {
  urgent_priority: { label: "Urgent Priority", tone: "danger" },
  high_priority: { label: "High Priority", tone: "warning" },
  standard_priority: { label: "Standard Priority", tone: "neutral" },
  not_started: { label: "Not Started", tone: "neutral" },
  within_budget: { label: "Within Budget", tone: "success" },
  review_threshold: { label: "Budget Review Required", tone: "warning" },
  over_budget: { label: "Over Budget", tone: "danger" },
  converted_to_po: { label: "Converted to Purchase Order", tone: "success" },
  substitution_recommended: { label: "Approved Substitute Recommended", tone: "warning" },
  exception_required: { label: "Exception Required", tone: "danger" },
  not_received: { label: "Awaiting Receipt", tone: "neutral" },
  pending_match: { label: "Pending Invoice Match", tone: "warning" },
  freight_variance: { label: "Freight Charge Variance", tone: "danger" },
  on_hold: { label: "Payment on Hold", tone: "danger" },
  renewal_due: { label: "Renewal Decision Required", tone: "warning" },
  review_due: { label: "Review Due", tone: "warning" },
  approaching_due: { label: "Due Soon", tone: "warning" },
  fully_received: { label: "Fully Received", tone: "success" },
  partially_received: { label: "Partially Received", tone: "warning" },
  awaiting_issuance: { label: "Awaiting Issuance", tone: "warning" },
  accepted_with_justification: { label: "Accepted with Justification", tone: "warning" },
  correction_requested: { label: "Corrected Invoice Requested", tone: "warning" },
  accepted_damage: { label: "Accepted after Inspection", tone: "warning" },
  rejected_damage: { label: "Rejected for Damage", tone: "danger" },
  possible: { label: "Possible Duplicate", tone: "warning" },
  not_required: { label: "Not Required", tone: "neutral" },
  incomplete: { label: "Incomplete", tone: "danger" },
  missing: { label: "Missing", tone: "danger" },
  possible_match: { label: "Possible Match", tone: "danger" },
  undisclosed: { label: "Undisclosed Conflict", tone: "danger" },
  high: { label: "High Risk", tone: "danger" },
  moderate: { label: "Moderate Risk", tone: "warning" },
  low: { label: "Low Risk", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  complete: { label: "Complete", tone: "success" },
  current: { label: "Current", tone: "success" },
  active: { label: "Active", tone: "success" },
  clear: { label: "Clear", tone: "success" },
  ready: { label: "Ready", tone: "success" },
  exported: { label: "Payment-Readiness Exported", tone: "success" },
  matched: { label: "Matched", tone: "success" },
  issued: { label: "Issued", tone: "info" },
  acknowledged: { label: "Acknowledged", tone: "info" },
  submitted: { label: "Submitted", tone: "info" },
  draft: { label: "Draft", tone: "info" },
  returned: { label: "Returned for Changes", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  overdue: { label: "Overdue", tone: "danger" },
  exception: { label: "Exception", tone: "danger" },
  routed: { label: "Routed for Review", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  expiring: { label: "Expiring", tone: "warning" },
  none: { label: "None", tone: "neutral" },
  partial: { label: "Partial", tone: "warning" },
  inactive: { label: "Inactive", tone: "neutral" },
  eligible: { label: "Eligible", tone: "success" },
  ineligible: { label: "Ineligible", tone: "danger" },
  recommended: { label: "Recommended", tone: "success" },
  requested: { label: "Requested", tone: "info" },
  purchasing_approved: { label: "Purchasing Approved", tone: "warning" },
};

export function statusPresentation(value: string) {
  return statuses[value.toLowerCase().replaceAll(" ", "_")];
}

export function statusLabel(value: string) {
  return statusPresentation(value)?.label ?? value;
}
