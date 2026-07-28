import { prepareNarrationText } from "@/lib/natural-narration";

export const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";
export const MAX_NARRATION_CHARACTERS = 1_800;

export function normalizeNarrationInput(value: unknown) {
  if (typeof value !== "string") return null;

  const text = prepareNarrationText(value)
    .replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

  if (!text || text.length > MAX_NARRATION_CHARACTERS) return null;
  return text;
}

export function buildElevenLabsNarrationRequest(
  text: string,
  modelId = DEFAULT_ELEVENLABS_MODEL,
) {
  return {
    text,
    model_id: modelId,
    apply_text_normalization: "on",
    voice_settings: {
      stability: 0.38,
      similarity_boost: 0.82,
      style: 0.18,
      use_speaker_boost: true,
      speed: 0.97,
    },
  };
}
