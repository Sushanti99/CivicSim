"use client";

import { Location } from "@/lib/api";

export function LocationPicker({
  locations,
  value,
  onChange,
}: {
  locations: Location[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
        Location
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-[color:var(--color-border-hi)] bg-[color:var(--color-surface)] px-4 py-3 text-[color:var(--color-text)] focus:border-[color:var(--color-cyan)] focus:outline-none"
      >
        {locations.length === 0 && <option>Loading…</option>}
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.label}
            {loc.population ? ` — pop ~${(loc.population / 1000).toFixed(0)}K` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
