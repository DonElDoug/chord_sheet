/* ===========
   Chord Progression App (Vanilla JS)
   - Sections, Bars, Chords
   - Roman numerals + extensions + slash chords
   - Repeat signs
   - Playback with simple root notes (Web Audio API)
   - Playhead animation
   =========== */

/* -------------------------
   DATA MODEL & STATE
-------------------------- */
const defaultSong = {
  title: "",
  artist: "",
  key: "C",         // Major keys
  bpm: 100,
  sections: [
    {
      id: uid(),
      name: "Intro",
      bars: [makeEmptyBar(), makeEmptyBar(), makeEmptyBar(), makeEmptyBar()]
    }
  ]
};

// Load from localStorage if present
const saved = safeRead("cpa_song_v1");
const song = saved || structuredClone(defaultSong);

// Working refs for context menu
let chordMenuRef = null; // { sectionId, barId, beatIndex }
let showingRoman = true;

// Simple Audio context (lazily created)
let audioCtx = null;
let playState = { playing:false, startTime:0, rafId:null };

/* -------------------------
   UTILITIES
-------------------------- */
function uid(){ return Math.random().toString(36).slice(2,9) }
function makeEmptyBar(){
  return { id: uid(), beats: [null, null, null, null], repeatStart:false, repeatEnd:false };
}
function safeWrite(key, obj){ try{ localStorage.setItem(key, JSON.stringify(obj)) }catch(e){} }
function safeRead(key){ try{ const v = localStorage.getItem(key); return v? JSON.parse(v): null }catch(e){ return null } }

/* Roman base set we accept */
const ROMANS = ["I","ii","iii","IV","V","vi","vii°"];
/* Extensions list reflected in UI */
const EXTENSIONS = ["","maj7","7","m7","dim","aug","sus2","sus4","add9"];

/* Key to semitones mapping (C major degrees). We’ll transpose per key root. */
const DEGREE_TO_SEMITONES = { // relative to tonic
  "I":0, "ii":2, "iii":4, "IV":5, "V":7, "vi":9, "vii°":11
};
/* Key roots (major) to semitone from C */
const KEY_TO_SEMITONE = {
  "C":0,"Db":1,"D":2,"Eb":3,"E":4,"F":5,"Gb":6,"G":7,"Ab":8,"A":9,"Bb":10,"B":11
};
/* Semitone to note name (prefer sharps for simplicity) */
const SEMI_TO_NOTE = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

/* -------------
   DOM HOOKS
--------------- */
const sectionsContainer = document.getElementById("sectionsContainer");
const addSectionBtn = document.getElementById("addSectionBtn");
const songTitle = document.getElementById("songTitle");
const songArtist = document.getElementById("songArtist");
const keySelect = document.getElementById("keySelect");
const bpmInput = document.getElementById("bpmInput");
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const chordMenu = document.getElementById("chordMenu");
const extSelect = document.getElementById("extSelect");
const slashInput = document.getElementById("slashInput");
const saveChordMenuBtn = document.getElementById("saveChordMenu");
const deleteChordBtn = document.getElementById("deleteChordBtn");
const closeChordMenuBtn = document.getElementById("closeChordMenu");
const romanToggle = document.getElementById("romanToggle");
const playheadEl = document.getElementById("playhead");

/* -------------------------
   INIT & BINDINGS
-------------------------- */
// Seed header inputs
songTitle.value = song.title;
songArtist.value = song.artist;
keySelect.value = song.key;
bpmInput.value = song.bpm;
romanToggle.checked = true;

renderAll();
bindHeader();
bindGlobal();

/* -------------------------
   RENDER FUNCTIONS
-------------------------- */
function renderAll(){
  // Save every render
  safeWrite("cpa_song_v1", song);

  sectionsContainer.innerHTML = "";
  song.sections.forEach((sec) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "section";
    sectionEl.dataset.sectionId = sec.id;

    // Section head
    const head = document.createElement("div");
    head.className = "section-head";

    const nameInput = document.createElement("input");
    nameInput.className = "section-name";
    nameInput.value = sec.name;
    nameInput.setAttribute("aria-label", "Section name");
    nameInput.addEventListener("change", () => {
      sec.name = nameInput.value.trim() || "Section";
      renderAll();
    });

    const actions = document.createElement("div");
    actions.className = "section-actions";

    const addBarBtn = btn("+ Add Bar","btn outline", () => {
      sec.bars.push(makeEmptyBar());
      renderAll();
    });

    const delSectionBtn = btn("Delete Section","btn danger", () => {
      if (confirm(`Delete section "${sec.name}"?`)) {
        song.sections = song.sections.filter(s => s.id !== sec.id);
        renderAll();
      }
    });

    actions.append(addBarBtn, delSectionBtn);
    head.append(nameInput, actions);
    sectionEl.appendChild(head);

    // Section body (bars lane)
    const body = document.createElement("div");
    body.className = "section-body";

    sec.bars.forEach((bar) => {
      body.appendChild(renderBar(sec.id, bar));
    });

    sectionEl.appendChild(body);
    sectionsContainer.appendChild(sectionEl);
  });
}

function renderBar(sectionId, bar){
  const barEl = document.createElement("div");
  barEl.className = "bar";
  barEl.dataset.barId = bar.id;

  // Top-left badges (delete bar)
  const controls = document.createElement("div");
  controls.className = "bar-controls";

  const del = document.createElement("button");
  del.className = "badge";
  del.textContent = "×";
  del.title = "Delete bar";
  del.addEventListener("click", () => {
    const sec = song.sections.find(s => s.id === sectionId);
    sec.bars = sec.bars.filter(b => b.id !== bar.id);
    renderAll();
  });
  controls.appendChild(del);
  barEl.appendChild(controls);

  // Repeat handles
  const startHandle = document.createElement("div");
  startHandle.className = "repeat-handle repeat-start" + (bar.repeatStart ? " repeat-active" : "");
  startHandle.title = "Toggle repeat start (‖:)";
  startHandle.innerHTML = `<span class="repeat-symbol">‖:</span>`;
  startHandle.addEventListener("click", () => {
    bar.repeatStart = !bar.repeatStart; renderAll();
  });

  const endHandle = document.createElement("div");
  endHandle.className = "repeat-handle repeat-end" + (bar.repeatEnd ? " repeat-active" : "");
  endHandle.title = "Toggle repeat end (:‖)";
  endHandle.innerHTML = `<span class="repeat-symbol">:‖</span>`;
  endHandle.addEventListener("click", () => {
    bar.repeatEnd = !bar.repeatEnd; renderAll();
  });

  barEl.append(startHandle, endHandle);

  // Grid (4 beats)
  const grid = document.createElement("div");
  grid.className = "grid";

  bar.beats.forEach((chord, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.beatIndex = i;

    if (!chord){
      const addBtn = document.createElement("button");
      addBtn.className = "add";
      addBtn.textContent = "+";
      addBtn.title = "Add chord at this beat";
      addBtn.addEventListener("click", () => addChordPrompt(sectionId, bar.id, i));
      slot.appendChild(addBtn);
    } else {
      const chordEl = renderChord(chord);
      // Position chord absolutely inside the slot rect
      slot.style.position = "relative";
      chordEl.style.position = "absolute";
      chordEl.style.inset = "0 0 0 0";
      // Right-click / mobile ...
      chordEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openChordMenu({sectionId, barId:bar.id, beatIndex:i}, chord);
      });
      // “...” button for touch
      const more = document.createElement("button");
      more.className = "close";
      more.textContent = "…";
      more.title = "Edit chord";
      more.addEventListener("click", () => openChordMenu({sectionId, barId:bar.id, beatIndex:i}, chord));
      chordEl.appendChild(more);

      // Delete small x (visible on hover)
      const close = document.createElement("button");
      close.className = "close";
      close.textContent = "x";
      close.title = "Remove chord";
      close.addEventListener("click", () => {
        bar.beats[i] = null; renderAll();
      });
      chordEl.appendChild(close);

      slot.appendChild(chordEl);
    }
    grid.appendChild(slot);
  });

  barEl.appendChild(grid);
  return barEl;
}

function renderChord(ch){
  const el = document.createElement("div");
  el.className = "chord";
  const label = showingRoman ? chordToLabelRoman(ch) : chordToLabelSpelled(ch, song.key);
  el.innerHTML = `<span class="text">${label}</span>`;
  return el;
}

function chordToLabelRoman(ch){
  const base = ch.roman;
  const ext = ch.ext ? (formatExt(base, ch.ext)) : "";
  const slash = ch.slash ? `/${ch.slash}` : "";
  return `${base}${ext}${slash}`;
}
function formatExt(base, ext){
  // Display “maj7” as maj7; make minor 7 written as m7 only if roman was minor (ii, iii, vi)
  return ext; // already set as 'maj7','7','m7','dim','aug','sus2','sus4','add9'
}

/* Convert to spelled chord name (e.g., in key of C, Imaj7 => Cmaj7) */
function chordToLabelSpelled(ch, key){
  const rootSemi = (KEY_TO_SEMITONE[key] + DEGREE_TO_SEMITONES[ch.roman]) % 12;
  const note = SEMI_TO_NOTE[rootSemi];
  const ext = ch.ext || "";
  const slash = ch.slash ? `/${resolveSlashNote(ch.slash, key)}` : "";
  return `${note}${ext}${slash}`;
}

/* Slash e.g., 'V' => spelled note in key */
function resolveSlashNote(roman, key){
  const r = roman.trim();
  if (!DEGREE_TO_SEMITONES.hasOwnProperty(r)) return r; // if user typed a note like 'E'
  const sem = (KEY_TO_SEMITONE[key] + DEGREE_TO_SEMITONES[r]) % 12;
  return SEMI_TO_NOTE[sem];
}

/* -------------------------
   INTERACTIONS
-------------------------- */
function btn(text, cls, onClick){
  const b = document.createElement("button");
  b.className = cls; b.textContent = text; b.addEventListener("click", onClick);
  return b;
}

addSectionBtn.addEventListener("click", () => {
  song.sections.push({ id:uid(), name:`Section ${song.sections.length+1}`, bars:[makeEmptyBar(), makeEmptyBar(), makeEmptyBar(), makeEmptyBar()] });
  renderAll();
});

function addChordPrompt(sectionId, barId, beatIndex){
  // Simple prompt for base roman numeral (I, ii, iii, IV, V, vi, vii°)
  const val = prompt("Enter Roman numeral (I, ii, iii, IV, V, vi, vii°)", "I");
  if (!val) return;
  const base = val.trim();
  if (!ROMANS.includes(base)){ alert("Invalid Roman numeral."); return; }
  const sec = song.sections.find(s => s.id === sectionId);
  const bar = sec.bars.find(b => b.id === barId);
  bar.beats[beatIndex] = { roman:base, ext:"", slash:"" };
  renderAll();
}

/* Header bindings and persistence */
function bindHeader(){
  songTitle.addEventListener("input", () => { song.title = songTitle.value; safeWrite("cpa_song_v1", song); });
  songArtist.addEventListener("input", () => { song.artist = songArtist.value; safeWrite("cpa_song_v1", song); });
  keySelect.addEventListener("change", () => { song.key = keySelect.value; renderAll(); });
  bpmInput.addEventListener("change", () => { song.bpm = clamp(parseInt(bpmInput.value)||100, 30, 300); bpmInput.value = song.bpm; safeWrite("cpa_song_v1", song); });

  playBtn.addEventListener("click", startPlayback);
  stopBtn.addEventListener("click", stopPlayback);

  romanToggle.addEventListener("change", () => {
    showingRoman = romanToggle.checked;
    renderAll();
  });
}

function bindGlobal(){
  // Close chord menu on backdrop click or Esc
  chordMenu.addEventListener("click", (e) => {
    if (e.target === chordMenu) closeChordMenu();
  });
  closeChordMenuBtn.addEventListener("click", closeChordMenu);
  saveChordMenuBtn.addEventListener("click", saveChordMenu);
  deleteChordBtn.addEventListener("click", deleteChordViaMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeChordMenu();
  });
}

function openChordMenu(ref, chord){
  chordMenuRef = ref;
  extSelect.value = chord.ext || "";
  slashInput.value = chord.slash || "";
  chordMenu.hidden = false;
}

function closeChordMenu(){
  chordMenu.hidden = true;
  chordMenuRef = null;
}

function saveChordMenu(){
  if (!chordMenuRef) return;
  const {sectionId, barId, beatIndex} = chordMenuRef;
  const sec = song.sections.find(s => s.id === sectionId);
  const bar = sec.bars.find(b => b.id === barId);
  const ch = bar.beats[beatIndex];
  ch.ext = extSelect.value;
  ch.slash = slashInput.value.trim();
  closeChordMenu();
  renderAll();
}

function deleteChordViaMenu(){
  if (!chordMenuRef) return;
  const {sectionId, barId, beatIndex} = chordMenuRef;
  const sec = song.sections.find(s => s.id === sectionId);
  const bar = sec.bars.find(b => b.id === barId);
  bar.beats[beatIndex] = null;
  closeChordMenu();
  renderAll();
}

/* -------------------------
   PLAYBACK & PLAYHEAD
-------------------------- */
function startPlayback(){
  if (playState.playing) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const { timeline, positions } = buildTimeline(); // array of events with timings
  if (timeline.length === 0){ alert("No chords to play."); return; }

  playState.playing = true;
  playBtn.setAttribute("aria-pressed", "true");
  // Scroll to start
  window.scrollTo({ top:0, left:0, behavior:"smooth" });
  // Audio start time
  const now = audioCtx.currentTime + 0.05;
  playState.startTime = now;

  // Schedule tones
  const secondsPerBeat = 60 / (song.bpm || 100);
  timeline.forEach(ev => {
    const t = now + ev.beatTime * secondsPerBeat;
    scheduleBeep(ev.chord, t, secondsPerBeat * ev.beatsLength);
  });

  // Animate playhead
  animatePlayhead(positions, now, secondsPerBeat, timeline);

  // Auto stop after the last event
  const totalBeats = timeline.length ? (timeline[timeline.length-1].beatTime + timeline[timeline.length-1].beatsLength) : 0;
  const totalSeconds = totalBeats * secondsPerBeat;
  setTimeout(() => { stopPlayback() }, totalSeconds * 1000 + 200);
}

function stopPlayback(){
  if (!playState.playing) return;
  playState.playing = false;
  playBtn.setAttribute("aria-pressed", "false");
  // Stop playhead
  if (playState.rafId) cancelAnimationFrame(playState.rafId);
  playheadEl.style.transform = "translateX(-9999px)";
}

function scheduleBeep(chord, startTime, duration){
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  const freq = chordRootFrequency(chord, song.key);
  osc.frequency.value = freq;
  // simple ADSR-ish
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.12, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.95);

  osc.connect(gain).connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

/* Build timeline by flattening sections/bars/beats into events with beatTime offsets.
   Each bar = 4 beats, each beat slot is 1 beat long here (simple). Repeat signs here are visual only (no loop logic yet). */
function buildTimeline(){
  const events = [];
  const positions = []; // mapping from beatTime to viewport x position
  let beatCursor = 0;
  const sectionEls = [...document.querySelectorAll(".section")];

  song.sections.forEach((sec, sIdx) => {
    const secEl = sectionEls[sIdx];
    const barEls = secEl.querySelectorAll(".bar");
    sec.bars.forEach((bar, bIdx) => {
      const barEl = barEls[bIdx];
      // Slots
      for (let i=0; i<4; i++){
        const ch = bar.beats[i];
        if (ch){
          events.push({ beatTime: beatCursor + i, beatsLength: 1, chord: ch, domRef:{barEl, slotIndex:i} });
        }
        // store x position of each beat for playhead mapping
        const slot = barEl.querySelector(`.slot:nth-child(${i+1})`);
        const rect = slot.getBoundingClientRect();
        const pageX = rect.left + window.scrollX + rect.width/2;
        positions.push({ beatTime: beatCursor + i, pageX });
      }
      beatCursor += 4;
    });
  });

  return { timeline: events, positions };
}

function animatePlayhead(positions, startTime, spb, timeline){
  const firstX = positions.length ? positions[0].pageX : 0;
  if (firstX) {
    playheadEl.style.transform = `translateX(${firstX}px)`;
  }

  const lastBeatTime = positions.length ? positions[positions.length-1].beatTime + 1 : 0;

  function frame(){
    if (!playState.playing) return;
    const elapsedSec = (audioCtx.currentTime - startTime);
    const currentBeat = elapsedSec / spb;

    // Find nearest position
    if (positions.length){
      // linear interpolate x across beats
      const floorBeat = Math.floor(currentBeat);
      const nextBeat = Math.min(floorBeat + 1, positions.length-1);
      const a = positions.find(p => p.beatTime === floorBeat) || positions[0];
      const b = positions.find(p => p.beatTime === nextBeat) || positions[positions.length-1];
      const t = currentBeat - floorBeat;
      const x = a.pageX + (b.pageX - a.pageX) * t;
      playheadEl.style.transform = `translateX(${x}px)`;
    }

    if (currentBeat >= lastBeatTime){
      stopPlayback();
      return;
    }
    playState.rafId = requestAnimationFrame(frame);
  }
  playState.rafId = requestAnimationFrame(frame);
}

/* Frequency helpers */
function chordRootFrequency(ch, key){
  // Middle C4 = 261.63. We’ll map all roots into 4th octave roughly.
  const semiFromC = (KEY_TO_SEMITONE[key] + DEGREE_TO_SEMITONES[ch.roman]) % 12;
  const noteFreq = semiToFreq(semiFromC, 4); // octave 4
  // If slash bass provided as roman, we can use that as root instead
  if (ch.slash && DEGREE_TO_SEMITONES[ch.slash] !== undefined){
    const s2 = (KEY_TO_SEMITONE[key] + DEGREE_TO_SEMITONES[ch.slash]) % 12;
    return semiToFreq(s2, 3); // put bass slightly lower
  }
  return noteFreq;
}
function semiToFreq(semiFromC, octave){
  // C0 = 16.35Hz; formula: f = 16.3516 * 2^(octave) * 2^(semi/12)
  const c0 = 16.3516;
  return c0 * Math.pow(2, octave) * Math.pow(2, semiFromC/12);
}

/* -------------------------
   HELPERS
-------------------------- */
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)) }

/* -------------------------
   END
-------------------------- */
