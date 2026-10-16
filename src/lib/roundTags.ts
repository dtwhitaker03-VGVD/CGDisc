import type { Round } from "../types";

/** One-line tags describing how a round was played (mode and scoring). */
export function roundTags(r: Round): string {
  const parts: string[] = [];
  if (r.teamAssignments) {
    parts.push(
      r.teamGameType === "scramble"
        ? "Team · Scramble"
        : r.teamGameType === "bestBall"
          ? "Team · Best ball"
          : r.teamGameType === "teamTotal"
            ? "Team · Team total"
            : "Team",
    );
  } else {
    parts.push(r.handicapped ? "Handicapped" : "Straight up");
  }
  if (r.teamGameType !== "scramble") parts.push(r.scoringMethod === "holes" ? "By holes" : "By strokes");
  return parts.join(" · ");
}
