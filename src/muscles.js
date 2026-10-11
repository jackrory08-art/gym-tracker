/* ═══════════════════════════════════════════════════════════════
   MUSCLES
   exercises.primary_muscles / secondary_muscles hold ONLY these slugs,
   which match the body-highlighter artwork in body-paths.js.
═══════════════════════════════════════════════════════════════ */

// Display order (roughly top-to-bottom, upper then core then lower).
export const MUSCLE_SLUGS = [
  'chest', 'deltoids', 'biceps', 'triceps', 'forearm', 'trapezius', 'neck',
  'upper-back', 'lower-back', 'abs', 'obliques',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'abductors', 'calves', 'tibialis',
];

// Drawn in the artwork but never trained / scored.
export const NON_MUSCLE_SLUGS = ['head', 'hair', 'hands', 'feet', 'knees', 'ankles'];

export const MUSCLE_LABELS = {
  chest:'Chest', deltoids:'Shoulders', biceps:'Biceps', triceps:'Triceps', forearm:'Forearms',
  trapezius:'Traps', neck:'Neck', 'upper-back':'Upper Back', 'lower-back':'Lower Back',
  abs:'Abs', obliques:'Obliques', gluteal:'Glutes', quadriceps:'Quads', hamstring:'Hamstrings',
  adductors:'Adductors', abductors:'Abductors', calves:'Calves', tibialis:'Tibialis',
};
export const muscleLabel = slug => MUSCLE_LABELS[slug] || slug;

export const UPPER_SLUGS = ['chest','deltoids','biceps','triceps','forearm','trapezius','neck','upper-back'];
export const LOWER_SLUGS = ['gluteal','quadriceps','hamstring','adductors','abductors','calves','tibialis'];
export const CORE_SLUGS  = ['abs','obliques','lower-back'];

// [primary, secondary] for the built-in exercises, keyed by lower-case name.
export const PRESET_MUSCLES = {
  'bench press':      [['chest'],                           ['triceps','deltoids']],
  'overhead press':   [['deltoids'],                        ['triceps','trapezius']],
  'barbell row':      [['upper-back'],                      ['biceps','trapezius','forearm']],
  'bicep curl':       [['biceps'],                          ['forearm']],
  'squat':            [['quadriceps','gluteal'],            ['hamstring','adductors','lower-back']],
  'deadlift':         [['hamstring','gluteal','lower-back'],['upper-back','trapezius','forearm','quadriceps']],
  'romanian dl':      [['hamstring','gluteal'],             ['lower-back','adductors']],
  'leg press':        [['quadriceps'],                      ['gluteal','hamstring','adductors']],
  'push-up':          [['chest'],                           ['triceps','deltoids','abs']],
  'pull-up':          [['upper-back'],                      ['biceps','forearm']],
  'dip':              [['triceps','chest'],                 ['deltoids']],
  'pike push-up':     [['deltoids'],                        ['triceps','trapezius']],
  'bodyweight squat': [['quadriceps'],                      ['gluteal','hamstring']],
  'lunge':            [['quadriceps','gluteal'],            ['hamstring','adductors','calves']],
  'plank':            [['abs'],                             ['obliques','deltoids','lower-back']],
  'sit-up':           [['abs'],                             ['obliques']],
  'leg raise':        [['abs'],                             ['obliques']],
  'running':          [['quadriceps','calves'],             ['hamstring','gluteal','tibialis']],
  'treadmill':        [['quadriceps','calves'],             ['hamstring','gluteal','tibialis']],
  'cycling':          [['quadriceps'],                      ['calves','hamstring','gluteal']],
  'rowing':           [['upper-back','quadriceps'],         ['biceps','hamstring','gluteal','lower-back']],
  'jump rope':        [['calves'],                          ['quadriceps','deltoids','forearm']],
};

// Muscle names used before Phase 2 (and free text from the old app).
const LEGACY_NAMES = {
  chest:['chest'], pecs:['chest'], shoulders:['deltoids'], delts:['deltoids'],
  biceps:['biceps'], triceps:['triceps'], forearms:['forearm'],
  back:['upper-back'], lats:['upper-back'], 'upper back':['upper-back'], 'lower back':['lower-back'],
  traps:['trapezius'], core:['abs'], quads:['quadriceps'], legs:['quadriceps'],
  glutes:['gluteal'], hamstrings:['hamstring'], 'hip flexors':[], cardio:[],
};

const isSlug = m => MUSCLE_SLUGS.includes(m);

export function toSlugs(names) {
  const out = [];
  for (const raw of names || []) {
    const key = String(raw).trim().toLowerCase();
    const slugs = isSlug(key) ? [key] : (LEGACY_NAMES[key] || []);
    for (const s of slugs) if (!out.includes(s)) out.push(s);
  }
  return out;
}

export const hasOnlySlugs = ex =>
  [...(ex.primary_muscles || []), ...(ex.secondary_muscles || [])].every(isSlug);

// Slug-only {primary_muscles, secondary_muscles} for an exercise: presets get
// the curated mapping, anything else has its old names translated.
export function slugMuscles(name, primary, secondary) {
  const preset = PRESET_MUSCLES[String(name || '').trim().toLowerCase()];
  if (preset) return { primary_muscles:[...preset[0]], secondary_muscles:[...preset[1]] };
  const p = toSlugs(primary);
  return { primary_muscles:p, secondary_muscles:toSlugs(secondary).filter(s => !p.includes(s)) };
}
