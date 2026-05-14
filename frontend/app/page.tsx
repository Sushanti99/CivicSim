import Image from "next/image";
import Link from "next/link";

const STATS = [
  { value: "38,449", sub: "Real Respondents" },
  { value: "2.5M", sub: "Census Records" },
  { value: "94%", sub: "Demographic Coverage" },
  { value: "2.4×", sub: "Better Signal" },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Partners />
        <Overview />
        <Architecture />
        <Findings />
        <Policymakers />
        <Framework />
        <Paper />
      </main>
      <Footer />
    </>
  );
}

function Nav() {
  return (
    <nav>
      <div className="nav-inner">
        <Link href="/" className="nav-logo">
          <span className="logo-mark">◇</span>
          <span className="logo-text">CivicSim</span>
        </Link>
        <div className="nav-links">
          <a href="#overview">Overview</a>
          <a href="#findings">Findings</a>
          <a href="#policymakers">Policymakers</a>
          <a href="#framework">Framework</a>
          <a href="#paper">Paper</a>
          <Link href="/simulations">Simulations</Link>
          <a
            href="https://github.com/Sushanti99/CivicSim"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github"
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
    <header className="hero">
      <div className="hero-inner">
        <div className="hero-meta">
          <span className="meta-pill">
            <span className="pill-dot" />
            UC BERKELEY · CAPSTONE 2026
          </span>
        </div>
        <h1 className="hero-title">
          Ground it before
          <br />
          you simulate it.
        </h1>
        <p className="hero-subtitle">
          <strong className="hero-hook">What if you could predict public opinion on any policy in seconds?</strong>
          <span className="hero-sub-line">
            CivicSim stress-tests policy ideas against a population that actually looks like America.
          </span>
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/simulate">
            <span>Launch simulator</span>
            <span className="arrow">→</span>
          </Link>
          <a className="btn btn-ghost" href="#findings">
            View findings
          </a>
        </div>

        <div className="hero-stats">
          {STATS.map((stat) => (
            <div className="hstat" key={stat.sub}>
              <span className="hstat-value">{stat.value}</span>
              <span className="hstat-sub">{stat.sub}</span>
            </div>
          ))}
        </div>

        <div className="hero-demo">
          <div className="hero-demo-frame">
            <Image
              src="/assets/demo-simulator.gif"
              alt="CivicSim simulator demo"
              width={900}
              height={506}
              unoptimized
              priority
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

const PARTNERS = [
  { name: "Stanford University",               src: "/assets/logos/stanford2.png",       w: 160, h: 107 },
  { name: "Possibility Lab",                   src: "/assets/logos/possibility-lab.svg", w: 48,  h: 48, label: "Possibility Lab" },
  { name: "UC Berkeley BAIR Lab",              src: "/assets/logos/bair.png",            w: 150, h: 80  },
  { name: "Goldman School of Public Policy",   src: "/assets/logos/ucb-seal.svg",        w: 64,  h: 64, label: "Goldman School\nof Public Policy" },
  { name: "UC Berkeley School of Information", src: "/assets/logos/ischool-color.png",   w: 200, h: 14  },
];

function Partners() {
  return (
    <div className="partners-strip">
      <p className="partners-label">Interviewing &amp; collaborating with · Ongoing user testing</p>
      <div className="partners-logos">
        {PARTNERS.map((p) => (
          <div key={p.name} className="partner-logo">
            {"label" in p ? (
              <div className="partner-composite">
                <Image src={p.src} alt={p.name} width={p.w} height={p.h} style={{ objectFit: "contain" }} />
                <span className="partner-composite-label">{p.label}</span>
              </div>
            ) : (
              <Image
                src={p.src}
                alt={p.name}
                width={p.w}
                height={p.h}
                style={{ objectFit: "contain", maxWidth: "100%", height: "auto" }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHead({ number, label }: { number: string; label: string }) {
  return (
    <div className="section-head">
      <span className="section-num">{number}</span>
      <span className="section-kicker">{label}</span>
    </div>
  );
}

function Overview() {
  const traditional = [
    "Generic AI prompts like “simulate a 35-year-old voter.”",
    "Survey-only data that systematically excludes rural and intersectional groups.",
    "One-size-fits-all demographics for every policy domain.",
    "Captures only 10.6% of available opinion signal.",
  ];
  const civicsim = [
    "Samples from 2.5M ACS Census records to match real U.S. demographics.",
    "Conditions AI agents with validated Pew ATP opinion priors.",
    "Domain-specific conditioning: geography matters for immigration, not tech.",
    "Captures 25.2% of opinion signal with empirically selected variables.",
  ];
  return (
    <section id="overview" className="section section-centered">
      <div className="container">
        <SectionHead number="01" label="Overview" />
        <h2 className="section-title">A simulated population is only useful if it&apos;s the right one.</h2>
        <p className="section-intro overview-intro">
          If the modeled people are off, the policy readout is off. CivicSim closes that gap.
        </p>
        <div className="approach-grid">
          <div className="approach-card approach-card-bad">
            <div className="approach-tag approach-tag-bad">TRADITIONAL APPROACH</div>
            <ul className="approach-list">
              {traditional.map((item) => (
                <li key={item}>
                  <IconCross />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="approach-card approach-card-good">
            <div className="approach-tag approach-tag-good">CIVICSIM APPROACH</div>
            <ul className="approach-list">
              {civicsim.map((item) => (
                <li key={item}>
                  <IconCheck />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="proof-banner">
          <div className="proof-banner-item">
            <div className="proof-num">2.4×</div>
            <p>more opinion signal captured vs. conventional methods</p>
          </div>
          <div className="proof-banner-divider" />
          <div className="proof-banner-item">
            <div className="proof-num">94%</div>
            <p>demographic coverage including systematically excluded groups</p>
          </div>
          <div className="proof-banner-divider" />
          <div className="proof-banner-item">
            <div className="proof-num">38k</div>
            <p>validated survey respondents informing AI agents</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function IconCheck() {
  return (
    <svg className="icn icn-check" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" />
      <path d="M7 12.5l3.2 3.2L17 9" />
    </svg>
  );
}

function IconCross() {
  return (
    <svg className="icn icn-cross" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </svg>
  );
}

function Architecture() {
  return (
    <section id="architecture" className="section section-alt section-centered">
      <div className="container">
        <SectionHead number="02" label="Architecture" />
        <h2 className="section-title">Two grounding streams. One simulated voter.</h2>
        <p className="section-intro">
          One stream answers <em>who</em> a person is. The other answers <em>what</em> they tend to believe.
          Together they produce agents that behave like real populations, not stereotypes.
        </p>
        <div className="stream-grid">
          <div className="stream-card stream-card-structural">
            <div className="stream-kicker"><span className="legend-dot legend-amber" />Structural stream</div>
            <h3>Who is represented</h3>
            <p>Draws agents directly from <strong>2.5M ACS Census records</strong> so every demographic combination reflects the real U.S. population.</p>
          </div>
          <div className="stream-card stream-card-behavioral">
            <div className="stream-kicker"><span className="legend-dot legend-violet" />Behavioral stream</div>
            <h3>How opinions are seeded</h3>
            <p>Seeds each agent with <strong>Pew ATP survey priors</strong> and empirically chosen variables, so opinions follow observed patterns.</p>
          </div>
        </div>
        <figure className="arch-fig">
          <div className="arch-frame">
            <Image
              src="/assets/figures/architecture.png"
              alt="CivicSim architecture diagram"
              width={1600}
              height={560}
              priority
            />
          </div>
          <figcaption>
            The structural stream builds the person. The behavioral stream gives them an opinion shape. Both feed every simulated response.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Findings() {
  return (
    <section id="findings" className="section section-centered">
      <div className="container">
        <SectionHead number="03" label="Empirical Findings" />
        <h2 className="section-title">Three failures, three corrections.</h2>

        <article className="study">
          <div className="study-header">
            <span className="study-tag">STUDY 01</span>
            <h3>The survey is not the population.</h3>
            <p className="study-lede">
              Post-stratification weighting corrects marginal demographic distributions, but not
              joint distributions in sparse, systematically excluded subgroups. Rural and
              intersectional populations face the largest representation gaps.
            </p>
          </div>
          <div className="study-body study-body-stack">
            <div className="stat-row">
              <BigStat value="0.321" unit="TVD" label="Young Black Americans (18-29): nearly 1/3 of mass lands in the wrong income bracket" />
              <BigStat value="0.303" unit="TVD" label="Rural × low-income geographic gap (Census Division)" />
              <BigStat value="14×" unit="baseline" label="Rural geographic misalignment vs. full-sample baseline" />
            </div>
            <p className="study-note study-note-center">
              <strong>TVD</strong> is the total variation distance between the survey and the real population. 0 means a perfect match; higher means bigger error. <strong>Baseline</strong> compares each subgroup&apos;s gap to the gap across the whole sample, so 14× means rural respondents are 14 times more misaligned than average.
            </p>
            <IncomeGapChart />
          </div>
        </article>

        <article className="study">
          <div className="study-header">
            <span className="study-tag">STUDY 02</span>
            <h3>Marginal rankings are the wrong selection tool.</h3>
            <p className="study-lede">
              We tested every possible combination of 7 demographic variables across 1,426 opinion items. The usual set that researchers pick (age, income, education) misses most of the signal. The best set isn&apos;t what ranking variables one-by-one suggests.
            </p>
          </div>
          <div className="study-body study-body-stack">
            <div className="ablation-row">
              <div className="ablation-col">
                <div className="comp-card comp-bad">
                  <div className="comp-head">
                    <span className="comp-label">CONVENTIONAL</span>
                    <span className="comp-set">{"{age, income, education}"}</span>
                  </div>
                  <div className="comp-num">10.6<span className="comp-pct">%</span></div>
                  <div className="comp-bar"><div className="comp-bar-fill" style={{ width: "10.6%" }} /></div>
                  <div className="comp-foot">of full 7-variable joint signal</div>
                </div>
              </div>
              <div className="versus">vs.</div>
              <div className="ablation-col">
                <div className="comp-card comp-good">
                  <div className="comp-head">
                    <span className="comp-label">GREEDY OPTIMAL</span>
                    <span className="comp-set">{"{race, location, age}"}</span>
                  </div>
                  <div className="comp-num">25.2<span className="comp-pct">%</span></div>
                  <div className="comp-bar"><div className="comp-bar-fill comp-bar-good" style={{ width: "25.2%" }} /></div>
                  <div className="comp-foot">of full 7-variable joint signal</div>
                </div>
              </div>
            </div>
            <div className="viz-grid">
              <div className="viz-card">
                <div className="viz-head">
                  <h4>Ablation: how fast does coverage grow?</h4>
                  <p>Add one variable at a time. The greedy path picks the most useful variable next; the conventional path picks textbook variables. Greedy gets there twice as fast.</p>
                </div>
                <AblationChart />
                <div className="viz-foot">Variables added →</div>
              </div>
              <div className="viz-card">
                <div className="viz-head">
                  <h4>Leave-one-out: which variable hurts most when removed?</h4>
                  <p>Pull each variable out of the full set and see how much signal disappears. The biggest drop is the most essential variable.</p>
                </div>
                <LOOChart />
              </div>
            </div>
            <div className="loo-callout">
              <div className="loo-num">-53.5<span className="loo-pct">%</span></div>
              <div className="loo-text">
                <strong>The structural failure.</strong> Drop Census division from the full set and opinion signal collapses by 53.5%, the biggest hit of any variable. Yet on a marginal ranking it&apos;s only third, so the textbook approach leaves it out entirely.
              </div>
            </div>
          </div>
        </article>

        <article className="study">
          <div className="study-header">
            <span className="study-tag">STUDY 03</span>
            <h3>Geography is domain-specific, not universal.</h3>
            <p className="study-lede">
              Once you condition on demographics, do opinions still vary by region? For most domains, no. People&apos;s views pool nationally and you can skip geography. International affairs is the exception. And young respondents need geography almost everywhere.
            </p>
            <p className="study-note">
              The numbers below are <strong>Jensen-Shannon distance</strong> after demographic conditioning. Lower means opinions transfer cleanly across regions. Higher means a Texan and a Vermonter still disagree even after accounting for demographics.
            </p>
          </div>
          <div className="study-body study-body-stack">
            <div className="domain-grid">
              <DomainCol title="not needed" tone="not" tag="tag-not" desc="Pool nationally after demographic conditioning." items={[["Technology", "0.119"], ["Environment / Climate", "0.119"]]} />
              <DomainCol title="optional" tone="opt" tag="tag-opt" desc="Include for sensitive analyses; required for young agents." items={[["Health", "0.129"], ["Family & Society", "0.134"], ["Economy", "0.135"], ["Religion", "0.141"], ["Politics & Government", "0.142"], ["Race & Inequality", "0.145"], ["Immigration", "0.150"]]} />
              <DomainCol title="required" tone="req" tag="tag-req" desc="Geographic conditioning is mandatory. Views covary with local immigrant community composition." items={[["International", "0.174"]]} required />
            </div>
            <div className="age-callout">
              <div className="age-num">+70<span className="age-pct">%</span></div>
              <div className="age-text">
                <strong>The age modifier.</strong> For 18-29 year olds, geographic variation is up to 70% higher than for older cohorts, in every income tier and every domain. If you&apos;re simulating young Americans, tier geography <em>up by one</em> regardless of what the domain table says.
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function Policymakers() {
  return (
    <section id="policymakers" className="section section-alt section-centered">
      <div className="container">
        <SectionHead number="04" label="Built For Policymakers" />
        <h2 className="section-title">Built for policymakers.</h2>
        <p className="section-intro">
          Understand public opinion before you propose, test messaging before you communicate,
          and identify support gaps before they become problems.
        </p>
        <div className="policy-grid">
          <PolicyCard
            tone="blue"
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 14a4 4 0 110-8 4 4 0 010 8zm8 0a3 3 0 110-6 3 3 0 010 6zM2 21a6 6 0 0112 0H2zm12 0a6 6 0 014-5.66A6 6 0 0122 21H14z" />
              </svg>
            }
            title="Pre-Proposal Testing"
            body="Test policy ideas before committing resources. Understand which demographics support or oppose your proposal."
            example="Universal healthcare, minimum wage increase, housing reform"
          />
          <PolicyCard
            tone="violet"
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 21V9h4v12H4zm6 0V3h4v18h-4zm6 0v-7h4v7h-4z" />
              </svg>
            }
            title="Message Testing"
            body="Compare different framings of the same policy to find messaging that resonates across demographic groups."
            example={`Climate policy as "jobs program" vs. "environmental protection"`}
          />
          <PolicyCard
            tone="green"
            icon={
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 17l6-6 4 4 8-8v6h-2V10.4l-6 6-4-4-4.6 4.6L3 17z" />
              </svg>
            }
            title="Coalition Building"
            body="Identify which demographic groups are most supportive and where you need to address concerns or build awareness."
            example="Finding unexpected allies or opposition segments"
          />
        </div>
        <div className="trust-banner">
          <div className="trust-banner-grid">
            <div className="trust-left">
              <span className="trust-eyebrow">TRUSTED BY</span>
              <h3>Municipal, State, and Federal Agencies</h3>
              <p>
                CivicSim&apos;s demographically grounded approach means you&apos;re not just getting an AI&apos;s
                opinion. You&apos;re getting predictions based on empirical census data and validated opinion research.
              </p>
              <div className="trust-stats">
                <div className="trust-stat">
                  <div className="trust-stat-num">94.2%</div>
                  <div className="trust-stat-label">Demographic Coverage</div>
                </div>
                <div className="trust-stat">
                  <div className="trust-stat-num">±1.4%</div>
                  <div className="trust-stat-label">Margin of Error</div>
                </div>
                <div className="trust-stat">
                  <div className="trust-stat-num">38k+</div>
                  <div className="trust-stat-label">Validated Respondents</div>
                </div>
              </div>
            </div>
            <div className="trust-right">
              <div className="trust-card">
                <div className="trust-card-title">How CivicSim differs</div>
                <ul className="trust-list">
                  {[
                    ["Census-grounded sampling", "vs. survey-only or generic prompting"],
                    ["Empirically selected variables", "vs. conventional demographics only"],
                    ["Domain-specific conditioning", "vs. one-size-fits-all approach"],
                  ].map(([h, sub]) => (
                    <li key={h}>
                      <span className="trust-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7" /></svg>
                      </span>
                      <div>
                        <strong>{h}</strong>
                        <span>{sub}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link className="trust-cta" href="/simulate">
                  <span className="trust-cta-icon">▶</span>
                  <span>Try the Simulator</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PolicyCard({
  tone,
  icon,
  title,
  body,
  example,
}: {
  tone: "blue" | "violet" | "green";
  icon: React.ReactNode;
  title: string;
  body: string;
  example: string;
}) {
  return (
    <div className={`policy-card policy-card-${tone}`}>
      <div className="policy-icon">{icon}</div>
      <h3>{title}</h3>
      <p className="policy-body">{body}</p>
      <p className="policy-example"><strong>Example:</strong> {example}</p>
    </div>
  );
}

function AblationChart() {
  const greedy = [
    { v: 0, name: "start" },
    { v: 12, name: "+race" },
    { v: 19, name: "+location" },
    { v: 23, name: "+age" },
    { v: 25, name: "+income" },
    { v: 25.2, name: "+education" },
  ];
  const conventional = [
    { v: 0, name: "start" },
    { v: 5.5, name: "+age" },
    { v: 8.4, name: "+income" },
    { v: 10.6, name: "+education" },
    { v: 10.6, name: "+gender" },
    { v: 10.6, name: "+religion" },
  ];
  const max = 30;
  const W = 360;
  const H = 240;
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 24;
  const PAD_B = 36;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const x = (i: number, n: number) => PAD_L + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;
  const line = (arr: { v: number }[]) =>
    arr.map((p, i) => `${x(i, arr.length)},${y(p.v)}`).join(" ");
  const yTicks = [0, 10, 20, 30];
  return (
    <div className="ablation-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="ac-svg" role="img" aria-label="Ablation curve">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} className="ac-grid-line" />
            <text x={PAD_L - 8} y={y(t) + 3} textAnchor="end" className="ac-axis-text">{t}%</text>
          </g>
        ))}
        <polyline points={line(conventional)} className="ac-line ac-line-bad" />
        <polyline points={line(greedy)} className="ac-line ac-line-good" />
        {greedy.map((p, i) => (
          <g key={`g${i}`}>
            <circle cx={x(i, greedy.length)} cy={y(p.v)} r={3.5} className="ac-dot-good" />
            {i > 0 && (
              <text x={x(i, greedy.length)} y={y(p.v) - 10} textAnchor="middle" className="ac-pt-label ac-pt-good">
                {p.name}
              </text>
            )}
          </g>
        ))}
        {conventional.map((p, i) => (
          <g key={`c${i}`}>
            <circle cx={x(i, conventional.length)} cy={y(p.v)} r={3.5} className="ac-dot-bad" />
            {i > 0 && (
              <text x={x(i, conventional.length)} y={y(p.v) + 14} textAnchor="middle" className="ac-pt-label ac-pt-bad">
                {p.name}
              </text>
            )}
          </g>
        ))}
        <text x={PAD_L + innerW / 2} y={H - 6} textAnchor="middle" className="ac-axis-text">Variables added →</text>
      </svg>
      <div className="ac-legend">
        <span><i className="dot dot-good" /> Greedy optimal (race → location → age)</span>
        <span><i className="dot dot-bad" /> Conventional (age → income → education)</span>
      </div>
    </div>
  );
}

function IncomeGapChart() {
  const data = [
    { label: "<$30k", acs: 19, atp: 28 },
    { label: "$30-40k", acs: 7, atp: 10 },
    { label: "$40-50k", acs: 8, atp: 9 },
    { label: "$50-60k", acs: 8, atp: 7 },
    { label: "$60-70k", acs: 8, atp: 7 },
    { label: "$70-80k", acs: 7, atp: 5 },
    { label: "$80-90k", acs: 6, atp: 4 },
    { label: "$90-150k", acs: 18, atp: 13 },
    { label: ">$150k", acs: 19, atp: 17 },
  ];
  const max = 30;
  return (
    <figure className="custom-fig">
      <div className="fig-frame fig-frame-light">
        <div className="fig-title">Income distribution: real U.S. (ACS) vs. weighted survey (Pew ATP)</div>
        <div className="income-chart">
          {data.map((d) => (
            <div key={d.label} className="ic-col">
              <div className="ic-bars">
                <div className="ic-bar ic-bar-atp" style={{ height: `${(d.atp / max) * 100}%` }} title={`ATP ${d.atp}%`}>
                  <span className="ic-bar-val">{d.atp}</span>
                </div>
                <div className="ic-bar ic-bar-acs" style={{ height: `${(d.acs / max) * 100}%` }} title={`ACS ${d.acs}%`}>
                  <span className="ic-bar-val">{d.acs}</span>
                </div>
              </div>
              <div className="ic-label">{d.label}</div>
            </div>
          ))}
        </div>
        <div className="ic-legend">
          <span><i className="dot dot-atp" /> Survey respondents (Pew ATP, weighted)</span>
          <span><i className="dot dot-acs" /> Real U.S. population (ACS Census)</span>
        </div>
      </div>
      <figcaption>
        Weighting fixes the easy gaps but still over-represents low-income (~$30k) respondents by nearly 9 points. The mismatch concentrates in groups that are hardest to recruit.
      </figcaption>
    </figure>
  );
}

function LOOChart() {
  const rows: { name: string; drop: number; highlight?: boolean }[] = [
    { name: "Census division", drop: 53.5, highlight: true },
    { name: "Race", drop: 38.2 },
    { name: "Age", drop: 27.1 },
    { name: "Income", drop: 18.4 },
    { name: "Education", drop: 12.6 },
    { name: "Gender", drop: 7.1 },
    { name: "Religion", drop: 4.3 },
  ];
  const max = 55;
  return (
    <div className="loo-chart">
      {rows.map((r) => (
        <div key={r.name} className={`loo-row ${r.highlight ? "loo-row-hi" : ""}`}>
          <span className="loo-name">{r.name}</span>
          <div className="loo-bar-track">
            <div className="loo-bar-fill" style={{ width: `${(r.drop / max) * 100}%` }} />
          </div>
          <span className="loo-val">-{r.drop}%</span>
        </div>
      ))}
    </div>
  );
}

function BigStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="big-stat">
      <span className="big-stat-num">{value}</span>
      <span className="big-stat-unit">{unit}</span>
      <span className="big-stat-label">{label}</span>
    </div>
  );
}

function Figure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="study-fig">
      <div className="fig-frame">
        <Image src={src} alt={alt} width={1200} height={680} />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function DomainCol({
  title,
  tone,
  tag,
  desc,
  items,
  required = false,
}: {
  title: string;
  tone: "not" | "opt" | "req";
  tag: string;
  desc: string;
  items: [string, string][];
  required?: boolean;
}) {
  return (
    <div className={`domain-col domain-col-${tone} ${required ? "domain-col-req" : ""}`}>
      <h4 className="dcol-title"><span className={`tag ${tag}`}>{title}</span></h4>
      <p className="dcol-desc">{desc}</p>
      <ul className="dcol-list">
        {items.map(([name, value]) => (
          <li key={name}>{name} <span className="dcol-num">{value}</span></li>
        ))}
      </ul>
    </div>
  );
}

function Framework() {
  return (
    <section id="framework" className="section section-alt section-centered">
      <div className="container">
        <SectionHead number="05" label="Framework" />
        <h2 className="section-title">Three corrective steps.</h2>
        <p className="section-intro">
          CivicSim operationalizes a single principle: the decision of <em>who</em> to simulate, and
          along which demographic axes, is an empirical question, not a design preference.
        </p>
        <div className="pipeline">
          <PipeStep n="STEP 01" icon="⬢" title="Draw agents from census microdata" body="Sample synthetic agents from ACS PUMS (~2.5M adult records per year) rather than survey sample data. Population representativeness becomes a property of the data, not a research question." tag="→ Validated by Study 01" />
          <div className="pipe-arrow">→</div>
          <PipeStep n="STEP 02" icon="◈" title="Select conditioning variables empirically" body="Run a leave-one-out or greedy IG ablation over the survey corpus for the target domains. Always include race and Census division, interaction-dominated signal cannot be recovered from marginal rankings." tag="→ Validated by Study 02" />
          <div className="pipe-arrow">→</div>
          <PipeStep n="STEP 03" icon="◇" title="Apply tiered geographic conditioning" body="Use the domain classification from Study 03 to determine whether geography is required, optional, or unnecessary. For young agents (18-29), tier up by one level regardless of domain." tag="→ Validated by Study 03" />
        </div>
      </div>
    </section>
  );
}

function PipeStep({ n, icon, title, body, tag }: { n: string; icon: string; title: string; body: string; tag: string }) {
  return (
    <div className="pipe-step">
      <div className="pipe-step-head">
        <span className="pipe-num">{n}</span>
        <span className="pipe-icon">{icon}</span>
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <div className="pipe-tag">{tag}</div>
    </div>
  );
}

function Paper() {
  return (
    <section id="paper" className="section section-centered">
      <div className="container">
        <SectionHead number="06" label="Paper" />
        <h2 className="section-title">Read the full work.</h2>
        <div className="paper-card">
          <div className="paper-card-inner">
            <div className="paper-meta">
              <span className="meta-pill paper-pill">
                <span className="pill-dot" />
                UC BERKELEY · CAPSTONE 2026
              </span>
            </div>
            <h3 className="paper-title">
              Ground It Before You Simulate It: The Case for Demographically Grounded LLM
              Simulations
            </h3>
            <p className="paper-abs">
              We argue that current LLM-based public opinion simulations are not approximations of a
              representative population but consistent, predictable distortions at the input level,
              and that fixing this is methodologically prior to all other concerns about LLM agent
              quality.
            </p>
            <p className="paper-authors-line">CivicSim Team · UC Berkeley</p>
            <div className="paper-actions">
              <a className="btn btn-primary" href="#">
                <span>Paper</span>
                <span className="arrow">→</span>
              </a>
              <a className="btn btn-ghost" href="https://github.com/Sushanti99/CivicSim" target="_blank" rel="noopener noreferrer">
                <span>GitHub repository</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="container footer-inner">
        <div className="footer-left">
          <span className="logo-mark">◇</span>
          <span className="logo-text">CivicSim</span>
        </div>
        <div className="footer-right">
          <span>UC Berkeley · 2026</span>
        </div>
      </div>
    </footer>
  );
}
