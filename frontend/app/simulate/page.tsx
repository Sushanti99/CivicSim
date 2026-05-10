"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  Agent,
  AgentResponse,
  AnswerProb,
  Location,
  QuestionMeta,
  api,
  simulateStream,
} from "@/lib/api";
import { AgentTable } from "@/components/AgentTable";
import { LocationPicker } from "@/components/LocationPicker";
import { OpinionDistribution } from "@/components/OpinionDistribution";
import { QuestionPicker } from "@/components/QuestionPicker";
import { RationaleList } from "@/components/RationaleList";

type Status = "idle" | "running" | "done" | "error";

export default function SimulatePage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [questions, setQuestions] = useState<QuestionMeta[]>([]);

  const [location, setLocation] = useState<string>("alameda_california");
  const [questionId, setQuestionId] = useState<string>("");
  const [freeText, setFreeText] = useState<string>("");
  const [n, setN] = useState<number>(15);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ question_label: string; matched: boolean } | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [responses, setResponses] = useState<AgentResponse[]>([]);
  const [aggregate, setAggregate] = useState<AnswerProb[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.locations().then((r) => setLocations(r.locations)).catch(() => undefined);
    api.questions().then((r) => setQuestions(r.questions)).catch(() => undefined);
  }, []);

  function reset() {
    setAgents([]);
    setResponses([]);
    setAggregate([]);
    setMeta(null);
    setError(null);
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
        },
        ctrl.signal,
      )) {
        if (ev.event === "meta") {
          setMeta({
            question_label: ev.data.question_label,
            matched: ev.data.matched_from_free_text,
          });
        } else if (ev.event === "agent_sampled") {
          setAgents((prev) => [...prev, ev.data]);
        } else if (ev.event === "agent_responded") {
          setResponses((prev) => [...prev, ev.data]);
        } else if (ev.event === "aggregate") {
          setAggregate(ev.data.distribution);
        } else if (ev.event === "done") {
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
          <div className="text-sm text-[color:var(--color-text-dim)]">
            Public demo · Alameda County, CA
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-8 px-8 py-12 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Simulate</h1>
            <p className="mt-2 text-sm text-[color:var(--color-text-dim)]">
              Pick a location, ask a question, and watch a synthetic electorate respond.
            </p>
          </div>

          <LocationPicker locations={locations} value={location} onChange={setLocation} />

          <QuestionPicker
            questions={questions}
            questionId={questionId}
            freeText={freeText}
            onChange={({ questionId, freeText }) => {
              setQuestionId(questionId);
              setFreeText(freeText);
            }}
          />

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

          <div className="flex gap-3">
            <button
              disabled={!canRun}
              onClick={run}
              className="flex-1 rounded-full bg-[color:var(--color-cyan)] px-5 py-3 font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "running" ? "Running…" : "Run simulation"}
            </button>
            {status === "running" && (
              <button
                onClick={stop}
                className="rounded-full border border-[color:var(--color-border-hi)] px-5 py-3 font-medium hover:bg-white/5"
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

        <section className="space-y-8">
          {meta && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-5">
              <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
                Question{meta.matched ? " (matched from your text)" : ""}
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
