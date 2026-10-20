import { useEffect, useState } from "react";
import { elapsedMs, formatClock } from "../lib/duration";

/**
 * Ticking elapsed time since the round started, with a pause/resume toggle.
 * Isolated so only it re-renders each second.
 */
export function RoundClock({
  startedAt,
  pausedAt,
  pausedMs,
  onToggle,
}: {
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  onToggle: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const paused = pausedAt !== null;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={paused ? "Resume timer" : "Pause timer"}
      className={`text-sm font-semibold tabular-nums rounded-lg px-2.5 py-1 ${
        paused ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {paused ? "⏸" : "⏱"} {formatClock(elapsedMs(startedAt, pausedAt, pausedMs, now) / 1000)}
      <span className="ml-1.5 text-xs font-medium">{paused ? "Resume" : "Pause"}</span>
    </button>
  );
}
