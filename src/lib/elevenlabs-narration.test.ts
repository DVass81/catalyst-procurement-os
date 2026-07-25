import { describe, expect, it } from "vitest";

import {
  buildElevenLabsNarrationRequest,
  MAX_NARRATION_CHARACTERS,
  normalizeNarrationInput,
} from "@/lib/elevenlabs-narration";

describe("ElevenLabs narration", () => {
  it("prepares procurement language for natural delivery", () => {
    expect(normalizeNarrationInput("Y-12 found $1,047 in savings.")).toBe(
      "Y twelve found one thousand forty-seven dollars in savings.",
    );
  });

  it("rejects empty, non-text, and oversized requests", () => {
    expect(normalizeNarrationInput("   ")).toBeNull();
    expect(normalizeNarrationInput({ text: "hello" })).toBeNull();
    expect(
      normalizeNarrationInput("x".repeat(MAX_NARRATION_CHARACTERS + 1)),
    ).toBeNull();
  });

  it("uses expressive but controlled voice settings", () => {
    const request = buildElevenLabsNarrationRequest("Welcome to Catalyst.");

    expect(request.model_id).toBe("eleven_multilingual_v2");
    expect(request.voice_settings.stability).toBeLessThan(0.5);
    expect(request.voice_settings.speed).toBe(0.97);
  });
});

