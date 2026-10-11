// Data is always stored in kg / metres / seconds; these convert to and
// from the per-device display units in settings ({ weightUnit, distanceUnit }).
export const LB_TO_KG = 0.45359237;
export const MI_TO_M  = 1609.344;

const roundTo = (v, dp) => Math.round(v * 10**dp) / 10**dp;

export function weightDisplay(kg, s)  { return kg==null ? '' : String(roundTo(s.weightUnit==='lbs' ? kg/LB_TO_KG : kg, 2)); }
export function weightToKg(v, s)      { return roundTo(v * (s.weightUnit==='lbs' ? LB_TO_KG : 1), 3); }
export function distanceDisplay(m, s) { return m==null ? '' : String(roundTo(m / (s.distanceUnit==='mi' ? MI_TO_M : 1000), 3)); }
export function distanceToM(v, s)     { return roundTo(v * (s.distanceUnit==='mi' ? MI_TO_M : 1000), 1); }

// Total weight lifted: "12,450 kg"; compact (tight rows) "27.4k lbs".
export function formatLifted(kg, s, compact = false) {
  const v = s.weightUnit === 'lbs' ? kg / LB_TO_KG : kg, u = s.weightUnit;
  if (compact && v >= 999950) return `${Math.round(v / 1e5) / 10}M ${u}`;   // not "1000k"
  if (compact && v >= 1e4) return `${Math.round(v / 1e2) / 10}k ${u}`;
  return `${Math.round(v).toLocaleString('en-GB')} ${u}`;
}

// Microwave-style time entry: digits fill from the right.
// '130' → 1:30, '2530' → 25:30, '13000' → 1:30:00. Max 6 digits.
export function durationFromDigits(raw) {
  const d = String(raw ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 6);
  if (!d) return { text:'', sec:0 };
  const ss = d.slice(-2).padStart(2, '0'), mm = d.slice(-4, -2), h = d.slice(0, -4);
  return {
    text: h ? `${+h}:${mm.padStart(2, '0')}:${ss}` : `${+mm || 0}:${ss}`,
    sec: (+h || 0) * 3600 + (+mm || 0) * 60 + +ss,
  };
}

// Seconds → "m:ss" or "h:mm:ss".
export function formatClock(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
