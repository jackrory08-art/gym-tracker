/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */

const PRESET_EXERCISES = [
  // Strength – Upper
  { id:'pre_bench', name:'Bench Press',     category:'strength',   bodyRegion:'upper', muscleGroup:'Chest',     muscles:['Chest','Triceps','Shoulders'], isPreset:true },
  { id:'pre_ohp',   name:'Overhead Press',  category:'strength',   bodyRegion:'upper', muscleGroup:'Shoulders', muscles:['Shoulders','Triceps'],         isPreset:true },
  { id:'pre_row',   name:'Barbell Row',     category:'strength',   bodyRegion:'upper', muscleGroup:'Back',      muscles:['Back','Biceps'],               isPreset:true },
  { id:'pre_curl',  name:'Bicep Curl',      category:'strength',   bodyRegion:'upper', muscleGroup:'Arms',      muscles:['Biceps'],                      isPreset:true },
  // Strength – Lower
  { id:'pre_squat', name:'Squat',           category:'strength',   bodyRegion:'lower', muscleGroup:'Quads',     muscles:['Quads','Glutes','Hamstrings'], isPreset:true },
  { id:'pre_dead',  name:'Deadlift',        category:'strength',   bodyRegion:'full',  muscleGroup:'Back',      muscles:['Back','Glutes','Hamstrings','Quads'], isPreset:true },
  { id:'pre_rdl',   name:'Romanian DL',     category:'strength',   bodyRegion:'lower', muscleGroup:'Hamstrings',muscles:['Hamstrings','Glutes','Back'],  isPreset:true },
  { id:'pre_lgpress',name:'Leg Press',      category:'strength',   bodyRegion:'lower', muscleGroup:'Quads',     muscles:['Quads','Glutes'],              isPreset:true },
  // Bodyweight – Upper
  { id:'pre_pushup',name:'Push-up',         category:'bodyweight', bodyRegion:'upper', muscleGroup:'Chest',     muscles:['Chest','Triceps','Shoulders'], isPreset:true },
  { id:'pre_pullup',name:'Pull-up',         category:'bodyweight', bodyRegion:'upper', muscleGroup:'Back',      muscles:['Back','Biceps'],               isPreset:true },
  { id:'pre_dip',   name:'Dip',             category:'bodyweight', bodyRegion:'upper', muscleGroup:'Triceps',   muscles:['Triceps','Chest'],             isPreset:true },
  { id:'pre_pike',  name:'Pike Push-up',    category:'bodyweight', bodyRegion:'upper', muscleGroup:'Shoulders', muscles:['Shoulders','Triceps'],         isPreset:true },
  // Bodyweight – Lower
  { id:'pre_bwsq',  name:'Bodyweight Squat',category:'bodyweight', bodyRegion:'lower', muscleGroup:'Quads',     muscles:['Quads','Glutes'],              isPreset:true },
  { id:'pre_lunge', name:'Lunge',           category:'bodyweight', bodyRegion:'lower', muscleGroup:'Quads',     muscles:['Quads','Glutes','Hamstrings'], isPreset:true },
  // Bodyweight – Core
  { id:'pre_plank', name:'Plank',           category:'bodyweight', bodyRegion:'core',  muscleGroup:'Core',      muscles:['Core','Shoulders'],            isPreset:true },
  { id:'pre_situp', name:'Sit-up',          category:'bodyweight', bodyRegion:'core',  muscleGroup:'Core',      muscles:['Core'],                        isPreset:true },
  { id:'pre_lgrise',name:'Leg Raise',       category:'bodyweight', bodyRegion:'core',  muscleGroup:'Core',      muscles:['Core','Hip Flexors'],          isPreset:true },
  // Cardio
  { id:'pre_run',       name:'Running',  category:'cardio', subtype:'treadmill', bodyRegion:'lower', muscleGroup:'Cardio', muscles:['Quads','Calves','Cardio'], isPreset:true },
  { id:'pre_treadmill', name:'Treadmill', category:'cardio', subtype:'treadmill', bodyRegion:'lower', muscleGroup:'Cardio', muscles:['Quads','Calves','Cardio'], isPreset:true },
  { id:'pre_cycle', name:'Cycling',         category:'cardio',     bodyRegion:'lower', muscleGroup:'Cardio',    muscles:['Quads','Cardio'],              isPreset:true },
  { id:'pre_row2',  name:'Rowing',          category:'cardio',     bodyRegion:'full',  muscleGroup:'Cardio',    muscles:['Back','Legs','Cardio'],        isPreset:true },
  { id:'pre_jump',  name:'Jump Rope',       category:'cardio',     bodyRegion:'full',  muscleGroup:'Cardio',    muscles:['Calves','Cardio'],             isPreset:true },
];

const BODY_REGIONS = [
  { id:'all',   label:'All',        icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6m-4 4 4-4 4 4M8 21v-3a4 4 0 0 1 8 0v3"/></svg>` },
  { id:'upper', label:'Upper Body', icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="4" r="2"/><path d="M8 8h8M8 8c-2 1-3 3-2 5l1 4h6l1-4c1-2 0-4-2-5M6 10l-2 4M18 10l2 4"/></svg>` },
  { id:'lower', label:'Lower Body', icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 4h6v8H9zM9 12l-2 9M15 12l2 9M9 16h6"/></svg>` },
  { id:'core',  label:'Core',       icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="12" rx="6" ry="9"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="6" y1="12" x2="18" y2="12"/></svg>` },
  { id:'full',  label:'Full Body',  icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="4" r="2"/><path d="M12 6v7M9 21v-5l-2-4 3-2M15 21v-5l2-4-3-2M9 10h6"/></svg>` },
];

const MUSCLE_GROUPS = [
  'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Back',
  'Core', 'Quads', 'Glutes', 'Hamstrings', 'Calves'
];

/* ═══════════════════════════════════════════════════════════════
   DATABASE  (Dexie / IndexedDB — sync-cache pattern)
   Reads return from in-memory _cache synchronously.
   Writes update _cache then fire an async Dexie write.
═══════════════════════════════════════════════════════════════ */
const dexieDB = new Dexie('GymTrackerDB');
dexieDB.version(1).stores({
  kv:               '&key',
  exercises:        '&id, category',
  workouts:         '&id, startedAt',
  workoutExercises: '&id, workoutId',
  bodyWeightLogs:   '++id, &date',
});

const _cache = {
  user:             null,
  settings:         { weightUnit:'kg', distanceUnit:'km' },
  exercises:        [],
  workouts:         [],
  workoutExercises: [],
  activeWorkoutId:  null,
  bodyWeightLogs:   [],
};

const DB = {
  async init() {
    await dexieDB.open();

    // One-time migration from localStorage → Dexie
    if (localStorage.getItem('gym_tracker__exercises') || localStorage.getItem('gym_tracker__user')) {
      await DB._migrateFromLocalStorage();
    }

    // Load all tables into in-memory caches
    const [userKv, settingsKv, activeKv] = await Promise.all([
      dexieDB.kv.get('user'),
      dexieDB.kv.get('settings'),
      dexieDB.kv.get('activeWorkout'),
    ]);
    _cache.user            = userKv?.value   ?? null;
    _cache.settings        = settingsKv?.value ?? { weightUnit:'kg', distanceUnit:'km' };
    _cache.activeWorkoutId = activeKv?.value  ?? null;

    const [exs, wos, wes, bwls] = await Promise.all([
      dexieDB.exercises.toArray(),
      dexieDB.workouts.toArray(),
      dexieDB.workoutExercises.toArray(),
      dexieDB.bodyWeightLogs.toArray(),
    ]);
    _cache.exercises        = exs;
    _cache.workouts         = wos;
    _cache.workoutExercises = wes;
    _cache.bodyWeightLogs   = bwls;

    if (navigator.storage?.persist) navigator.storage.persist();
  },

  async _migrateFromLocalStorage() {
    const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    const user      = lsGet('gym_tracker__user');
    const settings  = lsGet('gym_tracker__settings');
    const exercises = lsGet('gym_tracker__exercises') || [];
    const workouts  = lsGet('gym_tracker__workouts')  || [];
    const wes       = lsGet('gym_tracker__workout_exercises') || [];
    const activeId  = lsGet('gym_tracker__active_workout');
    await dexieDB.transaction('rw', dexieDB.kv, dexieDB.exercises, dexieDB.workouts, dexieDB.workoutExercises, async () => {
      if (user)             await dexieDB.kv.put({ key:'user',          value:user });
      if (settings)         await dexieDB.kv.put({ key:'settings',      value:settings });
      if (activeId)         await dexieDB.kv.put({ key:'activeWorkout', value:activeId });
      if (exercises.length) await dexieDB.exercises.bulkPut(exercises);
      if (workouts.length)  await dexieDB.workouts.bulkPut(workouts);
      if (wes.length)       await dexieDB.workoutExercises.bulkPut(wes);
    });
    localStorage.clear();
  },

  async clearAll() {
    await dexieDB.transaction('rw', dexieDB.kv, dexieDB.exercises, dexieDB.workouts, dexieDB.workoutExercises, dexieDB.bodyWeightLogs, async () => {
      await Promise.all([dexieDB.kv.clear(), dexieDB.exercises.clear(), dexieDB.workouts.clear(), dexieDB.workoutExercises.clear(), dexieDB.bodyWeightLogs.clear()]);
    });
    _cache.user=null; _cache.settings={weightUnit:'kg',distanceUnit:'km'};
    _cache.exercises=[]; _cache.workouts=[]; _cache.workoutExercises=[];
    _cache.activeWorkoutId=null; _cache.bodyWeightLogs=[];
  },

  async backup() {
    const [kvAll, exercises, workouts, wes, bwLogs] = await Promise.all([
      dexieDB.kv.toArray(), dexieDB.exercises.toArray(), dexieDB.workouts.toArray(),
      dexieDB.workoutExercises.toArray(), dexieDB.bodyWeightLogs.toArray(),
    ]);
    return { kv:kvAll, exercises, workouts, workoutExercises:wes, bodyWeightLogs:bwLogs };
  },

  async restore(data) {
    await dexieDB.transaction('rw', dexieDB.kv, dexieDB.exercises, dexieDB.workouts, dexieDB.workoutExercises, dexieDB.bodyWeightLogs, async () => {
      await Promise.all([dexieDB.kv.clear(), dexieDB.exercises.clear(), dexieDB.workouts.clear(), dexieDB.workoutExercises.clear(), dexieDB.bodyWeightLogs.clear()]);
      if (data.kv?.length)               await dexieDB.kv.bulkPut(data.kv);
      if (data.exercises?.length)        await dexieDB.exercises.bulkPut(data.exercises);
      if (data.workouts?.length)         await dexieDB.workouts.bulkPut(data.workouts);
      if (data.workoutExercises?.length) await dexieDB.workoutExercises.bulkPut(data.workoutExercises);
      if (data.bodyWeightLogs?.length)   await dexieDB.bodyWeightLogs.bulkPut(data.bodyWeightLogs);
    });
  },

  getUser()     { return _cache.user; },
  saveUser(u)   { _cache.user = u; dexieDB.kv.put({ key:'user', value:u }); },

  getSettings()   { return _cache.settings; },
  saveSettings(s) { _cache.settings = s; dexieDB.kv.put({ key:'settings', value:s }); },

  getExercises()   { return _cache.exercises; },
  saveExercises(a) { _cache.exercises = a; dexieDB.exercises.bulkPut(a); },
  addExercise(e)   { _cache.exercises.push(e); dexieDB.exercises.put(e); },

  getWorkouts()      { return _cache.workouts; },
  addWorkout(w)      { _cache.workouts.push(w); dexieDB.workouts.put(w); },
  updateWorkout(w)   { const i=_cache.workouts.findIndex(x=>x.id===w.id); if(i>=0) _cache.workouts[i]=w; else _cache.workouts.push(w); dexieDB.workouts.put(w); },
  getWorkoutById(id) { return _cache.workouts.find(w=>w.id===id)||null; },
  deleteWorkout(id)  {
    _cache.workouts         = _cache.workouts.filter(w=>w.id!==id);
    _cache.workoutExercises = _cache.workoutExercises.filter(we=>we.workoutId!==id);
    dexieDB.workouts.delete(id);
    dexieDB.workoutExercises.where('workoutId').equals(id).delete();
  },

  getWorkoutExercises()     { return _cache.workoutExercises; },
  addWorkoutExercise(we)    { _cache.workoutExercises.push(we); dexieDB.workoutExercises.put(we); },
  updateWorkoutExercise(we) { const i=_cache.workoutExercises.findIndex(x=>x.id===we.id); if(i>=0) _cache.workoutExercises[i]=we; else _cache.workoutExercises.push(we); dexieDB.workoutExercises.put(we); },
  getWEsForWorkout(wid)     { return _cache.workoutExercises.filter(we=>we.workoutId===wid); },

  getActive()  { return _cache.activeWorkoutId; },
  setActive(id){ _cache.activeWorkoutId = id; dexieDB.kv.put({ key:'activeWorkout', value:id }); },
  clearActive(){ _cache.activeWorkoutId = null; dexieDB.kv.delete('activeWorkout'); },

  getBodyWeightLogs()        { return _cache.bodyWeightLogs; },
  async addBodyWeightLog(e)  { const id = await dexieDB.bodyWeightLogs.add(e); e.id=id; _cache.bodyWeightLogs.push(e); return e; },
  updateBodyWeightLog(e)     { const i=_cache.bodyWeightLogs.findIndex(x=>x.id===e.id); if(i>=0) _cache.bodyWeightLogs[i]=e; dexieDB.bodyWeightLogs.put(e); },
  deleteBodyWeightLog(id)    { _cache.bodyWeightLogs=_cache.bodyWeightLogs.filter(x=>x.id!==id); dexieDB.bodyWeightLogs.delete(id); },
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function escHtml(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}

function formatDuration(startIso, endIso) {
  const m = Math.floor((new Date(endIso)-new Date(startIso))/60000);
  return m<60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
}

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

/* ═══════════════════════════════════════════════════════════════
   SEED + MIGRATE
═══════════════════════════════════════════════════════════════ */
function seedOrMigrate() {
  const stored = DB.getExercises();
  if (stored.length === 0) {
    DB.saveExercises(PRESET_EXERCISES.map(e=>({...e, createdAt:new Date().toISOString()})));
    return;
  }
  const map = Object.fromEntries(PRESET_EXERCISES.map(e=>[e.id,e]));
  let changed = false;
  let updated = stored.map(e => {
    if (e.isPreset && map[e.id] && (!e.bodyRegion || !e.muscles)) {
      changed = true;
      return { ...map[e.id], createdAt: e.createdAt };
    }
    if (e.isPreset && map[e.id] && map[e.id].subtype && !e.subtype) {
      changed = true;
      return { ...e, subtype: map[e.id].subtype };
    }
    if (!e.bodyRegion) { changed=true; return { ...e, bodyRegion:'full', muscles: e.muscleGroup ? [e.muscleGroup] : [] }; }
    return e;
  });
  if (!updated.find(e=>e.id==='pre_treadmill')) {
    changed = true;
    updated.push({ ...map['pre_treadmill'], createdAt: new Date().toISOString() });
  }
  if (changed) DB.saveExercises(updated);
}

/* ═══════════════════════════════════════════════════════════════
   ROUTER
═══════════════════════════════════════════════════════════════ */
const Router = {
  navigate(path) { window.location.hash = path; },

  current() { return window.location.hash.slice(1) || '/home'; },

  matchHistory(path) { const m=path.match(/^\/history\/(.+)$/); return m?m[1]:null; },

  init() {
    window.addEventListener('hashchange', ()=>Router.route());
    Router.route();
  },

  route() {
    const path      = Router.current();
    const tabBar    = document.getElementById('tab-bar');
    const container = document.getElementById('view-container');

    if (path === '/onboarding') {
      tabBar.hidden = true;
      container.innerHTML = renderOnboarding();
      return;
    }

    if (path === '/target') {
      tabBar.hidden = true;
      container.innerHTML = renderTarget();
      return;
    }

    tabBar.hidden = false;
    updateTabBar(path);

    if      (path === '/home')           container.innerHTML = renderHome();
    else if (path === '/workout/new')    { container.innerHTML = renderPicker(); initPicker(); }
    else if (path === '/workout/active') { container.innerHTML = renderActiveWorkout(); startTimer(); }
    else if (path === '/history')        container.innerHTML = renderHistory();
    else if (Router.matchHistory(path))  container.innerHTML = renderHistoryDetail(Router.matchHistory(path));
    else if (path === '/library')        container.innerHTML = renderLibrary();
    else if (path === '/settings')       container.innerHTML = renderSettings();
    else Router.navigate('/home');
  },
};

function updateTabBar(path) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tab = btn.dataset.tab;
    btn.classList.toggle('active',
      (tab === 'home'     && path === '/home') ||
      (tab === 'workout'  && path.startsWith('/workout')) ||
      (tab === 'library'  && path === '/library') ||
      (tab === 'history'  && (path === '/history' || path.startsWith('/history/'))) ||
      (tab === 'settings' && path === '/settings')
    );
  });
}

/* ═══════════════════════════════════════════════════════════════
   BODY SVG HELPERS
═══════════════════════════════════════════════════════════════ */
function muscleFill(muscle) {
  return pickerState.selectedMuscles.includes(muscle)
    ? `style="fill:#e84142;cursor:pointer"`
    : `style="fill:#9baabb;cursor:pointer"`;
}

function bodyFrontSVG() {
  const s = `fill="#bdc6cf"`;
  return `<svg viewBox="0 0 160 320" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px">
    <!-- body silhouette -->
    <circle cx="80" cy="22" r="18" ${s}/>
    <rect x="73" y="38" width="14" height="12" rx="4" ${s}/>
    <path d="M 30 50 C 42 48,62 46,80 46 C 98 46,118 48,130 50 C 128 84,124 108,122 128 C 120 140,118 148,112 152 L 48 152 C 42 148,40 140,38 128 C 36 108,32 84,30 50 Z" ${s}/>
    <path d="M 30 50 C 24 54,16 62,14 76 C 12 90,14 100,18 108 C 24 104,30 96,34 86 C 38 78,40 68,38 58 C 36 53,33 50,30 50 Z" ${s}/>
    <path d="M 18 108 C 14 116,12 126,12 136 C 12 142,14 146,18 146 L 28 146 C 28 140,28 132,26 124 C 24 116,22 110,18 108 Z" ${s}/>
    <path d="M 130 50 C 136 54,144 62,146 76 C 148 90,146 100,142 108 C 136 104,130 96,126 86 C 122 78,120 68,122 58 C 124 53,127 50,130 50 Z" ${s}/>
    <path d="M 142 108 C 146 116,148 126,148 136 C 148 142,146 146,142 146 L 132 146 C 132 140,132 132,134 124 C 136 116,138 110,142 108 Z" ${s}/>
    <path d="M 34 152 C 32 158,30 170,30 186 C 30 202,34 218,38 228 C 42 234,48 236,54 234 C 60 232,66 226,68 218 C 70 206,70 186,68 170 C 66 158,62 152,48 152 Z" ${s}/>
    <path d="M 38 230 C 34 242,32 256,34 270 C 36 280,40 288,46 292 C 52 294,58 292,62 288 C 66 282,68 270,68 258 C 68 244,66 234,64 230 Z" ${s}/>
    <path d="M 126 152 C 128 158,130 170,130 186 C 130 202,126 218,122 228 C 118 234,112 236,106 234 C 100 232,94 226,92 218 C 90 206,90 186,92 170 C 94 158,98 152,112 152 Z" ${s}/>
    <path d="M 122 230 C 126 242,128 256,126 270 C 124 280,120 288,114 292 C 108 294,102 292,98 288 C 94 282,92 270,92 258 C 92 244,94 234,96 230 Z" ${s}/>
    <!-- LEFT DELTOID -->
    <path d="M 36 52 C 28 50,16 56,14 66 C 12 76,14 86,20 92 C 26 96,32 94,36 88 C 40 84,42 78,42 70 C 42 60,40 54,36 52 Z"
      ${muscleFill('Shoulders')} data-action="toggle-muscle" data-muscle="Shoulders"/>
    <!-- RIGHT DELTOID -->
    <path d="M 124 52 C 132 50,144 56,146 66 C 148 76,146 86,140 92 C 134 96,128 94,124 88 C 120 84,118 78,118 70 C 118 60,120 54,124 52 Z"
      ${muscleFill('Shoulders')} data-action="toggle-muscle" data-muscle="Shoulders"/>
    <!-- LEFT PECTORAL -->
    <path d="M 72 65 C 64 60,46 58,36 66 C 30 72,30 84,36 90 C 42 94,52 94,60 90 C 68 86,74 78,74 70 C 74 67,73 65,72 65 Z"
      ${muscleFill('Chest')} data-action="toggle-muscle" data-muscle="Chest"/>
    <!-- RIGHT PECTORAL -->
    <path d="M 88 65 C 96 60,114 58,124 66 C 130 72,130 84,124 90 C 118 94,108 94,100 90 C 92 86,86 78,86 70 C 86 67,87 65,88 65 Z"
      ${muscleFill('Chest')} data-action="toggle-muscle" data-muscle="Chest"/>
    <!-- LEFT BICEP -->
    <path d="M 32 68 C 26 72,18 80,16 92 C 14 102,16 110,20 114 C 26 116,32 114,36 108 C 40 102,40 90,38 78 C 36 70,34 68,32 68 Z"
      ${muscleFill('Biceps')} data-action="toggle-muscle" data-muscle="Biceps"/>
    <!-- RIGHT BICEP -->
    <path d="M 128 68 C 134 72,142 80,144 92 C 146 102,144 110,140 114 C 134 116,128 114,124 108 C 120 102,120 90,122 78 C 124 70,126 68,128 68 Z"
      ${muscleFill('Biceps')} data-action="toggle-muscle" data-muscle="Biceps"/>
    <!-- ABS / CORE -->
    <path d="M 58 105 C 54 104,50 106,50 110 L 50 148 C 50 150,56 152,62 152 L 98 152 C 104 152,110 150,110 148 L 110 110 C 110 106,106 104,102 105 Z"
      ${muscleFill('Core')} data-action="toggle-muscle" data-muscle="Core"/>
    <!-- LEFT QUAD -->
    <path d="M 38 155 C 32 160,28 172,28 186 C 28 200,32 216,38 224 C 42 230,48 232,54 230 C 60 228,66 222,68 212 C 70 200,70 184,68 170 C 66 160,60 154,52 154 C 46 154,42 154,38 155 Z"
      ${muscleFill('Quads')} data-action="toggle-muscle" data-muscle="Quads"/>
    <!-- RIGHT QUAD -->
    <path d="M 122 155 C 128 160,132 172,132 186 C 132 200,128 216,122 224 C 118 230,112 232,106 230 C 100 228,94 222,92 212 C 90 200,90 184,92 170 C 94 160,100 154,108 154 C 114 154,118 154,122 155 Z"
      ${muscleFill('Quads')} data-action="toggle-muscle" data-muscle="Quads"/>
    <!-- LEFT CALF -->
    <path d="M 44 233 C 38 238,34 250,34 264 C 34 276,38 286,44 290 C 50 293,56 292,60 286 C 64 280,66 268,66 256 C 66 244,62 236,56 233 C 52 231,48 231,44 233 Z"
      ${muscleFill('Calves')} data-action="toggle-muscle" data-muscle="Calves"/>
    <!-- RIGHT CALF -->
    <path d="M 116 233 C 122 238,126 250,126 264 C 126 276,122 286,116 290 C 110 293,104 292,100 286 C 96 280,94 268,94 256 C 94 244,98 236,104 233 C 108 231,112 231,116 233 Z"
      ${muscleFill('Calves')} data-action="toggle-muscle" data-muscle="Calves"/>
  </svg>`;
}

function bodyBackSVG() {
  const s = `fill="#bdc6cf"`;
  return `<svg viewBox="0 0 160 320" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:200px">
    <!-- body silhouette (same as front) -->
    <circle cx="80" cy="22" r="18" ${s}/>
    <rect x="73" y="38" width="14" height="12" rx="4" ${s}/>
    <path d="M 30 50 C 42 48,62 46,80 46 C 98 46,118 48,130 50 C 128 84,124 108,122 128 C 120 140,118 148,112 152 L 48 152 C 42 148,40 140,38 128 C 36 108,32 84,30 50 Z" ${s}/>
    <path d="M 30 50 C 24 54,16 62,14 76 C 12 90,14 100,18 108 C 24 104,30 96,34 86 C 38 78,40 68,38 58 C 36 53,33 50,30 50 Z" ${s}/>
    <path d="M 18 108 C 14 116,12 126,12 136 C 12 142,14 146,18 146 L 28 146 C 28 140,28 132,26 124 C 24 116,22 110,18 108 Z" ${s}/>
    <path d="M 130 50 C 136 54,144 62,146 76 C 148 90,146 100,142 108 C 136 104,130 96,126 86 C 122 78,120 68,122 58 C 124 53,127 50,130 50 Z" ${s}/>
    <path d="M 142 108 C 146 116,148 126,148 136 C 148 142,146 146,142 146 L 132 146 C 132 140,132 132,134 124 C 136 116,138 110,142 108 Z" ${s}/>
    <path d="M 34 152 C 32 158,30 170,30 186 C 30 202,34 218,38 228 C 42 234,48 236,54 234 C 60 232,66 226,68 218 C 70 206,70 186,68 170 C 66 158,62 152,48 152 Z" ${s}/>
    <path d="M 38 230 C 34 242,32 256,34 270 C 36 280,40 288,46 292 C 52 294,58 292,62 288 C 66 282,68 270,68 258 C 68 244,66 234,64 230 Z" ${s}/>
    <path d="M 126 152 C 128 158,130 170,130 186 C 130 202,126 218,122 228 C 118 234,112 236,106 234 C 100 232,94 226,92 218 C 90 206,90 186,92 170 C 94 158,98 152,112 152 Z" ${s}/>
    <path d="M 122 230 C 126 242,128 256,126 270 C 124 280,120 288,114 292 C 108 294,102 292,98 288 C 94 282,92 270,92 258 C 92 244,94 234,96 230 Z" ${s}/>
    <!-- TRAPEZIUS -->
    <path d="M 56 52 C 50 52,38 56,34 66 C 30 76,34 86,42 92 C 54 98,68 100,80 100 C 92 100,106 98,118 92 C 126 86,130 76,126 66 C 122 56,110 52,104 52 C 96 50,86 48,80 48 C 74 48,64 50,56 52 Z"
      ${muscleFill('Back')} data-action="toggle-muscle" data-muscle="Back"/>
    <!-- LEFT LAT -->
    <path d="M 34 86 C 30 96,28 112,28 130 C 28 148,32 156,38 158 C 44 160,52 158,58 152 C 64 146,66 132,64 116 C 62 102,56 92,48 86 C 44 83,38 84,34 86 Z"
      ${muscleFill('Back')} data-action="toggle-muscle" data-muscle="Back"/>
    <!-- RIGHT LAT -->
    <path d="M 126 86 C 130 96,132 112,132 130 C 132 148,128 156,122 158 C 116 160,108 158,102 152 C 96 146,94 132,96 116 C 98 102,104 92,112 86 C 116 83,122 84,126 86 Z"
      ${muscleFill('Back')} data-action="toggle-muscle" data-muscle="Back"/>
    <!-- LEFT TRICEP -->
    <path d="M 28 56 C 20 60,14 70,12 82 C 10 94,12 106,18 112 C 24 116,30 114,34 108 C 38 102,38 90,36 78 C 34 66,32 58,28 56 Z"
      ${muscleFill('Triceps')} data-action="toggle-muscle" data-muscle="Triceps"/>
    <!-- RIGHT TRICEP -->
    <path d="M 132 56 C 140 60,146 70,148 82 C 150 94,148 106,142 112 C 136 116,130 114,126 108 C 122 102,122 90,124 78 C 126 66,128 58,132 56 Z"
      ${muscleFill('Triceps')} data-action="toggle-muscle" data-muscle="Triceps"/>
    <!-- LEFT GLUTE -->
    <path d="M 34 152 C 30 158,28 168,30 178 C 32 188,38 196,46 198 C 54 200,62 196,66 188 C 70 180,70 168,66 158 C 62 150,52 148,44 150 C 40 150,36 150,34 152 Z"
      ${muscleFill('Glutes')} data-action="toggle-muscle" data-muscle="Glutes"/>
    <!-- RIGHT GLUTE -->
    <path d="M 126 152 C 130 158,132 168,130 178 C 128 188,122 196,114 198 C 106 200,98 196,94 188 C 90 180,90 168,94 158 C 98 150,108 148,116 150 C 120 150,124 150,126 152 Z"
      ${muscleFill('Glutes')} data-action="toggle-muscle" data-muscle="Glutes"/>
    <!-- LEFT HAMSTRING -->
    <path d="M 36 195 C 30 200,28 212,30 224 C 32 234,38 240,46 240 C 54 240,62 234,66 224 C 70 214,70 200,66 192 C 62 184,54 181,46 183 C 42 184,38 190,36 195 Z"
      ${muscleFill('Hamstrings')} data-action="toggle-muscle" data-muscle="Hamstrings"/>
    <!-- RIGHT HAMSTRING -->
    <path d="M 124 195 C 130 200,132 212,130 224 C 128 234,122 240,114 240 C 106 240,98 234,94 224 C 90 214,90 200,94 192 C 98 184,106 181,114 183 C 118 184,122 190,124 195 Z"
      ${muscleFill('Hamstrings')} data-action="toggle-muscle" data-muscle="Hamstrings"/>
    <!-- LEFT CALF (back) -->
    <path d="M 36 244 C 30 252,28 264,30 276 C 32 284,38 290,46 292 C 52 293,58 290,62 284 C 66 278,66 264,64 254 C 62 244,56 240,50 240 C 44 240,40 242,36 244 Z"
      ${muscleFill('Calves')} data-action="toggle-muscle" data-muscle="Calves"/>
    <!-- RIGHT CALF (back) -->
    <path d="M 124 244 C 130 252,132 264,130 276 C 128 284,122 290,114 292 C 108 293,102 290,98 284 C 94 278,94 264,96 254 C 98 244,104 240,110 240 C 116 240,120 242,124 244 Z"
      ${muscleFill('Calves')} data-action="toggle-muscle" data-muscle="Calves"/>
  </svg>`;
}

function updateMuscleHighlights() {
  const sel = pickerState.selectedMuscles;
  document.querySelectorAll('[data-action="toggle-muscle"]').forEach(el => {
    const m = el.dataset.muscle;
    if (sel.includes(m)) {
      el.style.fill = 'var(--accent)';
      el.style.opacity = '0.82';
    } else {
      el.style.fill = '#b8c8d8';
      el.style.opacity = '1';
    }
  });
  document.querySelectorAll('.muscle-pill').forEach(el => {
    el.classList.toggle('active', sel.includes(el.dataset.muscle));
  });
  const allBtn = document.querySelector('[data-action="muscle-all"]');
  if (allBtn) allBtn.classList.toggle('active', sel.length === 0);
}

/* ═══════════════════════════════════════════════════════════════
   VIEWS
═══════════════════════════════════════════════════════════════ */

/* ── Onboarding ───────────────────────────────────────────────── */
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
    const dStr     = d.toDateString();
    const todayStr = today.toDateString();
    const isToday  = dStr === todayStr;
    const isPast   = d < today;
    const hasWkt   = workouts.some(w => w.finishedAt && new Date(w.startedAt).toDateString() === dStr);

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
  const user     = DB.getUser();
  const workouts = DB.getWorkouts().filter(w => w.finishedAt);
  const wes      = DB.getWorkoutExercises();
  const exMap    = Object.fromEntries(DB.getExercises().map(e => [e.id, e]));
  const activeId = DB.getActive();

  const now = new Date();
  const dow = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dow + 6) % 7);
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek  = workouts.filter(w => new Date(w.startedAt) >= weekStart);
  const totalSets = thisWeek.reduce((acc, w) =>
    acc + wes.filter(we => we.workoutId === w.id).reduce((a, we) => a + we.sets.length, 0), 0);

  const recent = workouts.slice().sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 4);

  const dumbbellSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M2 12h2m16 0h2M4 10v4M20 10v4"/></svg>`;
  const chevronSvg  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  const recentRows = recent.length === 0
    ? `<div class="empty-state" style="padding:32px 0">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:48px;height:48px;opacity:.3"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
         <p>No workouts yet. Hit Start to begin!</p>
       </div>`
    : recent.map(w => {
        const list  = wes.filter(we => we.workoutId === w.id);
        const names = [...new Set(list.map(we => exMap[we.exerciseDefId]?.name).filter(Boolean))];
        const label = names[0] || 'Workout';
        const dur   = formatDuration(w.startedAt, w.finishedAt);
        const dateStr = new Date(w.startedAt).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' });
        return `<div class="recent-item" data-action="open-history-detail" data-id="${w.id}">
          <div class="recent-icon">${dumbbellSvg}</div>
          <div class="recent-info">
            <div class="recent-name">${escHtml(label)}</div>
            <div class="recent-date">${dateStr}</div>
          </div>
          <div class="recent-stats">
            <div class="recent-dur">${dur}</div>
            <div class="recent-ex">${list.length} ex</div>
          </div>
          <div class="recent-chevron">${chevronSvg}</div>
        </div>`;
      }).join('');

  const ctaAction = activeId ? 'resume-workout' : 'start-workout';
  const ctaTitle  = activeId ? 'Resume Workout'  : 'Start Workout';
  const ctaSub    = activeId ? 'Continue where you left off' : "Let's get moving";

  return `
    <div class="screen">
      <div class="home-header">
        <div class="home-greeting">${getGreeting()}, ${escHtml(user?.name || 'there')}</div>
        <div class="home-sub">Ready to crush it?</div>
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

  const pills = MUSCLE_GROUPS.map(m =>
    `<button class="muscle-pill ${sel.includes(m)?'active':''}" data-action="muscle-pill" data-muscle="${m}">${m}</button>`
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
        ${view==='front' ? bodyFrontSVG() : bodyBackSVG()}
      </div>

      <div class="muscle-pills-wrap">
        <button class="muscle-pill all-pill ${sel.length===0?'active':''}" data-action="muscle-all">All muscles</button>
        ${pills}
      </div>

      ${sel.length > 0 ? `<button class="muscle-clear-btn" data-action="muscle-clear">Clear selection</button>` : ''}
    </div>`;
}

/* ── Exercise Picker ──────────────────────────────────────────── */
let pickerState = {
  search:'', category:'all', bodyRegion:'all',
  showCustomForm:false, customName:'', customCat:'strength', customRegion:'upper',
  selectedMuscles:[], bodyView:'front'
};

function renderPicker() {
  const exercises = DB.getExercises();
  const { search, category, bodyRegion, showCustomForm, customName, customCat, customRegion, selectedMuscles } = pickerState;

  let filtered = exercises.filter(e=>{
    const mCat    = category==='all'    || e.category===category;
    const mRegion = bodyRegion==='all'  || e.bodyRegion===bodyRegion;
    const mSearch = e.name.toLowerCase().includes(search.toLowerCase());
    return mCat && mRegion && mSearch;
  });

  if (selectedMuscles.length > 0) {
    filtered = filtered.filter(e => e.muscles?.some(m => selectedMuscles.includes(m)));
  }

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

  const items = filtered.length===0
    ? `<div class="empty-state" style="padding-top:48px"><p>No exercises found</p></div>`
    : filtered.map(e=>`
        <div class="exercise-item">
          <span class="exercise-dot ${e.category}"></span>
          <div class="exercise-item-info">
            <div class="exercise-item-name">${escHtml(e.name)}</div>
            ${e.muscles?.length ? `<div class="exercise-item-muscles">${e.muscles.map(m=>escHtml(m)).join(' · ')}</div>` : ''}
          </div>
          <span class="exercise-item-tag">${escHtml(e.muscleGroup||categoryLabel(e.category))}</span>
          <button class="exercise-item-add" data-action="picker-add" data-exid="${e.id}" aria-label="Add">+</button>
        </div>`).join('');

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
      <div class="settings-label" style="padding:4px 2px 4px">Body Region</div>
      <div class="segment-control">
        ${['upper','lower','core','full'].map(r=>
          `<button class="seg-btn ${customRegion===r?'active':''}" data-action="custom-region" data-region="${r}">${regionLabel(r).split(' ')[0]}</button>`
        ).join('')}
      </div>
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
      <div class="exercise-list" id="exercise-list">${items}</div>
    </div>`;
}

function rebuildExerciseList() {
  const el = document.getElementById('exercise-list');
  if (!el) return;
  const exercises = DB.getExercises();
  const { search, category, bodyRegion, selectedMuscles } = pickerState;

  let filtered = exercises.filter(e=>{
    return (category==='all'||e.category===category)
      && (bodyRegion==='all'||e.bodyRegion===bodyRegion)
      && e.name.toLowerCase().includes(search.toLowerCase());
  });

  if (selectedMuscles.length > 0) {
    filtered = filtered.filter(e => e.muscles?.some(m => selectedMuscles.includes(m)));
  }

  el.innerHTML = filtered.length===0
    ? `<div class="empty-state" style="padding-top:48px"><p>No exercises found</p></div>`
    : filtered.map(e=>`
        <div class="exercise-item">
          <span class="exercise-dot ${e.category}"></span>
          <div class="exercise-item-info">
            <div class="exercise-item-name">${escHtml(e.name)}</div>
            ${e.muscles?.length ? `<div class="exercise-item-muscles">${e.muscles.map(m=>escHtml(m)).join(' · ')}</div>` : ''}
          </div>
          <span class="exercise-item-tag">${escHtml(e.muscleGroup||categoryLabel(e.category))}</span>
          <button class="exercise-item-add" data-action="picker-add" data-exid="${e.id}" aria-label="Add">+</button>
        </div>`).join('');
}

function initPicker() {
  const inp = document.getElementById('picker-search');
  if (inp) inp.addEventListener('input', e=>{ pickerState.search=e.target.value; rebuildExerciseList(); });
}

/* ── Active Workout ───────────────────────────────────────────── */
let timerInterval = null;

function startTimer() {
  clearInterval(timerInterval);
  const workoutId = DB.getActive();
  const workout   = workoutId ? DB.getWorkoutById(workoutId) : null;
  if (!workout) return;
  timerInterval = setInterval(()=>{
    const el = document.getElementById('workout-timer');
    if (el) el.textContent = formatElapsed(workout.startedAt);
    else    clearInterval(timerInterval);
  }, 1000);
}

function renderActiveWorkout() {
  const workoutId = DB.getActive();
  if (!workoutId) { Router.navigate('/home'); return '<div></div>'; }
  const workout = DB.getWorkoutById(workoutId);
  if (!workout)  { Router.navigate('/home'); return '<div></div>'; }

  const wes      = DB.getWEsForWorkout(workoutId);
  const exMap    = Object.fromEntries(DB.getExercises().map(e=>[e.id,e]));
  const settings = DB.getSettings();

  const cards = wes.map(we=>{
    const ex = exMap[we.exerciseDefId];
    return ex ? renderExerciseCard(we, ex, settings) : '';
  }).join('');

  return `
    <div class="screen">
      <div class="workout-header-sticky">
        <div>
          <div class="workout-title">Active Workout</div>
          <div id="workout-timer" class="workout-timer">${formatElapsed(workout.startedAt)}</div>
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

function renderExerciseCard(we, ex, settings) {
  const treadmill = ex.subtype==='treadmill';
  const headerCols = treadmill
    ? '<span>#</span><span>Time</span><span>km</span><span>Cal</span><span>Gain</span><span>✓</span>'
    : ex.category==='strength'
      ? '<span>#</span><span>Weight</span><span></span><span>Reps</span><span>✓</span>'
      : ex.category==='bodyweight' ? '<span>#</span><span>Reps</span><span>✓</span>'
      : '<span>#</span><span>Time</span><span>Dist</span><span>✓</span>';

  return `
    <div class="exercise-card" data-weid="${we.id}">
      <div class="exercise-card-header">
        <div style="flex:1;min-width:0">
          <div class="exercise-card-name">${escHtml(ex.name)}</div>
          ${ex.muscles?.length ? `<div style="font-size:12px;color:var(--fg3);margin-top:2px">${ex.muscles.slice(0,3).map(m=>escHtml(m)).join(' · ')}</div>` : ''}
        </div>
        <span class="exercise-card-badge badge-${ex.category}">${categoryLabel(ex.category)}</span>
        <button class="btn-icon" data-action="remove-exercise" data-weid="${we.id}" aria-label="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="sets-table">
        <div class="set-row-header type-${treadmill?'treadmill':ex.category}">${headerCols}</div>
        <div class="set-rows" data-weid="${we.id}">
          ${we.sets.map((s,i)=>renderSetRow(s,i,we.id,ex.category,settings)).join('')}
        </div>
      </div>
      <button class="add-set-btn" data-action="add-set" data-weid="${we.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Set
      </button>
    </div>`;
}

function renderSetRow(set, idx, weId, category, settings) {
  const done  = set.completed ? 'done' : '';
  const check = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;

  if (category==='strength') {
    const u = settings.weightUnit||'kg';
    return `<div class="set-row type-strength ${done}" data-weid="${weId}" data-setidx="${idx}">
      <span class="set-num">${idx+1}</span>
      <input class="set-input" type="number" inputmode="decimal" placeholder="0" value="${escHtml(set.weight??'')}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="weight" min="0">
      <span class="set-sep">${u}</span>
      <input class="set-input" type="number" inputmode="numeric" placeholder="0" value="${escHtml(set.reps??'')}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="reps" min="0">
      <button class="set-check ${done}" data-action="toggle-set" data-weid="${weId}" data-setidx="${idx}">${check}</button>
    </div>`;
  }
  if (category==='bodyweight') {
    return `<div class="set-row type-bodyweight ${done}" data-weid="${weId}" data-setidx="${idx}">
      <span class="set-num">${idx+1}</span>
      <input class="set-input" type="number" inputmode="numeric" placeholder="0" value="${escHtml(set.reps??'')}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="reps" min="0">
      <button class="set-check ${done}" data-action="toggle-set" data-weid="${weId}" data-setidx="${idx}">${check}</button>
    </div>`;
  }
  const dur = set.duration ? formatDurationInput(set.duration) : '';
  if (set.subtype==='treadmill') {
    return `<div class="set-row type-treadmill ${done}" data-weid="${weId}" data-setidx="${idx}">
      <span class="set-num">${idx+1}</span>
      <input class="set-input" type="text" inputmode="numeric" placeholder="mm:ss" value="${escHtml(dur)}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="duration">
      <input class="set-input" type="number" inputmode="decimal" placeholder="km" value="${escHtml(set.distance??'')}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="distance" min="0">
      <input class="set-input" type="number" inputmode="numeric" placeholder="cal" value="${escHtml(set.calories??'')}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="calories" min="0">
      <input class="set-input" type="number" inputmode="numeric" placeholder="m" value="${escHtml(set.vertGain??'')}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="vertGain" min="0">
      <button class="set-check ${done}" data-action="toggle-set" data-weid="${weId}" data-setidx="${idx}">${check}</button>
    </div>`;
  }
  const du  = settings.distanceUnit||'km';
  return `<div class="set-row type-cardio ${done}" data-weid="${weId}" data-setidx="${idx}">
    <span class="set-num">${idx+1}</span>
    <input class="set-input" type="text" inputmode="numeric" placeholder="mm:ss" value="${escHtml(dur)}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="duration">
    <input class="set-input" type="number" inputmode="decimal" placeholder="${du}" value="${escHtml(set.distance??'')}" data-action="set-field" data-weid="${weId}" data-setidx="${idx}" data-field="distance" min="0">
    <button class="set-check ${done}" data-action="toggle-set" data-weid="${weId}" data-setidx="${idx}">${check}</button>
  </div>`;
}

/* ── History ──────────────────────────────────────────────────── */
function renderHistory() {
  const workouts = DB.getWorkouts().filter(w=>w.finishedAt).sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
  const wes      = DB.getWorkoutExercises();
  const exMap    = Object.fromEntries(DB.getExercises().map(e=>[e.id,e]));

  const cards = workouts.length===0
    ? `<div class="empty-state" style="padding-top:64px">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
         <p>No workouts logged yet.</p>
       </div>`
    : workouts.map(w=>{
        const list   = wes.filter(we=>we.workoutId===w.id);
        const names  = [...new Set(list.map(we=>exMap[we.exerciseDefId]?.name).filter(Boolean))];
        const sets   = list.reduce((a,we)=>a+we.sets.length,0);
        const dur    = formatDuration(w.startedAt, w.finishedAt);
        const regions= [...new Set(list.map(we=>exMap[we.exerciseDefId]?.bodyRegion).filter(Boolean))];
        const regionPills = regions.map(r=>`<span class="region-pill ${r}">${regionLabel(r)}</span>`).join('');
        return `
          <div class="history-card" data-action="open-history-detail" data-id="${w.id}">
            <div class="history-card-top">
              <div>
                <div class="history-card-date">${formatDate(w.startedAt)}</div>
                <div class="history-card-duration">${dur}</div>
              </div>
              <div class="history-card-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
            ${regionPills ? `<div class="region-pills">${regionPills}</div>` : ''}
            <div class="history-card-exercises">${escHtml(names.join(', '))||'No exercises'}</div>
            <div class="history-card-stats">
              <div class="history-stat"><strong>${list.length}</strong> exercises</div>
              <div class="history-stat"><strong>${sets}</strong> sets</div>
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
      </div>
      <div class="history-list">${cards}</div>
    </div>`;
}

/* ── History Detail ───────────────────────────────────────────── */
function renderHistoryDetail(workoutId) {
  const workout = DB.getWorkoutById(workoutId);
  if (!workout) { Router.navigate('/history'); return '<div></div>'; }

  const weList   = DB.getWEsForWorkout(workoutId);
  const exMap    = Object.fromEntries(DB.getExercises().map(e=>[e.id,e]));
  const settings = DB.getSettings();

  const cards = weList.map(we=>{
    const ex = exMap[we.exerciseDefId];
    if (!ex) return '';
    const rows    = we.sets.map((s,i)=>renderDetailSetRow(s,i,ex.category,settings)).join('');
    const headers = ex.subtype==='treadmill'
      ? '<th>#</th><th>Time</th><th>km</th><th>Cal</th><th>Gain (m)</th>'
      : ex.category==='strength'
        ? '<th>#</th><th>Weight</th><th>Reps</th>'
        : ex.category==='bodyweight' ? '<th>#</th><th>Reps</th>'
        : '<th>#</th><th>Time</th><th>Distance</th>';
    return `
      <div class="detail-exercise">
        <div class="detail-exercise-name">
          <span class="exercise-dot ${ex.category}"></span>
          ${escHtml(ex.name)}
          ${ex.muscles?.length ? `<span style="font-size:12px;color:var(--fg3);font-weight:400;margin-left:4px">${ex.muscles.join(' · ')}</span>` : ''}
          <span class="exercise-card-badge badge-${ex.category}" style="margin-left:auto">${categoryLabel(ex.category)}</span>
        </div>
        <table class="detail-sets-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  }).join('');

  const dur = workout.finishedAt ? formatDuration(workout.startedAt, workout.finishedAt) : '—';

  return `
    <div class="screen">
      <div class="page-header">
        <div class="header-left">
          <h1>${formatDate(workout.startedAt)}</h1>
          <div class="header-sub">${dur} · ${weList.length} exercise${weList.length!==1?'s':''}</div>
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

function renderDetailSetRow(set, idx, category, settings) {
  if (set.subtype==='treadmill') {
    const dur = set.duration ? formatDurationInput(set.duration) : '—';
    return `<tr><td>${idx+1}</td><td>${dur}</td><td>${set.distance??'—'} km</td><td>${set.calories??'—'} cal</td><td>${set.vertGain??'—'} m</td></tr>`;
  }
  if (category==='strength') {
    const u = settings.weightUnit||'kg';
    return `<tr><td>${idx+1}</td><td>${set.weight??'—'} ${u}</td><td>${set.reps??'—'}</td></tr>`;
  }
  if (category==='bodyweight') return `<tr><td>${idx+1}</td><td>${set.reps??'—'} reps</td></tr>`;
  const du  = settings.distanceUnit||'km';
  const dur = set.duration ? formatDurationInput(set.duration) : '—';
  return `<tr><td>${idx+1}</td><td>${dur}</td><td>${set.distance??'—'} ${du}</td></tr>`;
}

/* ── Library ──────────────────────────────────────────────────── */
function renderLibrary() {
  const exercises = DB.getExercises();
  const regionOrder = ['upper','lower','core','full'];

  const sections = regionOrder.map(region=>{
    const regionExs = exercises.filter(e=>e.bodyRegion===region);
    if (regionExs.length===0) return '';

    const grouped = {};
    regionExs.forEach(e=>{
      const g = e.muscleGroup||'Other';
      if (!grouped[g]) grouped[g]=[];
      grouped[g].push(e);
    });

    const regionInfo = BODY_REGIONS.find(r=>r.id===region);
    const muscleBlocks = Object.entries(grouped).map(([group, exs])=>`
      <div class="library-muscle-group">
        <div class="library-muscle-label">${escHtml(group)}</div>
        <div class="library-card">
          ${exs.map(e=>`
            <div class="library-item">
              <span class="exercise-dot ${e.category}"></span>
              <div class="library-item-info">
                <div class="library-item-name">${escHtml(e.name)}</div>
                ${e.muscles?.length>1 ? `<div class="library-item-sub">${e.muscles.map(m=>escHtml(m)).join(' · ')}</div>` : ''}
              </div>
              ${!e.isPreset ? `<span class="custom-badge">Custom</span>` : ''}
              ${!e.isPreset ? `<button class="btn-icon" data-action="delete-exercise" data-exid="${e.id}" aria-label="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>` : ''}
            </div>`).join('')}
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

  const customs = exercises.filter(e=>!e.isPreset);
  const customExtra = customs.filter(e=>!regionOrder.includes(e.bodyRegion));

  return `
    <div class="screen">
      <div class="page-header">
        <div class="header-left">
          <h1>Library</h1>
          <div class="header-sub">${exercises.length} exercises</div>
        </div>
      </div>
      <div class="library-list">${sections}${customExtra.length?`
        <div>
          <div class="library-muscle-label">Custom</div>
          <div class="library-card">${customExtra.map(e=>`
            <div class="library-item">
              <span class="exercise-dot ${e.category}"></span>
              <div class="library-item-info"><div class="library-item-name">${escHtml(e.name)}</div></div>
              <span class="custom-badge">Custom</span>
              <button class="btn-icon" data-action="delete-exercise" data-exid="${e.id}" aria-label="Delete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>`).join('')}</div>
        </div>` : ''}</div>
      <button class="fab" data-action="library-add-custom" aria-label="Add exercise">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
    </div>`;
}

/* ── Settings ─────────────────────────────────────────────────── */
function renderSettings() {
  const user     = DB.getUser();
  const settings = DB.getSettings();

  return `
    <div class="screen">
      <div class="page-header"><div class="header-left"><h1>Settings</h1></div></div>
      <div class="scroll-content">

        <div class="settings-section">
          <div class="settings-label">Profile</div>
          <div class="settings-card">
            <div class="settings-row">
              <span class="settings-row-label">Name</span>
              <input class="settings-name-input" id="settings-name" type="text" value="${escHtml(user?.name||'')}" placeholder="Your name" maxlength="40" data-action="settings-name-change">
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
              <span class="settings-row-value">${DB.getWorkouts().filter(w=>w.finishedAt).length}</span>
            </div>
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
              <span class="settings-row-label">Restore from backup</span>
              <button class="btn-small" data-action="restore-data">Restore</button>
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
        <div class="settings-label" style="margin:12px 0 8px">Body Region</div>
        <div class="segment-control">
          ${['upper','lower','core','full'].map((r,i)=>
            `<button class="seg-btn ${i===0?'active':''}" data-action="modal-region" data-region="${r}">${regionLabel(r).split(' ')[0]}</button>`
          ).join('')}
        </div>
      </div>
      <input class="text-input" id="modal-ex-muscle" type="text" placeholder="Muscle group (e.g. Chest)" autocorrect="off" maxlength="40">
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-secondary" data-action="modal-cancel">Cancel</button>
        <button class="btn btn-primary" data-action="modal-save-exercise">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>overlay.classList.add('visible'));
  overlay.addEventListener('click', e=>{ if(e.target===overlay) closeModal('add-ex-modal'); });
}

function showConfirm(title, message, onConfirm) {
  const el = document.createElement('div');
  el.className = 'confirm-dialog';
  el.id = 'confirm-dialog';
  el.innerHTML = `
    <div class="confirm-box">
      <h3>${escHtml(title)}</h3>
      <p>${escHtml(message)}</p>
      <div class="confirm-actions">
        <button class="btn btn-danger" id="confirm-yes">${escHtml(title)}</button>
        <button class="btn btn-secondary" id="confirm-no">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#confirm-yes').addEventListener('click', ()=>{ el.remove(); onConfirm(); });
  el.querySelector('#confirm-no').addEventListener('click', ()=>el.remove());
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('visible');
  setTimeout(()=>el.remove(), 250);
}

/* ═══════════════════════════════════════════════════════════════
   EVENT DELEGATION
═══════════════════════════════════════════════════════════════ */
document.addEventListener('click',  handleClick);
document.addEventListener('input',  handleInput);
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
    DB.saveUser({ id:uid(), name, createdAt:new Date().toISOString() });
    Router.navigate('/home');
    return;
  }

  /* ── Tab nav ── */
  if (action==='nav-tab') {
    const tab = btn.dataset.tab;
    if (tab === 'workout') Router.navigate(DB.getActive() ? '/workout/active' : '/workout/new');
    else Router.navigate(`/${tab}`);
    return;
  }

  /* ── Home ── */
  if (action==='start-workout') {
    if (DB.getActive()) {
      showConfirm('Discard', 'A workout is already in progress. Discard it?', ()=>{
        DB.clearActive(); createAndStartWorkout();
      });
    } else createAndStartWorkout();
    return;
  }
  if (action==='resume-workout') { Router.navigate('/workout/active'); return; }
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
    if (svgWrap) svgWrap.innerHTML = pickerState.bodyView==='front' ? bodyFrontSVG() : bodyBackSVG();
    return;
  }

  /* ── Picker ── */
  if (action==='picker-close') { Router.navigate(DB.getActive()?'/workout/active':'/home'); return; }

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
    if (!DB.getActive()) createAndStartWorkout(()=>addExerciseToWorkout(exId));
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

  if (action==='custom-region') {
    pickerState.customRegion = btn.dataset.region;
    document.querySelectorAll('[data-action="custom-region"]').forEach(b=>b.classList.toggle('active', b.dataset.region===pickerState.customRegion));
    return;
  }

  if (action==='custom-save') {
    const nameEl = document.getElementById('custom-ex-name');
    const name   = nameEl?.value.trim();
    if (!name) { nameEl?.focus(); return; }
    DB.addExercise({ id:uid(), name, category:pickerState.customCat, bodyRegion:pickerState.customRegion, muscleGroup:pickerState.customCat, muscles:[], isPreset:false, createdAt:new Date().toISOString() });
    pickerState.showCustomForm=false; pickerState.customName='';
    Router.route();
    return;
  }

  /* ── Active workout ── */
  if (action==='add-exercise') {
    pickerState = { search:'', category:'all', bodyRegion:'all', showCustomForm:false, customName:'', customCat:'strength', customRegion:'upper', selectedMuscles:[], bodyView:'front' };
    Router.navigate('/workout/new');
    return;
  }

  if (action==='add-set') { addSetToWorkoutExercise(btn.dataset.weid); return; }
  if (action==='toggle-set') { toggleSet(btn.dataset.weid, parseInt(btn.dataset.setidx)); return; }
  if (action==='remove-exercise') { removeExerciseFromWorkout(btn.dataset.weid); return; }

  if (action==='finish-workout') {
    const workoutId = DB.getActive();
    const workout   = workoutId && DB.getWorkoutById(workoutId);
    if (!workout) return;
    workout.finishedAt = new Date().toISOString();
    DB.updateWorkout(workout); DB.clearActive(); clearInterval(timerInterval);
    Router.navigate(`/history/${workoutId}`);
    return;
  }

  if (action==='discard-workout') {
    showConfirm('Discard Workout', 'This will delete the current workout. Cannot be undone.', ()=>{
      const id = DB.getActive();
      if (id) DB.deleteWorkout(id);
      DB.clearActive(); clearInterval(timerInterval);
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
    showConfirm('Delete Exercise', 'Remove this custom exercise from your library?', ()=>{
      const exid = btn.dataset.exid;
      _cache.exercises = _cache.exercises.filter(e=>e.id!==exid);
      dexieDB.exercises.delete(exid);
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

  if (action==='modal-region') {
    document.querySelectorAll('[data-action="modal-region"]').forEach(b=>b.classList.toggle('active', b.dataset.region===btn.dataset.region));
    return;
  }

  if (action==='modal-save-exercise') {
    const nameEl   = document.getElementById('modal-ex-name');
    const muscleEl = document.getElementById('modal-ex-muscle');
    const name     = nameEl?.value.trim();
    if (!name) { nameEl?.focus(); return; }
    const catBtn    = document.querySelector('[data-action="modal-cat"].active');
    const regionBtn = document.querySelector('[data-action="modal-region"].active');
    DB.addExercise({
      id: uid(), name,
      category:   catBtn?.dataset.cat    || 'strength',
      bodyRegion: regionBtn?.dataset.region || 'upper',
      muscleGroup: muscleEl?.value.trim() || name,
      muscles:    muscleEl?.value.trim() ? [muscleEl.value.trim()] : [],
      isPreset: false, createdAt: new Date().toISOString(),
    });
    closeModal('add-ex-modal'); Router.route();
    return;
  }

  /* ── Settings ── */
  if (action==='set-weight-unit') {
    const s = DB.getSettings(); s.weightUnit=btn.dataset.unit; DB.saveSettings(s); Router.route(); return;
  }
  if (action==='set-distance-unit') {
    const s = DB.getSettings(); s.distanceUnit=btn.dataset.unit; DB.saveSettings(s); Router.route(); return;
  }

  if (action==='clear-all-data') {
    showConfirm('Clear All Data', 'Permanently delete all your workouts and settings?', async ()=>{
      await DB.clearAll();
      seedOrMigrate();
      Router.navigate('/onboarding');
    });
    return;
  }

  if (action==='backup-data') {
    DB.backup().then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `gymtracker-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    return;
  }

  if (action==='restore-data') {
    const input   = document.createElement('input');
    input.type    = 'file';
    input.accept  = '.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.exercises || !data.workouts) { alert('Invalid backup file.'); return; }
        if (!confirm('This will replace all current data. Continue?')) return;
        await DB.restore(data);
        location.reload();
      } catch (err) {
        alert('Restore failed: ' + err.message);
      }
    };
    input.click();
    return;
  }
}

function handleInput(e) {
  const el = e.target;
  const action = el.dataset.action;

  if (action==='set-field') {
    const { weid, setidx, field } = el.dataset;
    const wes = DB.getWorkoutExercises();
    const we  = wes.find(x=>x.id===weid);
    if (!we||!we.sets[setidx]) return;
    if (field==='duration') we.sets[setidx].duration = parseDurationInput(el.value);
    else we.sets[setidx][field] = el.value==='' ? null : parseFloat(el.value);
    DB.updateWorkoutExercise(we);
    return;
  }

  if (action==='settings-name-change') {
    const name = el.value.trim();
    if (!name) return;
    const user = DB.getUser();
    if (user) { user.name=name; DB.saveUser(user); }
    return;
  }
}

/* ═══════════════════════════════════════════════════════════════
   WORKOUT OPERATIONS
═══════════════════════════════════════════════════════════════ */
function createAndStartWorkout(cb) {
  const user = DB.getUser();
  const w = { id:uid(), userId:user?.id||null, startedAt:new Date().toISOString(), finishedAt:null, notes:'', exercises:[] };
  DB.addWorkout(w); DB.setActive(w.id);
  if (cb) cb(); else Router.navigate('/workout/new');
}

function addExerciseToWorkout(exId) {
  const workoutId = DB.getActive();
  if (!workoutId) return;
  const workout  = DB.getWorkoutById(workoutId);
  const ex       = DB.getExercises().find(e=>e.id===exId);
  if (!workout || !ex) return;
  const settings = DB.getSettings();
  const weId     = uid();
  const we = { id:weId, workoutId, exerciseDefId:exId, orderIndex:workout.exercises.length, sets:[makeDefaultSet(ex.category, settings, ex.subtype)] };
  DB.addWorkoutExercise(we);
  workout.exercises.push(weId);
  DB.updateWorkout(workout);
  Router.navigate('/workout/active');
}

function makeDefaultSet(category, settings, subtype) {
  if (subtype==='treadmill')   return { type:'cardio', subtype:'treadmill', setNumber:1, duration:null, distance:null, calories:null, vertGain:null, completed:false };
  if (category==='strength')   return { type:'strength',   setNumber:1, reps:null, weight:null, unit:settings.weightUnit||'kg', completed:false };
  if (category==='bodyweight') return { type:'bodyweight',  setNumber:1, reps:null, completed:false };
  return { type:'cardio', setNumber:1, duration:null, distance:null, distanceUnit:settings.distanceUnit||'km', completed:false };
}

function addSetToWorkoutExercise(weId) {
  const we  = DB.getWorkoutExercises().find(x=>x.id===weId);
  if (!we) return;
  const ex  = DB.getExercises().find(e=>e.id===we.exerciseDefId);
  const set = makeDefaultSet(ex?.category||'strength', DB.getSettings(), ex?.subtype);
  set.setNumber = we.sets.length+1;
  const last = we.sets[we.sets.length-1];
  if (last) {
    if (last.weight!=null)   set.weight=last.weight;
    if (last.reps!=null)     set.reps=last.reps;
    if (last.duration!=null) set.duration=last.duration;
    if (last.distance!=null) set.distance=last.distance;
    if (last.calories!=null) set.calories=last.calories;
    if (last.vertGain!=null) set.vertGain=last.vertGain;
  }
  we.sets.push(set);
  DB.updateWorkoutExercise(we);
  const container = document.querySelector(`.set-rows[data-weid="${weId}"]`);
  if (container) container.insertAdjacentHTML('beforeend', renderSetRow(set, we.sets.length-1, weId, ex?.category||'strength', DB.getSettings()));
}

function toggleSet(weId, setIdx) {
  const we = DB.getWorkoutExercises().find(x=>x.id===weId);
  if (!we||!we.sets[setIdx]) return;
  we.sets[setIdx].completed = !we.sets[setIdx].completed;
  DB.updateWorkoutExercise(we);
  document.querySelector(`.set-row[data-weid="${weId}"][data-setidx="${setIdx}"]`)?.classList.toggle('completed', we.sets[setIdx].completed);
  document.querySelector(`.set-check[data-weid="${weId}"][data-setidx="${setIdx}"]`)?.classList.toggle('done', we.sets[setIdx].completed);
}

function removeExerciseFromWorkout(weId) {
  const workoutId = DB.getActive();
  if (!workoutId) return;
  const workout = DB.getWorkoutById(workoutId);
  if (!workout) return;
  workout.exercises = workout.exercises.filter(id=>id!==weId);
  DB.updateWorkout(workout);
  _cache.workoutExercises = _cache.workoutExercises.filter(we=>we.id!==weId);
  dexieDB.workoutExercises.delete(weId);
  document.querySelector(`.exercise-card[data-weid="${weId}"]`)?.remove();
}

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
async function init() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});

  await DB.init();

  // Clean up any PIN data from old app version
  localStorage.removeItem('gym_tracker__pin');

  seedOrMigrate();

  const user = DB.getUser();
  if (!user) {
    Router.navigate('/onboarding');
  } else if (!window.location.hash || window.location.hash==='#') {
    Router.navigate('/home');
  }

  Router.init();
}

document.addEventListener('DOMContentLoaded', () => init().catch(console.error));
