"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import type { Level } from "@/lib/types";
import type { Card } from "@/lib/cards";
import { type DeckState, initShoe, dealCard, getTrueCount, getProbabilities } from "@/game/deckState";
import { getCardImagePath, getBackImagePath, calculateHandValue, isBust } from "@/game/cardUtils";

type GamePhase = "idle" | "player" | "dealer" | "result";
type Outcome = "player_win" | "dealer_win" | "push" | "player_bust" | "dealer_bust" | "blackjack";

interface GameState {
  deck: DeckState;
  playerHand: Card[];
  dealerHand: Card[];
  phase: GamePhase;
  outcome: Outcome | null;
}

interface GameBoardProps {
  level: Level;
}

function CardImage({ card, hidden = false }: { card: Card; hidden?: boolean }) {
  const src = hidden ? getBackImagePath() : getCardImagePath(card);
  const label = hidden ? "Face-down card" : `${card.rank} of ${card.suit}`;
  return (
    <div className="card-slot">
      <Image
        src={src}
        alt={label}
        width={64}
        height={88}
        className="card-img"
        priority
      />
    </div>
  );
}

function EmptySlot() {
  return <div className="card-slot card-slot--empty" aria-label="Empty card slot" />;
}

const OUTCOME_MESSAGES: Record<Outcome, string> = {
  blackjack: "Blackjack! You win!",
  player_win: "You win!",
  dealer_win: "Dealer wins.",
  push: "Push — it's a tie.",
  player_bust: "Bust! Dealer wins.",
  dealer_bust: "Dealer busts — you win!",
};

function resolveOutcome(playerHand: Card[], dealerHand: Card[]): Outcome {
  const playerTotal = calculateHandValue(playerHand);
  const dealerTotal = calculateHandValue(dealerHand);

  if (playerTotal === 21 && playerHand.length === 2) return "blackjack";
  if (playerTotal > 21) return "player_bust";
  if (dealerTotal > 21) return "dealer_bust";
  if (playerTotal > dealerTotal) return "player_win";
  if (dealerTotal > playerTotal) return "dealer_win";
  return "push";
}

export default function GameBoard({ level }: GameBoardProps) {
  const [game, setGame] = useState<GameState>({
    deck: initShoe(1),
    playerHand: [],
    dealerHand: [],
    phase: "idle",
    outcome: null,
  });

  const deal = useCallback(() => {
    let deck = game.deck;
    const draws: Card[] = [];

    for (let i = 0; i < 4; i++) {
      const result = dealCard(deck);
      draws.push(result.card);
      deck = result.newState;
    }

    // Deal order: player, dealer(up), player, dealer(hole/hidden)
    const playerHand = [draws[0], draws[2]];
    const dealerHand = [draws[1], draws[3]];

    setGame({ deck, playerHand, dealerHand, phase: "player", outcome: null });
  }, [game.deck]);

  const hit = useCallback(() => {
    const { card, newState } = dealCard(game.deck);
    const playerHand = [...game.playerHand, card];
    if (isBust(playerHand)) {
      setGame((g) => ({ ...g, deck: newState, playerHand, phase: "result", outcome: "player_bust" }));
    } else {
      setGame((g) => ({ ...g, deck: newState, playerHand }));
    }
  }, [game.deck, game.playerHand]);

  const stand = useCallback(() => {
    runDealerTurn(game);
  }, [game]);

  const double = useCallback(() => {
    const { card, newState } = dealCard(game.deck);
    const playerHand = [...game.playerHand, card];
    if (isBust(playerHand)) {
      setGame((g) => ({ ...g, deck: newState, playerHand, phase: "result", outcome: "player_bust" }));
    } else {
      runDealerTurn({ ...game, deck: newState, playerHand });
    }
  }, [game]);

  function runDealerTurn(state: GameState) {
    let deck = state.deck;
    let dealerHand = [...state.dealerHand];

    while (calculateHandValue(dealerHand) < 17) {
      const result = dealCard(deck);
      dealerHand = [...dealerHand, result.card];
      deck = result.newState;
    }

    const outcome = resolveOutcome(state.playerHand, dealerHand);
    setGame({ ...state, deck, dealerHand, phase: "result", outcome });
  }

  const newHand = useCallback(() => {
    // Reshuffle if fewer than 15 cards remain
    const deck = game.deck.shoe.length < 15 ? initShoe(game.deck.numDecks) : game.deck;
    setGame((g) => ({ ...g, deck, playerHand: [], dealerHand: [], phase: "idle", outcome: null }));
  }, [game.deck]);

  const { deck, playerHand, dealerHand, phase, outcome } = game;
  const playerTotal = playerHand.length > 0 ? calculateHandValue(playerHand) : null;
  const dealerVisible = phase === "result" || phase === "dealer";
  const dealerTotal = dealerVisible && dealerHand.length > 0 ? calculateHandValue(dealerHand) : null;
  const probs = getProbabilities(deck, playerTotal);

  const countSign = deck.runningCount > 0 ? "+" : "";
  const trueCount = getTrueCount(deck);
  const trueSign = trueCount > 0 ? "+" : "";

  return (
    <div className="game-board">
      <div className="game-hud">
        <div className="game-hud__stat">
          <span className="game-hud__label">Cards Left</span>
          <span className="game-hud__value">{deck.shoe.length}</span>
        </div>
        {level >= 2 && (
          <>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">Running Count</span>
              <span className={`game-hud__value ${deck.runningCount > 0 ? "game-hud__value--pos" : deck.runningCount < 0 ? "game-hud__value--neg" : ""}`}>
                {countSign}{deck.runningCount}
              </span>
            </div>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">True Count</span>
              <span className={`game-hud__value ${trueCount > 0 ? "game-hud__value--pos" : trueCount < 0 ? "game-hud__value--neg" : ""}`}>
                {trueSign}{trueCount}
              </span>
            </div>
          </>
        )}
        {probs.bustProb !== null && phase === "player" && (
          <>
            <div className="game-hud__divider" />
            <div className="game-hud__stat">
              <span className="game-hud__label">Bust if Hit</span>
              <span className="game-hud__value">{(probs.bustProb * 100).toFixed(0)}%</span>
            </div>
          </>
        )}
      </div>

      <div className="felt-table">
        <div className="felt-table__dealer">
          <p className="felt-table__zone-label">
            Dealer{dealerTotal !== null ? ` — ${dealerTotal}` : ""}
          </p>
          <div className="felt-table__cards">
            {dealerHand.length === 0 ? (
              <>
                <EmptySlot />
                <EmptySlot />
              </>
            ) : (
              dealerHand.map((card, i) => (
                <CardImage key={card.id} card={card} hidden={i === 1 && !dealerVisible} />
              ))
            )}
          </div>
        </div>

        <div className="felt-table__divider" />

        <div className="felt-table__player">
          <div className="felt-table__cards">
            {playerHand.length === 0 ? (
              <>
                <EmptySlot />
                <EmptySlot />
              </>
            ) : (
              playerHand.map((card) => (
                <CardImage key={card.id} card={card} />
              ))
            )}
          </div>
          <p className="felt-table__zone-label">
            Player{playerTotal !== null ? ` — ${playerTotal}` : ""}
          </p>
        </div>
      </div>

      {outcome && (
        <div className={`result-banner result-banner--${outcome.includes("win") || outcome === "blackjack" ? "win" : outcome === "push" ? "push" : "lose"}`}>
          {OUTCOME_MESSAGES[outcome]}
        </div>
      )}

      <div className="game-actions">
        {phase === "idle" && (
          <button className="action-btn action-btn--deal" onClick={deal}>Deal</button>
        )}
        {phase === "player" && (
          <>
            <button className="action-btn" onClick={hit}>Hit</button>
            <button className="action-btn" onClick={stand}>Stand</button>
            {level !== 2 && playerHand.length === 2 && (
              <button className="action-btn" onClick={double}>Double</button>
            )}
          </>
        )}
        {phase === "result" && (
          <button className="action-btn action-btn--deal" onClick={newHand}>New Hand</button>
        )}
      </div>
    </div>
  );
}
