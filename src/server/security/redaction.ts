const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\b(?:access|refresh|id)[_-]?token\b\s*[:=]\s*["']?[^"',\s}]+/gi,
  /\b(?:api|secret|encryption)[_-]?key\b\s*[:=]\s*["']?[^"',\s}]+/gi,
];

export function redactSensitiveText(value: string) {
  return SECRET_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, "[REDACTED]"),
    value,
  );
}

export function safeErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "The provider request failed.";
  return redactSensitiveText(error.message).slice(0, 500);
}
