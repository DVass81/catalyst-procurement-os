import type { AiCapability } from "@/ai/types";

interface FallbackState {
  global: boolean;
  capabilities: Partial<Record<AiCapability, boolean>>;
  changedAt: string;
}

let fallbackState: FallbackState = {
  global: process.env.CATALYST_AI_MODE === "deterministic",
  capabilities: {},
  changedAt: new Date().toISOString(),
};

export function getFallbackState() {
  return structuredClone(fallbackState);
}

export function setFallbackState(
  input: Pick<FallbackState, "global" | "capabilities">,
) {
  fallbackState = {
    ...input,
    changedAt: new Date().toISOString(),
  };
  return getFallbackState();
}

export function isCapabilityInFallback(capability?: AiCapability) {
  return (
    fallbackState.global ||
    (capability ? fallbackState.capabilities[capability] === true : false)
  );
}
