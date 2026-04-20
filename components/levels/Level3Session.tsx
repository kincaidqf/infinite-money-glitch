"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import TutorPanel, { type TutorMessage } from "@/components/TutorPanel";
import { getCardImagePath, getBackImagePath, calculateHandValue } from "@/game/cardUtils";
import {
  getInitialLevel3State,
  dealInitialCards,
  applyPlayerAction,
  runDealerTurn,
  submitCountEntry,
  startNewRound,
  getLevel3GameContext,
  type Level3State,
} from "@/game/levels/level3/gameLogic";
import type { Level } from "@/lib/types";
import type { Card } from "@/lib/cards";
import type { UserAction } from "@/game/basicStrategy";

function CardImg({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  const src = hidden ? getBackImagePath() : getCardImagePath(card);
  return (
    <div className="card-slot">
      <Image src={src} alt={hidden ? "Hidden card" : `${card.rank} of ${card.suit}`} width={64} height={88} className="card-img" priority />
    </div>
  );
}

export default function Level3Session({ level: _ }: { level: Level }) {
  const [game, setGame] = useState<Level3State>(getInitialLevel3State);
  const [countInput, setCountInput] = useState("");
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const lastCallRef = useRef(0);

  const callTutor = useCallback(async (action: "feedback" | "hint" | "explain", payload: string) => {
    if (Date.now() - lastCallRef.current < 1000) return;
    lastCallRef.current = Date.now();
    setTutorLoading(true);
    try {
      const body = action === "explain"
        ? { action, topic: payload, level: 3 }
        : { action, gameContext: payload, level: 3 };
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { response?: string; error?: string };
      setMessages((m) => [...m, { role: "tutor", text: data.response ?? data.error ?? "Tutor unavailable." }]);
    } catch {
      setMessages((m) => [...m, { role: "tutor", text: "Tutor unavailable. Try again." }]);
    } finally {
      setTutorLoading(false);
    }
  }, []);

  const handleDeal = useCallback(() => setGame(dealInitialCards), []);

  const handleAction = useCallback((action: UserAction) => {
    setGame((prev) => {
      const next = applyPlayerAction(prev, action);
      return next.phase === "dealer-turn" ? runDealerTurn(next) : next;
    });
  }, []);

  const handleSubmitCount = useCallback(() => {
    const entered = parseInt(countInput, 10);
    if (isNaN(entered)) return;
    const next = submitCountEntry(game, entered);
    setGame(next);
    setCountInput("");
    void callTutor("feedback", getLevel3GameContext(next));
  }, [countInput, game, callTutor]);

  const handleAsk = useCallback((question: string) => {
    setMessages((m) => [...m, { role: "player", text: question }]);
    void callTutor("explain", question);
  }, [callTutor]);

  const { phase, playerHand, dealerHand, runningCount, trueCount, playerEnteredCount,
    correctDecisions, totalDecisions, consecutiveCorrectDecisions, correctCountEntries,
    totalCountEntries, lastIndexPlay, countWasCorrect, roundDecisionCorrect } = game;
  const dealerVisible = ["count-entry", "round-over", "session-over"].includes(phase);
  const playerTotal = playerHand.length ? calculateHandValue(playerHand) : null;
  const dealerTotal = dealerVisible && dealerHand.length ? calculateHandValue(dealerHand) : null;
  const decPct = totalDecisions ? ((correctDecisions / totalDecisions) * 100).toFixed(0) : "—";
  const cntPct = totalCountEntries ? ((correctCountEntries / totalCountEntries) * 100).toFixed(0) : "—";

  if (game.sessionComplete) {
    return (
      <div className="game-layout">
        <div className="game-board">
          <h2 style={{ color: "var(--color-chip-gold)", fontSize: "2rem", fontWeight: 800 }}>Level 3 Complete!</h2>
          <p style={{ color: "#e2e8f0" }}>5 correct decisions in a row achieved.</p>
          <p style={{ color: "#94a3b8" }}>Decision Accuracy: {decPct}%</p>
          <p style={{ color: "#94a3b8" }}>Count Accuracy: {cntPct}%</p>
          <button className="action-btn action-btn--deal" onClick={() => setGame(getInitialLevel3State())}>Play Again</button>
        </div>
        <TutorPanel messages={messages} loading={tutorLoading} onAsk={handleAsk} />
      </div>
    );
  }

  return (
    <div className="game-layout">
      <div className="game-board">
        <div className="floor-tl">
          <div className="game-hud">
            <div className="game-hud__stat">
              <span className="game-hud__label">Streak</span>
              <span className="game-hud__value">{consecutiveCorrectDecisions}/5</span>
            </div>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">Decisions</span>
              <span className="game-hud__value">{decPct}%</span>
            </div>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">Count Acc</span>
              <span className="game-hud__value">{cntPct}%</span>
            </div>
          </div>
        </div>

        <div className="felt-table">
          <div className="felt-table__dealer">
            <p className="felt-table__zone-label">Dealer{dealerTotal !== null ? ` — ${dealerTotal}` : ""}</p>
            <div className="felt-table__cards">
              {dealerHand.length === 0
                ? <><div className="card-slot card-slot--empty" /><div className="card-slot card-slot--empty" /></>
                : dealerHand.map((c, i) => <CardImg key={c.id} card={c} hidden={i === 1 && !dealerVisible} />)}
            </div>
          </div>
          <div className="felt-table__divider" />
          <div className="felt-table__player">
            <div className="felt-table__cards">
              {playerHand.length === 0
                ? <><div className="card-slot card-slot--empty" /><div className="card-slot card-slot--empty" /></>
                : playerHand.map((c) => <CardImg key={c.id} card={c} />)}
            </div>
            <p className="felt-table__zone-label">You{playerTotal !== null ? ` — ${playerTotal}` : ""}</p>
          </div>
        </div>

        {phase === "count-entry" && (
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>What is the running count?</span>
            <input
              type="number"
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitCount()}
              style={{ width: "5rem", padding: "0.4rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #374151", background: "#1f2937", color: "#e2e8f0", fontSize: "0.875rem" }}
              placeholder="0"
              autoFocus
            />
            <button className="action-btn" onClick={handleSubmitCount}>Submit</button>
          </div>
        )}

        {phase === "round-over" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
              <span className={`decision-feedback ${roundDecisionCorrect ? "decision-feedback--correct" : "decision-feedback--incorrect"}`}>
                {roundDecisionCorrect ? "Decision correct" : "Wrong decision"}
              </span>
              <span className={`decision-feedback ${countWasCorrect ? "decision-feedback--correct" : "decision-feedback--incorrect"}`}>
                Count: {playerEnteredCount} (actual: {runningCount}, TC: {trueCount})
              </span>
            </div>
            {lastIndexPlay && (
              <span style={{ color: "#fbbf24", fontSize: "0.8125rem" }}>
                Index play available: {lastIndexPlay}
              </span>
            )}
            <button className="action-btn action-btn--deal" onClick={() => setGame(startNewRound)}>Next Hand</button>
          </div>
        )}

        <div className="floor-bl">
          {(["hit", "stand", "double"] as UserAction[]).map((a) => (
            <button key={a} className="action-btn"
              onClick={() => handleAction(a)}
              disabled={phase !== "player-turn" || (a === "double" && playerHand.length !== 2)}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
          <button className="action-btn" disabled>Split</button>
        </div>

        <div className="floor-br">
          <button className="action-btn action-btn--deal" onClick={handleDeal} disabled={phase !== "dealing"}>
            Deal
          </button>
        </div>
      </div>
      <TutorPanel messages={messages} loading={tutorLoading} onAsk={handleAsk} />
    </div>
  );
}
