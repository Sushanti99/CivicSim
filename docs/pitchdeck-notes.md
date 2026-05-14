# CivicSim Pitch Deck · Narration Script

Complete narration for each slide. Read this aloud, or use it to rehearse. Keep open on a second screen during presentation as backup to the HTML notes overlay (press **N** in the deck to toggle the same narration).

**Total speaking time: ~14 minutes** (including the live demo and brief pauses, before Q&A).

---

## Slide 1 · Title  ·  ~30 sec

Hi everyone, thanks for having us. We're team CivicSim. I'm **[your name]**, and that's Anagha, Aratrik, Sushanti, and Vikram. We're all MIMS students at the Berkeley School of Information.

What you see on this slide is our logo, the team, and a dotted map of the United States. That map is going to be relevant in about thirty seconds, because what we've been working on for the last year is essentially one question. How do you build something that simulates an entire country's worth of opinions, without flattening the people who live there?

Our project is called CivicSim. The tagline up there is **"ground it before you simulate it."** That phrase has basically become our religion at this point. Because the more we looked at AI-based policy simulation, the more we kept finding the same problem. Most of these systems are failing in a way that isn't obvious. They're failing before they generate a single word. And we want to walk you through why, and what we built to fix it.

---

## Slide 2 · The Opportunity  ·  ~60 sec

So let's start with where we are right now. If you've been paying attention to AI in the last couple of years, you've probably noticed that AI simulation is becoming kind of a thing. It's actually everywhere now.

If you're designing a product, you can test it on synthetic users before you ever ship to a real customer. Market research firms are running surveys with synthetic respondents instead of paying for real survey panels. That alone saves them weeks and tens of thousands of dollars per study. Pharma companies are doing virtual stress tests of compounds before clinical trials. Ad agencies are A/B testing creative against simulated demographics. Even finance, which has been doing scenario simulation for decades, is now getting an AI layer added on top.

So the right side of this slide is the basic point. Public policy is conspicuously missing from that list. We still pass laws the old way. We rely on slow, narrow, expensive survey panels. It's basically the same playbook from the 1980s. Important legislation goes from draft to law without ever being tested against a synthetic version of the population it's going to affect. And we usually only find out whether a policy actually worked after it's already in effect. That's a really backward way to build something as consequential as public policy.

We think public policy is actually the natural next frontier for this technology. But here's why nobody's done it well yet. It's also the hardest frontier. Because in public policy, you can't just be roughly right. **Representation isn't optional.** If your simulation misses a community, you've just automated a bias and called it data. That's the bar CivicSim was built for.

---

## Slide 3 · The Problem  ·  ~70 sec

So we asked ourselves the obvious question. If AI simulation is everywhere else, why hasn't it worked for policy? And what we found, when we dug into it, was that there are three specific failure modes. And they all happen before the AI even starts generating responses. The failure isn't in the model. It's in how the model is being set up.

The first failure is on the left of the slide. Most simulations start with a prompt that says something like "simulate a 35-year-old voter from Texas." If you've ever tried that, you know what happens. The model returns this average of every Texan stereotype it has ever scraped off the internet. Cowboy hats, pickup trucks, the works. There's no real distribution of Texans behind that agent. It's a caricature. And caricatures are fine if you're writing ad copy. They're a disaster if you're advising someone on real policy.

The second failure, in the middle, is more subtle. When researchers do use real data, they usually sample from existing survey panels. The problem is that those panels weren't designed to be representative populations. They were designed to answer specific research questions. So when you sample agents from them, you inherit all their gaps. We actually measured this. For young Black Americans, survey panels misplace **32 percent** of them into the wrong income bracket. A full third of a community ends up in the wrong slot.

The third failure is the one we found most interesting. The variables researchers typically pick to ground their simulations are often the wrong variables. Age, income, education. They sound important. But for something like tech policy, geography turns out to matter more than age. And almost everyone skips geography.

The takeaway on this slide is the line at the bottom. **The model isn't the problem. The "who" being simulated is.**

---

## Slide 4 · The Landscape  ·  ~65 sec

Now we should be honest. We're not the first team to think about this. The synthetic persona space actually has some pretty serious players. There are three companies in particular that you've probably seen if you've been watching this space. **Simile, Ditto, and Aaru.** Between them, they've raised over **50 million dollars.** Real engineers, real investors, real momentum.

So why isn't one of them doing what we're doing? The answer is that they're not actually trying to. Each of these companies was built for commerce. Simile is mostly for product and market research teams. Ditto does qualitative AI research personas. Aaru is for business and government messaging. All useful, all well-funded, all completely different beasts from what policy actually demands.

When you look at these tools through a policy lens, three structural gaps show up consistently. Those are the three boxes at the bottom of the slide.

The first gap is that their **demographic grounding is shallow.** They're synthesizing personas from generic priors, not from real census data.

The second gap is that they're **built for research workflows**, not for decision-making. If you're a city council member who has to defend a policy choice in a hearing, you can't really cite "an AI persona told me" as your reasoning.

The third gap is that the **methodology is closed.** You can't audit how a persona was built, or why it reasoned a certain way. For policy work, that's a non-starter.

So none of these competitors are bad products. They're just optimized for a totally different problem. We saw the policy-specific gap. That's what CivicSim is built to close.

---

## Slide 5 · Introducing CivicSim  ·  ~55 sec

That brings us to what we actually built. CivicSim, at its core, is pretty simple to describe. You pick a U.S. location. Could be a county, eventually any state or city. You pick a policy question. And we run a synthetic electorate that actually looks like the place you picked. Same demographics, same intersectional structure, same opinion patterns you'd find if you really polled there.

There are three pillars holding the whole thing up. They map one-to-one with the three problems I just walked through. So I'll just call out what each one does.

**Pillar one, on the left, is representative population.** Every single agent we generate is sampled from real U.S. Census microdata. We're working with 2.5 million records. And the distributions we sample match the actual demographics of wherever you picked.

**Pillar two, in the middle, is policy-specific grounding.** Every agent doesn't just have demographics. It carries an empirical opinion prior built from 38,449 real Pew survey respondents. So when an agent reasons about a policy, it's not the LLM guessing what a 30-year-old Black woman from Oakland might think. It's the LLM conditioned on what people like that have actually said in real surveys.

**Pillar three is that every persona is fully inspectable.** You can drill into any agent and see its demographics, its prior, its stance, and its reasoning chain. All of that is saved per simulation run.

One thing I want to emphasize on this slide. We're not promising perfect prediction. We can't tell you who's going to win an election. The goal is representative, transparent simulation. So policymakers can stress-test their ideas before they ship to the real world.

---

## Slide 6 · Architecture & Technical Deep Dive  ·  ~65 sec

Quick technical detour for the engineers in the room. This is roughly how the system is built. Walking through the diagram from top to bottom.

At the top, you've got a standard web browser. That's how users actually interact with CivicSim. They hit the site, which loads our **Next.js frontend** running on Vercel. The frontend is mostly a thin layer. It does local state, the UI, the visualization. It proxies API calls back to our backend.

The backend is where the interesting stuff happens. We're running **FastAPI on Fly.io.** It's the orchestration layer. It takes a request from the user, figures out which downstream services to call, and assembles the result.

Underneath the API, you've got three core services that the backend coordinates. The first is the **agent sampler.** That's the piece that generates synthetic people. It uses a probabilistic largest-remainder algorithm to make sure the distributions match what the census tells us about the location.

The second service is the **prior lookup.** Given an agent's demographics, this returns the historical opinion distribution. Basically, given someone matches these traits, here's what people like them have said about this kind of question. We use sparse-cell backoff when an exact demographic combination doesn't exist in the data.

The third service is the **LLM client.** We've built it to be model-agnostic. Works with OpenAI, Anthropic, or any local model.

The data layer at the bottom is what powers all of this. ACS census, Pew priors, and external LLM providers.

One detail worth flagging. The whole pipeline uses **Server-Sent Events** to stream responses back to the frontend. So when you're watching a simulation run, you're seeing agents arrive in real time as they're being generated. That matters for the transparency story. Users see the system thinking, not a finished result.

---

## Slide 7 · At a Glance  ·  ~55 sec

Okay, enough engineering. Let me show you what this actually looks like for an end user. Because the whole product really does boil down to three steps, and we wanted to make this visual.

**Step one is on the left. You start with a policy.** Whatever you want to test. Here we've got a real example. A federal 20 dollar minimum wage proposal. You drop it in, and CivicSim automatically tags the relevant domains. In this case, economy and labor, because the system figured out the policy touches both.

**Step two is in the middle, on the purple card. CivicSim does the work.** Behind the scenes, we're generating 5,000 census-grounded agents, attaching opinion priors to each one, and running the whole simulation. From your perspective as a user, the relevant number is on the screen. It takes about **5 seconds.** Compare that to traditional polling, where you're looking at weeks to recruit, run, and analyze. So this is roughly four orders of magnitude faster.

**Step three, on the right, is where the value lands. You get instant insights.** The aggregate breakdown is at the top. 59 percent support, 27 percent oppose, 14 percent unsure. But the really interesting stuff is below that, in the subgroup breakdowns.

Look at the age split. 75 percent of people aged 18 to 29 support this policy. But only 38 percent of people over 65 do. That's almost a 40-point gap based on a single demographic axis. And that's exactly the kind of subgroup divergence policymakers need to see before they ship something. It's basically impossible to surface at this resolution from a traditional poll.

---

## Slide 8 · Live Demo  ·  ~3 to 4 min

Alright. Enough abstract talk. Let me actually show you this thing live.

What I'm going to do is submit a real policy question, and we'll watch what happens in real time.

*(Submit your rehearsed question. For example, "Should the federal minimum wage be raised to 20 dollars?" Choose Alameda County or whichever location you've rehearsed with.)*

So the first thing you'll see is the population sample being constructed. Look at this list of agents on the left. These aren't random people. These are demographics drawn directly from the census for Alameda County. You can see the age distribution, the race distribution, the income spread. That matches what you'd actually find if you went door to door in Alameda today.

Now I'll kick off the simulation. Watch the right pane. *(Agents start streaming in.)*

You can see agents are coming in live now. Each one with their demographics, their opinion prior, the LLM's stance for them, and the reasoning. It's not waiting for the whole batch to finish. You're seeing the simulation think.

Let me drill into one. *(Click into a persona that diverges from the majority.)* Notice this one. 67-year-old retired homeowner from Berkeley. Their reasoning here is different from the average. They're saying, and I'm reading directly from the model's output, that they're worried about small business impact. The interesting thing is, our system actually knows that this demographic profile in real Pew data did skew this way. So the agent isn't pulling that opinion out of thin air. It's reflecting an empirical pattern.

*(Wrap up demo.)* And all of that took about 5 seconds. Now I'll take you through what just happened, technically.

**Backup plan.** If the live demo fails, switch to the pre-recorded video in the second tab. Don't apologize. Just say "let me show you a recorded version" and move on.

---

## Slide 9 · How It Works  ·  ~70 sec (click-through reveal)

Okay, so let me actually walk through what the system just did, step by step. There are four phases to every simulation, and I'm going to reveal them one at a time so we can talk about each.

*(Reveal step 1.)* The first thing the system does is **sample.** We build N agents. Could be 200, could be 5,000. They match the demographic profile of the location you picked. So if you picked Alameda County, we're literally generating 200 imaginary residents whose age, income, race, and education distributions all match what the census says actually lives there. We use a stratified algorithm called largest-remainder that's been used in election apportionment for decades. It just guarantees the proportions come out right.

*(Reveal step 2.)* The second step is what we call **prime.** This is the magic step. Most simulation pipelines skip this entirely, and it's the biggest reason their results are unreliable. What we're doing is attaching an opinion prior to each agent. Concretely. Given that this agent has these demographic traits, here's how people like them have historically answered questions in this policy domain. That prior comes from real survey data. We're not asking the LLM to guess.

*(Reveal step 3.)* Third step. **Simulate.** Now the LLM generates a stance and a rationale for each agent, conditioned on both their demographics and their opinion prior. So you get not just yes or no. You get the reasoning chain. Why this person, with their background, supports or opposes this specific policy.

*(Reveal step 4.)* And fourth. **Aggregate.** We stream the results live, and we surface where groups diverge. So you don't just see 68 percent support. You see that renters and homeowners disagree sharply on this question, or that the urban-rural split is way bigger than the partisan split, or whatever the actual signal is.

You'll notice the boxes get progressively darker. That's intentional. It's our visual way of showing how each step deepens the synthesis.

---

## Slide 10 · The Data Foundation  ·  ~55 sec

Quick word on where the data comes from. Because if you don't trust the data, none of the rest of this matters.

We're using two datasets. Both are completely public, both are gold-standard in policy research, and both have been used in academic work for decades. The cards on the slide show what they are.

The first one, on the left, is the **American Community Survey.** The ACS. This is the Census Bureau's annual survey that gives us roughly 2.5 million adult records every year. We access it through IPUMS, which is the standard interface used by researchers. The reason we picked ACS specifically, and this is important, is that it's the only public source that gives us joint demographic distributions at population scale. Most simulations work with marginal distributions. Which means they know how many people are, say, Black, and how many people are low-income, but not how many people are both. ACS preserves those intersectional combinations. That's huge for representation.

The second dataset, on the right, is the **Pew American Trends Panel.** This is a probability-based survey panel that's been running since 2014. 38,449 validated respondents across 80-plus waves from 2021 to 2024. Consistent methodology, broad topic coverage. We took the raw responses and compiled them into a compact opinion-prior lookup. Importantly, no personally identifying information. Everything is aggregated.

So census gives us the *who.* Who actually lives in a place. Pew gives us *what they think.* About policies, government, social issues. Our actual contribution isn't either dataset individually. It's how we combine them, and how we let the data tell us which demographic variables matter most for which policy domain.

---

## Slide 11 · Experimentation & Results  ·  ~80 sec  ★ KEY SLIDE

This is the slide that, if you remember nothing else from our presentation, this is the one we want you to remember. Because it's the experimental result that justifies everything else we just told you.

We ran what we think is the most exhaustive variable-selection experiment that's been done in this space. We looked at **1,426 different opinion items** across 14 policy domains. For each one, we tested every combination of seven demographic variables. That's 127 combinations per question. So we ran somewhere around 180,000 mini-experiments to get this number.

The baseline number, on the far left, **10.6 percent.** That's what you get if you ground your simulation using textbook demographics. Age, income, education. The variables every research team starts with. That captures 10.6 percent of the variance in opinion across this dataset.

The middle number, **25.2 percent.** That's what we get when we use our empirical approach. We let the data tell us which variables actually matter for each policy domain. Different variables for tech policy than for immigration policy than for healthcare. And the answer is two and a half times better. Same models. Same compute. Just smarter conditioning.

The right number, the **2.4×**, is just expressing that as a ratio. We're not making a marginal improvement here. We're more than doubling the explanatory power, while changing literally nothing about the LLM. That's the punchline of our research.

Now I want to flag the line at the bottom of the slide. **Census division** is basically a geographic variable. Which region of the country you live in. It turns out that variable drives a **53.5 percent signal drop** when you remove it. So it's the single most important variable in the dataset for explaining opinion variance. And yet, almost every conventional approach skips it entirely, because intuitively it doesn't feel like it should matter that much. The variable we'd most naturally skip is the variable we most need. That's the methodological insight we want to leave with you.

---

## Slide 12 · Voice of Users  ·  ~50 sec

We didn't just measure CivicSim with experiments. We also took it out into the world and showed it to actual policy researchers and AI researchers, to get their feedback.

The "tested with" bar at the top shows where we've taken it. People at the **Goldman School of Public Policy** here at Berkeley, the **Possibility Lab**, also Berkeley, **Stanford's Human-Centered AI Institute**, our own home at the **School of Information**, and the **BAIR lab.**

What we kept hearing, across these very different institutions, was that the thing that mattered to them most was transparency. Let me share a couple of quotes. They're on the cards below.

From one of the researchers at Goldman. *"The transparency is the part that matters. I can defend a recommendation when I can show how the population was constructed."* That's exactly the auditability gap that competitor tools don't fill.

From the Possibility Lab. *"We've been waiting for something that takes subgroup representation seriously. This is the methodological bar academic work requires."*

And maybe my favorite one, from a PhD candidate at Stanford. *"The empirical variable selection result changes how I'd design the next study. Not just how I'd run a simulation."* Which is a much bigger claim. It's saying our methodology has implications beyond the simulation use case itself.

We're not claiming product-market fit yet. But we have signal from people whose opinions in this space carry real weight.

---

## Slide 13 · Limits & What's Next  ·  ~60 sec

Now we want to be really honest about what CivicSim is, and what it isn't. Because in policy work, overclaiming is worse than underclaiming.

The slide has three cards. The first two are limits. The third one, in green on the right, is where we're going.

**On the data side.** Our version one currently covers exactly one county. Alameda County in California. So geographically, we're early. Some survey time periods are sparse because Pew didn't ask certain questions in certain waves. And the smallest intersectional subgroups, think rural Black women under 25 with graduate degrees, those cells are still thin in the data. We use backoff strategies, but it's a real limitation.

**On the simulation side.** CivicSim gives you what we call directional realism. We're not predicting election outcomes. We're not telling you exactly what the support percentage will be when the policy ships. We're telling you the structure of disagreement. Who supports, who opposes, why, and where the subgroups diverge. That's a different and we think more useful claim, but it's important to be clear about it. We also don't yet model opinion dynamics over time. Political opinions change, and our system doesn't yet capture that.

**Where we're going from here.** We're working on expanding to multi-state and eventually national coverage. We're starting longitudinal validation against real policy outcomes. And we're planning to open-source the variable-selection toolkit, so other research groups can use the methodology.

The most important sentence on this whole slide is at the bottom, in the warning box. **Representative simulations support decision-making. They never replace the actual voices of real communities.**

---

## Slide 14 · Close + Q&A  ·  ~30 sec

And that's CivicSim. **Ground it before you simulate it.**

It's live right now at **civicsim.xyz**. Please try it yourself. Run a policy question against any U.S. location we support. We'd love your feedback. We'd love to hear your hardest, weirdest policy questions. And we'd love a conversation about where this goes from here. Both technically, and in terms of who we should be talking to next.

Thank you for listening. Happy to take questions.

*(Stage tip. Pause after "thank you." Don't rush into Q and A. Make eye contact. Then say something like "happy to take questions, and the demo is open on the screen if anyone wants to try a question afterwards." Keep this slide on screen during Q and A.)*

---

## Anticipated Q&A · Have Ready

**Q: How is this different from Aaru, Ditto, or Simile?**
- Demographic grounding from Census joint distributions, every persona inspectable, designed for decision-grade work, not just commerce.

**Q: How do you validate this is "representative"?**
- Marginal distributions match Census exactly via largest-remainder sampling. We can show the validation plots.

**Q: What happens for novel policies the model has no prior on?**
- Sparse-cell backoff. We drop the least informative dimension until we find a match. We always return some prior unless the question is entirely novel.

**Q: Is this just polling with extra steps?**
- No. Polling is expensive, slow, and limited in subgroup resolution. CivicSim is a complement. Directional, fast, and inspectable per persona.

**Q: What about demographics not in the data?**
- We're bounded by ACS coverage. We name this in our limits slide.

**Q: Why not just fine-tune the LLM?**
- Fine-tuning bakes priors in opaquely. We keep the prior data-grounded and explicit, so the system stays auditable.

---

## Tactical Reminders

- **Eye contact** with the panel chair every ~30 seconds.
- **Pause** after each big stat (10.6%, 25.2%, 2.4×).
- **Don't apologize** for limitations. Name them confidently.
- **Have your laptop charged** plus adapter ready.
- **Pre-load the demo** in a separate browser window so the click is one tab-switch.
- **Phone on silent.**
- During presentation: **press N** in the HTML deck to show or hide the live narration overlay.
