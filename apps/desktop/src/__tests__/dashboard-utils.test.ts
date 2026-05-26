import { describe, it, expect, beforeAll } from "vitest";
import { computeStats, applyFilter } from "../lib/dashboard-utils";
import type { DashboardStats } from "../lib/dashboard-utils";
import type { Idea } from "@maestro/types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-05-26T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function makeIdea(overrides: Partial<Idea>): Idea {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    name: "Test Idea",
    slug: null,
    description: null,
    tags: [],
    creatorMode: "technical",
    productStage: "build",
    stageEnteredAt: null,
    currentPhase: 0,
    status: "draft",
    feedSourceType: null,
    feedSourceUrl: null,
    feedRawContent: null,
    feedCompletedAt: null,
    intentClarity: 0,
    intentRounds: 0,
    openQuestionsCount: 0,
    intentCompletedAt: null,
    problemStatement: null,
    boundaryExportSha: null,
    boundaryLockedAt: null,
    validationVerdict: null,
    validationCompletedAt: null,
    contractSignedAt: null,
    contractId: null,
    productType: null,
    deadline: null,
    successMetric: null,
    targetN: null,
    deadlineExtensionsUsed: 0,
    extensionPostUrl: null,
    currentVersion: "v0.1",
    githubRepo: null,
    githubRepoNodeId: null,
    marketCurrentValue: 0,
    marketLastCheckedAt: null,
    marketVisible: false,
    postmortemReport: null,
    postmortemAt: null,
    coolingEndsAt: null,
    createdAt: new Date(NOW.getTime() - 60 * DAY).toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

// Deadline 20 days from now (within 30d window)
const DEADLINE_SOON = new Date(NOW.getTime() + 20 * DAY).toISOString();
// Deadline 60 days from now (outside 30d window)
const DEADLINE_FAR = new Date(NOW.getTime() + 60 * DAY).toISOString();

const IDEAS: Idea[] = [
  makeIdea({ id: "1", status: "draft" }),
  makeIdea({ id: "2", status: "active", deadline: DEADLINE_SOON }),
  makeIdea({ id: "3", status: "active", deadline: DEADLINE_FAR }),
  makeIdea({ id: "4", status: "at_risk", deadline: DEADLINE_SOON }),
  makeIdea({ id: "5", status: "in_market" }),
  makeIdea({ id: "6", status: "in_market" }),
  makeIdea({ id: "7", status: "force_closed" }),
  makeIdea({ id: "8", status: "closed_no_go" }),
];

// ── computeStats ─────────────────────────────────────────────────────────────

describe("computeStats", () => {
  let stats: DashboardStats;
  beforeAll(() => {
    stats = computeStats(IDEAS);
  });

  it("counts all ideas as total", () => {
    expect(stats.total).toBe(8);
  });

  it("counts only in_market as live", () => {
    expect(stats.live).toBe(2);
  });

  it("counts active/at_risk ideas with deadline within 30 days", () => {
    // idea 2 (active, soon), idea 4 (at_risk, soon) → 2
    expect(stats.deadlineSoon).toBe(2);
  });

  it("ignores in_market deadlines for deadlineSoon", () => {
    // in_market ideas are not active/at_risk
    const withInMarketDeadline = [...IDEAS, makeIdea({ id: "9", status: "in_market", deadline: DEADLINE_SOON })];
    expect(computeStats(withInMarketDeadline).deadlineSoon).toBe(2);
  });

  it("counts only force_closed (not closed_no_go) as forceClosed", () => {
    expect(stats.forceClosed).toBe(1);
  });

  it("returns zeros for empty list", () => {
    expect(computeStats([])).toEqual({ total: 0, live: 0, deadlineSoon: 0, forceClosed: 0 });
  });
});

// ── applyFilter ───────────────────────────────────────────────────────────────

describe("applyFilter", () => {
  it("'all' returns every idea", () => {
    expect(applyFilter(IDEAS, "all")).toHaveLength(8);
  });

  it("'active' returns only active ideas", () => {
    const result = applyFilter(IDEAS, "active");
    expect(result.every((i) => i.status === "active")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("'at_risk' returns only at_risk ideas", () => {
    const result = applyFilter(IDEAS, "at_risk");
    expect(result.every((i) => i.status === "at_risk")).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("'in_market' returns only in_market ideas", () => {
    const result = applyFilter(IDEAS, "in_market");
    expect(result.every((i) => i.status === "in_market")).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("'closed' returns force_closed and closed_no_go", () => {
    const result = applyFilter(IDEAS, "closed");
    expect(result.map((i) => i.id).sort()).toEqual(["7", "8"]);
  });

  it("returns empty array when no ideas match filter", () => {
    const onlyDraft = [makeIdea({ status: "draft" })];
    expect(applyFilter(onlyDraft, "active")).toHaveLength(0);
  });
});
