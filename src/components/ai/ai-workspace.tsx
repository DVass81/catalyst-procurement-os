"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  CalendarPlus,
  ExternalLink,
  FileSearch2,
  MailPlus,
  Mic,
  Paperclip,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import type {
  AiCapability,
  AiRunResult,
  ProposedAction,
} from "@/ai/types";
import { useDemo } from "@/components/demo/demo-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const prompts: Array<{
  label: string;
  prompt: string;
  capability: AiCapability;
}> = [
  {
    label: "Hero request",
    prompt:
      "Create a requisition for laptops, monitors, docks, headsets, and chairs for three new loan officers.",
    capability: "requisition",
  },
  {
    label: "Quote intelligence",
    prompt:
      "Compare the fictional vendor quotes and recommend the best risk-adjusted value.",
    capability: "quote_comparison",
  },
  {
    label: "Invoice exception",
    prompt:
      "Run the three-way match and explain the featured invoice exception.",
    capability: "invoice_match",
  },
  {
    label: "Contract review",
    prompt:
      "Which fictional contracts need attention and what termination deadlines matter?",
    capability: "contract_review",
  },
  {
    label: "Vendor indicators",
    prompt:
      "Summarize elevated vendor-risk indicators without making a compliance determination.",
    capability: "vendor_risk",
  },
  {
    label: "Posted spend",
    prompt:
      "What is current posted spend, what evidence supports it, and what action should a purchasing manager take next?",
    capability: "posted_spend",
  },
  {
    label: "Savings",
    prompt:
      "Where are the strongest procurement savings in this fictional portfolio?",
    capability: "spend_intelligence",
  },
];

function ActionCard({
  action,
  tenantId,
}: {
  action: ProposedAction;
  tenantId: string;
}) {
  const [status, setStatus] = useState<"ready" | "working" | "complete" | "error">(
    "ready",
  );
  const [message, setMessage] = useState("");
  const Icon = action.toolName.includes("calendar") ? CalendarPlus : MailPlus;

  async function confirm() {
    setStatus("working");
    const response = await fetch("/api/actions/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId,
        action,
        confirmationToken: action.confirmationToken,
      }),
    });
    const result = (await response.json()) as { message?: string };
    setMessage(result.message ?? (response.ok ? "Action completed." : "Action failed."));
    setStatus(response.ok ? "complete" : "error");
  }

  return (
    <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-amber-950">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-200/70">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">{action.title}</p>
            <Badge className="border-amber-300 bg-white/70 text-amber-900">
              Confirmation required
            </Badge>
          </div>
          <dl className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2">
            <div>
              <dt className="font-black">Destination</dt>
              <dd>{action.destination}</dd>
            </div>
            <div>
              <dt className="font-black">Consequence</dt>
              <dd>{action.consequence}</dd>
            </div>
          </dl>
          <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs leading-5">
            {action.payloadSummary}
          </p>
          {!action.confirmationRequired && action.href ? (
            <Button size="sm" className="mt-3" asChild>
              <Link href={action.href}>Open for human review</Link>
            </Button>
          ) : status === "complete" || status === "error" ? (
            <p
              role="status"
              className={cn(
                "mt-3 text-xs font-bold",
                status === "complete" ? "text-emerald-700" : "text-rose-700",
              )}
            >
              {message}
            </p>
          ) : (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => void confirm()}
              disabled={status === "working"}
            >
              {status === "working" ? "Confirming…" : "Review and confirm"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AiWorkspace() {
  const { state } = useDemo();
  const [prompt, setPrompt] = useState("");
  const [submitted, setSubmitted] = useState(
    "Create a requisition for laptops, monitors, docks, headsets, and chairs for three new loan officers.",
  );
  const [result, setResult] = useState<AiRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = `cate-${useId()}`;

  async function run(value = prompt, capability?: AiCapability) {
    const question = value.trim();
    if (!question) return;
    setLoading(true);
    setError("");
    setFeedbackStatus("");
    setSubmitted(question);
    try {
      const metadata = {
          tenantId: state.organization.organizationId,
          prompt: question,
          capability,
          currentRoute: "/ai-procurement",
          role: state.activeRole,
          workflowStage: state.stage,
          mode: "auto",
          fictionalDataAcknowledged: acknowledged,
          attachmentIds: attachment ? [attachment.name] : [],
      };
      const requestBody = attachment
        ? (() => {
            const form = new FormData();
            form.append("file", attachment);
            form.append("metadata", JSON.stringify(metadata));
            form.append("fictionalDataAcknowledged", String(acknowledged));
            return form;
          })()
        : JSON.stringify(metadata);
      const response = await fetch(
        attachment ? "/api/ai/documents" : "/api/ai/respond",
        {
          method: "POST",
          headers: {
            ...(attachment ? {} : { "Content-Type": "application/json" }),
            "X-Catalyst-Session": sessionId,
          },
          body: requestBody,
        },
      );
      const data = (await response.json()) as AiRunResult & { message?: string };
      if (!response.ok) throw new Error(data.message ?? "CATE could not answer.");
      setResult(data);
      setPrompt("");
    } catch (runError) {
      setError(
        runError instanceof Error
          ? runError.message
          : "The procurement concierge is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(disposition: "accepted" | "rejected") {
    if (!result) return;
    setFeedbackStatus("Recording feedback…");
    const response = await fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: state.organization.organizationId,
        runId: result.runId,
        disposition,
        reason:
          disposition === "accepted"
            ? "The answer directly addressed the question and the cited evidence was verified."
            : "The answer or cited grounding requires correction before it can support a decision.",
      }),
    });
    const data = (await response.json()) as { message?: string };
    setFeedbackStatus(
      data.message ??
        (response.ok
          ? "Feedback recorded."
          : "Feedback could not be recorded."),
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-elevated)]">
      <header className="relative overflow-hidden bg-[var(--brand-primary)] px-5 py-6 text-white sm:px-8">
        <div className="absolute -right-16 -top-24 size-72 rounded-full bg-[var(--brand-secondary)]/35 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 size-64 rounded-full bg-[var(--brand-accent)]/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-accent)] to-[var(--brand-secondary)] text-[var(--brand-primary)] shadow-xl">
              <Sparkles className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                  CATE · Catalyst AI for Trusted Evaluation
                </h1>
                <Badge className="border-white/15 bg-white/10 text-white">
                  Advisory AI
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/65">
                Grounded in {state.organization.organizationShortName} fictional
                records · human-controlled actions
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("catalyst-guide-open"))
            }
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[var(--brand-primary)] shadow-lg transition hover:-translate-y-0.5"
          >
            <Mic className="size-4" />
            Talk Live
          </button>
        </div>
      </header>

      <div className="grid min-h-[650px] lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="border-b border-[var(--border)] bg-[var(--surface-subtle)] p-4 lg:border-b-0 lg:border-r">
          <p className="px-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            Demonstration moments
          </p>
          <div className="mt-3 space-y-2">
            {prompts.map((item) => (
              <button
                key={item.label}
                onClick={() => void run(item.prompt, item.capability)}
                className="group w-full rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-[var(--border)] hover:bg-[var(--surface)] hover:shadow-sm"
              >
                <span className="block text-xs font-black text-[var(--foreground)]">
                  {item.label}
                </span>
                <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--muted-foreground)]">
                  {item.prompt}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <div className="flex items-center gap-2 text-xs font-black">
              <ShieldCheck className="size-4" />
              Financial guardrails
            </div>
            <p className="mt-2 text-[11px] leading-5">
              CATE analyzes and proposes. People approve, award, issue,
              receive, resolve, and pay.
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-7 sm:px-8">
            <div className="mx-auto max-w-4xl space-y-6">
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[var(--brand-primary)] px-4 py-3 text-sm leading-6 text-white">
                {submitted}
              </div>
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                  <Bot className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  {loading ? (
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-[var(--surface-muted)] px-4 py-3 text-xs font-bold text-[var(--muted-foreground)]">
                      <span className="size-2 animate-pulse rounded-full bg-[var(--brand-secondary)]" />
                      CATE is checking the evidence…
                    </div>
                  ) : error ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                      <TriangleAlert className="mr-2 inline size-4" />
                      {error}
                    </div>
                  ) : result ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={result.runId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              result.providerMode === "live" ? "success" : "warning"
                            }
                          >
                            <Zap className="mr-1 size-3" />
                            {result.providerMode === "live"
                              ? `Live · ${result.model}`
                              : "Reliable demo fallback"}
                          </Badge>
                          <Badge>{result.capability.replaceAll("_", " ")}</Badge>
                          <Badge
                            tone={
                              result.answerAssessment.questionAnswered
                                ? "success"
                                : "danger"
                            }
                          >
                            {result.answerAssessment.questionAnswered
                              ? "Question answered"
                              : "Answer blocked"}
                          </Badge>
                          <Badge>
                            {result.answerAssessment.outputClass.replaceAll(
                              "_",
                              " ",
                            )}
                          </Badge>
                        </div>
                        <p className="whitespace-pre-line text-sm leading-7 text-[var(--foreground)]">
                          {result.displayText}
                        </p>
                        <section
                          aria-labelledby="cate-answer-contract"
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2
                              id="cate-answer-contract"
                              className="text-xs font-black"
                            >
                              CATE decision contract
                            </h2>
                            <Badge
                              tone={
                                result.confidence.band === "high"
                                  ? "success"
                                  : result.confidence.band === "insufficient"
                                    ? "danger"
                                    : "warning"
                              }
                            >
                              {result.confidence.band} confidence
                            </Badge>
                          </div>
                          <dl className="mt-3 grid gap-3 text-xs leading-5 md:grid-cols-2">
                            <div>
                              <dt className="font-black">Intent validation</dt>
                              <dd className="text-[var(--muted-foreground)]">
                                {result.intentAssessment.expectedAnswer}
                                <br />
                                {result.answerAssessment.reason}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-black">Policy</dt>
                              <dd className="text-[var(--muted-foreground)]">
                                {result.policyContext.policyName} ·{" "}
                                {result.policyContext.version}
                                <br />
                                {result.policyContext.sourceLabel}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-black">Confidence rationale</dt>
                              <dd className="text-[var(--muted-foreground)]">
                                {result.confidence.reason}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-black">Assumptions</dt>
                              <dd className="text-[var(--muted-foreground)]">
                                {result.assumptions.join(" · ")}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-black">Missing or conflicting evidence</dt>
                              <dd className="text-[var(--muted-foreground)]">
                                {result.evidenceGaps.length
                                  ? result.evidenceGaps.join(" · ")
                                  : "None identified in the accessible cited record set."}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-black">Risks and alternatives</dt>
                              <dd className="text-[var(--muted-foreground)]">
                                {result.risksAndAlternatives.join(" · ")}
                              </dd>
                            </div>
                            <div>
                              <dt className="font-black">Recommended next action</dt>
                              <dd className="text-[var(--muted-foreground)]">
                                {result.recommendedNextAction}
                              </dd>
                            </div>
                          </dl>
                          {result.calculation && (
                            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-5">
                              <p className="font-black">Certified calculation</p>
                              <p className="mt-1 text-[var(--muted-foreground)]">
                                {result.calculation.formula}
                              </p>
                              <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                                <div>
                                  <dt className="font-black">As of</dt>
                                  <dd>{result.calculation.asOf}</dd>
                                </div>
                                <div>
                                  <dt className="font-black">Records</dt>
                                  <dd>{result.calculation.recordCount}</dd>
                                </div>
                                <div>
                                  <dt className="font-black">Result</dt>
                                  <dd>{result.calculation.result}</dd>
                                </div>
                              </dl>
                              <p className="mt-2 text-[var(--muted-foreground)]">
                                Filters: {result.calculation.filters.join(" · ")}
                              </p>
                            </div>
                          )}
                          <p className="mt-3 border-l-2 border-[var(--brand-accent)] pl-3 text-[11px] font-bold leading-5">
                            {result.humanDecisionBoundary}
                          </p>
                        </section>
                        {result.evidenceCards.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {result.evidenceCards.map((card) => (
                              <div
                                key={card.id}
                                className={cn(
                                  "rounded-2xl border p-4",
                                  card.tone === "positive" &&
                                    "border-emerald-200 bg-emerald-50",
                                  card.tone === "warning" &&
                                    "border-amber-200 bg-amber-50",
                                  card.tone === "critical" &&
                                    "border-rose-200 bg-rose-50",
                                  card.tone === "neutral" &&
                                    "border-[var(--border)] bg-[var(--surface-subtle)]",
                                )}
                              >
                                <p className="text-[10px] font-black uppercase tracking-wider opacity-60">
                                  {card.label}
                                </p>
                                <p className="mt-1 text-xl font-black">{card.value}</p>
                                <p className="mt-1 text-[11px] leading-4 opacity-75">
                                  {card.detail}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        {result.claims.length > 0 && (
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted-foreground)]">
                              Claim-level grounding
                            </p>
                            <ul className="mt-3 space-y-3">
                              {result.claims.map((claim) => (
                                <li
                                  key={claim.id}
                                  className="rounded-xl bg-[var(--surface)] p-3 text-xs leading-5"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge>
                                      {claim.classification.replaceAll("_", " ")}
                                    </Badge>
                                    <span className="text-[var(--muted-foreground)]">
                                      {claim.sourceCitationIds.length
                                        ? `Sources: ${claim.sourceCitationIds.join(", ")}`
                                        : "No source claim; limitation or human-action boundary."}
                                    </span>
                                  </div>
                                  <p className="mt-2">{claim.text}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {result.citations.length > 0 && (
                          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted-foreground)]">
                              Evidence used
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {result.citations.map((citation) =>
                                citation.href ? (
                                  <Link
                                    key={citation.id}
                                    href={citation.href}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold hover:border-[var(--brand-secondary)]"
                                  >
                                    <FileSearch2 className="size-3" />
                                    {citation.title}
                                    <ExternalLink className="size-3 opacity-50" />
                                  </Link>
                                ) : (
                                  <span
                                    key={citation.id}
                                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold"
                                  >
                                    {citation.title}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                          <p className="text-xs font-black">
                            Verify or challenge this answer
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            Feedback is linked to this exact run, model, prompt
                            version, evidence manifest, and answer contract.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void submitFeedback("accepted")}
                            >
                              Evidence verified
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void submitFeedback("rejected")}
                            >
                              Challenge answer
                            </Button>
                          </div>
                          {feedbackStatus && (
                            <p className="mt-2 text-xs font-bold" role="status">
                              {feedbackStatus}
                            </p>
                          )}
                        </div>
                        {result.proposedActions.map((action) => (
                          <ActionCard
                            key={action.id}
                            action={action}
                            tenantId={result.tenantId}
                          />
                        ))}
                        <p className="border-l-2 border-[var(--brand-accent)] pl-3 text-[11px] leading-5 text-[var(--muted-foreground)]">
                          {result.humanReviewNotice}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] p-8 text-center">
                      <Sparkles className="mx-auto size-7 text-[var(--brand-secondary)]" />
                      <h2 className="mt-4 text-lg font-black">
                        Ask procurement, not software
                      </h2>
                      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted-foreground)]">
                        CATE turns needs and evidence into structured,
                        reviewable decisions—without taking authority away from
                        your team.
                      </p>
                      <Button className="mt-5" onClick={() => void run(submitted, "requisition")}>
                        Run the hero request
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <footer className="border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:px-7">
            <div className="mx-auto max-w-4xl">
              {attachment && (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-xs">
                  <span className="truncate font-bold">{attachment.name}</span>
                  <button
                    aria-label="Remove attachment"
                    onClick={() => setAttachment(null)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
              <div className="rounded-2xl border border-[var(--border-strong)] p-2 shadow-sm focus-within:ring-2 focus-within:ring-[var(--brand-primary)]">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void run();
                    }
                  }}
                  rows={2}
                  placeholder="Describe a purchasing need or ask about spend, risk, contracts, quotes, or invoices…"
                  className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none"
                  aria-label="Ask CATE"
                />
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.txt,.csv,.docx,image/png,image/jpeg"
                      onChange={(event) =>
                        setAttachment(event.target.files?.[0] ?? null)
                      }
                    />
                    <button
                      onClick={() => inputRef.current?.click()}
                      disabled={!acknowledged}
                      className="flex size-9 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Attach a fictional document"
                    >
                      <Paperclip className="size-4" />
                    </button>
                    <label className="flex min-h-6 items-center gap-2 text-[10px] font-bold text-[var(--muted-foreground)]">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                        className="size-4 rounded"
                      />
                      I will upload fictional data only
                    </label>
                  </div>
                  <Button
                    size="icon"
                    aria-label="Send to CATE"
                    disabled={!prompt.trim() || loading}
                    onClick={() => void run()}
                  >
                    {loading ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <ArrowUp className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-center text-[10px] text-[var(--muted-foreground)]">
                No member data. Fictional documents only. AI recommendations
                require human review.
              </p>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}
