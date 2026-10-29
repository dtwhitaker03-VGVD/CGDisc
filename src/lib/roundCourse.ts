import type { Course, Round } from "../types";

/**
 * The course as it was played in a given round: any per-round par overrides
 * applied to the holes, and the rating basis shifted by the same amount so a
 * moved basket doesn't skew ratings or handicap (a hole that played a throw
 * longer is expected to cost a throw more). Returns the course itself when
 * the round has no overrides.
 */
export function courseForRound(course: Course, round: Pick<Round, "parOverrides">): Course {
  const overrides = round.parOverrides;
  if (!overrides || Object.keys(overrides).length === 0) return course;
  let delta = 0;
  const holes = course.holes.map((h) => {
    const par = overrides[String(h.number)];
    if (par === undefined || par === h.par) return h;
    delta += par - h.par;
    return { ...h, par };
  });
  return { ...course, holes, ratingBasis: course.ratingBasis + delta };
}
