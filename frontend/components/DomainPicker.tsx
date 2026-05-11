"use client";

import { Domain } from "@/lib/api";

type Props = {
  domains: Domain[];
  value: string;
  onChange: (id: string) => void;
};

export function DomainPicker({ domains, value, onChange }: Props) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
        Policy domain
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-sm focus:border-[color:var(--color-cyan)] focus:outline-none"
      >
        <option value="">— select a domain —</option>
        {domains.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      {value && domains.find((d) => d.id === value) && (
        <p className="mt-1.5 text-xs text-[color:var(--color-text-dim)]">
          {domains.find((d) => d.id === value)!.description}
        </p>
      )}
    </div>
  );
}
