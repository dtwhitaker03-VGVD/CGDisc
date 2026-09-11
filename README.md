# CGDisc

A mobile-first disc golf tracking app. Log rounds at your local courses, get an
estimated rating for each round, and track your friends' scores to compare
handicaps with them.

## Features

- **Accounts, shared across devices** — sign up with email/password; you and
  your friends each log in from your own phones and see the same courses,
  rounds, and handicaps, synced live via Supabase.
- **Courses** — local Cape Girardeau-area courses are pre-loaded; add more
  with per-hole par (9, 18, or custom hole counts) and distance.
- **New round** — a phone-friendly 3-step flow: pick a course, pick who's
  playing (including quick-add for guest friends who don't want an account),
  then enter scores hole-by-hole with big tap-friendly +/- steppers. Three
  round types:
  - **Straight up** — individual scores, counts toward everyone's handicap.
  - **Handicapped** — once everyone playing has a handicap (3+ rounds each),
    each player gets bonus strokes relative to the group's best handicap,
    with a live net leaderboard as scores come in.
  - **Team** — group players into 2+ teams with a live team-total
    leaderboard; scores are entered per player as usual but don't count
    toward anyone's individual handicap or rating.
- **Ratings** — every round gets an estimated rating, self-consistent per
  course and tunable via each course's "rating basis" and "points per throw".
- **Handicaps** — a running handicap per player, computed from their best
  recent differentials (score vs. each course's rating basis), so handicaps
  stay comparable across courses.
- **Friends leaderboard** — see how everyone's handicap stacks up.
- Installable as a Progressive Web App (add to your phone's home screen —
  no app store needed). The app shell works offline, but signing in and
  syncing rounds needs a connection.

See the in-app "How ratings work" page (Stats tab) for the exact formulas.

## Backend: Supabase

Courses, players, and rounds live in a shared Supabase (Postgres) project —
not local device storage — so everyone signed in sees the same data. Row
Level Security is used with a simple "any signed-in user can read/write
everything" policy, which fits a small group of friends who trust each
other; it is **not** meant for a public, multi-tenant app.

### One-time project setup

1. Create a new Supabase project (a dedicated one for this app, not shared
   with another project's database).
2. Open the SQL Editor and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
   It creates the tables, security policies, a trigger that auto-creates a
   player profile whenever someone signs up (or claims a matching guest
   player if one with that exact name was already added -- see below),
   enables realtime sync, and seeds the local courses. It's safe to re-run.
3. From Settings > API, copy the **Project URL** and the **anon / public**
   key (never the `service_role` key) into `.env` (copy `.env.example`).
   The anon key is designed to be public client-side — Supabase's own docs
   say to embed it in browser apps — since access is enforced by the RLS
   policies from step 2, not by keeping the key secret. That's also why it's
   safe to commit `.env` for this project.
4. By default Supabase requires confirming a new account's email before it
   can sign in. For a quick "just my friends" setup you can turn that off
   under Authentication > Sign In / Providers > Email > "Confirm email".
   (Its built-in email sender also has a very low send-rate limit meant only
   for testing, so leaving confirmation on can quickly lock out real signups.)

### Guest players and claiming an account

Adding a friend by name (in Players, or mid-round in New Round) creates a
"guest" player with no login. If that person later signs up with the exact
same name (case/whitespace-insensitive), the signup trigger links their new
account to that existing player row instead of creating a duplicate, so
their round history carries over. The app's signup form reminds people of
this. A name that doesn't match exactly (e.g. "Dave" added as a guest,
signing up as "David") won't merge -- fix it by asking whoever manages the
database to update the guest row's name to match, or just accept two rows.

## Development

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
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
