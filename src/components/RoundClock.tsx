import { useEffect, useState } from "react";
import { formatClock } from "../lib/duration";

/** Ticking elapsed time since the round started, isolated so only it re-renders each second. */
export function RoundClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-sm font-semibold tabular-nums text-slate-600 bg-slate-100 rounded-lg px-2.5 py-1">
      ⏱ {formatClock((now - startedAt) / 1000)}
    </span>
  );
}
