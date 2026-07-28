export interface NarratorVoiceCandidate {
  default: boolean;
  lang: string;
  localService: boolean;
  name: string;
}

const NATURAL_MARKERS = ["natural", "neural", "premium", "enhanced"];
const WARM_VOICE_NAMES = [
  "ava",
  "emma",
  "jenny",
  "aria",
  "samantha",
  "serena",
  "sonia",
  "susan",
  "google us english",
];
const LEGACY_VOICE_NAMES = ["david", "mark", "zira", "hazel", "espeak"];

export function scoreNarratorVoice(voice: NarratorVoiceCandidate) {
  const name = voice.name.toLowerCase();
  const language = voice.lang.toLowerCase();
  let score = 0;

  if (language === "en-us") score += 500;
  else if (language.startsWith("en-us")) score += 450;
  else if (language.startsWith("en")) score += 250;
  else score -= 1_000;

  if (NATURAL_MARKERS.some((marker) => name.includes(marker))) score += 1_500;
  if (name.includes("online")) score += 600;
  if (WARM_VOICE_NAMES.some((preferred) => name.includes(preferred))) {
    score += 850;
  }
  if (name.includes("google us english")) score += 500;
  if (voice.default) score += 25;
  if (LEGACY_VOICE_NAMES.some((legacy) => name.includes(legacy))) score -= 700;

  return score;
}

export function selectPreferredNarrator<T extends NarratorVoiceCandidate>(
  voices: T[],
) {
  return [...voices]
    .filter((voice) => voice.lang.toLowerCase().startsWith("en"))
    .sort((left, right) => scoreNarratorVoice(right) - scoreNarratorVoice(left))[0];
}

export function prepareNarrationText(text: string) {
  return text
    .replaceAll("—", ", ")
    .replaceAll("–", ", ")
    .replaceAll("…", "...")
    .replaceAll("·", ". ")
    .replaceAll("$1,047", "one thousand forty-seven dollars")
    .replaceAll("$320", "three hundred twenty dollars")
    .replaceAll("$2,500", "two thousand five hundred dollars")
    .replaceAll("$7,500", "seven thousand five hundred dollars")
    .replaceAll("$1,200", "one thousand two hundred dollars")
    .replaceAll(/\bY-12\b/g, "Y twelve")
    .replaceAll(/\bAI\b/g, "A.I.")
    .replaceAll(/\bAP\b/g, "A.P.")
    .replaceAll(/\bGL\b/g, "G.L.")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export function narrationChunks(text: string) {
  const prepared = prepareNarrationText(text);
  const sentences = prepared.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [prepared];
  return sentences.map((sentence) => sentence.trim()).filter(Boolean);
}

export function narrationRate(voice?: NarratorVoiceCandidate) {
  if (!voice) return 0.9;
  const name = voice.name.toLowerCase();
  return NATURAL_MARKERS.some((marker) => name.includes(marker)) ||
    name.includes("online")
    ? 0.97
    : 0.9;
}
