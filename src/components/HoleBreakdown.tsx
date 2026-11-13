import type { HoleCounts } from "../lib/stats";

const ROWS: { key: keyof HoleCounts; label: string; color: string; bar: string }[] = [
  { key: "aces", label: "Aces", color: "text-green-600", bar: "bg-green-500" },
  { key: "eagles", label: "Eagles", color: "text-green-600", bar: "bg-green-500" },
  { key: "birdies", label: "Birdies", color: "text-green-600", bar: "bg-green-500" },
  { key: "pars", label: "Pars", color: "text-slate-900", bar: "bg-slate-500" },
  { key: "bogeys", label: "Bogeys", color: "text-red-600", bar: "bg-red-400" },
  { key: "doubleBogeys", label: "Doubles", color: "text-red-600", bar: "bg-red-500" },
  { key: "triplePlusBogeys", label: "Triple+", color: "text-red-600", bar: "bg-red-600" },
];

/** How many aces / eagles / birdies / pars / bogeys... were scored, with
 * each one's share of the holes played. Rows with none are hidden. */
export function HoleBreakdown({ counts }: { counts: HoleCounts }) {
  const total = counts.holesPlayed;
  if (total === 0) return <p className="text-sm text-slate-500">No scores recorded yet.</p>;
  return (
    <ul className="space-y-1.5">
      {ROWS.filter((r) => counts[r.key] > 0 || r.key === "birdies" || r.key === "pars" || r.key === "bogeys").map(
        (r) => {
          const n = counts[r.key];
          const pct = Math.round((n / total) * 100);
          return (
            <li key={r.key} className="flex items-center gap-2 text-sm">
              <span className={`w-16 font-medium ${r.color}`}>{r.label}</span>
              <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <span className={`block h-full ${r.bar}`} style={{ width: `${pct}%` }} />
              </span>
              <span className="w-16 text-right tabular-nums text-slate-700">
                {n} <span className="text-xs text-slate-400">· {pct}%</span>
              </span>
            </li>
          );
        },
      )}
    </ul>
  );
}
