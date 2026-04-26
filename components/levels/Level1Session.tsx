"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Level } from "@/lib/types";
import type { Card } from "@/lib/cards";
import { getCardImagePath, getBackImagePath, calculateHandValue } from "@/game/cardUtils";
import { useTutor } from "@/lib/useTutor";
import {
  type Level1State,
  type Level1Stage,
  type Level1Phase,
  HANDS_PER_STAGE,
  TEN_VALUE_CARD_COUNT,
  getInitialLevel1State,
  startNewHand,
  applyPlayerHit,
  applyPlayerStand,
  applyPendingHitCard,
  runDealerPlay,
  formatCardFraction,
  getPlayerBustFraction,
  getHandFeedbackContext,
  getFeedbackReflectionContext,
  getStageQuestionContext,
  getStudentAnswerContext,
  getStudentQuestionContext,
  getStageAdvanceContext,
  getStageIntroContext,
} from "@/game/levels/level1/gameLogic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  role: "tutor" | "student";
  text: string;
}

let _msgId = 0;
const nextMsgId = () => ++_msgId;

function cleanTutorText(text: string): string {
  const metadataLine = /^\s*(message_type|stage|student_goal|teaching_points|flow_note|forbidden|response_style|student_prompt|student_answer|student_question|decision_index|decision_result|student_action|level1_probability_action|level1_probability_action_hidden|opening_sentence|player_hand|player_total|player_bust_fraction_if_hit|player_bust_fraction_hidden|player_bust_category|player_bust_category_hidden|dealer_upcard|assumed_dealer_upcard|assumed_dealer_total|assumed_dealer_total_hidden|correct_assumed_dealer_total|correct_assumed_dealer_total_hidden|assumed_dealer_bust_fraction_if_forced_to_hit|assumed_dealer_bust_fraction_if_forced_to_hit_hidden|hand_outcome|session_accuracy|answer_result|estimate_result|comparison_hidden|correct_comparison|concept_covered|hands_played)\s*:/i;
  const cleanedLines = text
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(Explain|Game state|Tutor request|Task)\s*:\s*/i, "")
        .replace(/^\s*\[[A-Z0-9_]+\]\s*/i, "")
        .replace(/^\s*Stage\s+\d+\s*:\s*/i, "")
        .trim()
    )
    .filter((line) => line && !metadataLine.test(line));

  return cleanedLines.join(" ").replace(/\s+/g, " ").trim();
}

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
  messages, loading, phase, stage,
  onAcknowledge, onKeepPracticing, onAdvanceStage,
  canHint, canContinueFeedback, feedbackContinueLabel, onHint, onStudentMessage,
}: {
  messages: ChatMessage[];
  loading: boolean;
  phase: Level1Phase;
  stage: Level1Stage;
  onAcknowledge: () => void;
  onKeepPracticing: () => void;
  onAdvanceStage: () => void;
  canHint: boolean;
  canContinueFeedback: boolean;
  feedbackContinueLabel: string;
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

  const isIntro = phase === "tutor-intro";
  const isAdvance = phase === "tutor-advance";
  const isFeedback = phase === "tutor-feedback";
  const isPlaying = phase === "player-turn";

  return (
    <aside className="tutor-panel">
      <div className="tutor-panel__heading">Tutor — Stage {stage}</div>

      <div className="tutor-panel__messages">
        {messages.length === 0 && !loading && (
          <p className="tutor-panel__empty">
            The tutor will guide you through probability concepts as you play.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="tutor-panel__message"
            style={m.role === "student" ? {
              background: "#1e3a5f", alignSelf: "flex-end", maxWidth: "90%",
            } : undefined}
          >
            {m.role === "student" && (
              <div style={{ fontSize: "0.6875rem", color: "#60a5fa", marginBottom: "0.25rem", fontWeight: 600 }}>
                You
              </div>
            )}
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="tutor-panel__message" style={{ color: "#64748b", fontStyle: "italic" }}>
            Tutor is thinking...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: "1px solid #374151" }}>
        {isIntro && (
          <div style={{ padding: "0.75rem 1rem" }}>
            <button
              className="action-btn"
              onClick={onAcknowledge}
              disabled={loading || messages.length === 0}
              style={{ width: "100%" }}
            >
              {stage === 0 ? "Let's Play" : "Got it — Let's Play"}
            </button>
          </div>
        )}

        {isAdvance && (
          <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              className="action-btn action-btn--deal"
              onClick={onAdvanceStage}
              disabled={loading}
              style={{ width: "100%" }}
            >
              I&apos;m Ready — Next Stage
            </button>
            <button
              className="action-btn"
              onClick={onKeepPracticing}
              disabled={loading}
              style={{ background: "#374151", color: "#e2e8f0", width: "100%" }}
            >
              Keep Practicing
            </button>
          </div>
        )}

        {isFeedback && (
          <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
              className="action-btn action-btn--deal"
              onClick={onAcknowledge}
              disabled={loading || !canContinueFeedback}
              style={{ width: "100%" }}
            >
              {feedbackContinueLabel}
            </button>
            <div className="tutor-panel__input-row">
              <input
                className="tutor-panel__input"
                placeholder="Answer the tutor's question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={loading}
              />
              <button className="tutor-panel__send" onClick={handleSend} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
          </div>
        )}

        {isPlaying && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
                placeholder="Answer the tutor or ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={loading}
              />
              <button className="tutor-panel__send" onClick={handleSend} disabled={loading || !input.trim()}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Level1Session({ level }: { level: Level }) {
  const [state, setState] = useState<Level1State>(getInitialLevel1State);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [feedbackAnsweredDecisionKey, setFeedbackAnsweredDecisionKey] = useState<string | null>(null);
  void level;

  const mountFiredRef = useRef(false);
  const lastQuestionedHandRef = useRef(-1);
  const lastAnsweredHandRef = useRef(-1);

  const { callTutor, loading: tutorLoading } = useTutor({
    onError: () =>
      setMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "tutor", text: "Tutor unavailable. Try again." },
      ]),
  });

  const fireTutor = useCallback(
    async (action: "feedback" | "hint" | "explain", context: string) => {
      const msg = await callTutor(action, context, 1);
      const cleanMsg = msg ? cleanTutorText(msg) : "";
      if (cleanMsg) setMessages((prev) => [...prev, { id: nextMsgId(), role: "tutor", text: cleanMsg }]);
    },
    [callTutor]
  );

  // Stage 0 intro on mount
  useEffect(() => {
    if (mountFiredRef.current) return;
    mountFiredRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fireTutor("explain", getStageIntroContext(0));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stage intro for stages 1-4 when entering tutor-intro
  useEffect(() => {
    if (state.phase !== "tutor-intro" || state.stage === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fireTutor("explain", getStageIntroContext(state.stage));
  }, [state.stage, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Per-hand question for stages 1-3 when a new hand is dealt
  useEffect(() => {
    if (state.phase !== "player-turn") return;
    if (state.stage < 1 || state.stage > 3) return;
    if (lastQuestionedHandRef.current === state.handId) return;
    lastQuestionedHandRef.current = state.handId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fireTutor("explain", getStageQuestionContext(state));
  }, [state.handId, state.phase, state.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tutor feedback after each player decision
  useEffect(() => {
    if (state.phase !== "tutor-feedback") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fireTutor("feedback", getHandFeedbackContext(state));
  }, [state.phase, state.handId, state.pendingFeedbackDecisionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stage advance check when entering tutor-advance
  useEffect(() => {
    if (state.phase !== "tutor-advance") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fireTutor("explain", getStageAdvanceContext(state));
  }, [state.phase, state.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run dealer
  useEffect(() => {
    if (state.phase !== "dealer-turn") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => runDealerPlay(s));
  }, [state.phase]);

  // Auto-advance from round-over
  useEffect(() => {
    if (state.phase !== "round-over") return;
    const timer = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "round-over") return s;
        const handsAfter = s.handsInStage + 1;
        const base = { ...s, handsInStage: handsAfter };
        return handsAfter >= HANDS_PER_STAGE
          ? { ...base, phase: "tutor-advance" }
          : startNewHand(base);
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [state.phase, state.handId]);

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleAcknowledge = useCallback(() => {
    setState((s) => {
      if (s.phase === "tutor-intro") return startNewHand(s);
      if (s.phase === "tutor-feedback") {
        const feedbackKey = `${s.handId}:${s.pendingFeedbackDecisionIndex ?? "none"}`;
        if (s.handDecisions.length > 0 && feedbackAnsweredDecisionKey !== feedbackKey) return s;
        if (!s.phaseAfterFeedback) return s;
        const nextState = s.pendingHitCard ? applyPendingHitCard(s) : s;
        return {
          ...nextState,
          phase: s.phaseAfterFeedback,
          pendingFeedbackDecisionIndex: null,
          phaseAfterFeedback: null,
        };
      }
      return s;
    });
  }, [feedbackAnsweredDecisionKey]);

  const handleAdvanceStage = useCallback(() => {
    setState((s) => {
      if (s.phase !== "tutor-advance") return s;
      if (s.stage === 4) return { ...s, phase: "session-over", sessionComplete: true };
      const nextStage = (s.stage + 1) as Level1Stage;
      return { ...s, stage: nextStage, phase: "tutor-intro", handsInStage: 0 };
    });
  }, []);

  const handleKeepPracticing = useCallback(() => {
    setState((s) => {
      if (s.phase !== "tutor-advance") return s;
      return startNewHand({ ...s, handsInStage: 0 });
    });
  }, []);

  const handleHit = useCallback(() => {
    setState((s) => (s.phase === "player-turn" ? applyPlayerHit(s) : s));
  }, []);

  const handleStand = useCallback(() => {
    setState((s) => (s.phase === "player-turn" ? applyPlayerStand(s) : s));
  }, []);

  const handleHint = useCallback(() => {
    fireTutor("hint", getHandFeedbackContext(state));
  }, [fireTutor, state]);

  const handleStudentMessage = useCallback(
    async (question: string) => {
      setMessages((prev) => [...prev, { id: nextMsgId(), role: "student", text: question }]);

      if (state.phase === "tutor-advance") {
        const lower = question.toLowerCase();
        const wantsAdvance = lower.includes("yes") || lower.includes("ready") || lower.includes("next") || lower.includes("move");
        if (wantsAdvance) handleAdvanceStage();
        else handleKeepPracticing();
        return;
      }

      if (state.phase === "tutor-feedback") {
        const looksLikeQuestion =
          /\?$/.test(question.trim()) ||
          /^(why|how|what|when|where|who|which|is|are|do|does|can|could|should|would|will)\b/i.test(question.trim());
        if (looksLikeQuestion) {
          await fireTutor("explain", getStudentQuestionContext(state, question));
          return;
        }
        setFeedbackAnsweredDecisionKey(`${state.handId}:${state.pendingFeedbackDecisionIndex ?? "none"}`);
        await fireTutor("explain", getFeedbackReflectionContext(state, question));
        return;
      }

      if (state.phase === "player-turn" && state.stage >= 1 && state.stage <= 3) {
        if (lastAnsweredHandRef.current !== state.handId) {
          lastAnsweredHandRef.current = state.handId;
          await fireTutor("explain", getStudentAnswerContext(state, question));
          return;
        }
      }

      await fireTutor("explain", getStudentQuestionContext(state, question));
    },
    [fireTutor, state, handleAdvanceStage, handleKeepPracticing]
  );

  // ── Derived values ───────────────────────────────────────────────────────────

  const playerTotal = state.playerHand.length > 0 ? calculateHandValue(state.playerHand) : null;
  const dealerReveal =
    state.phase === "round-over" ||
    state.phase === "dealer-turn";
  const dealerTotal =
    dealerReveal && state.dealerHand.length > 0 ? calculateHandValue(state.dealerHand) : null;
  const actionsEnabled = state.phase === "player-turn";
  const tenFraction = formatCardFraction(TEN_VALUE_CARD_COUNT);
  const handInProgress =
    state.playerHand.length > 0 &&
    (state.phase === "player-turn" || state.phase === "tutor-feedback" || state.phase === "dealer-turn");
  const playerBustFraction =
    state.playerHand.length > 0 && state.playerBustProbability !== null
      ? getPlayerBustFraction(state.playerHand)
      : null;
  const assumedDealerTotal =
    state.assumedDealerTotal !== null && handInProgress
      ? state.assumedDealerTotal
      : null;
  const feedbackRequiresAnswer = state.phase === "tutor-feedback" && state.handDecisions.length > 0;
  const currentFeedbackDecisionKey =
    state.pendingFeedbackDecisionIndex !== null ? `${state.handId}:${state.pendingFeedbackDecisionIndex}` : null;
  const canContinueFeedback =
    !feedbackRequiresAnswer ||
    (currentFeedbackDecisionKey !== null && feedbackAnsweredDecisionKey === currentFeedbackDecisionKey);
  const feedbackContinueLabel = state.phase === "tutor-feedback" ? "Continue" : "Next Hand";

  const outcomeLabel =
    state.lastOutcome === "win" ? "You win!" :
    state.lastOutcome === "loss" ? "Dealer wins." :
    state.lastOutcome === "push" ? "Push." : null;

  const firstDecision = state.handDecisions[0] ?? null;
  const showDecisionBadge =
    firstDecision !== null &&
    (state.phase === "round-over" || state.phase === "tutor-feedback");
  const allDecisionsCorrect = state.handDecisions.every(d => d.correct);

  const stageLabel =
    state.stage === 0 ? "Stage 0 — Basics" :
    state.stage === 1 ? "Stage 1 — Assume 10" :
    state.stage === 2 ? "Stage 2 — Compare Totals" :
    state.stage === 3 ? "Stage 3 — Gap and Risk" :
    "Stage 4 — Decision Quality";

  // ── Session over ─────────────────────────────────────────────────────────────

  if (state.phase === "session-over") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--background)", padding: "2rem",
      }}>
        <div style={{
          background: "var(--color-panel-bg)", borderRadius: "0.75rem",
          padding: "2.5rem", maxWidth: "28rem", width: "100%",
          border: "1px solid #374151", textAlign: "center",
          display: "flex", flexDirection: "column", gap: "1.25rem",
        }}>
          <div style={{ fontSize: "2.5rem" }}>🃏</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-chip-gold)" }}>
            Level 1 Complete!
          </h2>
          <p style={{ color: "#94a3b8", lineHeight: 1.6 }}>
            You worked through all five stages: blackjack basics, the assume-10 rule, comparing totals,
            gap and risk, and decision quality over outcomes.
          </p>
          <div style={{
            background: "#14532d", color: "#4ade80",
            borderRadius: "0.5rem", padding: "0.75rem", fontWeight: 600,
          }}>
            Accuracy: {state.correctDecisions} / {state.totalDecisions} correct decisions
          </div>
          <Link href="/" className="action-btn" style={{ textAlign: "center", textDecoration: "none" }}>
            Back to Levels
          </Link>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="game-layout">
      <div className="game-board">

        {/* HUD — top left */}
        <div className="floor-tl">
          <div className="game-hud">
            <div className="game-hud__stat">
              <span className="game-hud__label">Stage</span>
              <span className="game-hud__value" style={{ fontSize: "0.8125rem" }}>{stageLabel}</span>
            </div>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">Ten-Value Cards</span>
              <span className="game-hud__value game-hud__value--pos">{tenFraction}</span>
            </div>
            {actionsEnabled && playerBustFraction !== null && (
              <>
                <div className="game-hud__divider" />
                <div className="game-hud__stat">
                  <span className="game-hud__label">Bust If Hit</span>
                  <span className={`game-hud__value ${
                    state.playerBustProbability !== null && state.playerBustProbability >= 0.5
                      ? "game-hud__value--neg"
                      : "game-hud__value--pos"
                  }`}>
                    {playerBustFraction}
                  </span>
                </div>
              </>
            )}
            {assumedDealerTotal !== null && (
              <>
                <div className="game-hud__divider" />
                <div className="game-hud__stat">
                  <span className="game-hud__label">Assumed Dealer</span>
                  <span className="game-hud__value game-hud__value--pos">{assumedDealerTotal}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Session record — top right */}
        <div className="floor-tr" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
          <div className="session-record">
            <span className="session-record__label">Session</span>
            <span className="session-record__wl">
              <span className="session-record__wins">W: {state.sessionWins}</span>
              <span className="session-record__sep"> / </span>
              <span className="session-record__losses">L: {state.sessionLosses}</span>
            </span>
          </div>
          <div className="session-record">
            <span className="session-record__label">Accuracy</span>
            <span className="session-record__wl">
              <span style={{ color: "#4ade80" }}>{state.correctDecisions}</span>
              <span className="session-record__sep"> / </span>
              <span style={{ color: "rgba(255,255,255,0.6)" }}>{state.totalDecisions}</span>
            </span>
          </div>
        </div>

        {/* Felt table */}
        <div className="felt-table">
          <div className="felt-table__dealer">
            <p className="felt-table__zone-label">
              Dealer{dealerTotal !== null ? ` — ${dealerTotal}` : ""}
            </p>
            <div className="felt-table__cards">
              {state.dealerHand.length === 0
                ? <><EmptySlot /><EmptySlot /></>
                : state.dealerHand.map((card, i) => (
                  <CardImage key={card.id} card={card} hidden={i === 1 && !dealerReveal} />
                ))
              }
            </div>
          </div>

          <div className="felt-table__divider" />

          <div className="felt-table__player">
            <div className="felt-table__cards">
              {state.playerHand.length === 0
                ? <><EmptySlot /><EmptySlot /></>
                : state.playerHand.map((card) => (
                  <CardImage key={card.id} card={card} />
                ))
              }
            </div>
            <p className="felt-table__zone-label">
              Player{playerTotal !== null ? ` — ${playerTotal}` : ""}
            </p>
          </div>

          {outcomeLabel && state.phase === "round-over" && (
            <div
              className={`result-banner${
                state.lastOutcome === "win" ? " result-banner--win" :
                state.lastOutcome === "loss" ? " result-banner--lose" : ""
              }`}
              style={state.lastOutcome === "push"
                ? { background: "#1e293b", color: "#94a3b8", boxShadow: "0 0 0 3px #475569" }
                : undefined}
            >
              {outcomeLabel}
            </div>
          )}
        </div>

        {/* Decision badge */}
        {showDecisionBadge && (
          <div className={`decision-feedback ${
            allDecisionsCorrect ? "decision-feedback--correct" : "decision-feedback--incorrect"
          }`}>
            {allDecisionsCorrect ? "Decision correct" : "See tutor for feedback"}
          </div>
        )}

        {/* Hit / Stand */}
        <div className="floor-bl">
          <button className="action-btn" onClick={handleHit} disabled={!actionsEnabled}>
            Hit
          </button>
          <button className="action-btn" onClick={handleStand} disabled={!actionsEnabled}>
            Stand
          </button>
        </div>
      </div>

      <TutorSidebar
        messages={messages}
        loading={tutorLoading}
        phase={state.phase}
        stage={state.stage}
        onAcknowledge={handleAcknowledge}
        onKeepPracticing={handleKeepPracticing}
        onAdvanceStage={handleAdvanceStage}
        canHint={actionsEnabled}
        canContinueFeedback={canContinueFeedback}
        feedbackContinueLabel={feedbackContinueLabel}
        onHint={handleHint}
        onStudentMessage={handleStudentMessage}
      />
    </div>
  );
}
