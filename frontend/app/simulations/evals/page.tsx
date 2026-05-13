"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AgentEvalResult, SimEvalSummary, api } from "@/lib/api";

// ── trust grade helpers ────────────────────────────────────────────────────────

type Grade = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "LOW";

function trustGrade(score: number): Grade {
  if (score >= 80) return "EXCELLENT";
  if (score >= 65) return "GOOD";
  if (score >= 50) return "FAIR";
  if (score >= 35) return "POOR";
  return "LOW";
}

const GRADE_STYLES: Record<Grade, { bg: string; text: string; border: string; dot: string }> = {
  EXCELLENT: { bg: "#10b981", text: "#d1fae5", border: "#10b98133", dot: "#10b981" },
  GOOD:      { bg: "#00d4ff", text: "#cffafe", border: "#00d4ff33", dot: "#00d4ff" },
  FAIR:      { bg: "#f59e0b", text: "#fef3c7", border: "#f59e0b33", dot: "#f59e0b" },
  POOR:      { bg: "#f97316", text: "#ffedd5", border: "#f9731633", dot: "#f97316" },
  LOW:       { bg: "#f43f5e", text: "#ffe4e6", border: "#f43f5e33", dot: "#f43f5e" },
};

function GradeBadge({ score }: { score: number }) {
  const grade = trustGrade(score);
  const s = GRADE_STYLES[grade];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg + "1a", color: s.bg, border: `1px solid ${s.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.bg }} />
      {grade}
    </span>
  );
}

// ── metric bar (e.g. TVD) ─────────────────────────────────────────────────────

function MetricBar({
  value,
  max = 1,
  threshold,
  invert = false,
}: {
  value: number;
  max?: number;
  threshold?: number;
  invert?: boolean;
}) {
  if (isNaN(value) || !isFinite(value)) {
    return <span className="text-xs text-[color:var(--color-text-faint)]">N/A</span>;
  }
  const pct = Math.min((value / max) * 100, 100);
  const ok = invert ? value >= (threshold ?? 0) : value <= (threshold ?? max);
  const fillColor = ok ? "#10b981" : "#f59e0b";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[color:var(--color-fill-track)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs text-[color:var(--color-text-dim)]">
        {value.toFixed(3)}
      </span>
    </div>
  );
}

// ── score gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const grade = trustGrade(score);
  const color = GRADE_STYLES[grade].bg;
  const pct = Math.min(score, 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" strokeWidth="5"
            stroke="var(--color-fill-track)" />
          <circle cx="28" cy="28" r="22" fill="none" strokeWidth="5"
            stroke={color}
            strokeDasharray={`${(pct / 100) * 138.2} 138.2`}
            strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold" style={{ color }}>{Math.round(score)}</span>
        </div>
      </div>
      <GradeBadge score={score} />
    </div>
  );
}

// ── expandable agent table ────────────────────────────────────────────────────

function AgentTable({ agents }: { agents: AgentEvalResult[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--color-border)]">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[color:var(--color-border)] text-[10px] uppercase tracking-wider text-[color:var(--color-text-faint)]">
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Stance</th>
            <th className="px-3 py-2 text-right">P(stance)</th>
            <th className="px-3 py-2 text-right">Rank</th>
            <th className="px-3 py-2 text-center">Modal?</th>
            <th className="px-3 py-2 text-left">Backoff</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-border)]">
          {agents.map((a) => (
            <tr key={a.agent_id} className="hover:bg-[color:var(--color-hover)]">
              <td className="px-3 py-1.5 font-mono text-[color:var(--color-text-faint)]">
                {String(a.agent_id).padStart(2, "0")}
              </td>
              <td className="px-3 py-1.5 max-w-[180px] truncate text-[color:var(--color-text-dim)]">
                {a.stance}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[color:var(--color-text)]">
                {a.prior_prob.toFixed(3)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[color:var(--color-text-dim)]">
                #{a.prior_rank}
              </td>
              <td className="px-3 py-1.5 text-center">
                {a.modal_agreement ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className="text-[color:var(--color-text-faint)]">—</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-[color:var(--color-text-faint)]">
                {a.backoff_steps.length > 0
                  ? a.backoff_steps.slice(0, 2).join(", ") + (a.backoff_steps.length > 2 ? "…" : "")
                  : "none"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── sim eval row ──────────────────────────────────────────────────────────────

function SimEvalRow({ ev }: { ev: SimEvalSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [agents, setAgents] = useState<AgentEvalResult[] | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const serial = ev.sim_id.split("__")[0];

  function toggleExpand() {
    if (!expanded && !agents) {
      setLoadingAgents(true);
      api
        .evalDetail(ev.sim_id)
        .then((d) => setAgents(d.agent_evals ?? []))
        .catch(() => setAgents([]))
        .finally(() => setLoadingAgents(false));
    }
    setExpanded((v) => !v);
  }

  return (
    <>
      <tr
        className="cursor-pointer border-b border-[color:var(--color-border)] transition hover:bg-[color:var(--color-hover)]"
        onClick={toggleExpand}
      >
        {/* serial */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-cyan)]/12 font-mono text-xs font-bold text-[color:var(--color-cyan)]">
              {serial}
            </span>
            <div className="min-w-0">
              <Link
                href={`/simulations/${ev.sim_id}`}
                onClick={(e) => e.stopPropagation()}
                className="block truncate font-mono text-[10px] text-[color:var(--color-text-faint)] hover:text-[color:var(--color-cyan)]"
              >
                {ev.sim_id}
              </Link>
              <div className="truncate text-xs font-medium text-[color:var(--color-text)]">
                {ev.question_label?.length > 55
                  ? ev.question_label.slice(0, 52) + "…"
                  : ev.question_label}
              </div>
            </div>
          </div>
        </td>

        {/* location + N */}
        <td className="px-4 py-3 text-xs text-[color:var(--color-text-dim)]">
          <div>{ev.location.replace(/_/g, " ")}</div>
          <div className="text-[color:var(--color-text-faint)]">{ev.n_agents} agents</div>
        </td>

        {/* trust score */}
        <td className="px-4 py-3">
          <ScoreGauge score={ev.trust_score} />
        </td>

        {/* prior adherence */}
        <td className="px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-[10px] text-[color:var(--color-text-faint)]">
            <span>mean prior p</span>
            <span className="font-mono text-[color:var(--color-text-dim)]">
              {ev.mean_prior_prob.toFixed(3)}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-[color:var(--color-text-faint)]">
            <span>modal agree</span>
            <span className="font-mono text-[color:var(--color-text-dim)]">
              {Math.round(ev.modal_agreement_rate * 100)}%
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-[color:var(--color-text-faint)]">
            <span>top-2 rate</span>
            <span className="font-mono text-[color:var(--color-text-dim)]">
              {Math.round(ev.top2_rate * 100)}%
            </span>
          </div>
        </td>

        {/* distribution match */}
        <td className="px-4 py-3 space-y-2">
          <div>
            <div className="mb-0.5 text-[10px] text-[color:var(--color-text-faint)]">
              TVD vs. national
            </div>
            <MetricBar value={ev.tvd_vs_national} max={1} threshold={0.15} />
          </div>
          <div>
            <div className="mb-0.5 text-[10px] text-[color:var(--color-text-faint)]">
              Hellinger
            </div>
            <MetricBar value={ev.hellinger_vs_national} max={1} threshold={0.15} />
          </div>
        </td>

        {/* validity + coverage */}
        <td className="px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-[10px] text-[color:var(--color-text-faint)]">
            <span>validity</span>
            <span
              className="font-mono font-semibold"
              style={{ color: ev.validity_rate === 1 ? "#10b981" : "#f43f5e" }}
            >
              {Math.round(ev.validity_rate * 100)}%
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-[color:var(--color-text-faint)]">
            <span>coverage</span>
            <span className="font-mono text-[color:var(--color-text-dim)]">
              {Math.round(ev.answer_coverage * 100)}%
            </span>
          </div>
        </td>

        {/* expand toggle */}
        <td className="px-4 py-3 text-center">
          <span
            className="text-sm text-[color:var(--color-text-faint)] transition-transform duration-200"
            style={{ display: "inline-block", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        </td>
      </tr>

      {/* expanded agent detail */}
      {expanded && (
        <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/30">
          <td colSpan={7} className="px-6 pb-5 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)] mb-2">
              Per-agent results
            </div>
            {loadingAgents ? (
              <div className="py-4 text-xs text-[color:var(--color-text-faint)]">Loading…</div>
            ) : agents && agents.length > 0 ? (
              <AgentTable agents={agents} />
            ) : (
              <div className="py-4 text-xs text-[color:var(--color-text-faint)]">No agent data.</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── summary stat tile ─────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 px-6 py-4">
      <div className="text-2xl font-bold" style={{ color: color ?? "var(--color-cyan)" }}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-[color:var(--color-text-dim)]">{label}</div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function EvalsPage() {
  const [evals, setEvals] = useState<SimEvalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .evals()
      .then(setEvals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const avgScore =
    evals.length > 0
      ? Math.round(evals.reduce((s, e) => s + e.trust_score, 0) / evals.length)
      : 0;
  const passing = evals.filter((e) => e.trust_score >= 65).length;
  const avgTvd =
    evals.length > 0
      ? (
          evals.filter((e) => isFinite(e.tvd_vs_national)).reduce((s, e) => s + e.tvd_vs_national, 0) /
          evals.filter((e) => isFinite(e.tvd_vs_national)).length
        ).toFixed(3)
      : "—";

  return (
    <div className="min-h-screen">
      {/* nav */}
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
            <Link href="/simulations" className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]">
              Simulations
            </Link>
            <span className="text-[color:var(--color-text)]">Evals</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-8 py-10">
        {/* page header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Link
                  href="/simulations"
                  className="text-xs text-[color:var(--color-text-faint)] hover:text-[color:var(--color-text)]"
                >
                  ← Simulations
                </Link>
              </div>
              <h1 className="text-3xl font-bold">Simulation Evals</h1>
              <p className="mt-1 max-w-xl text-sm text-[color:var(--color-text-dim)]">
                Per-simulation accuracy metrics comparing agent opinions against Pew ATP
                ground-truth polling data. Click any row to expand per-agent detail.
              </p>
            </div>
          </div>
        </div>

        {/* summary stats */}
        {!loading && evals.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Avg trust score" value={avgScore} />
            <Stat
              label="GOOD or better"
              value={`${passing} / ${evals.length}`}
              color={passing === evals.length ? "#10b981" : "#f59e0b"}
            />
            <Stat label="Avg TVD vs. national" value={avgTvd} color="#a855f7" />
            <Stat label="Simulations evaluated" value={evals.length} />
          </div>
        )}

        {/* methodology callout */}
        <div className="mb-6 rounded-2xl border border-[color:var(--color-cyan)]/20 bg-[color:var(--color-cyan)]/5 p-4 text-xs text-[color:var(--color-text-dim)] leading-relaxed">
          <span className="font-semibold text-[color:var(--color-cyan)]">How scores are computed · </span>
          <span>
            <strong>Trust score</strong> [0–100] = 15% validity + 40% prior adherence + 20% modal agreement + 25% distribution match.
            {" "}<strong>TVD</strong> (Total Variation Distance) measures how far the simulated aggregate diverges from real Pew ATP polling —
            lower is better, threshold ≤ 0.15 (green bar).
            Scores use the {" "}
            <code className="font-mono text-[color:var(--color-cyan)]">data/atp_priors/policy_priors.parquet</code>
            {" "}as ground truth.
          </span>
        </div>

        {/* main table */}
        {loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-[color:var(--color-text-dim)]">
            Running evaluations…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-300">
            {error}
          </div>
        ) : evals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] py-32">
            <div className="text-4xl">◇</div>
            <p className="mt-4 text-[color:var(--color-text-dim)]">No simulations to evaluate yet.</p>
            <Link
              href="/simulate"
              className="mt-5 rounded-full bg-[color:var(--color-cyan)] px-6 py-2.5 text-sm font-semibold text-[color:var(--color-on-accent)] hover:opacity-90"
            >
              Run a simulation
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                    Simulation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                    Trust Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                    Prior Adherence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                    Distribution Match
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                    Validity
                  </th>
                  <th className="w-8 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {evals.map((ev) => (
                  <SimEvalRow key={ev.sim_id} ev={ev} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* grade legend */}
        {!loading && evals.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-text-faint)]">
            <span className="font-semibold">Grade:</span>
            {(["EXCELLENT", "GOOD", "FAIR", "POOR", "LOW"] as Grade[]).map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background: GRADE_STYLES[g].bg + "1a",
                  color: GRADE_STYLES[g].bg,
                  border: `1px solid ${GRADE_STYLES[g].border}`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: GRADE_STYLES[g].bg }} />
                {g}
              </span>
            ))}
            <span className="ml-2 text-[color:var(--color-text-faint)]">
              ≥80 · ≥65 · ≥50 · ≥35 · &lt;35
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
