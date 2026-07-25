import type { DemoRole, WorkflowStage } from "@/demo/model";

export type TourId = "executive-12" | "operational-30";

export interface TourStep {
  id: string;
  route: string;
  targetId: string;
  title: string;
  instruction: string;
  narration: string;
  valueStatement: string;
  role?: DemoRole;
  stage?: WorkflowStage;
  position?: "top" | "right" | "bottom" | "left";
}

export interface GuidedTour {
  id: TourId;
  name: string;
  duration: string;
  audience: string;
  description: string;
  steps: TourStep[];
}

export type GuideStatus = "idle" | "running" | "paused" | "asking";
export type GuideMode = "deterministic" | "live";

export interface GuideQuestionContext {
  pathname: string;
  pageTitle: string;
  role: DemoRole;
  stage: WorkflowStage;
  tourName?: string;
  stepTitle?: string;
}
