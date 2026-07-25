"use client";

import {
  ArrowLeft,
  ArrowRight,
  Captions,
  Check,
  Headphones,
  Mic,
  Pause,
  Play,
  Radio,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useState } from "react";

import { useCatalystGuide } from "@/components/guide/catalyst-guide-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { guidedTours } from "@/tour/tours";

export function CatalystGuide() {
  const guide = useCatalystGuide();
  const [question, setQuestion] = useState("");
  if (!guide.open) return null;

  const step = guide.tour?.steps[guide.stepIndex];
  const progress = guide.tour
    ? ((guide.stepIndex + 1) / guide.tour.steps.length) * 100
    : 0;

  return (
    <>
      {guide.status !== "idle" && (
        <div
          className="pointer-events-none fixed inset-0 z-[60] bg-[#041a6c]/18 backdrop-blur-[1px]"
          aria-hidden="true"
        />
      )}
      <aside
        aria-label="Catalyst Guide Live"
        data-tour-id="catalyst-guide"
        className="fixed bottom-4 right-4 z-[90] w-[min(27rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#061b5f] text-white shadow-[0_30px_90px_rgba(4,26,108,.42)]"
      >
        <div className="relative overflow-hidden border-b border-white/10 px-5 py-4">
          <div className="absolute -right-16 -top-20 size-48 rounded-full bg-[#cf4427]/35 blur-3xl" />
          <div className="absolute -left-10 bottom-0 size-32 rounded-full bg-[#ebbf5d]/20 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ebbf5d] to-[#cf4427] text-[#041a6c] shadow-lg">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black text-white">
                  Catalyst Guide Live
                </p>
                <Badge className="border-white/15 bg-white/10 text-[9px] text-white">
                  {guide.mode === "live" ? "LIVE AI" : "SAFE DEMO"}
                </Badge>
              </div>
              <p className="mt-0.5 text-[10px] text-white/60">
                Your warm, natural procurement demonstration concierge
              </p>
            </div>
            <button
              onClick={() => {
                if (guide.status !== "idle") guide.pause();
                guide.setOpen(false);
              }}
              aria-label="Close Catalyst Guide"
              className="flex size-9 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {guide.status === "idle" || !guide.tour ? (
          <div className="p-5">
            <h2 className="text-xl font-black tracking-[-0.035em] text-white">
              How would you like to explore?
            </h2>
            <p className="mt-2 text-xs leading-5 text-white/65">
              Both tours use the same connected fictional records and can run
              with narration, captions, or silently.
            </p>
            <div className="mt-4 space-y-3">
              {guidedTours.map((tour) => (
                <button
                  key={tour.id}
                  onClick={() => guide.startTour(tour.id)}
                  className="group w-full rounded-2xl border border-white/12 bg-white/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#ebbf5d]/55 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{tour.name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#ebbf5d]">
                        {tour.duration} · {tour.steps.length} chapters
                      </p>
                    </div>
                    <ArrowRight className="size-4 text-white/45 transition group-hover:translate-x-1 group-hover:text-[#ebbf5d]" />
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-white/60">
                    {tour.description}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#ebbf5d]/20 bg-[#ebbf5d]/[0.08] p-3">
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#f0cb7c]">
                <Check className="size-3.5" />
                Presentation-safe fallback is always ready
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-white/55">
                The complete walkthrough works without an API key, microphone,
                or network connection.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="h-1 bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-[#ebbf5d] to-[#cf4427] transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#ebbf5d]">
                    Chapter {guide.stepIndex + 1} of {guide.tour.steps.length}
                  </p>
                  <h2 className="mt-1 text-lg font-black tracking-[-0.025em] text-white">
                    {step?.title}
                  </h2>
                </div>
                <button
                  onClick={guide.status === "running" ? guide.pause : guide.resume}
                  className="flex size-10 items-center justify-center rounded-2xl bg-white/10 text-white hover:bg-white/15"
                  aria-label={
                    guide.status === "running" ? "Pause tour" : "Resume tour"
                  }
                >
                  {guide.status === "running" ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </button>
              </div>

              {guide.captionsEnabled && (
                <div
                  aria-live="polite"
                  className="mt-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4"
                >
                  <p className="text-xs leading-5 text-white/82">
                    {step?.narration}
                  </p>
                  <p className="mt-3 border-t border-white/10 pt-3 text-[10px] font-bold leading-4 text-[#f0cb7c]">
                    {step?.valueStatement}
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      guide.setNarrationEnabled(!guide.narrationEnabled)
                    }
                    className="flex size-9 items-center justify-center rounded-xl text-white/65 hover:bg-white/10 hover:text-white"
                    aria-label={
                      guide.narrationEnabled
                        ? "Mute narration"
                        : "Enable narration"
                    }
                  >
                    {guide.narrationEnabled ? (
                      <Volume2 className="size-4" />
                    ) : (
                      <VolumeX className="size-4" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      guide.setCaptionsEnabled(!guide.captionsEnabled)
                    }
                    className="flex size-9 items-center justify-center rounded-xl text-white/65 hover:bg-white/10 hover:text-white"
                    aria-label={
                      guide.captionsEnabled ? "Hide captions" : "Show captions"
                    }
                  >
                    <Captions className="size-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={guide.previous}
                    disabled={guide.stepIndex === 0}
                    className="border border-white/10 text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back
                  </Button>
                  <Button
                    size="sm"
                    onClick={guide.next}
                    className="bg-[#cf4427] text-white hover:bg-[#b83a22]"
                  >
                    {guide.stepIndex === guide.tour.steps.length - 1
                      ? "Finish"
                      : "Next"}
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="my-4 h-px bg-white/10" />

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-white">
                    Ask during the tour
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/55">
                    The tour resumes at this exact chapter.
                  </p>
                </div>
                <button
                  onClick={
                    guide.liveStatus === "connected"
                      ? guide.disconnectLive
                      : () => void guide.connectLive()
                  }
                  disabled={guide.liveStatus === "connecting"}
                  className="flex items-center gap-2 rounded-xl border border-[#ebbf5d]/25 bg-[#ebbf5d]/10 px-3 py-2 text-[10px] font-black text-[#f0cb7c] transition hover:bg-[#ebbf5d]/15 disabled:opacity-60"
                >
                  {guide.liveStatus === "connected" ? (
                    <Radio className="size-3.5 animate-pulse" />
                  ) : (
                    <Mic className="size-3.5" />
                  )}
                  {guide.liveStatus === "connecting"
                    ? "Connecting…"
                    : guide.liveStatus === "connected"
                      ? "End live"
                      : "Talk live"}
                </button>
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!question.trim()) return;
                  guide.ask(question);
                  setQuestion("");
                }}
              >
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about this page, savings, security…"
                  aria-label="Ask Catalyst Guide"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.08] px-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-[#ebbf5d]/60"
                />
                <button
                  type="submit"
                  className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
                  aria-label="Ask question"
                >
                  <Headphones className="size-4" />
                </button>
              </form>
              {guide.answer && guide.status === "asking" && (
                <div className="mt-3 rounded-xl bg-black/15 p-3 text-[11px] leading-5 text-white/72">
                  {guide.answer}
                  <button
                    onClick={guide.resume}
                    className="mt-2 flex items-center gap-1.5 font-black text-[#f0cb7c]"
                  >
                    <Play className="size-3" />
                    Continue the tour
                  </button>
                </div>
              )}
              <button
                onClick={guide.exit}
                className="mt-4 text-[10px] font-bold text-white/45 hover:text-white"
              >
                Exit tour
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
