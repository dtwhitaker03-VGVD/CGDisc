import type { Course, Player, Round } from "../types";

const PREFIX = "cgdisc:v1:";
const IMPORTED_FLAG = `${PREFIX}imported-to-supabase`;

function readLegacy<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** True if this browser has pre-Supabase local data that hasn't been imported yet. */
export function hasUnimportedLegacyData(): boolean {
  if (typeof localStorage === "undefined") return false;
  if (localStorage.getItem(IMPORTED_FLAG)) return false;
  const players = readLegacy<Player[]>("players") ?? [];
  const rounds = readLegacy<Round[]>("rounds") ?? [];
  return players.length > 0 || rounds.length > 0;
}

export function markLegacyImported() {
  localStorage.setItem(IMPORTED_FLAG, "true");
}

export interface LegacyImportResult {
  coursesImported: number;
  playersImported: number;
  roundsImported: number;
}

export interface LegacyImportDeps {
  courses: Course[];
  players: Player[];
  addCourse: (input: { name: string; location?: string; holes: Course["holes"] }) => Promise<Course>;
  addPlayer: (name: string) => Promise<Player>;
  addRound: (input: Omit<Round, "id" | "createdAt">) => Promise<Round>;
}

/**
 * One-time migration: pulls players and rounds saved in this browser's
 * localStorage from before the app moved to a shared Supabase backend, and
 * recreates them there. Courses are matched by name against what's already
 * seeded server-side; only genuinely new courses get created. The legacy
 * "self" player's rounds are attributed to the current signed-in account
 * instead of creating a duplicate "you".
 */
export async function importLegacyData(deps: LegacyImportDeps): Promise<LegacyImportResult> {
  const legacyCourses = readLegacy<Course[]>("courses") ?? [];
  const legacyPlayers = readLegacy<Player[]>("players") ?? [];
  const legacyRounds = readLegacy<Round[]>("rounds") ?? [];

  const currentSelf = deps.players.find((p) => p.isSelf);

  const courseIdMap = new Map<string, string>();
  let coursesImported = 0;
  for (const legacy of legacyCourses) {
    const existing = deps.courses.find(
      (c) => c.name.trim().toLowerCase() === legacy.name.trim().toLowerCase(),
    );
    if (existing) {
      courseIdMap.set(legacy.id, existing.id);
    } else {
      const created = await deps.addCourse({
        name: legacy.name,
        location: legacy.location,
        holes: legacy.holes,
      });
      courseIdMap.set(legacy.id, created.id);
      coursesImported++;
    }
  }

  const playerIdMap = new Map<string, string>();
  let playersImported = 0;
  for (const legacy of legacyPlayers) {
    if (legacy.isSelf && currentSelf) {
      playerIdMap.set(legacy.id, currentSelf.id);
      continue;
    }
    const existing = deps.players.find(
      (p) => !p.isSelf && p.name.trim().toLowerCase() === legacy.name.trim().toLowerCase(),
    );
    if (existing) {
      playerIdMap.set(legacy.id, existing.id);
    } else {
      const created = await deps.addPlayer(legacy.name);
      playerIdMap.set(legacy.id, created.id);
      playersImported++;
    }
  }

  let roundsImported = 0;
  for (const legacy of legacyRounds) {
    const courseId = courseIdMap.get(legacy.courseId);
    if (!courseId) continue;

    const playerIds = legacy.playerIds.map((id) => playerIdMap.get(id)).filter((id): id is string => Boolean(id));
    if (playerIds.length === 0) continue;

    const scores: Record<string, number[]> = {};
    for (const [legacyPlayerId, strokes] of Object.entries(legacy.scores)) {
      const newPlayerId = playerIdMap.get(legacyPlayerId);
      if (newPlayerId) scores[newPlayerId] = strokes;
    }

    await deps.addRound({
      courseId,
      date: legacy.date,
      playerIds,
      scores,
      notes: legacy.notes,
    });
    roundsImported++;
  }

  markLegacyImported();
  return { coursesImported, playersImported, roundsImported };
}
