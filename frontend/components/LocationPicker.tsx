"use client";

import { Location } from "@/lib/api";

const KIND_LABEL: Record<string, string> = {
  region: "Census Regions (4)",
  division: "Census Divisions (9)",
  county: "Counties",
};

const KIND_ORDER = ["region", "division", "county"];

function formatPopulation(pop: number | null): string {
  if (pop == null) return "";
  if (pop >= 1_000_000) return ` — pop ~${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return ` — pop ~${(pop / 1_000).toFixed(0)}K`;
  return "";
}

export function LocationPicker({
  locations,
  value,
  onChange,
}: {
  locations: Location[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = locations.find((l) => l.id === value);
  const grouped = new Map<string, Location[]>();
  for (const loc of locations) {
    const k = loc.kind ?? "other";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(loc);
  }

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
        {KIND_ORDER.filter((k) => grouped.has(k)).map((k) => (
          <optgroup key={k} label={KIND_LABEL[k] ?? k}>
            {grouped.get(k)!.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
                {formatPopulation(loc.population)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {selected?.kind === "county" && selected.region && (
        <p className="mt-1.5 text-xs text-[color:var(--color-text-faint)]">
          Counties use the parent region&apos;s ATP prior ({selected.region}).
        </p>
      )}
    </label>
  );
}
