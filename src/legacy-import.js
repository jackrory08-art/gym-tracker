/* ═══════════════════════════════════════════════════════════════
   LEGACY IMPORT
   Converts data from the pre-Supabase app (Dexie "GymTrackerDB" or a
   backup JSON made by its Backup button) into rows for the Supabase
   schema, then uploads them. The old IndexedDB is only ever read.
═══════════════════════════════════════════════════════════════ */
import Dexie from 'dexie';
import { DB, TABLES } from './db.js';
import { uuid, localDate } from './util.js';
import { slugMuscles } from './muscles.js';

const LB_TO_KG = 0.45359237;
const MI_TO_M  = 1609.344;
const TYPES    = ['strength', 'bodyweight', 'cardio'];

const DONE_KEY    = 'gt_legacy_import_done';
const PAYLOAD_KEY = 'gt_legacy_import_payload';

export const legacyImportDone = () => !!localStorage.getItem(DONE_KEY);

// A file from the old Backup button, as opposed to a v2 backup of this app.
export function isLegacyBackup(obj) {
  return !!obj && obj.version !== 2 && Array.isArray(obj.workouts) && Array.isArray(obj.exercises)
    && (Array.isArray(obj.workoutExercises) || Array.isArray(obj.kv));
}

// Old data in this origin's IndexedDB (only found if this build is served
// from the same host:port the old app ran on).
export async function detectLocalLegacyData() {
  try {
    if (!(await Dexie.exists('GymTrackerDB'))) return null;
    const db = new Dexie('GymTrackerDB');
    await db.open();
    const read = name => db.tables.some(t => t.name === name) ? db.table(name).toArray() : [];
    const data = {
      kv:               await read('kv'),
      exercises:        await read('exercises'),
      workouts:         await read('workouts'),
      workoutExercises: await read('workoutExercises'),
      bodyWeightLogs:   await read('bodyWeightLogs'),
    };
    db.close();
    const hasContent = data.workouts.some(w => w.finishedAt) || data.bodyWeightLogs.length
      || data.exercises.some(e => !e.isPreset);
    return hasContent ? data : null;
  } catch (e) {
    console.warn('Legacy data check failed', e);
    return null;
  }
}

const num   = v => (v == null || v === '' || isNaN(+v)) ? null : +v;
const round = (v, dp) => v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp;
const isoDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : localDate(new Date(v));

// Pure mapping: legacy shape → { exercises, workouts, sets, body_weight_logs, name, settings, summary }.
// `existing` is the account's current data, used to avoid duplicate exercises / weigh-in dates.
export function mapLegacy(data, existing = { exercises:[], body_weight_logs:[] }) {
  const kv       = Object.fromEntries((data.kv || []).map(x => [x.key, x.value]));
  const activeId = kv.activeWorkout ?? null;
  const summary  = { exercises:0, reusedExercises:0, workouts:0, sets:0, bodyWeight:0, skippedWorkouts:0, skippedExercises:0 };

  // Exercises — matched by name against the account so presets aren't duplicated.
  const accountNames = new Map(existing.exercises.map(e => [e.name.trim().toLowerCase(), e.id]));
  const newNames     = new Map();
  const exIdMap      = new Map();
  const exercises    = [];
  for (const e of data.exercises || []) {
    const key = String(e.name || '').trim().toLowerCase();
    if (!key) continue;
    if (accountNames.has(key)) { exIdMap.set(e.id, accountNames.get(key)); summary.reusedExercises++; continue; }
    if (newNames.has(key))     { exIdMap.set(e.id, newNames.get(key)); continue; }
    // Old exercises listed muscles in one array, main muscle first.
    const muscles = (e.muscles || []).filter(m => m && m !== 'Cardio');
    const row = {
      id: uuid(),
      name: String(e.name).trim(),
      type: TYPES.includes(e.category) ? e.category : 'strength',
      ...slugMuscles(e.name, muscles.slice(0, 1), muscles.slice(1)),
    };
    exercises.push(row);
    newNames.set(key, row.id);
    exIdMap.set(e.id, row.id);
  }

  // Workouts — finished ones plus the one that was in progress.
  const wIdMap   = new Map();
  const workouts = [];
  for (const w of data.workouts || []) {
    if (!w.startedAt || (!w.finishedAt && w.id !== activeId)) { summary.skippedWorkouts++; continue; }
    const started = new Date(w.startedAt);
    const row = {
      id: uuid(),
      date: localDate(started),
      notes: w.notes || null,
      started_at:  started.toISOString(),
      finished_at: w.finishedAt ? new Date(w.finishedAt).toISOString() : null,
    };
    workouts.push(row);
    wIdMap.set(w.id, row.id);
  }

  // Sets — flattened; position follows card order (orderIndex) then set order.
  const sets  = [];
  const nextPos = new Map();
  const cards = [...(data.workoutExercises || [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  for (const we of cards) {
    const workoutId = wIdMap.get(we.workoutId);
    if (!workoutId) continue;
    const exerciseId = exIdMap.get(we.exerciseDefId);
    if (!exerciseId) { summary.skippedExercises++; continue; }
    for (const s of we.sets || []) {
      const position = (nextPos.get(workoutId) ?? 0) + 1;
      nextPos.set(workoutId, position);
      const weight   = num(s.weight);
      const distance = num(s.distance);
      sets.push({
        id: uuid(),
        workout_id:  workoutId,
        exercise_id: exerciseId,
        position,
        reps:       num(s.reps) == null ? null : Math.round(num(s.reps)),
        weight_kg:  weight == null ? null : round(weight * (s.unit === 'lbs' ? LB_TO_KG : 1), 3),
        duration_s: num(s.duration) ? Math.round(num(s.duration)) : null,   // old app stored 0 for "empty"
        distance_m: distance == null ? null : round(distance * (s.distanceUnit === 'mi' ? MI_TO_M : 1000), 1),
        calories:         num(s.calories),
        elevation_gain_m: num(s.vertGain),
        completed: !!s.completed,
      });
    }
  }

  // Body weight — one per date; dates already in the account are kept as-is.
  const takenDates = new Set(existing.body_weight_logs.map(b => b.date));
  const bwByDate   = new Map();
  for (const b of data.bodyWeightLogs || []) {
    const raw = num(b.kg) ?? num(b.weight);
    if (raw == null || !b.date) continue;
    const kg   = b.kg != null ? raw : raw * (b.unit === 'lbs' ? LB_TO_KG : 1);
    const date = isoDate(b.date);
    if (!takenDates.has(date)) bwByDate.set(date, { id:uuid(), date, kg:round(kg, 2) });
  }
  const body_weight_logs = [...bwByDate.values()];

  Object.assign(summary, { exercises:exercises.length, workouts:workouts.length, sets:sets.length, bodyWeight:body_weight_logs.length });
  return { exercises, workouts, sets, body_weight_logs, name:kv.user?.name || null, settings:kv.settings || null, summary };
}

// Cheap fingerprint so an interrupted import of the SAME source is
// retried with the same ids (idempotent upsert), but a different file isn't.
function fingerprint(data) {
  const s = JSON.stringify([data.exercises, data.workouts, data.workoutExercises, data.bodyWeightLogs]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

// Uploads to Supabase. Requires a connection. Returns the mapped result (summary, name, settings).
export async function runLegacyImport(data) {
  const fp = fingerprint(data);
  let mapped = null;
  try {
    const saved = JSON.parse(localStorage.getItem(PAYLOAD_KEY));
    if (saved?.fp === fp) mapped = saved.mapped;
  } catch {}
  if (!mapped) {
    mapped = mapLegacy(data, { exercises:DB.getExercises(), body_weight_logs:DB.getBodyWeightLogs() });
    try { localStorage.setItem(PAYLOAD_KEY, JSON.stringify({ fp, mapped })); }
    catch (e) { console.warn('Import payload too large to keep for retry', e); }
  }
  for (const table of TABLES) await DB.remoteUpsert(table, mapped[table]);
  localStorage.setItem(DONE_KEY, new Date().toISOString());
  localStorage.removeItem(PAYLOAD_KEY);
  return mapped;
}
