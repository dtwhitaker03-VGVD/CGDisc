import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../store/AppDataContext";
import { computeHandicap, playerDifferentials } from "../lib/ratings";
import { Button, Card, EmptyState, Field, PageHeader, inputClass } from "../components/ui";

export function PlayersPage() {
  const { players, rounds, coursesById, addPlayer, deletePlayer } = useAppData();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addPlayer(name.trim());
      setName("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Players" subtitle="Everyone you play with, shared across all your phones" />

      <Card className="mb-4 space-y-3">
        <Field label="Add a guest friend (no account needed)">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friend's name"
          />
        </Field>
        <Button className="w-full" disabled={!name.trim() || busy} onClick={handleAdd}>
          Add friend
        </Button>
        <p className="text-xs text-slate-400">
          A friend who wants their own login (so their rounds sync to their own phone) should
          create their own account instead of being added here.
        </p>
      </Card>

      {players.length === 0 ? (
        <EmptyState icon="👥" title="No players yet" />
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
                      {player.isSelf ? " (you)" : !player.hasAccount ? " (guest)" : ""}
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
                  {!player.hasAccount && (
                    <button
                      type="button"
                      className="text-sm text-red-600"
                      onClick={() => {
                        if (confirm(`Remove ${player.name}?`)) void deletePlayer(player.id);
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
