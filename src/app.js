import { supabase, supabaseConfigured } from './supabase.js';
import { DB } from './db.js';
import { uuid, localDate, parseLocalDate, groupSets } from './util.js';
import { weightDisplay, weightToKg, distanceDisplay, distanceToM } from './units.js';
import { detectLocalLegacyData, isLegacyBackup, runLegacyImport, legacyImportDone } from './legacy-import.js';
import { MUSCLE_SLUGS, UPPER_SLUGS, LOWER_SLUGS, CORE_SLUGS, muscleLabel, slugMuscles, hasOnlySlugs } from './muscles.js';
import { renderBodySVG } from './body-map.js';
import { buildExport } from './export.js';
import { muscleHeat, heatColor, HEAT_ZERO, HEAT_STOPS, NON_MUSCLE_FILL, WINDOW_DAYS } from './heatmap.js';

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */

// Seeded into a new account; muscles come from PRESET_MUSCLES (slugs).
const PRESET_EXERCISES = [
  ['Bench Press','strength'], ['Overhead Press','strength'], ['Barbell Row','strength'], ['Bicep Curl','strength'],
  ['Squat','strength'], ['Deadlift','strength'], ['Romanian DL','strength'], ['Leg Press','strength'],
  ['Push-up','bodyweight'], ['Pull-up','bodyweight'], ['Dip','bodyweight'], ['Pike Push-up','bodyweight'],
  ['Bodyweight Squat','bodyweight'], ['Lunge','bodyweight'],
  ['Plank','bodyweight'], ['Sit-up','bodyweight'], ['Leg Raise','bodyweight'],
  ['Running','cardio'], ['Treadmill','cardio'], ['Cycling','cardio'], ['Rowing','cardio'], ['Jump Rope','cardio'],
].map(([name, type]) => ({ name, type, ...slugMuscles(name) }));

const BODY_REGIONS = [
  { id:'all',   label:'All',        icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6m-4 4 4-4 4 4M8 21v-3a4 4 0 0 1 8 0v3"/></svg>` },
  { id:'upper', label:'Upper Body', icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="4" r="2"/><path d="M8 8h8M8 8c-2 1-3 3-2 5l1 4h6l1-4c1-2 0-4-2-5M6 10l-2 4M18 10l2 4"/></svg>` },
  { id:'lower', label:'Lower Body', icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4h6v8H9zM9 12l-2 9M15 12l2 9M9 16h6"/></svg>` },
  { id:'core',  label:'Core',       icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="12" rx="6" ry="9"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="12" x2="18" y2="12"/></svg>` },
  { id:'full',  label:'Full Body',  icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="4" r="2"/><path d="M12 6v7M9 21v-5l-2-4 3-2M15 21v-5l2-4-3-2M9 10h6"/></svg>` },
];

/* ═══════════════════════════════════════════════════════════════
   SESSION + DEVICE SETTINGS
═══════════════════════════════════════════════════════════════ */
let session     = null;
let legacyLocal = null;   // old-app data found in this origin's IndexedDB

const currentUser = () => session?.user || null;
const userName    = () => currentUser()?.user_metadata?.name || '';

// Units are a per-device display preference; data is always kg / m / s.
const SETTINGS_KEY = 'gt_settings';
function getSettings() {
  try { return { weightUnit:'kg', distanceUnit:'km', ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
  catch { return { weightUnit:'kg', distanceUnit:'km' }; }
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function escHtml(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(date) {
  return date.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

function formatDuration(startIso, endIso) {
  const m = Math.floor((new Date(endIso)-new Date(startIso))/60000);
  return m<60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
}

function workoutDuration(w) {
  return w.started_at && w.finished_at ? formatDuration(w.started_at, w.finished_at) : '—';
}

const workoutTime = w => new Date(w.started_at || parseLocalDate(w.date)).getTime();

function formatElapsed(startIso) {
  const s = Math.floor((Date.now()-new Date(startIso))/1000);
  const m = Math.floor(s/60), h = Math.floor(m/60);
  return h>0
    ? `${h}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

function formatDurationInput(sec) {
  return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
}
function parseDurationInput(s) {
  const p=s.split(':');
  return p.length===2 ? parseInt(p[0])*60+parseInt(p[1]) : parseInt(s)||0;
}

function categoryLabel(c) { return {strength:'Strength',cardio:'Cardio',bodyweight:'Bodyweight'}[c]||c; }
function regionLabel(r)    { return {upper:'Upper Body',lower:'Lower Body',core:'Core',full:'Full Body',all:'All'}[r]||r; }

const exerciseMuscles = ex => [...(ex.primary_muscles||[]), ...(ex.secondary_muscles||[])];
const exerciseGroup   = ex => ex.type==='cardio' ? 'Cardio' : (ex.primary_muscles?.[0] ? muscleLabel(ex.primary_muscles[0]) : 'Other');
const musclesText     = (ex, limit) => exerciseMuscles(ex).slice(0, limit).map(m=>escHtml(muscleLabel(m))).join(' · ');

// Body region is derived from muscles (there is no region column).
function exerciseRegion(ex) {
  const primary = ex.primary_muscles || [];
  if (primary.length && primary.every(m => CORE_SLUGS.includes(m))) return 'core';
  const all = exerciseMuscles(ex);
  const upper = all.some(m => UPPER_SLUGS.includes(m));
  const lower = all.some(m => LOWER_SLUGS.includes(m));
  return upper && lower ? 'full' : upper ? 'upper' : lower ? 'lower' : 'full';
}

/* ═══════════════════════════════════════════════════════════════
   SEED
═══════════════════════════════════════════════════════════════ */
function seedPresets() {
  DB.saveExercises(PRESET_EXERCISES.map(e => ({ id:uuid(), ...e })));
}

// One-time upgrade of pre-Phase-2 muscle names ('Chest', 'Quads', …) to slugs.
function migrateMuscleSlugs() {
  const changed = DB.getExercises()
    .filter(e => !hasOnlySlugs(e))
    .map(e => ({ id:e.id, ...slugMuscles(e.name, e.primary_muscles, e.secondary_muscles) }));
  if (changed.length) DB.saveExercises(changed);
}

/* ═══════════════════════════════════════════════════════════════
   ROUTER
═══════════════════════════════════════════════════════════════ */
const PUBLIC_ROUTES = ['/login'];

const Router = {
  navigate(path) {
    if (Router.current() === path) Router.route();
    else window.location.hash = path;
  },

  current() { return window.location.hash.slice(1) || '/home'; },

  matchHistory(path) { const m=path.match(/^\/history\/(.+)$/); return m?m[1]:null; },

  init() {
    window.addEventListener('hashchange', ()=>Router.route());
    Router.route();
  },

  route() {
    const path      = Router.current();
    const container = document.getElementById('view-container');

    if (!session && !PUBLIC_ROUTES.includes(path)) { Router.navigate('/login'); return; }

    if (path === '/login') {
      if (session) { Router.navigate('/home'); return; }
      setTabBar(false);
      container.innerHTML = renderLogin();
      return;
    }

    if (path === '/onboarding') {
      setTabBar(false);
      container.innerHTML = renderOnboarding();
      return;
    }

    if (path === '/target') {
      setTabBar(false);
      container.innerHTML = renderTarget();
      return;
    }

    setTabBar(true, path);

    if      (path === '/home')           container.innerHTML = renderHome();
    else if (path === '/workout/new')    { container.innerHTML = renderPicker(); initPicker(); }
    else if (path === '/workout/active') { container.innerHTML = renderActiveWorkout(); startTimer(); }
    else if (path === '/history')        container.innerHTML = renderHistory();
    else if (Router.matchHistory(path))  container.innerHTML = renderHistoryDetail(Router.matchHistory(path));
    else if (path === '/library')        container.innerHTML = renderLibrary();
    else if (path === '/progress')       { container.innerHTML = renderProgress(); initHeatmapCarousel(); drawWeightChart(); }
    else if (path === '/export')         container.innerHTML = renderExport();
    else if (path === '/settings')       container.innerHTML = renderSettings();
    else Router.navigate('/home');
  },
};

// The floating bar overlays content; body.has-tabbar pads the scroller,
// and lifts the toast / FAB / rest pill above it.
function setTabBar(visible, path) {
  document.getElementById('tab-bar').hidden = !visible;
  document.body.classList.toggle('has-tabbar', visible);
  if (visible) updateTabBar(path);
}

function updateTabBar(path) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.dataset.tab;
    btn.classList.toggle('active',
      (tab === 'home'     && path === '/home') ||
      (tab === 'workout'  && path.startsWith('/workout')) ||
      (tab === 'library'  && path === '/library') ||
      (tab === 'history'  && (path === '/history' || path.startsWith('/history/'))) ||
      (tab === 'progress' && path === '/progress') ||
      (tab === 'settings' && path === '/settings')
    );
  });
}

/* ═══════════════════════════════════════════════════════════════
   BODY SVG HELPERS
═══════════════════════════════════════════════════════════════ */
// Muscle-target selector (exercise picker filter) on the body-highlighter artwork.
const TARGET_SELECTED = '#3b6fd4', TARGET_IDLE = '#D5DDE6';

function targetFill(slug) {
  if (!MUSCLE_SLUGS.includes(slug)) return NON_MUSCLE_FILL;
  return pickerState.selectedMuscles.includes(slug) ? TARGET_SELECTED : TARGET_IDLE;
}

function renderTargetBody(view) {
  return renderBodySVG(view, targetFill, {
    attrsFor: slug => MUSCLE_SLUGS.includes(slug) ? `data-action="toggle-muscle" data-muscle="${slug}" style="cursor:pointer"` : '',
  });
}

function updateMuscleHighlights() {
  const sel = pickerState.selectedMuscles;
  document.querySelectorAll('[data-action="toggle-muscle"]').forEach(el => el.setAttribute('fill', targetFill(el.dataset.muscle)));
  document.querySelectorAll('.muscle-pill[data-action="muscle-pill"]').forEach(el => {
    el.classList.toggle('active', sel.includes(el.dataset.muscle));
  });
  const allBtn = document.querySelector('[data-action="muscle-all"]');
  if (allBtn) allBtn.classList.toggle('active', sel.length === 0);
}

/* ═══════════════════════════════════════════════════════════════
   VIEWS
═══════════════════════════════════════════════════════════════ */

/* ── Config missing / loading ─────────────────────────────────── */
function renderConfigMissing() {
  setTabBar(false);
  document.getElementById('view-container').innerHTML = `
    <div class="onboarding-screen">
      <div>
        <h1 class="onboarding-title">Supabase not<br>configured.</h1>
        <p class="onboarding-subtitle">Copy <code>.env.example</code> to <code>.env.local</code>, fill in
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart <code>npm run dev</code>.</p>
      </div>
    </div>`;
}

function renderLoading() {
  setTabBar(false);
  document.getElementById('view-container').innerHTML = `
    <div class="onboarding-screen loading-screen"><div class="spinner"></div></div>`;
}

/* ── Login ────────────────────────────────────────────────────── */
function renderLogin() {
  return `
    <div class="onboarding-screen slide-up">
      <div>
        <h1 class="onboarding-title">Gym<br>Tracker.</h1>
        <p class="onboarding-subtitle">Sign in to sync your training.</p>
      </div>
      <form class="onboarding-form" id="login-form" novalidate>
        <input class="text-input" id="login-email" type="email" placeholder="Email"
          autocomplete="username" autocapitalize="off" autocorrect="off" inputmode="email">
        <input class="text-input" id="login-password" type="password" placeholder="Password"
          autocomplete="current-password">
        <div class="form-error" id="login-error" hidden></div>
        <button class="btn btn-primary" type="submit" id="login-submit">Sign In</button>
      </form>
    </div>`;
}

async function submitLogin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-submit');
  const fail = msg => { errEl.textContent = msg; errEl.hidden = false; btn.disabled = false; btn.textContent = 'Sign In'; };

  if (!email || !password) return fail('Enter your email and password.');
  if (!navigator.onLine)   return fail("You're offline. Connect to sign in.");

  btn.disabled = true; btn.textContent = 'Signing in…'; errEl.hidden = true;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail(error.message);

  session = data.session;
  await afterSignIn();
  Router.navigate(userName() ? '/home' : '/onboarding');
  promptLegacyImport();
}

/* ── Onboarding (name, once after first sign-in) ──────────────── */
function renderOnboarding() {
  return `
    <div class="onboarding-screen slide-up">
      <div>
        <h1 class="onboarding-title">Gym<br>Tracker.</h1>
        <p class="onboarding-subtitle">Log every rep. Track every gain.</p>
      </div>
      <div class="onboarding-form">
        <input class="text-input" id="onboarding-name" type="text"
          placeholder="Your first name" autocomplete="given-name" autocorrect="off" maxlength="40">
        <button class="btn btn-primary" data-action="onboarding-submit">Get Started</button>
      </div>
    </div>`;
}

/* ── Home helpers ─────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function renderProfileBubble() {
  const initial = [...userName().trim()][0]?.toUpperCase();   // spread: emoji-safe
  const person = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  return `<button class="profile-bubble" data-action="nav-tab" data-tab="settings" aria-label="Profile">${initial ? escHtml(initial) : person}</button>`;
}

function getWeekStrip(workouts) {
  const today = new Date(); today.setHours(0,0,0,0);
  const dow   = today.getDay();
  const diffToMon = (dow + 6) % 7;
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - diffToMon);
  const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const checkSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const playSvg   = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 20 12 7 20 7 4"/></svg>`;
  const playOutline=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7 4 20 12 7 20 7 4"/></svg>`;

  return DAY_NAMES.map((name, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
    const isToday  = d.getTime() === today.getTime();
    const isPast   = d < today;
    const hasWkt   = workouts.some(w => w.finished_at && w.date === localDate(d));

    let cls, dotCls, dotInner;
    if (hasWkt) {
      cls = isToday ? 'day-today' : 'day-done';
      dotCls = 'done'; dotInner = checkSvg;
    } else if (isToday) {
      cls = 'day-today'; dotCls = 'today'; dotInner = playSvg;
    } else if (isPast) {
      cls = 'day-missed'; dotCls = 'missed'; dotInner = '+';
    } else {
      cls = 'day-future'; dotCls = 'future'; dotInner = playOutline;
    }

    return `<div class="week-day ${cls}">
      <span class="wday-name">${name}</span>
      <span class="wday-num">${d.getDate()}</span>
      <div class="week-dot ${dotCls}">${dotInner}</div>
    </div>`;
  }).join('');
}

/* ── Home ─────────────────────────────────────────────────────── */
function renderHome() {
  const workouts = DB.getWorkouts().filter(w => w.finished_at);
  const exMap    = Object.fromEntries(DB.getExercises().map(e => [e.id, e]));
  const active   = DB.getActiveWorkout();

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (now.getDay() + 6) % 7);
  const weekStartStr = localDate(weekStart);
  const thisWeek  = workouts.filter(w => w.date >= weekStartStr);
  const weekIds   = new Set(thisWeek.map(w => w.id));
  const totalSets = DB.getSets().filter(s => weekIds.has(s.workout_id)).length;

  const recent = workouts.slice().sort((a, b) => workoutTime(b) - workoutTime(a)).slice(0, 4);

  const dumbbellSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M2 12h2m16 0h2M4 10v4M20 10v4"/></svg>`;
  const chevronSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  const recentRows = recent.length === 0
    ? `<div class="empty-state" style="padding:32px 0">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:48px;height:48px;opacity:.3"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
         <p>No workouts yet. Hit Start to begin!</p>
       </div>`
    : recent.map(w => {
        const groups = groupSets(DB.getSetsForWorkout(w.id));
        const label  = exMap[groups[0]?.exerciseId]?.name || 'Workout';
        const dateStr = parseLocalDate(w.date).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
        return `<div class="recent-item" data-action="open-history-detail" data-id="${w.id}">
          <div class="recent-icon">${dumbbellSvg}</div>
          <div class="recent-info">
            <div class="recent-name">${escHtml(label)}</div>
            <div class="recent-date">${dateStr}</div>
          </div>
          <div class="recent-stats">
            <div class="recent-dur">${workoutDuration(w)}</div>
            <div class="recent-ex">${groups.length} ex</div>
          </div>
          <div class="recent-chevron">${chevronSvg}</div>
        </div>`;
      }).join('');

  const ctaAction = active ? 'resume-workout' : 'start-workout';
  const ctaTitle  = active ? 'Resume Workout'  : 'Start Workout';
  const ctaSub    = active ? 'Continue where you left off' : "Let's get moving";

  return `
    <div class="screen">
      <div class="home-header">
        <div class="home-header-text">
          <div class="home-greeting">${getGreeting()}, ${escHtml(userName() || 'there')}</div>
          <div class="home-sub">Ready to crush it?</div>
        </div>
        ${renderProfileBubble()}
      </div>
      <div class="scroll-content" style="gap:16px;padding-top:20px">

        <div class="week-strip">${getWeekStrip(workouts)}</div>

        <div class="stats-3">
          <div class="stat3">
            <svg class="stat3-icon green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            <div class="stat3-val">${thisWeek.length}</div>
            <div class="stat3-label">This Week</div>
          </div>
          <div class="stat3">
            <svg class="stat3-icon blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <div class="stat3-val">${totalSets}</div>
            <div class="stat3-label">Sets</div>
          </div>
          <div class="stat3">
            <svg class="stat3-icon gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
            <div class="stat3-val">${workouts.length}</div>
            <div class="stat3-label">Total</div>
          </div>
        </div>

        <button class="cta-card" data-action="${ctaAction}">
          <div class="cta-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M2 12h2m16 0h2M4 10v4M20 10v4"/></svg>
          </div>
          <div class="cta-text">
            <div class="cta-title">${ctaTitle}</div>
            <div class="cta-sub">${ctaSub}</div>
          </div>
          <div class="cta-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
          </div>
        </button>

        <div class="recent-header">
          <span class="recent-label">Recent Workouts</span>
          <button class="btn-ghost" style="font-size:14px" data-action="nav-tab" data-tab="history">See All</button>
        </div>
        <div class="recent-list">${recentRows}</div>

      </div>
    </div>`;
}

/* ── Muscle Target Selector ───────────────────────────────────── */
function renderTarget() {
  const sel = pickerState.selectedMuscles;
  const view = pickerState.bodyView || 'front';

  const pills = MUSCLE_SLUGS.map(m =>
    `<button class="muscle-pill ${sel.includes(m)?'active':''}" data-action="muscle-pill" data-muscle="${m}">${muscleLabel(m)}</button>`
  ).join('');

  return `
    <div class="screen target-screen">
      <div class="target-header">
        <button class="btn-ghost" data-action="target-cancel">Cancel</button>
        <span class="target-title">Target Muscles</span>
        <button class="btn-ghost target-done-btn" data-action="target-done">Done${sel.length>0?` (${sel.length})`:''}</button>
      </div>

      <div class="body-view-toggle">
        <button class="body-view-btn ${view==='front'?'active':''}" data-action="body-view-toggle" data-view="front">Front</button>
        <button class="body-view-btn ${view==='back'?'active':''}" data-action="body-view-toggle" data-view="back">Back</button>
      </div>

      <div class="muscle-svg-wrap" id="body-svg-container">
        ${renderTargetBody(view)}
      </div>

      <div class="muscle-pills-wrap">
        <button class="muscle-pill all-pill ${sel.length===0?'active':''}" data-action="muscle-all">All muscles</button>
        ${pills}
      </div>

      ${sel.length > 0 ? `<button class="muscle-clear-btn" data-action="muscle-clear">Clear selection</button>` : ''}
    </div>`;
}

/* ── Exercise Picker ──────────────────────────────────────────── */
const freshPickerState = () => ({
  search:'', category:'all', bodyRegion:'all',
  showCustomForm:false, customName:'', customCat:'strength',
  selectedMuscles:[], bodyView:'front'
});
let pickerState = freshPickerState();

// Primary + secondary muscle pills for the custom-exercise forms. A muscle can
// only be in one group; the selection is read back from the DOM on save.
function renderMuscleChoice(action) {
  const group = role => `<div class="muscle-pills-wrap form-pills">${MUSCLE_SLUGS.map(m =>
    `<button type="button" class="muscle-pill" data-action="${action}" data-role="${role}" data-muscle="${m}">${muscleLabel(m)}</button>`
  ).join('')}</div>`;
  return `<div class="settings-label" style="padding:4px 2px 4px">Primary muscles</div>${group('primary')}
    <div class="settings-label" style="padding:4px 2px 4px">Secondary muscles</div>${group('secondary')}`;
}

function toggleMuscleChoice(btn) {
  const on = btn.classList.toggle('active');
  if (!on) return;
  const other = btn.dataset.role==='primary' ? 'secondary' : 'primary';
  document.querySelector(`[data-action="${btn.dataset.action}"][data-role="${other}"][data-muscle="${btn.dataset.muscle}"]`)?.classList.remove('active');
}

const chosenMuscles = (action, role) =>
  [...document.querySelectorAll(`[data-action="${action}"][data-role="${role}"].active`)].map(b=>b.dataset.muscle);

function filteredExercises() {
  const { search, category, bodyRegion, selectedMuscles } = pickerState;
  let filtered = DB.getExercises().filter(e =>
    (category==='all'   || e.type===category) &&
    (bodyRegion==='all' || exerciseRegion(e)===bodyRegion) &&
    e.name.toLowerCase().includes(search.toLowerCase()));
  if (selectedMuscles.length > 0) {
    filtered = filtered.filter(e => exerciseMuscles(e).some(m => selectedMuscles.includes(m)));
  }
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

function renderExerciseItems(list) {
  return list.length===0
    ? `<div class="empty-state" style="padding-top:48px"><p>No exercises found</p></div>`
    : list.map(e=>{
        const muscles = musclesText(e);
        return `
        <div class="exercise-item">
          <span class="exercise-dot ${e.type}"></span>
          <div class="exercise-item-info">
            <div class="exercise-item-name">${escHtml(e.name)}</div>
            ${muscles ? `<div class="exercise-item-muscles">${muscles}</div>` : ''}
          </div>
          <span class="exercise-item-tag">${escHtml(exerciseGroup(e))}</span>
          <button class="exercise-item-add" data-action="picker-add" data-exid="${e.id}" aria-label="Add">+</button>
        </div>`;
      }).join('');
}

function renderPicker() {
  const { search, category, bodyRegion, showCustomForm, customName, customCat, selectedMuscles } = pickerState;

  const muscleCount = selectedMuscles.length;
  const targetChipActive = muscleCount > 0;

  const regionTabs = BODY_REGIONS.map(r=>
    `<button class="region-tab ${bodyRegion===r.id?'active':''}" data-action="picker-region" data-region="${r.id}">
       ${r.icon}${r.label}
     </button>`).join('');

  const catTabs = ['all','strength','bodyweight','cardio'].map(c=>
    `<button class="cat-tab ${category===c?'active':''}" data-action="picker-cat" data-cat="${c}">
       ${c==='all'?'All':categoryLabel(c)}
     </button>`).join('');

  const customForm = showCustomForm ? `
    <div class="add-custom-form">
      <h3>New exercise</h3>
      <input class="text-input" id="custom-ex-name" type="text" placeholder="Exercise name" value="${escHtml(customName)}" autocorrect="off" maxlength="60">
      <div class="settings-label" style="padding:0 2px 4px">Type</div>
      <div class="segment-control">
        ${['strength','bodyweight','cardio'].map(c=>
          `<button class="seg-btn ${customCat===c?'active':''}" data-action="custom-cat" data-cat="${c}">${categoryLabel(c)}</button>`
        ).join('')}
      </div>
      ${renderMuscleChoice('custom-muscle')}
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" data-action="custom-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" data-action="custom-save">Save</button>
      </div>
    </div>` : `
    <div style="padding:0 16px 8px">
      <button class="btn btn-secondary" data-action="custom-form-show">+ Add custom exercise</button>
    </div>`;

  return `
    <div class="screen">
      <div class="picker-header">
        <div class="picker-top-row">
          <h1>Add Exercise</h1>
          <button class="btn-ghost" data-action="picker-close">Cancel</button>
        </div>
        <div class="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="search" id="picker-search" placeholder="Search exercises…" value="${escHtml(search)}" autocorrect="off">
        </div>
        <div class="picker-filter-row">
          <button class="target-chip ${targetChipActive?'active':''}" data-action="open-target">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6m-4 4 4-4 4 4M8 21v-3a4 4 0 0 1 8 0v3"/></svg>
            Muscles${muscleCount>0?` (${muscleCount})`:''}
          </button>
        </div>
        <div class="region-tabs">${regionTabs}</div>
        <div class="category-tabs">${catTabs}</div>
      </div>
      ${customForm}
      <div class="exercise-list" id="exercise-list">${renderExerciseItems(filteredExercises())}</div>
    </div>`;
}

function rebuildExerciseList() {
  const el = document.getElementById('exercise-list');
  if (el) el.innerHTML = renderExerciseItems(filteredExercises());
}

function initPicker() {
  const inp = document.getElementById('picker-search');
  if (inp) inp.addEventListener('input', e=>{ pickerState.search=e.target.value; rebuildExerciseList(); });
}

/* ── Active Workout ───────────────────────────────────────────── */
let timerInterval = null;

function startTimer() {
  clearInterval(timerInterval);
  const workout = DB.getActiveWorkout();
  if (!workout) return;
  timerInterval = setInterval(()=>{
    const el = document.getElementById('workout-timer');
    if (el) el.textContent = formatElapsed(workout.started_at);
    else    clearInterval(timerInterval);
  }, 1000);
}

function renderActiveWorkout() {
  const workout = DB.getActiveWorkout();
  if (!workout) { Router.navigate('/home'); return '<div></div>'; }

  const groups   = groupSets(DB.getSetsForWorkout(workout.id));
  const settings = getSettings();

  const cards = groups.map(g=>{
    const ex = DB.getExercise(g.exerciseId);
    return ex ? renderExerciseCard(g, ex, settings) : '';
  }).join('');

  return `
    <div class="screen">
      <div class="workout-header-sticky">
        <div>
          <div class="workout-title">Active Workout</div>
          <div id="workout-timer" class="workout-timer">${formatElapsed(workout.started_at)}</div>
        </div>
        <button class="btn btn-ghost-danger btn-sm" data-action="discard-workout">Discard</button>
      </div>
      <div id="exercise-cards">${cards}</div>
      <div class="workout-actions">
        <button class="add-exercise-btn" data-action="add-exercise">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Exercise
        </button>
        <button class="btn btn-primary" data-action="finish-workout">Finish Workout</button>
      </div>
    </div>`;
}

function renderExerciseCard(group, ex, settings) {
  const headerCols = ex.type==='strength'
    ? '<span>#</span><span>Weight</span><span></span><span>Reps</span><span>✓</span>'
    : ex.type==='bodyweight' ? '<span>#</span><span>Reps</span><span>✓</span>'
    : `<span>#</span><span>Time</span><span>${settings.distanceUnit}</span><span>Cal</span><span>Gain</span><span>✓</span>`;
  const muscles = musclesText(ex, 3);

  return `
    <div class="exercise-card" data-exid="${ex.id}">
      <div class="exercise-card-header">
        <div style="flex:1;min-width:0">
          <div class="exercise-card-name">${escHtml(ex.name)}</div>
          ${muscles ? `<div style="font-size:12px;color:var(--fg3);margin-top:2px">${muscles}</div>` : ''}
        </div>
        <span class="exercise-card-badge badge-${ex.type}">${categoryLabel(ex.type)}</span>
        <button class="btn-icon" data-action="remove-exercise" data-exid="${ex.id}" aria-label="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="sets-table">
        <div class="set-row-header type-${ex.type}">${headerCols}</div>
        <div class="set-rows" data-exid="${ex.id}">
          ${group.sets.map((s,i)=>renderSetRow(s,i,ex.type,settings)).join('')}
        </div>
      </div>
      <button class="add-set-btn" data-action="add-set" data-exid="${ex.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Set
      </button>
    </div>`;
}

function renderSetRow(set, idx, type, settings) {
  const done  = set.completed ? 'done' : '';
  const rowCls = set.completed ? 'completed' : '';
  const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const input = (field, value, placeholder, mode='decimal', inputType='number') =>
    `<input class="set-input" type="${inputType}" inputmode="${mode}" placeholder="${placeholder}" value="${escHtml(value)}" data-action="set-field" data-setid="${set.id}" data-field="${field}"${inputType==='number'?' min="0"':''}>`;
  const checkBtn = `<button class="set-check ${done}" data-action="toggle-set" data-setid="${set.id}">${check}</button>`;

  if (type==='strength') {
    return `<div class="set-row type-strength ${rowCls}" data-setid="${set.id}">
      <span class="set-num">${idx+1}</span>
      ${input('weight', weightDisplay(set.weight_kg, settings), '0')}
      <span class="set-sep">${settings.weightUnit}</span>
      ${input('reps', set.reps ?? '', '0', 'numeric')}
      ${checkBtn}
    </div>`;
  }
  if (type==='bodyweight') {
    return `<div class="set-row type-bodyweight ${rowCls}" data-setid="${set.id}">
      <span class="set-num">${idx+1}</span>
      ${input('reps', set.reps ?? '', '0', 'numeric')}
      ${checkBtn}
    </div>`;
  }
  return `<div class="set-row type-cardio ${rowCls}" data-setid="${set.id}">
    <span class="set-num">${idx+1}</span>
    ${input('duration', set.duration_s ? formatDurationInput(set.duration_s) : '', 'mm:ss', 'numeric', 'text')}
    ${input('distance', distanceDisplay(set.distance_m, settings), settings.distanceUnit)}
    ${input('calories', set.calories ?? '', 'cal', 'numeric')}
    ${input('elevation', set.elevation_gain_m ?? '', 'm', 'numeric')}
    ${checkBtn}
  </div>`;
}

/* ── History ──────────────────────────────────────────────────── */
function renderHistory() {
  const workouts = DB.getWorkouts().filter(w=>w.finished_at).sort((a,b)=>workoutTime(b)-workoutTime(a));
  const exMap    = Object.fromEntries(DB.getExercises().map(e=>[e.id,e]));

  const cards = workouts.length===0
    ? `<div class="empty-state" style="padding-top:64px">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
         <p>No workouts logged yet.</p>
       </div>`
    : workouts.map(w=>{
        const sets    = DB.getSetsForWorkout(w.id);
        const groups  = groupSets(sets);
        const exs     = groups.map(g=>exMap[g.exerciseId]).filter(Boolean);
        const names   = exs.map(e=>e.name);
        const regions = [...new Set(exs.map(exerciseRegion))];
        const regionPills = regions.map(r=>`<span class="region-pill ${r}">${regionLabel(r)}</span>`).join('');
        return `
          <div class="history-card" data-action="open-history-detail" data-id="${w.id}">
            <div class="history-card-top">
              <div>
                <div class="history-card-date">${formatDate(parseLocalDate(w.date))}</div>
                <div class="history-card-duration">${workoutDuration(w)}</div>
              </div>
              <div class="history-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
            ${regionPills ? `<div class="region-pills">${regionPills}</div>` : ''}
            <div class="history-card-exercises">${escHtml(names.join(', '))||'No exercises'}</div>
            <div class="history-card-stats">
              <div class="history-stat"><strong>${groups.length}</strong> exercises</div>
              <div class="history-stat"><strong>${sets.length}</strong> sets</div>
            </div>
          </div>`;
      }).join('');

  return `
    <div class="screen">
      <div class="page-header">
        <div class="header-left">
          <h1>History</h1>
          <div class="header-sub">${workouts.length} workout${workouts.length!==1?'s':''} logged</div>
        </div>
        <div class="header-right"><button class="btn-small" data-action="open-export" data-from="/history">Export for AI</button></div>
      </div>
      <div class="history-list">${cards}</div>
    </div>`;
}

/* ── History Detail ───────────────────────────────────────────── */
function renderHistoryDetail(workoutId) {
  const workout = DB.getWorkout(workoutId);
  if (!workout) { Router.navigate('/history'); return '<div></div>'; }

  const groups   = groupSets(DB.getSetsForWorkout(workoutId));
  const settings = getSettings();

  const cards = groups.map(g=>{
    const ex = DB.getExercise(g.exerciseId);
    if (!ex) return '';
    const rows    = g.sets.map((s,i)=>renderDetailSetRow(s,i,ex.type,settings)).join('');
    const headers = ex.type==='strength'
      ? '<th>#</th><th>Weight</th><th>Reps</th>'
      : ex.type==='bodyweight' ? '<th>#</th><th>Reps</th>'
      : '<th>#</th><th>Time</th><th>Distance</th><th>Cal</th><th>Gain</th>';
    const muscles = musclesText(ex);
    return `
      <div class="detail-exercise">
        <div class="detail-exercise-name">
          <span class="exercise-dot ${ex.type}"></span>
          ${escHtml(ex.name)}
          ${muscles ? `<span style="font-size:12px;color:var(--fg3);font-weight:400;margin-left:4px">${muscles}</span>` : ''}
          <span class="exercise-card-badge badge-${ex.type}" style="margin-left:auto">${categoryLabel(ex.type)}</span>
        </div>
        <table class="detail-sets-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  }).join('');

  return `
    <div class="screen">
      <div class="page-header">
        <div class="header-left">
          <h1>${formatDate(parseLocalDate(workout.date))}</h1>
          <div class="header-sub">${workoutDuration(workout)} · ${groups.length} exercise${groups.length!==1?'s':''}</div>
        </div>
        <div class="header-right">
          <button class="btn-ghost" data-action="back-history">Back</button>
        </div>
      </div>
      <div class="scroll-content">
        ${cards}
        <button class="btn btn-danger" data-action="delete-workout" data-id="${workoutId}" style="margin-top:8px">Delete Workout</button>
      </div>
    </div>`;
}

function renderDetailSetRow(set, idx, type, settings) {
  const or = (v, suffix='') => v==='' || v==null ? '—' : `${v}${suffix}`;
  if (type==='strength') {
    return `<tr><td>${idx+1}</td><td>${or(weightDisplay(set.weight_kg, settings), ' '+settings.weightUnit)}</td><td>${or(set.reps)}</td></tr>`;
  }
  if (type==='bodyweight') return `<tr><td>${idx+1}</td><td>${or(set.reps, ' reps')}</td></tr>`;
  const dur = set.duration_s ? formatDurationInput(set.duration_s) : '—';
  return `<tr><td>${idx+1}</td><td>${dur}</td><td>${or(distanceDisplay(set.distance_m, settings), ' '+settings.distanceUnit)}</td><td>${or(set.calories, ' cal')}</td><td>${or(set.elevation_gain_m, ' m')}</td></tr>`;
}

/* ── Library ──────────────────────────────────────────────────── */
function renderLibrary() {
  const exercises = DB.getExercises().slice().sort((a, b) => a.name.localeCompare(b.name));
  const regionOrder = ['upper','lower','core','full'];
  const trashSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;

  const sections = regionOrder.map(region=>{
    const regionExs = exercises.filter(e=>exerciseRegion(e)===region);
    if (regionExs.length===0) return '';

    const grouped = {};
    regionExs.forEach(e=>{
      const g = exerciseGroup(e);
      if (!grouped[g]) grouped[g]=[];
      grouped[g].push(e);
    });

    const regionInfo = BODY_REGIONS.find(r=>r.id===region);
    const muscleBlocks = Object.entries(grouped).map(([group, exs])=>`
      <div class="library-muscle-group">
        <div class="library-muscle-label">${escHtml(group)}</div>
        <div class="library-card">
          ${exs.map(e=>{
            const muscles = exerciseMuscles(e);
            const musclesStr = musclesText(e);
            return `
            <div class="library-item">
              <span class="exercise-dot ${e.type}"></span>
              <div class="library-item-info">
                <div class="library-item-name">${escHtml(e.name)}</div>
                ${muscles.length>1 ? `<div class="library-item-sub">${musclesStr}</div>` : ''}
              </div>
              <button class="btn-icon" data-action="delete-exercise" data-exid="${e.id}" aria-label="Delete">${trashSvg}</button>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');

    return `
      <div class="library-region-section region-${region}">
        <div class="library-region-header">
          <div class="library-region-icon">${regionInfo?.icon||''}</div>
          <div class="library-region-title">${regionLabel(region)}</div>
        </div>
        ${muscleBlocks}
      </div>`;
  }).join('');

  return `
    <div class="screen">
      <div class="page-header">
        <div class="header-left">
          <h1>Library</h1>
          <div class="header-sub">${exercises.length} exercises</div>
        </div>
      </div>
      <div class="library-list">${sections}</div>
      <button class="fab" data-action="library-add-custom" aria-label="Add exercise">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>`;
}

/* ── Progress ─────────────────────────────────────────────────── */
const allData = () => ({
  workouts:DB.getWorkouts(), sets:DB.getSets(), exercises:DB.getExercises(), bodyWeightLogs:DB.getBodyWeightLogs(),
});
const heatFill = intensity => slug => slug in intensity ? heatColor(intensity[slug]) : NON_MUSCLE_FILL;

// Weigh-ins feed the bodyweight-exercise volume, so recolour the map in place.
function refreshHeatmapFills() {
  const fill = heatFill(muscleHeat(allData()).intensity);
  document.querySelectorAll('#heatmap-carousel path').forEach(p => p.setAttribute('fill', fill(p.dataset.slug)));
}

function renderProgress() {
  const { intensity, max } = muscleHeat(allData());
  const fill  = heatFill(intensity);
  const slide = (view, label) => `
    <div class="heatmap-slide">
      ${renderBodySVG(view, fill, { label:`Muscle heat map, ${label.toLowerCase()}` })}
      <div class="heatmap-slide-label">${label}</div>
    </div>`;
  const legend = `${HEAT_ZERO} 0 10%, ${HEAT_STOPS[0]} 10%, ${HEAT_STOPS[1]} 40%, ${HEAT_STOPS[2]} 70%, ${HEAT_STOPS[3]} 100%`;

  return `
    <div class="screen">
      <div class="page-header">
        <div class="header-left"><h1>Progress</h1></div>
        <div class="header-right"><button class="btn-small" data-action="open-export" data-from="/progress">Export for AI</button></div>
      </div>
      <div class="scroll-content">
        <section class="heatmap-card">
          <div class="heatmap-head">
            <h2>Heat map trends</h2>
            <span>Last ${WINDOW_DAYS} days</span>
          </div>
          <div class="heatmap-carousel" id="heatmap-carousel">
            ${slide('front', 'Front')}${slide('back', 'Back')}
          </div>
          <div class="carousel-dots">
            <button class="carousel-dot active" data-action="heatmap-dot" data-index="0" aria-label="Show front"></button>
            <button class="carousel-dot" data-action="heatmap-dot" data-index="1" aria-label="Show back"></button>
          </div>
          <div class="heat-legend">
            <span>Less</span><div class="heat-legend-bar" style="background:linear-gradient(to right, ${legend})"></div><span>More</span>
          </div>
          ${max > 0 ? '' : `<p class="heatmap-empty">Log some weighted or bodyweight sets to see which muscles you've trained.</p>`}
        </section>
        ${renderWeightCard()}
      </div>
    </div>`;
}

function initHeatmapCarousel() {
  const el = document.getElementById('heatmap-carousel');
  if (!el) return;
  el.addEventListener('scroll', () => {
    const i = Math.round(el.scrollLeft / el.clientWidth);
    document.querySelectorAll('.carousel-dot').forEach((d, k) => d.classList.toggle('active', k === i));
  }, { passive:true });
}

/* ── Body weight ──────────────────────────────────────────────── */
const WEIGHT_RANGES = [['30','30D'], ['90','90D'], ['365','1Y'], ['all','All']];
let weightState = { range:'90', editId:null, showAll:false };

const shortDate = ymd => parseLocalDate(ymd).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
const weightsNewestFirst = () => DB.getBodyWeightLogs().slice().sort((a, b) => b.date.localeCompare(a.date));

// Weigh-ins inside the selected range, oldest first, plus the x-domain start.
function weightSeries() {
  const asc = weightsNewestFirst().reverse();
  if (weightState.range === 'all') return { points:asc, from:asc[0]?.date || localDate() };
  const start = new Date(); start.setDate(start.getDate() - (Number(weightState.range) - 1));
  const from = localDate(start);
  return { points:asc.filter(l => l.date >= from), from };
}

function renderWeightCard() {
  const settings = getSettings();
  const unit     = settings.weightUnit;
  const logs     = weightsNewestFirst();
  const editing  = weightState.editId ? logs.find(l => l.id === weightState.editId) : null;
  const today    = localDate();
  const formDate = editing?.date || today;
  const existing = editing || logs.find(l => l.date === formDate);
  const { points } = weightSeries();

  let change = '';
  if (points.length >= 2) {
    const diff = Number(weightDisplay(points[points.length-1].kg, settings)) - Number(weightDisplay(points[0].kg, settings));
    const amount = `${Math.abs(Math.round(diff * 10) / 10)} ${unit}`;
    change = diff === 0 ? `No change since ${shortDate(points[0].date)}`
      : `${diff < 0 ? 'Down' : 'Up'} ${amount} since ${shortDate(points[0].date)}`;
  }

  const pencil = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
  const trash  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
  const shown  = weightState.showAll ? logs : logs.slice(0, 10);
  const rows = shown.map(l => `
    <div class="weight-row ${l.id===weightState.editId?'editing':''}">
      <span class="weight-row-date">${formatDate(parseLocalDate(l.date))}</span>
      <span class="weight-row-val">${weightDisplay(l.kg, settings)} ${unit}</span>
      <button class="btn-icon" data-action="weight-edit" data-id="${l.id}" aria-label="Edit weigh-in on ${l.date}">${pencil}</button>
      <button class="btn-icon" data-action="weight-delete" data-id="${l.id}" aria-label="Delete weigh-in on ${l.date}">${trash}</button>
    </div>`).join('');

  return `
    <section class="heatmap-card weight-card" id="weight-card">
      <div class="heatmap-head">
        <h2>Body weight</h2>
        <span>${logs.length ? `Latest ${weightDisplay(logs[0].kg, settings)} ${unit}` : ''}</span>
      </div>
      ${change ? `<div class="weight-change">${change}</div>` : ''}
      <div class="weight-ranges">${WEIGHT_RANGES.map(([id, label]) =>
        `<button class="weight-range ${weightState.range===id?'active':''}" data-action="weight-range" data-range="${id}">${label}</button>`).join('')}
      </div>
      <div class="weight-chart" id="weight-chart"></div>

      <div class="weight-form">
        <input class="text-input" id="weight-date" type="date" value="${formDate}" max="${today}" data-action="weight-date" aria-label="Date">
        <input class="text-input" id="weight-value" type="number" inputmode="decimal" step="0.1" min="0" placeholder="${unit}"
          value="${existing ? weightDisplay(existing.kg, settings) : ''}" aria-label="Weight in ${unit}">
        <button class="btn btn-primary btn-sm" id="weight-save" data-action="weight-save">${existing ? 'Update' : 'Save'}</button>
      </div>
      ${editing ? `<button class="weight-cancel" data-action="weight-cancel">Cancel editing</button>` : ''}

      ${logs.length ? `<div class="weight-list">${rows}</div>` : ''}
      ${logs.length > 10 ? `<button class="weight-cancel" data-action="weight-show-all">${weightState.showAll ? 'Show fewer' : `Show all ${logs.length}`}</button>` : ''}
    </section>`;
}

function refreshWeightCard() {
  const card = document.getElementById('weight-card');
  if (!card) return;
  card.outerHTML = renderWeightCard();
  drawWeightChart();
  refreshHeatmapFills();
}

function saveWeight() {
  const settings = getSettings();
  const date  = document.getElementById('weight-date')?.value;
  const value = parseFloat(document.getElementById('weight-value')?.value);
  if (!date) { showToast('Pick a date.'); return; }
  if (date > localDate()) { showToast("That date is in the future."); return; }
  if (!(value > 0) || value > 1000) { showToast(`Enter your weight in ${settings.weightUnit}.`); document.getElementById('weight-value')?.focus(); return; }

  const kg = Math.round(weightToKg(value, settings) * 100) / 100;
  const sameDate = DB.getBodyWeightLogs().find(l => l.date === date);
  if (weightState.editId) {
    if (sameDate && sameDate.id !== weightState.editId) {
      showToast(`You already have a weigh-in on ${formatDate(parseLocalDate(date))}. Edit that one instead.`);
      return;
    }
    DB.saveBodyWeightLog({ id:weightState.editId, date, kg });
  } else {
    DB.saveBodyWeightLog({ id:sameDate?.id || uuid(), date, kg });   // one weigh-in per day
  }
  weightState.editId = null;
  refreshWeightCard();
  showToast(sameDate ? 'Weigh-in updated.' : 'Weigh-in saved.');
}

// Single-series line chart sized to its container; crosshair tooltip on hover/touch/keys.
function drawWeightChart() {
  const wrap = document.getElementById('weight-chart');
  if (!wrap) return;
  const settings = getSettings();
  const { points, from } = weightSeries();
  if (!points.length) {
    wrap.innerHTML = `<div class="chart-empty">${DB.getBodyWeightLogs().length ? 'No weigh-ins in this range.' : 'Log your first weigh-in below to start the chart.'}</div>`;
    return;
  }

  const W = wrap.clientWidth || 320, H = 200;
  const m = { top:14, right:48, bottom:26, left:40 };
  const pts = points.map(p => ({ ...p, t:parseLocalDate(p.date).getTime(), v:Number(weightDisplay(p.kg, settings)) }));
  const t0 = parseLocalDate(from).getTime();
  const t1 = Math.max(parseLocalDate(localDate()).getTime(), pts[pts.length-1].t);

  // Clean y ticks around the data.
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
  const step = [0.5, 1, 2, 2.5, 5, 10, 20, 50].find(s => (hi - lo) / s <= 4) || 100;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);

  const x = t => t1 === t0 ? (m.left + W - m.right) / 2 : m.left + (t - t0) / (t1 - t0) * (W - m.left - m.right);
  const y = v => m.top + (hi - v) / (hi - lo) * (H - m.top - m.bottom);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const base = H - m.bottom;
  const last = pts[pts.length-1];
  const xLabels = [t0, t1].map((t, i) => `<text x="${x(t)}" y="${H - 6}" text-anchor="${i ? 'end' : 'start'}">${shortDate(localDate(new Date(t)))}</text>`).join('');

  wrap.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" tabindex="0" role="img"
      aria-label="Body weight, ${pts.length} weigh-ins, latest ${last.v} ${settings.weightUnit}. Use arrow keys to step through values.">
      <g class="chart-grid">${ticks.map(v => `<line x1="${m.left}" x2="${W - m.right}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
      <g class="chart-axis">${ticks.map(v => `<text x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}${xLabels}</g>
      ${pts.length > 1 ? `<path class="chart-area" d="${line}L${x(last.t)},${base}L${x(pts[0].t)},${base}Z"/>
      <path class="chart-line" d="${line}"/>` : ''}
      <circle class="chart-dot" cx="${x(last.t)}" cy="${y(last.v)}" r="4"/>
      <text class="chart-end-label" x="${x(last.t) + 8}" y="${y(last.v) + 4}">${last.v}</text>
      <line class="chart-crosshair" y1="${m.top}" y2="${base}" visibility="hidden"/>
      <circle class="chart-dot chart-hover-dot" r="4" visibility="hidden"/>
      <rect class="chart-hit" x="${m.left}" y="0" width="${Math.max(W - m.left - m.right, 1)}" height="${H}"/>
    </svg>
    <div class="chart-tooltip" hidden><strong></strong><span></span></div>`;

  const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.chart-tooltip');
  const cross = svg.querySelector('.chart-crosshair'), dot = svg.querySelector('.chart-hover-dot');
  let current = pts.length - 1;
  const show = i => {
    current = i;
    const p = pts[i], px = x(p.t), py = y(p.v);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
    tip.querySelector('strong').textContent = `${p.v} ${settings.weightUnit}`;
    tip.querySelector('span').textContent = formatDate(parseLocalDate(p.date));
    tip.hidden = false;
    const left = Math.min(Math.max(px - tip.offsetWidth / 2, 0), W - tip.offsetWidth);
    tip.style.left = `${left}px`;
    tip.style.top  = `${Math.max(py - tip.offsetHeight - 12, 0)}px`;
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  const nearest = clientX => {
    const px = clientX - svg.getBoundingClientRect().left;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(pts[best].t) - px)) best = i; });
    return best;
  };
  svg.addEventListener('pointermove', e => show(nearest(e.clientX)));
  svg.addEventListener('pointerdown', e => show(nearest(e.clientX)));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(current));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); show(Math.max(current - 1, 0)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(Math.min(current + 1, pts.length - 1)); }
  });
}

let weightChartResize = null;
window.addEventListener('resize', () => {
  clearTimeout(weightChartResize);
  weightChartResize = setTimeout(drawWeightChart, 150);
});

/* ── Export for AI ────────────────────────────────────────────── */
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
let exportState = { mode:'range', day:localDate(), from:daysAgo(6), to:localDate(), returnTo:'/history' };

function exportRange() {
  const { mode, day, from, to } = exportState;
  if (mode === 'day') return { from:day, to:day };
  if (mode === 'all') return { from:null, to:null };
  return from <= to ? { from, to } : { from:to, to:from };
}

function currentExport() { return buildExport(allData(), getSettings(), exportRange()); }

function exportSummary(counts) {
  const n = (c, w) => `${c} ${w}${c!==1?'s':''}`;
  return `${n(counts.workouts,'workout')} · ${n(counts.sets,'set')} · ${n(counts.weighIns,'weigh-in')}`;
}

function renderExport() {
  const { mode, day, from, to } = exportState;
  const today = localDate();
  const { text, counts } = currentExport();
  const dateInput = (id, value, label) =>
    `<label class="export-date"><span>${label}</span><input class="text-input" type="date" id="${id}" value="${value}" max="${today}" data-action="export-date"></label>`;

  return `
    <div class="screen">
      <div class="page-header">
        <div class="header-left">
          <h1>Export</h1>
          <div class="header-sub">Plain text to paste into an AI chat</div>
        </div>
        <div class="header-right"><button class="btn-ghost" data-action="export-back">Back</button></div>
      </div>
      <div class="scroll-content">
        <div class="segment-control">
          ${[['day','Single day'], ['range','Date range'], ['all','All data']].map(([id, label]) =>
            `<button class="seg-btn ${mode===id?'active':''}" data-action="export-mode" data-mode="${id}">${label}</button>`).join('')}
        </div>
        ${mode === 'day'   ? `<div class="export-dates">${dateInput('export-day', day, 'Date')}</div>` : ''}
        ${mode === 'range' ? `<div class="export-dates">${dateInput('export-from', from, 'From')}${dateInput('export-to', to, 'To')}</div>` : ''}

        <div class="export-summary" id="export-summary">${exportSummary(counts)}</div>
        <textarea class="export-output" id="export-output" readonly spellcheck="false" aria-label="Export text">${escHtml(text)}</textarea>

        <div class="export-actions">
          <button class="btn btn-primary" data-action="export-copy">Copy to Clipboard</button>
          <div class="export-actions-row">
            <button class="btn btn-secondary" data-action="export-share" ${navigator.share ? '' : 'disabled title="Sharing isn\'t supported in this browser"'}>Share</button>
            <button class="btn btn-secondary" data-action="export-download">Download .txt</button>
          </div>
        </div>
      </div>
    </div>`;
}

function updateExportOutput() {
  const { text, counts } = currentExport();
  const out = document.getElementById('export-output');
  if (out) out.value = text;
  const sum = document.getElementById('export-summary');
  if (sum) sum.textContent = exportSummary(counts);
}

function exportFileName() {
  const r = exportRange();
  if (!r.from) return `gym-log-all-${localDate()}.txt`;
  return r.from === r.to ? `gym-log-${r.from}.txt` : `gym-log-${r.from}_to_${r.to}.txt`;
}

async function copyExport() {
  const text = currentExport().text;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard API needs https/localhost; fall back to selecting the textarea.
    const out = document.getElementById('export-output');
    out.focus(); out.select();
    if (!document.execCommand('copy')) { showToast('Copy failed — select the text and copy it manually.'); return; }
  }
  showToast('Copied — paste it into your AI chat.');
}

async function shareExport() {
  try {
    await navigator.share({ title:'Gym Tracker log', text:currentExport().text });
  } catch (err) {
    if (err?.name !== 'AbortError') showToast('Share failed: ' + err.message);
  }
}

function downloadExport() {
  const blob = new Blob([currentExport().text], { type:'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = exportFileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Settings ─────────────────────────────────────────────────── */
function syncStatusText() {
  const n = DB.pendingCount();
  if (n === 0) return navigator.onLine ? 'All synced' : 'Offline';
  return `${n} pending${navigator.onLine ? '' : ' · offline'}`;
}

function renderSettings() {
  const settings = getSettings();
  const showLocalImport = legacyLocal && !legacyImportDone();

  return `
    <div class="screen">
      <div class="page-header"><div class="header-left"><h1>Settings</h1></div></div>
      <div class="scroll-content">

        <div class="settings-section">
          <div class="settings-label">Profile</div>
          <div class="settings-card">
            <div class="settings-row">
              <span class="settings-row-label">Name</span>
              <input class="settings-name-input" id="settings-name" type="text" value="${escHtml(userName())}" placeholder="Your name" maxlength="40" data-action="settings-name-change">
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-label">Account</div>
          <div class="settings-card">
            <div class="settings-row">
              <span class="settings-row-label">Email</span>
              <span class="settings-row-value">${escHtml(currentUser()?.email || '')}</span>
            </div>
            <div class="settings-row">
              <span class="settings-row-label">Sync</span>
              <span class="settings-row-value" id="sync-status">${syncStatusText()}</span>
            </div>
            <div class="settings-row">
              <span class="settings-row-label">Sign out of this device</span>
              <button class="btn-small" data-action="sign-out">Sign Out</button>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-label">Units</div>
          <div class="settings-card">
            <div class="settings-row">
              <span class="settings-row-label">Weight</span>
              <div class="segment-control" style="width:140px">
                <button class="seg-btn ${settings.weightUnit==='kg'?'active':''}" data-action="set-weight-unit" data-unit="kg">kg</button>
                <button class="seg-btn ${settings.weightUnit==='lbs'?'active':''}" data-action="set-weight-unit" data-unit="lbs">lbs</button>
              </div>
            </div>
            <div class="settings-row">
              <span class="settings-row-label">Distance</span>
              <div class="segment-control" style="width:140px">
                <button class="seg-btn ${settings.distanceUnit==='km'?'active':''}" data-action="set-distance-unit" data-unit="km">km</button>
                <button class="seg-btn ${settings.distanceUnit==='mi'?'active':''}" data-action="set-distance-unit" data-unit="mi">mi</button>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-label">Data</div>
          <div class="settings-card">
            <div class="settings-row">
              <span class="settings-row-label">Total workouts</span>
              <span class="settings-row-value">${DB.getWorkouts().filter(w=>w.finished_at).length}</span>
            </div>
            ${showLocalImport ? `
            <div class="settings-row">
              <span class="settings-row-label">Old data on this device</span>
              <button class="btn-small" data-action="import-local">Import</button>
            </div>` : ''}
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-label">Backup &amp; Restore</div>
          <div class="settings-card">
            <div class="settings-row">
              <span class="settings-row-label">Download all data</span>
              <button class="btn-small" data-action="backup-data">Backup</button>
            </div>
            <div class="settings-row">
              <span class="settings-row-label">Restore or import a backup file</span>
              <button class="btn-small" data-action="restore-data">Choose File</button>
            </div>
            <div class="settings-row">
              <span class="settings-row-label">Export for AI (copy &amp; paste)</span>
              <button class="btn-small" data-action="open-export" data-from="/settings">Export</button>
            </div>
          </div>
        </div>

        <button class="btn btn-danger" data-action="clear-all-data" style="margin-top:4px">Clear All Data</button>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   MODAL HELPERS
═══════════════════════════════════════════════════════════════ */
function showAddExerciseModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-ex-modal';
  overlay.innerHTML = `
    <div class="bottom-sheet">
      <div class="sheet-handle"></div>
      <div class="sheet-title">New Exercise</div>
      <input class="text-input" id="modal-ex-name" type="text" placeholder="Exercise name" autocorrect="off" maxlength="60">
      <div>
        <div class="settings-label" style="margin-bottom:8px">Type</div>
        <div class="segment-control">
          ${['strength','bodyweight','cardio'].map((c,i)=>
            `<button class="seg-btn ${i===0?'active':''}" data-action="modal-cat" data-cat="${c}">${categoryLabel(c)}</button>`
          ).join('')}
        </div>
      </div>
      <div>
        ${renderMuscleChoice('modal-muscle')}
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-secondary" data-action="modal-cancel">Cancel</button>
        <button class="btn btn-primary" data-action="modal-save-exercise">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('visible'));
  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal('add-ex-modal'); });
}

function showConfirm(title, message, onConfirm, { confirmLabel = title, cancelLabel = 'Cancel', danger = true, onCancel } = {}) {
  const el = document.createElement('div');
  el.className = 'confirm-dialog';
  el.id = 'confirm-dialog';
  el.innerHTML = `
    <div class="confirm-box">
      <h3>${escHtml(title)}</h3>
      <p>${escHtml(message)}</p>
      <div class="confirm-actions">
        <button class="btn ${danger?'btn-danger':'btn-primary'}" id="confirm-yes">${escHtml(confirmLabel)}</button>
        <button class="btn btn-secondary" id="confirm-no">${escHtml(cancelLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#confirm-yes').addEventListener('click', ()=>{ el.remove(); onConfirm(); });
  el.querySelector('#confirm-no').addEventListener('click', ()=>{ el.remove(); onCancel?.(); });
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('visible');
  setTimeout(()=>el.remove(), 250);
}

function showToast(message, ms = 3500) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(()=>el.classList.remove('visible'), ms);
}

/* ═══════════════════════════════════════════════════════════════
   EVENT DELEGATION
═══════════════════════════════════════════════════════════════ */
document.addEventListener('click',  handleClick);
document.addEventListener('input',  handleInput);
document.addEventListener('change', e=>{ if (e.target.type==='date') handleInput(e); });
document.addEventListener('submit', e=>{
  if (e.target.id==='login-form') { e.preventDefault(); submitLogin(); }
});
document.addEventListener('keydown', e=>{
  if (e.key==='Enter' && document.activeElement?.id==='onboarding-name')
    document.querySelector('[data-action="onboarding-submit"]')?.click();
});

function handleClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  /* ── Onboarding ── */
  if (action==='onboarding-submit') {
    const name = document.getElementById('onboarding-name')?.value.trim();
    if (!name) { document.getElementById('onboarding-name')?.focus(); return; }
    btn.disabled = true;
    saveName(name).then(()=>Router.navigate('/home'));
    return;
  }

  /* ── Tab nav ── */
  if (action==='nav-tab') {
    const tab = btn.dataset.tab;
    if (tab === 'workout') Router.navigate(DB.getActiveWorkout() ? '/workout/active' : '/workout/new');
    else Router.navigate(`/${tab}`);
    return;
  }

  /* ── Home ── */
  if (action==='start-workout') {
    const active = DB.getActiveWorkout();
    if (active) {
      showConfirm('Discard', 'A workout is already in progress. Discard it?', ()=>{
        DB.deleteWorkout(active.id); createAndStartWorkout();
      });
    } else createAndStartWorkout();
    return;
  }
  if (action==='resume-workout') { Router.navigate('/workout/active'); return; }

  /* ── Progress: body weight ── */
  if (action==='weight-save')     { saveWeight(); return; }
  if (action==='weight-cancel')   { weightState.editId = null; refreshWeightCard(); return; }
  if (action==='weight-show-all') { weightState.showAll = !weightState.showAll; refreshWeightCard(); return; }
  if (action==='weight-range')    { weightState.range = btn.dataset.range; refreshWeightCard(); return; }
  if (action==='weight-edit') {
    weightState.editId = btn.dataset.id;
    refreshWeightCard();
    document.getElementById('weight-value')?.focus();
    return;
  }
  if (action==='weight-delete') {
    const log = DB.getBodyWeightLogs().find(l => l.id === btn.dataset.id);
    if (!log) return;
    const s = getSettings();
    showConfirm('Delete Weigh-in', `Remove ${weightDisplay(log.kg, s)} ${s.weightUnit} on ${formatDate(parseLocalDate(log.date))}?`, ()=>{
      DB.deleteBodyWeightLog(log.id);
      if (weightState.editId === log.id) weightState.editId = null;
      refreshWeightCard();
    }, { confirmLabel:'Delete' });
    return;
  }

  /* ── Export ── */
  if (action==='open-export')     { exportState.returnTo = btn.dataset.from || '/history'; Router.navigate('/export'); return; }
  if (action==='export-back')     { Router.navigate(exportState.returnTo); return; }
  if (action==='export-mode')     { exportState.mode = btn.dataset.mode; Router.route(); return; }
  if (action==='export-copy')     { copyExport(); return; }
  if (action==='export-share')    { shareExport(); return; }
  if (action==='export-download') { downloadExport(); return; }

  /* ── Progress ── */
  if (action==='heatmap-dot') {
    const el = document.getElementById('heatmap-carousel');
    el?.scrollTo({ left: Number(btn.dataset.index) * el.clientWidth, behavior:'smooth' });
    return;
  }
  if (action==='open-history-detail') { Router.navigate(`/history/${btn.dataset.id}`); return; }

  /* ── Target Muscle Selector ── */
  if (action==='open-target') {
    pickerState._savedMuscles = [...pickerState.selectedMuscles];
    Router.navigate('/target');
    return;
  }

  if (action==='target-done') {
    delete pickerState._savedMuscles;
    Router.navigate('/workout/new');
    return;
  }

  if (action==='target-cancel') {
    pickerState.selectedMuscles = [...(pickerState._savedMuscles || [])];
    delete pickerState._savedMuscles;
    Router.navigate('/workout/new');
    return;
  }

  if (action==='toggle-muscle') {
    const muscle = btn.dataset.muscle;
    const idx = pickerState.selectedMuscles.indexOf(muscle);
    if (idx >= 0) pickerState.selectedMuscles.splice(idx, 1);
    else pickerState.selectedMuscles.push(muscle);
    updateMuscleHighlights();
    const doneBtn = document.querySelector('[data-action="target-done"]');
    if (doneBtn) {
      const n = pickerState.selectedMuscles.length;
      doneBtn.textContent = `Done${n>0?` (${n})`:''}`;
    }
    return;
  }

  if (action==='muscle-pill') {
    const muscle = btn.dataset.muscle;
    const idx = pickerState.selectedMuscles.indexOf(muscle);
    if (idx >= 0) pickerState.selectedMuscles.splice(idx, 1);
    else pickerState.selectedMuscles.push(muscle);
    updateMuscleHighlights();
    const doneBtn = document.querySelector('[data-action="target-done"]');
    if (doneBtn) {
      const n = pickerState.selectedMuscles.length;
      doneBtn.textContent = `Done${n>0?` (${n})`:''}`;
    }
    const clearBtn = document.querySelector('[data-action="muscle-clear"]');
    if (pickerState.selectedMuscles.length > 0 && !clearBtn) {
      document.querySelector('.target-screen')?.insertAdjacentHTML('beforeend',
        `<button class="muscle-clear-btn" data-action="muscle-clear">Clear selection</button>`);
    } else if (pickerState.selectedMuscles.length === 0 && clearBtn) {
      clearBtn.remove();
    }
    return;
  }

  if (action==='muscle-all') {
    pickerState.selectedMuscles = [];
    updateMuscleHighlights();
    document.querySelector('[data-action="target-done"]').textContent = 'Done';
    document.querySelector('[data-action="muscle-clear"]')?.remove();
    return;
  }

  if (action==='muscle-clear') {
    pickerState.selectedMuscles = [];
    updateMuscleHighlights();
    document.querySelector('[data-action="target-done"]').textContent = 'Done';
    btn.remove();
    return;
  }

  if (action==='body-view-toggle') {
    pickerState.bodyView = btn.dataset.view;
    document.querySelectorAll('[data-action="body-view-toggle"]').forEach(b =>
      b.classList.toggle('active', b.dataset.view === pickerState.bodyView));
    const svgWrap = document.getElementById('body-svg-container');
    if (svgWrap) svgWrap.innerHTML = renderTargetBody(pickerState.bodyView);
    return;
  }

  /* ── Picker ── */
  if (action==='picker-close') { Router.navigate(DB.getActiveWorkout()?'/workout/active':'/home'); return; }

  if (action==='picker-region') {
    pickerState.bodyRegion = btn.dataset.region;
    document.querySelectorAll('.region-tab').forEach(b=>b.classList.toggle('active', b.dataset.region===pickerState.bodyRegion));
    rebuildExerciseList();
    return;
  }

  if (action==='picker-cat') {
    pickerState.category = btn.dataset.cat;
    document.querySelectorAll('.cat-tab').forEach(b=>b.classList.toggle('active', b.dataset.cat===pickerState.category));
    rebuildExerciseList();
    return;
  }

  if (action==='picker-add') {
    const exId = btn.dataset.exid;
    if (!DB.getActiveWorkout()) createAndStartWorkout(()=>addExerciseToWorkout(exId));
    else addExerciseToWorkout(exId);
    return;
  }

  if (action==='custom-form-show') { pickerState.showCustomForm=true; Router.route(); return; }
  if (action==='custom-cancel')    { pickerState.showCustomForm=false; Router.route(); return; }

  if (action==='custom-cat') {
    pickerState.customCat = btn.dataset.cat;
    document.querySelectorAll('[data-action="custom-cat"]').forEach(b=>b.classList.toggle('active', b.dataset.cat===pickerState.customCat));
    return;
  }

  if (action==='custom-muscle') { toggleMuscleChoice(btn); return; }

  if (action==='custom-save') {
    const nameEl = document.getElementById('custom-ex-name');
    const name   = nameEl?.value.trim();
    if (!name) { nameEl?.focus(); return; }
    DB.saveExercises([{ id:uuid(), name, type:pickerState.customCat,
      primary_muscles:chosenMuscles('custom-muscle','primary'), secondary_muscles:chosenMuscles('custom-muscle','secondary') }]);
    pickerState.showCustomForm=false; pickerState.customName='';
    Router.route();
    return;
  }

  /* ── Active workout ── */
  if (action==='add-exercise') {
    pickerState = freshPickerState();
    Router.navigate('/workout/new');
    return;
  }

  if (action==='add-set') { addSetToExercise(btn.dataset.exid); return; }
  if (action==='toggle-set') { toggleSet(btn.dataset.setid); return; }
  if (action==='remove-exercise') { removeExerciseFromWorkout(btn.dataset.exid); return; }

  if (action==='finish-workout') {
    const workout = DB.getActiveWorkout();
    if (!workout) return;
    DB.saveWorkout({ id:workout.id, finished_at:new Date().toISOString() });
    clearInterval(timerInterval);
    Router.navigate(`/history/${workout.id}`);
    return;
  }

  if (action==='discard-workout') {
    showConfirm('Discard Workout', 'This will delete the current workout. Cannot be undone.', ()=>{
      const active = DB.getActiveWorkout();
      if (active) DB.deleteWorkout(active.id);
      clearInterval(timerInterval);
      Router.navigate('/home');
    });
    return;
  }

  /* ── History ── */
  if (action==='back-history') { Router.navigate('/history'); return; }
  if (action==='delete-workout') {
    showConfirm('Delete Workout', 'Permanently delete this workout log?', ()=>{
      DB.deleteWorkout(btn.dataset.id); Router.navigate('/history');
    });
    return;
  }

  /* ── Library ── */
  if (action==='library-add-custom') { showAddExerciseModal(); return; }
  if (action==='delete-exercise') {
    const exid = btn.dataset.exid;
    const used = DB.getSets().filter(s=>s.exercise_id===exid).length;
    if (used) { showToast(`Can't delete: used in ${used} logged set${used!==1?'s':''}.`); return; }
    const tpls = DB.getTemplates().filter(t => (t.exercises||[]).some(i => i.exercise_id === exid)).length;
    const also = tpls ? ` It will also be removed from ${tpls} template${tpls!==1?'s':''}.` : '';
    showConfirm('Delete Exercise', `Remove this exercise from your library?${also}`, ()=>{
      DB.deleteExercise(exid);
      DB.removeExerciseFromTemplates(exid);
      Router.route();
    });
    return;
  }

  /* ── Modal ── */
  if (action==='modal-cancel') { closeModal('add-ex-modal'); return; }

  if (action==='modal-cat') {
    document.querySelectorAll('[data-action="modal-cat"]').forEach(b=>b.classList.toggle('active', b.dataset.cat===btn.dataset.cat));
    return;
  }

  if (action==='modal-muscle') { toggleMuscleChoice(btn); return; }

  if (action==='modal-save-exercise') {
    const nameEl   = document.getElementById('modal-ex-name');
    const name     = nameEl?.value.trim();
    if (!name) { nameEl?.focus(); return; }
    const catBtn  = document.querySelector('[data-action="modal-cat"].active');
    DB.saveExercises([{ id:uuid(), name, type:catBtn?.dataset.cat || 'strength',
      primary_muscles:chosenMuscles('modal-muscle','primary'), secondary_muscles:chosenMuscles('modal-muscle','secondary') }]);
    closeModal('add-ex-modal'); Router.route();
    return;
  }

  /* ── Settings ── */
  if (action==='set-weight-unit') {
    const s = getSettings(); s.weightUnit=btn.dataset.unit; saveSettings(s); Router.route(); return;
  }
  if (action==='set-distance-unit') {
    const s = getSettings(); s.distanceUnit=btn.dataset.unit; saveSettings(s); Router.route(); return;
  }

  if (action==='sign-out') {
    const pending = DB.pendingCount();
    if (pending) {
      showConfirm('Sign Out', `${pending} change${pending!==1?'s haven\'t':' hasn\'t'} synced yet and will be lost if you sign out now.`, signOut, { confirmLabel:'Sign Out Anyway' });
    } else signOut();
    return;
  }

  if (action==='import-local') { if (legacyLocal) importLegacy(legacyLocal); return; }

  if (action==='clear-all-data') {
    showConfirm('Clear All Data', 'Permanently delete all your workouts, exercises, templates and weigh-ins from your account?', async ()=>{
      if (!navigator.onLine) { showToast('You need to be online to clear data.'); return; }
      try {
        await DB.clearAll();
        seedPresets();
        Router.navigate('/home');
        showToast('All data cleared.');
      } catch (err) {
        showToast('Clear failed: ' + err.message);
      }
    });
    return;
  }

  if (action==='backup-data') {
    const blob = new Blob([JSON.stringify(DB.backup(), null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `gymtracker-backup-${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  if (action==='restore-data') {
    const input   = document.createElement('input');
    input.type    = 'file';
    input.accept  = '.json,application/json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); }
      catch { showToast('That file isn\'t valid JSON.'); return; }

      if (isLegacyBackup(data)) { importLegacy(data); return; }
      if (data?.version !== 2 || !Array.isArray(data.workouts)) { showToast('Not a Gym Tracker backup file.'); return; }

      showConfirm('Restore Backup', 'This replaces ALL data in your account with the backup. Continue?', async ()=>{
        if (!navigator.onLine) { showToast('You need to be online to restore.'); return; }
        try {
          const { templatesSkipped } = await DB.replaceAll(data);
          migrateMuscleSlugs();
          Router.navigate('/home');
          showToast(templatesSkipped
            ? `Backup restored, except ${templatesSkipped} template${templatesSkipped!==1?'s':''} — templates aren't set up on the server yet.`
            : 'Backup restored.', templatesSkipped ? 8000 : 3500);
        } catch (err) {
          showToast('Restore failed: ' + err.message);
        }
      }, { confirmLabel:'Replace Everything' });
    };
    input.click();
    return;
  }
}

let nameSaveTimer = null;

function handleInput(e) {
  const el = e.target;
  const action = el.dataset.action;

  if (action==='export-date') {
    if (!el.value) return;
    const key = { 'export-day':'day', 'export-from':'from', 'export-to':'to' }[el.id];
    if (key) { exportState[key] = el.value; updateExportOutput(); }
    return;
  }

  // Picking a date that already has a weigh-in turns Save into Update and shows its value.
  if (action==='weight-date' && !weightState.editId) {
    const log = DB.getBodyWeightLogs().find(l => l.date === el.value);
    const btn = document.getElementById('weight-save');
    if (btn) btn.textContent = log ? 'Update' : 'Save';
    if (log) document.getElementById('weight-value').value = weightDisplay(log.kg, getSettings());
    return;
  }

  if (action==='set-field') {
    const { setid, field } = el.dataset;
    const set = DB.getSets().find(s=>s.id===setid);
    if (!set) return;
    const settings = getSettings();
    const raw = el.value.trim();
    const n   = raw==='' ? null : parseFloat(raw);
    const val = Number.isFinite(n) ? n : null;
    let patch;
    if      (field==='duration')  { const d = parseDurationInput(raw); patch = { duration_s: Number.isFinite(d) && d > 0 ? d : null }; }
    else if (field==='weight')    patch = { weight_kg: val==null ? null : weightToKg(val, settings) };
    else if (field==='reps')      patch = { reps: val==null ? null : Math.round(val) };
    else if (field==='distance')  patch = { distance_m: val==null ? null : distanceToM(val, settings) };
    else if (field==='calories')  patch = { calories: val };
    else if (field==='elevation') patch = { elevation_gain_m: val };
    else return;
    DB.saveSets([{ id:setid, ...patch }]);
    return;
  }

  if (action==='settings-name-change') {
    const name = el.value.trim();
    if (!name) return;
    clearTimeout(nameSaveTimer);
    nameSaveTimer = setTimeout(()=>saveName(name), 800);
    return;
  }
}

/* ═══════════════════════════════════════════════════════════════
   WORKOUT OPERATIONS
═══════════════════════════════════════════════════════════════ */
function createAndStartWorkout(cb) {
  const now = new Date();
  DB.saveWorkout({ id:uuid(), date:localDate(now), notes:null, started_at:now.toISOString(), finished_at:null });
  if (cb) cb(); else Router.navigate('/workout/new');
}

const METRIC_FIELDS = ['reps','weight_kg','duration_s','distance_m','calories','elevation_gain_m'];

function makeSet(workoutId, exerciseId, copyFrom = null) {
  const position = Math.max(0, ...DB.getSetsForWorkout(workoutId).map(s=>s.position)) + 1;
  const set = { id:uuid(), workout_id:workoutId, exercise_id:exerciseId, position, completed:false };
  for (const f of METRIC_FIELDS) set[f] = copyFrom ? copyFrom[f] ?? null : null;
  return set;
}

function addExerciseToWorkout(exId) {
  const workout = DB.getActiveWorkout();
  if (!workout || !DB.getExercise(exId)) return;
  DB.saveSets([makeSet(workout.id, exId)]);
  Router.navigate('/workout/active');
}

function addSetToExercise(exId) {
  const workout = DB.getActiveWorkout();
  const ex      = DB.getExercise(exId);
  if (!workout || !ex) return;
  const existing = DB.getSetsForWorkout(workout.id).filter(s=>s.exercise_id===exId);
  const [set]    = DB.saveSets([makeSet(workout.id, exId, existing[existing.length-1])]);
  const container = document.querySelector(`.set-rows[data-exid="${exId}"]`);
  if (container) container.insertAdjacentHTML('beforeend', renderSetRow(set, existing.length, ex.type, getSettings()));
}

function toggleSet(setId) {
  const set = DB.getSets().find(s=>s.id===setId);
  if (!set) return;
  DB.saveSets([{ id:setId, completed:!set.completed }]);
  document.querySelector(`.set-row[data-setid="${setId}"]`)?.classList.toggle('completed', set.completed);
  document.querySelector(`.set-check[data-setid="${setId}"]`)?.classList.toggle('done', set.completed);
}

function removeExerciseFromWorkout(exId) {
  const workout = DB.getActiveWorkout();
  if (!workout) return;
  DB.deleteSets(DB.getSetsForWorkout(workout.id).filter(s=>s.exercise_id===exId).map(s=>s.id));
  document.querySelector(`.exercise-card[data-exid="${exId}"]`)?.remove();
}

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT + IMPORT
═══════════════════════════════════════════════════════════════ */
async function saveName(name) {
  const { data, error } = await supabase.auth.updateUser({ data:{ name } });
  if (error) { showToast('Couldn\'t save name: ' + error.message); return; }
  if (session && data?.user) session = { ...session, user:data.user };
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) showToast('Sign out failed: ' + error.message);
}

// Load the account's data into the cache, seed presets for a brand-new
// account, and look for pre-Supabase data on this device.
async function afterSignIn() {
  renderLoading();
  const { online } = await DB.load(session.user.id);
  if (online && DB.getExercises().length === 0) seedPresets();
  migrateMuscleSlugs();
  if (!online) showToast('Offline — showing data saved on this device.');
  legacyLocal = legacyImportDone() ? null : await detectLocalLegacyData();
}

function promptLegacyImport() {
  if (!legacyLocal || sessionStorage.getItem('gt_import_prompted')) return;
  sessionStorage.setItem('gt_import_prompted', '1');
  const n = legacyLocal.workouts.filter(w=>w.finishedAt).length;
  showConfirm('Import Old Data',
    `Found ${n} workout${n!==1?'s':''} saved on this device by the previous version of the app. Upload to your account?`,
    ()=>importLegacy(legacyLocal),
    { confirmLabel:'Import', cancelLabel:'Not Now', danger:false });
}

async function importLegacy(data) {
  if (!navigator.onLine) { showToast('You need to be online to import.'); return; }
  showToast('Importing…', 60000);
  try {
    const result = await runLegacyImport(data);
    if (result.name && !userName()) await saveName(result.name);
    if (result.settings && !localStorage.getItem(SETTINGS_KEY)) saveSettings({ ...getSettings(), ...result.settings });
    await DB.load(session.user.id);
    migrateMuscleSlugs();
    legacyLocal = null;
    const s = result.summary;
    const n = (count, word) => `${count} ${word}${count!==1?'s':''}`;
    const skipped = s.skippedWorkouts + s.skippedExercises;
    showToast(`Imported ${n(s.workouts,'workout')}, ${n(s.sets,'set')}, ${n(s.exercises,'new exercise')}${s.bodyWeight?`, ${n(s.bodyWeight,'weigh-in')}`:''}.`
      + (skipped ? ` Skipped ${n(skipped,'unfinished or orphaned item')}.` : ''), 8000);
    Router.route();
  } catch (err) {
    console.error(err);
    showToast('Import failed: ' + err.message + ' — try again; nothing will be duplicated.', 8000);
  }
}

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
export async function init() {
  if (!supabaseConfigured) { renderConfigMissing(); return; }

  const refreshSyncStatus = () => {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = syncStatusText();
  };
  DB.onError(msg => showToast(msg, 6000));
  DB.onChange(refreshSyncStatus);
  window.addEventListener('online',  refreshSyncStatus);
  window.addEventListener('offline', refreshSyncStatus);

  // getSession reads the persisted session from storage, so it works offline.
  const { data } = await supabase.auth.getSession();
  session = data.session;

  // Keep this callback synchronous (supabase-js warns against awaiting
  // other auth calls inside it); defer any async work.
  supabase.auth.onAuthStateChange((event, s) => {
    session = s;
    if (event === 'SIGNED_OUT') {
      setTimeout(async () => {
        await DB.reset();
        legacyLocal = null;
        clearInterval(timerInterval);
        Router.navigate('/login');
      }, 0);
    }
  });

  if (session) {
    await afterSignIn();
    if (!userName()) window.location.hash = '/onboarding';
    else if (!window.location.hash || window.location.hash==='#' || window.location.hash==='#/login') window.location.hash = '/home';
  } else {
    window.location.hash = '/login';
  }

  Router.init();
  if (session) promptLegacyImport();
}
