/**
 * llm-prompts.ts — Prompt builders for Phase 0 (Feed), Phase 1 (Intent Dialogue),
 * Phase 2 (Boundary Definition), and Phase 3 (Validation Gate).
 */
import { z } from 'zod';
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

// ── Phase 2: Boundary Definition ─────────────────────────────────────────────

export interface IntentCanvasContext {
  problem?: string | null;
  rootCause?: string | null;
  mechanism?: string | null;
  targetUser?: string | null;
}

const SCOPE_ANALYSIS_SYSTEM = `You are helping a technical founder define the clear boundaries of their product idea.
Your goal is to generate a precise, opinionated scope definition: what is IN scope, what is OUT, and what remains OPEN.

Generate exactly 5-8 scope items that are:
- Specific and actionable (not vague platitudes)
- Based directly on the intent canvas and problem statement
- Mix of in_scope, out_of_scope, and open_question types

Respond with ONLY a JSON object (no markdown, no explanation) in this format:
{
  "scope_items": [
    {
      "type": "in_scope" | "out_of_scope" | "open_question",
      "title": "Short label (3-6 words)",
      "description": "1-2 sentence explanation of why this is in/out/open"
    }
  ]
}

Rules:
- in_scope: Core features required for the MVP success metric
- out_of_scope: Things explicitly excluded to maintain focus
- open_question: Decisions that need founder input before locking
- Be opinionated. If something should be out of scope, say so clearly.`;

export function buildScopeAnalysisPrompt(
  intentCanvas: IntentCanvasContext,
  problemStatement: string,
): ChatMessage[] {
  const canvasText = [
    intentCanvas.problem ? `Problem: ${intentCanvas.problem}` : null,
    intentCanvas.rootCause ? `Root Cause: ${intentCanvas.rootCause}` : null,
    intentCanvas.mechanism ? `Mechanism: ${intentCanvas.mechanism}` : null,
    intentCanvas.targetUser ? `Target User: ${intentCanvas.targetUser}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    { role: 'system', content: SCOPE_ANALYSIS_SYSTEM },
    {
      role: 'user',
      content: `Problem Statement: ${problemStatement}\n\nIntent Canvas:\n${canvasText}`,
    },
  ];
}

// ── Phase 3: Validation Gate ──────────────────────────────────────────────────

export interface ScopeItemContext {
  type: string;
  title: string;
  description?: string | null;
}

const ADVOCATE_SYSTEM = `You are acting as the ADVOCATE for this product idea. Your role is to find the strongest possible case FOR building this product.

Search for:
- Evidence the problem is real and painful
- Proof that the target user segment exists and is underserved
- Market signals that validate demand
- Competitive gaps that create opportunity
- Analogies from successful products that solved similar problems

Be rigorous but optimistic. Your job is to build the strongest honest case for "go".

Respond with ONLY a JSON object (no markdown, no explanation) in this format:
{
  "evidence_items": [
    {
      "badge": "proves_problem" | "adjacent_signal" | "evidence_gap",
      "title": "Short label (3-6 words)",
      "description": "2-3 sentence evidence item with specific, concrete reasoning"
    }
  ],
  "synthesis": "2-3 sentence summary of why this idea has a strong case",
  "verdict": "go" | "ambiguous"
}

Rules:
- 4-6 evidence items
- badge "proves_problem": directly validates the core problem
- badge "adjacent_signal": related market signals that support the idea
- badge "evidence_gap": known unknowns that remain — be honest about gaps`;

export function buildAdvocatePrompt(
  intentCanvas: IntentCanvasContext,
  scopeItems: ScopeItemContext[],
): ChatMessage[] {
  const scopeText = scopeItems
    .map((s) => `[${s.type}] ${s.title}: ${s.description ?? ''}`)
    .join('\n');

  return [
    { role: 'system', content: ADVOCATE_SYSTEM },
    {
      role: 'user',
      content: `Product Idea:\nProblem: ${intentCanvas.problem ?? 'N/A'}\nMechanism: ${intentCanvas.mechanism ?? 'N/A'}\nTarget User: ${intentCanvas.targetUser ?? 'N/A'}\n\nScope Definition:\n${scopeText}`,
    },
  ];
}

const PROSECUTOR_SYSTEM = `You are acting as the PROSECUTOR against this product idea. Your job is to kill it.

Find the strongest case AGAINST building this product:
- Fatal risks that could doom the product
- Adoption barriers that will prevent users from switching
- Market conditions that make success unlikely
- Competitor advantages the founder hasn't accounted for
- Assumption failures in the product thesis

Be ruthlessly honest. Your job is "no-go" unless the evidence is overwhelmingly weak.

Respond with ONLY a JSON object (no markdown, no explanation) in this format:
{
  "evidence_items": [
    {
      "badge": "adoption_risk" | "evidence_gap" | "fatal_risk",
      "title": "Short label (3-6 words)",
      "description": "2-3 sentence challenge with specific, concrete reasoning"
    }
  ],
  "synthesis": "2-3 sentence summary of the strongest case against",
  "verdict": "no_go" | "ambiguous"
}

Rules:
- 4-6 evidence items
- badge "fatal_risk": a single issue that could kill the whole product — use sparingly, max 1
- badge "adoption_risk": realistic barrier to user adoption
- badge "evidence_gap": critical unknown that must be resolved before building`;

export function buildProsecutorPrompt(
  intentCanvas: IntentCanvasContext,
  scopeItems: ScopeItemContext[],
): ChatMessage[] {
  const scopeText = scopeItems
    .map((s) => `[${s.type}] ${s.title}: ${s.description ?? ''}`)
    .join('\n');

  return [
    { role: 'system', content: PROSECUTOR_SYSTEM },
    {
      role: 'user',
      content: `Product Idea:\nProblem: ${intentCanvas.problem ?? 'N/A'}\nMechanism: ${intentCanvas.mechanism ?? 'N/A'}\nTarget User: ${intentCanvas.targetUser ?? 'N/A'}\n\nScope Definition:\n${scopeText}`,
    },
  ];
}

// ── Zod schemas for LLM response parsing ─────────────────────────────────────

export const ScopeItemsResponse = z.object({
  scope_items: z.array(
    z.object({
      type: z.enum(['in_scope', 'out_of_scope', 'open_question']),
      title: z.string(),
      description: z.string(),
    }),
  ),
});
export type ScopeItemsResponseType = z.infer<typeof ScopeItemsResponse>;

export const ValidationPassResponse = z.object({
  evidence_items: z.array(
    z.object({
      badge: z.enum(['proves_problem', 'adjacent_signal', 'adoption_risk', 'evidence_gap', 'fatal_risk']),
      title: z.string(),
      description: z.string(),
    }),
  ),
  synthesis: z.string(),
  verdict: z.enum(['go', 'no_go', 'ambiguous']),
});
export type ValidationPassResponseType = z.infer<typeof ValidationPassResponse>;

export function parseScopeItems(text: string): ScopeItemsResponseType | null {
  try {
    const json = extractJson(text);
    return ScopeItemsResponse.parse(json);
  } catch {
    return null;
  }
}

export function parseValidationPass(text: string): ValidationPassResponseType | null {
  try {
    const json = extractJson(text);
    return ValidationPassResponse.parse(json);
  } catch {
    return null;
  }
}
