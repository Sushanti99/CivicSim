"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AgentRecord, AnswerProb, SimulationDetail, api } from "@/lib/api";

// ── static mock data ──────────────────────────────────────────────────────────

function mockAgent(
  id: number, age: string, race: string, income: string,
  occupation: string, stance: string, rationale: string,
  dist: AnswerProb[],
): AgentRecord {
  return {
    agent_id: id,
    demographics: { agent_id: id, age, race, income, occupation },
    selected_dims: null,
    used_filter: {},
    backoff_steps: [],
    prior: dist,
    stance,
    rationale,
  };
}

const MOCK_DETAILS: Record<string, SimulationDetail> = {
  "3__region_west__economy": {
    sim_id: "3__region_west__economy",
    timestamp: "2026-05-10T14:32:00Z",
    location: "region_west",
    domain: "economy",
    domain_label: "Economy & Jobs",
    question_id: "ATP_W92_Q5",
    question_label: "Do you think the federal government should raise the federal minimum wage to $15 per hour?",
    n: 8,
    selected_dims: ["age_group", "income_group", "educ_group"],
    matched_from_free_text: false,
    summary: {
      n: 8,
      distribution: [
        { answer_label: "Strongly favor", prob: 0.44 },
        { answer_label: "Somewhat favor", prob: 0.28 },
        { answer_label: "Neither", prob: 0.08 },
        { answer_label: "Somewhat oppose", prob: 0.12 },
        { answer_label: "Strongly oppose", prob: 0.08 },
      ],
    },
    agents: [
      mockAgent(1, "25 to 34 years", "White alone", "$35,000 to $49,999", "Service worker", "Strongly favor",
        "A $15 minimum wage would directly benefit me and millions of low-wage workers. The cost of living in the West is extremely high and $7.25 is simply not survivable.", [
        { answer_label: "Strongly favor", prob: 0.62 }, { answer_label: "Somewhat favor", prob: 0.25 }, { answer_label: "Neither", prob: 0.07 }, { answer_label: "Somewhat oppose", prob: 0.04 }, { answer_label: "Strongly oppose", prob: 0.02 }]),
      mockAgent(2, "45 to 54 years", "Black or African American alone", "$50,000 to $74,999", "Healthcare worker", "Strongly favor",
        "Raising the minimum wage addresses longstanding racial and economic inequities. Many Black workers are concentrated in low-wage jobs and a federal floor would make a real difference.", [
        { answer_label: "Strongly favor", prob: 0.71 }, { answer_label: "Somewhat favor", prob: 0.18 }, { answer_label: "Neither", prob: 0.05 }, { answer_label: "Somewhat oppose", prob: 0.04 }, { answer_label: "Strongly oppose", prob: 0.02 }]),
      mockAgent(3, "55 to 64 years", "White alone", "$100,000 to $149,999", "Small business owner", "Somewhat oppose",
        "I understand the intent but a uniform $15 floor ignores regional cost differences. Rural small businesses operate on thin margins and this would force layoffs or closures.", [
        { answer_label: "Strongly favor", prob: 0.18 }, { answer_label: "Somewhat favor", prob: 0.22 }, { answer_label: "Neither", prob: 0.14 }, { answer_label: "Somewhat oppose", prob: 0.31 }, { answer_label: "Strongly oppose", prob: 0.15 }]),
      mockAgent(4, "22 to 24 years", "Hispanic or Latino", "$25,000 to $34,999", "Retail worker", "Strongly favor",
        "I work two jobs and still can't afford rent. A $15 minimum wage is the bare minimum for basic dignity. I strongly support this policy.", [
        { answer_label: "Strongly favor", prob: 0.68 }, { answer_label: "Somewhat favor", prob: 0.20 }, { answer_label: "Neither", prob: 0.06 }, { answer_label: "Somewhat oppose", prob: 0.04 }, { answer_label: "Strongly oppose", prob: 0.02 }]),
      mockAgent(5, "35 to 44 years", "Asian alone", "$75,000 to $99,999", "Software engineer", "Somewhat favor",
        "Reducing income inequality is important for social stability. The evidence on job losses is mixed and I lean toward the wage floor providing net benefit to workers.", [
        { answer_label: "Strongly favor", prob: 0.35 }, { answer_label: "Somewhat favor", prob: 0.40 }, { answer_label: "Neither", prob: 0.12 }, { answer_label: "Somewhat oppose", prob: 0.10 }, { answer_label: "Strongly oppose", prob: 0.03 }]),
      mockAgent(6, "65 years and over", "White alone", "$150,000 or more", "Retired executive", "Strongly oppose",
        "Mandating wages distorts labor markets. Businesses should be free to set wages based on productivity. This is an overreach that will cause unemployment among the very workers it aims to help.", [
        { answer_label: "Strongly favor", prob: 0.12 }, { answer_label: "Somewhat favor", prob: 0.16 }, { answer_label: "Neither", prob: 0.10 }, { answer_label: "Somewhat oppose", prob: 0.27 }, { answer_label: "Strongly oppose", prob: 0.35 }]),
      mockAgent(7, "18 to 24 years", "White alone", "Less than $10,000", "Student / part-time", "Strongly favor",
        "As a student working part-time, I can barely cover basic expenses. A higher minimum wage would let me focus on my education rather than working 30 hours a week to survive.", [
        { answer_label: "Strongly favor", prob: 0.60 }, { answer_label: "Somewhat favor", prob: 0.23 }, { answer_label: "Neither", prob: 0.09 }, { answer_label: "Somewhat oppose", prob: 0.05 }, { answer_label: "Strongly oppose", prob: 0.03 }]),
      mockAgent(8, "40 to 44 years", "Two or more races", "$35,000 to $49,999", "Truck driver", "Somewhat favor",
        "I earn above minimum wage but raising the floor would compress wages upward and benefit workers like me too. I think a gradual phase-in makes sense.", [
        { answer_label: "Strongly favor", prob: 0.40 }, { answer_label: "Somewhat favor", prob: 0.38 }, { answer_label: "Neither", prob: 0.10 }, { answer_label: "Somewhat oppose", prob: 0.09 }, { answer_label: "Strongly oppose", prob: 0.03 }]),
    ],
  },

  "2__region_south__healthcare": {
    sim_id: "2__region_south__healthcare",
    timestamp: "2026-05-09T09:15:00Z",
    location: "region_south",
    domain: "healthcare",
    domain_label: "Healthcare",
    question_id: "ATP_W94_Q12",
    question_label: "Should the federal government provide health insurance to all Americans, even if it means raising taxes?",
    n: 8,
    selected_dims: ["age_group", "race", "income_group"],
    matched_from_free_text: false,
    summary: {
      n: 8,
      distribution: [
        { answer_label: "Strongly support", prob: 0.35 },
        { answer_label: "Somewhat support", prob: 0.25 },
        { answer_label: "Neither", prob: 0.10 },
        { answer_label: "Somewhat oppose", prob: 0.18 },
        { answer_label: "Strongly oppose", prob: 0.12 },
      ],
    },
    agents: [
      mockAgent(1, "45 to 54 years", "Black or African American alone", "$25,000 to $34,999", "Home health aide", "Strongly support",
        "Healthcare is a human right. I work in healthcare but can barely afford my own insurance. Universal coverage would transform lives in my community, especially in the rural South.", [
        { answer_label: "Strongly support", prob: 0.67 }, { answer_label: "Somewhat support", prob: 0.20 }, { answer_label: "Neither", prob: 0.06 }, { answer_label: "Somewhat oppose", prob: 0.05 }, { answer_label: "Strongly oppose", prob: 0.02 }]),
      mockAgent(2, "55 to 64 years", "White alone", "$50,000 to $74,999", "Factory worker", "Somewhat support",
        "I've seen too many neighbors skip the doctor because they can't afford it. A universal system isn't perfect but the current one clearly isn't working for working people.", [
        { answer_label: "Strongly support", prob: 0.38 }, { answer_label: "Somewhat support", prob: 0.35 }, { answer_label: "Neither", prob: 0.12 }, { answer_label: "Somewhat oppose", prob: 0.10 }, { answer_label: "Strongly oppose", prob: 0.05 }]),
      mockAgent(3, "35 to 44 years", "White alone", "$100,000 to $149,999", "Physician", "Somewhat oppose",
        "I support expanding coverage but a government monopoly worries me. It could undermine medical innovation and create long wait times as we've seen in other countries.", [
        { answer_label: "Strongly support", prob: 0.20 }, { answer_label: "Somewhat support", prob: 0.22 }, { answer_label: "Neither", prob: 0.14 }, { answer_label: "Somewhat oppose", prob: 0.30 }, { answer_label: "Strongly oppose", prob: 0.14 }]),
      mockAgent(4, "65 years and over", "White alone", "$35,000 to $49,999", "Retired teacher", "Strongly support",
        "I've been on Medicare for years and it's been a lifesaver. Everyone deserves that security. The tax increase is worth it for peace of mind and healthier communities.", [
        { answer_label: "Strongly support", prob: 0.55 }, { answer_label: "Somewhat support", prob: 0.28 }, { answer_label: "Neither", prob: 0.08 }, { answer_label: "Somewhat oppose", prob: 0.06 }, { answer_label: "Strongly oppose", prob: 0.03 }]),
      mockAgent(5, "25 to 34 years", "Hispanic or Latino", "$15,000 to $24,999", "Restaurant worker", "Strongly support",
        "I have no insurance and live in fear of getting sick. A universal system would let me see a doctor before a problem becomes a crisis. This is long overdue.", [
        { answer_label: "Strongly support", prob: 0.72 }, { answer_label: "Somewhat support", prob: 0.18 }, { answer_label: "Neither", prob: 0.05 }, { answer_label: "Somewhat oppose", prob: 0.03 }, { answer_label: "Strongly oppose", prob: 0.02 }]),
      mockAgent(6, "50 to 54 years", "White alone", "$150,000 or more", "Business executive", "Strongly oppose",
        "The private sector delivers better outcomes through competition and choice. Government-run healthcare will be bureaucratic, inefficient, and funded by unsustainable tax hikes.", [
        { answer_label: "Strongly support", prob: 0.10 }, { answer_label: "Somewhat support", prob: 0.12 }, { answer_label: "Neither", prob: 0.10 }, { answer_label: "Somewhat oppose", prob: 0.28 }, { answer_label: "Strongly oppose", prob: 0.40 }]),
      mockAgent(7, "30 to 34 years", "Asian alone", "$75,000 to $99,999", "Nurse", "Somewhat support",
        "Universal coverage would reduce ER crowding and preventive care costs. I'd accept a modest tax increase if it means everyone gets basic coverage.", [
        { answer_label: "Strongly support", prob: 0.35 }, { answer_label: "Somewhat support", prob: 0.42 }, { answer_label: "Neither", prob: 0.12 }, { answer_label: "Somewhat oppose", prob: 0.08 }, { answer_label: "Strongly oppose", prob: 0.03 }]),
      mockAgent(8, "18 to 24 years", "Black or African American alone", "Less than $10,000", "College student", "Strongly support",
        "Healthcare costs are the number one cause of bankruptcy. Young people need coverage for mental health, preventive care, and emergencies. Universal insurance is the only fair solution.", [
        { answer_label: "Strongly support", prob: 0.65 }, { answer_label: "Somewhat support", prob: 0.22 }, { answer_label: "Neither", prob: 0.07 }, { answer_label: "Somewhat oppose", prob: 0.04 }, { answer_label: "Strongly oppose", prob: 0.02 }]),
    ],
  },

  "1__region_northeast__immigration": {
    sim_id: "1__region_northeast__immigration",
    timestamp: "2026-05-08T18:47:00Z",
    location: "region_northeast",
    domain: "immigration",
    domain_label: "Immigration",
    question_id: "ATP_W89_Q8",
    question_label: "Should the U.S. allow more immigrants to enter the country legally than it currently does?",
    n: 8,
    selected_dims: ["age_group", "educ_group"],
    matched_from_free_text: false,
    summary: {
      n: 8,
      distribution: [
        { answer_label: "A lot more", prob: 0.20 },
        { answer_label: "Some more", prob: 0.30 },
        { answer_label: "Same as now", prob: 0.22 },
        { answer_label: "Fewer", prob: 0.18 },
        { answer_label: "A lot fewer", prob: 0.10 },
      ],
    },
    agents: [
      mockAgent(1, "30 to 34 years", "Asian alone", "$75,000 to $99,999", "Software engineer", "A lot more",
        "As a child of immigrants, I know firsthand the contributions immigrants make to the economy and culture. Legal immigration pathways are too slow and limited. We need significant expansion.", [
        { answer_label: "A lot more", prob: 0.48 }, { answer_label: "Some more", prob: 0.32 }, { answer_label: "Same as now", prob: 0.12 }, { answer_label: "Fewer", prob: 0.05 }, { answer_label: "A lot fewer", prob: 0.03 }]),
      mockAgent(2, "55 to 64 years", "White alone", "$50,000 to $74,999", "Union electrician", "Fewer",
        "I support legal immigration but at the current pace it's depressing wages in construction trades. We should slow down until wages stabilize for workers who are already here.", [
        { answer_label: "A lot more", prob: 0.08 }, { answer_label: "Some more", prob: 0.15 }, { answer_label: "Same as now", prob: 0.22 }, { answer_label: "Fewer", prob: 0.38 }, { answer_label: "A lot fewer", prob: 0.17 }]),
      mockAgent(3, "25 to 34 years", "Hispanic or Latino", "$25,000 to $34,999", "Restaurant cook", "Some more",
        "Expanding legal immigration benefits the economy and reduces the backlog that pushes people toward illegal entry. A moderate increase is the pragmatic middle ground.", [
        { answer_label: "A lot more", prob: 0.30 }, { answer_label: "Some more", prob: 0.40 }, { answer_label: "Same as now", prob: 0.18 }, { answer_label: "Fewer", prob: 0.08 }, { answer_label: "A lot fewer", prob: 0.04 }]),
      mockAgent(4, "65 years and over", "White alone", "$35,000 to $49,999", "Retired nurse", "Same as now",
        "I think the current level is about right. We need to do a better job integrating those already here before opening the door further. Quality over quantity.", [
        { answer_label: "A lot more", prob: 0.12 }, { answer_label: "Some more", prob: 0.22 }, { answer_label: "Same as now", prob: 0.40 }, { answer_label: "Fewer", prob: 0.18 }, { answer_label: "A lot fewer", prob: 0.08 }]),
      mockAgent(5, "22 to 24 years", "Black or African American alone", "Less than $10,000", "Student", "Some more",
        "Immigration enriches our culture and fills gaps in the labor market. I'd support a moderate increase focused on skills and family reunification.", [
        { answer_label: "A lot more", prob: 0.25 }, { answer_label: "Some more", prob: 0.42 }, { answer_label: "Same as now", prob: 0.20 }, { answer_label: "Fewer", prob: 0.09 }, { answer_label: "A lot fewer", prob: 0.04 }]),
      mockAgent(6, "45 to 54 years", "White alone", "$150,000 or more", "Attorney", "A lot more",
        "The economic case for immigration is overwhelming. Immigrants start businesses, pay taxes, and fill both high-skill and essential labor roles. Restrictionism is shortsighted.", [
        { answer_label: "A lot more", prob: 0.52 }, { answer_label: "Some more", prob: 0.30 }, { answer_label: "Same as now", prob: 0.10 }, { answer_label: "Fewer", prob: 0.05 }, { answer_label: "A lot fewer", prob: 0.03 }]),
      mockAgent(7, "40 to 44 years", "White alone", "$100,000 to $149,999", "Small business owner", "A lot fewer",
        "I can't find affordable housing for my employees in this city. Rapid population growth from immigration is driving up costs for everyone. We need a pause to catch up on infrastructure.", [
        { answer_label: "A lot more", prob: 0.06 }, { answer_label: "Some more", prob: 0.10 }, { answer_label: "Same as now", prob: 0.18 }, { answer_label: "Fewer", prob: 0.30 }, { answer_label: "A lot fewer", prob: 0.36 }]),
      mockAgent(8, "35 to 44 years", "Asian alone", "$50,000 to $74,999", "University researcher", "Some more",
        "Attracting global talent strengthens American research and innovation. A moderate increase in high-skill immigration would be particularly beneficial.", [
        { answer_label: "A lot more", prob: 0.28 }, { answer_label: "Some more", prob: 0.45 }, { answer_label: "Same as now", prob: 0.18 }, { answer_label: "Fewer", prob: 0.07 }, { answer_label: "A lot fewer", prob: 0.02 }]),
    ],
  },
};

// ── colour palette ─────────────────────────────────────────────────────────────

const ANSWER_COLORS = ["#00d4ff", "#a855f7", "#f59e0b", "#f43f5e", "#10b981", "#64748b"];

function answerColor(index: number) {
  return ANSWER_COLORS[index % ANSWER_COLORS.length];
}

// ── demographic binning (mirrors backend logic) ────────────────────────────────

function binAge(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("under") || /\b[5-9] to/.test(l) || /1[0-9] to/.test(l)) return "Under 18";
  if (l.includes("20 to") || l.includes("25 to")) return "18–29";
  if (l.includes("30 to") || l.includes("35 to") || l.includes("40 to") || l.includes("45 to")) return "30–49";
  if (l.includes("50 to") || l.includes("55 to") || l.includes("60 to")) return "50–64";
  return "65+";
}

function binRace(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("white")) return "White";
  if (l.includes("black") || l.includes("african")) return "Black";
  if (l.includes("asian") || l.includes("pacific") || l.includes("hawaiian")) return "Asian";
  if (l.includes("hispanic") || l.includes("latino")) return "Hispanic";
  return "Other";
}

function binIncome(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("less than") || l.includes("10,000") || l.includes("15,000") || l.includes("25,000")) return "<$30k";
  if (l.includes("30,000") || l.includes("35,000") || l.includes("49,999")) return "$30–60k";
  if (l.includes("50,000") || l.includes("75,000") || l.includes("99,999")) return "$60–100k";
  return ">$100k";
}

// ── breakdown computation ──────────────────────────────────────────────────────

type BreakdownRow = Record<string, string | number>;

function computeBreakdown(
  agents: AgentRecord[],
  binFn: (s: string) => string,
  demoKey: keyof AgentRecord["demographics"],
  groupOrder: string[],
  answers: string[],
): BreakdownRow[] {
  // tally[group][answer] = count
  const tally: Record<string, Record<string, number>> = {};
  for (const a of agents) {
    const group = binFn(String(a.demographics[demoKey] ?? ""));
    if (!tally[group]) tally[group] = {};
    tally[group][a.stance] = (tally[group][a.stance] ?? 0) + 1;
  }

  return groupOrder
    .filter((g) => tally[g])
    .map((g) => {
      const counts = tally[g];
      const total = Object.values(counts).reduce((s, v) => s + v, 0);
      const row: BreakdownRow = { group: g };
      for (const ans of answers) {
        row[ans] = total > 0 ? Math.round(((counts[ans] ?? 0) / total) * 100) : 0;
      }
      row._n = total;
      return row;
    });
}

// ── auto insights ──────────────────────────────────────────────────────────────

function generateInsights(
  agents: AgentRecord[],
  topAnswer: string,
  ageRows: BreakdownRow[],
  raceRows: BreakdownRow[],
  incomeRows: BreakdownRow[],
): string[] {
  const insights: string[] = [];

  // Age gradient
  if (ageRows.length >= 2) {
    const sorted = [...ageRows].sort((a, b) => (b[topAnswer] as number) - (a[topAnswer] as number));
    const diff = (sorted[0][topAnswer] as number) - (sorted[sorted.length - 1][topAnswer] as number);
    if (diff >= 15) {
      insights.push(
        `Generational divide: ${sorted[0].group} show ${diff}pp higher "${topAnswer}" than ${sorted[sorted.length - 1].group}.`,
      );
    } else if (ageRows.length > 1) {
      insights.push(`Age groups show broadly consistent views on this question (< 15pp spread).`);
    }
  }

  // Race breadth
  if (raceRows.length >= 2) {
    const sorted = [...raceRows].sort((a, b) => (b[topAnswer] as number) - (a[topAnswer] as number));
    insights.push(
      `Highest "${topAnswer}" among ${sorted[0].group} respondents (${sorted[0][topAnswer]}%), lowest among ${sorted[sorted.length - 1].group} (${sorted[sorted.length - 1][topAnswer]}%).`,
    );
  }

  // Income trend
  const incomeOrder = ["<$30k", "$30–60k", "$60–100k", ">$100k"];
  const incomePresent = incomeOrder.filter((g) => incomeRows.find((r) => r.group === g));
  if (incomePresent.length >= 2) {
    const vals = incomePresent.map((g) => {
      const row = incomeRows.find((r) => r.group === g);
      return row ? (row[topAnswer] as number) : null;
    }).filter((v): v is number => v !== null);
    const trend = vals[vals.length - 1] - vals[0];
    if (Math.abs(trend) >= 10) {
      insights.push(
        `Income ${trend > 0 ? "positively" : "inversely"} related to "${topAnswer}" (${trend > 0 ? "+" : ""}${trend}pp low→high income).`,
      );
    }
  }

  // Backoff note
  const backedOff = agents.filter((a) => a.backoff_steps.length > 0).length;
  if (backedOff > agents.length * 0.5) {
    insights.push(
      `${backedOff}/${agents.length} agents required prior backoff — cell-level ATP data sparse for this configuration.`,
    );
  }

  return insights.length ? insights : ["Distribution reflects the ATP marginal prior for this location."];
}

// ── small components ───────────────────────────────────────────────────────────

function StatTile({
  label, value, color, sub,
}: {
  label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div
      className="flex flex-col rounded-2xl border p-6"
      style={{ borderColor: color + "33", background: color + "0d" }}
    >
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
        {label}
      </div>
      <div className="mt-2 text-5xl font-extrabold leading-none" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-xs text-[color:var(--color-text-dim)]">{sub}</div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 p-6">
      <h2 className="mb-5 text-base font-semibold text-[color:var(--color-text)]">{title}</h2>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 text-xs shadow-xl">
      <div className="mb-2 font-semibold text-[color:var(--color-text)]">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[color:var(--color-text-dim)]">{p.name}</span>
          <span className="font-mono font-bold text-[color:var(--color-text)]">{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

function slugToLabel(slug?: string | null) {
  return (slug ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTs(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function SimulationDetailPage({
  params,
}: {
  params: Promise<{ sim_id: string }>;
}) {
  const { sim_id } = use(params);
  const [data, setData] = useState<SimulationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllAgents, setShowAllAgents] = useState(false);

  useEffect(() => {
    const mock = MOCK_DETAILS[sim_id];
    if (mock) {
      setData(mock);
      setLoading(false);
      return;
    }
    api
      .simulationDetail(sim_id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sim_id]);

  if (loading) {
    return (
      <Shell>
        <div className="flex h-64 items-center justify-center text-[color:var(--color-text-dim)]">
          Loading simulation…
        </div>
      </Shell>
    );
  }

  if (error || !data) {
    return (
      <Shell>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
          {error ?? "Simulation not found."}
        </div>
      </Shell>
    );
  }

  const agents = data.agents ?? [];
  const dist: AnswerProb[] = data.summary?.distribution ?? [];
  const answers = dist.map((d) => d.answer_label);
  const sortedDist = [...dist].sort((a, b) => b.prob - a.prob);
  const topAnswer = sortedDist[0]?.answer_label ?? "";

  // Breakdowns
  const ageRows = computeBreakdown(agents, binAge, "age",
    ["Under 18", "18–29", "30–49", "50–64", "65+"], answers);
  const raceRows = computeBreakdown(agents, binRace, "race",
    ["White", "Black", "Hispanic", "Asian", "Other"], answers);
  const incomeRows = computeBreakdown(agents, binIncome, "income",
    ["<$30k", "$30–60k", "$60–100k", ">$100k"], answers);

  const insights = generateInsights(agents, topAnswer, ageRows, raceRows, incomeRows);

  // Top answers for chart bars (up to 4)
  const chartAnswers = sortedDist.filter((d) => d.prob > 0).slice(0, 4).map((d) => d.answer_label);
  const displayedAgents = showAllAgents ? agents : agents.slice(0, 8);

  const serial = data.sim_id.split("__")[0];

  return (
    <Shell>
      {/* breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-[color:var(--color-text-dim)]">
        <Link href="/simulations" className="hover:text-[color:var(--color-text)]">Simulations</Link>
        <span>/</span>
        <span className="font-mono text-[color:var(--color-cyan)]">#{serial}</span>
      </div>

      {/* policy header */}
      <div className="mb-8 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {data.domain_label && (
                <span className="rounded-full border border-[color:var(--color-cyan)]/30 bg-[color:var(--color-cyan)]/10 px-3 py-0.5 text-xs font-semibold text-[color:var(--color-cyan)]">
                  {data.domain_label}
                </span>
              )}
              <span className="rounded-full border border-[color:var(--color-border)] px-3 py-0.5 text-xs text-[color:var(--color-text-dim)]">
                {slugToLabel(data.location)}
              </span>
              <span className="text-xs text-[color:var(--color-text-faint)]">
                n = {agents.length}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold leading-snug">
              {data.question_label}
            </h1>
            <div className="mt-2 text-xs text-[color:var(--color-text-faint)]">
              {formatTs(data.timestamp)}
              {data.matched_from_free_text && " · matched from free text"}
            </div>
          </div>
          <Link
            href="/simulate"
            className="shrink-0 rounded-full border border-[color:var(--color-border-hi)] px-4 py-2 text-sm hover:bg-[color:var(--color-hover)]"
          >
            New simulation
          </Link>
        </div>
      </div>

      {/* hero stat tiles */}
      {sortedDist.filter((d) => d.prob > 0).length > 0 && (
        <div className={`mb-8 grid gap-4 ${sortedDist.filter(d => d.prob > 0).length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {sortedDist
            .filter((d) => d.prob > 0)
            .slice(0, 4)
            .map((d, i) => (
              <StatTile
                key={d.answer_label}
                label={d.answer_label}
                value={`${Math.round(d.prob * 100)}%`}
                color={answerColor(i)}
                sub="of simulated population"
              />
            ))}
        </div>
      )}

      {/* insights */}
      <SectionCard title="↗ Key Insights">
        <ul className="space-y-2">
          {insights.map((ins, i) => (
            <li key={i} className="flex gap-3 text-sm text-[color:var(--color-text-dim)]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-cyan)]" />
              {ins}
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* demographic breakdowns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {ageRows.length > 0 && (
          <SectionCard title="Support by Age Group">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageRows} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
                <XAxis dataKey="group" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-hover-row)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-text-dim)" }} />
                {chartAnswers.map((ans, i) => (
                  <Bar key={ans} dataKey={ans} fill={answerColor(i)} radius={[4, 4, 0, 0]} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {raceRows.length > 0 && (
          <SectionCard title="Support by Race / Ethnicity">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={raceRows} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <YAxis type="category" dataKey="group" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-hover-row)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-text-dim)" }} />
                {chartAnswers.map((ans, i) => (
                  <Bar key={ans} dataKey={ans} fill={answerColor(i)} radius={[0, 4, 4, 0]} maxBarSize={20} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {incomeRows.length > 0 && (
          <SectionCard title="Support by Income Level">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={incomeRows} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
                <XAxis dataKey="group" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-hover-row)" }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--color-text-dim)" }} />
                {chartAnswers.map((ans, i) => (
                  <Bar key={ans} dataKey={ans} fill={answerColor(i)} radius={[4, 4, 0, 0]} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {/* Overall distribution */}
        <SectionCard title="Overall Distribution">
          <div className="space-y-4">
            {sortedDist.map((d, i) => (
              <div key={d.answer_label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-[color:var(--color-text-dim)]">{d.answer_label}</span>
                  <span className="font-mono font-bold" style={{ color: answerColor(i) }}>
                    {Math.round(d.prob * 100)}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-[color:var(--color-fill-track)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.round(d.prob * 100)}%`,
                      background: answerColor(i),
                    }}
                  />
                </div>
                <div className="mt-0.5 text-right text-xs text-[color:var(--color-text-faint)]">
                  {Math.round(d.prob * agents.length)} of {agents.length} agents
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* agent responses table */}
      <div className="mt-6">
        <SectionCard title={`Agent Responses (${agents.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
                  <th className="pb-3 pr-4 text-left">#</th>
                  <th className="pb-3 pr-4 text-left">Age</th>
                  <th className="pb-3 pr-4 text-left">Race</th>
                  <th className="pb-3 pr-4 text-left">Income</th>
                  <th className="pb-3 pr-4 text-left">Stance</th>
                  <th className="pb-3 text-left">Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {displayedAgents.map((a, i) => (
                  <tr key={a.agent_id} className="align-top">
                    <td className="py-3 pr-4 font-mono text-xs text-[color:var(--color-text-faint)]">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[color:var(--color-text-dim)]">
                      {binAge(a.demographics.age ?? "")}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[color:var(--color-text-dim)]">
                      {binRace(a.demographics.race ?? "")}
                    </td>
                    <td className="py-3 pr-4 text-xs text-[color:var(--color-text-dim)]">
                      {binIncome(a.demographics.income ?? "")}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          color: answerColor(answers.indexOf(a.stance)),
                          background: answerColor(answers.indexOf(a.stance)) + "1a",
                          border: `1px solid ${answerColor(answers.indexOf(a.stance))}33`,
                        }}
                      >
                        {a.stance}
                      </span>
                    </td>
                    <td className="py-3 text-xs leading-relaxed text-[color:var(--color-text-dim)]">
                      {a.rationale}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {agents.length > 8 && (
            <button
              onClick={() => setShowAllAgents((v) => !v)}
              className="mt-4 w-full rounded-xl border border-[color:var(--color-border)] py-2 text-xs text-[color:var(--color-text-dim)] hover:border-[color:var(--color-border-hi)] hover:text-[color:var(--color-text)]"
            >
              {showAllAgents ? "Show less" : `Show all ${agents.length} agents`}
            </button>
          )}
        </SectionCard>
      </div>

      {/* methodology */}
      <div className="mt-6">
        <SectionCard title="Simulation Methodology">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                Demographic Variables Used
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.selected_dims ?? []).map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-[color:var(--color-cyan)]/30 bg-[color:var(--color-cyan)]/8 px-3 py-1 font-mono text-xs text-[color:var(--color-cyan)]"
                  >
                    {d}
                  </span>
                ))}
                {(!data.selected_dims || data.selected_dims.length === 0) && (
                  <span className="text-xs text-[color:var(--color-text-faint)]">All dims (no filter applied)</span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
                Quality Metrics
              </div>
              <div className="space-y-1.5 text-sm">
                {[
                  ["Location", slugToLabel(data.location)],
                  ["Domain", data.domain_label ?? "—"],
                  ["Agents", `${agents.length}`],
                  ["Prior backoff", `${agents.filter((a) => a.backoff_steps.length > 0).length}/${agents.length} agents`],
                  ["ATP priors source", "PEW ATP 2021 (synthetic for demo)"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-[color:var(--color-text-faint)]">{label}</span>
                    <span className="font-mono text-[color:var(--color-text-dim)]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* file path footer */}
      <div className="mt-6 text-center font-mono text-xs text-[color:var(--color-text-faint)]">
        data/simulations/{data.sim_id}/
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
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
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-8 py-10">{children}</main>
    </div>
  );
}
