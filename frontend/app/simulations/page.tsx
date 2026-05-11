"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AnswerProb, api } from "@/lib/api";

type SimRun = {
  sim_id: string;
  serial?: number;
  location?: string;
  domain?: string;
  domain_label?: string;
  question_label?: string;
  n?: number;
  n_agents: number;
  selected_dims?: string[];
  timestamp?: string;
  complete: boolean;
  summary?: {
    distribution: AnswerProb[];
    n: number;
  };
};

function parseSerial(sim_id: string): number | undefined {
  const n = parseInt(sim_id.split("__")[0], 10);
  return isNaN(n) ? undefined : n;
}

function formatTs(ts?: string) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

function MiniBar({ dist }: { dist: AnswerProb[] }) {
  const total = dist.reduce((s, d) => s + d.prob, 0);
  if (total === 0) return null;
  const sorted = [...dist].sort((a, b) => b.prob - a.prob);
  const colors = [
    "bg-[color:var(--color-cyan)]",
    "bg-violet-500",
    "bg-amber-400",
    "bg-rose-500",
    "bg-emerald-500",
  ];
  return (
    <div className="mt-3 space-y-1.5">
      {sorted.map((d, i) => (
        <div key={d.answer_label} className="flex items-center gap-2 text-xs">
          <div className="w-28 shrink-0 truncate text-[color:var(--color-text-dim)]">
            {d.answer_label}
          </div>
          <div className="flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-2 rounded-full ${colors[i % colors.length]}`}
              style={{ width: `${Math.round((d.prob / total) * 100)}%` }}
            />
          </div>
          <div className="w-8 text-right font-mono text-[color:var(--color-text-dim)]">
            {Math.round(d.prob * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SimulationsPage() {
  const [sims, setSims] = useState<SimRun[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .simulations(50)
      .then((data) => {
        const runs = (data as unknown as SimRun[]).map((r) => ({
          ...r,
          serial: parseSerial(r.sim_id),
        }));
        // Sort by serial desc (newest first)
        runs.sort((a, b) => (b.serial ?? 0) - (a.serial ?? 0));
        setSims(runs);
      })
      .catch(() => setSims([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // Auto-refresh every 5 s while the page is open
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="text-[color:var(--color-cyan)]">◇</span>
            CivicSim
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/simulate"
              className="text-[color:var(--color-text-dim)] hover:text-white"
            >
              Simulate
            </Link>
            <span className="text-white">Simulations</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-8 py-12">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Simulation runs</h1>
            <p className="mt-1 text-sm text-[color:var(--color-text-dim)]">
              Every run is persisted to{" "}
              <code className="font-mono text-[color:var(--color-cyan)]">
                data/simulations/
              </code>{" "}
              with per-agent JSON files.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[color:var(--color-text-dim)]">
              {sims.length} run{sims.length !== 1 ? "s" : ""}
            </span>
            <Link
              href="/simulate"
              className="rounded-full bg-[color:var(--color-cyan)] px-5 py-2 text-sm font-medium text-black hover:opacity-90"
            >
              + New simulation
            </Link>
          </div>
        </div>

        {loading && sims.length === 0 ? (
          <div className="py-24 text-center text-sm text-[color:var(--color-text-dim)]">
            Loading…
          </div>
        ) : sims.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] py-24 text-center">
            <p className="text-[color:var(--color-text-dim)]">No simulations yet.</p>
            <Link
              href="/simulate"
              className="mt-4 inline-block rounded-full bg-[color:var(--color-cyan)] px-6 py-2.5 text-sm font-medium text-black hover:opacity-90"
            >
              Run your first simulation
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sims.map((sim) => (
              <SimCard key={sim.sim_id} sim={sim} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SimCard({ sim }: { sim: SimRun }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/50 p-5 transition hover:border-[color:var(--color-border-hi)]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {sim.serial !== undefined && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-cyan)]/15 font-mono text-xs font-bold text-[color:var(--color-cyan)]">
              {sim.serial}
            </span>
          )}
          <div>
            <div className="text-sm font-semibold leading-tight">
              {sim.domain_label ?? sim.domain ?? "General"}
            </div>
            <div className="mt-0.5 text-xs text-[color:var(--color-text-dim)]">
              {sim.location?.replace(/_/g, " ") ?? "—"}
            </div>
          </div>
        </div>
        <span
          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            sim.complete
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {sim.complete ? "complete" : "incomplete"}
        </span>
      </div>

      {/* Question */}
      <p className="mt-3 line-clamp-2 text-xs text-[color:var(--color-text-dim)]">
        {sim.question_label ?? "—"}
      </p>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-[color:var(--color-text-faint)]">
        <span>
          <span className="font-mono text-white">{sim.n_agents}</span> agents
        </span>
        {sim.selected_dims && sim.selected_dims.length > 0 && (
          <span>
            <span className="font-mono text-white">{sim.selected_dims.length}</span> dims
          </span>
        )}
        <span className="ml-auto">{formatTs(sim.timestamp)}</span>
      </div>

      {/* Selected dims chips */}
      {sim.selected_dims && sim.selected_dims.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {sim.selected_dims.map((d) => (
            <span
              key={d}
              className="rounded-full border border-[color:var(--color-border)] px-2 py-0.5 font-mono text-[10px] text-[color:var(--color-text-dim)]"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Distribution toggle */}
      {sim.summary?.distribution && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-4 w-full rounded-xl border border-[color:var(--color-border)] py-1.5 text-xs text-[color:var(--color-text-dim)] hover:border-[color:var(--color-border-hi)] hover:text-white"
          >
            {open ? "Hide" : "Show"} distribution
          </button>
          {open && <MiniBar dist={sim.summary.distribution} />}
        </>
      )}

      {/* File path */}
      <div className="mt-3 truncate font-mono text-[10px] text-[color:var(--color-text-faint)]">
        simulations/{sim.sim_id}/
      </div>
    </div>
  );
}
