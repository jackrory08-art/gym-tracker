/* ═══════════════════════════════════════════════════════════════
   DATABASE  (Supabase + in-memory cache + offline outbox)
   Reads return synchronously from _cache.
   Writes update _cache immediately, then queue an upsert/delete in
   the outbox (persisted to localStorage) which is flushed to
   Supabase in FIFO order whenever we're online. Ids are generated
   client-side, so every queued op is idempotent and safe to replay.
   A snapshot of the cache is kept in IndexedDB so the app can open
   offline.
═══════════════════════════════════════════════════════════════ */
import Dexie from 'dexie';
import { supabase } from './supabase.js';

// Core tables. legacy-import iterates these, so optional tables stay out.
export const TABLES    = ['exercises', 'workouts', 'sets', 'body_weight_logs'];
// Optional: needs supabase/003_templates.sql. If the table is missing the
// app keeps working and simply hides templates.
export const TEMPLATES = 'workout_templates';
const ALL_TABLES = [...TABLES, TEMPLATES];
const PAGE          = 1000;   // PostgREST default max rows per request
const CHUNK         = 500;
const FLUSH_DELAY   = 500;
const SNAPSHOT_WAIT = 1000;
const LOAD_TIMEOUT  = 10000;

const snapshotDB = new Dexie('GymTrackerCache');
snapshotDB.version(1).stores({ snapshot: '&userId' });

const _cache = { exercises:[], workouts:[], sets:[], body_weight_logs:[], workout_templates:[] };

let _userId     = null;
let _outbox     = [];      // [{ table, op:'upsert'|'delete', rows?, ids? }]
let _inflight   = null;
let _flushing   = false;
let _flushTimer = null;
let _retryTimer = null;
let _retryDelay = 2000;
let _snapTimer  = null;
let _onError    = msg => console.error(msg);
let _onChange   = () => {};
let _templatesOk = false;   // server has the templates table (last known)
let _rev         = 0;       // bumps on every cache change, for memoised stats

// PostgREST ≥12.2: PGRST205 "Could not find the table"; older: 42P01; both 404.
const isMissingTable = (err, status) => status === 404 || ['PGRST205', '42P01'].includes(err?.code);

const outboxKey = () => `gt_outbox_${_userId}`;

function loadOutbox() {
  try { _outbox = JSON.parse(localStorage.getItem(outboxKey())) || []; } catch { _outbox = []; }
}
function saveOutbox() {
  try { localStorage.setItem(outboxKey(), JSON.stringify(_outbox)); } catch (e) { console.error('Outbox save failed', e); }
  _onChange();
}

function applyToCache({ table, op, rows, ids }) {
  _rev++;
  if (op === 'upsert') {
    const list = _cache[table];
    for (const r of rows) {
      const existing = list.find(x => x.id === r.id);
      if (existing) Object.assign(existing, r); else list.push({ ...r });
    }
  } else {
    const del = new Set(ids);
    _cache[table] = _cache[table].filter(x => !del.has(x.id));
    // Mirror the server's ON DELETE CASCADE from workouts → sets.
    if (table === 'workouts') _cache.sets = _cache.sets.filter(s => !del.has(s.workout_id));
  }
}

function enqueue(op) {
  const last = _outbox[_outbox.length - 1];
  // Coalesce into the previous op when it targets the same table and
  // hasn't been sent yet, so typing in a set field doesn't queue one
  // request per keystroke. Only the tail is merged, preserving order.
  if (last && last !== _inflight && last.table === op.table && last.op === op.op) {
    if (op.op === 'upsert') {
      for (const r of op.rows) {
        const i = last.rows.findIndex(x => x.id === r.id);
        if (i >= 0) last.rows[i] = r; else last.rows.push(r);
      }
    } else {
      last.ids.push(...op.ids);
    }
  } else {
    _outbox.push(op);
  }
  saveOutbox();
  scheduleFlush(FLUSH_DELAY);
  scheduleSnapshot();
}

function write(table, rows) {
  _rev++;
  const full = rows.map(r => {
    const existing = _cache[table].find(x => x.id === r.id);
    if (existing) { Object.assign(existing, r); return existing; }
    const row = { user_id:_userId, ...r };
    _cache[table].push(row);
    return row;
  });
  // Always queue complete rows: a bulk upsert with missing keys would null them.
  enqueue({ table, op:'upsert', rows: full.map(r => ({ ...r })) });
  return full;
}

function remove(table, ids) {
  if (!ids.length) return;
  applyToCache({ table, op:'delete', ids });
  enqueue({ table, op:'delete', ids:[...ids] });
}

/* ── Sync ───────────────────────────────────────────────────── */
function scheduleFlush(ms) {
  clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flush, ms);
}

function scheduleRetry() {
  clearTimeout(_retryTimer);
  _retryTimer = setTimeout(flush, _retryDelay);
  _retryDelay = Math.min(_retryDelay * 2, 60000);
}

// Network failures (status 0), expired JWTs and server hiccups are
// retried; anything else (RLS, constraint, bad data) is permanent.
function isRetryable(status) {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

async function flush() {
  if (_flushing || !_userId || !supabase) return;
  _flushing = true;
  try {
    while (_outbox.length) {
      const op = _outbox[0];
      _inflight = op;
      let res;
      try {
        res = op.op === 'upsert'
          ? await supabase.from(op.table).upsert(op.rows)
          : await supabase.from(op.table).delete().in('id', op.ids);
      } catch (e) {
        res = { error:e, status:0 };
      }
      _inflight = null;
      if (res.error) {
        if (isRetryable(res.status ?? 0)) {
          if (res.status === 401) await supabase.auth.refreshSession().catch(() => {});
          scheduleRetry();
          break;
        }
        console.error('Dropped change that Supabase rejected', op, res.error);
        if (op.table === TEMPLATES && isMissingTable(res.error, res.status)) {
          _templatesOk = false;
          _onError("Templates aren't set up on the server yet — see Profile → Workout templates.");
        } else {
          _onError(`Couldn't save a change (${op.table}): ${res.error.message}`);
        }
      }
      _outbox.shift();
      saveOutbox();
      _retryDelay = 2000;
    }
  } finally {
    _inflight = null;
    _flushing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { _retryDelay = 2000; flush(); });
  // Flush right away when the app is backgrounded (iOS may suspend it
  // before the debounce fires) and again when it comes back.
  document.addEventListener('visibilitychange', () => { clearTimeout(_flushTimer); flush(); });
}

/* ── Snapshot (offline start) ───────────────────────────────── */
function scheduleSnapshot() {
  clearTimeout(_snapTimer);
  _snapTimer = setTimeout(saveSnapshot, SNAPSHOT_WAIT);
}

function saveSnapshot() {
  if (!_userId) return;
  snapshotDB.snapshot.put({ userId:_userId, savedAt:new Date().toISOString(), templatesAvailable:_templatesOk, data:JSON.parse(JSON.stringify(_cache)) })
    .catch(e => console.warn('Snapshot save failed', e));
}

async function fetchTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error, status } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1);
    if (error) throw Object.assign(error, { status });
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

// Optional table → { rows } | { missing:true } (table doesn't exist) |
// { unavailable:true } (other refusal, e.g. missing grant). Network /
// server errors still throw so load() can fall back to the snapshot.
async function fetchOptional(table) {
  try { return { rows:await fetchTable(table) }; }
  catch (e) {
    if (isRetryable(e.status ?? 0)) throw e;
    console.warn(`${table} unavailable`, e);
    return isMissingTable(e, e.status) ? { missing:true } : { unavailable:true };
  }
}

async function remoteDeleteAll() {
  // Children first so the exercises FK (on delete restrict) never blocks.
  for (const table of [TEMPLATES, 'sets', 'workouts', 'exercises', 'body_weight_logs']) {
    const { error, status } = await supabase.from(table).delete().eq('user_id', _userId);
    if (error && !(table === TEMPLATES && isMissingTable(error, status))) throw error;
  }
}

// Template items: [{ exercise_id, sets 1–20 }], other keys kept.
const cleanTemplateItems = items => (Array.isArray(items) ? items : [])
  .filter(i => i && typeof i.exercise_id === 'string')
  .map(i => { const n = Math.round(+i.sets); return { ...i, sets: n >= 1 ? Math.min(n, 20) : 1 }; });

/* ── Public API ─────────────────────────────────────────────── */
export const DB = {
  onError(fn)  { _onError = fn; },
  onChange(fn) { _onChange = fn; },

  // Returns { online } — false means the cache came from the offline snapshot.
  async load(userId) {
    _userId = userId;
    loadOutbox();
    let fresh = null, online = false, tplOk = false, tplMissing = false;
    try {
      // Weak gym signal shouldn't hang startup: give up and use the snapshot.
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('load timed out')), LOAD_TIMEOUT));
      const results = await Promise.race([Promise.all([...TABLES.map(fetchTable), fetchOptional(TEMPLATES)]), timeout]);
      fresh = Object.fromEntries(TABLES.map((t, i) => [t, results[i]]));
      const tpl = results[TABLES.length];
      tplOk = !!tpl.rows;
      tplMissing = !!tpl.missing;
      fresh[TEMPLATES] = tpl.rows || [];
      online = true;
    } catch (e) {
      console.warn('Supabase unreachable, starting from offline snapshot', e);
      const snap = await snapshotDB.snapshot.get(userId).catch(() => null);
      fresh = snap?.data || {};
      tplOk = !!snap?.templatesAvailable;
    }
    _templatesOk = tplOk;
    // The table doesn't exist, so queued template writes can never succeed.
    if (online && tplMissing && _outbox.some(op => op.table === TEMPLATES)) {
      console.warn('Dropping queued template changes: templates table missing');
      _outbox = _outbox.filter(op => op.table !== TEMPLATES);
      saveOutbox();
    }
    _rev++;
    for (const t of ALL_TABLES) _cache[t] = fresh[t] || [];
    for (const op of _outbox) applyToCache(JSON.parse(JSON.stringify(op)));  // unsent changes
    saveSnapshot();
    if (_outbox.length) scheduleFlush(0);
    return { online };
  },

  // Sign-out: forget everything cached on this device for the user.
  async reset() {
    clearTimeout(_flushTimer); clearTimeout(_retryTimer); clearTimeout(_snapTimer);
    if (_userId) {
      localStorage.removeItem(outboxKey());
      await snapshotDB.snapshot.delete(_userId).catch(() => {});
    }
    _userId = null; _outbox = []; _templatesOk = false; _rev++;
    for (const t of ALL_TABLES) _cache[t] = [];
  },

  rev()                { return _rev; },
  templatesAvailable() { return _templatesOk; },

  pendingCount() { return _outbox.reduce((n, op) => n + (op.rows?.length || op.ids?.length || 0), 0); },
  flush,

  getExercises()      { return _cache.exercises; },
  getExercise(id)     { return _cache.exercises.find(e => e.id === id) || null; },
  saveExercises(rows) { return write('exercises', rows); },
  deleteExercise(id)  { remove('exercises', [id]); },

  getWorkouts()      { return _cache.workouts; },
  getWorkout(id)     { return _cache.workouts.find(w => w.id === id) || null; },
  saveWorkout(row)   { return write('workouts', [row])[0]; },
  deleteWorkout(id)  { remove('workouts', [id]); },
  getActiveWorkout() {
    return _cache.workouts
      .filter(w => !w.finished_at)
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))[0] || null;
  },

  getSets()              { return _cache.sets; },
  getSetsForWorkout(wid) { return _cache.sets.filter(s => s.workout_id === wid).sort((a, b) => a.position - b.position); },
  saveSets(rows)         { return write('sets', rows); },
  deleteSets(ids)        { remove('sets', ids); },

  getBodyWeightLogs()      { return _cache.body_weight_logs; },
  saveBodyWeightLog(row)   { return write('body_weight_logs', [row])[0]; },
  deleteBodyWeightLog(id)  { remove('body_weight_logs', [id]); },

  getTemplates()    { return _cache.workout_templates.slice().sort((a, b) => a.name.localeCompare(b.name)); },
  getTemplate(id)   { return _cache.workout_templates.find(t => t.id === id) || null; },
  // Writes nothing (returns null) when the server has no templates table.
  saveTemplate(row) {
    if (!_templatesOk) return null;
    const r = { ...(DB.getTemplate(row.id) ? {} : { created_at:new Date().toISOString(), exercises:[] }), ...row };
    if ('name' in r) r.name = String(r.name).trim();
    if ('exercises' in r) r.exercises = cleanTemplateItems(r.exercises);
    return write(TEMPLATES, [r])[0];
  },
  deleteTemplate(id) { if (_templatesOk) remove(TEMPLATES, [id]); },
  // jsonb has no FK: strip a deleted exercise from every template.
  removeExerciseFromTemplates(exId) {
    if (!_templatesOk) return;
    const rows = _cache.workout_templates
      .filter(t => (t.exercises || []).some(i => i.exercise_id === exId))
      .map(t => ({ id:t.id, exercises:t.exercises.filter(i => i.exercise_id !== exId) }));
    if (rows.length) write(TEMPLATES, rows);
  },
  // After running the SQL: check again without a full reload.
  async recheckTemplates() {
    if (_templatesOk) return true;
    try {
      const { rows } = await fetchOptional(TEMPLATES);
      if (rows) { _cache[TEMPLATES] = rows; _templatesOk = true; _rev++; saveSnapshot(); }
    } catch {}
    return _templatesOk;
  },

  // ── Online-only bulk operations (bypass the outbox) ──
  async remoteUpsert(table, rows) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK).map(r => ({ ...r, user_id:_userId }));
      const { error, status } = await supabase.from(table).upsert(chunk);
      if (error) throw Object.assign(error, { status });
    }
  },

  async clearAll() {
    _outbox = []; saveOutbox();
    await remoteDeleteAll();
    _rev++;
    for (const t of ALL_TABLES) _cache[t] = [];
    saveSnapshot();
  },

  async replaceAll(data) {
    _outbox = []; saveOutbox();
    await remoteDeleteAll();
    for (const t of TABLES) await DB.remoteUpsert(t, data[t] || []);
    // Backups made before templates existed have no key → no templates.
    const tpl = (Array.isArray(data[TEMPLATES]) ? data[TEMPLATES] : [])
      .filter(t => t?.id && String(t.name ?? '').trim())
      .map(t => ({ ...t, name:String(t.name).trim(), exercises:cleanTemplateItems(t.exercises) }));
    let templatesSkipped = 0;
    // Templates are optional: never abort a restore half-way because of them.
    try { await DB.remoteUpsert(TEMPLATES, tpl); }   // [] sends no request
    catch (e) { console.error('Templates not restored', e); templatesSkipped = tpl.length; }
    return { ...(await DB.load(_userId)), templatesSkipped };
  },

  backup() {
    return { version:2, exportedAt:new Date().toISOString(), ...JSON.parse(JSON.stringify(_cache)) };
  },
};
