/* ═══════════════════════════════════════════════════════════════
   EXPORT FOR AI
   Builds a Markdown log, grouped by date (oldest first), for pasting
   into an AI chat. Every exercise is listed with only the set fields
   that have values, plus that day's body weight.
═══════════════════════════════════════════════════════════════ */
import { parseLocalDate, groupSets } from './util.js';
import { weightDisplay, distanceDisplay, formatClock } from './units.js';
import { muscleLabel } from './muscles.js';

const longDate = ymd => parseLocalDate(ymd).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
const clockTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

function minutesText(startIso, endIso) {
  const m = Math.round((new Date(endIso) - new Date(startIso)) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}min`;
}

function workoutHeading(w, n, total) {
  const label = total > 1 ? `Workout ${n}` : 'Workout';
  if (!w.started_at) return `### ${label}`;
  if (!w.finished_at) return `### ${label} (started ${clockTime(w.started_at)}, in progress)`;
  return `### ${label} (${clockTime(w.started_at)}–${clockTime(w.finished_at)}, ${minutesText(w.started_at, w.finished_at)})`;
}

function exerciseHeading(ex) {
  if (!ex) return '**Unknown exercise**';
  const bits = [ex.type];
  if (ex.primary_muscles?.length)   bits.push(`primary: ${ex.primary_muscles.map(muscleLabel).join(', ')}`);
  if (ex.secondary_muscles?.length) bits.push(`secondary: ${ex.secondary_muscles.map(muscleLabel).join(', ')}`);
  return `**${ex.name}** (${bits.join('; ')})`;
}

// Only the fields that have values, e.g. "80 kg × 8 reps, completed".
export function setFields(s, settings) {
  const parts  = [];
  const weight = s.weight_kg != null ? `${weightDisplay(s.weight_kg, settings)} ${settings.weightUnit}` : null;
  const reps   = s.reps != null ? `${s.reps} reps` : null;
  if (weight && reps) parts.push(`${weight} × ${reps}`);
  else if (weight || reps) parts.push(weight || reps);
  if (s.duration_s)              parts.push(formatClock(s.duration_s));
  if (s.distance_m != null)      parts.push(`${distanceDisplay(s.distance_m, settings)} ${settings.distanceUnit}`);
  if (s.calories != null)        parts.push(`${s.calories} kcal`);
  if (s.elevation_gain_m != null) parts.push(`${s.elevation_gain_m} m elevation gain`);
  if (s.completed)               parts.push('completed');
  return parts.join(', ');
}

// range: { from, to } as 'YYYY-MM-DD' (inclusive), either may be null for "all data".
// Returns { text, counts: { days, workouts, sets, weighIns } }.
export function buildExport({ workouts, sets, exercises, bodyWeightLogs }, settings, range, now = new Date()) {
  const inRange = d => (!range.from || d >= range.from) && (!range.to || d <= range.to);
  const exById  = new Map(exercises.map(e => [e.id, e]));
  const ws      = workouts.filter(w => inRange(w.date));
  const bws     = bodyWeightLogs.filter(b => inRange(b.date));
  const dates   = [...new Set([...ws.map(w => w.date), ...bws.map(b => b.date)])].sort();
  const counts  = { days:dates.length, workouts:ws.length, sets:0, weighIns:bws.length };

  let period;
  if (range.from && range.from === range.to) period = `Date: ${longDate(range.from)}`;
  else if (range.from || range.to)           period = `Period: ${range.from ? longDate(range.from) : 'start'} – ${range.to ? longDate(range.to) : 'today'}`;
  else period = dates.length ? `Period: all data (${longDate(dates[0])} – ${longDate(dates[dates.length-1])})` : 'Period: all data';

  const out = [
    '# Gym Tracker log',
    period,
    `Units: weight in ${settings.weightUnit}, distance in ${settings.distanceUnit}`,
    `Exported: ${now.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}`,
  ];

  if (!dates.length) out.push('', 'No workouts or weigh-ins recorded in this period.');

  for (const date of dates) {
    out.push('', `## ${longDate(date)}`);
    const bw = bws.find(b => b.date === date);
    if (bw) out.push(`Body weight: ${weightDisplay(bw.kg, settings)} ${settings.weightUnit}`);

    const dayWorkouts = ws.filter(w => w.date === date)
      .sort((a, b) => String(a.started_at).localeCompare(String(b.started_at)));
    dayWorkouts.forEach((w, i) => {
      out.push('', workoutHeading(w, i + 1, dayWorkouts.length));
      if (w.notes) out.push(`Notes: ${w.notes}`);
      const workoutSets = sets.filter(s => s.workout_id === w.id).sort((a, b) => a.position - b.position);
      const groups = groupSets(workoutSets);
      if (!groups.length) out.push('No exercises recorded.');
      for (const g of groups) {
        out.push(exerciseHeading(exById.get(g.exerciseId)));
        const lines = g.sets.map(s => setFields(s, settings)).filter(Boolean);
        if (!lines.length) out.push('- No values recorded');
        lines.forEach((line, k) => out.push(`- Set ${k + 1}: ${line}`));
        counts.sets += lines.length;
      }
    });
  }
  return { text: out.join('\n') + '\n', counts };
}
