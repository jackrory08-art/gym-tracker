/* ═══════════════════════════════════════════════════════════════
   STATS  (pure — no DOM)
   History = FINISHED workouts only. Counting rule, used for totals,
   PRs and "last time": within one workout, per exercise, if any set
   is ticked only the ticked sets count, otherwise every set that has
   values counts (ticking is optional in this app).
═══════════════════════════════════════════════════════════════ */
import { groupSets } from './util.js';

export const E1RM_MAX_REPS = 12;   // Epley overestimates beyond this
const EPS = 1e-6;
const pos = v => { const n = +v; return n > 0 ? n : 0; };   // null / '' / negative → 0

// Chronological: date first (past-dated workouts sort by their day), then
// start time (Date.parse: Supabase returns '+00:00', the client writes 'Z'), then id.
export function compareWorkouts(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const t = (Date.parse(a.started_at) || 0) - (Date.parse(b.started_at) || 0);
  if (t) return t;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function hasValues(s, type) {
  if (type === 'strength')   return pos(s.weight_kg) > 0 || pos(s.reps) > 0;
  if (type === 'bodyweight') return pos(s.reps) > 0;
  return pos(s.duration_s) > 0 || pos(s.distance_m) > 0 || pos(s.calories) > 0 || pos(s.elevation_gain_m) > 0;
}

// One exercise's sets in one workout (position order) → the sets that count.
export function countedSets(exSets, type) {
  const ticked = exSets.some(s => s.completed);
  return exSets.filter(s => (!ticked || s.completed) && hasValues(s, type));
}

export const setLiftedKg = (s, type) => type === 'strength' ? pos(s.weight_kg) * Math.round(pos(s.reps)) : 0;

// Any workout's sets → kg lifted. Strength only (weight × reps).
export function workoutLiftedKg(sets, exById) {
  let kg = 0;
  for (const g of groupSets(sets)) {
    const ex = exById.get(g.exerciseId);
    if (ex?.type === 'strength') for (const s of countedSets(g.sets, ex.type)) kg += setLiftedKg(s, ex.type);
  }
  return kg;
}

// Epley estimated one-rep max; null when it isn't meaningful.
export function e1rm(weightKg, reps) {
  const w = pos(weightKg), r = Math.round(pos(reps));
  if (!w || !r || r > E1RM_MAX_REPS) return null;
  return r === 1 ? w : w * (1 + r / 30);
}

/* ── Personal records ───────────────────────────────────────── */
export const SET_KINDS     = { strength:['weight','e1rm'], bodyweight:['reps'], cardio:['distance','duration'] };
export const SESSION_KINDS = { strength:['volume'], bodyweight:['totalReps'], cardio:[] };
export const PR_LABELS = {
  weight:'Heaviest weight', e1rm:'Best est. 1RM', volume:'Most volume',
  reps:'Most reps', totalReps:'Most total reps', distance:'Longest distance', duration:'Longest time',
};

const METRIC = {
  weight:   s => pos(s.reps) ? pos(s.weight_kg) || null : null,
  e1rm:     s => e1rm(s.weight_kg, s.reps),
  reps:     s => pos(s.reps) || null,
  distance: s => pos(s.distance_m) || null,
  duration: s => pos(s.duration_s) || null,
};

const maxOf = (sets, f) => sets.reduce((m, s) => { const v = f(s); return v != null && (m == null || v > m) ? v : m; }, null);

// Session summary: per-set maxima plus summed volume / reps (0 → null).
export function summarize(sets, type) {
  const volume    = sets.reduce((t, s) => t + setLiftedKg(s, type), 0);
  const totalReps = type === 'bodyweight' ? sets.reduce((t, s) => t + Math.round(pos(s.reps)), 0) : 0;
  const sum = {
    weight:maxOf(sets, METRIC.weight), e1rm:maxOf(sets, METRIC.e1rm), reps:maxOf(sets, METRIC.reps),
    distance:maxOf(sets, METRIC.distance), duration:maxOf(sets, METRIC.duration),
    volume:volume || null, totalReps:totalReps || null,
  };
  return sum;
}

export const emptyBests = () => ({ sessions:0, weight:null, e1rm:null, volume:null, reps:null, totalReps:null, distance:null, duration:null });

export function addToBests(b, sum) {
  b.sessions++;
  for (const k of ['weight','e1rm','volume','reps','totalReps','distance','duration'])
    if (sum[k] != null && (b[k] == null || sum[k] > b[k])) b[k] = sum[k];
  return b;
}

// sets = counted sets of one exercise in one workout. No PRs on the first
// session ever, none for a kind with no earlier value, strictly greater only,
// one set per kind.  → { bySet: Map(setId → kinds[]), session: kinds[] }
export function sessionPRs(sets, type, bests) {
  const out = { bySet:new Map(), session:[] };
  if (!bests?.sessions) return out;
  for (const k of SET_KINDS[type] || []) {
    if (bests[k] == null) continue;
    let hit = null, bar = bests[k] + EPS;
    for (const s of sets) { const v = METRIC[k](s); if (v != null && v > bar) { hit = s; bar = v; } }
    if (hit) out.bySet.set(hit.id, [...(out.bySet.get(hit.id) || []), k]);
  }
  const sum = summarize(sets, type);
  for (const k of SESSION_KINDS[type] || [])
    if (bests[k] != null && sum[k] != null && sum[k] > bests[k] + EPS) out.session.push(k);
  return out;
}

/* ── Index (one pass per data change) ───────────────────────── */
export function buildStatsIndex({ workouts, sets, exercises }) {
  const exById = new Map(exercises.map(e => [e.id, e]));
  const setsByWorkout = new Map();
  for (const s of sets) {
    if (!setsByWorkout.has(s.workout_id)) setsByWorkout.set(s.workout_id, []);
    setsByWorkout.get(s.workout_id).push(s);
  }
  for (const list of setsByWorkout.values()) list.sort((a, b) => a.position - b.position);

  const liftedByWorkout = new Map();
  const sessionsByEx = new Map();   // exId → [{ workout, sets }] oldest first
  const finished = workouts.filter(w => w.finished_at).sort(compareWorkouts);
  for (const w of finished) {
    const wSets = setsByWorkout.get(w.id) || [];
    let kg = 0;
    for (const g of groupSets(wSets)) {
      const ex = exById.get(g.exerciseId);
      if (!ex) continue;
      const counted = countedSets(g.sets, ex.type);
      for (const s of counted) kg += setLiftedKg(s, ex.type);
      if (!counted.length) continue;
      if (!sessionsByEx.has(ex.id)) sessionsByEx.set(ex.id, []);
      sessionsByEx.get(ex.id).push({ workout:w, sets:counted });
    }
    liftedByWorkout.set(w.id, kg);
  }
  return { exById, setsByWorkout, sessionsByEx, liftedByWorkout };
}

const isBefore = (sess, workout) => !workout || (sess.workout.id !== workout.id && compareWorkouts(sess.workout, workout) < 0);

// Most recent earlier session of this exercise → { workout, sets } | null.
export function previousPerformance(exerciseId, workout, idx) {
  const list = idx.sessionsByEx.get(exerciseId) || [];
  for (let i = list.length - 1; i >= 0; i--) if (isBefore(list[i], workout)) return list[i];
  return null;
}

// Bests from every session before `workout` (null → all-time).
export function personalBests(exerciseId, workout, idx) {
  const type = idx.exById.get(exerciseId)?.type;
  const b = emptyBests();
  for (const s of idx.sessionsByEx.get(exerciseId) || []) if (isBefore(s, workout)) addToBests(b, summarize(s.sets, type));
  return b;
}

// → { sessions:[{ workout, date, sets, summary, prs }] newest first, bests (all-time) }
export function exerciseHistory(exerciseId, idx) {
  const type = idx.exById.get(exerciseId)?.type;
  const running = emptyBests(), out = [];
  for (const s of idx.sessionsByEx.get(exerciseId) || []) {
    const summary = summarize(s.sets, type);
    const prs = sessionPRs(s.sets, type, running);
    addToBests(running, summary);
    out.push({ workout:s.workout, date:s.workout.date, sets:s.sets, summary, prs });
  }
  return { sessions:out.reverse(), bests:running };
}

// PRs in one workout (active or finished), judged against everything before it.
// → { bySet: Map(setId → kinds[]), session: Map(exId → kinds[]), count }
export function workoutPRs(workout, sets, idx) {
  const bySet = new Map(), session = new Map();
  let count = 0;
  for (const g of groupSets(sets)) {
    const ex = idx.exById.get(g.exerciseId);
    if (!ex) continue;
    const r = sessionPRs(countedSets(g.sets, ex.type), ex.type, personalBests(ex.id, workout, idx));
    for (const [id, kinds] of r.bySet) bySet.set(id, kinds);
    if (r.session.length) session.set(ex.id, r.session);
    count += r.bySet.size + r.session.length;
  }
  return { bySet, session, count };
}
