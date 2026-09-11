import { useState } from "react";
import { useAppData } from "../store/AppDataContext";
import {
  hasUnimportedLegacyData,
  importLegacyData,
  markLegacyImported,
  type LegacyImportResult,
} from "../lib/legacyImport";
import { Button, Card } from "./ui";

export function LegacyImportCard() {
  const { courses, players, addCourse, addPlayer, addRound } = useAppData();
  const [visible, setVisible] = useState(() => hasUnimportedLegacyData());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LegacyImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await importLegacyData({ courses, players, addCourse, addPlayer, addRound });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function handleDismiss() {
    markLegacyImported();
    setVisible(false);
  }

  if (result) {
    return (
      <Card className="mb-4 border-green-200 bg-green-50">
        <p className="font-semibold text-slate-800 mb-1">Import complete</p>
        <p className="text-sm text-slate-600">
          Brought in {result.roundsImported} round{result.roundsImported === 1 ? "" : "s"},{" "}
          {result.playersImported} player{result.playersImported === 1 ? "" : "s"}
          {result.coursesImported > 0
            ? `, and ${result.coursesImported} course${result.coursesImported === 1 ? "" : "s"}`
            : ""}{" "}
          from this phone's earlier local data.
        </p>
        <Button className="w-full mt-3" onClick={() => setVisible(false)}>
          Done
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-amber-200 bg-amber-50">
      <p className="font-semibold text-slate-800 mb-1">Found rounds saved on this phone</p>
      <p className="text-sm text-slate-600 mb-3">
        Before switching to shared accounts, this device had rounds and players saved locally.
        Import them into your account now so they're not lost?
      </p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={handleDismiss} disabled={busy}>
          Ignore
        </Button>
        <Button className="flex-1" onClick={handleImport} disabled={busy}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>
    </Card>
  );
}
