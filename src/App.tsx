import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Braces,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  GitBranch,
  Layers3,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  Activity,
  Fingerprint,
  BookOpen,
  Moon,
  Sun,
} from "lucide-react";
import { decide } from "./core/engine";
import { defaultSettings, scenarios } from "./core/scenarios";
import type { Confirmation, Receipt, Settings } from "./core/types";
import { InteractiveGrid } from "./InteractiveGrid";

const number = (n: number) => n.toFixed(1);
const percent = (n: number) => `${Math.round(n * 100)}%`;
type Tab = "workbench" | "method" | "integrate";

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = localStorage.getItem("hinge-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [tab, setTab] = useState<Tab>("workbench");
  const [scenarioId, setScenarioId] = useState("atlas");
  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  const [request, setRequest] = useState(scenario.request);
  const [mode, setMode] = useState<"fixture" | "jev">("fixture");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPolicy, setShowPolicy] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector("#theme-color")
      ?.setAttribute("content", theme === "dark" ? "#06101d" : "#edf2f7");
    localStorage.setItem("hinge-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((r) => setLiveAvailable(r.liveAvailable))
      .catch(() =>
        setError("Local server is unavailable. Start it with npm run dev."),
      );
  }, []);
  useEffect(() => {
    if (!showReceipt) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowReceipt(false);
        return;
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.receipt-modal button:not(:disabled), .receipt-modal [tabindex="0"]',
        ),
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [showReceipt]);
  const dirty =
    receipt !== null &&
    (receipt.request !== request || receipt.provider.source !== mode);
  const prior =
    !dirty && receipt ? receipt.provider.probabilities : scenario.fixture;
  const decision = decide(scenario, prior, settings, confirmations);
  const question = scenario.questions.find(
    (q) => q.id === decision.nextQuestion,
  );
  const bestQuestion = decision.questions[0];
  const initial = decide(scenario, prior, settings);
  const action = scenario.actions.find((a) => a.id === decision.bestAction);
  const ready =
    mode === "fixture" || (receipt?.provider.source === "jev" && !dirty);

  function invalidate() {
    generation.current++;
    abort.current?.abort();
    setBusy(false);
    setError("");
    setNotice("");
  }
  function changeScenario(id: string) {
    invalidate();
    const next = scenarios.find((s) => s.id === id)!;
    setScenarioId(id);
    setRequest(next.request);
    setReceipt(null);
    setConfirmations([]);
  }
  function changeMode(next: "fixture" | "jev") {
    invalidate();
    setMode(next);
    setReceipt(null);
    setConfirmations([]);
    setRequest(scenario.request);
  }
  async function evaluate(exportAfter = false) {
    const version = ++generation.current;
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.current.signal,
        body: JSON.stringify({
          scenarioId,
          request,
          mode,
          settings,
          confirmations,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Evaluation failed.");
      if (generation.current !== version) return;
      setRequest(data.request);
      setReceipt(data);
      if (exportAfter) download(data);
      else
        setNotice(
          mode === "jev"
            ? "Live Jev distribution received. Policy recomputed."
            : "Fixture evaluated. No model request was made.",
        );
    } catch (e) {
      if (
        generation.current === version &&
        !(e instanceof DOMException && e.name === "AbortError")
      )
        setError(e instanceof Error ? e.message : "Evaluation failed.");
    } finally {
      if (generation.current === version) setBusy(false);
    }
  }
  function download(data: Receipt) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hinge-${scenario.id}-${data.provider.source}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      "Decision receipt exported, including the policy and probability source.",
    );
  }
  function confirm(answerId: string) {
    if (!question) return;
    invalidate();
    setConfirmations([...confirmations, { questionId: question.id, answerId }]);
  }
  function reset() {
    invalidate();
    setConfirmations([]);
    setReceipt(null);
    setRequest(scenario.request);
  }
  function updateSetting(key: keyof Settings, value: number) {
    invalidate();
    setSettings((s) => ({ ...s, [key]: value }));
  }

  return (
    <>
      <InteractiveGrid />
      <div className="app-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("workbench");
            }}
            aria-label="Hinge home"
          >
            <img src="/hinge.svg" alt="" />
            <span>
              hinge<span className="brand-dot">.</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            {(["workbench", "method", "integrate"] as Tab[]).map((t) => (
              <button
                className={tab === t ? "nav-active" : ""}
                key={t}
                onClick={() => setTab(t)}
              >
                {t === "workbench"
                  ? "Decision studio"
                  : t === "method"
                    ? "The method"
                    : "Build with Hinge"}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <a
              className="model-link"
              href="https://pydantic.dev/docs/ai/models/typesafe/"
              target="_blank"
              rel="noreferrer"
            >
              <span className="jev-icon">∵</span> Pydantic AI × Jev{" "}
              <ArrowUpRight size={14} />
            </a>
            <button
              className="theme-toggle"
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              <Sun className="sun-icon" size={15} />
              <span className="toggle-orbit" aria-hidden="true" />
              <Moon className="moon-icon" size={14} />
            </button>
          </div>
        </header>

        <main>
          {tab === "workbench" ? (
            <>
              <section className="hero">
                <div>
                  <div className="eyebrow">
                    <span className="small-line" /> THE SPACE BETWEEN GUESSING
                    AND ACTING
                  </div>
                  <h1>
                    Every decision has
                    <br />a <span>turning point.</span>
                    <span className="hero-asterisk">✳</span>
                  </h1>
                  <p>
                    Explore what a request could mean. See what a mistake could
                    cost.
                    <br className="desktop-br" /> Ask the one question that
                    makes the difference.
                  </p>
                </div>
                <aside className="hero-note">
                  <GitBranch size={24} strokeWidth={1.4} />
                  <p>
                    Intelligence is knowing.
                    <br />
                    <em>
                      Judgment is knowing
                      <br />
                      when to ask.
                    </em>
                  </p>
                  <span>JEV × DECISION THEORY</span>
                </aside>
              </section>

              <section className="studio" aria-label="Decision workbench">
                <div className="studio-toolbar">
                  <div className="studio-title">
                    <span className="status-dot" /> DECISION STUDIO{" "}
                    <span className="version">01 / EXPLORER</span>
                  </div>
                  <div className="mode-toggle" aria-label="Inference source">
                    <button
                      className={mode === "fixture" ? "selected" : ""}
                      onClick={() => changeMode("fixture")}
                    >
                      Example data
                    </button>
                    <button
                      className={mode === "jev" ? "selected" : ""}
                      onClick={() => changeMode("jev")}
                    >
                      <span
                        className={liveAvailable ? "live-dot" : "inactive-dot"}
                      />{" "}
                      Live Jev
                    </button>
                  </div>
                </div>
                <div className="studio-body">
                  <aside className="input-pane">
                    <div className="step-label">
                      <span>01</span> THE REQUEST
                    </div>
                    <label className="field-label" htmlFor="scenario">
                      Choose a situation
                    </label>
                    <div className="select-wrap">
                      <select
                        id="scenario"
                        value={scenarioId}
                        onChange={(e) => changeScenario(e.target.value)}
                      >
                        {scenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={15} />
                    </div>
                    <div className="category">{scenario.category}</div>
                    <label className="sr-only" htmlFor="request">
                      Request to evaluate
                    </label>
                    <textarea
                      id="request"
                      value={request}
                      readOnly={mode === "fixture"}
                      maxLength={4000}
                      onChange={(e) => {
                        invalidate();
                        setRequest(e.target.value);
                        setConfirmations([]);
                      }}
                    />
                    <p className="input-hint">
                      {mode === "fixture"
                        ? "An authored example. Switch to Live Jev to try your own words."
                        : liveAvailable
                          ? "Your request will be sent to TypeSafe when you evaluate."
                          : "Add TYPESAFE_API_KEY to your local .env and restart to connect."}
                    </p>
                    <button
                      className="primary-button"
                      disabled={
                        busy ||
                        (mode === "jev" && !liveAvailable) ||
                        !request.trim()
                      }
                      onClick={() => void evaluate()}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Play size={14} fill="currentColor" />
                      )}{" "}
                      {busy
                        ? "Evaluating…"
                        : mode === "fixture"
                          ? "Explore this decision"
                          : "Evaluate with Jev"}
                      <ArrowRight size={16} />
                    </button>
                    <div className="context-note">
                      <Layers3 size={16} />
                      <p>{scenario.description}</p>
                    </div>
                    <div className="policy-toggle">
                      <button
                        onClick={() => setShowPolicy(!showPolicy)}
                        aria-expanded={showPolicy}
                      >
                        <SlidersHorizontal size={15} /> Decision policy{" "}
                        <span>{showPolicy ? "−" : "+"}</span>
                      </button>
                      <span className="policy-caption">
                        Your tradeoffs. Written in code.
                      </span>
                    </div>
                    {showPolicy && (
                      <div className="policy-controls">
                        <Slider
                          label="Risk budget"
                          value={settings.riskBudget}
                          max={30}
                          step={0.5}
                          display={`${number(settings.riskBudget)} pts`}
                          onChange={(v) => updateSetting("riskBudget", v)}
                        />
                        <Slider
                          label="Probability stress"
                          value={settings.ambiguity}
                          max={0.3}
                          step={0.01}
                          display={percent(settings.ambiguity)}
                          onChange={(v) => updateSetting("ambiguity", v)}
                        />
                        <Slider
                          label="Interruption cost"
                          value={settings.questionCost}
                          max={20}
                          step={0.5}
                          display={`${number(settings.questionCost)} pts`}
                          onChange={(v) => updateSetting("questionCost", v)}
                        />
                        <p>
                          Loss points are illustrative. Probability stress moves
                          mass toward costly mistakes; it is not a calibrated
                          guarantee.
                        </p>
                      </div>
                    )}
                  </aside>

                  <section
                    className={`world-pane ${!ready ? "awaiting" : ""}`}
                    aria-label="Possible interpretations"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty(
                        "--pane-x",
                        `${e.clientX - rect.left}px`,
                      );
                      e.currentTarget.style.setProperty(
                        "--pane-y",
                        `${e.clientY - rect.top}px`,
                      );
                      e.currentTarget.style.setProperty("--pane-active", "1");
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.setProperty("--pane-active", "0");
                    }}
                  >
                    <div className="world-heading">
                      <div className="step-label">
                        <span>02</span> POSSIBLE WORLDS
                      </div>
                      <span className="source-label">
                        {ready && mode === "jev"
                          ? "JEV PROBABILITIES"
                          : "ILLUSTRATIVE DISTRIBUTION"}
                      </span>
                    </div>
                    <div className="world-subtitle">
                      One sentence. More than one reality.
                    </div>
                    <div className="branch-map">
                      <div className="branch-origin">
                        <GitBranch size={20} />
                        <span>intent</span>
                      </div>
                      <svg
                        className="branch-lines"
                        viewBox="0 0 120 330"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {scenario.worlds.map((w, i) => (
                          <path
                            key={w.id}
                            d={`M 2 165 C 68 165, 48 ${28 + i * 68}, 118 ${28 + i * 68}`}
                            fill="none"
                            stroke={
                              decision.eliminated.includes(w.id)
                                ? "#e5e5de"
                                : w.color
                            }
                            strokeWidth={
                              decision.eliminated.includes(w.id) ? 1 : 1.8
                            }
                            strokeDasharray={i === 4 ? "4 5" : undefined}
                          />
                        ))}
                      </svg>
                      <div className="world-cards">
                        {scenario.worlds.map((world, i) => {
                          const p = decision.probabilities[world.id];
                          const eliminated = decision.eliminated.includes(
                            world.id,
                          );
                          return (
                            <div
                              className={`world-card ${eliminated ? "eliminated" : ""} ${i === 4 ? "unknown-world" : ""}`}
                              key={world.id}
                              style={
                                {
                                  "--world-color": world.color,
                                } as React.CSSProperties
                              }
                            >
                              <div className="world-card-top">
                                <span className="world-index">
                                  {i === 4 ? "?" : `0${i + 1}`}
                                </span>
                                <span className="world-name">
                                  {world.label}
                                </span>
                                <strong>
                                  {eliminated ? <X size={14} /> : percent(p)}
                                </strong>
                              </div>
                              <div className="probability-track">
                                <span style={{ width: `${p * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="world-legend">
                      <span>
                        <i />{" "}
                        {confirmations.length
                          ? "Conditioned on your answers"
                          : "Probability is not permission"}
                      </span>
                      <span>
                        {scenario.worlds.length} bounded interpretations
                      </span>
                    </div>
                    {!ready && (
                      <div className="pending-banner">
                        {dirty
                          ? "Request changed. Evaluate again to update the model."
                          : "Evaluate your request to replace this illustrative preview with Jev probabilities."}
                      </div>
                    )}
                  </section>
                </div>

                <div className="decision-strip">
                  <div className="strip-intro">
                    <div className="step-label">
                      <span>03</span> THE TURNING POINT
                    </div>
                    <p>
                      {decision.kind === "ask"
                        ? "A better question beats a bolder guess."
                        : decision.kind === "act"
                          ? "The uncertainty has a smaller footprint."
                          : "Some decisions need a human."}
                    </p>
                  </div>
                  <div className="metric">
                    <span>RISK BEFORE ASKING</span>
                    <div>
                      {number(initial.risk)} <small>pts</small>
                    </div>
                  </div>
                  <div className="metric">
                    <span>
                      {confirmations.length
                        ? "RISK AFTER YOUR ANSWER"
                        : "EXPECTED AFTER ONE ANSWER"}
                    </span>
                    <div className="green">
                      {number(
                        confirmations.length
                          ? decision.risk
                          : (bestQuestion?.expectedResidual ?? decision.risk),
                      )}{" "}
                      <small>pts</small>
                      <ArrowRight size={18} />
                    </div>
                  </div>
                  <div className={`decision-badge ${decision.kind}`}>
                    <span className="status-dot" />
                    {!ready
                      ? "Awaiting evaluation"
                      : decision.kind === "ask"
                        ? "Ask before acting"
                        : decision.kind === "act"
                          ? "Proposal ready"
                          : "Human review"}
                  </div>
                </div>
              </section>

              <div className="below-grid">
                <section className="question-panel" aria-label="Clarification">
                  <div className="section-top">
                    <span className="eyebrow">
                      {question
                        ? "THE HIGHEST-VALUE QUESTION"
                        : "THE NEXT STEP"}
                    </span>
                    <CircleHelp size={18} />
                  </div>
                  <h2>
                    {question?.text ??
                      (decision.kind === "act"
                        ? action?.label
                        : "Bring in a human reviewer.")}
                  </h2>
                  <p>
                    {question ? (
                      <>
                        Worth asking:{" "}
                        <strong>
                          {number(bestQuestion?.netValue ?? 0)} loss points
                        </strong>{" "}
                        of modeled improvement after interruption cost.
                      </>
                    ) : (
                      decision.reason
                    )}
                  </p>
                  {question ? (
                    <div className="answer-buttons">
                      {question.answers.map((a) => (
                        <button
                          disabled={!ready || busy}
                          onClick={() => confirm(a.id)}
                          key={a.id}
                        >
                          {a.label}
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                      <button
                        className="unsure-button"
                        disabled={!ready}
                        onClick={() =>
                          setNotice(
                            "No answer recorded. Keep the task paused and ask a reviewer to clarify the scope.",
                          )
                        }
                      >
                        I’m not sure <CircleHelp size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="resolved-message">
                      <ShieldCheck size={20} />
                      <span>
                        {decision.kind === "act"
                          ? "Recommendation only. No operation has been executed."
                          : "No operation will be proposed automatically."}
                      </span>
                    </div>
                  )}
                  <div className="question-footer">
                    <span>
                      {confirmations.length
                        ? `${confirmations.length} answer${confirmations.length > 1 ? "s" : ""} recorded · human-provided evidence`
                        : "Try an answer. Watch the possible worlds change."}
                    </span>
                    <button onClick={reset} aria-label="Reset decision">
                      <RotateCcw size={13} /> Reset
                    </button>
                  </div>
                </section>
                <section className="trace-panel">
                  <div className="section-top">
                    <span className="eyebrow">AN INSPECTABLE DECISION</span>
                    <Fingerprint size={18} />
                  </div>
                  <h3>No leap of faith required.</h3>
                  <p>
                    Every proposal carries its probabilities, loss matrix,
                    policy settings, and clarification history.
                  </p>
                  <div className="trace-facts">
                    <span>
                      <Check size={13} /> Deterministic policy
                    </span>
                    <span>
                      <Check size={13} /> Replayable receipt
                    </span>
                    <span>
                      <Check size={13} /> No tool execution
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setShowReceipt(true)}
                  >
                    Inspect the decision <ArrowUpRight size={15} />
                  </button>
                </section>
              </div>
              <section className="comparison">
                <div>
                  <span className="eyebrow">
                    WHAT CHANGES WHEN YOU PRICE A MISTAKE?
                  </span>
                  <h2>The likely answer isn’t always the right next move.</h2>
                  <p>
                    Expected loss weights each possible mistake. The stress test
                    then shifts up to {percent(settings.ambiguity)} of
                    probability toward worse outcomes.
                  </p>
                </div>
                <div className="risk-table">
                  <div className="risk-row table-head">
                    <span>PROPOSED ACTION</span>
                    <span>EXPECTED</span>
                    <span>STRESSED</span>
                  </div>
                  {decision.actions.map((a) => (
                    <div
                      className={`risk-row ${a.id === decision.bestAction ? "best-action" : ""}`}
                      key={a.id}
                    >
                      <span>
                        {scenario.actions.find((x) => x.id === a.id)?.label}
                        {a.id === decision.bestAction && (
                          <span className="lowest-label">LOWEST</span>
                        )}
                      </span>
                      <span>{number(a.expectedLoss)}</span>
                      <strong>{number(a.robustLoss)}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <div className="provenance">
                <Activity size={14} />
                <span>
                  {mode === "fixture"
                    ? "Example mode uses authored probabilities, not Jev outputs. All risk values are computed."
                    : receipt?.provider.source === "jev"
                      ? `${receipt.provider.model} · ${receipt.provider.latencyMs} ms measured round trip · ${receipt.provider.usage?.input_tokens} input tokens`
                      : "Live mode selected. A Jev response has not been received yet."}
                </span>
                <button
                  onClick={() => void evaluate(true)}
                  disabled={busy || (mode === "jev" && !liveAvailable)}
                >
                  <Download size={14} /> Export receipt
                </button>
              </div>
            </>
          ) : tab === "method" ? (
            <Method />
          ) : (
            <Integrate />
          )}
          {error && (
            <div className="notification error" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notification" role="status">
              <span>{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </main>
        <footer>
          <span className="footer-brand">hinge.</span>
          <span>Less guessing. Better questions.</span>
          <span>
            AN OPEN EXPERIMENT WITH JEV <span className="footer-star">✳</span>
          </span>
        </footer>
        {showReceipt && (
          <div className="modal-backdrop" onClick={() => setShowReceipt(false)}>
            <section
              className="receipt-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Decision inspector"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="section-top">
                <h2>Inside the decision.</h2>
                <button
                  autoFocus
                  onClick={() => setShowReceipt(false)}
                  aria-label="Close inspector"
                >
                  <X />
                </button>
              </div>
              <p>
                This view updates with your controls. Export creates a SHA-256
                receipt of a fresh evaluation. A hash detects edits against a
                trusted digest; it does not authenticate the model or author.
              </p>
              <pre>
                {JSON.stringify(
                  {
                    source:
                      mode === "jev" && ready
                        ? receipt?.provider.model
                        : "authored fixture preview",
                    policy: settings,
                    confirmations,
                    decision,
                  },
                  null,
                  2,
                )}
              </pre>
              <button
                className="primary-button"
                disabled={busy || (mode === "jev" && !liveAvailable)}
                onClick={() => void evaluate(true)}
              >
                <Download size={16} /> Export replayable receipt
              </button>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Slider({
  label,
  value,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  step: number;
  display: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="slider-label">
      <span>
        {label}
        <output>{display}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function Method() {
  return (
    <article className="article-page">
      <span className="eyebrow">THE METHOD / 01</span>
      <h1>
        Make uncertainty
        <br />
        <em>useful.</em>
      </h1>
      <p className="article-lead">
        Hinge connects a bounded intent model to a cost-sensitive decision
        policy. The model supplies judgments. Code owns the arithmetic.
      </p>
      <div className="method-grid">
        {[
          [
            "01",
            "Name the possible worlds.",
            "Each scenario defines mutually exclusive intentions and an explicit outside-model option. Jev answers one Choice question over this joint state space. Hinge never multiplies unrelated model probabilities.",
          ],
          [
            "02",
            "Put a price on being wrong.",
            "A developer-authored loss matrix defines the cost of each action in each world. Hinge computes expected loss, then its exact worst case inside a total-variation probability neighborhood. These are illustrative loss points, not monetary estimates.",
          ],
          [
            "03",
            "Find the question that matters.",
            "Each candidate question partitions the worlds. Hinge conditions on each possible answer, recomputes the best proposal, and weighs those residual risks by their modeled answer probabilities. The improvement minus interruption cost ranks the questions.",
          ],
          [
            "04",
            "Ask, propose, or defer.",
            "Ask when a question has positive net value. Otherwise propose only if the stressed risk fits the budget. Defer on too much outside-model probability, contradictory answers, or remaining excessive risk. Proposals never grant authorization.",
          ],
        ].map(([n, title, text]) => (
          <section key={n}>
            <span className="method-number">{n}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <div className="math-block">
        <span>THE DECISION RULE</span>
        <code>
          risk(a) = max q∈TV(p, ε) Σ q(w) · loss(a, w)
          <br />
          <br />
          question value = risk now − E[best risk after answer] − cost
        </code>
      </div>
      <h2>What the numbers assume</h2>
      <p>
        Answers are truthful and perfectly partition the modeled worlds. The
        question ranking is a one-step heuristic with nominal branch weights and
        stressed residual risks; it is not a globally optimal or fully robust
        multi-step policy. The stress radius is a sensitivity knob, not an
        empirical confidence interval. Zero-probability contradictions defer
        instead of inventing a posterior. Unknown tasks and omitted worlds
        remain real limitations.
      </p>
      <h2>Standing on prior work</h2>
      <p>
        Value-of-information clarification is established research. Read{" "}
        <a
          href="https://aclanthology.org/P18-1255/"
          target="_blank"
          rel="noreferrer"
        >
          Rao & Daumé (2018)
        </a>{" "}
        and{" "}
        <a
          href="https://arxiv.org/abs/2601.06407"
          target="_blank"
          rel="noreferrer"
        >
          Dong et al. (2026)
        </a>
        . Hinge is an open engineering experiment combining Jev, probability
        stress tests, visible decision branches, and replayable receipts. No
        world-first, state-of-the-art benchmark, or production safety claim is
        made.
      </p>
      <a
        className="text-button"
        href="https://docs.typesafe.ai/model-jaggedness/jev-1.13"
        target="_blank"
        rel="noreferrer"
      >
        Read Jev’s documented limitations <ArrowUpRight size={15} />
      </a>
    </article>
  );
}
function Integrate() {
  return (
    <article className="article-page">
      <span className="eyebrow">BUILD WITH HINGE / 02</span>
      <h1>
        A small engine.
        <br />
        <em>A different reflex.</em>
      </h1>
      <p className="article-lead">
        Use the TypeScript decision engine in your own workflow. Keep the
        workbench as a place to inspect and tune its behavior.
      </p>
      <div className="integration-grid">
        <section>
          <Braces size={26} />
          <h2>Start the workbench</h2>
          <pre>
            npm install
            <br />
            npm run dev
          </pre>
          <p>
            Open the local URL printed by the server. Example mode works without
            an account and clearly labels every authored distribution.
          </p>
          <h2>Connect Jev</h2>
          <pre>
            {
              "// Create .env in the project root\nTYPESAFE_API_KEY=your_key_here\nTYPESAFE_MODEL=jev-1.13.0"
            }
          </pre>
          <p>
            Restart the server, choose Live Jev, and evaluate. The key stays on
            the server. Only the request and scenario context go to TypeSafe.
            Errors never silently fall back to example data.
          </p>
        </section>
        <section>
          <Sparkles size={26} />
          <h2>Embed the decision rule</h2>
          <pre>{`import { decide } from './src/core/engine';\n\nconst result = decide(\n  scenario,\n  jevProbabilities,\n  {\n    riskBudget: 3,\n    ambiguity: 0.06,\n    questionCost: 1,\n  },\n  confirmedAnswers,\n);\n\nswitch (result.kind) {\n  case 'ask':   // show approved question\n  case 'act':   // propose to your policy gate\n  case 'defer': // route to a reviewer\n}`}</pre>
          <p>
            Define your own finite worlds, complete loss matrix, and questions.
            Keep identity, permissions, and tool execution in your application.
          </p>
        </section>
        <section className="pydantic-card">
          <Braces size={26} />
          <span className="integration-kicker">PYTHON / PYDANTIC AI</span>
          <h2>Use Jev as a typed decision model</h2>
          <pre>{`pip install "pydantic-ai-slim[typesafe]"

from typing import Literal
from pydantic import BaseModel, Field
from pydantic_ai import Agent

class Handling(BaseModel):
    verdict: Literal['run', 'reject', 'ask'] = Field(
        description='How should this request be handled?'
    )

agent = Agent(
    'typesafe:jev-latest',
    output_type=Handling,
)
result = agent.run_sync(request)`}</pre>
          <p>
            Pydantic AI maps each output field to one Jev question. Keep the
            material being judged in the prompt, ask one atomic judgment per
            field, and combine the answers in code.
          </p>
          <a
            className="text-button"
            href="https://pydantic.dev/docs/ai/models/typesafe/"
            target="_blank"
            rel="noreferrer"
          >
            Pydantic AI Typesafe guide <ArrowUpRight size={15} />
          </a>
        </section>
      </div>
      <div className="integration-bottom">
        <BookOpen />
        <div>
          <h2>Measure before making claims.</h2>
          <p>
            <code>npm test</code> checks policy invariants and provider
            contracts. <code>npm run evaluate</code> compares policies on
            authored distributions. <code>npm run evaluate:live</code> measures
            Jev on a small labeled smoke set when a key is configured. The
            README explains how to interpret each result.
          </p>
        </div>
      </div>
    </article>
  );
}
