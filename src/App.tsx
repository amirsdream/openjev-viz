import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import "./App.css";

type Scenario = {
  id: string;
  title: string;
  state: string;
};

const CHOICE_SCENARIOS: Scenario[] = [
  {
    id: "ticket",
    title: "Support ticket",
    state:
      "Customer: I was charged twice for order #4412 and nobody has replied for three days.",
  },
  {
    id: "ops",
    title: "Ops alert",
    state:
      "Prometheus: API p99 latency 2.4s for 12 minutes. Error rate steady at 0.2%.",
  },
  {
    id: "inbox",
    title: "Inbox",
    state:
      "Email: Can we move the design review to Thursday and send the Figma link?",
  },
];

const CHOICE_OPTIONS: Record<string, { id: string; label: string; p: number }[]> = {
  ticket: [
    { id: "billing", label: "Billing", p: 0.72 },
    { id: "shipping", label: "Shipping", p: 0.09 },
    { id: "technical", label: "Technical", p: 0.19 },
  ],
  ops: [
    { id: "billing", label: "Ignore", p: 0.08 },
    { id: "shipping", label: "Page on-call", p: 0.61 },
    { id: "technical", label: "Open ticket", p: 0.31 },
  ],
  inbox: [
    { id: "billing", label: "Calendar", p: 0.54 },
    { id: "shipping", label: "Design", p: 0.33 },
    { id: "technical", label: "Finance", p: 0.13 },
  ],
};

const NOUL_SCENARIOS: Scenario[] = [
  {
    id: "angry",
    title: "Angry customer?",
    state: "I was charged twice and nobody has replied for three days.",
  },
  {
    id: "save",
    title: "Worth remembering?",
    state: "Prefer TypeScript strict mode and no force-push to main.",
  },
  {
    id: "live",
    title: "Lab reachable?",
    state: "Mac can call http://192.168.1.20:8000/classify without a key.",
  },
];

const NOUL_VALUES: Record<string, number> = {
  angry: 0.86,
  save: 0.91,
  live: 0.94,
};

const SCORE_SCENARIOS: Scenario[] = [
  {
    id: "urgent",
    title: "Urgency",
    state: "Checkout is down for paying customers in EU.",
  },
  {
    id: "risk",
    title: "Risk",
    state: "Draft blog post about a planned feature, not yet shipped.",
  },
  {
    id: "effort",
    title: "Effort",
    state: "Rename a CSS variable across three React files.",
  },
];

const SCORE_VALUES: Record<
  string,
  { steps: string[]; index: number; confidence: number }
> = {
  urgent: {
    steps: ["can wait", "this week", "today", "right now"],
    index: 3,
    confidence: 0.88,
  },
  risk: {
    steps: ["none", "low", "medium", "high"],
    index: 1,
    confidence: 0.76,
  },
  effort: {
    steps: ["minutes", "hours", "days", "weeks"],
    index: 0,
    confidence: 0.82,
  },
};

const ASK_EXAMPLES = [
  {
    label: "Angry?",
    context: "Customer: I was charged twice for order #4412 and nobody has replied for three days.",
    question: "The customer is angry.",
  },
  {
    label: "Page on-call?",
    context: "Prometheus: API p99 latency 2.4s for 12 minutes. Error rate steady at 0.2%.",
    question: "On-call should be paged immediately.",
  },
  {
    label: "Remember?",
    context: "Prefer TypeScript strict mode and no force-push to main.",
    question: "This preference is worth saving for later runs.",
  },
];

const CLASS_LABELS = ["contradiction", "entailment", "neutral"] as const;

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function answerFromClassify(label: string, probs: number[]) {
  const byName: Record<string, number> = {};
  CLASS_LABELS.forEach((name, i) => {
    byName[name] = probs[i] ?? 0;
  });
  const entailment = byName.entailment ?? 0;
  const contradiction = byName.contradiction ?? 0;
  const neutral = byName.neutral ?? 0;

  if (label === "entailment" || entailment >= Math.max(contradiction, neutral)) {
    return {
      title: "Yes",
      detail: "Entailment — the claim fits the context.",
      tone: "yes" as const,
      confidence: entailment,
    };
  }
  if (label === "contradiction" || contradiction >= Math.max(entailment, neutral)) {
    return {
      title: "No",
      detail: "Contradiction — the claim does not fit.",
      tone: "no" as const,
      confidence: contradiction,
    };
  }
  return {
    title: "Uncertain",
    detail: "Neutral — not enough signal either way.",
    tone: "soft" as const,
    confidence: neutral,
  };
}

function ChoiceExample() {
  const reduce = useReducedMotion();
  const [scenarioId, setScenarioId] = useState(CHOICE_SCENARIOS[0].id);
  const scenario = CHOICE_SCENARIOS.find((s) => s.id === scenarioId)!;
  const options = CHOICE_OPTIONS[scenarioId];
  const winner = useMemo(
    () => options.reduce((a, b) => (a.p > b.p ? a : b)),
    [options],
  );

  return (
    <article className="example">
      <header className="example__head">
        <p className="eyebrow">Choice</p>
        <h3>Pick one route</h3>
        <p className="example__sub">
          One forward pass. Probabilities for every option.
        </p>
      </header>

      <div className="chips" role="tablist" aria-label="Choice scenarios">
        {CHOICE_SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === scenarioId}
            className={s.id === scenarioId ? "chip chip--on" : "chip"}
            onClick={() => setScenarioId(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <p className="state">{scenario.state}</p>

      <ul className="bars">
        {options.map((opt) => (
          <li key={opt.id}>
            <div className="bars__meta">
              <span>{opt.label}</span>
              <strong>{pct(opt.p)}</strong>
            </div>
            <div className="bars__track">
              <motion.div
                className={
                  opt.id === winner.id ? "bars__fill bars__fill--win" : "bars__fill"
                }
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${opt.p * 100}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="verdict">
        Decision <span>{winner.label}</span>
      </p>
    </article>
  );
}

function NoulExample() {
  const reduce = useReducedMotion();
  const [scenarioId, setScenarioId] = useState(NOUL_SCENARIOS[0].id);
  const scenario = NOUL_SCENARIOS.find((s) => s.id === scenarioId)!;
  const value = NOUL_VALUES[scenarioId];
  const yes = value >= 0.5;
  const angle = -90 + value * 180;

  return (
    <article className="example">
      <header className="example__head">
        <p className="eyebrow">Noul</p>
        <h3>Yes / no probability</h3>
        <p className="example__sub">
          A single calibrated chance — not a generated sentence.
        </p>
      </header>

      <div className="chips" role="tablist" aria-label="Noul scenarios">
        {NOUL_SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === scenarioId}
            className={s.id === scenarioId ? "chip chip--on" : "chip"}
            onClick={() => setScenarioId(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <p className="state">{scenario.state}</p>

      <div className="gauge" aria-label={`Probability ${pct(value)}`}>
        <svg viewBox="0 0 200 120" className="gauge__svg">
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            className="gauge__track"
          />
          <motion.path
            d="M20 100 A80 80 0 0 1 180 100"
            className="gauge__arc"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: value }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.line
            x1="100"
            y1="100"
            x2="100"
            y2="36"
            className="gauge__needle"
            style={{ transformOrigin: "100px 100px" }}
            initial={reduce ? false : { rotate: -90 }}
            animate={{ rotate: angle }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          <circle cx="100" cy="100" r="5" className="gauge__hub" />
        </svg>
        <AnimatePresence mode="wait">
          <motion.div
            key={scenarioId}
            className="gauge__readout"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <strong>{pct(value)}</strong>
            <span>{yes ? "true" : "false"}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </article>
  );
}

function ScoreExample() {
  const reduce = useReducedMotion();
  const [scenarioId, setScenarioId] = useState(SCORE_SCENARIOS[0].id);
  const scenario = SCORE_SCENARIOS.find((s) => s.id === scenarioId)!;
  const score = SCORE_VALUES[scenarioId];

  return (
    <article className="example">
      <header className="example__head">
        <p className="eyebrow">Score</p>
        <h3>Ordered scale</h3>
        <p className="example__sub">
          Steps stay fixed. The model lands on one with confidence.
        </p>
      </header>

      <div className="chips" role="tablist" aria-label="Score scenarios">
        {SCORE_SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === scenarioId}
            className={s.id === scenarioId ? "chip chip--on" : "chip"}
            onClick={() => setScenarioId(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>

      <p className="state">{scenario.state}</p>

      <ol className="steps">
        {score.steps.map((step, i) => {
          const active = i === score.index;
          return (
            <li key={step} className={active ? "steps__item steps__item--on" : "steps__item"}>
              <motion.span
                className="steps__dot"
                animate={
                  reduce
                    ? undefined
                    : active
                      ? { scale: [1, 1.18, 1] }
                      : { scale: 1 }
                }
                transition={{ duration: 0.9, repeat: active ? Infinity : 0 }}
              />
              <span className="steps__label">{step}</span>
              {active ? (
                <span className="steps__conf">{pct(score.confidence)}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </article>
  );
}

type LiveStatus = "idle" | "loading" | "ok" | "error";

type ClassifyResult = {
  label: string;
  probs: number[];
};

function AskLab() {
  const reduce = useReducedMotion();
  const [context, setContext] = useState(ASK_EXAMPLES[0].context);
  const [question, setQuestion] = useState(ASK_EXAMPLES[0].question);
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [result, setResult] = useState<ClassifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const answer = result
    ? answerFromClassify(result.label, result.probs)
    : null;

  async function ask() {
    const ctx = context.trim();
    const q = question.trim();
    if (!ctx || !q) {
      setStatus("error");
      setError("Add both context and a claim / question.");
      return;
    }

    setStatus("loading");
    setError(null);
    const started = performance.now();
    const input = `Context: ${ctx}\nClaim: ${q}`;

    try {
      const response = await fetch("/lab/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "openjev-0.8b",
          input,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.json();
      const row = body?.data?.[0];
      if (!row) throw new Error("Empty classify response");
      setResult({ label: row.label, probs: row.probs ?? [] });
      setLatency(Math.round(performance.now() - started));
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Request failed");
      setResult(null);
      setLatency(null);
    }
  }

  function loadExample(ex: (typeof ASK_EXAMPLES)[number]) {
    setContext(ex.context);
    setQuestion(ex.question);
    setResult(null);
    setStatus("idle");
    setError(null);
    setLatency(null);
  }

  return (
    <article className="ask">
      <header className="example__head">
        <p className="eyebrow">Ask the lab</p>
        <h3>Type context + a claim</h3>
        <p className="example__sub">
          Sends to <code>192.168.1.20:8000/classify</code>. Phrase the question
          as a claim (“The customer is angry.”).
        </p>
      </header>

      <div className="chips" aria-label="Example prompts">
        {ASK_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            className="chip"
            onClick={() => loadExample(ex)}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <form
        className="ask__form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label className="field">
          <span>Context</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            placeholder="Facts the model should judge against…"
          />
        </label>
        <label className="field">
          <span>Claim / question</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="The customer is angry."
          />
        </label>

        <div className="live-row">
          <button
            type="submit"
            className="primary"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Asking…" : "Ask OpenJEV"}
          </button>
          <p className="live-meta">
            {status === "ok" && latency != null ? `${latency} ms` : null}
            {status === "error" ? error : null}
            {status === "idle" ? "Ready when you are" : null}
          </p>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {answer && result ? (
          <motion.div
            key={`${result.label}-${latency}`}
            className={`ask__result ask__result--${answer.tone}`}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="ask__answer">
              <p className="ask__title">{answer.title}</p>
              <p className="ask__detail">{answer.detail}</p>
              <p className="ask__conf">{pct(answer.confidence)} confidence</p>
            </div>
            <ul className="bars">
              {result.probs.map((p, i) => (
                <li key={CLASS_LABELS[i] ?? i}>
                  <div className="bars__meta">
                    <span>{CLASS_LABELS[i] ?? `class ${i}`}</span>
                    <strong>{pct(p)}</strong>
                  </div>
                  <div className="bars__track">
                    <motion.div
                      className={
                        result.label === CLASS_LABELS[i]
                          ? "bars__fill bars__fill--win"
                          : "bars__fill"
                      }
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${p * 100}%` }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

function HeroField() {
  return (
    <div className="hero-field" aria-hidden>
      {[0.72, 0.19, 0.09].map((p, i) => (
        <motion.div
          key={i}
          className="hero-field__bar"
          style={{ ["--p" as string]: p }}
          animate={{ opacity: [0.35, 0.9, 0.35], scaleY: [0.85, 1, 0.85] }}
          transition={{
            duration: 3.2 + i * 0.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.25,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="#top">
          OpenJEV Viz
        </a>
        <nav>
          <a href="#ask">Ask</a>
          <a href="#examples">Examples</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero__copy">
          <p className="brand-mark">OpenJEV Viz</p>
          <h1>See a decision before a sentence.</h1>
          <p className="lede">
            Ask your homelab OpenJEV a claim. Get Yes, No, or Uncertain with
            probabilities.
          </p>
          <div className="hero__cta">
            <a className="primary" href="#ask">
              Ask a question
            </a>
            <a className="ghost" href="#examples">
              See examples
            </a>
          </div>
        </div>
        <HeroField />
      </section>

      <section className="section" id="ask">
        <div className="section__intro">
          <h2>Ask &amp; get a result</h2>
          <p>Live against Proxmox OpenJEV — type anything and submit.</p>
        </div>
        <AskLab />
      </section>

      <section className="section" id="examples">
        <div className="section__intro">
          <h2>Visual examples</h2>
          <p>Switch scenarios. Watch probabilities land.</p>
        </div>
        <div className="grid">
          <ChoiceExample />
          <NoulExample />
          <ScoreExample />
        </div>
      </section>

      <footer className="foot">
        <span>openjev-viz</span>
        <span>proxy → 192.168.1.20:8000</span>
      </footer>
    </div>
  );
}
