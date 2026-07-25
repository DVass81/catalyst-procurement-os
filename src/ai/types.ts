import { z } from "zod";

export const aiCapabilitySchema = z.enum([
  "requisition",
  "policy",
  "inventory",
  "gl_budget",
  "quote_comparison",
  "vendor_risk",
  "contract_review",
  "invoice_match",
  "spend_intelligence",
  "negotiation",
  "market_research",
  "audit_summary",
  "application_help",
  "email_triage",
]);

export type AiCapability = z.infer<typeof aiCapabilitySchema>;

export type ModelRoute = "luna" | "terra" | "sol" | "deterministic";

export interface TenantDemoConfig {
  id: string;
  organizationName: string;
  organizationShortName: string;
  logoPath: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  terminology: {
    request: string;
    member: string;
    location: string;
  };
  policyProfile: string;
  dataPackId: string;
  aiContext: string;
  disclaimer: string;
  narrationGreeting: string;
}

export interface Citation {
  id: string;
  title: string;
  sourceType: "application_record" | "uploaded_document" | "public_web";
  locator: string;
  href?: string;
  excerpt?: string;
}

export interface EvidenceCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
  sourceCitationIds: string[];
}

export type ToolPermission =
  | "read_only"
  | "ui_navigation"
  | "draft_state_proposal"
  | "confirmation_required"
  | "prohibited";

export interface ProposedAction {
  id: string;
  toolName: string;
  permission: ToolPermission;
  title: string;
  destination: string;
  payloadSummary: string;
  consequence: string;
  expiresAt: string;
  nonce: string;
  payloadHash: string;
  confirmationToken?: string;
  confirmationRequired: boolean;
  href?: string;
}

export interface HumanConfirmation {
  actionId: string;
  tenantId: string;
  userId: string;
  role: string;
  nonce: string;
  payloadHash: string;
  confirmedAt: string;
}

export interface AiRunRequest {
  tenantId: string;
  prompt: string;
  capability?: AiCapability;
  currentRoute: string;
  role: string;
  workflowStage: string;
  tourStepToResume?: string;
  mode?: "auto" | "live" | "deterministic";
  deepReviewRequested?: boolean;
  fictionalDataAcknowledged?: boolean;
  attachmentIds?: string[];
}

export interface ProviderUsageEvent {
  id: string;
  tenantId: string;
  provider: "openai" | "elevenlabs" | "google" | "deterministic";
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  estimatedCostUsd: number;
  occurredAt: string;
  capability: AiCapability;
  sessionId?: string;
}

export interface AiRunResult {
  runId: string;
  tenantId: string;
  capability: AiCapability;
  route: ModelRoute;
  model: string;
  providerMode: "live" | "deterministic";
  displayText: string;
  narrationText: string;
  citations: Citation[];
  evidenceCards: EvidenceCard[];
  proposedActions: ProposedAction[];
  usage: ProviderUsageEvent;
  tourStepToResume?: string;
  humanReviewNotice: string;
}

export interface VoiceSession {
  id: string;
  tenantId: string;
  provider: "elevenlabs" | "browser" | "deterministic";
  status: "connecting" | "connected" | "muted" | "ended" | "unavailable";
  startedAt: string;
  expiresAt: string;
  captionsEnabled: boolean;
  interruptionEnabled: boolean;
  signedUrl?: string;
}

export interface DemoToolDefinition {
  name: string;
  description: string;
  permission: ToolPermission;
  requiresHumanConfirmation: boolean;
  allowedRoles: string[];
}

export interface GoogleConnectionStatus {
  connected: boolean;
  mode: "live" | "simulated" | "disabled";
  email?: string;
  gmailLabel: "Catalyst Procurement Demo";
  calendarName: "Catalyst Procurement Demo";
  reason?: string;
  scopes: string[];
}

export const citationSchema = z.object({
  id: z.string(),
  title: z.string(),
  sourceType: z.enum([
    "application_record",
    "uploaded_document",
    "public_web",
  ]),
  locator: z.string(),
  href: z.string().optional(),
  excerpt: z.string().optional(),
});

export const evidenceCardSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  detail: z.string(),
  tone: z.enum(["neutral", "positive", "warning", "critical"]),
  sourceCitationIds: z.array(z.string()),
});

export const proposedActionSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  permission: z.enum([
    "read_only",
    "ui_navigation",
    "draft_state_proposal",
    "confirmation_required",
    "prohibited",
  ]),
  title: z.string(),
  destination: z.string(),
  payloadSummary: z.string(),
  consequence: z.string(),
  expiresAt: z.string(),
  nonce: z.string(),
  payloadHash: z.string(),
  confirmationToken: z.string().optional(),
  confirmationRequired: z.boolean(),
  href: z.string().optional(),
});

export const aiRunRequestSchema = z.object({
  tenantId: z.string().min(1).max(80),
  prompt: z.string().trim().min(1).max(8_000),
  capability: aiCapabilitySchema.optional(),
  currentRoute: z.string().max(200),
  role: z.string().max(80),
  workflowStage: z.string().max(80),
  tourStepToResume: z.string().max(120).optional(),
  mode: z.enum(["auto", "live", "deterministic"]).optional(),
  deepReviewRequested: z.boolean().optional(),
  fictionalDataAcknowledged: z.boolean().optional(),
  attachmentIds: z.array(z.string().max(200)).max(5).optional(),
});

export const aiModelOutputSchema = z.object({
  displayText: z.string(),
  narrationText: z.string(),
  citations: z.array(citationSchema).max(12),
  evidenceCards: z.array(evidenceCardSchema).max(8),
  proposedActions: z.array(proposedActionSchema).max(4),
  humanReviewNotice: z.string(),
});

export type AiModelOutput = z.infer<typeof aiModelOutputSchema>;
