-- OPTIONAL (Phase 2). Makes the database reject any muscle name that isn't
-- a body-highlighter slug. Run it AFTER opening the updated app once while
-- online and Settings → Sync shows "All synced" (the app converts old names
-- like 'Chest' to 'chest' on first load). If any old names remain, Postgres
-- refuses to add the constraint and nothing changes — just sync and retry.

alter table public.exercises
  add constraint exercises_primary_muscles_are_slugs check (primary_muscles <@ array[
    'trapezius','triceps','forearm','adductors','calves','neck','deltoids','tibialis','obliques',
    'chest','biceps','abs','quadriceps','abductors','upper-back','lower-back','hamstring','gluteal'
  ]::text[]),
  add constraint exercises_secondary_muscles_are_slugs check (secondary_muscles <@ array[
    'trapezius','triceps','forearm','adductors','calves','neck','deltoids','tibialis','obliques',
    'chest','biceps','abs','quadriceps','abductors','upper-back','lower-back','hamstring','gluteal'
  ]::text[]);
