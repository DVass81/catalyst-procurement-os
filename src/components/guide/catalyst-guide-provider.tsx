"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { useDemo } from "@/components/demo/demo-provider";
import { jumpToStage, switchRole } from "@/demo/workflow";
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
  startTour: (id: TourId) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  exit: () => void;
  ask: (question: string) => string;
  setCaptionsEnabled: (enabled: boolean) => void;
  setNarrationEnabled: (enabled: boolean) => void;
  connectLive: () => Promise<void>;
  disconnectLive: () => void;
}

interface RealtimeTokenResponse {
  value?: string;
  client_secret?: { value?: string };
  mode?: string;
  message?: string;
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
  const { state, replace } = useDemo();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<GuideStatus>("idle");
  const [mode, setMode] = useState<GuideMode>("deterministic");
  const [tourId, setTourId] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState(
    "Choose a tour, or ask Catalyst Guide about the demo, security, savings, or founding-partner pilot.",
  );
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [liveStatus, setLiveStatus] =
    useState<GuideContextValue["liveStatus"]>("disconnected");
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationAbortRef = useRef<AbortController | null>(null);
  const narrationObjectUrlRef = useRef<string | null>(null);
  const narrationRunRef = useRef(0);
  const tour = tourId ? getGuidedTour(tourId) : undefined;
  const step = tour?.steps[stepIndex];

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
          !("speechSynthesis" in window) ||
          !("SpeechSynthesisUtterance" in window)
        ) {
          return;
        }

        const synthesis = window.speechSynthesis;
        const voices = await loadNarratorVoices();
        if (runId !== narrationRunRef.current) return;

        const voice = selectPreferredNarrator(voices);
        const chunks = narrationChunks(text);
        const speakChunk = (index: number) => {
          if (runId !== narrationRunRef.current || index >= chunks.length) {
            return;
          }
          const utterance = new SpeechSynthesisUtterance(chunks[index]);
          utterance.voice = voice ?? null;
          utterance.rate = narrationRate(voice);
          utterance.pitch = 0.98;
          utterance.volume = 1;
          utterance.onend = () => {
            if (runId !== narrationRunRef.current) return;
            window.setTimeout(() => speakChunk(index + 1), 180);
          };
          utterance.onerror = (event) => {
            if (event.error !== "canceled" && runId === narrationRunRef.current) {
              window.setTimeout(() => speakChunk(index + 1), 120);
            }
          };
          synthesis.speak(utterance);
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
        audio.preload = "auto";
        audio.onended = () => {
          if (narrationObjectUrlRef.current === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            narrationObjectUrlRef.current = null;
          }
          if (narrationAudioRef.current === audio) {
            narrationAudioRef.current = null;
          }
        };
        await audio.play();
      } catch (error) {
        if (
          controller.signal.aborted ||
          runId !== narrationRunRef.current ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        await speakWithBrowser();
      } finally {
        if (narrationAbortRef.current === controller) {
          narrationAbortRef.current = null;
        }
      }
    },
    [narrationEnabled, stopNarration],
  );

  useEffect(() => {
    if (!step || status !== "running") return;

    if (pathname !== step.route) router.push(step.route);

    if (step.stage || step.role) {
      let nextState = step.stage ? jumpToStage(step.stage) : state;
      if (step.role && nextState.activeRole !== step.role) {
        nextState = switchRole(nextState, step.role);
      }
      replace(nextState);
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
    // The tour intentionally loads a deterministic state for each step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrate, pathname, replace, router, status, step?.id]);

  const disconnectLive = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }
    setLiveStatus("disconnected");
    setMode("deterministic");
  }, []);

  useEffect(() => disconnectLive, [disconnectLive]);

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

  const connectLive = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setLiveStatus("unavailable");
      setAnswer(
        "Live voice is not available in this browser. Captions, typed questions, and deterministic narration remain fully available.",
      );
      return;
    }

    setLiveStatus("connecting");
    stopNarration();
    try {
      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: currentContext() }),
      });
      const tokenData = (await tokenResponse.json()) as RealtimeTokenResponse;
      const token = tokenData.value ?? tokenData.client_secret?.value;
      if (!tokenResponse.ok || !token) {
        throw new Error(
          tokenData.message ??
            "Catalyst Guide Live is not configured in this environment.",
        );
      }

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("aria-hidden", "true");
      document.body.appendChild(audio);
      audioRef.current = audio;
      peer.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const dataChannel = peer.createDataChannel("oai-events");
      dataChannel.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            delta?: string;
            transcript?: string;
          };
          if (
            payload.type?.includes("transcript") &&
            (payload.delta || payload.transcript)
          ) {
            setAnswer((current) =>
              payload.delta
                ? `${current === "Listening…" ? "" : current}${payload.delta}`
                : (payload.transcript ?? current),
            );
          }
        } catch {
          // Non-JSON events are ignored; the audio conversation continues.
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answerResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/sdp",
          },
        },
      );
      if (!answerResponse.ok) {
        throw new Error("The live voice connection could not be established.");
      }
      await peer.setRemoteDescription({
        type: "answer",
        sdp: await answerResponse.text(),
      });
      setMode("live");
      setLiveStatus("connected");
      setStatus("asking");
      setAnswer("Listening… ask a question about this page or the demonstration.");
    } catch (error) {
      disconnectLive();
      setLiveStatus("unavailable");
      setAnswer(
        `${error instanceof Error ? error.message : "Live voice is unavailable."} The deterministic guide remains ready, so the presentation can continue without interruption.`,
      );
    }
  }, [currentContext, disconnectLive, stopNarration]);

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
      startTour: (id) => {
        disconnectLive();
        setTourId(id);
        setStepIndex(0);
        setOpen(true);
        setStatus("running");
        setAnswer(
          "The guide is following a deterministic presentation path. You can pause and ask a question at any time.",
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
            "Tour complete. The deterministic demo remains loaded at the final evidence state.",
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
        document
          .querySelectorAll<HTMLElement>("[data-tour-active='true']")
          .forEach((target) => target.removeAttribute("data-tour-active"));
      },
      ask: (question) => {
        stopNarration();
        setStatus("asking");
        const response = answerGuideQuestion(question, currentContext());
        setAnswer(response);
        if (narrationEnabled) void narrate(response);
        return response;
      },
      setCaptionsEnabled,
      setNarrationEnabled: (enabled) => {
        setNarrationEnabled(enabled);
        if (!enabled) stopNarration();
      },
      connectLive,
      disconnectLive,
    }),
    [
      answer,
      captionsEnabled,
      connectLive,
      currentContext,
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

  return (
    <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
  );
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
