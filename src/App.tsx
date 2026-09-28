import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import "./App.css";
import {
  CLASS_LABELS,
  answerTone,
  decideChoice,
  decideNoul,
  decideScore,
  fetchLabStatus,
  pct,
  type ClassifyHit,
  type LabStatus,
} from "./lab";

type Mode = "noul" | "choice" | "score";

type HistoryItem = {
  id: string;
  mode: Mode;
  title: string;
  summary: string;
  ms: number;
  at: number;
};

const PRESETS: Record<
  Mode,
  {
    label: string;
    context: string;
    claim?: string;
    options?: string;
    steps?: string;
  }[]
> = {
  noul: [
    {
      label: "Angry customer",
      context:
        "Customer: I was charged twice for order #4412 and nobody has replied for three days.",
      claim: "The customer is angry.",
    },
    {
      label: "Worth saving",
      context: "Prefer TypeScript strict mode and no force-push to main.",
      claim: "This preference is worth saving for later runs.",
    },
    {
      label: "Lab live",
      context: "Mac can call the Proxmox OpenJEV classify endpoint without a key.",
      claim: "The homelab OpenJEV server is reachable from this Mac.",
    },
  ],
  choice: [
    {
      label: "Support route",
      context:
        "Customer: I was charged twice for order #4412 and nobody has replied for three days.",
      options: "Billing, Shipping, Technical",
    },
    {
      label: "Ops response",
      context:
        "Prometheus: API p99 latency 2.4s for 12 minutes. Error rate steady at 0.2%.",
      options: "Ignore, Page on-call, Open ticket",
    },
    {
      label: "Inbox",
      context:
        "Email: Can we move the design review to Thursday and send the Figma link?",
      options: "Calendar, Design, Finance",
    },
  ],
  score: [
    {
      label: "Urgency",
      context: "Checkout is down for paying customers in EU.",
      steps: "can wait, this week, today, right now",
    },
    {
      label: "Risk",
      context: "Draft blog post about a planned feature, not yet shipped.",
      steps: "none, low, medium, high",
    },
    {
      label: "Effort",
      context: "Rename a CSS variable across three React files.",
      steps: "minutes, hours, days, weeks",
    },
  ],
};

function splitList(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ProbBars({
  hit,
  highlight,
}: {
  hit: ClassifyHit;
  highlight?: string;
}) {
  return (
    <ul className="bars">
      {CLASS_LABELS.map((name) => {
        const p = hit.probs[name];
        return (
          <li key={name}>
            <div className="bars__meta">
              <span>{name}</span>
              <strong>{pct(p)}</strong>
            </div>
            <div className="bars__track">
              <motion.div
                className={
                  (highlight ?? hit.label) === name
                    ? "bars__fill bars__fill--win"
                    : "bars__fill"
                }
                animate={{ width: `${p * 100}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBar({ status, model }: { status: LabStatus; model: string }) {
  return (
    <div className={`status ${status.ok ? "status--ok" : "status--bad"}`}>
      <span className="status__dot" />
      <span>{status.ok ? "Lab online" : "Lab offline"}</span>
      <span className="status__sep" />
      <span>{model || "—"}</span>
      {status.version ? (
        <>
          <span className="status__sep" />
          <span>vLLM {status.version}</span>
        </>
      ) : null}
      {status.error ? (
        <>
          <span className="status__sep" />
          <span>{status.error}</span>
        </>
      ) : null}
    </div>
  );
}

type NoulResult = { yes: number; hit: ClassifyHit };
type ChoiceResult = { id: string; label: string; p: number; hit: ClassifyHit }[];
type ScoreResult = {
  steps: { label: string; p: number; hit: ClassifyHit }[];
  index: number;
  confidence: number;
};

function AskStudio({
  model,
  onHistory,
}: {
  model: string;
  onHistory: (item: Omit<HistoryItem, "id" | "at">) => void;
}) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("noul");
  const [context, setContext] = useState(PRESETS.noul[0].context);
  const [claim, setClaim] = useState(PRESETS.noul[0].claim ?? "");
  const [options, setOptions] = useState(PRESETS.choice[0].options ?? "");
  const [steps, setSteps] = useState(PRESETS.score[0].steps ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [noul, setNoul] = useState<NoulResult | null>(null);
  const [choice, setChoice] = useState<ChoiceResult | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);

  function applyPreset(modeNext: Mode, index = 0) {
    const preset = PRESETS[modeNext][index];
    setMode(modeNext);
    setContext(preset.context);
    setClaim(preset.claim ?? "");
    setOptions(preset.options ?? PRESETS.choice[0].options ?? "");
    setSteps(preset.steps ?? PRESETS.score[0].steps ?? "");
    setNoul(null);
    setChoice(null);
    setScore(null);
    setError(null);
    setLatency(null);
  }

  async function run(e?: FormEvent) {
    e?.preventDefault();
    if (!model) {
      setError("No model detected on the lab.");
      return;
    }
    const ctx = context.trim();
    if (!ctx) {
      setError("Add context first.");
      return;
    }

    setLoading(true);
    setError(null);
    const started = performance.now();

    try {
      if (mode === "noul") {
        const q = claim.trim();
        if (!q) throw new Error("Add a claim for yes/no.");
        const result = await decideNoul(ctx, q, model);
        setNoul(result);
        setChoice(null);
        setScore(null);
        const tone = answerTone(result.yes);
        onHistory({
          mode,
          title: tone.title,
          summary: q,
          ms: Math.round(performance.now() - started),
        });
      } else if (mode === "choice") {
        const opts = splitList(options);
        if (opts.length < 2) throw new Error("Add at least two options.");
        const result = await decideChoice(ctx, opts, model);
        setChoice(result);
        setNoul(null);
        setScore(null);
        const winner = result.reduce((a, b) => (a.p > b.p ? a : b));
        onHistory({
          mode,
          title: winner.label,
          summary: opts.join(" · "),
          ms: Math.round(performance.now() - started),
        });
      } else {
        const scale = splitList(steps);
        if (scale.length < 2) throw new Error("Add at least two scale steps.");
        const result = await decideScore(ctx, scale, model);
        setScore(result);
        setNoul(null);
        setChoice(null);
        onHistory({
          mode,
          title: result.steps[result.index]?.label ?? "—",
          summary: scale.join(" → "),
          ms: Math.round(performance.now() - started),
        });
      }
      setLatency(Math.round(performance.now() - started));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setNoul(null);
      setChoice(null);
      setScore(null);
      setLatency(null);
    } finally {
      setLoading(false);
    }
  }

  const noulAnswer = noul ? answerTone(noul.yes) : null;
  const choiceWinner = useMemo(() => {
    if (!choice?.length) return null;
    return choice.reduce((a, b) => (a.p > b.p ? a : b));
  }, [choice]);

  return (
    <div className="studio">
      <div className="studio__main">
        <header className="example__head">
          <p className="eyebrow">Decision studio</p>
          <h3>Ask openjev-4b live</h3>
          <p className="example__sub">
            System One shapes via multi-call classify on your homelab model.
          </p>
        </header>

        <div className="mode-tabs" role="tablist" aria-label="Decision type">
          {(
            [
              ["noul", "Yes / No"],
              ["choice", "Choice"],
              ["score", "Score"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? "mode mode--on" : "mode"}
              onClick={() => applyPreset(id, 0)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="chips" aria-label="Presets">
          {PRESETS[mode].map((preset, i) => (
            <button
              key={preset.label}
              type="button"
              className="chip"
              onClick={() => applyPreset(mode, i)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form className="ask__form" onSubmit={run}>
          <label className="field">
            <span>Context</span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={4}
              placeholder="Facts the model should judge against…"
            />
          </label>

          {mode === "noul" ? (
            <label className="field">
              <span>Claim</span>
              <textarea
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                rows={2}
                placeholder="The customer is angry."
              />
            </label>
          ) : null}

          {mode === "choice" ? (
            <label className="field">
              <span>Options (comma or newline)</span>
              <textarea
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                rows={3}
                placeholder="Billing, Shipping, Technical"
              />
            </label>
          ) : null}

          {mode === "score" ? (
            <label className="field">
              <span>Ordered scale (low → high)</span>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={3}
                placeholder="can wait, this week, today, right now"
              />
            </label>
          ) : null}

          <div className="live-row">
            <button type="submit" className="primary" disabled={loading || !model}>
              {loading ? "Deciding…" : "Run decision"}
            </button>
            <p className="live-meta">
              {loading
                ? "Calling lab…"
                : error
                  ? error
                  : latency != null
                    ? `${latency} ms · ${model}`
                    : "Ready"}
            </p>
          </div>
        </form>

        <AnimatePresence mode="wait">
          {noul && noulAnswer ? (
            <motion.div
              key={`noul-${latency}`}
              className={`ask__result ask__result--${noulAnswer.tone}`}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="ask__answer">
                <p className="ask__title">{noulAnswer.title}</p>
                <p className="ask__detail">{noulAnswer.detail}</p>
                <p className="ask__conf">{pct(noul.yes)} yes probability</p>
              </div>
              <div className="gauge gauge--inline" aria-hidden>
                <div className="gauge-bar">
                  <motion.div
                    className="gauge-bar__fill"
                    animate={{ width: `${noul.yes * 100}%` }}
                  />
                </div>
                <div className="gauge-bar__ends">
                  <span>No</span>
                  <span>Yes</span>
                </div>
              </div>
              <ProbBars hit={noul.hit} />
            </motion.div>
          ) : null}

          {choice && choiceWinner ? (
            <motion.div
              key={`choice-${latency}`}
              className="ask__result"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p className="verdict">
                Decision <span>{choiceWinner.label}</span>
              </p>
              <ul className="bars">
                {choice.map((opt) => (
                  <li key={opt.id}>
                    <div className="bars__meta">
                      <span>{opt.label}</span>
                      <strong>{pct(opt.p)}</strong>
                    </div>
                    <div className="bars__track">
                      <motion.div
                        className={
                          opt.id === choiceWinner.id
                            ? "bars__fill bars__fill--win"
                            : "bars__fill"
                        }
                        animate={{ width: `${opt.p * 100}%` }}
                        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : null}

          {score ? (
            <motion.div
              key={`score-${latency}`}
              className="ask__result"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p className="verdict">
                Score <span>{score.steps[score.index]?.label}</span>
                <em className="verdict__meta">{pct(score.confidence)}</em>
              </p>
              <ol className="steps">
                {score.steps.map((step, i) => {
                  const active = i === score.index;
                  return (
                    <li
                      key={step.label}
                      className={
                        active ? "steps__item steps__item--on" : "steps__item"
                      }
                    >
                      <span className="steps__dot" />
                      <span className="steps__label">{step.label}</span>
                      <span className="steps__conf">{pct(step.p)}</span>
                    </li>
                  );
                })}
              </ol>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HistoryPanel({ items }: { items: HistoryItem[] }) {
  if (!items.length) {
    return (
      <aside className="history">
        <h4>Session history</h4>
        <p className="history__empty">Run a decision to fill this list.</p>
      </aside>
    );
  }

  return (
    <aside className="history">
      <h4>Session history</h4>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <div className="history__top">
              <strong>{item.title}</strong>
              <span>{item.ms} ms</span>
            </div>
            <p>{item.summary}</p>
            <span className="history__mode">{item.mode}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function QuickGrid({
  model,
}: {
  model: string;
}) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<ChoiceResult | null>(null);
  const [noul, setNoul] = useState<NoulResult | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAll() {
    if (!model) return;
    setBusy("all");
    setError(null);
    try {
      const [c, n, s] = await Promise.all([
        decideChoice(
          PRESETS.choice[0].context,
          splitList(PRESETS.choice[0].options ?? ""),
          model,
        ),
        decideNoul(
          PRESETS.noul[0].context,
          PRESETS.noul[0].claim ?? "",
          model,
        ),
        decideScore(
          PRESETS.score[0].context,
          splitList(PRESETS.score[0].steps ?? ""),
          model,
        ),
      ]);
      setChoice(c);
      setNoul(n);
      setScore(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (model) void runAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const winner = choice?.length
    ? choice.reduce((a, b) => (a.p > b.p ? a : b))
    : null;
  const tone = noul ? answerTone(noul.yes) : null;

  return (
    <div className="quick">
      <div className="section__intro row-between">
        <div>
          <h2>Live examples</h2>
          <p>Same three System One shapes, scored by {model || "the lab"}.</p>
        </div>
        <button
          type="button"
          className="ghost"
          onClick={() => void runAll()}
          disabled={!!busy || !model}
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error ? <p className="live-meta">{error}</p> : null}
      <div className="grid">
        <article className="example">
          <header className="example__head">
            <p className="eyebrow">Choice</p>
            <h3>Support route</h3>
          </header>
          <p className="state">{PRESETS.choice[0].context}</p>
          {winner && choice ? (
            <>
              <ul className="bars">
                {choice.map((opt) => (
                  <li key={opt.id}>
                    <div className="bars__meta">
                      <span>{opt.label}</span>
                      <strong>{pct(opt.p)}</strong>
                    </div>
                    <div className="bars__track">
                      <motion.div
                        className={
                          opt.id === winner.id
                            ? "bars__fill bars__fill--win"
                            : "bars__fill"
                        }
                        initial={reduce ? false : { width: 0 }}
                        animate={{ width: `${opt.p * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="verdict">
                Decision <span>{winner.label}</span>
              </p>
            </>
          ) : (
            <p className="live-meta">{busy ? "Scoring…" : "Waiting for lab"}</p>
          )}
        </article>

        <article className="example">
          <header className="example__head">
            <p className="eyebrow">Noul</p>
            <h3>Angry customer?</h3>
          </header>
          <p className="state">{PRESETS.noul[0].claim}</p>
          {noul && tone ? (
            <>
              <div className={`ask__answer ask__answer--${tone.tone}`}>
                <p className="ask__title">{tone.title}</p>
                <p className="ask__conf">{pct(noul.yes)} yes</p>
              </div>
            </>
          ) : (
            <p className="live-meta">{busy ? "Scoring…" : "Waiting for lab"}</p>
          )}
        </article>

        <article className="example">
          <header className="example__head">
            <p className="eyebrow">Score</p>
            <h3>Urgency</h3>
          </header>
          <p className="state">{PRESETS.score[0].context}</p>
          {score ? (
            <ol className="steps">
              {score.steps.map((step, i) => (
                <li
                  key={step.label}
                  className={
                    i === score.index
                      ? "steps__item steps__item--on"
                      : "steps__item"
                  }
                >
                  <span className="steps__dot" />
                  <span className="steps__label">{step.label}</span>
                  <span className="steps__conf">{pct(step.p)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="live-meta">{busy ? "Scoring…" : "Waiting for lab"}</p>
          )}
        </article>
      </div>
    </div>
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
  const [status, setStatus] = useState<LabStatus>({
    ok: false,
    model: null,
    version: null,
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const model = status.model ?? "";

  useEffect(() => {
    let alive = true;
    async function poll() {
      const next = await fetchLabStatus();
      if (alive) setStatus(next);
    }
    void poll();
    const id = window.setInterval(poll, 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  function pushHistory(item: Omit<HistoryItem, "id" | "at">) {
    setHistory((prev) => [
      {
        ...item,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        at: Date.now(),
      },
      ...prev,
    ].slice(0, 12));
  }

  return (
    <div className="page">
      <header className="top">
        <a className="brand" href="#top">
          OpenJEV Viz
        </a>
        <nav>
          <a href="#ask">Studio</a>
          <a href="#examples">Examples</a>
        </nav>
      </header>

      <StatusBar status={status} model={model} />

      <section className="hero" id="top">
        <div className="hero__copy">
          <p className="brand-mark">OpenJEV Viz</p>
          <h1>Decide with openjev-4b on your lab.</h1>
          <p className="lede">
            Yes/no, multi-option choice, and ordered scores — all live against
            the bigger homelab model.
          </p>
          <div className="hero__cta">
            <a className="primary" href="#ask">
              Open studio
            </a>
            <a className="ghost" href="#examples">
              Live examples
            </a>
          </div>
        </div>
        <HeroField />
      </section>

      <section className="section" id="ask">
        <div className="section__intro">
          <h2>Decision studio</h2>
          <p>Pick a shape, edit the prompt, run against the lab.</p>
        </div>
        <div className="studio-layout">
          <AskStudio model={model} onHistory={pushHistory} />
          <HistoryPanel items={history} />
        </div>
      </section>

      <section className="section" id="examples">
        <QuickGrid model={model} />
      </section>

      <footer className="foot">
        <span>openjev-viz</span>
        <span>proxy → 192.168.1.20:8000 · {model || "no model"}</span>
      </footer>
    </div>
  );
}
