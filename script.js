// Chord Progression App - Vanilla JS
// State: sections, bars, chords, key, BPM, playback

const state = {
  title: '',
  artist: '',
  key: 'C',
  bpm: 120,
  sections: [],
  playing: false,
  playhead: { section: 0, bar: 0, chord: 0 }
};

const chordsList = [
  'C', 'Cm', 'C7', 'Cm7', 'Cmaj7', 'C#', 'D', 'Dm', 'D7', 'Dm7', 'Dmaj7',
  'E', 'Em', 'E7', 'Em7', 'Emaj7', 'F', 'Fm', 'F7', 'Fm7', 'Fmaj7',
  'G', 'Gm', 'G7', 'Gm7', 'Gmaj7', 'A', 'Am', 'A7', 'Am7', 'Amaj7',
  'B', 'Bm', 'B7', 'Bm7', 'Bmaj7'
];

const extensions = ['7', 'maj7', 'm7', '6', '9', 'sus4', 'sus2', 'add9', 'dim', 'ø7'];

const sectionsDiv = document.getElementById('sections');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const addSectionBtn = document.getElementById('add-section-btn');
const keySelect = document.getElementById('key-select');
const bpmInput = document.getElementById('bpm-input');
const titleInput = document.getElementById('song-title');
const artistInput = document.getElementById('song-artist');
const playheadDiv = document.getElementById('playhead');

function render() {
  document.body.style.background = '#18181b';
  sectionsDiv.innerHTML = '';
  state.key = keySelect.value;
  state.bpm = parseInt(bpmInput.value, 10);
  state.title = titleInput.value;
  state.artist = artistInput.value;

  state.sections.forEach((section, sIdx) => {
    const sectionBlock = document.createElement('div');
    sectionBlock.className = 'section-block';

    // Section header
    const header = document.createElement('div');
    header.className = 'section-header';
    const title = document.createElement('input');
    title.value = section.name;
    title.className = 'section-title';
    title.setAttribute('aria-label', 'Section name');
    title.onchange = e => { section.name = e.target.value; render(); };
    header.appendChild(title);

    // Section controls
    const controls = document.createElement('div');
    controls.className = 'section-controls';
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete section';
    delBtn.onclick = () => { state.sections.splice(sIdx, 1); render(); };
    controls.appendChild(delBtn);

    const addBarBtn = document.createElement('button');
    addBarBtn.textContent = '+ Bar';
    addBarBtn.onclick = () => { section.bars.push({ chords: [], repeat: null }); render(); };
    controls.appendChild(addBarBtn);

    header.appendChild(controls);
    sectionBlock.appendChild(header);

    // Bars row
    const barsRow = document.createElement('div');
    barsRow.className = 'bars-row';
    section.bars.forEach((bar, bIdx) => {
      const barBox = document.createElement('div');
      barBox.className = 'bar-box';
      barBox.tabIndex = 0;
      barBox.setAttribute('aria-label', `Bar ${bIdx + 1} in ${section.name}`);

      // Repeat sign
      if (bar.repeat) {
        const repeat = document.createElement('span');
        repeat.className = 'repeat-sign';
        repeat.textContent = bar.repeat === 'start' ? '‖:' : ':‖';
        barBox.appendChild(repeat);
      }

      // Chord list
      const chordList = document.createElement('div');
      chordList.className = 'chord-list';
      bar.chords.forEach((chord, cIdx) => {
        const chordItem = document.createElement('span');
        chordItem.className = 'chord-item';
        chordItem.textContent = chord.name;
        if (chord.ext) {
          const ext = document.createElement('span');
          ext.className = 'ext';
          ext.textContent = chord.ext;
          chordItem.appendChild(ext);
        }
        if (chord.slash) {
          chordItem.textContent += '/' + chord.slash;
        }
        chordItem.onclick = () => editChord(bar, cIdx);
        chordList.appendChild(chordItem);
      });
      barBox.appendChild(chordList);

      // Chord controls
      const chordControls = document.createElement('div');
      chordControls.className = 'chord-controls';
      const addChordBtn = document.createElement('button');
      addChordBtn.textContent = '+ Chord';
      addChordBtn.onclick = () => addChord(bar);
      chordControls.appendChild(addChordBtn);

      barBox.appendChild(chordControls);

      // Bar controls
      const barControls = document.createElement('div');
      barControls.className = 'bar-controls';
      const delBarBtn = document.createElement('button');
      delBarBtn.textContent = '🗑';
      delBarBtn.onclick = () => { section.bars.splice(bIdx, 1); render(); };
      barControls.appendChild(delBarBtn);

      const repeatStartBtn = document.createElement('button');
      repeatStartBtn.textContent = '‖:';
      repeatStartBtn.onclick = () => { bar.repeat = bar.repeat === 'start' ? null : 'start'; render(); };
      barControls.appendChild(repeatStartBtn);

      const repeatEndBtn = document.createElement('button');
      repeatEndBtn.textContent = ':‖';
      repeatEndBtn.onclick = () => { bar.repeat = bar.repeat === 'end' ? null : 'end'; render(); };
      barControls.appendChild(repeatEndBtn);

      barBox.appendChild(barControls);

      barsRow.appendChild(barBox);
    });
    sectionBlock.appendChild(barsRow);
    sectionsDiv.appendChild(sectionBlock);
  });
}

function addSection() {
  state.sections.push({ name: 'New Section', bars: [] });
  render();
}

function addChord(bar) {
  // Simple prompt for chord name, extension, slash
  let name = prompt('Chord name (e.g. C, Dm, G7):', 'C');
  if (!name) return;
  let ext = prompt('Extension (optional, e.g. 7, maj7):', '');
  let slash = prompt('Slash chord (optional, e.g. G):', '');
  bar.chords.push({ name, ext, slash });
  render();
}

function editChord(bar, idx) {
  let chord = bar.chords[idx];
  let name = prompt('Edit chord name:', chord.name);
  if (!name) return;
  let ext = prompt('Edit extension:', chord.ext || '');
  let slash = prompt('Edit slash chord:', chord.slash || '');
  bar.chords[idx] = { name, ext, slash };
  render();
}

addSectionBtn.onclick = addSection;
keySelect.onchange = render;
bpmInput.onchange = render;
titleInput.oninput = render;
artistInput.oninput = render;

// Playback logic
let playInterval = null;
playBtn.onclick = () => {
  if (state.playing) return;
  state.playing = true;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  startPlayback();
};
stopBtn.onclick = () => {
  state.playing = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
  stopPlayback();
};

function startPlayback() {
  let bars = [];
  state.sections.forEach(section => bars.push(...section.bars));
  let totalBars = bars.length;
  let barIdx = 0;
  playheadDiv.style.display = 'block';
  playheadDiv.style.position = 'absolute';

  function movePlayhead() {
    if (!state.playing || barIdx >= totalBars) {
      stopPlayback();
      return;
    }
    // Find bar element
    let barBoxes = document.querySelectorAll('.bar-box');
    if (barBoxes[barIdx]) {
      let rect = barBoxes[barIdx].getBoundingClientRect();
      let containerRect = sectionsDiv.getBoundingClientRect();
      playheadDiv.style.top = (rect.top - containerRect.top) + 'px';
      playheadDiv.style.left = (rect.left - containerRect.left) + 'px';
      playheadDiv.style.height = rect.height + 'px';
    }
    // Play root note (Web Audio API)
    let bar = bars[barIdx];
    if (bar.chords.length > 0) {
      playChordAudio(bar.chords[0].name);
    }
    barIdx++;
  }
  movePlayhead();
  playInterval = setInterval(movePlayhead, 60000 / state.bpm);
}

function stopPlayback() {
  state.playing = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
  playheadDiv.style.display = 'none';
  if (playInterval) clearInterval(playInterval);
}

function playChordAudio(chordName) {
  // Simple root note playback
  const noteFreqs = {
    'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63,
    'F': 349.23, 'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00,
    'A#': 466.16, 'B': 493.88
  };
  let root = chordName.replace(/[^A-G#]/g, '');
  let freq = noteFreqs[root] || 261.63;
  let ctx = window._audioCtx || (window._audioCtx = new (window.AudioContext || window.webkitAudioContext)());
  let osc = ctx.createOscillator();
  let gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
  osc.onended = () => gain.disconnect();
}

render();
