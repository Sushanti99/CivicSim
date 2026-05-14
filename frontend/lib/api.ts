// Typed client for the CivicSim backend.
// All requests go to ${NEXT_PUBLIC_API_BASE_URL}/api/* (the Next.js rewrite in
// next.config.ts also proxies /api/* in dev for same-origin SSE).

export type Location = {
  id: string;
  label: string;
  kind: "region" | "division" | "county" | null;
  region: string | null;
  division: string | null;
  state: string | null;
  population: number | null;
};

export type Agent = {
  agent_id: number;
  age: string;
  race: string;
  income: string;
  occupation: string;
};

export type AnswerProb = { answer_label: string; prob: number };

export type QuestionMeta = {
  question_id: string;
  question_label: string;
  answer_labels: string[];
};

export type AgentResponse = {
  agent_id: number;
  stance: string;
  rationale: string;
  prior: AnswerProb[];
};

export type DomainDimension = {
  key: string;
  label: string;
  kl: number;
  auto_selected: boolean;
};

export type Domain = {
  id: string;
  label: string;
  description: string;
  needs_geo: boolean;
  geo_decision: string;
  geo_note: string;
  dimensions: DomainDimension[];
  question_ids: string[];
};

export type SimulationMeta = {
  sim_id: string;
  timestamp: string;
  location: string;
  domain: string | null;
  question_id: string;
  question_label: string;
  n: number;
  n_agents: number;
  selected_dims: string[] | null;
  complete: boolean;
  summary?: { distribution: AnswerProb[]; n: number };
};

export type AgentRecord = {
  agent_id: number;
  demographics: Agent;
  selected_dims: string[] | null;
  used_filter: Record<string, string>;
  backoff_steps: string[];
  prior: AnswerProb[];
  stance: string;
  rationale: string;
};

export type SimulationDetail = {
  sim_id: string;
  timestamp: string;
  location: string;
  domain: string | null;
  domain_label: string | null;
  question_id: string;
  question_label: string;
  n: number;
  selected_dims: string[] | null;
  matched_from_free_text: boolean;
  agents: AgentRecord[];
  summary: { distribution: AnswerProb[]; n: number } | null;
};

export type MatchQuestionResult = {
  question_id: string | null;
  question_label: string | null;
  score: number;
  match_level: "close" | "weak" | "none";
};

export type ValidateQuestionResult = {
  is_policy: boolean;
  reason: string;
};

export type SimulateRequest = {
  location: string;
  n: number;
  question_id?: string;
  free_text?: string;
  domain?: string;
  selected_dims?: string[];
  seed?: number;
  model?: string;
  custom_answer_options?: string[];
};

export type SimulateEvent =
  | { event: "meta"; data: { sim_id: string; question_id: string | null; question_label: string; has_prior: boolean; prior_source_label: string | null; answer_options: string[]; domain: string | null; domain_label: string | null } }
  | { event: "agent_sampled"; data: Agent }
  | { event: "prior_attached"; data: { agent_id: number; prior: AnswerProb[]; used_filter: Record<string, string>; backoff_steps: string[] } }
  | { event: "agent_responded"; data: AgentResponse }
  | { event: "aggregate"; data: { distribution: AnswerProb[]; n: number } }
  | { event: "done"; data: { sim_id: string } }
  | { event: "error"; data: { message: string } };

const API_BASE = "/api";

// Next.js rewrites buffer the full response before forwarding, which breaks SSE.
// For streaming endpoints we hit the backend directly.
const STREAM_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`API ${path} failed: ${res.status} ${detail}`);
  }
  return res.json();
}

export const api = {
  locations: () => http<{ locations: Location[] }>("/locations"),
  questions: () => http<{ questions: QuestionMeta[] }>("/questions"),
  domains: () => http<Domain[]>("/domains"),
  domain: (id: string) => http<Domain>(`/domains/${id}`),
  simulations: (limit?: number) =>
    http<SimulationMeta[]>(`/simulations${limit ? `?limit=${limit}` : ""}`),
  simulationDetail: (sim_id: string) =>
    http<SimulationDetail>(`/simulations/${encodeURIComponent(sim_id)}`),
  agents: (body: { location: string; n: number; seed?: number }) =>
    http<{ location: string; n: number; agents: Agent[] }>("/agents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  poll: (body: { question_id: string; demographic_filter?: Record<string, string> }) =>
    http<{ question_id: string; distribution: AnswerProb[]; used_filter: Record<string, string>; backoff_steps: string[] }>(
      "/poll",
      { method: "POST", body: JSON.stringify(body) },
    ),
  matchQuestion: (q: string) =>
    http<MatchQuestionResult>(`/match-question?q=${encodeURIComponent(q)}`),
  validateQuestion: (q: string) =>
    http<ValidateQuestionResult>(`/validate-question?q=${encodeURIComponent(q)}`),
  deleteSimulation: async (sim_id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/simulations/${encodeURIComponent(sim_id)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${res.status}`);
  },
};

/**
 * Stream `/api/simulate` as an async iterator of typed events.
 *
 * We POST with `Accept: text/event-stream` and parse the `event:` / `data:`
 * lines manually — the EventSource API doesn't support POST.
 */
export async function* simulateStream(
  body: SimulateRequest,
  signal?: AbortSignal,
): AsyncGenerator<SimulateEvent, void, unknown> {
  const res = await fetch(`${STREAM_BASE}/api/simulate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = await res.text();
    }
    throw new Error(`simulate failed: ${res.status} ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx: number;
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      const ev = parseSseBlock(block);
      if (ev) yield ev;
    }
  }
}

function parseSseBlock(block: string): SimulateEvent | null {
  let event: string | null = null;
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!event) return null;
  try {
    return { event, data: JSON.parse(data) } as SimulateEvent;
  } catch {
    return null;
  }
}
