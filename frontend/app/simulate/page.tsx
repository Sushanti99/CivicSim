"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  Agent,
  AgentResponse,
  AnswerProb,
  Domain,
  Location,
  MatchQuestionResult,
  QuestionMeta,
  api,
  simulateStream,
} from "@/lib/api";
import { AgentTable } from "@/components/AgentTable";
import { DimensionSelector } from "@/components/DimensionSelector";
import { DomainPicker } from "@/components/DomainPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { OpinionDistribution } from "@/components/OpinionDistribution";
import { QuestionPicker } from "@/components/QuestionPicker";
import { RationaleList } from "@/components/RationaleList";

type Status = "idle" | "running" | "done" | "error";

const ANSWER_SCALES = [
  {
    id: "support_oppose",
    label: "Support / Oppose",
    options: ["Strongly support", "Somewhat support", "Neither support nor oppose", "Somewhat oppose", "Strongly oppose"],
  },
  {
    id: "agree_disagree",
    label: "Agree / Disagree",
    options: ["Strongly agree", "Somewhat agree", "Neither agree nor disagree", "Somewhat disagree", "Strongly disagree"],
  },
  {
    id: "favor_oppose",
    label: "Favor / Oppose",
    options: ["Strongly favor", "Somewhat favor", "Neither favor nor oppose", "Somewhat oppose", "Strongly oppose"],
  },
  {
    id: "yes_no",
    label: "Yes / No",
    options: ["Yes", "Probably yes", "Unsure", "Probably no", "No"],
  },
];

export default function SimulatePage() {
  // ---- catalog data ----
  const [locations, setLocations] = useState<Location[]>([]);
  const [questions, setQuestions] = useState<QuestionMeta[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  // ---- form state ----
  const [location, setLocation] = useState<string>("region_west");
  const [domainId, setDomainId] = useState<string>("");
  const [selectedDims, setSelectedDims] = useState<Set<string>>(new Set());
  const [questionId, setQuestionId] = useState<string>("");
  const [freeText, setFreeText] = useState<string>("");
  const [n, setN] = useState<number>(15);
  const [answerScaleId, setAnswerScaleId] = useState<string>("support_oppose");

  // ---- free-text validation & matching ----
  const [matchStatus, setMatchStatus] = useState<{
    level: MatchQuestionResult["match_level"] | "checking";
    label?: string | null;
  } | null>(null);
  const [validationError, setValidationError] = useState<string>("");
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- run state ----
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [simId, setSimId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    question_label: string;
    has_prior: boolean;
    prior_source_label: string | null;
    domain_label: string | null;
  } | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [responses, setResponses] = useState<AgentResponse[]>([]);
  const [aggregate, setAggregate] = useState<AnswerProb[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  // ---- load catalogs ----
  useEffect(() => {
    api.locations().then((r) => setLocations(r.locations)).catch(() => undefined);
    api.questions().then((r) => setQuestions(r.questions)).catch(() => undefined);
    api.domains().then((ds) => setDomains(ds)).catch(() => undefined);
  }, []);

  // ---- auto-apply dimension defaults when domain changes ----
  useEffect(() => {
    const domain = domains.find((d) => d.id === domainId);
    if (!domain) {
      setSelectedDims(new Set());
      return;
    }
    setSelectedDims(new Set(domain.dimensions.filter((d) => d.auto_selected).map((d) => d.key)));
    if (domain.question_ids.length > 0 && !questionId) {
      const match = questions.find((q) => domain.question_ids.includes(q.question_id));
      if (match) setQuestionId(match.question_id);
    }
  }, [domainId, domains]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- debounced match + validation when free text changes ----
  useEffect(() => {
    if (questionId || !freeText.trim()) {
      setMatchStatus(null);
      setValidationError("");
      return;
    }
    setMatchStatus({ level: "checking" });
    setValidationError("");

    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    matchDebounceRef.current = setTimeout(async () => {
      try {
        const [validate, match] = await Promise.all([
          api.validateQuestion(freeText.trim()),
          api.matchQuestion(freeText.trim()),
        ]);
        if (!validate.is_policy) {
          setValidationError(validate.reason);
          setMatchStatus(null);
        } else {
          setValidationError("");
          setMatchStatus({ level: match.match_level, label: match.question_label });
        }
      } catch {
        setMatchStatus(null);
      }
    }, 600);

    return () => {
      if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    };
  }, [freeText, questionId]);

  function toggleDim(key: string) {
    setSelectedDims((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function reset() {
    setAgents([]);
    setResponses([]);
    setAggregate([]);
    setMeta(null);
    setError(null);
    setSimId(null);
  }

  async function run() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    reset();
    setStatus("running");

    const noMatch = !questionId && matchStatus?.level === "none";
    const customOptions = noMatch
      ? (ANSWER_SCALES.find((s) => s.id === answerScaleId)?.options ?? undefined)
      : undefined;

    try {
      for await (const ev of simulateStream(
        {
          location,
          n,
          question_id: questionId || undefined,
          free_text: freeText || undefined,
          domain: domainId || undefined,
          selected_dims: selectedDims.size > 0 ? [...selectedDims] : undefined,
          custom_answer_options: customOptions,
        },
        ctrl.signal,
      )) {
        if (ev.event === "meta") {
          setSimId(ev.data.sim_id);
          setMeta({
            question_label: ev.data.question_label,
            has_prior: ev.data.has_prior,
            prior_source_label: ev.data.prior_source_label,
            domain_label: ev.data.domain_label,
          });
        } else if (ev.event === "agent_sampled") {
          setAgents((prev) => [...prev, ev.data]);
        } else if (ev.event === "agent_responded") {
          setResponses((prev) => [...prev, ev.data]);
        } else if (ev.event === "aggregate") {
          setAggregate(ev.data.distribution);
        } else if (ev.event === "done") {
          setSimId(ev.data.sim_id);
          setStatus("done");
        } else if (ev.event === "error") {
          throw new Error(ev.data.message);
        }
      }
      setStatus("done");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStatus("idle");
  }

  const activeDomain = domains.find((d) => d.id === domainId) ?? null;
  const showScalePicker = !questionId && freeText.trim().length > 4 && matchStatus?.level === "none";
  const canRun =
    !!location &&
    (!!questionId || freeText.trim().length > 4) &&
    (!!questionId || !validationError) &&
    (!!questionId || matchStatus?.level !== "checking") &&
    status !== "running";

  // Dynamic step numbers
  const stepQuestion = activeDomain ? 4 : 3;
  const stepScale = activeDomain ? 5 : 4;
  const stepSample = activeDomain ? (showScalePicker ? 6 : 5) : (showScalePicker ? 5 : 4);

  return (
    <div className="min-h-screen">
      {/* Top progress bar */}
      {status === "running" && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-[color:var(--color-border)]">
          <div
            className="h-0.5 bg-[color:var(--color-cyan)] transition-all duration-500"
            style={{ width: `${Math.round((responses.length / n) * 100)}%` }}
          />
        </div>
      )}

      <header className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="text-[color:var(--color-cyan)]">◇</span>
            CivicSim
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <span className="text-[color:var(--color-text)]">Simulate</span>
            <Link
              href="/simulations"
              className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
            >
              Simulations
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-8 px-8 py-12 lg:grid-cols-[420px_1fr]">
        {/* ── Left sidebar: configuration ── */}
        <aside className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Simulate</h1>
            <p className="mt-2 text-sm text-[color:var(--color-text-dim)]">
              Select a location, choose a policy domain, tune the demographic dimensions, then run.
            </p>
          </div>

          {/* Step 1: Location */}
          <StepCard step={1} title="Location">
            <LocationPicker locations={locations} value={location} onChange={setLocation} />
          </StepCard>

          {/* Step 2: Domain */}
          <StepCard step={2} title="Policy domain">
            <DomainPicker domains={domains} value={domainId} onChange={setDomainId} />
          </StepCard>

          {/* Step 3: Dimensions (shown when domain is selected) */}
          {activeDomain && (
            <StepCard step={3} title="Demographic conditioning">
              <DimensionSelector
                dimensions={activeDomain.dimensions}
                selected={selectedDims}
                onToggle={toggleDim}
              />
              {activeDomain.needs_geo && (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  ⚠ Experiment 3: geography is strongly predictive for this domain. A regional
                  location is recommended.
                </p>
              )}
              {activeDomain.geo_decision === "not_needed" && (
                <p className="mt-3 text-xs text-[color:var(--color-text-dim)]">
                  ✓ Experiment 3: geography adds minimal signal here, demographic dims dominate.
                </p>
              )}
            </StepCard>
          )}

          {/* Step 4 (or 3): Question */}
          <StepCard step={stepQuestion} title="Policy question">
            <QuestionPicker
              questions={
                activeDomain && activeDomain.question_ids.length > 0
                  ? questions.filter(
                      (q) => !activeDomain || activeDomain.question_ids.includes(q.question_id),
                    )
                  : questions
              }
              questionId={questionId}
              freeText={freeText}
              onChange={({ questionId, freeText }) => {
                setQuestionId(questionId);
                setFreeText(freeText);
              }}
              matchStatus={matchStatus ?? undefined}
              validationError={validationError}
            />
            {activeDomain && activeDomain.question_ids.length === 0 && (
              <p className="mt-1.5 text-xs text-[color:var(--color-text-dim)]">
                No curated questions for this domain. Use free text above.
              </p>
            )}
          </StepCard>

          {/* Scale picker: only when free text has no ATP match */}
          {showScalePicker && (
            <StepCard step={stepScale} title="Response scale">
              <p className="mb-3 text-xs text-[color:var(--color-text-dim)]">
                No survey prior found for this question. Choose the scale agents should respond on.
              </p>
              <div className="space-y-2">
                {ANSWER_SCALES.map((scale) => (
                  <button
                    key={scale.id}
                    onClick={() => setAnswerScaleId(scale.id)}
                    className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                      answerScaleId === scale.id
                        ? "border-[color:var(--color-cyan)] bg-[color:var(--color-cyan)]/10 text-[color:var(--color-cyan)]"
                        : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-hi)] text-[color:var(--color-text-dim)]"
                    }`}
                  >
                    <span className="font-medium">{scale.label}</span>
                    <span className="ml-2 text-xs opacity-60">
                      ({scale.options[0]} … {scale.options[scale.options.length - 1]})
                    </span>
                  </button>
                ))}
              </div>
            </StepCard>
          )}

          {/* Sample size */}
          <StepCard step={stepSample} title="Sample size">
            <label className="block">
              <span className="flex items-center justify-between text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
                <span># Agents</span>
                <span className="font-mono text-[color:var(--color-cyan)]">{n}</span>
              </span>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
          </StepCard>

          {/* Run / Stop */}
          <div className="flex gap-3">
            <button
              disabled={!canRun}
              onClick={run}
              className="flex-1 rounded-full bg-[color:var(--color-cyan)] px-5 py-3 font-medium text-[color:var(--color-on-accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "running" ? "Running…" : "Run simulation"}
            </button>
            {status === "running" && (
              <button
                onClick={stop}
                className="rounded-full border border-[color:var(--color-border-hi)] px-5 py-3 font-medium hover:bg-[color:var(--color-hover)]"
              >
                Stop
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
        </aside>

        {/* ── Right panel: results ── */}
        <section className="space-y-8">
          {/* Simulation saved banner */}
          {simId && status === "done" && (
            <div className="rounded-2xl border border-[color:var(--color-cyan)]/30 bg-[color:var(--color-cyan)]/5 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-[color:var(--color-cyan)]">
                  Simulation complete
                </div>
                <Link
                  href={`/simulations/${encodeURIComponent(simId)}`}
                  className="rounded-full border border-[color:var(--color-cyan)]/40 px-3 py-1 text-xs text-[color:var(--color-cyan)] hover:bg-[color:var(--color-cyan)]/10"
                >
                  View full results →
                </Link>
              </div>
              <div className="mt-1 font-mono text-sm text-[color:var(--color-text-dim)]">
                {simId}
              </div>
            </div>
          )}

          {/* Running state: clean progress card */}
          {status === "running" && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-6">
              <div className="flex items-center gap-3 mb-5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--color-cyan)] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[color:var(--color-cyan)]" />
                </span>
                <span className="text-sm font-medium text-[color:var(--color-text)]">
                  Assembling synthetic electorate
                </span>
              </div>

              {/* Phase 1: agent sampling */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-[color:var(--color-text-faint)] mb-1.5">
                  <span>Agents sampled</span>
                  <span className="font-mono text-[color:var(--color-text-dim)]">{agents.length} / {n}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[color:var(--color-border)]">
                  <div
                    className="h-1.5 rounded-full bg-[color:var(--color-cyan)]/60 transition-all duration-500"
                    style={{ width: `${Math.round((agents.length / n) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Phase 2: LLM responses */}
              <div>
                <div className="flex justify-between text-xs text-[color:var(--color-text-faint)] mb-1.5">
                  <span>Responses collected</span>
                  <span className="font-mono text-[color:var(--color-text-dim)]">{responses.length} / {n}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[color:var(--color-border)]">
                  <div
                    className="h-1.5 rounded-full bg-[color:var(--color-cyan)] transition-all duration-500"
                    style={{ width: `${Math.round((responses.length / n) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Question + prior status */}
          {meta && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-5 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
                {meta.domain_label && (
                  <span className="rounded-full border border-[color:var(--color-cyan)]/30 bg-[color:var(--color-cyan)]/10 px-2 py-0.5 text-[color:var(--color-cyan)]">
                    {meta.domain_label}
                  </span>
                )}
                <span>Question</span>
              </div>
              <div className="text-lg font-medium">{meta.question_label}</div>
              {meta.has_prior && meta.prior_source_label ? (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 text-xs text-emerald-400">
                  <span className="mt-px shrink-0">✓</span>
                  <span>
                    <strong className="font-semibold">Demographically grounded.</strong>{" "}
                    Agents carry empirical priors from the closest ATP survey question:{" "}
                    <em>&ldquo;{meta.prior_source_label}&rdquo;</em>
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-xs text-amber-400">
                  <span className="mt-px shrink-0">⚠</span>
                  <span>
                    <strong className="font-semibold">No survey prior available.</strong>{" "}
                    No ATP question closely matches this topic. Agents are conditioned on demographics only — responses reflect persona, not empirically observed opinion distributions.
                  </span>
                </div>
              )}
            </div>
          )}

          {(aggregate.length > 0 || status === "done") && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                Aggregate distribution
              </h2>
              <OpinionDistribution
                distribution={aggregate}
                title={`n = ${responses.length}`}
                empty="The aggregate will appear once the LLM has responded for every agent."
              />
            </div>
          )}

          {agents.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                Synthetic electorate
              </h2>
              <AgentTable agents={agents} />
            </div>
          )}

          {responses.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                Per-agent rationales
              </h2>
              <RationaleList agents={agents} responses={responses} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-cyan)]/15 text-xs font-semibold text-[color:var(--color-cyan)]">
          {step}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
