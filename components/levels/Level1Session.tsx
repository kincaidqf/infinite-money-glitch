"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { Level } from "@/lib/types";
import type { Card } from "@/lib/cards";
import { getCardImagePath, getBackImagePath, calculateHandValue } from "@/game/cardUtils";
import { useTutor } from "@/lib/useTutor";
import {
  type Level1State,
  type Level1Stage,
  STAGE2_HAND_COUNT,
  STAGE4_HAND_COUNT,
  STAGE5_BLOCK_SIZE,
  WIN_STREAK,
  TEN_VALUE_PROBABILITY,
  getInitialLevel1State,
  startNewHand,
  applyPlayerHit,
  applyPlayerStand,
  runDealerPlay,
  getLevel1GameContext,
  getStageIntroContext,
  isConsecutiveWin,
  appendBlockHandSummary,
} from "@/game/levels/level1/gameLogic";
import {
  computeBustQuizData,
  computeSoftHandQuizData,
  evaluateStep1,
  evaluateStep2,
  evaluateSoftStep1,
  getStage5QuizInitialContext,
  getStage5QuizStep1EvalContext,
  getStage5QuizStep2EvalContext,
  getStage5QuizStep3EvalContext,
  getSoftHandQuizInitialContext,
  getSoftHandQuizStep1EvalContext,
} from "@/game/levels/level1/quizLogic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: number;
  role: "tutor" | "student";
  text: string;
}

// Separate state for soft-hand quiz flow (not stored in Level1State to keep it lightweight)
interface SoftQuizState {
  active: true;
  data: ReturnType<typeof computeSoftHandQuizData>;
  step: 1 | 2;
}

let _msgId = 0;
const nextMsgId = () => ++_msgId;

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
  showContinue,
  onContinue,
}: {
  messages: ChatMessage[];
  loading: boolean;
  isForcedPhase: boolean;
  stage: Level1Stage;
  acknowledgeLabel: string;
  onAcknowledge: () => void;
  canHint: boolean;
  onHint: () => void;
  onStudentMessage: (q: string) => void;
  showContinue?: boolean;
  onContinue?: () => void;
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
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: "1px solid #374151" }}>
          {showContinue && (
            <div style={{ padding: "0.75rem 1rem 0" }}>
              <button
                className="action-btn action-btn--deal"
                onClick={onContinue}
                disabled={loading}
                style={{ width: "100%" }}
              >
                Continue
              </button>
            </div>
          )}
          {canHint && !showContinue && (
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
              placeholder={showContinue ? "Ask a follow-up question..." : "Ask a probability question..."}
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

// ─── Pure helper ──────────────────────────────────────────────────────────────

function advanceAfterRound(
  s: Level1State,
  softQuizSetter: (q: SoftQuizState | null) => void
): Level1State {
  if (s.stage === 2) {
    const handsAfter = s.stage2HandsPlayed + 1;
    if (handsAfter >= STAGE2_HAND_COUNT) {
      return { ...s, stage: 3, phase: "tutor-intro", stage2HandsPlayed: handsAfter };
    }
    return startNewHand({ ...s, stage2HandsPlayed: handsAfter });
  }

  if (s.stage === 4) return { ...s, phase: "tutor-feedback" };

  if (s.stage === 5) {
    const firstDecision = s.handDecisions[0] ?? null;

    // Soft hand wrong hit: trigger soft quiz (managed outside game state)
    if (
      firstDecision &&
      !firstDecision.correct &&
      firstDecision.action === "hit" &&
      firstDecision.soft
    ) {
      const quizData = computeSoftHandQuizData(firstDecision.total, s.dealerHand[0]?.rank ?? "?");
      softQuizSetter({ active: true, data: quizData, step: 1 });
      return { ...s, phase: "bust-quiz" };
    }

    // Hard wrong decision: trigger probability quiz
    if (
      firstDecision &&
      !firstDecision.correct &&
      s.lastWrongDecision !== null &&
      s.lastWrongDecisionTotal !== null
    ) {
      const bustQuizData = computeBustQuizData(
        s.lastWrongDecision,
        s.lastWrongDecisionTotal,
        s.lastWrongDecisionSoft ?? false,
        s.dealerHand[0]?.rank ?? "?"
      );
      return { ...s, phase: "bust-quiz", bustQuizData, bustQuizStep: 1 };
    }

    const blockHandsAfter = s.stage5BlockHandsPlayed + 1;
    const updatedLog = appendBlockHandSummary(s, blockHandsAfter);

    if (blockHandsAfter >= STAGE5_BLOCK_SIZE) {
      return { ...s, phase: "tutor-feedback", stage5BlockHandsPlayed: blockHandsAfter, blockDecisionLog: updatedLog };
    }
    return startNewHand({ ...s, stage5BlockHandsPlayed: blockHandsAfter, blockDecisionLog: updatedLog });
  }

  return s;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Level1Session({ level: _level }: { level: Level }) {
  const [state, setState] = useState<Level1State>(getInitialLevel1State);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [softQuiz, setSoftQuiz] = useState<SoftQuizState | null>(null);
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
      const msg = await callTutor(action, context, 1);
      if (msg) setMessages((prev) => [...prev, { id: nextMsgId(), role: "tutor", text: msg }]);
    },
    [callTutor]
  );

  // Stage 1: fire intro exactly once on mount
  useEffect(() => {
    if (mountFiredRef.current) return;
    mountFiredRef.current = true;
    fireTutor("explain", getStageIntroContext(1));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subsequent tutor-intro, tutor-feedback, and bust-quiz phases (stages 3+)
  useEffect(() => {
    if (state.stage === 1) return;
    if (state.phase === "tutor-intro") {
      if (state.stage === 3) fireTutor("explain", getStageIntroContext(3));
      else if (state.stage === 4 && !state.stage4IntroShown) fireTutor("explain", getStageIntroContext(4));
    } else if (state.phase === "tutor-feedback") {
      fireTutor("feedback", getLevel1GameContext(state));
    } else if (state.phase === "bust-quiz") {
      if (softQuiz?.active) {
        fireTutor("explain", getSoftHandQuizInitialContext(softQuiz.data));
      } else if (state.bustQuizData) {
        fireTutor("explain", getStage5QuizInitialContext(state.bustQuizData));
      }
    }
  }, [state.stage, state.phase, softQuiz]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run dealer turn
  useEffect(() => {
    if (state.phase !== "dealer-turn") return;
    setState((s) => runDealerPlay(s));
  }, [state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance from round-over in stages 4 and 5
  useEffect(() => {
    if (state.phase !== "round-over" || (state.stage !== 4 && state.stage !== 5)) return;
    const timer = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "round-over") return s;
        return advanceAfterRound(s, setSoftQuiz);
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [state.phase, state.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleAcknowledge = useCallback(() => {
    setState((s) => {
      if (s.phase === "tutor-intro") {
        if (s.stage === 1) return startNewHand({ ...s, stage: 2 });
        if (s.stage === 3) return { ...s, stage: 4, phase: "tutor-intro", stage4IntroShown: false };
        if (s.stage === 4) return startNewHand({ ...s, stage4IntroShown: true });
      }
      if (s.phase === "tutor-feedback") {
        if (s.stage === 4) {
          const handsAfter = s.stage4HandsPlayed + 1;
          if (handsAfter >= STAGE4_HAND_COUNT) {
            return startNewHand({ ...s, stage: 5, stage4HandsPlayed: handsAfter, consecutiveCorrect: 0, stage5BlockHandsPlayed: 0, blockDecisionLog: [] });
          }
          return startNewHand({ ...s, stage4HandsPlayed: handsAfter });
        }
        if (s.stage === 5) {
          if (isConsecutiveWin(s.consecutiveCorrect)) {
            return { ...s, phase: "session-over", sessionComplete: true };
          }
          return startNewHand({ ...s, consecutiveCorrect: 0, stage5BlockHandsPlayed: 0, blockDecisionLog: [] });
        }
      }
      if (s.phase === "bust-quiz") {
        setSoftQuiz(null);
        return startNewHand({ ...s, stage5BlockHandsPlayed: 0, blockDecisionLog: [] });
      }
      return s;
    });
  }, []);

  const handleHit = useCallback(() => {
    setState((s) => (s.phase === "player-turn" ? applyPlayerHit(s) : s));
  }, []);

  const handleStand = useCallback(() => {
    setState((s) => (s.phase === "player-turn" ? applyPlayerStand(s) : s));
  }, []);

  const handleNextHand = useCallback(() => {
    setState((s) => (s.phase === "round-over" ? advanceAfterRound(s, setSoftQuiz) : s));
  }, []);

  const handleHint = useCallback(() => {
    fireTutor("hint", getLevel1GameContext(state));
  }, [fireTutor, state]);

  const handleStudentMessage = useCallback(
    async (question: string) => {
      setMessages((prev) => [...prev, { id: nextMsgId(), role: "student", text: question }]);

      if (state.phase === "bust-quiz") {
        // Soft hand quiz path
        if (softQuiz?.active) {
          if (softQuiz.step === 1) {
            const { correct } = evaluateSoftStep1(softQuiz.data, question);
            if (correct) setSoftQuiz((q) => q ? { ...q, step: 2 } : null);
            await fireTutor("explain", getSoftHandQuizStep1EvalContext(softQuiz.data, question, correct));
          } else {
            await fireTutor("explain", `Student follow-up after soft quiz: "${question}"\n\n${getLevel1GameContext(state)}`);
          }
          return;
        }

        // Hard hand quiz path
        if (state.bustQuizData) {
          const step = state.bustQuizStep;
          if (step === 1) {
            const { correct, hint } = evaluateStep1(state.bustQuizData, question);
            if (correct) setState((s) => ({ ...s, bustQuizStep: 2 as const }));
            await fireTutor("explain", getStage5QuizStep1EvalContext(state.bustQuizData, question, correct, hint));
          } else if (step === 2) {
            const { correct, hint } = evaluateStep2(state.bustQuizData, question);
            if (correct) setState((s) => ({ ...s, bustQuizStep: 3 as const }));
            await fireTutor("explain", getStage5QuizStep2EvalContext(state.bustQuizData, question, correct, hint));
          } else if (step === 3) {
            setState((s) => ({ ...s, bustQuizStep: 4 as const }));
            await fireTutor("explain", getStage5QuizStep3EvalContext(state.bustQuizData, question));
          } else {
            await fireTutor("explain", `Student follow-up after quiz: "${question}"\n\n${getLevel1GameContext(state)}`);
          }
        }
        return;
      }

      await fireTutor("explain", `Student question: "${question}"\n\n${getLevel1GameContext(state)}`);
    },
    [fireTutor, state, softQuiz]
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const playerTotal = state.playerHand.length > 0 ? calculateHandValue(state.playerHand) : null;
  const dealerReveal =
    state.phase === "round-over" ||
    state.phase === "dealer-turn" ||
    state.phase === "tutor-feedback";
  const dealerTotal =
    dealerReveal && state.dealerHand.length > 0 ? calculateHandValue(state.dealerHand) : null;
  const isForcedPhase = state.phase === "tutor-intro" || state.phase === "tutor-feedback";

  // Continue button appears after quiz step 4 (hard) or soft quiz step 2
  const showQuizContinue =
    state.phase === "bust-quiz" &&
    (state.bustQuizStep === 4 || (softQuiz?.active && softQuiz.step === 2));

  const actionsEnabled = state.phase === "player-turn";
  const showStreak = state.stage === 5;
  const tenPct = `${Math.round(TEN_VALUE_PROBABILITY * 100)}%`;
  const playerBustPct =
    state.playerBustProbability !== null
      ? `${Math.round(state.playerBustProbability * 100)}%`
      : null;
  const dealerBustPct =
    state.dealerBustProbability !== null
      ? `${Math.round(state.dealerBustProbability * 100)}%`
      : null;

  const stageLabel =
    state.stage === 1 ? "Stage 1 — Intro" :
    state.stage === 2 ? "Stage 2 — Free Play" :
    state.stage === 3 ? "Stage 3 — Strategy" :
    state.stage === 4 ? "Stage 4 — Guided" :
    "Stage 5 — Free Play";

  const acknowledgeLabel =
    state.phase === "tutor-intro" && state.stage === 1 ? "Let's Play" : "Got it";

  const outcomeLabel =
    state.lastOutcome === "win" ? "You win!" :
    state.lastOutcome === "loss" ? "Dealer wins." :
    state.lastOutcome === "push" ? "Push." : null;

  // Decision badge: show only when the first decision is recorded
  const firstDecision = state.handDecisions[0] ?? null;
  const showDecisionBadge =
    firstDecision !== null &&
    (state.phase === "round-over" || state.phase === "tutor-feedback");
  const allDecisionsCorrect = state.handDecisions.length > 0 && state.handDecisions.every(d => d.correct);
  const anyDecisionWrong = state.handDecisions.some(d => !d.correct);

  // ── Session over ──────────────────────────────────────────────────────────

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
            You made {WIN_STREAK} consecutive correct probability-based decisions.
            You understand how the 31% ten-value rate shapes every hit/stand choice.
          </p>
          <div style={{
            background: "#14532d", color: "#4ade80",
            borderRadius: "0.5rem", padding: "0.75rem", fontWeight: 600,
          }}>
            Streak: {WIN_STREAK} / {WIN_STREAK}
          </div>
          <a href="/" className="action-btn" style={{ textAlign: "center", textDecoration: "none" }}>
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

        {/* Top-left: Stage + probability stats */}
        <div className="floor-tl">
          <div className="game-hud">
            <div className="game-hud__stat">
              <span className="game-hud__label">Stage</span>
              <span className="game-hud__value" style={{ fontSize: "0.8125rem" }}>{stageLabel}</span>
            </div>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">P(Ten-Value)</span>
              <span className="game-hud__value game-hud__value--pos">{tenPct}</span>
            </div>
            {actionsEnabled && playerBustPct !== null && (
              <>
                <div className="game-hud__divider" />
                <div className="game-hud__stat">
                  <span className="game-hud__label">Bust If Hit</span>
                  <span className={`game-hud__value ${
                    state.playerBustProbability !== null && state.playerBustProbability >= 0.5
                      ? "game-hud__value--neg"
                      : "game-hud__value--pos"
                  }`}>
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
                  <span className="game-hud__value game-hud__value--pos">{dealerBustPct}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Top-right: W/L + streak counter */}
        <div className="floor-tr" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
          <div className="session-record">
            <span className="session-record__label">Session</span>
            <span className="session-record__wl">
              <span className="session-record__wins">W: {state.sessionWins}</span>
              <span className="session-record__sep"> / </span>
              <span className="session-record__losses">L: {state.sessionLosses}</span>
            </span>
          </div>
          {showStreak && (
            <div className="session-record" style={{ alignItems: "flex-end" }}>
              <span className="session-record__label">Streak</span>
              <span className="session-record__wl" style={{ fontSize: "0.9375rem" }}>
                <span style={{ color: state.consecutiveCorrect > 0 ? "#4ade80" : "rgba(255,255,255,0.6)" }}>
                  {state.consecutiveCorrect}
                </span>
                <span className="session-record__sep"> / </span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{WIN_STREAK}</span>
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

        {/* Decision correctness badge — reflects all decisions, not just first */}
        {showDecisionBadge && (
          <div className={`decision-feedback ${
            allDecisionsCorrect ? "decision-feedback--correct" :
            anyDecisionWrong ? "decision-feedback--incorrect" : "decision-feedback--correct"
          }`}>
            {allDecisionsCorrect
              ? `All ${state.handDecisions.length} decision${state.handDecisions.length > 1 ? "s" : ""} correct`
              : `Incorrect decision${anyDecisionWrong && state.handDecisions.length > 1 ? " (see tutor)" : ""}`}
          </div>
        )}

        {/* Bottom-left: Hit / Stand */}
        <div className="floor-bl">
          <button className="action-btn" onClick={handleHit} disabled={!actionsEnabled}>
            Hit
          </button>
          <button className="action-btn" onClick={handleStand} disabled={!actionsEnabled}>
            Stand
          </button>
        </div>

        {/* Bottom-right: Next Hand button (Stage 2 only) */}
        {state.stage === 2 && state.phase === "round-over" && (
          <div className="floor-br">
            <button className="action-btn action-btn--deal" onClick={handleNextHand}>
              {state.stage2HandsPlayed + 1 >= STAGE2_HAND_COUNT ? "Continue" : "Next Hand"}
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
        showContinue={showQuizContinue}
        onContinue={handleAcknowledge}
      />
    </div>
  );
}
