"use client";

import type { WorkflowStage } from "@/demo/model";

export const workflowSteps: ReadonlyArray<{
  label: string;
  stage: WorkflowStage;
}> = [
  { label: "Request", stage: "draft" },
  { label: "Inventory", stage: "inventory_reviewed" },
  { label: "Standards", stage: "standards_reviewed" },
  { label: "Vendor", stage: "vendor_selected" },
  { label: "Budget", stage: "budget_confirmed" },
  { label: "Approvals", stage: "submitted" },
  { label: "PO", stage: "po_draft" },
  { label: "Receipt", stage: "fully_received" },
  { label: "Invoice & Audit", stage: "invoice_exception" },
];

const stageRanks: Record<WorkflowStage, number> = {
  draft: 0,
  analyzed: 0,
  inventory_reviewed: 1,
  standards_reviewed: 2,
  vendor_selected: 3,
  budget_confirmed: 4,
  submitted: 5,
  manager_approved: 5,
  it_approved: 5,
  purchasing_approved: 5,
  approved: 5,
  po_draft: 6,
  po_issued: 6,
  acknowledged: 6,
  fully_received: 7,
  invoice_exception: 8,
  exception_routed: 8,
  correction_requested: 8,
  variance_accepted: 8,
  resolved: 8,
};

export type WorkflowStepState = "completed" | "current" | "upcoming";

export function workflowStageRank(stage: WorkflowStage) {
  return stageRanks[stage];
}

export function workflowStepState(
  stage: WorkflowStage,
  index: number,
): WorkflowStepState {
  const active = workflowStageRank(stage);
  if (index < active) return "completed";
  if (index === active) return "current";
  return "upcoming";
}

export function isWorkflowActivationKey(key: string) {
  return key === "Enter" || key === " ";
}

const stepStyles: Record<WorkflowStepState, string> = {
  current:
    "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-sm",
  completed:
    "border-sky-200 bg-sky-50 text-[var(--brand-primary)] dark:border-sky-900 dark:bg-sky-950/30",
  upcoming:
    "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]",
};

export function WorkflowRail({
  stage,
  presenter,
  pending,
  readOnly,
  error,
  onJump,
}: {
  stage: WorkflowStage;
  presenter: boolean;
  pending: boolean;
  readOnly: boolean;
  error?: string | null;
  onJump: (stage: WorkflowStage, label: string) => void;
}) {
  const unavailable = readOnly || Boolean(error);
  const status = error
    ? `Workflow navigation unavailable: ${error}`
    : pending
      ? "Loading the selected workflow stage."
      : presenter
        ? "Presenter workflow navigation. Select a step to load its deterministic demonstration state."
        : "Workflow progress is read-only.";

  return (
    <section aria-label="Featured workflow">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        <span>Featured workflow</span>
        <span>{presenter ? "Presenter navigation" : "Read-only progress"}</span>
      </div>
      <p id="workflow-rail-status" className="sr-only" aria-live="polite">
        {status}
      </p>
      <ol
        className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
        aria-busy={pending}
      >
        {workflowSteps.map(({ label, stage: targetStage }, index) => {
          const state = workflowStepState(stage, index);
          const className = `min-w-28 rounded-xl border px-3 py-2 text-center text-[10px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 ${stepStyles[state]} ${
            presenter && state !== "current" && !unavailable && !pending
              ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-sm"
              : ""
          } ${unavailable ? "opacity-60" : ""}`;
          const content = (
            <>
              <span aria-hidden="true">{index + 1}. </span>
              {label}
              <span className="sr-only"> â€” {state}</span>
            </>
          );

          return (
            <li
              key={label}
              data-tour-id={`workflow-${label
                .toLowerCase()
                .replaceAll(" ", "-")
                .replaceAll("&", "and")}`}
            >
              {presenter ? (
                <button
                  type="button"
                  className={className}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-describedby="workflow-rail-status"
                  aria-label={`Jump to workflow step ${index + 1}: ${label}`}
                  disabled={pending || unavailable || state === "current"}
                  onClick={() => onJump(targetStage, label)}
                  onKeyDown={(event) => {
                    if (isWorkflowActivationKey(event.key)) {
                      event.preventDefault();
                      onJump(targetStage, label);
                    }
                  }}
                >
                  {content}
                </button>
              ) : (
                <span
                  className={`block ${className}`}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

