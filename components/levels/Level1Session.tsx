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
  getHintContext,
  getFeedbackReflectionContext,
  getStageQuestionContext,
  getStudentAnswerContext,
  getStudentQuestionContext,
  getStageAdvanceContext,
  getStageIntroContext,
  advanceTutorialStep,
  getTutorialStepContext,
  TUTORIAL_STEPS,
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
  const metadataLine = /^\s*(message_type|stage|student_goal|teaching_points|flow_note|forbidden|response_style|student_prompt|student_answer|student_question|decision_index|decision_result|student_action|correct_action|is_correct|verdict_text|action_alignment|teaching_focus|level1_probability_action|level1_probability_action_hidden|opening_sentence|required_opening|delivered_opening|required_meaning|required_reason|must_use_reason|must_ask_question|reflection_question|key_fraction|key_fraction_label|key_fraction_meaning|locked_reason_fact_\d+|locked_fact_\d+|forbidden_claim_\d+|case_type|player_hand|player_total|player_total_label|player_bust_fraction_if_hit|player_bust_fraction_hidden|player_bust_category|player_bust_category_hidden|dealer_upcard|assumed_dealer_upcard|assumed_dealer_total|assumed_dealer_total_hidden|correct_assumed_dealer_total|correct_assumed_dealer_total_hidden|assumed_dealer_bust_fraction_if_forced_to_hit|assumed_dealer_bust_fraction_if_forced_to_hit_hidden|hand_outcome|session_accuracy|answer_result|estimate_result|comparison_hidden|correct_comparison|concept_covered|hands_played|allowed_message)\s*:/i;
  const cleanedLines = text
    .trim()
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(Explain|Game state|Tutor request|Task)\s*:\s*/i, "")
        .replace(/^\s*\[[A-Z0-9_]+\]\s*/i, "")
        .replace(/^\s*Stage\s+\d+\s*:\s*/i, "")
        .replace(/^\s*(?:Sentence|Part)\s*\d+\s*[:\-–—]\s*/i, "")
        .replace(/^\s*Response\s*[:\-–—]\s*/i, "")
        .replace(/^\s*(?:first|second|third)\s*[:\-–—]\s*/i, "")
        .trim()
    )
    .filter((line) => line && !metadataLine.test(line));

  return cleanedLines.join(" ").replace(/\s+/g, " ").trim();
}

function getContextValue(context: string, key: string): string | null {
  const line = context.split(/\r?\n/).find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : null;
}

function getContextValues(context: string, keyPrefix: string): string[] {
  const lowerPrefix = keyPrefix.toLowerCase();
  return context
    .split(/\r?\n/)
    .filter((item) => item.toLowerCase().startsWith(lowerPrefix))
    .map((item) => item.slice(item.indexOf(":") + 1).trim())
    .filter(Boolean);
}

function joinTutorSentences(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFallbackTutorText(context: string): string {
  const messageType = getContextValue(context, "message_type");
  const requiredMeaning = getContextValue(context, "required_meaning");
  const reflectionQuestion = getContextValue(context, "reflection_question");
  const allowedMessage = getContextValue(context, "allowed_message");
  const keyFraction = getContextValue(context, "key_fraction");
  const keyFractionMeaning = getContextValue(context, "key_fraction_meaning");
  const teachingFocus = getContextValue(context, "teaching_focus");
  const lockedFact = getContextValues(context, "locked_fact_")[0];
  const studentAction = getContextValue(context, "student_action") as "hit" | "stand" | null;
  const correctAction = getContextValue(context, "correct_action") as "hit" | "stand" | null;
  const isCorrect = getContextValue(context, "is_correct") === "true";

  if (messageType === "decision_feedback") {
    let opening: string | null = null;
    if (studentAction && correctAction) {
      if (isCorrect && correctAction === "hit") {
        opening = `That matches the Level 1 rule: you hit, and hit is the right call here.`;
      } else if (isCorrect && correctAction === "stand") {
        opening = `Good stop: you stood, and stand is what the Level 1 rule calls for here.`;
      } else {
        opening = `Not quite: you chose ${studentAction}, but the Level 1 rule calls for ${correctAction} here.`;
      }
    }
    const explanation = keyFraction && keyFractionMeaning
      ? `${requiredMeaning} ${keyFraction} matters here: ${keyFractionMeaning.toLowerCase()}`
      : requiredMeaning ?? lockedFact ?? teachingFocus;
    return joinTutorSentences([opening, explanation, reflectionQuestion]);
  }

  if (messageType === "feedback_reflection_answer") {
    const explanation = keyFraction
      ? `${requiredMeaning} The key fraction is ${keyFraction}.`
      : requiredMeaning ?? lockedFact;
    return joinTutorSentences(["That reasoning makes sense to look at.", explanation]);
  }

  if (messageType === "stage_advance") {
    return allowedMessage ?? "Nice work practicing this concept. Type yes to move on, or more to keep practicing.";
  }

  return requiredMeaning ?? lockedFact ?? "Let's keep using the Level 1 probability rule from the board.";
}

function containsOppositeRecommendation(text: string, context: string): boolean {
  const correctAction = getContextValue(context, "correct_action") ?? getContextValue(context, "level1_probability_action");
  if (correctAction !== "hit" && correctAction !== "stand") return false;

  const opposite = correctAction === "hit" ? "stand" : "hit";
  const lower = text.toLowerCase();
  const oppositePatterns = [
    `rule says ${opposite}`,
    `probability says ${opposite}`,
    `should ${opposite}`,
    `better to ${opposite}`,
    `${opposite} was correct`,
    `decision to ${opposite} was correct`,
    `correct to ${opposite}`,
    `marked ${opposite} as correct`,
  ];

  return oppositePatterns.some((pattern) => lower.includes(pattern));
}

function contradictsZeroBustRisk(text: string, context: string): boolean {
  if (getContextValue(context, "player_bust_fraction_if_hit") !== "0 out of 52") return false;
  const lower = text.toLowerCase();
  const saysNoBust = /0 out of 52|cannot bust|can't bust|would not bust|wouldn't bust|no bust risk/.test(lower);
  const saysCanBust = /would bust|could bust|can bust|might bust|will bust|bust if you hit|bust from one hit/.test(lower);
  return saysCanBust && !saysNoBust;
}

function isUnsafeTutorText(text: string, context: string): boolean {
  if (/%|\bpercent\b|zero percent/i.test(text)) return true;
  if (containsOppositeRecommendation(text, context)) return true;
  return contradictsZeroBustRisk(text, context);
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
  messages, loading, phase, stage, tutorialStep,
  onAcknowledge, onKeepPracticing, onAdvanceStage, onNextTutorialStep,
  canHint, canContinueFeedback, feedbackContinueLabel, onHint, onStudentMessage,
}: {
  messages: ChatMessage[];
  loading: boolean;
  phase: Level1Phase;
  stage: Level1Stage;
  tutorialStep: number;
  onAcknowledge: () => void;
  onKeepPracticing: () => void;
  onAdvanceStage: () => void;
  onNextTutorialStep: () => void;
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

  const isBoardIntro = phase === "board-intro";
  const isIntro = phase === "tutor-intro";
  const isAdvance = phase === "tutor-advance";
  const isFeedback = phase === "tutor-feedback";
  const isPlaying = phase === "player-turn";
  const isLastTutorialStep = tutorialStep === TUTORIAL_STEPS.length - 1;

  return (
    <aside className="tutor-panel">
      <div className="tutor-panel__heading">
        {isBoardIntro ? "Tutor — Introduction" : `Tutor — Stage ${stage}`}
      </div>

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
        {isBoardIntro && (
          <div style={{ padding: "0.75rem 1rem" }}>
            <button
              className="action-btn"
              onClick={onNextTutorialStep}
              disabled={loading || messages.length === 0}
              style={{ width: "100%" }}
            >
              {isLastTutorialStep ? "Let's Start" : "Next →"}
            </button>
          </div>
        )}

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
  const lastTutorialStepRef = useRef(-1);
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
      if (!msg) return;
      const cleanMsg = msg ? cleanTutorText(msg) : "";
      const safeMsg = cleanMsg && !isUnsafeTutorText(cleanMsg, context)
        ? cleanMsg
        : buildFallbackTutorText(context);
      if (safeMsg) setMessages((prev) => [...prev, { id: nextMsgId(), role: "tutor", text: safeMsg }]);
    },
    [callTutor]
  );

  // Tutorial board-intro: fire tutor explanation for each step
  useEffect(() => {
    if (state.phase !== "board-intro") return;
    if (lastTutorialStepRef.current === state.tutorialStep) return;
    lastTutorialStepRef.current = state.tutorialStep;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fireTutor("explain", getTutorialStepContext(state.tutorialStep));
  }, [state.phase, state.tutorialStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stage 0 intro: fires once when transitioning from board-intro into tutor-intro
  useEffect(() => {
    if (state.phase !== "tutor-intro" || state.stage !== 0) return;
    if (mountFiredRef.current) return;
    mountFiredRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fireTutor("explain", getStageIntroContext(0));
  }, [state.phase, state.stage]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleNextTutorialStep = useCallback(() => {
    setState((s) => advanceTutorialStep(s));
  }, []);

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
    fireTutor("hint", getHintContext(state));
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

  const isBoardIntro = state.phase === "board-intro";
  const tutorialTarget = isBoardIntro ? TUTORIAL_STEPS[state.tutorialStep]?.target ?? null : null;

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
    (isBoardIntro || state.phase === "player-turn" || state.phase === "tutor-feedback" || state.phase === "dealer-turn");
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
  const allDecisionsCorrect = state.handDecisions.every(d => d.isCorrect);

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
        <div
          className="floor-tl"
          style={tutorialTarget === "hud-stats" ? {
            zIndex: 20,
            borderRadius: "0.5rem",
            boxShadow: "0 0 0 3px #fbbf24, 0 0 24px rgba(251,191,36,0.35)",
          } : undefined}
        >
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
            {(actionsEnabled || isBoardIntro) && playerBustFraction !== null && (
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

        {/* Tutorial overlay — dims the board while a specific element is spotlit */}
        {tutorialTarget && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 15, pointerEvents: "none",
          }} />
        )}

        {/* Felt table */}
        <div
          className="felt-table"
          style={
            tutorialTarget === "dealer-area" || tutorialTarget === "player-area"
              ? { position: "relative", zIndex: 20, boxShadow: "0 0 0 3px #fbbf24, 0 0 30px rgba(251,191,36,0.4)" }
              : undefined
          }
        >
          <div
            className="felt-table__dealer"
            style={tutorialTarget === "dealer-area" ? { background: "#256b35" } : undefined}
          >
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

          <div
            className="felt-table__player"
            style={tutorialTarget === "player-area" ? { background: "#256b35" } : undefined}
          >
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
        <div
          className="floor-bl"
          style={tutorialTarget === "action-btns" ? {
            zIndex: 20,
            padding: "0.5rem",
            background: "rgba(0,0,0,0.5)",
            borderRadius: "0.5rem",
            boxShadow: "0 0 0 3px #fbbf24, 0 0 24px rgba(251,191,36,0.35)",
          } : undefined}
        >
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
        tutorialStep={state.tutorialStep}
        onAcknowledge={handleAcknowledge}
        onKeepPracticing={handleKeepPracticing}
        onAdvanceStage={handleAdvanceStage}
        onNextTutorialStep={handleNextTutorialStep}
        canHint={actionsEnabled}
        canContinueFeedback={canContinueFeedback}
        feedbackContinueLabel={feedbackContinueLabel}
        onHint={handleHint}
        onStudentMessage={handleStudentMessage}
      />
    </div>
  );
}
