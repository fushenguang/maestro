import type { Idea } from "@maestro/types";

export const PHASE_NAMES = [
  "Feed",
  "Intent",
  "Boundary",
  "Validation",
  "Contract",
  "Evolution",
] as const;

type PhaseStatus = "done" | "active" | "locked";

const UNLOCK: Record<number, (i: Idea) => boolean> = {
  0: () => true,
  1: (i) => Boolean(i.feedCompletedAt),
  2: (i) => i.intentClarity >= 85 && i.openQuestionsCount === 0,
  3: (i) => Boolean(i.boundaryLockedAt),
  4: (i) => i.validationVerdict === "go",
  5: (i) => Boolean(i.contractSignedAt),
};

export function getPhaseStatus(idea: Idea, phase: number): PhaseStatus {
  if (phase < idea.currentPhase) return "done";
  if (phase === idea.currentPhase) return "active";
  const unlockFn = UNLOCK[phase];
  return unlockFn && unlockFn(idea) ? "active" : "locked";
}
