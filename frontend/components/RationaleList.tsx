"use client";

import { useState } from "react";
import { Agent, AgentResponse } from "@/lib/api";

export function RationaleList({
  agents,
  responses,
}: {
  agents: Agent[];
  responses: AgentResponse[];
}) {
  const [open, setOpen] = useState<number | null>(null);

  if (responses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border-hi)] p-10 text-center text-sm text-[color:var(--color-text-faint)]">
        Per-agent rationales will appear here once the LLM responds.
      </div>
    );
  }

  const byId = new Map(agents.map((a) => [a.agent_id, a]));

  return (
    <ul className="space-y-2">
      {responses.map((r) => {
        const a = byId.get(r.agent_id);
        const isOpen = open === r.agent_id;
        return (
          <li
            key={r.agent_id}
            className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40"
          >
            <button
              onClick={() => setOpen(isOpen ? null : r.agent_id)}
              className="flex w-full items-start gap-4 p-4 text-left hover:bg-[color:var(--color-hover-row)]"
            >
              <span className="font-mono text-sm text-[color:var(--color-cyan)]">
                #{r.agent_id}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold">{r.stance}</div>
                {a && (
                  <div className="mt-0.5 truncate text-sm text-[color:var(--color-text-dim)]">
                    {a.age} · {a.race} · {a.income}
                  </div>
                )}
              </div>
              <span className="text-[color:var(--color-text-faint)]">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-nested)] p-4 text-sm text-[color:var(--color-text)]">
                <div className="mb-2 italic">&ldquo;{r.rationale}&rdquo;</div>
                {r.prior.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs uppercase tracking-wider text-[color:var(--color-text-dim)]">
                      ATP prior for this agent
                    </div>
                    <ul className="mt-1 space-y-0.5 font-mono text-xs">
                      {r.prior.map((p) => (
                        <li key={p.answer_label}>
                          <span className="text-[color:var(--color-text-faint)]">
                            {Math.round(p.prob * 100)}%
                          </span>{" "}
                          {p.answer_label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
