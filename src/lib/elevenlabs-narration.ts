import { prepareNarrationText } from "@/lib/natural-narration";

export const DEFAULT_ELEVENLABS_MODEL = "eleven_multilingual_v2";
export const MAX_NARRATION_CHARACTERS = 1_800;

function removeUnsafeNarrationControls(value: string) {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127)
      ? ""
      : character;
  }).join("");
}

export function normalizeNarrationInput(value: unknown) {
  if (typeof value !== "string") return null;

  const text = removeUnsafeNarrationControls(
    prepareNarrationText(value),
  ).trim();

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
