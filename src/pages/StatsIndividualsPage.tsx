import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { EmptyState, PageHeader, inputClass } from "../components/ui";
import { PlayerStatsView } from "./PlayerStatsPage";

const backLink = (
  <Link to="/stats" className="text-sm font-medium text-green-700 whitespace-nowrap">
    ← Stats
  </Link>
);

export function StatsIndividualsPage() {
  const { players, playersById } = useAppData();
  // Defaults to whoever is signed in (their own player).
  const [pickedPlayerId, setPickedPlayerId] = useState<string | null>(null);
  const self = players.find((p) => p.isSelf);
  const player =
    (pickedPlayerId ? playersById.get(pickedPlayerId) : undefined) ?? self ?? players[0];

  if (!player) {
    return (
      <div>
        <PageHeader title="Individuals" action={backLink} />
        <EmptyState icon="📈" title="Add players to see stats" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Individuals" subtitle="Pick a person" action={backLink} />
      <select
        className={`${inputClass} mb-3`}
        value={player.id}
        onChange={(e) => setPickedPlayerId(e.target.value)}
        aria-label="Choose a person"
      >
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isSelf ? " (you)" : ""}
          </option>
        ))}
      </select>
      <PlayerStatsView key={player.id} player={player} embedded />
    </div>
  );
}
