"use client";

import { DomainDimension } from "@/lib/api";

type Props = {
  dimensions: DomainDimension[];
  selected: Set<string>;
  onToggle: (key: string) => void;
};

/** Horizontal KL-score bar (max = the highest KL in the domain). */
function KLBar({ kl, max }: { kl: number; max: number }) {
  const pct = max > 0 ? Math.round((kl / max) * 100) : 0;
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[color:var(--color-fill-track)]">
      <div
        className="h-full rounded-full bg-[color:var(--color-cyan)] opacity-70"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function DimensionSelector({ dimensions, selected, onToggle }: Props) {
  if (dimensions.length === 0) return null;

  const maxKL = Math.max(...dimensions.map((d) => d.kl));

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
          Demographic dimensions
        </span>
        <span className="text-xs text-[color:var(--color-text-dim)]">
          bars = information gain
        </span>
      </div>
      <p className="mb-3 mt-1 text-xs text-[color:var(--color-text-dim)]">
        Checked dimensions condition the ATP prior lookup. Top-ranked are auto-selected based on Experiment 2 findings.
      </p>
      <div className="space-y-2">
        {dimensions.map((dim) => {
          const checked = selected.has(dim.key);
          return (
            <label
              key={dim.key}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                checked
                  ? "border-[color:var(--color-cyan)]/40 bg-[color:var(--color-cyan)]/8"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 opacity-70 hover:opacity-100"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(dim.key)}
                className="mt-0.5 accent-[color:var(--color-cyan)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{dim.label}</span>
                  <span className="font-mono text-xs text-[color:var(--color-text-dim)]">
                    {dim.kl.toFixed(4)}
                  </span>
                </div>
                <KLBar kl={dim.kl} max={maxKL} />
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
