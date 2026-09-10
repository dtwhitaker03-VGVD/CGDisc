import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { computeHandicap, playerDifferentials } from "../lib/ratings";
import { Button, Card, EmptyState, Field, PageHeader, inputClass } from "../components/ui";

export function PlayersPage() {
  const { players, rounds, coursesById, addPlayer, deletePlayer } = useAppData();
  const [name, setName] = useState("");

  const hasSelf = players.some((p) => p.isSelf);

  function handleAdd(isSelf: boolean) {
    if (!name.trim()) return;
    addPlayer(name.trim(), isSelf);
    setName("");
  }

  return (
    <div>
      <PageHeader title="Players" subtitle="Yourself and the friends you play with" />

      <Card className="mb-4 space-y-3">
        <Field label={hasSelf ? "Add a friend" : "Add yourself first"}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={hasSelf ? "Friend's name" : "Your name"}
          />
        </Field>
        <Button className="w-full" disabled={!name.trim()} onClick={() => handleAdd(!hasSelf)}>
          {hasSelf ? "Add friend" : "That's me"}
        </Button>
      </Card>

      {players.length === 0 ? (
        <EmptyState icon="👥" title="No players yet" subtitle="Add yourself to get started." />
      ) : (
        <div className="space-y-2">
          {players.map((player) => {
            const handicap = computeHandicap(playerDifferentials(player.id, rounds, coursesById));
            return (
              <Card key={player.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <div>
                    <p className="font-medium text-slate-800">
                      {player.name}
                      {player.isSelf ? " (you)" : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      Handicap {handicap === null ? "— (needs 3+ rounds)" : handicap}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link to={`/stats/${player.id}`} className="text-sm font-medium text-green-700">
                    Stats
                  </Link>
                  <button
                    type="button"
                    className="text-sm text-red-600"
                    onClick={() => {
                      if (confirm(`Remove ${player.name}?`)) deletePlayer(player.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
