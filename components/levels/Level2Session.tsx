"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { Level } from "@/lib/types";
import type { Card } from "@/lib/cards";
import { getCardImagePath, getBackImagePath, calculateHandValue } from "@/game/cardUtils";
import { useTutor } from "@/lib/useTutor";
import {
  type Level2State,
  type Level2Stage,
  STAGE2_HAND_COUNT,
  STAGE3_STREAK_NEEDED,
  STAGE4_STREAK_NEEDED,
  getInitialLevel2State,
  startNewHand,
  applyPlayerHit,
  applyPlayerStand,
  runDealerPlay,
  submitDirectionInput,
  advanceAfterFeedback,
  advanceAfterStage2Hand,
  getLevel2GameContext,
  getStageIntroContext,
  getCountDirection,
} from "@/game/levels/level2/gameLogic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  role: "tutor" | "student";
  text: string;
}

let _msgId = 0;
const nextMsgId = () => ++_msgId;

const TEN_VALUE_BASELINE = 0.31;

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardImage({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  const src = hidden ? getBackImagePath() : getCardImagePath(card);
  const label = hidden ? "Face-down card" : `${card.rank} of ${card.suit}`;
  return (
    <div className="card-slot">
      <Image src={src} alt={label} width={64} height={88} className="card-img" priority />
    </div>
  );
}

function EmptySlot() {
  return <div className="card-slot card-slot--empty" aria-label="Empty card slot" />;
}

function TutorSidebar({
  messages,
  loading,
  isForcedPhase,
  stage,
  acknowledgeLabel,
  onAcknowledge,
  canHint,
  onHint,
  onStudentMessage,
}: {
  messages: ChatMessage[];
  loading: boolean;
  isForcedPhase: boolean;
  stage: Level2Stage;
  acknowledgeLabel: string;
  onAcknowledge: () => void;
  canHint: boolean;
  onHint: () => void;
  onStudentMessage: (q: string) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    onStudentMessage(q);
  };

  return (
    <aside className="tutor-panel">
      <div className="tutor-panel__heading">Tutor — Stage {stage}</div>

      <div className="tutor-panel__messages">
        {messages.length === 0 && !loading && (
          <p className="tutor-panel__empty">
            The tutor will guide you through Hi-Lo counting as you play.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="tutor-panel__message"
            style={
              m.role === "student"
                ? { background: "#1e3a5f", alignSelf: "flex-end", maxWidth: "90%" }
                : undefined
            }
          >
            {m.role === "student" && (
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "#60a5fa",
                  marginBottom: "0.25rem",
                  fontWeight: 600,
                }}
              >
                You
              </div>
            )}
            {m.text}
          </div>
        ))}
        {loading && (
          <div
            className="tutor-panel__message"
            style={{ color: "#64748b", fontStyle: "italic" }}
          >
            Tutor is thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {isForcedPhase ? (
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #374151" }}>
          <button
            className="action-btn"
            onClick={onAcknowledge}
            disabled={loading || messages.length === 0}
            style={{ width: "100%" }}
          >
            {acknowledgeLabel}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            borderTop: "1px solid #374151",
          }}
        >
          {canHint && (
            <div style={{ padding: "0.75rem 1rem 0" }}>
              <button
                className="action-btn"
                onClick={onHint}
                disabled={loading}
                style={{ background: "#374151", color: "#e2e8f0", width: "100%" }}
              >
                Get Hint
              </button>
            </div>
          )}
          <div className="tutor-panel__input-row">
            <input
              className="tutor-panel__input"
              placeholder="Ask a probability question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              disabled={loading}
            />
            <button
              className="tutor-panel__send"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

// ─── Count Direction Input ────────────────────────────────────────────────────

function CountDirectionInput({
  onSubmit,
  disabled,
  lastInputCorrect,
}: {
  onSubmit: (dir: "positive" | "negative") => void;
  disabled: boolean;
  lastInputCorrect: boolean | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.5rem",
        marginTop: "0.75rem",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        Running count direction?
      </div>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          className="action-btn"
          onClick={() => onSubmit("positive")}
          disabled={disabled}
          style={{
            fontSize: "1.5rem",
            fontWeight: 900,
            minWidth: "3.5rem",
            background: "#166534",
            color: "#4ade80",
          }}
        >
          +
        </button>
        <button
          className="action-btn"
          onClick={() => onSubmit("negative")}
          disabled={disabled}
          style={{
            fontSize: "1.5rem",
            fontWeight: 900,
            minWidth: "3.5rem",
            background: "#7f1d1d",
            color: "#f87171",
          }}
        >
          −
        </button>
      </div>
      {lastInputCorrect !== null && (
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: lastInputCorrect ? "#4ade80" : "#f87171",
          }}
        >
          {lastInputCorrect ? "✓ Correct!" : "✗ Incorrect"}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Level2Session({ level: _level }: { level: Level }) {
  const [state, setState] = useState<Level2State>(getInitialLevel2State);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage2Acknowledged, setStage2Acknowledged] = useState(false);
  const mountFiredRef = useRef(false);

  const { callTutor, loading: tutorLoading } = useTutor({
    onError: () =>
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "tutor", text: "Tutor unavailable. Try again." },
      ]),
  });

  const fireTutor = useCallback(
    async (action: "feedback" | "hint" | "explain", context: string) => {
      const msg = await callTutor(action, context, 2);
      if (msg) setMessages((prev) => [...prev, { id: nextMsgId(), role: "tutor", text: msg }]);
    },
    [callTutor]
  );

  // Stage 1 intro fires once on mount
  useEffect(() => {
    if (mountFiredRef.current) return;
    mountFiredRef.current = true;
    fireTutor("explain", getStageIntroContext(1));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire tutor on phase/stage transitions
  useEffect(() => {
    if (state.stage === 1) return;
    if (state.phase === "tutor-intro") {
      if (state.stage === 3) fireTutor("explain", getStageIntroContext(3));
      else if (state.stage === 4) fireTutor("explain", getStageIntroContext(4));
    } else if (state.phase === "tutor-feedback") {
      fireTutor("feedback", getLevel2GameContext(state));
    }
  }, [state.stage, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stage 2: reveal count direction after round-over
  useEffect(() => {
    if (state.stage !== 2 || state.phase !== "round-over") return;
    const direction = getCountDirection(state.handRunningCount);
    const sign = direction === "positive" ? "+" : direction === "negative" ? "−" : "0";
    const tenPct = Math.round(state.tenValueProbabilityNow * 100);
    const aboveBelow =
      state.tenValueProbabilityNow > TEN_VALUE_BASELINE + 0.005
        ? "above the 31% baseline — the shoe is ten-value rich"
        : state.tenValueProbabilityNow < TEN_VALUE_BASELINE - 0.005
        ? "below the 31% baseline — the shoe is ten-value poor"
        : "right at the 31% baseline";
    const revealMsg = `Running count this hand: ${sign}. P(Ten-Value Now) is ${tenPct}% — ${aboveBelow}.`;
    setMessages((prev) => [...prev, { id: nextMsgId(), role: "tutor", text: revealMsg }]);
    setStage2Acknowledged(false);
  }, [state.stage, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run dealer turn
  useEffect(() => {
    if (state.phase !== "dealer-turn") return;
    setState((s) => runDealerPlay(s));
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleAcknowledge = useCallback(() => {
    setState((s) => {
      if (s.phase === "tutor-intro") {
        if (s.stage === 1) return startNewHand({ ...s, stage: 2 });
        if (s.stage === 3) return startNewHand(s);
        if (s.stage === 4) return startNewHand(s);
      }
      if (s.phase === "tutor-feedback") {
        return advanceAfterFeedback(s);
      }
      return s;
    });
  }, []);

  const handleStage2Next = useCallback(() => {
    setStage2Acknowledged(true);
    setState((s) => advanceAfterStage2Hand(s));
  }, []);

  const handleHit = useCallback(() => {
    setState((s) => (s.phase === "player-turn" ? applyPlayerHit(s) : s));
  }, []);

  const handleStand = useCallback(() => {
    setState((s) => (s.phase === "player-turn" ? applyPlayerStand(s) : s));
  }, []);

  const handleDirectionInput = useCallback(
    (dir: "positive" | "negative") => {
      setState((s) => {
        if (s.playerDirectionInput !== null) return s;
        return submitDirectionInput(s, dir);
      });
    },
    []
  );

  const handleHint = useCallback(() => {
    fireTutor("hint", getLevel2GameContext(state));
  }, [fireTutor, state]);

  const handleStudentMessage = useCallback(
    async (question: string) => {
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "student", text: question },
      ]);
      await fireTutor(
        "explain",
        `Student question: "${question}"\n\n${getLevel2GameContext(state)}`
      );
    },
    [fireTutor, state]
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const playerTotal =
    state.playerHand.length > 0 ? calculateHandValue(state.playerHand) : null;
  const dealerReveal =
    state.phase === "round-over" ||
    state.phase === "dealer-turn" ||
    state.phase === "tutor-feedback";
  const dealerTotal =
    dealerReveal && state.dealerHand.length > 0
      ? calculateHandValue(state.dealerHand)
      : null;

  const isForcedPhase =
    state.phase === "tutor-intro" || state.phase === "tutor-feedback";
  const actionsEnabled = state.phase === "player-turn";

  // Stage 3: show count input after each hand ends (round-over), before tutor-feedback
  // Stage 4: show count input at round-over
  const showCountInput =
    (state.stage === 3 || state.stage === 4) &&
    state.phase === "round-over" &&
    state.playerDirectionInput === null;

  const showCountInputSubmitted =
    (state.stage === 3 || state.stage === 4) &&
    state.phase === "tutor-feedback" &&
    state.playerDirectionInput !== null;

  const tenPct = Math.round(state.tenValueProbabilityNow * 100);
  const tenColor =
    state.tenValueProbabilityNow > TEN_VALUE_BASELINE + 0.005
      ? "#4ade80"
      : state.tenValueProbabilityNow < TEN_VALUE_BASELINE - 0.005
      ? "#f87171"
      : "rgba(255,255,255,0.85)";

  const playerBustPct =
    state.playerBustProbability !== null
      ? `${Math.round(state.playerBustProbability * 100)}%`
      : null;
  const dealerBustPct =
    state.dealerBustProbability !== null
      ? `${Math.round(state.dealerBustProbability * 100)}%`
      : null;

  const direction = getCountDirection(state.handRunningCount);
  const directionSymbol =
    direction === "positive" ? "+" : direction === "negative" ? "−" : "0";
  const directionColor =
    direction === "positive"
      ? "#4ade80"
      : direction === "negative"
      ? "#f87171"
      : "rgba(255,255,255,0.85)";

  const showStreakStage3 = state.stage === 3;
  const showStreakStage4 = state.stage === 4;

  const stageLabel =
    state.stage === 1
      ? "Stage 1 — Hi-Lo Intro"
      : state.stage === 2
      ? "Stage 2 — Observe"
      : state.stage === 3
      ? "Stage 3 — Guided Input"
      : "Stage 4 — Independent";

  const acknowledgeLabel =
    state.phase === "tutor-intro" && state.stage === 1 ? "Got it — Let's Play" : "Got it";

  const outcomeLabel =
    state.lastOutcome === "win"
      ? "You win!"
      : state.lastOutcome === "loss"
      ? "Dealer wins."
      : state.lastOutcome === "push"
      ? "Push."
      : null;

  // ── Session over ──────────────────────────────────────────────────────────

  if (state.phase === "session-over") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "var(--background)",
          padding: "2rem",
        }}
      >
        <div
          style={{
            background: "var(--color-panel-bg)",
            borderRadius: "0.75rem",
            padding: "2.5rem",
            maxWidth: "28rem",
            width: "100%",
            border: "1px solid #374151",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div style={{ fontSize: "2.5rem" }}>🃏</div>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-chip-gold)",
            }}
          >
            Level 2 Complete!
          </h2>
          <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
            You correctly identified the running count direction {STAGE4_STREAK_NEEDED}{" "}
            consecutive times. You can now track whether the shoe is richer or poorer in
            high cards than the 31% Level 1 baseline.
          </p>
          <div
            style={{
              background: "#14532d",
              color: "#4ade80",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontWeight: 600,
            }}
          >
            Streak: {STAGE4_STREAK_NEEDED} / {STAGE4_STREAK_NEEDED} ✓
          </div>
          <div
            style={{
              background: "#1f2937",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.875rem",
              color: "#94a3b8",
            }}
          >
            Session accuracy: {state.correctInputs}/{state.totalInputs} correct direction inputs
          </div>
          <a
            href="/"
            className="action-btn"
            style={{ textAlign: "center", textDecoration: "none" }}
          >
            Back to Levels
          </a>
        </div>
      </div>
    );
  }

  // ── Main game layout ──────────────────────────────────────────────────────

  return (
    <div className="game-layout">
      <div className="game-board">

        {/* Top-left: Stage + probability HUD */}
        <div className="floor-tl">
          <div className="game-hud">
            <div className="game-hud__stat">
              <span className="game-hud__label">Stage</span>
              <span
                className="game-hud__value"
                style={{ fontSize: "0.8125rem" }}
              >
                {stageLabel}
              </span>
            </div>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">P(Ten-Value) Now</span>
              <span className="game-hud__value" style={{ color: tenColor }}>
                {tenPct}%
              </span>
            </div>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">Level 1 Baseline</span>
              <span
                className="game-hud__value"
                style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.875rem" }}
              >
                31%
              </span>
            </div>
            {actionsEnabled && playerBustPct !== null && (
              <>
                <div className="game-hud__divider" />
                <div className="game-hud__stat">
                  <span className="game-hud__label">Bust If Hit</span>
                  <span
                    className={`game-hud__value ${
                      state.playerBustProbability !== null &&
                      state.playerBustProbability >= 0.5
                        ? "game-hud__value--neg"
                        : "game-hud__value--pos"
                    }`}
                  >
                    {playerBustPct}
                  </span>
                </div>
              </>
            )}
            {actionsEnabled && dealerBustPct !== null && (
              <>
                <div className="game-hud__divider" />
                <div className="game-hud__stat">
                  <span className="game-hud__label">Dealer Bust</span>
                  <span className="game-hud__value game-hud__value--pos">
                    {dealerBustPct}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top-right: W/L + count direction (after hand) + streaks */}
        <div
          className="floor-tr"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "0.4rem",
          }}
        >
          <div className="session-record">
            <span className="session-record__label">Session</span>
            <span className="session-record__wl">
              <span className="session-record__wins">W: {state.sessionWins}</span>
              <span className="session-record__sep"> / </span>
              <span className="session-record__losses">L: {state.sessionLosses}</span>
            </span>
          </div>

          {/* Running count direction revealed after hand */}
          {(state.phase === "round-over" || state.phase === "tutor-feedback") &&
            state.playerHand.length > 0 && (
              <div className="session-record" style={{ alignItems: "flex-end" }}>
                <span className="session-record__label">Count Dir.</span>
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 900,
                    color: directionColor,
                  }}
                >
                  {directionSymbol}
                </span>
              </div>
            )}

          {showStreakStage3 && (
            <div className="session-record" style={{ alignItems: "flex-end" }}>
              <span className="session-record__label">Streak (3)</span>
              <span className="session-record__wl" style={{ fontSize: "0.9375rem" }}>
                <span
                  style={{
                    color:
                      state.stage3HandsCorrect > 0
                        ? "#4ade80"
                        : "rgba(255,255,255,0.6)",
                  }}
                >
                  {state.stage3HandsCorrect}
                </span>
                <span className="session-record__sep"> / </span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>
                  {STAGE3_STREAK_NEEDED}
                </span>
              </span>
            </div>
          )}

          {showStreakStage4 && (
            <div className="session-record" style={{ alignItems: "flex-end" }}>
              <span className="session-record__label">Streak (5)</span>
              <span className="session-record__wl" style={{ fontSize: "0.9375rem" }}>
                <span
                  style={{
                    color:
                      state.consecutiveCorrect > 0
                        ? "#4ade80"
                        : "rgba(255,255,255,0.6)",
                  }}
                >
                  {state.consecutiveCorrect}
                </span>
                <span className="session-record__sep"> / </span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>
                  {STAGE4_STREAK_NEEDED}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Felt table */}
        <div className="felt-table">
          <div className="felt-table__dealer">
            <p className="felt-table__zone-label">
              Dealer{dealerTotal !== null ? ` — ${dealerTotal}` : ""}
            </p>
            <div className="felt-table__cards">
              {state.dealerHand.length === 0 ? (
                <>
                  <EmptySlot />
                  <EmptySlot />
                </>
              ) : (
                state.dealerHand.map((card, i) => (
                  <CardImage
                    key={card.id}
                    card={card}
                    hidden={i === 1 && !dealerReveal}
                  />
                ))
              )}
            </div>
          </div>

          <div className="felt-table__divider" />

          <div className="felt-table__player">
            <div className="felt-table__cards">
              {state.playerHand.length === 0 ? (
                <>
                  <EmptySlot />
                  <EmptySlot />
                </>
              ) : (
                state.playerHand.map((card) => (
                  <CardImage key={card.id} card={card} />
                ))
              )}
            </div>
            <p className="felt-table__zone-label">
              Player{playerTotal !== null ? ` — ${playerTotal}` : ""}
            </p>
          </div>

          {outcomeLabel && state.phase === "round-over" && (
            <div
              className={`result-banner${
                state.lastOutcome === "win"
                  ? " result-banner--win"
                  : state.lastOutcome === "loss"
                  ? " result-banner--lose"
                  : ""
              }`}
              style={
                state.lastOutcome === "push"
                  ? {
                      background: "#1e293b",
                      color: "#94a3b8",
                      boxShadow: "0 0 0 3px #475569",
                    }
                  : undefined
              }
            >
              {outcomeLabel}
            </div>
          )}
        </div>

        {/* Count direction input — Stage 3/4, round-over */}
        {showCountInput && (
          <CountDirectionInput
            onSubmit={handleDirectionInput}
            disabled={false}
            lastInputCorrect={null}
          />
        )}

        {/* Count direction feedback badge after submission */}
        {showCountInputSubmitted && (
          <div
            className={`decision-feedback ${
              state.lastInputCorrect
                ? "decision-feedback--correct"
                : "decision-feedback--incorrect"
            }`}
          >
            {state.lastInputCorrect
              ? "✓ Correct count direction"
              : "✗ Wrong count direction"}
          </div>
        )}

        {/* Bottom-left: Hit / Stand */}
        <div className="floor-bl">
          <button
            className="action-btn"
            onClick={handleHit}
            disabled={!actionsEnabled}
          >
            Hit
          </button>
          <button
            className="action-btn"
            onClick={handleStand}
            disabled={!actionsEnabled}
          >
            Stand
          </button>
        </div>

        {/* Stage 2 round-over: Next Hand button (after tutor reveals count) */}
        {state.stage === 2 && state.phase === "round-over" && (
          <div className="floor-br">
            <button
              className="action-btn action-btn--deal"
              onClick={handleStage2Next}
            >
              {state.stage2HandsPlayed + 1 >= STAGE2_HAND_COUNT
                ? "Continue"
                : "Next Hand"}
            </button>
          </div>
        )}
      </div>

      <TutorSidebar
        messages={messages}
        loading={tutorLoading}
        isForcedPhase={isForcedPhase}
        stage={state.stage}
        acknowledgeLabel={acknowledgeLabel}
        onAcknowledge={handleAcknowledge}
        canHint={actionsEnabled}
        onHint={handleHint}
        onStudentMessage={handleStudentMessage}
      />
    </div>
  );
}
