"use client";

import { Agent } from "@/lib/api";

export function AgentTable({ agents }: { agents: Agent[] }) {
  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border-hi)] p-10 text-center text-sm text-[color:var(--color-text-faint)]">
        Agents will stream in here as they are sampled.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/50">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[color:var(--color-surface-2)] text-left text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Race</th>
              <th className="px-4 py-3">Income</th>
              <th className="px-4 py-3">Occupation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)]">
            {agents.map((a) => (
              <tr key={a.agent_id} className="hover:bg-[color:var(--color-hover-row)]">
                <td className="px-4 py-3 font-mono text-[color:var(--color-cyan)]">
                  {a.agent_id}
                </td>
                <td className="px-4 py-3">{a.age}</td>
                <td className="px-4 py-3">{a.race}</td>
                <td className="px-4 py-3">{a.income}</td>
                <td className="px-4 py-3 text-[color:var(--color-text-dim)]">
                  {a.occupation.replace(/:$/, "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
