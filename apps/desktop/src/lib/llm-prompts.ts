/**
 * llm-prompts.ts — Prompt builders for Phase 0 (Feed) and Phase 1 (Intent Dialogue).
 */
import type { ChatMessage } from '@/lib/llm';

// Re-export so consumers can import ChatMessage from here
export type { ChatMessage };

// ── Phase 0: Feed Analysis ───────────────────────────────────────────────────

const FEED_SYSTEM_PROMPT = `You are a product analyst helping a technical founder clarify their idea.
Analyze the provided raw idea and extract a concise problem statement.

Respond with ONLY a JSON object (no markdown, no explanation) in this format:
{
  "problem_statement": "One or two sentences describing the core problem being solved."
}`;

export function buildFeedAnalysisMessages(rawIdea: string): ChatMessage[] {
  return [
    { role: 'system', content: FEED_SYSTEM_PROMPT },
    { role: 'user', content: rawIdea },
  ];
}

// ── Phase 1: Intent Dialogue ─────────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `You are helping a technical founder clarify the intent of their product idea through dialogue.
Your goal is to understand: problem, root cause, mechanism, target user, and success metric.

After each user response, update your understanding and ask up to 3 focused clarifying questions for the next round.

Respond with ONLY a JSON object (no markdown) in this format:
{
  "canvas_update": {
    "problem": "string or null",
    "root_cause": "string or null",
    "mechanism": "string or null",
    "target_user": "string or null",
    "success_metric_desc": "string or null",
    "problem_confidence": 0-100,
    "root_cause_confidence": 0-100,
    "mechanism_confidence": 0-100,
    "target_user_confidence": 0-100,
    "clarity_score": 0-100
  },
  "open_questions": ["question1", "question2"],
  "next_questions": [
    { "id": "q1", "label": "Question text", "placeholder": "e.g. hint", "type": "textarea" }
  ]
}

Rules:
- Only include fields in canvas_update that you have information about (set others to null).
- clarity_score: overall completeness 0-100. Set >= 85 only when you have high confidence in all 4 core fields and no open questions remain.
- next_questions: 1-3 questions max. Empty array if clarity_score >= 85.
- open_questions: unresolved key unknowns (empty when clarity_score >= 85).`;

export function buildIntentFirstRoundMessages(
  problemStatement: string,
  rawFeed: string,
): ChatMessage[] {
  return [
    { role: 'system', content: INTENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Here is the product idea:\n\n${rawFeed}\n\nProblem statement: ${problemStatement}`,
    },
  ];
}

export function buildIntentNextRoundMessages(
  history: ChatMessage[],
  userAnswers: string,
): ChatMessage[] {
  return [
    ...history,
    { role: 'user', content: userAnswers },
  ];
}

// ── Types for parsed LLM responses ───────────────────────────────────────────

export interface FeedAnalysisResult {
  problem_statement: string;
}

export interface IntentQuestion {
  id: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea';
}

export interface IntentCanvasUpdate {
  problem: string | null;
  root_cause: string | null;
  mechanism: string | null;
  target_user: string | null;
  success_metric_desc: string | null;
  problem_confidence: number;
  root_cause_confidence: number;
  mechanism_confidence: number;
  target_user_confidence: number;
  clarity_score: number;
}

export interface IntentRoundResponse {
  canvas_update: IntentCanvasUpdate;
  open_questions: string[];
  next_questions: IntentQuestion[];
}

export function parseFeedAnalysis(text: string): FeedAnalysisResult | null {
  try {
    const json = extractJson(text);
    return json as FeedAnalysisResult;
  } catch {
    return null;
  }
}

export function parseIntentRound(text: string): IntentRoundResponse | null {
  try {
    const json = extractJson(text);
    return json as IntentRoundResponse;
  } catch {
    return null;
  }
}

/** Extract the first JSON object from a string that may contain prose or markdown fences. */
function extractJson(text: string): unknown {
  // Find the outermost { ... } block — handles extra prose before/after JSON
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in LLM response');
  return JSON.parse(match[0]);
}
