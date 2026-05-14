# CivicSim Demo Script

**Duration:** ~8–10 minutes  
**URL:** `localhost:3000` (or civicsim.xyz for live)  
**Audience:** Researchers, policymakers, potential collaborators

---

## Setup (before the demo starts)

- Backend running on port 8000, frontend on port 3000
- Browser open to `/simulations` — the two example cards (Healthcare, Immigration) should be visible
- Clear localStorage if you've run demos before: open DevTools → Application → Local Storage → delete `civicsim_run_demos`
- Close any extra tabs

---

## Part 1 — The Problem (1 min)

**Say:**
> "Policy decisions affect millions of people, but the tools we use to model public opinion are either too slow, too expensive, or too coarse. Pew Research publishes a survey. It takes months. It covers national averages. By the time it's out, the policy window has closed.
>
> CivicSim asks: what if you could simulate demographically grounded public opinion on any policy question, for any geography, in real time?"

---

## Part 2 — The Simulations Dashboard (1 min)

**Navigate to:** `/simulations`

**Say:**
> "This is the simulations dashboard. Every run is persisted with full per-agent detail — who responded, what their demographic profile was, what prior opinion data grounded them, and what they said.
>
> These two examples — healthcare and immigration — show what a completed run looks like. Let me run a live one."

**Point out:**
- Domain label, location, distribution bars
- "The bars aren't just outputs — they're backed by real Pew ATP survey priors matched to each agent's demographic profile."

---

## Part 3 — H1B Demo (3 min)

**Navigate to:** `/simulate`

**Say:**
> "I'll start with a question that's actively in the news. H1B visa policy."

**Type in the free-text box:**
> `should h1b be a wage based policy`

**While agents load:**
> "Watch what's happening here. Each agent is being sampled from American Community Survey demographic distributions for the West region — age, income, race, occupation. Before they even respond, the system attaches a prior probability distribution from matched Pew survey data. That's what grounds the agent — it's not just an LLM making things up."

**While responses stream in:**
> "Now the LLM is reasoning from that agent's specific demographic profile. A software engineer in their late 20s reasons differently about H1B than a restaurant worker or a recent graduate. Each rationale is individuated."

**When complete:**
> "47% strongly support tying H1B to wage requirements. That's not a random number — it emerges from 15 demographically diverse agents, each grounded in empirical priors.
>
> Click any rationale card to see why that specific agent took that stance."

**Click one rationale — ideally a dissenter (Somewhat oppose):**
> "This agent came here on an H1B. Their reasoning is different. The system captures that — it doesn't flatten everyone into an average."

---

## Part 4 — Minimum Wage Demo (3 min)

**Navigate to:** `/simulate`

**Say:**
> "Now let me show you something different — a question where the distribution is more contested."

**Select:** Economy domain from the Policy Domain dropdown

**Say:**
> "When you select a domain, the system surfaces curated questions that have Pew ATP empirical prior data behind them. This is important — it means agent opinions are calibrated against real survey responses, not just prompted from scratch."

**Select from dropdown:** "Should the federal minimum wage be raised to $15/hour?"

**Hit Run. While it runs:**
> "Same pipeline — ACS demographic sampling, prior attachment, then LLM reasoning. Same region, same 15 agents."

**When complete, compare to H1B:**
> "Look at this distribution versus the H1B one. Minimum wage is more contested. 33% strongly favor, but 20% somewhat oppose, 13% strongly oppose. You can see a genuine split — a retired teacher supports it, an economist is skeptical, a barista is genuinely torn.
>
> That's the point. Different questions produce different distributions. CivicSim doesn't have a thumb on the scale."

---

## Part 5 — Simulations Dashboard (1 min)

**Navigate to:** `/simulations`

**Say:**
> "Both runs have now appeared in the dashboard — alongside the base examples. Every run is clickable."

**Click the H1B card:**
> "The detail view breaks down opinion by age, race, and income bracket. You can see which demographic groups are driving support or opposition. That's the analytical layer — not just 'what do people think' but 'who thinks what and why.'"

---

## Part 6 — Why This Matters (1 min)

**Say:**
> "The standard alternative is a \$50,000 poll that takes three months and gives you national averages. CivicSim gives you:
>
> - **Any geography** — we have ACS distributions for every Census region, division, and county
> - **Any question** — curated Pew questions with empirical priors, or free-text with semantic matching
> - **Real-time** — a 15-agent run completes in under two minutes
> - **Grounded** — every agent's prior is anchored to actual survey data, not hallucinated
>
> We've validated against held-out Pew ATP data. TVD of 0.245, Wasserstein of 0.219 — in the moderate calibration range for a system running on 15–30 agents."

---

## Anticipated Questions

**"Isn't this just the LLM making things up?"**
> "No — each agent is anchored to a prior probability distribution drawn from real Pew ATP survey data matched to their demographic profile. The LLM reasons *from* that prior, not in place of it. We also evaluate validity rates: over 90% of agent stances align with their prior distribution's top-2 answers."

**"What's the difference between this and just prompting GPT-4 with a question?"**
> "Three things: demographic sampling from ACS census data, empirical prior attachment from Pew ATP, and geographic conditioning. A generic prompt gives you one voice. CivicSim gives you a population."

**"How do you validate it?"**
> "We run it against held-out Pew ATP responses — questions the model has never seen — and compute Total Variation Distance and Wasserstein distance between the simulated distribution and the ground-truth survey distribution. We have an evals dashboard under `/simulations/evals`."

**"What questions can you ask?"**
> "Anything in our curated catalog has Pew priors behind it. Free-text questions go through semantic matching — if there's a close match in the ATP database, agents get grounded priors. If not, the system tells you there's no prior match and lets you choose a response scale."

**"Can you do this for a specific county or city?"**
> "Yes — we have ACS distributions for Census regions, divisions, and counties. Finer geography means smaller sample sizes in the underlying data, which we handle with a backoff strategy."

---

## Closing

> "CivicSim is open-source, built at UC Berkeley, and validated against real survey data. We're looking for research partners and use-case collaborators — if you work in policy, civic tech, or computational social science, we'd love to talk."

**Hand off to:** civicsim.xyz or the GitHub repo.
