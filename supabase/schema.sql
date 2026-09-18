-- CGDisc shared/multiplayer schema.
--
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query).
-- Safe to re-run: every statement is guarded with "if not exists" / "or replace" / drop-then-create.
--
-- Trust model: this app is meant for a small group of friends who all trust each other,
-- not a public multi-tenant app. Any signed-in user can read and write all shared data
-- (courses, players, rounds, scores) -- there's no per-user data isolation beyond requiring
-- login. That's what makes "add a friend, track everyone's rounds together" work without
-- a lot of sharing/invite machinery.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per person who can appear in a round: either a real signed-in account
-- (user_id set, auto-created on signup, see trigger below) or a "guest" player
-- added by name only (user_id null) for a friend who doesn't want to make an account.
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null unique,
  name text not null,
  color text not null default '#15803d',
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  holes jsonb not null, -- [{ "number": 1, "par": 3, "distanceFt": 209 }, ...]
  rating_basis integer not null,
  points_per_throw numeric not null default 10,
  -- Optional hole-layout map image: a full URL, or a path relative to the
  -- app's own origin (e.g. an image bundled under public/ in the repo).
  map_image_url text,
  created_at timestamptz not null default now()
);

alter table public.courses
  add column if not exists map_image_url text;

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  date date not null,
  notes text,
  created_by uuid references public.players (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Handicap allowances, if any, are locked in from each player's handicap
  -- at round start (relative to the lowest in the group) so they don't
  -- shift retroactively as handicaps change later.
  handicapped boolean not null default false,
  handicap_allowances jsonb, -- { "<playerId>": <bonus strokes>, ... }
  -- Team rounds: playerId -> team index (0-based). Team rounds are excluded
  -- from handicap/rating calculations entirely (see playerDifferentials).
  team_assignments jsonb
);

alter table public.rounds
  add column if not exists handicapped boolean not null default false,
  add column if not exists handicap_allowances jsonb,
  add column if not exists team_assignments jsonb;

-- One row per player per round; strokes is the per-hole score array, same
-- order as the course's holes at the time the round was played.
create table if not exists public.round_scores (
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  strokes jsonb not null, -- [3, 4, 3, ...]
  primary key (round_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Auto-create (or claim) a player row whenever someone signs up
-- ---------------------------------------------------------------------------

-- If a guest player (added by name only, before they had an account) already
-- exists with this exact name, claim that row instead of creating a
-- duplicate -- this is how "add a friend by name" reconciles with them
-- later signing up for their own account, preserving their round history.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_name text := coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1));
  existing_guest_id uuid;
begin
  select id into existing_guest_id
  from public.players
  where user_id is null
    and lower(trim(name)) = lower(trim(new_name))
  order by created_at
  limit 1;

  if existing_guest_id is not null then
    update public.players set user_id = new.id where id = existing_guest_id;
  else
    insert into public.players (user_id, name) values (new.id, new_name);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security: any signed-in user can read/write all shared data
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.courses enable row level security;
alter table public.rounds enable row level security;
alter table public.round_scores enable row level security;

-- Note: this app does not use Supabase anonymous sign-ins, so `to authenticated`
-- alone (no per-row ownership check) is sufficient to mean "any real signed-in
-- user of this app" -- matching the shared-trust model described above.

drop policy if exists "authenticated read players" on public.players;
create policy "authenticated read players" on public.players for select
  to authenticated using (true);

drop policy if exists "authenticated write players" on public.players;
create policy "authenticated write players" on public.players for all
  to authenticated using (true) with check (true);

drop policy if exists "authenticated read courses" on public.courses;
create policy "authenticated read courses" on public.courses for select
  to authenticated using (true);

drop policy if exists "authenticated write courses" on public.courses;
create policy "authenticated write courses" on public.courses for all
  to authenticated using (true) with check (true);

drop policy if exists "authenticated read rounds" on public.rounds;
create policy "authenticated read rounds" on public.rounds for select
  to authenticated using (true);

drop policy if exists "authenticated write rounds" on public.rounds;
create policy "authenticated write rounds" on public.rounds for all
  to authenticated using (true) with check (true);

drop policy if exists "authenticated read round_scores" on public.round_scores;
create policy "authenticated read round_scores" on public.round_scores for select
  to authenticated using (true);

drop policy if exists "authenticated write round_scores" on public.round_scores;
create policy "authenticated write round_scores" on public.round_scores for all
  to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Realtime: push live changes to every connected device
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'courses'
  ) then
    alter publication supabase_realtime add table public.courses;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rounds'
  ) then
    alter publication supabase_realtime add table public.rounds;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'round_scores'
  ) then
    alter publication supabase_realtime add table public.round_scores;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Seed the local Cape Girardeau-area courses (safe to re-run; skips if a
-- course with the same name already exists)
-- ---------------------------------------------------------------------------

insert into public.courses (name, location, holes, rating_basis, points_per_throw, map_image_url)
select * from (values
  (
    'Capaha Park',
    'Cape Girardeau, MO',
    '[
      {"number":1,"par":3,"distanceFt":209},{"number":2,"par":3,"distanceFt":170},
      {"number":3,"par":3,"distanceFt":252},{"number":4,"par":3,"distanceFt":218},
      {"number":5,"par":3,"distanceFt":231},{"number":6,"par":3,"distanceFt":196},
      {"number":7,"par":3,"distanceFt":226},{"number":8,"par":3,"distanceFt":207},
      {"number":9,"par":3,"distanceFt":260}
    ]'::jsonb,
    27, 10, null
  ),
  (
    'Cape County Park North',
    'Cape Girardeau, MO',
    '[
      {"number":1,"par":3,"distanceFt":255},{"number":2,"par":3,"distanceFt":318},
      {"number":3,"par":3,"distanceFt":299},{"number":4,"par":3,"distanceFt":218},
      {"number":5,"par":3,"distanceFt":147},{"number":6,"par":3,"distanceFt":293},
      {"number":7,"par":3,"distanceFt":381},{"number":8,"par":3,"distanceFt":294},
      {"number":9,"par":3,"distanceFt":185},{"number":10,"par":3,"distanceFt":194},
      {"number":11,"par":3,"distanceFt":206},{"number":12,"par":3,"distanceFt":373},
      {"number":13,"par":3,"distanceFt":362},{"number":14,"par":3,"distanceFt":248},
      {"number":15,"par":3,"distanceFt":304},{"number":16,"par":3,"distanceFt":293},
      {"number":17,"par":3,"distanceFt":280},{"number":18,"par":4,"distanceFt":507}
    ]'::jsonb,
    55, 10, null
  ),
  (
    'Litz Park',
    'Jackson, MO',
    '[
      {"number":1,"par":3,"distanceFt":288},{"number":2,"par":3,"distanceFt":293},
      {"number":3,"par":3,"distanceFt":228},{"number":4,"par":3,"distanceFt":177},
      {"number":5,"par":4,"distanceFt":490},{"number":6,"par":3,"distanceFt":307},
      {"number":7,"par":3,"distanceFt":323},{"number":8,"par":3,"distanceFt":175},
      {"number":9,"par":4,"distanceFt":470},{"number":10,"par":3,"distanceFt":264},
      {"number":11,"par":3,"distanceFt":252},{"number":12,"par":3,"distanceFt":248},
      {"number":13,"par":3,"distanceFt":186},{"number":14,"par":4,"distanceFt":389},
      {"number":15,"par":4,"distanceFt":488},{"number":16,"par":3,"distanceFt":290},
      {"number":17,"par":3,"distanceFt":282},{"number":18,"par":4,"distanceFt":547}
    ]'::jsonb,
    59, 10, 'course-maps/litz-park.webp'
  ),
  (
    'Scott City Park',
    'Scott City, MO',
    '[
      {"number":1,"par":3,"distanceFt":256},{"number":2,"par":3,"distanceFt":247},
      {"number":3,"par":3,"distanceFt":241},{"number":4,"par":3,"distanceFt":241},
      {"number":5,"par":3,"distanceFt":232},{"number":6,"par":3,"distanceFt":481},
      {"number":7,"par":3,"distanceFt":308},{"number":8,"par":3,"distanceFt":354},
      {"number":9,"par":3,"distanceFt":242},{"number":10,"par":3,"distanceFt":165},
      {"number":11,"par":4,"distanceFt":552},{"number":12,"par":4,"distanceFt":268},
      {"number":13,"par":3,"distanceFt":168},{"number":14,"par":3,"distanceFt":180},
      {"number":15,"par":3,"distanceFt":262},{"number":16,"par":3,"distanceFt":212},
      {"number":17,"par":3,"distanceFt":297},{"number":18,"par":3,"distanceFt":282}
    ]'::jsonb,
    56, 10, null
  )
) as seed(name, location, holes, rating_basis, points_per_throw, map_image_url)
where not exists (
  select 1 from public.courses c where c.name = seed.name
);
