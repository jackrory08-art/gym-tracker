// crypto.randomUUID only exists in secure contexts (https / localhost);
// fall back to a v4 UUID from getRandomValues for plain-http LAN testing.
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// YYYY-MM-DD in the device's local timezone (toISOString would give the UTC day).
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// 'YYYY-MM-DD' → Date at local midnight (new Date('YYYY-MM-DD') would be UTC).
export function parseLocalDate(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Flat set rows (sorted by position) → one group per exercise, in first-seen order.
export function groupSets(sets) {
  const groups = new Map();
  for (const s of sets) {
    if (!groups.has(s.exercise_id)) groups.set(s.exercise_id, { exerciseId:s.exercise_id, sets:[] });
    groups.get(s.exercise_id).sets.push(s);
  }
  return [...groups.values()];
}
