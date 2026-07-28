"use client";

import { useConversation } from "@elevenlabs/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AiRunResult, VoiceSession } from "@/ai/types";
import { useDemo } from "@/components/demo/demo-provider";
import {
  narrationChunks,
  narrationRate,
  selectPreferredNarrator,
} from "@/lib/natural-narration";
import { titleCase } from "@/lib/utils";
import { answerGuideQuestion } from "@/tour/guide-knowledge";
import { getGuidedTour } from "@/tour/tours";
import type {
  GuideMode,
  GuideQuestionContext,
  GuideStatus,
  GuidedTour,
  TourId,
} from "@/tour/types";

interface GuideContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  status: GuideStatus;
  mode: GuideMode;
  tour?: GuidedTour;
  stepIndex: number;
  answer: string;
  captionsEnabled: boolean;
  narrationEnabled: boolean;
  liveStatus: "disconnected" | "connecting" | "connected" | "unavailable";
  microphoneMuted: boolean;
  voiceMode: "speaking" | "listening";
  startTour: (id: TourId) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  exit: () => void;
  ask: (question: string) => Promise<string>;
  setCaptionsEnabled: (enabled: boolean) => void;
  setNarrationEnabled: (enabled: boolean) => void;
  setMicrophoneMuted: (muted: boolean) => void;
  connectLive: () => Promise<void>;
  disconnectLive: () => void;
}

const GuideContext = createContext<GuideContextValue | null>(null);

function pageTitle(pathname: string) {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "dashboard";
  return segment === "ai-procurement" ? "AI Procurement" : titleCase(segment);
}

async function loadNarratorVoices() {
  const synthesis = window.speechSynthesis;
  const loaded = synthesis.getVoices();
  if (loaded.length > 0) return loaded;
  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const finish = () => {
      synthesis.removeEventListener("voiceschanged", finish);
      resolve(synthesis.getVoices());
    };
    synthesis.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, 1_200);
  });
}

export function CatalystGuideProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, dispatch } = useDemo();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<GuideStatus>("idle");
  const [mode, setMode] = useState<GuideMode>("deterministic");
  const [tourId, setTourId] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState(
    "Choose a tour, ask CATE a procurement question, or start Talk Live.",
  );
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [liveStatus, setLiveStatus] =
    useState<GuideContextValue["liveStatus"]>("disconnected");
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAbortRef = useRef<AbortController | null>(null);
  const narrationObjectUrlRef = useRef<string | null>(null);
  const narrationRunRef = useRef(0);
  const tour = tourId ? getGuidedTour(tourId) : undefined;
  const step = tour?.steps[stepIndex];

  const runServerQuestion = useCallback(
    async (question: string) => {
      const response = await fetch("/api/ai/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: state.organization.organizationId,
          prompt: question,
          currentRoute: pathname,
          role: state.activeRole,
          workflowStage: state.stage,
          tourStepToResume: step?.id,
          mode: "auto",
        }),
      });
      if (!response.ok) {
        throw new Error("CATE could not reach the procurement orchestrator.");
      }
      return (await response.json()) as AiRunResult;
    },
    [
      pathname,
      state.activeRole,
      state.organization.organizationId,
      state.stage,
      step?.id,
    ],
  );

  const conversation = useConversation({
    onConnect: () => {
      setMode("live");
      setLiveStatus("connected");
      setStatus("asking");
      setAnswer(
        "CATE is listening. Ask a procurement question or interrupt naturally.",
      );
    },
    onDisconnect: () => {
      setLiveStatus("disconnected");
      setMode("deterministic");
    },
    onError: (message) => {
      setLiveStatus("unavailable");
      setMode("deterministic");
      setAnswer(
        `${message} Typed questions, captions, and the guided tour remain ready.`,
      );
    },
    onMessage: ({ message, role }) => {
      if (role === "agent") {
        setStatus("asking");
        setAnswer(message);
      }
    },
    onInterruption: () => setAnswer("CATE paused to listen."),
    clientTools: {
      catalyst_procurement_reason: async (parameters: Record<string, unknown>) => {
        const question =
          typeof parameters.question === "string"
            ? parameters.question
            : "Explain the current procurement view.";
        const result = await runServerQuestion(question);
        setAnswer(result.displayText);
        return result.narrationText;
      },
      navigate_to_procurement_page: ({
        path,
      }: {
        path?: string;
      }) => {
        const allowed = [
          "/dashboard",
          "/ai-procurement",
          "/purchase-requests",
          "/approvals",
          "/purchase-orders",
          "/receiving",
          "/invoices",
          "/vendors",
          "/contracts",
          "/analytics",
          "/audit-center",
        ];
        if (path && allowed.includes(path)) router.push(path);
        return "Navigation completed. No financial action was performed.";
      },
    },
  });

  const stopNarration = useCallback(() => {
    narrationRunRef.current += 1;
    narrationAbortRef.current?.abort();
    narrationAbortRef.current = null;
    if (narrationAudioRef.current) {
      narrationAudioRef.current.pause();
      narrationAudioRef.current.removeAttribute("src");
      narrationAudioRef.current.load();
      narrationAudioRef.current = null;
    }
    if (narrationObjectUrlRef.current) {
      URL.revokeObjectURL(narrationObjectUrlRef.current);
      narrationObjectUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const narrate = useCallback(
    async (text: string) => {
      stopNarration();
      if (!narrationEnabled || typeof window === "undefined") return;
      const runId = narrationRunRef.current;
      const speakWithBrowser = async () => {
        if (
          runId !== narrationRunRef.current ||
          !("speechSynthesis" in window)
        ) {
          return;
        }
        const voices = await loadNarratorVoices();
        if (runId !== narrationRunRef.current) return;
        const voice = selectPreferredNarrator(voices);
        const chunks = narrationChunks(text);
        const speakChunk = (index: number) => {
          if (runId !== narrationRunRef.current || index >= chunks.length) return;
          const utterance = new SpeechSynthesisUtterance(chunks[index]);
          utterance.voice = voice ?? null;
          utterance.rate = narrationRate(voice);
          utterance.pitch = 0.99;
          utterance.onend = () =>
            window.setTimeout(() => speakChunk(index + 1), 160);
          utterance.onerror = () =>
            window.setTimeout(() => speakChunk(index + 1), 120);
          window.speechSynthesis.speak(utterance);
        };
        speakChunk(0);
      };
      const controller = new AbortController();
      narrationAbortRef.current = controller;
      try {
        const response = await fetch("/api/voice/narrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Natural narration is unavailable.");
        const audioBlob = await response.blob();
        if (runId !== narrationRunRef.current) return;
        const objectUrl = URL.createObjectURL(audioBlob);
        narrationObjectUrlRef.current = objectUrl;
        const audio = new Audio(objectUrl);
        narrationAudioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(objectUrl);
          if (narrationObjectUrlRef.current === objectUrl) {
            narrationObjectUrlRef.current = null;
          }
          if (narrationAudioRef.current === audio) narrationAudioRef.current = null;
        };
        await audio.play();
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        await speakWithBrowser();
      }
    },
    [narrationEnabled, stopNarration],
  );

  useEffect(() => {
    if (!step || status !== "running") return;
    if (pathname !== step.route) router.push(step.route);
    if (step.stage || step.role) {
      void (async () => {
        if (step.stage) {
          await dispatch({ type: "jump_to_stage", stage: step.stage });
        }
        if (step.role) {
          await dispatch({ type: "switch_role", role: step.role });
        }
      })().catch((error) =>
        setAnswer(
          error instanceof Error
            ? error.message
            : "The guided workflow could not load this step.",
        ),
      );
    }
    const highlightTimer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        `[data-tour-id="${step.targetId}"]`,
      );
      target?.setAttribute("data-tour-active", "true");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, pathname === step.route ? 120 : 560);
    const narrationTimer = window.setTimeout(
      () => void narrate(step.narration),
      pathname === step.route ? 240 : 720,
    );
    return () => {
      window.clearTimeout(highlightTimer);
      window.clearTimeout(narrationTimer);
      document
        .querySelectorAll<HTMLElement>("[data-tour-active='true']")
        .forEach((target) => target.removeAttribute("data-tour-active"));
    };
    // Each tour step intentionally loads a deterministic workflow snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrate, pathname, dispatch, router, status, step?.id]);

  const disconnectLive = useCallback(() => {
    conversation.endSession();
    setLiveStatus("disconnected");
    setMode("deterministic");
  }, [conversation]);

  useEffect(() => () => conversation.endSession(), [conversation]);

  const connectLive = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setLiveStatus("unavailable");
      setAnswer(
        "Microphone access is unavailable. Typed questions, captions, and deterministic narration remain ready.",
      );
      return;
    }
    setLiveStatus("connecting");
    stopNarration();
    try {
      const permission = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      permission.getTracks().forEach((track) => track.stop());
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: state.organization.organizationId }),
      });
      const session = (await response.json()) as VoiceSession & {
        message?: string;
      };
      if (!response.ok || !session.signedUrl) {
        throw new Error(
          session.message ?? "CATE Live is not configured in this environment.",
        );
      }
      conversation.startSession({
        signedUrl: session.signedUrl,
        connectionType: "websocket",
      });
      window.setTimeout(() => {
        if (conversation.status !== "connected") return;
        disconnectLive();
        setAnswer(
          "The 15-minute voice-session limit was reached. Typed mode and the guided tour remain ready.",
        );
      }, Math.max(0, new Date(session.expiresAt).getTime() - Date.now()));
    } catch (error) {
      disconnectLive();
      setLiveStatus("unavailable");
      setAnswer(
        `${error instanceof Error ? error.message : "CATE Live is unavailable."} The presentation can continue in typed or deterministic mode.`,
      );
    }
  }, [
    conversation,
    disconnectLive,
    state.organization.organizationId,
    stopNarration,
  ]);

  const currentContext = useCallback(
    (): GuideQuestionContext => ({
      pathname,
      pageTitle: pageTitle(pathname),
      role: state.activeRole,
      stage: state.stage,
      tourName: tour?.name,
      stepTitle: step?.title,
    }),
    [pathname, state.activeRole, state.stage, step?.title, tour?.name],
  );

  const ask = useCallback(
    async (question: string) => {
      stopNarration();
      setStatus("asking");
      if (liveStatus === "connected") {
        conversation.sendUserMessage(question);
        setAnswer("CATE is thinking…");
        return "CATE is thinking…";
      }
      try {
        const result = await runServerQuestion(question);
        setAnswer(result.displayText);
        if (narrationEnabled) void narrate(result.narrationText);
        return result.displayText;
      } catch {
        const fallback = answerGuideQuestion(question, currentContext());
        setAnswer(fallback);
        if (narrationEnabled) void narrate(fallback);
        return fallback;
      }
    },
    [
      conversation,
      currentContext,
      liveStatus,
      narrate,
      narrationEnabled,
      runServerQuestion,
      stopNarration,
    ],
  );

  const value = useMemo<GuideContextValue>(
    () => ({
      open,
      setOpen,
      status,
      mode,
      tour,
      stepIndex,
      answer,
      captionsEnabled,
      narrationEnabled,
      liveStatus,
      microphoneMuted: conversation.isMuted,
      voiceMode: conversation.mode,
      startTour: (id) => {
        disconnectLive();
        setTourId(id);
        setStepIndex(0);
        setOpen(true);
        setStatus("running");
        setAnswer(
          "The guide is following the reliable presentation path. Pause and ask a question at any time.",
        );
      },
      pause: () => {
        stopNarration();
        setStatus("paused");
      },
      resume: () => {
        setStatus("running");
        if (step) void narrate(step.narration);
      },
      next: () => {
        if (!tour) return;
        stopNarration();
        if (stepIndex >= tour.steps.length - 1) {
          setStatus("idle");
          setAnswer(
            "Tour complete. The founding-partner offer and final evidence state remain loaded.",
          );
          return;
        }
        setStepIndex((index) => index + 1);
        setStatus("running");
      },
      previous: () => {
        stopNarration();
        setStepIndex((index) => Math.max(0, index - 1));
        setStatus("running");
      },
      exit: () => {
        stopNarration();
        disconnectLive();
        setStatus("idle");
        setTourId(null);
      },
      ask,
      setCaptionsEnabled,
      setNarrationEnabled: (enabled) => {
        setNarrationEnabled(enabled);
        if (!enabled) stopNarration();
      },
      setMicrophoneMuted: conversation.setMuted,
      connectLive,
      disconnectLive,
    }),
    [
      answer,
      ask,
      captionsEnabled,
      connectLive,
      conversation.isMuted,
      conversation.mode,
      conversation.setMuted,
      disconnectLive,
      liveStatus,
      mode,
      narrate,
      narrationEnabled,
      open,
      status,
      step,
      stepIndex,
      stopNarration,
      tour,
    ],
  );

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useCatalystGuide() {
  const value = useContext(GuideContext);
  if (!value) {
    throw new Error(
      "useCatalystGuide must be used within CatalystGuideProvider.",
    );
  }
  return value;
}
