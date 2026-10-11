-- ═══════════════════════════════════════════════════════════════
-- Gym Tracker schema — run once in Supabase Dashboard → SQL Editor.
-- Every row belongs to one auth user; RLS limits each user to
-- their own rows (auth.uid() = user_id) for all four operations.
-- ═══════════════════════════════════════════════════════════════

create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,
  type              text not null check (type in ('strength', 'bodyweight', 'cardio')),
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}'
);

create table public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  notes       text,
  started_at  timestamptz,
  finished_at timestamptz
);

-- Metric columns are nullable: which ones are used depends on the
-- exercise type (strength: reps + weight_kg, bodyweight: reps,
-- cardio: duration_s, distance_m, calories, elevation_gain_m).
create table public.sets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id       uuid not null references public.workouts (id) on delete cascade,
  exercise_id      uuid not null references public.exercises (id) on delete restrict,
  position         integer not null,
  reps             integer,
  weight_kg        numeric,
  duration_s       integer,
  distance_m       numeric,
  calories         numeric,
  elevation_gain_m numeric,
  completed        boolean not null default false
);

create table public.body_weight_logs (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date    date not null,
  kg      numeric not null check (kg > 0),
  unique (user_id, date)
);

create index exercises_user_id_idx  on public.exercises (user_id);
create index workouts_user_date_idx on public.workouts (user_id, date);
create index sets_workout_id_idx    on public.sets (workout_id);
create index sets_exercise_id_idx   on public.sets (exercise_id);
create index sets_user_id_idx       on public.sets (user_id);

-- ── Row Level Security ─────────────────────────────────────────

alter table public.exercises        enable row level security;
alter table public.workouts         enable row level security;
alter table public.sets             enable row level security;
alter table public.body_weight_logs enable row level security;

-- exercises
create policy "exercises: select own" on public.exercises
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercises: insert own" on public.exercises
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "exercises: update own" on public.exercises
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "exercises: delete own" on public.exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

-- workouts
create policy "workouts: select own" on public.workouts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "workouts: insert own" on public.workouts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "workouts: update own" on public.workouts
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "workouts: delete own" on public.workouts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- sets
create policy "sets: select own" on public.sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sets: insert own" on public.sets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sets: update own" on public.sets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sets: delete own" on public.sets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- body_weight_logs
create policy "body_weight_logs: select own" on public.body_weight_logs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "body_weight_logs: insert own" on public.body_weight_logs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "body_weight_logs: update own" on public.body_weight_logs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "body_weight_logs: delete own" on public.body_weight_logs
  for delete to authenticated using ((select auth.uid()) = user_id);
