import type { Level } from "@/lib/types";

interface GameHeaderProps {
  level: Level;
}

export default function GameHeader({ level }: GameHeaderProps) {
  return (
    <header className="game-header">
      <div className="game-header__section">
        <span className="game-header__label">Probability</span>
        <span className="game-header__value">—</span>
      </div>

      {level >= 2 && (
        <>
          <div className="game-header__divider" />
          <div className="game-header__section">
            <span className="game-header__label">Count</span>
            <span className="game-header__value">—</span>
          </div>
        </>
      )}

      <div className="game-header__divider" />
      <div className="game-header__section">
        <span className="game-header__label">Level {level}</span>
        <span className="game-header__value">Tutor</span>
      </div>
    </header>
  );
}
