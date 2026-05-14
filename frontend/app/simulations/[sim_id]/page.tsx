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

// ── hard-coded demo simulations (no backend needed) ────────────────────────────

const H1B_PRIOR: AnswerProb[] = [
  { answer_label: "Strongly support",           prob: 0.46 },
  { answer_label: "Somewhat support",           prob: 0.27 },
  { answer_label: "Neither support nor oppose", prob: 0.07 },
  { answer_label: "Somewhat oppose",            prob: 0.13 },
  { answer_label: "Strongly oppose",            prob: 0.07 },
];

const MINWAGE_PRIOR: AnswerProb[] = [
  { answer_label: "Strongly favor",  prob: 0.44 },
  { answer_label: "Somewhat favor",  prob: 0.28 },
  { answer_label: "Neither",         prob: 0.08 },
  { answer_label: "Somewhat oppose", prob: 0.12 },
  { answer_label: "Strongly oppose", prob: 0.08 },
];

const DEMO_SIMULATIONS: Record<string, SimulationDetail> = {
  "demo__minwage__region_west": {
    sim_id: "demo__minwage__region_west",
    timestamp: "2026-05-10T14:32:00Z",
    location: "region_west",
    domain: "economy",
    domain_label: "Economy & Jobs",
    question_id: "MINWAGE_W87",
    question_label: "Should the federal minimum wage be raised to $15/hour?",
    n: 15,
    selected_dims: ["age_group", "income_group", "race_eth"],
    matched_from_free_text: false,
    summary: {
      n: 15,
      distribution: [
        { answer_label: "Strongly favor",  prob: 0.33 },
        { answer_label: "Somewhat favor",  prob: 0.27 },
        { answer_label: "Neither",         prob: 0.07 },
        { answer_label: "Somewhat oppose", prob: 0.20 },
        { answer_label: "Strongly oppose", prob: 0.13 },
      ],
    },
    agents: [
      { agent_id: 1,  demographics: { agent_id: 1,  age: "25–34", income: "$30k–50k",   race: "Hispanic", occupation: "Restaurant Worker"   }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Strongly favor",  rationale: "I work two jobs and still can't make rent. A $15 minimum isn't generous — it's barely survivable. Raising the floor lifts everyone who can't negotiate for better pay." },
      { agent_id: 2,  demographics: { agent_id: 2,  age: "35–44", income: "$30k–50k",   race: "Black",    occupation: "Healthcare Aide"     }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Strongly favor",  rationale: "I care for elderly patients 40 hours a week and still qualify for food assistance. If essential workers deserve respect, the wage floor should reflect that." },
      { agent_id: 3,  demographics: { agent_id: 3,  age: "45–54", income: "$100k–150k", race: "White",    occupation: "Small Business Owner" }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Strongly oppose", rationale: "I run a small restaurant on thin margins. A sudden jump to $15 forces me to cut hours or close. Mandates that ignore regional cost differences punish small operators most." },
      { agent_id: 4,  demographics: { agent_id: 4,  age: "25–34", income: "$30k–50k",   race: "White",    occupation: "Retail Worker"       }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Strongly favor",  rationale: "I've watched corporate profits grow while my wages stagnate. A federal floor makes companies compete for labor instead of racing to the bottom. Basic economics." },
      { agent_id: 5,  demographics: { agent_id: 5,  age: "55–64", income: "$150k+",     race: "White",    occupation: "Corporate Executive"  }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Somewhat oppose", rationale: "Wage floors disrupt market signals and can reduce employment for the workers they're meant to help. Regional variation or a phased approach would be far less disruptive." },
      { agent_id: 6,  demographics: { agent_id: 6,  age: "35–44", income: "$30k–50k",   race: "Black",    occupation: "Food Service Worker" }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Strongly favor",  rationale: "The data shows moderate minimum wages don't kill jobs — they reduce turnover and boost local spending. A $15 floor closes the gap between what workers produce and what they're paid." },
      { agent_id: 7,  demographics: { agent_id: 7,  age: "25–34", income: "$50k–75k",   race: "Asian",    occupation: "Grad Student"        }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Strongly favor",  rationale: "The economic literature on this is pretty clear — workers below $15 spend every additional dollar locally. That multiplier effect is real. I don't see a compelling empirical case for keeping the floor where it is." },
      { agent_id: 8,  demographics: { agent_id: 8,  age: "45–54", income: "$100k–150k", race: "White",    occupation: "Restaurant Owner"    }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Strongly oppose", rationale: "My labor costs are already 35% of revenue. Going to $15 pushes that past the margin. I've installed tablet ordering to survive. A mandate at this level finishes the job — then we argue about who was helped." },
      { agent_id: 9,  demographics: { agent_id: 9,  age: "65+",   income: "$75k–100k",  race: "White",    occupation: "Retired Teacher"     }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Somewhat favor",  rationale: "In my career I watched a generation fall behind because wages didn't keep pace. I support raising it, but I'd feel better with a regional or indexed approach rather than a single national number." },
      { agent_id: 10, demographics: { agent_id: 10, age: "35–44", income: "$50k–75k",   race: "Hispanic", occupation: "Construction Worker" }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Somewhat favor",  rationale: "Most of us in trades already earn above $15, but a higher floor lifts conditions across the labor market. Better low-wage jobs mean less competition and more dignity for everyone." },
      { agent_id: 11, demographics: { agent_id: 11, age: "25–34", income: "$75k–100k",  race: "Asian",    occupation: "Software Engineer"   }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Somewhat oppose", rationale: "From a market standpoint, a national floor doesn't account for local labor conditions. $15 may be fair in San Francisco but above prevailing wages in rural areas — risking real job losses there." },
      { agent_id: 12, demographics: { agent_id: 12, age: "45–54", income: "$50k–75k",   race: "White",    occupation: "Nurse"               }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Somewhat favor",  rationale: "Hospital support staff doing essential work earn near minimum wage. Raising the floor reduces staff turnover and improves patient care — the economic and human case align." },
      { agent_id: 13, demographics: { agent_id: 13, age: "35–44", income: "$30k–50k",   race: "Black",    occupation: "Social Worker"       }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Somewhat favor",  rationale: "I work with families in poverty daily. Most are employed — sometimes three jobs. The minimum wage is a direct lever into household budgets. I support it, though I'd rather see it paired with rent reform." },
      { agent_id: 14, demographics: { agent_id: 14, age: "55–64", income: "$100k–150k", race: "White",    occupation: "Economist"           }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Somewhat oppose", rationale: "The literature since Card and Krueger is more mixed than advocates suggest. Recent studies on Seattle and Chicago show meaningful disemployment for teen and low-skill workers at higher minimums — the evidence isn't settled." },
      { agent_id: 15, demographics: { agent_id: 15, age: "25–34", income: "$30k–50k",   race: "White",    occupation: "Barista"             }, selected_dims: ["age_group","income_group","race_eth"], used_filter: {}, backoff_steps: [], prior: MINWAGE_PRIOR, stance: "Neither",         rationale: "You'd think I'd be for it — and I believe wages are too low. But I've watched my shop cut hours every time local costs spike. I want something to change, but I'm not sure this is the right lever." },
    ] as AgentRecord[],
  },
  "demo__h1b_wage_policy__region_west": {
    sim_id: "demo__h1b_wage_policy__region_west",
    timestamp: "2026-05-14T10:00:00Z",
    location: "region_west",
    domain: "immigration",
    domain_label: "Immigration",
    question_id: "demo_h1b_wage_policy",
    question_label: "Should H-1B be a wage-based policy?",
    n: 15,
    selected_dims: ["age_group", "race_eth", "income_group"],
    matched_from_free_text: true,
    summary: {
      n: 15,
      distribution: [
        { answer_label: "Strongly support",           prob: 0.47 },
        { answer_label: "Somewhat support",           prob: 0.27 },
        { answer_label: "Somewhat oppose",            prob: 0.13 },
        { answer_label: "Strongly oppose",            prob: 0.07 },
        { answer_label: "Neither support nor oppose", prob: 0.07 },
      ],
    },
    agents: [
      { agent_id: 1,  demographics: { agent_id: 1,  age: "25–34", income: "$50k–75k",   race: "White",    occupation: "Software Engineer"   }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly support",           rationale: "Wage floors protect American workers from employers who exploit H1B loopholes. Tech companies have used visa workers to suppress wages for everyone in the field — tying the visa to market wages is a necessary correction." },
      { agent_id: 2,  demographics: { agent_id: 2,  age: "35–44", income: "$75k–100k",  race: "Asian",    occupation: "Tech Worker"          }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Somewhat oppose",             rationale: "As someone who came here on an H1B, rigid wage floors could have blocked my entry. My employer paid competitively, but smaller companies or startups often can't meet a fixed minimum. It may cut off legitimate pathways." },
      { agent_id: 3,  demographics: { agent_id: 3,  age: "45–54", income: "$100k–150k", race: "White",    occupation: "Engineering Manager"  }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly support",           rationale: "The current system allows employers to classify roles in lower-wage brackets. A wage-based policy would close that loophole while keeping immigration merit-based. It's overdue." },
      { agent_id: 4,  demographics: { agent_id: 4,  age: "25–34", income: "$30k–50k",   race: "Hispanic", occupation: "Service Worker"       }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly support",           rationale: "Service workers compete in the same labor market. When H1B visas are used to undercut wages across the board, it hurts everyone at the bottom. A wage floor protects all workers, immigrant or not." },
      { agent_id: 5,  demographics: { agent_id: 5,  age: "55–64", income: "$150k+",     race: "White",    occupation: "Tech Executive"       }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Somewhat support",           rationale: "I understand the need for global talent, but the wage exploitation angle is real and documented. A wage floor indexed to local market rates would be a reasonable compromise that keeps the program viable." },
      { agent_id: 6,  demographics: { agent_id: 6,  age: "35–44", income: "$50k–75k",   race: "Black",    occupation: "Healthcare Worker"    }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly support",           rationale: "Wage-based policy creates equal footing. The H1B program as designed benefits corporations far more than workers. Tying it to wages shifts that balance." },
      { agent_id: 7,  demographics: { agent_id: 7,  age: "25–34", income: "$75k–100k",  race: "Asian",    occupation: "Data Engineer"        }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly oppose",             rationale: "Strict wage minimums disadvantage candidates whose skills don't yet translate to high comp. It would create a two-tier system that favors already-privileged immigrants while closing doors for emerging talent." },
      { agent_id: 8,  demographics: { agent_id: 8,  age: "45–54", income: "$50k–75k",   race: "White",    occupation: "Skilled Tradesperson" }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Somewhat support",           rationale: "In my trade, I've seen foreign workers brought in at below-market rates. A wage requirement would level the playing field. Skilled American workers deserve fair competition." },
      { agent_id: 9,  demographics: { agent_id: 9,  age: "35–44", income: "$30k–50k",   race: "Hispanic", occupation: "Construction Worker"  }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly support",           rationale: "Wage requirements force companies to either pay fairly or hire locally. Either outcome helps workers like me who compete with underpaid visa holders. It's a simple fix to a structural problem." },
      { agent_id: 10, demographics: { agent_id: 10, age: "65+",   income: "$100k–150k", race: "White",    occupation: "Retired Engineer"     }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Somewhat support",           rationale: "Over my career I've watched H1B get used to hold down wages in certain sectors. A wage floor is a modest reform — it doesn't close the door on skilled immigration, it just makes it fairer." },
      { agent_id: 11, demographics: { agent_id: 11, age: "25–34", income: "$75k–100k",  race: "Asian",    occupation: "ML Researcher"        }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Somewhat oppose",             rationale: "Tech skills are global but wages aren't standardized. A rigid floor might inadvertently favor candidates from high-cost countries while closing doors for equally qualified talent from lower-cost regions." },
      { agent_id: 12, demographics: { agent_id: 12, age: "45–54", income: "$150k+",     race: "White",    occupation: "Business Owner"       }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Neither support nor oppose", rationale: "Wage floors could slow hiring and make companies less globally competitive, but abuse of the current system is well-documented. The right outcome depends entirely on where the floor is set and how it's enforced." },
      { agent_id: 13, demographics: { agent_id: 13, age: "35–44", income: "$50k–75k",   race: "Black",    occupation: "Educator"             }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly support",           rationale: "Equitable wages are a matter of dignity. If a position merits an H1B hire, it merits a fair wage. This reform protects everyone in the workforce, regardless of where they were born." },
      { agent_id: 14, demographics: { agent_id: 14, age: "25–34", income: "$30k–50k",   race: "White",    occupation: "Recent Graduate"      }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Strongly support",           rationale: "Just entering the workforce, I'm already competing with visa workers paid below market. A wage-based policy would make that competition fairer for new graduates like me who don't have years of leverage." },
      { agent_id: 15, demographics: { agent_id: 15, age: "55–64", income: "$75k–100k",  race: "Asian",    occupation: "IT Consultant"        }, selected_dims: ["age_group","race_eth","income_group"], used_filter: {}, backoff_steps: [], prior: H1B_PRIOR, stance: "Somewhat support",           rationale: "Having navigated the H1B system myself, I know it can be used fairly or exploitatively. Wage requirements add accountability without eliminating the program's genuine benefits for both workers and companies." },
    ] as AgentRecord[],
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
  // Pre-bucketed CSV slugs (e.g. "18-29", "30-49")
  if (l === "18-29") return "18\u201329";
  if (l === "30-49") return "30\u201349";
  if (l === "50-64") return "50\u201364";
  if (l === "65+") return "65+";
  // Raw ACS label formats
  if (l.includes("under") || /\b[5-9] to/.test(l) || /1[0-9] to/.test(l)) return "Under 18";
  if (l.includes("20 to") || l.includes("25 to")) return "18\u201329";
  if (l.includes("30 to") || l.includes("35 to") || l.includes("40 to") || l.includes("45 to")) return "30\u201349";
  if (l.includes("50 to") || l.includes("55 to") || l.includes("60 to")) return "50\u201364";
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
  // Pre-bucketed CSV slugs
  if (l === "below_30000") return "<$30k";
  if (l === "30000_to_40000") return "$30\u201340k";
  if (l === "40000_to_50000") return "$40\u201350k";
  if (l === "50000_to_60000") return "$50\u201360k";
  if (l === "60000_to_70000") return "$60\u201370k";
  if (l === "70000_to_80000") return "$70\u201380k";
  if (l === "80000_to_90000") return "$80\u201390k";
  if (l === "90000_to_100000") return "$90\u2013100k";
  if (l === "above_100000") return ">$100k";
  // Raw ACS label formats
  if (l.includes("less than") || l.includes("10,000") || l.includes("15,000") || l.includes("25,000")) return "<$30k";
  if (l.includes("30,000")) return "$30\u201340k";
  if (l.includes("35,000") || l.includes("49,999")) return "$40\u201350k";
  if (l.includes("50,000")) return "$50\u201360k";
  if (l.includes("75,000")) return "$60\u201370k";
  if (l.includes("99,999")) return "$90\u2013100k";
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
  const incomeOrder = ["<$30k", "$30–40k", "$40–50k", "$50–60k", "$60–70k", "$70–80k", "$80–90k", "$90–100k", ">$100k"];
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
      `${backedOff}/${agents.length} agents required prior backoff; cell-level ATP data is sparse for this configuration.`,
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
    const demo = DEMO_SIMULATIONS[sim_id];
    if (demo) {
      setData(demo);
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
    ["<$30k", "$30–40k", "$40–50k", "$50–60k", "$60–70k", "$70–80k", "$80–90k", "$90–100k", ">$100k"], answers);

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
                  ["Domain", data.domain_label ?? "N/A"],
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
            <Link href="/simulations/evals" className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]">
              Evals
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-8 py-10">{children}</main>
    </div>
  );
}
