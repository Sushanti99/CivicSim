"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnswerProb } from "@/lib/api";

export function OpinionDistribution({
  distribution,
  title,
  empty,
}: {
  distribution: AnswerProb[];
  title: string;
  empty: string;
}) {
  if (distribution.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--color-border-hi)] p-10 text-center text-sm text-[color:var(--color-text-faint)]">
        {empty}
      </div>
    );
  }

  const data = distribution.map((d) => ({
    answer: d.answer_label,
    pct: Math.round(d.prob * 1000) / 10,
  }));

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/50 p-6">
      <div className="mb-4 text-sm font-semibold">{title}</div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "var(--color-text-dim)", fontSize: 12 }}
              axisLine={{ stroke: "var(--color-border-hi)" }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="answer"
              width={180}
              tick={{ fill: "var(--color-text)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--color-hover-row)" }}
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border-hi)",
                borderRadius: 8,
                color: "var(--color-text)",
              }}
              formatter={(v: number) => [`${v}%`, "share"]}
            />
            <Bar dataKey="pct" radius={[4, 4, 4, 4]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i % 2 === 0 ? "var(--color-cyan)" : "var(--color-violet)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
