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
  summary?: { distribution: AnswerProb[]; n: number };
};

// ── helpers ───────────────────────────────────────────────────────────────────

function parseSerial(sim_id: string): number | undefined {
  const n = parseInt(sim_id.split("__")[0], 10);
  return isNaN(n) ? undefined : n;
}

function formatTs(ts?: string) {
  if (!ts) return "N/A";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

function slugToLabel(slug?: string) {
  return (slug ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Colour palette for answer bars (ordered by dominance)
const BAR_COLORS = ["#00d4ff", "#a855f7", "#f59e0b", "#f43f5e", "#10b981"];

function DistributionBars({ dist }: { dist: AnswerProb[] }) {
  const sorted = [...dist].filter((d) => d.prob > 0).sort((a, b) => b.prob - a.prob);
  if (sorted.length === 0) {
    return <p className="text-xs text-[color:var(--color-text-faint)] italic">No responses yet</p>;
  }
  return (
    <div className="space-y-2">
      {sorted.map((d, i) => (
        <div key={d.answer_label}>
          <div className="mb-0.5 flex justify-between text-xs">
            <span className="text-[color:var(--color-text-dim)]">{d.answer_label}</span>
            <span className="font-mono font-semibold" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
              {Math.round(d.prob * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-fill-track)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(d.prob * 100)}%`,
                background: BAR_COLORS[i % BAR_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── card ──────────────────────────────────────────────────────────────────────

function SimCard({ sim, onDeleted }: { sim: SimRun; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const topAnswer = sim.summary?.distribution
    ? [...sim.summary.distribution].sort((a, b) => b.prob - a.prob)[0]
    : null;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete simulation #${sim.serial ?? sim.sim_id}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.deleteSimulation(sim.sim_id);
      onDeleted(sim.sim_id);
    } catch {
      alert("Failed to delete simulation. Check that the backend is running.");
      setDeleting(false);
    }
  }

  return (
    <Link
      href={`/simulations/${sim.sim_id}`}
      className="group relative flex flex-col rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 p-5 transition hover:border-[color:var(--color-border-hi)] hover:bg-[color:var(--color-surface)]"
    >
      {/* delete button — floats top-right, only visible on hover */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        title="Delete simulation"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-[color:var(--color-text-faint)] opacity-0 transition group-hover:opacity-100 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {deleting ? (
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        )}
      </button>

      {/* top row */}
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-cyan)]/12 font-mono text-sm font-bold text-[color:var(--color-cyan)]">
          {sim.serial ?? "?"}
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {sim.domain_label ?? slugToLabel(sim.domain) ?? "General"}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                sim.complete
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {sim.complete ? "done" : "running"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-[color:var(--color-text-dim)]">
            {slugToLabel(sim.location)}
          </div>
        </div>
      </div>

      {/* question */}
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[color:var(--color-text-dim)]">
        {sim.question_label ?? "N/A"}
      </p>

      {/* distribution */}
      <div className="mt-4 flex-1">
        {sim.summary?.distribution ? (
          <DistributionBars dist={sim.summary.distribution} />
        ) : (
          <div className="rounded-xl border border-dashed border-[color:var(--color-border)] py-4 text-center text-xs text-[color:var(--color-text-faint)]">
            awaiting results
          </div>
        )}
      </div>

      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--color-border)] pt-3">
        <div className="flex items-center gap-3 text-xs text-[color:var(--color-text-faint)]">
          <span>
            <span className="font-mono text-[color:var(--color-text)]">{sim.n_agents}</span> agents
          </span>
          {sim.selected_dims && sim.selected_dims.length > 0 && (
            <span>
              <span className="font-mono text-[color:var(--color-text)]">{sim.selected_dims.length}</span> dims
            </span>
          )}
          {topAnswer && topAnswer.prob > 0 && (
            <span className="hidden sm:inline">
              top:{" "}
              <span className="text-[color:var(--color-cyan)]">
                {topAnswer.answer_label.length > 20
                  ? topAnswer.answer_label.slice(0, 18) + "…"
                  : topAnswer.answer_label}
              </span>
            </span>
          )}
        </div>
        <span className="text-xs text-[color:var(--color-text-faint)]">{formatTs(sim.timestamp)}</span>
      </div>
    </Link>
  );
}

// ── stats bar ─────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 px-6 py-4">
      <div className="text-2xl font-bold text-[color:var(--color-cyan)]">{value}</div>
      <div className="mt-0.5 text-xs text-[color:var(--color-text-dim)]">{label}</div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function SimulationsPage() {
  const [sims, setSims] = useState<SimRun[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api
      .simulations(100)
      .then((data) => {
        const runs = (data as unknown as SimRun[]).map((r) => ({
          ...r,
          serial: parseSerial(r.sim_id),
        }));
        runs.sort((a, b) => (b.serial ?? 0) - (a.serial ?? 0));
        setSims(runs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function handleDeleted(sim_id: string) {
    setSims((prev) => prev.filter((s) => s.sim_id !== sim_id));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  const totalAgents = sims.reduce((s, r) => s + r.n_agents, 0);
  const complete = sims.filter((r) => r.complete).length;
  const domains = new Set(sims.map((r) => r.domain).filter(Boolean)).size;

  return (
    <div className="min-h-screen">
      {/* ── nav ── */}
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="text-[color:var(--color-cyan)]">◇</span>
            CivicSim
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/simulate" className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]">
              Simulate
            </Link>
            <span className="text-[color:var(--color-text)]">Simulations</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-8 py-10">
        {/* ── page header ── */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Simulation runs</h1>
            <p className="mt-1 text-sm text-[color:var(--color-text-dim)]">
              Each run is persisted to{" "}
              <code className="font-mono text-[color:var(--color-cyan)]">data/simulations/</code>{" "}
              with per-agent JSON files. Click a card for full detail.
            </p>
          </div>
          <Link
            href="/simulate"
            className="rounded-full bg-[color:var(--color-cyan)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-on-accent)] hover:opacity-90"
          >
            + New simulation
          </Link>
        </div>

        {/* ── stats ── */}
        {sims.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total runs" value={sims.length} />
            <Stat label="Completed" value={complete} />
            <Stat label="Total agents" value={totalAgents.toLocaleString()} />
            <Stat label="Domains explored" value={domains} />
          </div>
        )}

        {/* ── grid ── */}
        {loading && sims.length === 0 ? (
          <div className="py-32 text-center text-sm text-[color:var(--color-text-dim)]">
            Loading…
          </div>
        ) : sims.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] py-32">
            <div className="text-4xl">◇</div>
            <p className="mt-4 text-[color:var(--color-text-dim)]">No simulations yet.</p>
            <Link
              href="/simulate"
              className="mt-5 rounded-full bg-[color:var(--color-cyan)] px-6 py-2.5 text-sm font-semibold text-[color:var(--color-on-accent)] hover:opacity-90"
            >
              Run your first simulation
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sims.map((sim) => (
              <SimCard key={sim.sim_id} sim={sim} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
