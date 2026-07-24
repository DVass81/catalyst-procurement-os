"use client";

import { motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  ChevronRight,
  Clock3,
  FileText,
  Lightbulb,
  Link2,
  MessageSquareText,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const conversations = [
  { title: "Q3 contract renewals", time: "12 min", active: true },
  { title: "Vendor concentration review", time: "Yesterday", active: false },
  { title: "Software savings analysis", time: "Tue", active: false },
  { title: "Branch equipment status", time: "Mon", active: false },
];

const suggestions = [
  {
    label: "Contracts",
    prompt: "Which contracts renew this quarter?",
    icon: FileText,
  },
  {
    label: "Vendor risk",
    prompt: "Summarize our high-risk vendors.",
    icon: ShieldCheck,
  },
  {
    label: "Savings",
    prompt: "Where can we reduce software spend?",
    icon: TrendingDown,
  },
  {
    label: "Approvals",
    prompt: "What approvals need attention today?",
    icon: Clock3,
  },
];

const mockReplies: Record<string, string> = {
  contracts:
    "Seven contracts require action within 90 days. The Fiserv agreement has the earliest notice deadline on August 31, followed by Iron Mountain on September 12. Combined annual value is $1.84M.",
  risk: "Three active vendors require attention. CrowdStrike is in remediation for a documentation gap, NCR Atleos has an operational resilience review due, and Deluxe has an outstanding financial-health update.",
  savings:
    "I found three overlapping collaboration subscriptions across IT and Marketing. Consolidating at the next renewal window could create an estimated $96K annual opportunity with low implementation risk.",
  approvals:
    "Nine requests are pending. Two are over the 48-hour SLA: PR-2026-0136 for branch security cameras and PR-2026-0139 for compliance training services.",
};

export function AiWorkspace() {
  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState(
    "Which contracts renew this quarter?",
  );
  const [isTyping, setIsTyping] = useState(false);

  function submitPrompt(value = prompt) {
    const nextPrompt = value.trim();
    if (!nextPrompt) return;
    setSubmittedPrompt(nextPrompt);
    setPrompt("");
    setIsTyping(true);
    window.setTimeout(() => setIsTyping(false), 700);
  }

  const response =
    submittedPrompt.toLowerCase().includes("risk")
      ? mockReplies.risk
      : submittedPrompt.toLowerCase().includes("saving") ||
          submittedPrompt.toLowerCase().includes("software")
        ? mockReplies.savings
        : submittedPrompt.toLowerCase().includes("approval")
          ? mockReplies.approvals
          : mockReplies.contracts;

  return (
    <div className="flex min-h-[calc(100vh-8.5rem)] overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <aside className="hidden w-72 shrink-0 border-r border-[var(--border)] bg-[var(--surface-subtle)] p-4 xl:flex xl:flex-col">
        <Button className="w-full justify-start">
          <MessageSquareText className="size-4" aria-hidden="true" />
          New conversation
        </Button>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="search"
            aria-label="Search conversations"
            placeholder="Search conversations"
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
          />
        </div>
        <p className="mb-2 mt-6 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          Recent
        </p>
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <button
              key={conversation.title}
              className={cn(
                "w-full rounded-xl px-3 py-3 text-left transition-colors",
                conversation.active
                  ? "bg-[var(--brand-soft)] text-[var(--brand-primary)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
              )}
            >
              <span className="block truncate text-sm font-semibold">
                {conversation.title}
              </span>
              <span className="mt-1 block text-[11px] opacity-75">
                {conversation.time}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
            <ShieldCheck
              className="size-4 text-emerald-600"
              aria-hidden="true"
            />
            Enterprise guardrails
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
            Preview responses use fictional data and do not take action.
          </p>
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-lg shadow-blue-600/20">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[var(--foreground)]">
                  Catalyst AI
                </h1>
                <Badge tone="info">Preview</Badge>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
                Procurement intelligence workspace
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Conversation details">
            <Lightbulb className="size-4.5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center">
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-primary)]"
              >
                <Bot className="size-6" aria-hidden="true" />
              </motion.div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                How can I help with procurement?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
                Explore spend, contracts, vendors, risk, and approvals using the
                fictional Y-12 Credit Union demo workspace.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                  <button
                    key={suggestion.prompt}
                    onClick={() => submitPrompt(suggestion.prompt)}
                    className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brand-primary)_35%,var(--border))] hover:shadow-md"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                        {suggestion.label}
                      </span>
                      <span className="mt-0.5 block text-sm font-semibold text-[var(--foreground)]">
                        {suggestion.prompt}
                      </span>
                    </span>
                    <ChevronRight className="size-4 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>

            <div className="mt-8 space-y-5" aria-live="polite">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[var(--brand-primary)] px-4 py-3 text-sm leading-6 text-[var(--brand-primary-foreground)]">
                {submittedPrompt}
              </div>
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand-primary)]">
                  <Sparkles className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  {isTyping ? (
                    <div className="inline-flex items-center gap-1 rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          className="size-1.5 rounded-full bg-[var(--muted-foreground)]"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{
                            duration: 0.8,
                            repeat: Number.POSITIVE_INFINITY,
                            delay: dot * 0.12,
                          }}
                        />
                      ))}
                      <span className="sr-only">Catalyst AI is typing</span>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="text-sm leading-7 text-[var(--foreground)]">
                        {response}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge className="gap-1.5">
                          <FileText className="size-3" aria-hidden="true" />
                          CTR-2024-031
                        </Badge>
                        <Badge className="gap-1.5">
                          <Link2 className="size-3" aria-hidden="true" />
                          7 contract records
                        </Badge>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-[var(--border)] bg-[var(--surface)] p-4 sm:px-7 sm:py-5">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-[var(--shadow-elevated)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitPrompt();
                  }
                }}
                rows={2}
                placeholder="Ask about spend, suppliers, contracts, risk, or approvals..."
                aria-label="Message Catalyst AI"
                className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
              />
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="Attach a file">
                    <Paperclip className="size-4" />
                  </Button>
                  <span className="hidden text-xs text-[var(--muted-foreground)] sm:inline">
                    Enter to send · Shift + Enter for a new line
                  </span>
                </div>
                <Button
                  size="icon"
                  aria-label="Send message"
                  disabled={!prompt.trim()}
                  onClick={() => submitPrompt()}
                >
                  <ArrowUp className="size-4" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-[var(--muted-foreground)]">
              Catalyst AI can make mistakes. Verify important procurement
              decisions. Demo interface only.
            </p>
          </div>
        </footer>
      </section>
    </div>
  );
}
