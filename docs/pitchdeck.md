# CivicSim — Pitch Deck

**Audience:** grad-school panel of professors (judges) + student audience
**Length:** ~12 slides, ~10–12 min talk + live demo + Q&A
**Tone:** crisp, evidence-led, low-jargon. The technical depth shows up through *numbers*, not architecture.

---

## Design system (apply consistently)

> **Source of truth:** [design/palette.md](../design/palette.md), [design/typography.md](../design/typography.md), [design/tokens.json](../design/tokens.json). Live preview: [design/preview.html](../design/preview.html). Always copy hex values from these files — do not invent new ones.

### Color palette — canonical brand

**Primary brand colors**

| Role | Hex | Use on slides |
|---|---|---|
| Cyan (primary) | `#1D4ED8` | Stat numbers, CTAs, links, glows |
| Violet (accent) | `#2563EB` | Headline accents, behavioral cues, secondary stats |
| Green | `#10B981` | Checkmarks, "not needed" / positive tags |
| Amber | `#F59E0B` | "Optional" tag, warnings, callouts |
| Red | `#EF4444` | "Required" tag, crosses, problem cards |

**Backgrounds & surfaces**

| Role | Hex |
|---|---|
| Slide background | `#F6F9FF` |
| Alt background | `#EEF5FF` |
| Card surface | `#FFFFFF` |
| Card surface 2 | `#EAF2FF` |

**Text**

| Role | Hex |
|---|---|
| Primary heading text | `#0B1F4D` |
| Dim / secondary | `#486381` |
| Faint / captions | `#7B8EA8` |

**Slide quick reference (paste these straight into Keynote / PowerPoint / Slides)**

| Slide element | Hex |
|---|---|
| Slide background | `#F6F9FF` |
| Heading text | `#0B1F4D` |
| Subheading | `#486381` |
| Primary accent / CTA | `#2563EB` |
| Secondary accent | `#A855F7` |
| Stat number | `#1D4ED8` |
| Highlight green | `#10B981` |
| Warning amber | `#F59E0B` |
| Error red | `#EF4444` |

### Signature gradients (for hero / closing / trust banners)

```css
/* Stat-number gradient — apply to the big 10.6% / 25.2% / 2.4× */
background: linear-gradient(135deg, #1D4ED8, #2563EB);

/* CTA button / accent surface */
background: linear-gradient(135deg, #1D4ED8 0%, #2EE0FF 100%);

/* Trust / hero / closing dark banner */
background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);

/* Hero glow background (use on title + close slides) */
background:
  radial-gradient(circle at 14% 12%, rgba(37, 99, 235, 0.12), transparent 30rem),
  radial-gradient(circle at 86% 8%, rgba(14, 165, 233, 0.10), transparent 34rem),
  linear-gradient(180deg, #F6F9FF 0%, #EEF5FF 100%);
```

### Typography

| Role | Font | Notes |
|---|---|---|
| Headings, body, UI | **Inter** (weight 700 for headings, 400 for body) | Fallback: Helvetica Neue (Mac) or Calibri (Windows) |
| Numbers, mono labels, eyebrows | **JetBrains Mono** (weight 600) | Fallback: SF Mono, Menlo, Courier New |

**Type scale (presentation context)**

| Slide context | Heading | Sub | Body | Caption |
|---|---|---|---|---|
| Title slide | 60–72pt | 28–32pt | — | — |
| Content slide | 36–44pt | 22–26pt | 18pt | 13pt |
| Stat / callout card | 64–80pt (mono) | 16–18pt | — | 12pt |
| Footnote / source | — | — | — | 10pt |

**Hierarchy pattern (every content slide should follow this)**

```
MONO EYEBROW (UPPERCASE, JetBrains Mono, +0.12em tracking) — e.g. "01  THE PROBLEM"
Heading in Inter Bold (#0B1F4D), tight tracking (-0.025em), line-height 1.15
Body in Inter Regular (#0B1F4D), line-height 1.7
  → Stat numbers in JetBrains Mono 600, color #1D4ED8 (or gradient)
```

### Layout & component rules

- **Slide canvas:** 1280 × 720 (16:9), background `#F6F9FF`.
- **Padding:** 64px top, 80px left/right.
- **Grid:** 12-column. Title and demo slides break out; everything else aligns left.
- **Card radius:** `14px` standard, `18px` for hero callouts.
- **Card shadow:** `0 8px 32px rgba(0,0,0,0.24)` (standard), `0 16px 52px rgba(37,99,235,0.12)` (glow on hero card).
- **Border on tinted cards:** `1px solid rgba(37, 99, 235, 0.14)`.
- **Accent rule:** two accents max per slide (cyan + violet is the canonical pair). Reserve green/amber/red for tags and status indicators only — never as decorative accents.

### Rules of thumb

- **Rule of one:** one headline, one supporting chart or visual, one takeaway per slide. Let space breathe — `#F6F9FF` is a *feature*, not absence.
- **Number treatment:** every stat is JetBrains Mono, ≥ 60pt, color `#1D4ED8` (or gradient). The number is the slide; everything else is annotation. Label in mono UPPERCASE 11.5pt underneath.
- **Eyebrow always present** on content slides — mono uppercase, `#486381`, +0.12em tracking. It's the slide's index card.
- **No serif headings.** The canonical brand is sans-only (Inter). If a previous draft used Playfair or another serif for headings, override it — Inter Bold at -0.025em tracking is the brand voice.

---

## Slide 1 — Title

**Visual:** CivicSim logo, centered. Faint background image: a stylized U.S. map made from dots representing demographic subgroups.

**Headline (large serif):**
> **CivicSim**

**Tagline (one line, accent color):**
> Ground it before you simulate it.

**Subline (smaller, neutral):**
> Demographically grounded LLM simulations for public-policy testing.

**Footer (small caps, right-aligned):**
> UC Berkeley Capstone · 2026 · civicsim.xyz

**Speaker notes (≤ 20s):** "We built a system for testing public policy with AI-simulated populations. The key idea is in our tagline — most LLM simulations fail before a single token is generated, because they aren't grounded in who's actually being simulated. We'll show you what we built, the evidence behind it, and what it means for policy work."

> **Suggestion:** keep this slide on screen *while you introduce the team*. Don't add team headshots to the title — put a small "Team" line at the bottom (4 names + advisor) instead of a separate slide later. Title slides with too much information feel like résumés.

---

## Slide 2 — AI simulation is here. Policy hasn't caught up.

**Headline:**
> AI simulations are testing ideas in every industry but the one that matters most.

**Body (two-column, sparse):**

| **Where AI simulation already works** | **Where it doesn't yet** |
|---|---|
| Product design — synthetic users test interfaces before launch | Public policy — most decisions still rely on slow, expensive, narrow survey panels |
| Market research — synthetic respondents stand in for survey cohorts | Legislators ship policy without ever testing it against a representative virtual population |
| Drug discovery, ad targeting, financial stress tests | Policymakers learn what worked *after* the policy is already law |

**Bottom callout (royal blue bar):**
> Public policy is the next frontier — and the hardest, because representation isn't optional.

**Speaker notes:** "Simulation has quietly become the way industries de-risk decisions before they ship. Public policy is structurally the best candidate for this — high cost of failure, slow feedback loops — and structurally the hardest, because if your simulated population isn't representative, you've automated bias instead of removing it."

> **Suggestion:** resist the urge to list 8 industries. Three columns max, picked because the audience *already believes* simulation works there. The slide's job is to make policy feel conspicuous by its absence — not to teach AI history.

---

## Slide 3 — The problem: most policy simulations fail before generation

**Headline:**
> Today's AI policy simulations fail at the input — not the model.

**Body (three problem cards, vertical bars in slate background):**

> **Card 1 — Stereotypes, not populations**
> Generic prompts like *"simulate a 35-year-old voter"* produce LLM-flavored caricatures. There is no demographic distribution behind the agent — only the model's priors.
>
> *Commercial parallel: fine for ad copy. Disqualifying for policy.*

> **Card 2 — Survey ≠ population**
> Sampling from a survey panel inherits the panel's exclusions. Rural, immigrant, and intersectional groups land in the wrong bracket up to **32%** of the time.
>
> *Commercial parallel: fine for averages. Disqualifying when subgroups matter.*

> **Card 3 — Wrong variables, confidently**
> The variables we *assume* matter (age, income, education) explain only **10.6%** of real opinion variation. Choosing variables empirically lifts that to **25.2%** — and the textbook approach misses geography entirely.
>
> *Commercial parallel: fine for trend signals. Disqualifying when the answer must defend itself in a hearing.*

**Footer line:**
> The model isn't the problem. The *who* being simulated is.

**Speaker notes:** "Three failure modes — and they all happen before the LLM even runs. Stereotype generation, survey-only sampling, and conventional variable choices. Each one is acceptable in a commercial setting and unacceptable in a policy one, because in policy the subgroup *is* the audience."

> **Suggestion:** make the three cards *visually identical* — same height, same headline weight. Symmetry signals "these are equal pillars." If you let one grow taller than the others, the audience reads hierarchy where there isn't one. Bold the percentages (32%, 10.6%, 25.2%) — they are the slide's evidence.

---

## Slide 4 — The competitive landscape

**Headline:**
> Synthetic-persona platforms exist. None are built for the policy bar.

**Body (table, 3 rows):**

| Platform | What it's optimized for | Why it falls short for policy |
|---|---|---|
| **Simile** | Human-behavior simulation for product & research teams | Limited demographic grounding; weak representation of real civic populations |
| **Ditto** | AI personas for qualitative research | Built for research workflows, not decision-grade simulation |
| **Aaru** | Reaction modeling for business & government messaging | Closed methodology; not designed for transparent, auditable subgroup analysis |

**Differentiator bar (gold, full-width):**
> CivicSim is the only system grounding agents in **2.5M Census records** + **38,449 validated Pew respondents** — and exposing every step for inspection.

**Speaker notes:** "There's a real and growing market here. These tools are good at what they do. None of them set their bar where policy needs the bar to be — joint demographic grounding, transparent variable selection, and auditable per-agent reasoning."

> **Suggestion:** drop the company logos in greyscale, not full color — that signals "respectful comparison, not attack." Don't badge yourself; let the differentiator bar do that work. If a judge asks "how is this different from Aaru" during Q&A, you want to *not* have a defensive slide queued.

---

## Slide 5 — Introducing CivicSim

**Headline:**
> **CivicSim** — a framework and product for demographically grounded policy simulation.

**Subline (one line):**
> Pick a U.S. location. Choose a policy question. Run a synthetic electorate that's actually representative.

**Body (three pillar cards, equal weight):**

> **① Representative Population**
> Agents are sampled from **ACS Census microdata** — 2.5M records, not survey panels. Marginal distributions exactly match the location.

> **② Policy-Specific Grounding**
> Each agent carries an **empirical opinion prior** from 38,449 Pew respondents — not the LLM's own assumptions.

> **③ Transparent by Design**
> Every persona is **inspectable**: demographics, prior, stance, and rationale streamed live and saved per run.

**Footer callout (deep navy):**
> The goal isn't perfect prediction. It's representative, transparent simulation **before** real-world rollout.

**Speaker notes:** "Three pillars. Each one is a direct correction of one of the three failure modes on the previous slide. Population from census microdata, opinions from real survey data, and full transparency on every persona. Let me show you what it looks like."

> **Suggestion:** use this slide as the *handoff into the demo*. Last line of speaker notes should be a verbal bridge — "let me show you" — so the demo slide feels earned, not interruptive. Keep this slide on screen for ~30 seconds, no more.

---

## Slide 6 — Live demo

**Visual:** full-bleed video embed (or placeholder rectangle if presenting live). Title bar in top-left only — the rest of the slide is the product.

**Title (small, top-left):**
> Live demo — CivicSim in action

**Mini-caption ribbon below video (5 stages, numbered, one line each):**

1. **Policy input** — submit a draft proposal or question.
2. **Population** — sample a representative electorate from census microdata.
3. **Simulation** — agents respond with stance + reasoning, streamed live.
4. **Comparison** — stakeholder groups side-by-side, divergence surfaced.
5. **Inspection** — drill into any agent's demographics, prior, and rationale.

**Closing line (only appears after video, optional builder animation):**
> Every output traceable. Every persona explainable.

**Speaker notes:** "I'm going to run this live against [pick one policy question you've rehearsed]. Watch the bottom-right panel — those are individual personas responding in real time. The demographics on the left came from the Census, not from me."

> **Suggestion:** rehearse the demo on a **fixed seed** with a question you know produces interesting divergence. If the live API call is risky, have a pre-recorded fallback video on the slide ready to play in one keystroke. *Never* demo a feature you haven't run successfully three times that morning.

---

## Slide 7 — How it works (the non-technical version)

**Headline:**
> Four steps, end to end.

**Visual:** horizontal 4-step flow with arrows. Each step is a clean tile with a one-line description.

| Step | What happens | What grounds it |
|---|---|---|
| **① Sample** | Build N agents matching the location's demographics | ACS Census microdata (2.5M records) |
| **② Prime** | Attach an empirical opinion prior to each agent | Pew ATP survey waves 2021–2024 (38,449 respondents) |
| **③ Simulate** | Each agent answers the policy question with a rationale | LLM, conditioned on its demographics + prior |
| **④ Aggregate** | Stream results live; surface group-level divergence | Per-agent SSE events, saved per run |

**Bottom strip (faint, monospace):**
> *Built on FastAPI + Next.js · streaming via Server-Sent Events · OpenAI / Anthropic / mock providers · open-source agent sampler*

**Speaker notes:** "Sample, prime, simulate, aggregate. The grounding column on the right is the part most other systems skip — it's why we get the numbers you're about to see."

> **Suggestion:** the monospace strip at the bottom is for the judges who *want* the tech stack to land. Don't read it aloud — let it do silent credibility work. The visible flow has to be readable from the back row of the room.

---

## Slide 8 — The data foundation

**Headline:**
> Two datasets do the heavy lifting. Both are public, gold-standard, and load-bearing.

**Body (two large cards, side by side):**

> **🏛️ American Community Survey (ACS) — Census Microdata**
> **~2.5M adult records / year**, sourced via IPUMS USA.
> **Why this dataset:** the only public source with *joint* demographic distributions at the population level. Marginal-only sampling collapses intersectional groups; ACS lets us preserve them.

> **📊 Pew American Trends Panel (ATP)**
> **38,449 validated respondents**, waves W80–W159 (2021–2024).
> **Why this dataset:** a probability-based panel with consistent methodology across 80+ waves and broad topical coverage. We compile it into a compact opinion-prior lookup — no PII, no respondent IDs.

**Footer line (italic, small):**
> Both sources are widely used in academic policy research. Our contribution is in how we *combine* them.

**Speaker notes:** "Census for the *who*, Pew for the *what they think*. Neither is exotic — both are standard in policy research. The novelty is in how we combine them: ACS for the joint distribution of who exists, ATP for the conditional distribution of what those people actually believe."

> **Suggestion:** add tiny credibility logos (IPUMS, Pew) below each card if you can get them at print quality. Judges from a policy school will *immediately* recognize and trust both — don't bury the source attribution.

---

## Slide 9 — Experimentation and results

**Headline:**
> The demographics we *assume* matter aren't the ones that actually shape opinion.

**Body (three giant stat blocks, equal width):**

> **10.6%**
> *Variance explained by* **conventional** *demographic variables* (age, income, education).
> *The textbook approach.*

> **25.2%**
> *Variance explained when conditioning variables are* **selected empirically** *per policy domain.*
> *Our approach.*

> **2.4×**
> *Improvement factor over conventional variable selection.*
> *Measured across 1,426 opinion items.*

**Supporting line (under the stat blocks, smaller):**
> Tested exhaustively across every combination of 7 demographic variables. Census division — omitted by the textbook approach — turns out to drive a **53.5%** signal drop when removed. The variables we'd skip are the variables we most need.

**Bottom callout (gold bar):**
> The model isn't the bottleneck. The *who* is. And we now have measured evidence of how much that costs.

**Speaker notes:** "This is the slide I want you to remember. Two-point-four times more signal — not from a better LLM, not from more compute, but from choosing the right demographic variables empirically rather than by convention. And the variable that matters most — Census division — is the one the textbook approach throws out."

> **Suggestion:** use a *huge* font for the three numbers (80–100pt). The slide should be readable from the parking lot. Resist adding a chart — the three numbers *are* the chart. If you must add a visual, a tiny inline bar chart under the 2.4× block showing 10.6 vs 25.2 is fine. Anything more competes with the numbers.

---

## Slide 10 — Voice of our users

**Headline:**
> What policy researchers are telling us.

**Body (three quote cards, equal weight, slightly different background tints):**

> **"The transparency is the part that matters. I can defend a recommendation when I can show how the population was constructed — most tools don't let me do that."**
> *— [PLACEHOLDER] Policy researcher, Goldman School of Public Policy, UC Berkeley*

> **"We've been waiting for something that takes subgroup representation seriously. Stratified sampling from Census microdata is exactly the methodological bar that academic work requires."**
> *— [PLACEHOLDER] PhD candidate, Stanford Institute for Human-Centered AI*

> **"The empirical variable selection result is the most important finding here. It changes how I'd design the next survey-based study, not just how I'd run a simulation."**
> *— [PLACEHOLDER] Researcher, [Top policy school TBD]*

**Footer line (very small, italic):**
> Quotes anonymized at request of participants. Identifying details with each researcher on file.

**Speaker notes:** "Beyond the methodology, the feedback we've been getting from researchers at policy schools is that the transparency layer is what unlocks this for them. Not the LLM. Not the simulation. The fact that they can defend every choice the system made."

> **Suggestion:** replace the placeholders with real quotes *as soon as you have them* — even one real quote alongside two placeholders beats three placeholders. If you can't get real quotes by deck day, consider replacing this slide with an "Impact" slide framing the broader applicability (campaign strategy, agency rulemaking, ballot measure testing, etc.) — that's a stronger position than placeholder quotes the panel might see through.

---

## Slide 11 — Limitations and next steps

**Headline:**
> CivicSim is a decision-support system — not a replacement for real public engagement.

**Body (three columns of equal weight, soft grey cards):**

> **Data**
> · Limited qualitative interview corpus
> · Geographic scope: Alameda County, CA in v1
> · Survey temporal coverage gaps

> **Simulation**
> · Directional realism — not ground truth
> · Uncertainty in novel-policy scenarios
> · Opinion dynamics over time not yet modeled

> **Evaluation**
> · Broader longitudinal validation needed
> · Stakeholder testing breadth still limited
> · Adversarial robustness testing underway

**Bottom callout (warm gold):**
> ⚠ Representative simulations can support decision-making. They should never replace the voices of real communities.

**Next-steps strip (below callout, smaller, in accent color):**
> Roadmap: multi-state expansion · longitudinal validation against real policy outcomes · open-source release of the empirical variable-selection toolkit.

**Speaker notes:** "We're deliberate about what this is and isn't. It's a decision-support tool. It accelerates the *first ninety percent* of policy testing — what would diverse communities likely respond? — and it's emphatically not a substitute for the last ten percent, which is talking to real people."

> **Suggestion:** *lead* with limitations, not roadmap. Panels of professors test for intellectual honesty more than for ambition. A team that names its failure modes confidently signals research maturity; a team that buries them signals the opposite. The gold callout is the moral spine of the talk — pause on it.

---

## Slide 12 — Close & Q&A

**Headline (large, centered):**
> **Ground it before you simulate it.**

**Subline:**
> CivicSim is live at **civicsim.xyz**

**Body (three call-to-action lines, vertically stacked):**
> 📄 Read the paper (link / QR code)
> 🛠 Try the live demo (civicsim.xyz)
> 💬 Talk to us — [team contact emails]

**Footer:**
> Team: [names] · UC Berkeley Capstone · 2026

**Speaker notes:** "Happy to take questions. The live demo is open right now if anyone wants to test a question against Alameda County after the panel."

> **Suggestion:** put a *real QR code* to civicsim.xyz on this slide. It's the one slide that stays on screen the longest (full Q&A) — turning it into a working CTA buys you 10+ minutes of passive recruiting from the audience. Don't end with "Thank You." End with the tagline — it's stronger and reinforces the one line you most want them to remember.

---

# Universal suggestions across the whole deck

1. **Strip every slide of one element.** First pass after drafting, go back and delete one thing from each slide. Almost every slide ends up better. The eye lands on the remaining content faster.
2. **Numbers > adjectives.** "Significantly better" is invisible. "2.4×" is permanent. Wherever you've written a qualifier, ask if a number can replace it.
3. **One animation per slide, max.** Build-in only what changes the slide's *meaning* (e.g. revealing the 2.4× after the 10.6% and 25.2%). Decorative animation makes a panel discount the substance.
4. **Rehearse with a 10-minute hard cap** before the demo. If you can't hit 10 minutes excluding demo + Q&A, the deck is still too long.
5. **Print the deck and look at it 6 ft away.** If a number or headline isn't readable, it's too small. The back row of the room is *farther* than 6 ft.
6. **Have a single backup slide hidden between 11 and 12:** an architecture diagram you can jump to if a judge asks "how does it work technically?" Don't put it in the main flow — it kills pacing — but have it ready.
7. **Color discipline.** Pick two accents and don't add a third. Every additional color tells the audience "this is also important" and dilutes the slide's primary signal.
