import Link from "next/link";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Findings />
        <Framework />
        <CTA />
        <Footer />
      </main>
    </>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/70 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-[color:var(--color-cyan)]">◇</span>
          <span>CivicSim</span>
        </Link>
        <div className="flex items-center gap-8 text-sm text-[color:var(--color-text-dim)]">
          <a href="#findings" className="hover:text-[color:var(--color-text)]">Findings</a>
          <a href="#framework" className="hover:text-[color:var(--color-text)]">Framework</a>
          <Link href="/simulate" className="hover:text-[color:var(--color-text)]">Simulator</Link>
          <a
            href="https://github.com/Sushanti99/CivicSim"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[color:var(--color-border-hi)] px-4 py-1.5 text-[color:var(--color-text)] hover:bg-white/5"
          >
            GitHub →
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="relative">
      <div className="mx-auto max-w-[1180px] px-8 pt-24 pb-32 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border-hi)] px-3 py-1 text-xs uppercase tracking-wider text-[color:var(--color-text-dim)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-cyan)]" />
          UC Berkeley · Capstone 2026
        </span>
        <h1 className="mx-auto mt-8 max-w-3xl text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Ground it before
          <br />
          you simulate it.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[color:var(--color-text-dim)]">
          A framework for demographically grounded LLM simulations of public opinion —
          replacing implicit assumptions with empirically validated design choices.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/simulate"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-cyan)] px-6 py-3 font-medium text-black transition hover:opacity-90"
          >
            Try the simulator <span>→</span>
          </Link>
          <a
            href="#findings"
            className="rounded-full border border-[color:var(--color-border-hi)] px-6 py-3 font-medium text-[color:var(--color-text)] hover:bg-white/5"
          >
            View findings
          </a>
        </div>

        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { label: "CORPUS", value: "79 waves", sub: "Pew ATP, 2021–2024" },
            { label: "RESPONDENTS", value: "38,449", sub: "unique panelists" },
            { label: "OPINION ITEMS", value: "1,426", sub: "across 10 policy domains" },
            { label: "CENSUS FRAME", value: "~2.5M / yr", sub: "ACS PUMS" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 p-5 text-left"
            >
              <div className="text-xs tracking-wider text-[color:var(--color-text-faint)]">
                {s.label}
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold text-[color:var(--color-cyan)]">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-[color:var(--color-text-dim)]">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function Findings() {
  const items = [
    {
      title: "Demographic alignment",
      body: "6 of 8 ACS↔ATP demographic axes show TVD < 0.05 — strong agreement between the agent-generation corpus and the opinion-sourcing corpus.",
    },
    {
      title: "Information saturation",
      body: "Joint conditioning on 3–4 demographic attributes captures most available opinion signal; party affiliation is consistently the single most informative.",
    },
    {
      title: "Cross-geography transfer",
      body: "Demographic-conditioned opinion distributions transfer across U.S. regions in most policy domains; a small set of localized topics need explicit geography.",
    },
  ];
  return (
    <section id="findings" className="py-24">
      <div className="mx-auto max-w-[1180px] px-8">
        <h2 className="text-3xl font-semibold md:text-4xl">Key findings</h2>
        <p className="mt-3 max-w-2xl text-[color:var(--color-text-dim)]">
          Three empirical results from the underlying experiments — see the paper for full
          methodology and ablations.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {items.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-6"
            >
              <div className="text-sm font-semibold text-[color:var(--color-violet)]">
                {it.title}
              </div>
              <p className="mt-3 text-[color:var(--color-text-dim)]">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Framework() {
  return (
    <section id="framework" className="py-24">
      <div className="mx-auto max-w-[1180px] px-8">
        <h2 className="text-3xl font-semibold md:text-4xl">How the simulator works</h2>
        <ol className="mt-12 space-y-6">
          {[
            ["1", "Sample a synthetic electorate", "Draw N agents from ACS-derived demographic distributions for a chosen U.S. location, stratified to match the population."],
            ["2", "Attach an empirical opinion prior", "For each agent, look up the Pew ATP-derived answer distribution conditioned on their demographic cell."],
            ["3", "Ground the LLM call", "Inject the prior into the system prompt — the LLM responds as that voter, anchored in real polling data, not its own implicit prior."],
            ["4", "Aggregate and report", "Tally per-agent stances and stream the resulting distribution back to you with per-agent rationales."],
          ].map(([n, t, b]) => (
            <li
              key={n}
              className="flex gap-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/40 p-6"
            >
              <div className="font-mono text-3xl font-semibold text-[color:var(--color-cyan)]">
                {n}
              </div>
              <div>
                <div className="font-semibold">{t}</div>
                <p className="mt-1 text-[color:var(--color-text-dim)]">{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-8 text-center">
        <h2 className="text-3xl font-semibold md:text-4xl">
          See it in action — Alameda County, CA
        </h2>
        <p className="mt-4 text-[color:var(--color-text-dim)]">
          The public demo ships with one location and a curated set of policy questions.
          Pick a question, generate 25 agents, and watch them respond.
        </p>
        <Link
          href="/simulate"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[color:var(--color-cyan)] px-6 py-3 font-medium text-black transition hover:opacity-90"
        >
          Open the simulator <span>→</span>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-[color:var(--color-border)] py-10 text-center text-sm text-[color:var(--color-text-faint)]">
      <div className="mx-auto max-w-[1180px] px-8">
        CivicSim · UC Berkeley Capstone 2026 ·{" "}
        <a
          href="https://github.com/Sushanti99/CivicSim"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[color:var(--color-text)]"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
