/* ═══════════════════════════════════════════════════════════════
   HEAT MAP
   Intensity per muscle slug = sum of set volume over the last 30 days
   (primary × 1.0, secondary × 0.5), normalised 0–1 against the max.
   Set volume: strength = weight_kg × reps; bodyweight = reps × body
   weight on that day (70 kg if none logged); cardio = 0.
═══════════════════════════════════════════════════════════════ */
import { localDate } from './util.js';
import { MUSCLE_SLUGS } from './muscles.js';

export const HEAT_ZERO       = '#F5E6E6';
export const HEAT_STOPS      = ['#F5D5D5', '#E89A9A', '#D9534F', '#C0202A'];
export const NON_MUSCLE_FILL = '#9E9E9E';
export const DEFAULT_BODY_KG = 70;
export const WINDOW_DAYS     = 30;

const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

// t = 0 → HEAT_ZERO; t in (0, 1] → linear interpolation along HEAT_STOPS.
export function heatColor(t) {
  if (!(t > 0)) return HEAT_ZERO;
  const pos = Math.min(t, 1) * (HEAT_STOPS.length - 1);
  const i   = Math.min(Math.floor(pos), HEAT_STOPS.length - 2);
  const f   = pos - i;
  const a = hexToRgb(HEAT_STOPS[i]), b = hexToRgb(HEAT_STOPS[i + 1]);
  return rgbToHex(a.map((v, k) => v + (b[k] - v) * f));
}

// Body weight on a date: latest weigh-in on/before it, else the earliest one, else the default.
function bodyWeightLookup(logs) {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  return date => {
    let kg = null;
    for (const l of sorted) { if (l.date <= date) kg = +l.kg; else break; }
    return kg ?? (sorted.length ? +sorted[0].kg : DEFAULT_BODY_KG);
  };
}

export function setVolume(set, type, bodyKg) {
  const reps = +set.reps || 0;
  if (type === 'strength')   return (+set.weight_kg || 0) * reps;
  if (type === 'bodyweight') return bodyKg * reps;
  return 0;
}

// → { intensity: {slug: 0..1}, volume: {slug: number}, since, max }
export function muscleHeat({ workouts, sets, exercises, bodyWeightLogs }, today = new Date()) {
  const start = new Date(today);
  start.setDate(start.getDate() - (WINDOW_DAYS - 1));
  const since = localDate(start), until = localDate(today);

  const workoutDate = new Map(workouts.filter(w => w.date >= since && w.date <= until).map(w => [w.id, w.date]));
  const exById      = new Map(exercises.map(e => [e.id, e]));
  const bodyKgOn    = bodyWeightLookup(bodyWeightLogs);
  const volume      = Object.fromEntries(MUSCLE_SLUGS.map(s => [s, 0]));

  for (const set of sets) {
    const date = workoutDate.get(set.workout_id);
    const ex   = date && exById.get(set.exercise_id);
    if (!ex) continue;
    const v = setVolume(set, ex.type, ex.type === 'bodyweight' ? bodyKgOn(date) : 0);
    if (!v) continue;
    for (const s of ex.primary_muscles   || []) if (s in volume) volume[s] += v;
    for (const s of ex.secondary_muscles || []) if (s in volume) volume[s] += v * 0.5;
  }

  const max = Math.max(0, ...Object.values(volume));
  const intensity = Object.fromEntries(Object.entries(volume).map(([s, v]) => [s, max > 0 ? v / max : 0]));
  return { intensity, volume, since, max };
}
