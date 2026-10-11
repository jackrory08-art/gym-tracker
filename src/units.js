// Data is always stored in kg / metres / seconds; these convert to and
// from the per-device display units in settings ({ weightUnit, distanceUnit }).
export const LB_TO_KG = 0.45359237;
export const MI_TO_M  = 1609.344;

const roundTo = (v, dp) => Math.round(v * 10**dp) / 10**dp;

export function weightDisplay(kg, s)  { return kg==null ? '' : String(roundTo(s.weightUnit==='lbs' ? kg/LB_TO_KG : kg, 2)); }
export function weightToKg(v, s)      { return roundTo(v * (s.weightUnit==='lbs' ? LB_TO_KG : 1), 3); }
export function distanceDisplay(m, s) { return m==null ? '' : String(roundTo(m / (s.distanceUnit==='mi' ? MI_TO_M : 1000), 3)); }
export function distanceToM(v, s)     { return roundTo(v * (s.distanceUnit==='mi' ? MI_TO_M : 1000), 1); }

// Seconds → "m:ss" or "h:mm:ss".
export function formatClock(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
