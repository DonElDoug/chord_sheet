// Chord Progression App (Vanilla JS)
// Modern UI wired to index.html + styles.css

// ===== Constants =====
const SLOTS_PER_BAR = 4;
const ROMANS = ["I", "ii", "iii", "IV", "V", "vi", "viiø"];
const EXTENSIONS = ["", "7", "maj7", "m7", "6", "9", "11", "13", "sus2", "sus4", "add9", "dim", "ø7"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_TO_INDEX = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};

// ===== State =====
const state = {
  title: "",
  artist: "",
  key: "C",
  bpm: 100,
  showRoman: true,
  sections: [
    makeSection("Intro", 4),
    makeSection("Verse", 8),
    makeSection("Chorus", 8),
  ],
  // playback
  playing: false,
  playTimer: null,
  playheadRAF: null,
  playCursor: { flatIndex: 0, startedAt: 0, beatMs: 600 },
  audioCtx: null
};

function makeSection(name, bars) {
  return { id: cryptoId(), name, bars: Array.from({ length: bars }, makeBar) };
}
function makeBar() {
  return { slots: Array.from({ length: SLOTS_PER_BAR }, () => null), repeat: { kind: "none", count: 2 } };
}
function cryptoId() { return Math.random().toString(36).slice(2, 9); }

// ===== DOM =====
const els = {
  title: document.getElementById('songTitle'),
  artist: document.getElementById('songArtist'),
  key: document.getElementById('keySelect'),
  bpm: document.getElementById('bpmInput'),
  play: document.getElementById('playBtn'),
  stop: document.getElementById('stopBtn'),
  addSection: document.getElementById('addSectionBtn'),
  sections: document.getElementById('sectionsContainer'),
  chordMenu: document.getElementById('chordMenu'),
  extSelect: document.getElementById('extSelect'),
  slashInput: document.getElementById('slashInput'),
  saveChordMenu: document.getElementById('saveChordMenu'),
  deleteChordBtn: document.getElementById('deleteChordBtn'),
  closeChordMenu: document.getElementById('closeChordMenu'),
  romanToggle: document.getElementById('romanToggle'),
  playhead: document.getElementById('playhead')
};

// dynamic popovers
let romanOverlay = null; // { host, sIdx, bIdx, slot }
let repeatOverlay = null; // { host, sIdx, bIdx }
let editingCtx = null; // { sIdx, bIdx, slot }

// ===== Init =====
attachEvents();
render();

function attachEvents() {
  els.addSection.addEventListener('click', () => { state.sections.push(makeSection('New Section', 4)); render(); });
  els.key.addEventListener('change', () => { state.key = els.key.value; });
  els.bpm.addEventListener('input', () => { state.bpm = clamp(parseInt(els.bpm.value||"100",10), 30, 300); if (state.playing) restartPlayback(); });
  els.title.addEventListener('input', () => state.title = els.title.value);
  els.artist.addEventListener('input', () => state.artist = els.artist.value);

  els.play.addEventListener('click', startPlayback);
  els.stop.addEventListener('click', stopPlayback);
  els.romanToggle.addEventListener('change', () => { state.showRoman = els.romanToggle.checked; render(); });

  // chord menu
  els.closeChordMenu.addEventListener('click', closeChordMenu);
  els.saveChordMenu.addEventListener('click', saveChordMenu);
  els.deleteChordBtn.addEventListener('click', deleteChordFromMenu);

  // dismiss overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeRomanMenu();
      closeRepeatMenu();
      closeChordMenu();
      if (state.playing) { stopPlayback(); }
    }
  });
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

// ===== Render =====
function render() {
  els.sections.innerHTML = '';
  state.sections.forEach((section, sIdx) => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'section';

    // Head
    const head = document.createElement('div');
    head.className = 'section-head';

    const nameInput = document.createElement('input');
    nameInput.className = 'section-name';
    nameInput.value = section.name;
    nameInput.addEventListener('input', () => section.name = nameInput.value);
    head.appendChild(nameInput);

    const headActions = document.createElement('div');
    headActions.className = 'section-actions';

    const dblBtn = button('x2 bars', 'btn', () => { section.bars = section.bars.concat(section.bars.map(makeBar)); render(); });
    const addBarBtn = button('+ Bar', 'btn', () => { section.bars.push(makeBar()); render(); });
    const delBtn = button('🗑', 'btn danger', () => { state.sections.splice(sIdx,1); render(); });
    headActions.append(dblBtn, addBarBtn, delBtn);
    head.appendChild(headActions);

    // Body
    const body = document.createElement('div');
    body.className = 'section-body';

    section.bars.forEach((bar, bIdx) => {
      const barEl = document.createElement('div');
      barEl.className = 'bar';

      // Repeat handles
      const startHandle = document.createElement('div');
      startHandle.className = 'repeat-handle repeat-start' + (bar.repeat.kind === 'start' ? ' repeat-active' : '');
      startHandle.title = 'Toggle repeat start (‖:)';
      startHandle.innerHTML = '<span class="repeat-symbol">‖:</span>';
      startHandle.addEventListener('click', (e)=>{
        e.stopPropagation();
        bar.repeat.kind = (bar.repeat.kind === 'start') ? 'none' : 'start';
        render();
      });

      const endHandle = document.createElement('div');
      endHandle.className = 'repeat-handle repeat-end' + (bar.repeat.kind === 'end' ? ' repeat-active' : '');
      endHandle.title = 'Toggle repeat end (:‖ ×2/×3/×4)';
      endHandle.innerHTML = '<span class="repeat-symbol">:‖</span>';
      endHandle.addEventListener('click', (e)=>{
        e.stopPropagation();
        if (bar.repeat.kind !== 'end') { bar.repeat.kind = 'end'; bar.repeat.count = 2; }
        else {
          bar.repeat.count = bar.repeat.count === 4 ? 0 : (bar.repeat.count + 1);
          if (!bar.repeat.count) bar.repeat.kind = 'none';
        }
        render();
      });

      // Right-click bar opens repeat menu
      barEl.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
        openRepeatMenu(e.clientX, e.clientY, { sIdx, bIdx });
      });

      barEl.append(startHandle, endHandle);

      // Grid
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (let slot = 0; slot < SLOTS_PER_BAR; slot++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        slotEl.dataset.slot = slot;

        const chordObj = bar.slots[slot];
        if (chordObj) {
          const chordEl = document.createElement('div');
          chordEl.className = 'chord';
          chordEl.tabIndex = 0;

          const label = document.createElement('span');
          label.className = 'text';
          label.textContent = chordLabel(chordObj);
          chordEl.appendChild(label);

          const closeBtn = document.createElement('button');
          closeBtn.className = 'close';
          closeBtn.title = 'Clear this slot';
          closeBtn.textContent = '×';
          closeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); setSlot(sIdx,bIdx,slot,null); });
          chordEl.appendChild(closeBtn);

          // Right-click to edit ext/slash
          chordEl.addEventListener('contextmenu', (e)=>{
            e.preventDefault();
            openChordMenu({ sIdx, bIdx, slot }, chordObj);
          });

          // Click to change roman
          chordEl.addEventListener('click', (e)=>{
            e.stopPropagation();
            openRomanMenu(e.clientX, e.clientY, { sIdx, bIdx, slot });
          });

          slotEl.appendChild(chordEl);
        } else {
          const addBtn = document.createElement('button');
          addBtn.className = 'add';
          addBtn.textContent = 'add';
          addBtn.title = 'Click to add Roman chord';
          addBtn.addEventListener('click', (e)=>{
            e.stopPropagation();
            openRomanMenu(e.clientX, e.clientY, { sIdx, bIdx, slot });
          });
          slotEl.appendChild(addBtn);
        }

        grid.appendChild(slotEl);
      }

      // Bar controls under grid
      const controls = document.createElement('div');
      controls.className = 'bar-controls';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `Bar ${bIdx+1}`;
      controls.appendChild(badge);

      const delBar = button('🗑', 'badge', ()=>{ section.bars.splice(bIdx,1); render(); });
      controls.appendChild(delBar);

      barEl.appendChild(grid);
      barEl.appendChild(controls);
      body.appendChild(barEl);
    });

    sectionEl.appendChild(head);
    sectionEl.appendChild(body);
    els.sections.appendChild(sectionEl);
  });
}

function button(text, cls, onClick){ const b=document.createElement('button'); b.className=cls; b.textContent=text; b.addEventListener('click', onClick); return b; }

function chordLabel(ch) {
  const base = state.showRoman ? ch.roman : romanToLetter(ch.roman);
  const ext = ch.ext ? (state.showRoman ? ch.ext : ch.ext) : '';
  const slash = ch.slash ? `/${state.showRoman ? ch.slash : romanToLetter(ch.slash)}` : '';
  return `${base}${ext?(''+ext):''}${slash}`;
}

function setSlot(sIdx,bIdx,slot,val){ state.sections[sIdx].bars[bIdx].slots[slot]=val; render(); }

// ===== Menus =====
function openRomanMenu(x,y, ctx){
  closeRomanMenu();
  romanOverlay = ctx;
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.id = 'romanMenu';
  menu.innerHTML = `
    <div class="menu-content" style="position:relative;">
      <div class="menu-row"><strong>Choose Roman</strong></div>
      <div class="menu-row" style="display:flex;flex-wrap:wrap;gap:6px;">
        ${ROMANS.map(r=>`<button class="btn" data-r="${r}">${r}</button>`).join('')}
      </div>
      <div class="menu-actions"><button class="btn" id="closeRoman">Close</button></div>
    </div>`;
  document.body.appendChild(menu);
  // position near click by offsetting content
  const content = menu.querySelector('.menu-content');
  content.style.position = 'fixed';
  content.style.left = Math.max(12, x - 140) + 'px';
  content.style.top = Math.max(12, y - 40) + 'px';
  // actions
  menu.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id === 'closeRoman') { closeRomanMenu(); return; }
    const r = btn.getAttribute('data-r');
    if (r) {
      setSlot(ctx.sIdx, ctx.bIdx, ctx.slot, { roman: r, ext: '', slash: '' });
      closeRomanMenu();
    }
  });
  // click outside to close
  menu.addEventListener('mousedown', (e)=>{ if (e.target === menu) closeRomanMenu(); });
}
function closeRomanMenu(){ const m=document.getElementById('romanMenu'); if(m){ m.remove(); romanOverlay=null; } }

function openRepeatMenu(x,y, ctx){
  closeRepeatMenu();
  repeatOverlay = ctx;
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.id = 'repeatMenu';
  menu.innerHTML = `
    <div class="menu-content" style="position:relative;">
      <div class="menu-row"><strong>Repeat</strong></div>
      <div class="menu-row" style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" data-k="none">None</button>
        <button class="btn" data-k="start">‖:</button>
        <button class="btn" data-k="end" data-c="2">:‖ ×2</button>
        <button class="btn" data-k="end" data-c="3">:‖ ×3</button>
        <button class="btn" data-k="end" data-c="4">:‖ ×4</button>
      </div>
      <div class="menu-actions"><button class="btn" id="closeRepeat">Close</button></div>
    </div>`;
  document.body.appendChild(menu);
  const content = menu.querySelector('.menu-content');
  content.style.position = 'fixed';
  content.style.left = Math.max(12, x - 140) + 'px';
  content.style.top = Math.max(12, y - 40) + 'px';
  menu.addEventListener('click', (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.id === 'closeRepeat') { closeRepeatMenu(); return; }
    const k = btn.getAttribute('data-k');
    const c = parseInt(btn.getAttribute('data-c')||'2',10);
    const bar = state.sections[ctx.sIdx].bars[ctx.bIdx];
    if (k === 'none') bar.repeat = { kind:'none', count:2 };
    else if (k === 'start') bar.repeat = { kind:'start', count:2 };
    else if (k === 'end') bar.repeat = { kind:'end', count:c };
    closeRepeatMenu();
    render();
  });
  menu.addEventListener('mousedown', (e)=>{ if (e.target === menu) closeRepeatMenu(); });
}
function closeRepeatMenu(){ const m=document.getElementById('repeatMenu'); if(m){ m.remove(); repeatOverlay=null; } }

function openChordMenu(ctx, chord){
  editingCtx = { ...ctx };
  els.extSelect.value = chord.ext || '';
  els.slashInput.value = chord.slash || '';
  els.chordMenu.hidden = false;
}
function closeChordMenu(){ els.chordMenu.hidden = true; editingCtx = null; }
function saveChordMenu(){
  if (!editingCtx) return;
  const bar = state.sections[editingCtx.sIdx].bars[editingCtx.bIdx];
  const ch = bar.slots[editingCtx.slot];
  if (!ch) return closeChordMenu();
  ch.ext = els.extSelect.value || '';
  ch.slash = (els.slashInput.value || '').trim();
  closeChordMenu();
  render();
}
function deleteChordFromMenu(){ if (!editingCtx) return; setSlot(editingCtx.sIdx, editingCtx.bIdx, editingCtx.slot, null); closeChordMenu(); }

// ===== Playback =====
function startPlayback(){
  if (state.playing) return;
  state.playing = true;
  els.play.setAttribute('aria-pressed','true');
  els.play.disabled = true;
  els.stop.disabled = false;

  const beatMs = 60000 / state.bpm;
  state.playCursor.beatMs = beatMs;
  state.playCursor.flatIndex = 0;
  state.playCursor.startedAt = performance.now();

  scheduleBeat();
  animatePlayhead();
}
function stopPlayback(){
  state.playing = false;
  els.play.setAttribute('aria-pressed','false');
  els.play.disabled = false;
  els.stop.disabled = true;
  if (state.playTimer) { clearTimeout(state.playTimer); state.playTimer = null; }
  if (state.playheadRAF) { cancelAnimationFrame(state.playheadRAF); state.playheadRAF = null; }
  els.playhead.style.transform = 'translateX(-9999px)';
  els.playhead.style.display = 'none';
}
function restartPlayback(){ stopPlayback(); startPlayback(); }

function flattenSlots(){
  const arr = [];
  state.sections.forEach((sec, sIdx)=>{
    sec.bars.forEach((bar,bIdx)=>{
      for (let slot=0; slot<SLOTS_PER_BAR; slot++) {
        arr.push({ sIdx, bIdx, slot });
      }
    });
  });
  return arr;
}

function scheduleBeat(){
  if (!state.playing) return;
  const beats = flattenSlots();
  if (beats.length === 0) { stopPlayback(); return; }
  const idx = state.playCursor.flatIndex % beats.length;
  const { sIdx, bIdx, slot } = beats[idx];
  // play root note if chord exists
  const ch = state.sections[sIdx].bars[bIdx].slots[slot];
  if (ch) playRoot(ch.roman);
  state.playCursor.flatIndex++;
  state.playTimer = setTimeout(scheduleBeat, state.playCursor.beatMs);
}

function animatePlayhead(){
  if (!state.playing) return;
  els.playhead.style.display = 'block';
  const beats = flattenSlots();
  if (beats.length === 0) { els.playhead.style.display='none'; return; }

  const now = performance.now();
  const total = beats.length;
  // current fractional beat index
  const elapsed = (now - state.playCursor.startedAt) / state.playCursor.beatMs;
  const fracIndex = elapsed % total;
  const base = Math.floor(fracIndex);
  const t = fracIndex - base; // 0..1 within the current beat

  const a = beats[base];
  const b = beats[(base + 1) % total];
  const posA = slotPosition(a);
  const posB = slotPosition(b);
  const x = lerp(posA.x, posB.x, t);
  els.playhead.style.transform = `translateX(${x}px)`;

  state.playheadRAF = requestAnimationFrame(animatePlayhead);
}

function slotPosition(ref){
  // Return viewport x coordinate of slot center-left edge
  const sec = els.sections.children[ref.sIdx];
  if (!sec) return { x: -9999 };
  const body = sec.querySelector('.section-body');
  const bar = body.children[ref.bIdx];
  if (!bar) return { x: -9999 };
  const grid = bar.querySelector('.grid');
  const slotEl = grid.children[ref.slot];
  if (!slotEl) return { x: -9999 };
  const rect = slotEl.getBoundingClientRect();
  return { x: rect.left + 2 };
}

function lerp(a,b,t){ return a + (b-a)*t; }

// ===== Audio (root tone only) =====
function ensureAudioCtx(){ if (!state.audioCtx) state.audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return state.audioCtx; }
function playRoot(roman){
  const ctx = ensureAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  const note = romanToLetter(roman);
  const freq = noteToFreq(note, 4);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain); gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.01, now + (state.playCursor.beatMs/1000)*0.95);
  osc.start(now);
  osc.stop(now + (state.playCursor.beatMs/1000));
}

function romanToLetter(roman){
  const degree = ROMANS.indexOf(roman);
  if (degree < 0) return state.key;
  const keyIdx = NOTE_TO_INDEX[state.key] ?? 0;
  const rootIdx = (keyIdx + MAJOR_SCALE[degree]) % 12;
  return NOTES_SHARP[rootIdx];
}
function noteToFreq(note, octave){
  const idx = NOTE_TO_INDEX[note] ?? 0;
  const a4 = 440; // A4 index 9 at octave 4
  const semis = (octave - 4)*12 + (idx - 9);
  return a4 * Math.pow(2, semis/12);
}

// ===== Utilities =====
// Prevent native context menu on our interactive zones
window.addEventListener('contextmenu', (e)=>{
  if (e.target.closest('.bar') || e.target.closest('.chord')) {
    e.preventDefault();
  }
});
