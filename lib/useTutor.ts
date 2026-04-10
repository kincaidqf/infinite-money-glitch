import { useState } from "react";

interface UseTutorOptions {
  onError?: (error: string) => void;
}

export function useTutor(options: UseTutorOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callTutor = async (
    action: "feedback" | "hint" | "explain",
    gameContextOrTopic: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const payload =
        action === "explain"
          ? { action, topic: gameContextOrTopic }
          : { action, gameContext: gameContextOrTopic };

      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.response || null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      options.onError?.(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    callTutor,
    loading,
    error,
    clearError: () => setError(null),
  };
}
