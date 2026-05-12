import Image from "next/image";
import Link from "next/link";

const STATS = [
  { label: "CORPUS", value: "79 waves", sub: "Pew ATP, 2021-2024" },
  { label: "RESPONDENTS", value: "38,449", sub: "unique panelists" },
  { label: "OPINION ITEMS", value: "1,426", sub: "across 10 policy domains" },
  { label: "CENSUS FRAME", value: "~2.5M / yr", sub: "ACS PUMS adults" },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Overview />
        <Architecture />
        <Findings />
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
          <a href="#framework">Framework</a>
          <a href="#paper">Paper</a>
          <Link href="/simulate">Simulator</Link>
          <Link href="/simulations">Runs</Link>
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
          A framework for demographically grounded LLM simulations of public opinion — replacing
          implicit assumptions with empirically validated design choices.
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
            <div className="hstat" key={stat.label}>
              <span className="hstat-label">{stat.label}</span>
              <span className="hstat-value">{stat.value}</span>
              <span className="hstat-sub">{stat.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </header>
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
  return (
    <section id="overview" className="section">
      <div className="container">
        <SectionHead number="01" label="Overview" />
        <h2 className="section-title">A simulated population is only useful if it&apos;s the right one.</h2>
        <div className="overview-grid">
          <div className="overview-text">
            <p>
              When a government tests a housing or minimum wage policy on a simulated population, the
              quality of those predictions depends on one thing: whether the simulated people match
              the real ones. We argue that <strong>without empirical demographic grounding, current
              LLM-based simulations of public opinion introduce systematic, measurable distortions
              into who is represented and whose preferences are modeled</strong> — distortions that
              are directional, not random, and that compound existing biases in LLM-internal opinion
              representations.
            </p>
            <p>
              CivicSim provides three empirical demonstrations of these distortions and proposes a
              corrective framework. Every demographic modeling decision is treated as an empirical
              question, not a design preference.
            </p>
          </div>
          <div className="overview-callouts">
            {[
              "The survey data conditioning today's LLM agents is not a faithful replica of the U.S. population.",
              "Conventional demographic variables capture less than 11% of the available opinion signal.",
              "Geographic conditioning is applied uniformly when its necessity varies sharply by domain.",
            ].map((item) => (
              <div className="callout" key={item}>
                <span className="callout-tag">PROBLEM</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section id="architecture" className="section section-alt">
      <div className="container">
        <SectionHead number="02" label="Architecture" />
        <h2 className="section-title">Two orthogonal grounding streams.</h2>
        <p className="section-intro">
          The structural stream draws agents from ACS Census microdata. The behavioral stream
          attaches opinion priors from Pew ATP, filtered by information-theoretic variable selection.
          Both fuse into a grounded persona that conditions every LLM call.
        </p>
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
            <span className="legend-dot legend-amber" />
            <strong>Structural stream</strong>: ACS PUMS → stratified draw → TVD-validated
            demographic profile <code>dᵢ</code>. &nbsp;&nbsp;
            <span className="legend-dot legend-violet" />
            <strong>Behavioral stream</strong>: Pew ATP → IG variable selection → geo-conditioned
            prior <code>P(y | d, q)</code>.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Findings() {
  return (
    <section id="findings" className="section">
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
          <div className="study-body">
            <div className="study-stats">
              <BigStat value="0.321" unit="TVD" label="Young Black Americans (18-29) income gap — nearly 1/3 of mass in the wrong bracket" />
              <BigStat value="0.303" unit="TVD" label="Rural × low-income geographic gap (Census Division)" />
              <BigStat value="14×" unit="baseline" label="Rural geographic misalignment vs. full-sample baseline" />
            </div>
            <Figure
              src="/assets/figures/fig_pop.png"
              alt="ACS vs ATP demographic distributions"
              caption="ACS (true U.S. population) vs. weighted Pew ATP across all eight demographic dimensions. Marginal weighting closes most gaps but cannot recover joint distributions in systematically excluded subgroups."
            />
          </div>
        </article>

        <article className="study">
          <div className="study-header">
            <span className="study-tag">STUDY 02</span>
            <h3>Marginal rankings are the wrong selection tool.</h3>
            <p className="study-lede">
              Information gain across all 127 non-empty subsets of 7 demographics × 1,426 opinion
              items shows the conventional conditioning set captures barely a tenth of available
              opinion signal — and that the most important variable in the joint ranks only third in
              marginal importance.
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
            <div className="loo-callout">
              <div className="loo-num">-53.5<span className="loo-pct">%</span></div>
              <div className="loo-text">
                <strong>The structural failure.</strong> Removing Census division from the full joint
                causes a 53.5% drop in opinion information gain — the largest unique contribution of
                any variable, despite its only-third marginal rank. Marginal rankings will reliably
                exclude the most important variable.
              </div>
            </div>
            <div className="study-figs-row">
              <Figure src="/assets/figures/fig_ablation.png" alt="Greedy vs conventional ablation curves" caption="Greedy-optimal (blue) vs. conventional (red) coverage by variable count." />
              <Figure src="/assets/figures/fig_loo.png" alt="Leave-one-out contribution by variable" caption="Leave-one-out drop in joint IG. Census division dominates." />
            </div>
          </div>
        </article>

        <article className="study">
          <div className="study-header">
            <span className="study-tag">STUDY 03</span>
            <h3>Geography is domain-specific — not universal.</h3>
            <p className="study-lede">
              We measured whether opinion distributions transfer across Census regions after
              demographic conditioning, using Jensen-Shannon distance. Most domains pool nationally;
              international affairs require explicit geographic conditioning. Young respondents need
              geography even where the domain doesn&apos;t.
            </p>
          </div>
          <div className="study-body study-body-stack">
            <div className="domain-grid">
              <DomainCol title="not needed" tag="tag-not" desc="Pool nationally after demographic conditioning." items={[["Technology", "0.119"], ["Environment / Climate", "0.119"]]} />
              <DomainCol title="optional" tag="tag-opt" desc="Include for sensitive analyses; required for young agents." items={[["Health", "0.129"], ["Family & Society", "0.134"], ["Economy", "0.135"], ["Religion", "0.141"], ["Politics & Government", "0.142"], ["Race & Inequality", "0.145"], ["Immigration", "0.150"]]} />
              <DomainCol title="required" tag="tag-req" desc="Geographic conditioning mandatory — views covary with local immigrant community composition." items={[["International", "0.174"]]} required />
            </div>
            <div className="age-callout">
              <div className="age-num">+70<span className="age-pct">%</span></div>
              <div className="age-text">
                <strong>The age modifier.</strong> Young respondents (18-29) exhibit up to 70% more
                geographic variation than older cohorts — across every income tier and every domain.
                For this group, geographic conditioning should be applied one tier more aggressively
                than the domain-level classification suggests.
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
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
  tag,
  desc,
  items,
  required = false,
}: {
  title: string;
  tag: string;
  desc: string;
  items: [string, string][];
  required?: boolean;
}) {
  return (
    <div className={`domain-col ${required ? "domain-col-req" : ""}`}>
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
    <section id="framework" className="section section-alt">
      <div className="container">
        <SectionHead number="04" label="Framework" />
        <h2 className="section-title">Three corrective steps.</h2>
        <p className="section-intro">
          CivicSim operationalizes a single principle: the decision of <em>who</em> to simulate, and
          along which demographic axes, is an empirical question, not a design preference.
        </p>
        <div className="pipeline">
          <PipeStep n="STEP 01" icon="⬢" title="Draw agents from census microdata" body="Sample synthetic agents from ACS PUMS (~2.5M adult records per year) rather than survey sample data. Population representativeness becomes a property of the data, not a research question." tag="→ Validated by Study 01" />
          <div className="pipe-arrow">→</div>
          <PipeStep n="STEP 02" icon="◈" title="Select conditioning variables empirically" body="Run a leave-one-out or greedy IG ablation over the survey corpus for the target domains. Always include race and Census division — interaction-dominated signal cannot be recovered from marginal rankings." tag="→ Validated by Study 02" />
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
    <section id="paper" className="section">
      <div className="container">
        <SectionHead number="05" label="Paper" />
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
              representative population but consistent, predictable distortions at the input level —
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
