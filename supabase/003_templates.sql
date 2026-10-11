-- 003: workout templates. Run once in Supabase Dashboard → SQL Editor
-- (safe to re-run). Until it runs the app hides templates; everything
-- else keeps working.
-- exercises is an ordered JSON array: [{"exercise_id":"<uuid>","sets":3}, …]
-- There is no FK into jsonb — the app ignores ids of deleted exercises.

create table if not exists public.workout_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (btrim(name) <> ''),
  exercises  jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array'),
  created_at timestamptz default now()
);

create index if not exists workout_templates_user_id_idx on public.workout_templates (user_id);

alter table public.workout_templates enable row level security;

drop policy if exists "workout_templates: select own" on public.workout_templates;
create policy "workout_templates: select own" on public.workout_templates
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "workout_templates: insert own" on public.workout_templates;
create policy "workout_templates: insert own" on public.workout_templates
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "workout_templates: update own" on public.workout_templates;
create policy "workout_templates: update own" on public.workout_templates
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "workout_templates: delete own" on public.workout_templates;
create policy "workout_templates: delete own" on public.workout_templates
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.workout_templates to authenticated;

-- Make the API see the new table straight away.
notify pgrst, 'reload schema';
