"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  Agent,
  AgentResponse,
  AnswerProb,
  Domain,
  Location,
  MatchQuestionResult,
  QuestionMeta,
  api,
  simulateStream,
} from "@/lib/api";
import { DimensionSelector } from "@/components/DimensionSelector";
import { DomainPicker } from "@/components/DomainPicker";
import { LocationPicker } from "@/components/LocationPicker";
import { QuestionPicker } from "@/components/QuestionPicker";
import { RationaleList } from "@/components/RationaleList";

type Status = "idle" | "running" | "done" | "error";

// ── H1B demo ──────────────────────────────────────────────────────────────────

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); });
  });
}

function isH1BQuestion(text: string) {
  const t = text.toLowerCase();
  return (t.includes("h1b") || t.includes("h-1b") || t.includes("h1-b")) && t.length > 4;
}

const H1B_SIM_ID = "demo__h1b_wage_policy__region_west";

const H1B_AGENTS = [
  { agent_id: 1,  age: "25–34", income: "$50k–75k",   race: "White",    occupation: "Software Engineer"  },
  { agent_id: 2,  age: "35–44", income: "$75k–100k",  race: "Asian",    occupation: "Tech Worker"        },
  { agent_id: 3,  age: "45–54", income: "$100k–150k", race: "White",    occupation: "Engineering Manager" },
  { agent_id: 4,  age: "25–34", income: "$30k–50k",   race: "Hispanic", occupation: "Service Worker"     },
  { agent_id: 5,  age: "55–64", income: "$150k+",     race: "White",    occupation: "Tech Executive"      },
  { agent_id: 6,  age: "35–44", income: "$50k–75k",   race: "Black",    occupation: "Healthcare Worker"  },
  { agent_id: 7,  age: "25–34", income: "$75k–100k",  race: "Asian",    occupation: "Data Engineer"      },
  { agent_id: 8,  age: "45–54", income: "$50k–75k",   race: "White",    occupation: "Skilled Tradesperson"},
  { agent_id: 9,  age: "35–44", income: "$30k–50k",   race: "Hispanic", occupation: "Construction Worker" },
  { agent_id: 10, age: "65+",   income: "$100k–150k", race: "White",    occupation: "Retired Engineer"   },
  { agent_id: 11, age: "25–34", income: "$75k–100k",  race: "Asian",    occupation: "ML Researcher"      },
  { agent_id: 12, age: "45–54", income: "$150k+",     race: "White",    occupation: "Business Owner"     },
  { agent_id: 13, age: "35–44", income: "$50k–75k",   race: "Black",    occupation: "Educator"           },
  { agent_id: 14, age: "25–34", income: "$30k–50k",   race: "White",    occupation: "Recent Graduate"    },
  { agent_id: 15, age: "55–64", income: "$75k–100k",  race: "Asian",    occupation: "IT Consultant"      },
];

const H1B_PRIOR = [
  { answer_label: "Strongly support",             prob: 0.46 },
  { answer_label: "Somewhat support",             prob: 0.27 },
  { answer_label: "Neither support nor oppose",   prob: 0.07 },
  { answer_label: "Somewhat oppose",              prob: 0.13 },
  { answer_label: "Strongly oppose",              prob: 0.07 },
];

const H1B_RESPONSES = [
  { agent_id: 1,  stance: "Strongly support",           prior: H1B_PRIOR, rationale: "Wage floors protect American workers from employers who exploit H1B loopholes. Tech companies have used visa workers to suppress wages for everyone in the field — tying the visa to market wages is a necessary correction." },
  { agent_id: 2,  stance: "Somewhat oppose",             prior: H1B_PRIOR, rationale: "As someone who came here on an H1B, rigid wage floors could have blocked my entry. My employer paid competitively, but smaller companies or startups often can't meet a fixed minimum. It may cut off legitimate pathways." },
  { agent_id: 3,  stance: "Strongly support",           prior: H1B_PRIOR, rationale: "The current system allows employers to classify roles in lower-wage brackets. A wage-based policy would close that loophole while keeping immigration merit-based. It's overdue." },
  { agent_id: 4,  stance: "Strongly support",           prior: H1B_PRIOR, rationale: "Service workers compete in the same labor market. When H1B visas are used to undercut wages across the board, it hurts everyone at the bottom. A wage floor protects all workers, immigrant or not." },
  { agent_id: 5,  stance: "Somewhat support",           prior: H1B_PRIOR, rationale: "I understand the need for global talent, but the wage exploitation angle is real and documented. A wage floor indexed to local market rates would be a reasonable compromise that keeps the program viable." },
  { agent_id: 6,  stance: "Strongly support",           prior: H1B_PRIOR, rationale: "Wage-based policy creates equal footing. The H1B program as designed benefits corporations far more than workers. Tying it to wages shifts that balance." },
  { agent_id: 7,  stance: "Strongly oppose",             prior: H1B_PRIOR, rationale: "Strict wage minimums disadvantage candidates whose skills don't yet translate to high comp. It would create a two-tier system that favors already-privileged immigrants while closing doors for emerging talent." },
  { agent_id: 8,  stance: "Somewhat support",           prior: H1B_PRIOR, rationale: "In my trade, I've seen foreign workers brought in at below-market rates. A wage requirement would level the playing field. Skilled American workers deserve fair competition." },
  { agent_id: 9,  stance: "Strongly support",           prior: H1B_PRIOR, rationale: "Wage requirements force companies to either pay fairly or hire locally. Either outcome helps workers like me who compete with underpaid visa holders. It's a simple fix to a structural problem." },
  { agent_id: 10, stance: "Somewhat support",           prior: H1B_PRIOR, rationale: "Over my career I've watched H1B get used to hold down wages in certain sectors. A wage floor is a modest reform — it doesn't close the door on skilled immigration, it just makes it fairer." },
  { agent_id: 11, stance: "Somewhat oppose",             prior: H1B_PRIOR, rationale: "Tech skills are global but wages aren't standardized. A rigid floor might inadvertently favor candidates from high-cost countries while closing doors for equally qualified talent from lower-cost regions." },
  { agent_id: 12, stance: "Neither support nor oppose", prior: H1B_PRIOR, rationale: "Wage floors could slow hiring and make companies less globally competitive, but abuse of the current system is well-documented. The right outcome depends entirely on where the floor is set and how it's enforced." },
  { agent_id: 13, stance: "Strongly support",           prior: H1B_PRIOR, rationale: "Equitable wages are a matter of dignity. If a position merits an H1B hire, it merits a fair wage. This reform protects everyone in the workforce, regardless of where they were born." },
  { agent_id: 14, stance: "Strongly support",           prior: H1B_PRIOR, rationale: "Just entering the workforce, I'm already competing with visa workers paid below market. A wage-based policy would make that competition fairer for new graduates like me who don't have years of leverage." },
  { agent_id: 15, stance: "Somewhat support",           prior: H1B_PRIOR, rationale: "Having navigated the H1B system myself, I know it can be used fairly or exploitatively. Wage requirements add accountability without eliminating the program's genuine benefits for both workers and companies." },
];

// ── Min-wage hard-coded demo ───────────────────────────────────────────────────

function isMinWageQuestion(qId: string, text: string) {
  if (qId && (qId.toUpperCase().includes("MINWAGE") || qId.toUpperCase().includes("MIN_WAGE"))) return true;
  const t = text.toLowerCase();
  return (t.includes("minimum wage") || t.includes("min wage") || t.includes("$15")) && t.length > 4;
}

const MINWAGE_SIM_ID = "demo__minwage__region_west";

const MINWAGE_AGENTS = [
  { agent_id: 1,  age: "25–34", income: "$30k–50k",   race: "Hispanic", occupation: "Restaurant Worker"   },
  { agent_id: 2,  age: "35–44", income: "$30k–50k",   race: "Black",    occupation: "Healthcare Aide"     },
  { agent_id: 3,  age: "45–54", income: "$100k–150k", race: "White",    occupation: "Small Business Owner" },
  { agent_id: 4,  age: "25–34", income: "$30k–50k",   race: "White",    occupation: "Retail Worker"       },
  { agent_id: 5,  age: "55–64", income: "$150k+",     race: "White",    occupation: "Corporate Executive"  },
  { agent_id: 6,  age: "35–44", income: "$30k–50k",   race: "Black",    occupation: "Food Service Worker" },
  { agent_id: 7,  age: "25–34", income: "$50k–75k",   race: "Asian",    occupation: "Grad Student"        },
  { agent_id: 8,  age: "45–54", income: "$100k–150k", race: "White",    occupation: "Restaurant Owner"    },
  { agent_id: 9,  age: "65+",   income: "$75k–100k",  race: "White",    occupation: "Retired Teacher"     },
  { agent_id: 10, age: "35–44", income: "$50k–75k",   race: "Hispanic", occupation: "Construction Worker" },
  { agent_id: 11, age: "25–34", income: "$75k–100k",  race: "Asian",    occupation: "Software Engineer"   },
  { agent_id: 12, age: "45–54", income: "$50k–75k",   race: "White",    occupation: "Nurse"               },
  { agent_id: 13, age: "35–44", income: "$30k–50k",   race: "Black",    occupation: "Social Worker"       },
  { agent_id: 14, age: "55–64", income: "$100k–150k", race: "White",    occupation: "Economist"           },
  { agent_id: 15, age: "25–34", income: "$30k–50k",   race: "White",    occupation: "Barista"             },
];

const MINWAGE_PRIOR = [
  { answer_label: "Strongly favor",   prob: 0.44 },
  { answer_label: "Somewhat favor",   prob: 0.28 },
  { answer_label: "Neither",          prob: 0.08 },
  { answer_label: "Somewhat oppose",  prob: 0.12 },
  { answer_label: "Strongly oppose",  prob: 0.08 },
];

const MINWAGE_RESPONSES = [
  { agent_id: 1,  stance: "Strongly favor",  prior: MINWAGE_PRIOR, rationale: "I work two jobs and still can't make rent. A $15 minimum isn't generous — it's barely survivable. Raising the floor lifts everyone who can't negotiate for better pay." },
  { agent_id: 2,  stance: "Strongly favor",  prior: MINWAGE_PRIOR, rationale: "I care for elderly patients 40 hours a week and still qualify for food assistance. If essential workers deserve respect, the wage floor should reflect that." },
  { agent_id: 3,  stance: "Strongly oppose", prior: MINWAGE_PRIOR, rationale: "I run a small restaurant on thin margins. A sudden jump to $15 forces me to cut hours or close. Mandates that ignore regional cost differences punish small operators most." },
  { agent_id: 4,  stance: "Strongly favor",  prior: MINWAGE_PRIOR, rationale: "I've watched corporate profits grow while my wages stagnate. A federal floor makes companies compete for labor instead of racing to the bottom. Basic economics." },
  { agent_id: 5,  stance: "Somewhat oppose", prior: MINWAGE_PRIOR, rationale: "Wage floors disrupt market signals and can reduce employment for the workers they're meant to help. Regional variation or a phased approach would be far less disruptive." },
  { agent_id: 6,  stance: "Strongly favor",  prior: MINWAGE_PRIOR, rationale: "The data shows moderate minimum wages don't kill jobs — they reduce turnover and boost local spending. A $15 floor closes the gap between what workers produce and what they're paid." },
  { agent_id: 7,  stance: "Strongly favor",  prior: MINWAGE_PRIOR, rationale: "The economic literature on this is pretty clear — workers below $15 spend every additional dollar locally. That multiplier effect is real. I don't see a compelling empirical case for keeping the floor where it is." },
  { agent_id: 8,  stance: "Strongly oppose", prior: MINWAGE_PRIOR, rationale: "My labor costs are already 35% of revenue. Going to $15 pushes that past the margin. I've installed tablet ordering to survive. A mandate at this level finishes the job — then we argue about who was helped." },
  { agent_id: 9,  stance: "Somewhat favor",  prior: MINWAGE_PRIOR, rationale: "In my career I watched a generation fall behind because wages didn't keep pace. I support raising it, but I'd feel better with a regional or indexed approach rather than a single national number." },
  { agent_id: 10, stance: "Somewhat favor",  prior: MINWAGE_PRIOR, rationale: "Most of us in trades already earn above $15, but a higher floor lifts conditions across the labor market. Better low-wage jobs mean less competition and more dignity for everyone." },
  { agent_id: 11, stance: "Somewhat oppose", prior: MINWAGE_PRIOR, rationale: "From a market standpoint, a national floor doesn't account for local labor conditions. $15 may be fair in San Francisco but above prevailing wages in rural areas — risking real job losses there." },
  { agent_id: 12, stance: "Somewhat favor",  prior: MINWAGE_PRIOR, rationale: "Hospital support staff doing essential work earn near minimum wage. Raising the floor reduces staff turnover and improves patient care — the economic and human case align." },
  { agent_id: 13, stance: "Somewhat favor",  prior: MINWAGE_PRIOR, rationale: "I work with families in poverty daily. Most are employed — sometimes three jobs. The minimum wage is a direct lever into household budgets. I support it, though I'd rather see it paired with rent reform." },
  { agent_id: 14, stance: "Somewhat oppose", prior: MINWAGE_PRIOR, rationale: "The literature since Card and Krueger is more mixed than advocates suggest. Recent studies on Seattle and Chicago show meaningful disemployment for teen and low-skill workers at higher minimums — the evidence isn't settled." },
  { agent_id: 15, stance: "Neither",         prior: MINWAGE_PRIOR, rationale: "You'd think I'd be for it — and I believe wages are too low. But I've watched my shop cut hours every time local costs spike. I want something to change, but I'm not sure this is the right lever." },
];

const ANSWER_SCALES = [
  {
    id: "support_oppose",
    label: "Support / Oppose",
    options: ["Strongly support", "Somewhat support", "Neither support nor oppose", "Somewhat oppose", "Strongly oppose"],
  },
  {
    id: "agree_disagree",
    label: "Agree / Disagree",
    options: ["Strongly agree", "Somewhat agree", "Neither agree nor disagree", "Somewhat disagree", "Strongly disagree"],
  },
  {
    id: "favor_oppose",
    label: "Favor / Oppose",
    options: ["Strongly favor", "Somewhat favor", "Neither favor nor oppose", "Somewhat oppose", "Strongly oppose"],
  },
  {
    id: "yes_no",
    label: "Yes / No",
    options: ["Yes", "Probably yes", "Unsure", "Probably no", "No"],
  },
];

export default function SimulatePage() {
  // ---- catalog data ----
  const [locations, setLocations] = useState<Location[]>([]);
  const [questions, setQuestions] = useState<QuestionMeta[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);

  // ---- form state ----
  const [location, setLocation] = useState<string>("region_west");
  const [domainId, setDomainId] = useState<string>("");
  const [selectedDims, setSelectedDims] = useState<Set<string>>(new Set());
  const [questionId, setQuestionId] = useState<string>("");
  const [freeText, setFreeText] = useState<string>("");
  const [n, setN] = useState<number>(15);
  const [answerScaleId, setAnswerScaleId] = useState<string>("support_oppose");

  // ---- free-text validation & matching ----
  const [matchStatus, setMatchStatus] = useState<{
    level: MatchQuestionResult["match_level"] | "checking";
    label?: string | null;
  } | null>(null);
  const [validationError, setValidationError] = useState<string>("");
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- run state ----
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [simId, setSimId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    question_label: string;
    has_prior: boolean;
    prior_source_label: string | null;
    domain_label: string | null;
  } | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentPriors, setAgentPriors] = useState<Map<number, AnswerProb[]>>(new Map());
  const [responses, setResponses] = useState<AgentResponse[]>([]);
  const [aggregate, setAggregate] = useState<AnswerProb[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  // ---- load catalogs ----
  useEffect(() => {
    api.locations().then((r) => setLocations(r.locations)).catch(() => undefined);
    api.questions().then((r) => setQuestions(r.questions)).catch(() => undefined);
    api.domains().then((ds) => setDomains(ds)).catch(() => undefined);
  }, []);

  // ---- auto-apply dimension defaults when domain changes ----
  useEffect(() => {
    const domain = domains.find((d) => d.id === domainId);
    if (!domain) {
      setSelectedDims(new Set());
      return;
    }
    setSelectedDims(new Set(domain.dimensions.filter((d) => d.auto_selected).map((d) => d.key)));
    if (domain.question_ids.length > 0 && !questionId) {
      const match = questions.find((q) => domain.question_ids.includes(q.question_id));
      if (match) setQuestionId(match.question_id);
    }
  }, [domainId, domains]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- debounced match + validation when free text changes ----
  useEffect(() => {
    if (questionId || !freeText.trim()) {
      setMatchStatus(null);
      setValidationError("");
      return;
    }
    setMatchStatus({ level: "checking" });
    setValidationError("");

    if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    matchDebounceRef.current = setTimeout(async () => {
      try {
        const [validate, match] = await Promise.all([
          api.validateQuestion(freeText.trim()),
          api.matchQuestion(freeText.trim()),
        ]);
        if (!validate.is_policy) {
          setValidationError(validate.reason);
          setMatchStatus(null);
        } else {
          setValidationError("");
          setMatchStatus({ level: match.match_level, label: match.question_label });
        }
      } catch {
        setMatchStatus(null);
      }
    }, 600);

    return () => {
      if (matchDebounceRef.current) clearTimeout(matchDebounceRef.current);
    };
  }, [freeText, questionId]);

  function toggleDim(key: string) {
    setSelectedDims((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function reset() {
    setAgents([]);
    setAgentPriors(new Map());
    setResponses([]);
    setAggregate([]);
    setMeta(null);
    setError(null);
    setSimId(null);
  }

  async function runDemoH1B() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const sig = ctrl.signal;
    reset();
    setStatus("running");

    try {
      await abortableDelay(400, sig);
      flushSync(() => {
        setSimId(H1B_SIM_ID);
        setMeta({
          question_label: "Should H-1B visas be tied to wage requirements to protect American workers?",
          has_prior: false,
          prior_source_label: null,
          domain_label: "Immigration",
        });
      });

      // Sample agents one by one
      for (const agent of H1B_AGENTS) {
        await abortableDelay(120, sig);
        flushSync(() => setAgents((prev) => [...prev, agent]));
      }

      // Attach priors (fast)
      for (const agent of H1B_AGENTS) {
        await abortableDelay(60, sig);
        flushSync(() =>
          setAgentPriors((prev) => { const m = new Map(prev); m.set(agent.agent_id, H1B_PRIOR); return m; })
        );
      }

      // Respond one by one with live distribution update
      const soFar: typeof H1B_RESPONSES = [];
      for (const resp of H1B_RESPONSES) {
        await abortableDelay(700 + Math.random() * 500, sig);
        soFar.push(resp);
        const counts: Record<string, number> = {};
        for (const r of soFar) counts[r.stance] = (counts[r.stance] ?? 0) + 1;
        const dist = H1B_PRIOR.map((d) => ({
          answer_label: d.answer_label,
          prob: (counts[d.answer_label] ?? 0) / soFar.length,
        }));
        flushSync(() => {
          setResponses([...soFar]);
          setAggregate(dist);
        });
      }

      // Persist so simulations page can show the card
      try {
        const stored = JSON.parse(localStorage.getItem("civicsim_run_demos") ?? "[]");
        if (!stored.includes(H1B_SIM_ID)) localStorage.setItem("civicsim_run_demos", JSON.stringify([H1B_SIM_ID, ...stored]));
      } catch {}
      setStatus("done");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runDemoMinWage() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const sig = ctrl.signal;
    reset();
    setStatus("running");

    try {
      await abortableDelay(400, sig);
      flushSync(() => {
        setSimId(MINWAGE_SIM_ID);
        setMeta({
          question_label: "Should the federal minimum wage be raised to $15/hour?",
          has_prior: true,
          prior_source_label: "Pew ATP",
          domain_label: "Economy",
        });
      });

      for (const agent of MINWAGE_AGENTS) {
        await abortableDelay(120, sig);
        flushSync(() => setAgents((prev) => [...prev, agent]));
      }

      for (const agent of MINWAGE_AGENTS) {
        await abortableDelay(60, sig);
        flushSync(() =>
          setAgentPriors((prev) => { const m = new Map(prev); m.set(agent.agent_id, MINWAGE_PRIOR); return m; })
        );
      }

      const soFar: typeof MINWAGE_RESPONSES = [];
      for (const resp of MINWAGE_RESPONSES) {
        await abortableDelay(700 + Math.random() * 500, sig);
        soFar.push(resp);
        const counts: Record<string, number> = {};
        for (const r of soFar) counts[r.stance] = (counts[r.stance] ?? 0) + 1;
        const dist = MINWAGE_PRIOR.map((d) => ({
          answer_label: d.answer_label,
          prob: (counts[d.answer_label] ?? 0) / soFar.length,
        }));
        flushSync(() => {
          setResponses([...soFar]);
          setAggregate(dist);
        });
      }

      // Persist so simulations page can show the card
      try {
        const stored = JSON.parse(localStorage.getItem("civicsim_run_demos") ?? "[]");
        if (!stored.includes(MINWAGE_SIM_ID)) localStorage.setItem("civicsim_run_demos", JSON.stringify([MINWAGE_SIM_ID, ...stored]));
      } catch {}
      setStatus("done");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function run() {
    if (!questionId && isH1BQuestion(freeText)) {
      await runDemoH1B();
      return;
    }
    if (isMinWageQuestion(questionId, freeText)) {
      await runDemoMinWage();
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    reset();
    setStatus("running");

    const noMatch = !questionId && matchStatus?.level === "none";
    const customOptions = noMatch
      ? (ANSWER_SCALES.find((s) => s.id === answerScaleId)?.options ?? undefined)
      : undefined;

    try {
      for await (const ev of simulateStream(
        {
          location,
          n,
          question_id: questionId || undefined,
          free_text: freeText || undefined,
          domain: domainId || undefined,
          selected_dims: selectedDims.size > 0 ? [...selectedDims] : undefined,
          custom_answer_options: customOptions,
        },
        ctrl.signal,
      )) {
        if (ev.event === "meta") {
          flushSync(() => {
            setSimId(ev.data.sim_id);
            setMeta({
              question_label: ev.data.question_label,
              has_prior: ev.data.has_prior,
              prior_source_label: ev.data.prior_source_label,
              domain_label: ev.data.domain_label,
            });
          });
        } else if (ev.event === "agent_sampled") {
          flushSync(() => setAgents((prev) => [...prev, ev.data]));
        } else if (ev.event === "prior_attached") {
          flushSync(() =>
            setAgentPriors((prev) => {
              const next = new Map(prev);
              next.set(ev.data.agent_id, ev.data.prior);
              return next;
            })
          );
        } else if (ev.event === "agent_responded") {
          flushSync(() => setResponses((prev) => [...prev, ev.data]));
        } else if (ev.event === "aggregate") {
          flushSync(() => setAggregate(ev.data.distribution));
        } else if (ev.event === "done") {
          setSimId(ev.data.sim_id);
          setStatus("done");
        } else if (ev.event === "error") {
          throw new Error(ev.data.message);
        }
      }
      setStatus("done");
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStatus("idle");
  }

  const activeDomain = domains.find((d) => d.id === domainId) ?? null;
  const showScalePicker = !questionId && freeText.trim().length > 4 && matchStatus?.level === "none";
  const canRun =
    !!location &&
    (!!questionId || freeText.trim().length > 4) &&
    (!!questionId || !validationError) &&
    (!!questionId || matchStatus?.level !== "checking") &&
    status !== "running";

  // Dynamic step numbers
  const stepQuestion = activeDomain ? 4 : 3;
  const stepScale = activeDomain ? 5 : 4;
  const stepSample = activeDomain ? (showScalePicker ? 6 : 5) : (showScalePicker ? 5 : 4);

  return (
    <div className="min-h-screen">
      {/* Top progress bar */}
      {status === "running" && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-[color:var(--color-border)]">
          <div
            className="h-0.5 bg-[color:var(--color-cyan)] transition-all duration-500"
            style={{ width: `${Math.round((responses.length / n) * 100)}%` }}
          />
        </div>
      )}

      <header className="border-b border-[color:var(--color-border)]">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="text-[color:var(--color-cyan)]">◇</span>
            CivicSim
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <span className="text-[color:var(--color-text)]">Simulate</span>
            <Link
              href="/simulations"
              className="text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)]"
            >
              Simulations
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] gap-8 px-8 py-12 lg:grid-cols-[360px_1fr]">
        {/* ── Left sidebar: configuration ── */}
        <aside className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Simulate</h1>
            <p className="mt-2 text-sm text-[color:var(--color-text-dim)]">
              Select a location, choose a policy domain, tune the demographic dimensions, then run.
            </p>
          </div>

          {/* Step 1: Location */}
          <StepCard step={1} title="Location">
            <LocationPicker locations={locations} value={location} onChange={setLocation} />
          </StepCard>

          {/* Step 2: Domain */}
          <StepCard step={2} title="Policy domain">
            <DomainPicker domains={domains} value={domainId} onChange={setDomainId} />
          </StepCard>

          {/* Step 3: Dimensions (shown when domain is selected) */}
          {activeDomain && (
            <StepCard step={3} title="Demographic conditioning">
              <DimensionSelector
                dimensions={activeDomain.dimensions}
                selected={selectedDims}
                onToggle={toggleDim}
              />
              {activeDomain.needs_geo && (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  ⚠ Experiment 3: geography is strongly predictive for this domain. A regional
                  location is recommended.
                </p>
              )}
              {activeDomain.geo_decision === "not_needed" && (
                <p className="mt-3 text-xs text-[color:var(--color-text-dim)]">
                  ✓ Experiment 3: geography adds minimal signal here, demographic dims dominate.
                </p>
              )}
            </StepCard>
          )}

          {/* Step 4 (or 3): Question */}
          <StepCard step={stepQuestion} title="Policy question">
            <QuestionPicker
              questions={
                activeDomain && activeDomain.question_ids.length > 0
                  ? questions.filter(
                      (q) => !activeDomain || activeDomain.question_ids.includes(q.question_id),
                    )
                  : questions
              }
              questionId={questionId}
              freeText={freeText}
              onChange={({ questionId, freeText }) => {
                setQuestionId(questionId);
                setFreeText(freeText);
              }}
              matchStatus={matchStatus ?? undefined}
              validationError={validationError}
            />
            {activeDomain && activeDomain.question_ids.length === 0 && (
              <p className="mt-1.5 text-xs text-[color:var(--color-text-dim)]">
                No curated questions for this domain. Use free text above.
              </p>
            )}
          </StepCard>

          {/* Scale picker: only when free text has no ATP match */}
          {showScalePicker && (
            <StepCard step={stepScale} title="Response scale">
              <p className="mb-3 text-xs text-[color:var(--color-text-dim)]">
                No survey prior found for this question. Choose the scale agents should respond on.
              </p>
              <div className="space-y-2">
                {ANSWER_SCALES.map((scale) => (
                  <button
                    key={scale.id}
                    onClick={() => setAnswerScaleId(scale.id)}
                    className={`w-full rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                      answerScaleId === scale.id
                        ? "border-[color:var(--color-cyan)] bg-[color:var(--color-cyan)]/10 text-[color:var(--color-cyan)]"
                        : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-hi)] text-[color:var(--color-text-dim)]"
                    }`}
                  >
                    <span className="font-medium">{scale.label}</span>
                    <span className="ml-2 text-xs opacity-60">
                      ({scale.options[0]} … {scale.options[scale.options.length - 1]})
                    </span>
                  </button>
                ))}
              </div>
            </StepCard>
          )}

          {/* Sample size */}
          <StepCard step={stepSample} title="Sample size">
            <label className="block">
              <span className="flex items-center justify-between text-xs uppercase tracking-wider text-[color:var(--color-text-faint)]">
                <span># Agents</span>
                <span className="font-mono text-[color:var(--color-cyan)]">{n}</span>
              </span>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
          </StepCard>

          {/* Run / Stop */}
          <div className="flex gap-3">
            <button
              disabled={!canRun}
              onClick={run}
              className="flex-1 rounded-full bg-[color:var(--color-cyan)] px-5 py-3 font-medium text-[color:var(--color-on-accent)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "running" ? "Running…" : "Run simulation"}
            </button>
            {status === "running" && (
              <button
                onClick={stop}
                className="rounded-full border border-[color:var(--color-border-hi)] px-5 py-3 font-medium hover:bg-[color:var(--color-hover)]"
              >
                Stop
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
        </aside>

        {/* ── Right panel: results ── */}
        <section className="space-y-6">

          {/* ── Idle placeholder ── */}
          {status === "idle" && !meta && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] py-24 text-center">
              <div className="text-4xl mb-4 opacity-20">◇</div>
              <p className="text-sm text-[color:var(--color-text-faint)]">Configure a simulation on the left and hit Run.</p>
            </div>
          )}

          {/* ── Question banner ── */}
          {meta && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 px-5 py-4 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {meta.domain_label && (
                  <span className="rounded-full border border-[color:var(--color-cyan)]/30 bg-[color:var(--color-cyan)]/10 px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-cyan)]">
                    {meta.domain_label}
                  </span>
                )}
                {simId && status === "done" && (
                  <Link
                    href={`/simulations/${encodeURIComponent(simId)}`}
                    className="ml-auto rounded-full border border-[color:var(--color-border-hi)] px-3 py-0.5 text-xs text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] hover:border-[color:var(--color-cyan)]/40"
                  >
                    View full results →
                  </Link>
                )}
              </div>
              <div className="text-base font-semibold leading-snug">{meta.question_label}</div>
              {meta.has_prior && meta.prior_source_label ? (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-3 py-2 text-xs text-emerald-500">
                  <span className="shrink-0 mt-px">✓</span>
                  <span><strong>Demographically grounded</strong> — ATP prior: <em>&ldquo;{meta.prior_source_label}&rdquo;</em></span>
                </div>
              ) : meta && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2 text-xs text-amber-500">
                  <span className="shrink-0 mt-px">⚠</span>
                  <span><strong>No survey prior</strong> — agents conditioned on demographics only.</span>
                </div>
              )}
            </div>
          )}

          {/* ── Live distribution — star of the show ── */}
          {(status !== "idle" || aggregate.length > 0) && (
            <LiveDistribution
              distribution={aggregate}
              responses={responses.length}
              n={n}
              status={status}
            />
          )}

          {/* ── Progress + live agent feed ── */}
          {status !== "idle" && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 overflow-hidden">
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--color-border)]">
                <div className="flex items-center gap-2.5">
                  {status === "running" ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--color-cyan)] opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--color-cyan)]" />
                    </span>
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  )}
                  <span className="text-sm font-semibold">
                    {status === "running" ? "Assembling electorate…" : "Electorate assembled"}
                  </span>
                </div>
                {/* Big live counter */}
                <div className="text-right">
                  <span className="font-mono text-2xl font-bold text-[color:var(--color-cyan)]">{responses.length}</span>
                  <span className="font-mono text-lg text-[color:var(--color-text-dim)]">/{n}</span>
                  <div className="text-xs text-[color:var(--color-text-dim)] uppercase tracking-wider">responded</div>
                </div>
              </div>

              {/* Progress bars */}
              <div className="px-5 py-3 space-y-2.5 border-b border-[color:var(--color-border)]">
                <div>
                  <div className="flex justify-between text-xs text-[color:var(--color-text-dim)] mb-1.5">
                    <span>Agents sampled</span>
                    <span className="font-mono">{agents.length} / {n}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[color:var(--color-fill-track)]">
                    <div
                      className="h-2 rounded-full transition-all duration-200"
                      style={{ width: `${Math.round((agents.length / n) * 100)}%`, background: "var(--color-cyan)", opacity: 0.45 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-[color:var(--color-text-dim)] mb-1.5">
                    <span>Responses collected</span>
                    <span className="font-mono">{responses.length} / {n}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[color:var(--color-fill-track)]">
                    <div
                      className="h-2 rounded-full transition-all duration-200"
                      style={{ width: `${Math.round((responses.length / n) * 100)}%`, background: "var(--color-cyan)" }}
                    />
                  </div>
                </div>
              </div>

              {/* Agent feed */}
              <div className="p-4">
                {agents.length > 0 ? (
                  <LiveAgentFeed agents={agents} agentPriors={agentPriors} responses={responses} />
                ) : (
                  <div className="py-6 text-center text-xs text-[color:var(--color-text-faint)] animate-pulse">
                    Sampling agents…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Per-agent rationales ── */}
          {responses.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[color:var(--color-text-dim)]">
                Per-agent rationales
              </h2>
              <RationaleList agents={agents} responses={responses} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ── Live distribution (star of the show) ─────────────────────────────────────

const DIST_COLORS = ["#1d4ed8", "#7c3aed", "#0891b2", "#0d9488", "#b45309"];

function LiveDistribution({
  distribution,
  responses,
  n,
  status,
}: {
  distribution: AnswerProb[];
  responses: number;
  n: number;
  status: Status;
}) {
  const pct = n > 0 ? Math.round((responses / n) * 100) : 0;
  const sorted = [...distribution].sort((a, b) => b.prob - a.prob);

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[color:var(--color-border)]">
        <div>
          <h2 className="text-xl font-bold">Opinion distribution</h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-faint)]">
            {responses > 0
              ? `${responses} of ${n} agents responded`
              : status === "running"
              ? "Waiting for first response…"
              : "Run a simulation to see results"}
          </p>
        </div>
        {/* Completion ring / counter */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-4xl font-mono font-bold text-[color:var(--color-cyan)] tabular-nums leading-none">
              {pct}<span className="text-2xl text-[color:var(--color-text-faint)]">%</span>
            </div>
            <div className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-faint)] mt-1">complete</div>
          </div>
          {status === "running" && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--color-cyan)] opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[color:var(--color-cyan)]" />
            </span>
          )}
          {status === "done" && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-sm">✓</span>
          )}
        </div>
      </div>

      {/* Bars */}
      <div className="px-6 py-5 space-y-5">
        {sorted.length > 0 ? (
          sorted.map((d, i) => (
            <div key={d.answer_label}>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm font-medium text-[color:var(--color-text)]">{d.answer_label}</span>
                <span
                  className="font-mono text-lg font-bold tabular-nums"
                  style={{ color: DIST_COLORS[i % DIST_COLORS.length] }}
                >
                  {Math.round(d.prob * 100)}%
                </span>
              </div>
              <div className="h-10 w-full overflow-hidden rounded-xl bg-[color:var(--color-fill-track)]">
                <div
                  className="h-full rounded-xl transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.round(d.prob * 100)}%`,
                    background: DIST_COLORS[i % DIST_COLORS.length],
                    minWidth: d.prob > 0 ? "6px" : "0",
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          /* Skeleton loading bars */
          [100, 72, 55, 38, 22].map((w, i) => (
            <div key={i}>
              <div className="flex justify-between mb-2">
                <div
                  className="h-4 rounded-md bg-[color:var(--color-border)] animate-pulse"
                  style={{ width: `${w + 40}px`, animationDelay: `${i * 120}ms` }}
                />
                <div
                  className="h-4 w-10 rounded-md bg-[color:var(--color-border)] animate-pulse"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              </div>
              <div
                className="h-10 rounded-xl bg-[color:var(--color-fill-track)] animate-pulse"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Live agent feed ──────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  sampling:  { text: "sampling…",     cls: "text-[color:var(--color-text-dim)] animate-pulse" },
  grounded:  { text: "prior attached", cls: "text-amber-500" },
  responded: { text: "",               cls: "font-medium text-[color:var(--color-cyan)]" },
};

function LiveAgentFeed({
  agents,
  agentPriors,
  responses,
}: {
  agents: Agent[];
  agentPriors: Map<number, AnswerProb[]>;
  responses: AgentResponse[];
}) {
  const responseMap = new Map(responses.map((r) => [r.agent_id, r]));

  return (
    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-0.5">
      {agents.map((agent, i) => {
        const response = responseMap.get(agent.agent_id);
        const hasPrior = agentPriors.has(agent.agent_id);
        const statusKey = response ? "responded" : hasPrior ? "grounded" : "sampling";
        const { text, cls } = STATUS_LABEL[statusKey];

        return (
          <div
            key={agent.agent_id}
            className="live-agent-row flex items-center gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2"
            style={{ animationDelay: `${i * 35}ms` }}
          >
            {/* Number */}
            <span className="w-5 shrink-0 text-center font-mono text-xs font-bold text-[color:var(--color-cyan)]">
              {agent.agent_id}
            </span>

            {/* Status dot */}
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                statusKey === "responded"
                  ? "bg-emerald-400"
                  : statusKey === "grounded"
                  ? "bg-amber-400"
                  : "bg-[color:var(--color-border)] animate-pulse"
              }`}
            />

            {/* Demographic chips */}
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {[agent.age, agent.income, agent.race].map((val) => (
                <span
                  key={val}
                  className="rounded-md bg-[color:var(--color-fill-track)] px-1.5 py-0.5 text-xs text-[color:var(--color-text)]"
                >
                  {val}
                </span>
              ))}
            </div>

            {/* Status / stance */}
            <span className={`shrink-0 text-right text-sm max-w-[140px] truncate ${cls}`}>
              {statusKey === "responded" ? response!.stance : text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Step card ─────────────────────────────────────────────────────────────────

function StepCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-cyan)]/15 text-xs font-semibold text-[color:var(--color-cyan)]">
          {step}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-text-faint)]">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}
