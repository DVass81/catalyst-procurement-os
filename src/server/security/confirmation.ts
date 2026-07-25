import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { ProposedAction, ToolPermission } from "@/ai/types";

interface ActionInput {
  tenantId: string;
  toolName: string;
  permission: ToolPermission;
  title: string;
  destination: string;
  payloadSummary: string;
  consequence: string;
  href?: string;
  ttlMinutes?: number;
}

function secret() {
  return (
    process.env.ACTION_CONFIRMATION_SECRET ??
    (process.env.NODE_ENV === "production"
      ? ""
      : "local-development-confirmation-secret-change-before-deploy")
  );
}

export function hashActionPayload(input: Omit<ActionInput, "ttlMinutes">) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function createProposedAction(input: ActionInput): ProposedAction {
  const nonce = randomUUID();
  const payloadHash = hashActionPayload(input);
  const expiresAt = new Date(
    Date.now() + (input.ttlMinutes ?? 10) * 60_000,
  ).toISOString();
  const action: ProposedAction = {
    id: randomUUID(),
    toolName: input.toolName,
    permission: input.permission,
    title: input.title,
    destination: input.destination,
    payloadSummary: input.payloadSummary,
    consequence: input.consequence,
    expiresAt,
    nonce,
    payloadHash,
    confirmationRequired: input.permission === "confirmation_required",
    href: input.href,
  };
  action.confirmationToken = signConfirmation(action, input.tenantId);
  return action;
}

export function signConfirmation(action: ProposedAction, tenantId: string) {
  const confirmationSecret = secret();
  if (!confirmationSecret) {
    throw new Error("ACTION_CONFIRMATION_SECRET is not configured.");
  }
  const value = [
    action.id,
    tenantId,
    action.nonce,
    action.payloadHash,
    action.expiresAt,
  ].join(".");
  return createHmac("sha256", confirmationSecret).update(value).digest("hex");
}

export function verifyConfirmation(
  action: ProposedAction,
  tenantId: string,
  signature: string,
) {
  if (new Date(action.expiresAt).getTime() <= Date.now()) return false;
  const expected = signConfirmation(action, tenantId);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}
