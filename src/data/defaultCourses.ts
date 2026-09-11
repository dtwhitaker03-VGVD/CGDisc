import type { Course, Hole } from "../types";
import { DEFAULT_POINTS_PER_THROW } from "../lib/ratings";

function holes(spec: Array<[par: number, distanceFt: number]>): Hole[] {
  return spec.map(([par, distanceFt], i) => ({ number: i + 1, par, distanceFt }));
}

function withDefaults(course: Omit<Course, "ratingBasis" | "pointsPerThrow">): Course {
  return {
    ...course,
    ratingBasis: course.holes.reduce((sum, h) => sum + h.par, 0),
    pointsPerThrow: DEFAULT_POINTS_PER_THROW,
  };
}

/**
 * Seeded local courses (Cape Girardeau County, MO area), sourced from UDisc's
 * course directory. Hole count/par/distance can drift from what's on the
 * ground as courses get re-tee'd or holes get added/removed — edit a course
 * in-app any time to correct it.
 */
export const DEFAULT_COURSES: Course[] = [
  withDefaults({
    id: "capaha-park",
    name: "Capaha Park",
    location: "Cape Girardeau, MO",
    createdAt: "2026-01-01T00:00:00.000Z",
    holes: holes([
      [3, 209],
      [3, 170],
      [3, 252],
      [3, 218],
      [3, 231],
      [3, 196],
      [3, 226],
      [3, 207],
      [3, 260],
    ]),
  }),
  withDefaults({
    id: "cape-county-park-north",
    name: "Cape County Park North",
    location: "Cape Girardeau, MO",
    createdAt: "2026-01-01T00:00:00.000Z",
    holes: holes([
      [3, 255],
      [3, 318],
      [3, 299],
      [3, 218],
      [3, 147],
      [3, 293],
      [3, 381],
      [3, 294],
      [3, 185],
      [3, 194],
      [3, 206],
      [3, 373],
      [3, 362],
      [3, 248],
      [3, 304],
      [3, 293],
      [3, 280],
      [4, 507],
    ]),
  }),
  withDefaults({
    id: "litz-park",
    name: "Litz Park",
    location: "Jackson, MO",
    createdAt: "2026-01-01T00:00:00.000Z",
    holes: holes([
      [3, 288],
      [3, 293],
      [3, 228],
      [3, 177],
      [4, 490],
      [3, 307],
      [3, 323],
      [3, 175],
      [4, 470],
      [3, 264],
      [3, 252],
      [3, 248],
      [3, 186],
      [4, 389],
      [4, 488],
      [3, 290],
      [3, 282],
      [4, 547],
    ]),
  }),
  withDefaults({
    id: "scott-city-park",
    name: "Scott City Park",
    location: "Scott City, MO",
    createdAt: "2026-01-01T00:00:00.000Z",
    holes: holes([
      [3, 256],
      [3, 247],
      [3, 241],
      [3, 241],
      [3, 232],
      [3, 481],
      [3, 308],
      [3, 354],
      [3, 242],
      [3, 165],
      [4, 552],
      [4, 268],
      [3, 168],
      [3, 180],
      [3, 262],
      [3, 212],
      [3, 297],
      [3, 282],
    ]),
  }),
];
