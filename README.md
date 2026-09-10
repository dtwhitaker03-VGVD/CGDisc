# CGDisc

A mobile-first disc golf tracking app. Log rounds at your local courses, get an
estimated rating for each round, and track your friends' scores to compare
handicaps with them.

## Features

- **Courses** — add your local courses with per-hole par (9, 18, or custom hole counts).
- **New round** — a phone-friendly 3-step flow: pick a course, pick who's
  playing (including quick-add for new friends), then enter scores per hole
  with big tap-friendly +/- steppers.
- **Ratings** — every round gets an estimated rating, self-consistent per
  course and tunable via each course's "rating basis" and "points per throw".
- **Handicaps** — a running handicap per player, computed from their best
  recent differentials (score vs. each course's rating basis), so handicaps
  stay comparable across courses.
- **Friends leaderboard** — see how everyone's handicap stacks up.
- Installable as a Progressive Web App (works offline, add to your phone's
  home screen — no app store needed).

See the in-app "How ratings work" page (Stats tab) for the exact formulas.

All data (courses, players, rounds) is stored locally in the browser — there
is no backend or account system.

## Development

```bash
npm install
npm run dev
```

Open the printed local URL on your phone (same Wi-Fi network) or in your
desktop browser's device toolbar to preview at phone width.

## Build

```bash
npm run build
npm run preview
```

`npm run build` outputs a static site in `dist/` that can be hosted anywhere
(e.g. GitHub Pages, Netlify, Vercel, or any static file host). Once deployed,
open it on your phone and use "Add to Home Screen" to install it as an app.
