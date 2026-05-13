"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  Agent,
  AgentResponse,
  AnswerProb,
  Domain,
  Location,
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

  // ---- run state ----
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [simId, setSimId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    question_label: string;
    matched: boolean;
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
    // Pre-select dims marked auto_selected by Experiment 2
    setSelectedDims(new Set(domain.dimensions.filter((d) => d.auto_selected).map((d) => d.key)));
    // Pre-select first matching question from this domain
    if (domain.question_ids.length > 0 && !questionId) {
      const match = questions.find((q) => domain.question_ids.includes(q.question_id));
      if (match) setQuestionId(match.question_id);
    }
  }, [domainId, domains]); // eslint-disable-line react-hooks/exhaustive-deps

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

    try {
      for await (const ev of simulateStream(
        {
          location,
          n,
          question_id: questionId || undefined,
          free_text: freeText || undefined,
          domain: domainId || undefined,
          selected_dims: selectedDims.size > 0 ? [...selectedDims] : undefined,
        },
        ctrl.signal,
      )) {
        if (ev.event === "meta") {
          setSimId(ev.data.sim_id);
          setMeta({
            question_label: ev.data.question_label,
            matched: ev.data.matched_from_free_text,
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
  const canRun =
    !!location && (!!questionId || freeText.trim().length > 4) && status !== "running";

  return (
    <div className="min-h-screen">
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

          {/* Step 1 — Location */}
          <StepCard step={1} title="Location">
            <LocationPicker locations={locations} value={location} onChange={setLocation} />
          </StepCard>

          {/* Step 2 — Domain */}
          <StepCard step={2} title="Policy domain">
            <DomainPicker domains={domains} value={domainId} onChange={setDomainId} />
          </StepCard>

          {/* Step 3 — Dimensions (shown when domain is selected) */}
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
                  ✓ Experiment 3: geography adds minimal signal here — demographic dims dominate.
                </p>
              )}
            </StepCard>
          )}

          {/* Step 4 — Question */}
          <StepCard step={activeDomain ? 4 : 3} title="Policy question">
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
            />
            {activeDomain && activeDomain.question_ids.length === 0 && (
              <p className="mt-1.5 text-xs text-[color:var(--color-text-dim)]">
                No curated questions for this domain — use free text above.
              </p>
            )}
          </StepCard>

          {/* Step 5 — Sample size */}
          <StepCard step={activeDomain ? 5 : 4} title="Sample size">
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
              onClick={() => setShowDisclaimer(true)}
              className="flex-1 rounded-full bg-[color:var(--color-cyan)] px-5 py-3 font-medium text-[color:var(--color-on-accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Run simulation
            </button>
          </div>

          {showDisclaimer && (
            <div className="rounded-2xl border border-[color:var(--color-border-hi)] bg-[color:var(--color-surface)] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔒</span>
                <span className="font-semibold text-[color:var(--color-text)]">Not available to the public yet</span>
              </div>
              <p className="text-sm text-[color:var(--color-text-dim)] leading-relaxed">
                The live simulator is currently restricted to our research team. We&apos;re working on opening access soon.
              </p>
              <p className="text-sm text-[color:var(--color-text-dim)] leading-relaxed">
                In the meantime, explore example simulation runs on the{" "}
                <Link href="/simulations" className="text-[color:var(--color-cyan)] underline underline-offset-2">
                  Simulations dashboard
                </Link>{" "}
                to see what the output looks like.
              </p>
              <button
                onClick={() => setShowDisclaimer(false)}
                className="text-xs text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text-dim)] transition"
              >
                Dismiss
              </button>
            </div>
          )}
        </aside>

        {/* ── Right panel: results ── */}
        <section className="space-y-8">
          {/* Simulation saved banner */}
          {simId && (
            <div className="rounded-2xl border border-[color:var(--color-cyan)]/30 bg-[color:var(--color-cyan)]/5 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-[color:var(--color-cyan)]">
                  Simulation saved
                </div>
                {status === "done" && (
                  <Link
                    href="/simulations"
                    className="rounded-full border border-[color:var(--color-cyan)]/40 px-3 py-1 text-xs text-[color:var(--color-cyan)] hover:bg-[color:var(--color-cyan)]/10"
                  >
                    View dashboard →
                  </Link>
                )}
              </div>
              <div className="mt-1 font-mono text-sm text-[color:var(--color-text-dim)]">
                data/simulations/{simId}/
              </div>
              <p className="mt-1 text-xs text-[color:var(--color-text-dim)]">
                Per-agent JSON files: demographics · prior · stance · rationale
              </p>
            </div>
          )}

          {/* Matched question */}
          {meta && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-5">
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
                {meta.domain_label && (
                  <span className="rounded-full border border-[color:var(--color-cyan)]/30 bg-[color:var(--color-cyan)]/10 px-2 py-0.5 text-[color:var(--color-cyan)]">
                    {meta.domain_label}
                  </span>
                )}
                <span>Question{meta.matched ? " (matched from your text)" : ""}</span>
              </div>
              <div className="mt-1 text-lg">{meta.question_label}</div>
            </div>
          )}

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

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
              Synthetic electorate
            </h2>
            <AgentTable agents={agents} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
              Per-agent rationales
            </h2>
            <RationaleList agents={agents} responses={responses} />
          </div>
        </section>
      </main>
    </div>
  );
}

/* Tiny wrapper to keep sidebar items visually grouped */
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
