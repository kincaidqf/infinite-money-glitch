"use client";

import type { Level } from "@/lib/types";

interface GameBoardProps {
  level: Level;
}

function CardSlot() {
  return <div className="card-slot" aria-label="Card placeholder" />;
}

export default function GameBoard({ level }: GameBoardProps) {
  return (
    <div className="game-board">
      <div className="felt-table">
        <div className="felt-table__dealer">
          <p className="felt-table__zone-label">Dealer</p>
          <div className="felt-table__cards">
            <CardSlot />
            <CardSlot />
          </div>
        </div>

        <div className="felt-table__divider" />

        <div className="felt-table__player">
          <div className="felt-table__cards">
            <CardSlot />
            <CardSlot />
          </div>
          <p className="felt-table__zone-label">Player</p>
        </div>
      </div>

      <div className="game-actions">
        <button className="action-btn" disabled>Hit</button>
        <button className="action-btn" disabled>Stand</button>
        {level !== 2 && (
          <button className="action-btn" disabled>Double</button>
        )}
      </div>
    </div>
  );
}
