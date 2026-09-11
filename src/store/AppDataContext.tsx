import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useStoredState } from "../lib/storage";
import { makeId } from "../lib/id";
import { coursePar } from "../lib/ratings";
import { DEFAULT_COURSES } from "../data/defaultCourses";
import type { Course, Hole, Player, Round } from "../types";

const PLAYER_COLORS = [
  "#15803d",
  "#2563eb",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#4d7c0f",
];

interface AppData {
  courses: Course[];
  players: Player[];
  rounds: Round[];

  addCourse: (input: { name: string; location?: string; holes: Hole[] }) => Course;
  updateCourse: (id: string, patch: Partial<Omit<Course, "id" | "createdAt">>) => void;
  deleteCourse: (id: string) => void;

  addPlayer: (name: string, isSelf?: boolean) => Player;
  updatePlayer: (id: string, patch: Partial<Omit<Player, "id" | "createdAt">>) => void;
  deletePlayer: (id: string) => void;

  addRound: (input: Omit<Round, "id" | "createdAt">) => Round;
  updateRound: (id: string, patch: Partial<Omit<Round, "id" | "createdAt">>) => void;
  deleteRound: (id: string) => void;

  coursesById: Map<string, Course>;
  playersById: Map<string, Player>;
}

const AppDataCtx = createContext<AppData | null>(null);

function nextColor(existing: Player[]): string {
  return PLAYER_COLORS[existing.length % PLAYER_COLORS.length];
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useStoredState<Course[]>("courses", DEFAULT_COURSES);
  const [players, setPlayers] = useStoredState<Player[]>("players", []);
  const [rounds, setRounds] = useStoredState<Round[]>("rounds", []);

  const value = useMemo<AppData>(() => {
    const addCourse: AppData["addCourse"] = ({ name, location, holes }) => {
      const course: Course = {
        id: makeId(),
        name,
        location,
        holes,
        ratingBasis: holes.reduce((s, h) => s + h.par, 0),
        pointsPerThrow: 10,
        createdAt: new Date().toISOString(),
      };
      setCourses((prev) => [...prev, course]);
      return course;
    };

    const updateCourse: AppData["updateCourse"] = (id, patch) => {
      setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    };

    const deleteCourse: AppData["deleteCourse"] = (id) => {
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setRounds((prev) => prev.filter((r) => r.courseId !== id));
    };

    const addPlayer: AppData["addPlayer"] = (name, isSelf = false) => {
      const player: Player = {
        id: makeId(),
        name,
        isSelf,
        color: nextColor(players),
        createdAt: new Date().toISOString(),
      };
      setPlayers((prev) => [...prev, player]);
      return player;
    };

    const updatePlayer: AppData["updatePlayer"] = (id, patch) => {
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    };

    const deletePlayer: AppData["deletePlayer"] = (id) => {
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      setRounds((prev) =>
        prev
          .map((r) => {
            if (!r.playerIds.includes(id)) return r;
            const { [id]: _removed, ...rest } = r.scores;
            return { ...r, playerIds: r.playerIds.filter((pid) => pid !== id), scores: rest };
          })
          .filter((r) => r.playerIds.length > 0),
      );
    };

    const addRound: AppData["addRound"] = (input) => {
      const round: Round = { ...input, id: makeId(), createdAt: new Date().toISOString() };
      setRounds((prev) => [...prev, round]);
      return round;
    };

    const updateRound: AppData["updateRound"] = (id, patch) => {
      setRounds((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    };

    const deleteRound: AppData["deleteRound"] = (id) => {
      setRounds((prev) => prev.filter((r) => r.id !== id));
    };

    return {
      courses,
      players,
      rounds,
      addCourse,
      updateCourse,
      deleteCourse,
      addPlayer,
      updatePlayer,
      deletePlayer,
      addRound,
      updateRound,
      deleteRound,
      coursesById: new Map(courses.map((c) => [c.id, c])),
      playersById: new Map(players.map((p) => [p.id, p])),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, players, rounds]);

  return <AppDataCtx.Provider value={value}>{children}</AppDataCtx.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataCtx);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

export function defaultHoles(count: number, par = 3): Hole[] {
  return Array.from({ length: count }, (_, i) => ({ number: i + 1, par }));
}

export { coursePar };
