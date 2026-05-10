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
              tick={{ fill: "#a0a8bd", fontSize: 12 }}
              axisLine={{ stroke: "#1B2238" }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="answer"
              width={180}
              tick={{ fill: "#e8eaf0", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#0F1421",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#e8eaf0",
              }}
              formatter={(v: number) => [`${v}%`, "share"]}
            />
            <Bar dataKey="pct" radius={[4, 4, 4, 4]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i % 2 === 0 ? "#00D4FF" : "#A855F7"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
