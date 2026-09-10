import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { computeHandicap, playerDifferentials } from "../lib/ratings";
import { Card, EmptyState, PageHeader } from "../components/ui";

export function StatsPage() {
  const { players, rounds, coursesById } = useAppData();

  if (players.length === 0) {
    return (
      <div>
        <PageHeader title="Stats" />
        <EmptyState icon="📈" title="Add players to see stats" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Stats" subtitle="Tap a player for their rating trend" />
      <div className="space-y-2">
        {players.map((player) => {
          const diffs = playerDifferentials(player.id, rounds, coursesById);
          const handicap = computeHandicap(diffs);
          return (
            <Link key={player.id} to={`/stats/${player.id}`} className="block">
              <Card className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="font-medium text-slate-800">{player.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {handicap === null ? "—" : handicap > 0 ? `+${handicap}` : handicap}
                  </p>
                  <p className="text-[11px] text-slate-400">{diffs.length} rounds</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
      <p className="text-center text-xs text-slate-400 mt-6">
        <Link to="/about-ratings" className="underline">
          How are ratings & handicaps calculated?
        </Link>
      </p>
    </div>
  );
}
