import { describe, expect, it } from "vitest";

import {
  narrationChunks,
  narrationRate,
  prepareNarrationText,
  selectPreferredNarrator,
} from "@/lib/natural-narration";

const voice = (
  name: string,
  lang = "en-US",
  localService = true,
  isDefault = false,
) => ({
  default: isDefault,
  lang,
  localService,
  name,
});

describe("natural narration", () => {
  it("prefers a natural English voice over a legacy system default", () => {
    const selected = selectPreferredNarrator([
      voice("Microsoft Zira Desktop", "en-US", true, true),
      voice("Microsoft Ava Online (Natural)", "en-US", false),
      voice("French Voice", "fr-FR"),
    ]);

    expect(selected?.name).toBe("Microsoft Ava Online (Natural)");
  });

  it("prepares financial values and acronyms for spoken delivery", () => {
    expect(
      prepareNarrationText(
        "Y-12 AI found $1,047 in savings before AP reviewed the $320 variance.",
      ),
    ).toBe(
      "Y twelve A.I. found one thousand forty-seven dollars in savings before A.P. reviewed the three hundred twenty dollars variance.",
    );
  });

  it("speaks one sentence at a time with a natural pause", () => {
    expect(narrationChunks("First decision. Then the evidence.")).toEqual([
      "First decision.",
      "Then the evidence.",
    ]);
  });

  it("uses a slightly quicker pace for a natural voice", () => {
    expect(narrationRate(voice("Microsoft Ava Online (Natural)"))).toBe(0.97);
    expect(narrationRate(voice("Microsoft Zira Desktop"))).toBe(0.9);
  });
});
