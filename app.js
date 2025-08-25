/**
 * Chord Progression Application
 * 
 * A vanilla JS web app for creating, playing, and sharing chord progressions.
 * Features:
 * - Section-based arrangement
 * - 4x4 grid for bars and slots
 * - Inline, context-aware chord editing (left-click for root, right-click for extension)
 * - Web Audio API playback with BPM and Key control
 * - LocalStorage persistence
 * - JSON Import/Export
 * - Clean, modern, dark UI
 */

// ===== APPLICATION CLASS =====
class ChordProgressionApp {
  constructor() {
    this.progression = this.getDefaultProgression();
    this.activeSectionId = null;
    this.isPlaying = false;
    this.playInterval = null;
    this.audioContext = null;
    this.currentEdit = null;
    this.saveTimeout = null;
    this.currentBarIndex = 0;

    this.init();
  }

  init() {
    this.initAudio();
    this.loadFromStorage();
    this.setupEventListeners();
    
    if (this.progression.sections.length === 0) {
      this.addSection();
    } else {
      // If we have sections, make the first one active
      this.activeSectionId = this.progression.sections[0]?.id;
    }
    this.render();
  }

  // ===== DATA & STATE MANAGEMENT =====
  getDefaultProgression() {
    return {
      title: "Untitled Progression",
      artist: "Artist Name",
      key: "C",
      bpm: 120,
      sections: []
    };
  }

  saveToStorage() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem('chordProgression', JSON.stringify(this.progression));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }, 200);
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('chordProgression');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.sections)) {
          this.progression = { ...this.getDefaultProgression(), ...parsed };
          this.activeSectionId = this.progression.sections[0]?.id;
        }
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
      this.progression = this.getDefaultProgression();
    }
  }

  updateProgressionField(field, value) {
    if (field in this.progression) {
      this.progression[field] = value;
      this.saveToStorage();
    }
  }

  setActiveSection(sectionId) {
    this.activeSectionId = sectionId;
    this.render();
  }

  getActiveSection() {
    return this.progression.sections.find(s => s.id === this.activeSectionId);
  }

  // ===== AUDIO SYSTEM (omitted for brevity, assuming no changes) =====
  initAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported. Playback will be disabled.');
    }
  }

  getNoteFrequency(note) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const key = this.progression.key.replace('b', '#'); // Normalize flats to sharps for simplicity
    const keyIndex = notes.indexOf(key.endsWith('#') ? key.slice(0, 2) : key.slice(0, 1));
    
    const noteIndex = notes.indexOf(note);
    let octave = 4;
    if (noteIndex < keyIndex) octave++;

    return 440 * Math.pow(2, (noteIndex - 9 + (octave - 4) * 12) / 12);
  }

  getChordFrequencies(roman) {
    const scaleDegrees = {
      'I': 0, 'ii': 2, 'iii': 4, 'IV': 5, 'V': 7, 'vi': 9, 'vii°': 11
    };
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyIndex = notes.indexOf(this.progression.key.charAt(0));

    const rootDegree = scaleDegrees[roman];
    if (rootDegree === undefined) return [];

    const rootNoteIndex = (keyIndex + rootDegree) % 12;
    const thirdNoteIndex = (rootNoteIndex + (roman === roman.toLowerCase() ? 3 : 4)) % 12; // Minor or Major third
    const fifthNoteIndex = (rootNoteIndex + 7) % 12;

    return [
      this.getNoteFrequency(notes[rootNoteIndex]),
      this.getNoteFrequency(notes[thirdNoteIndex]),
      this.getNoteFrequency(notes[fifthNoteIndex])
    ];
  }

  playChord(chord) {
    if (!this.audioContext || !chord || !chord.root) return;
    
    const frequencies = this.getChordFrequencies(chord.root);
    if (frequencies.length === 0) return;

    const playTime = this.audioContext.currentTime;
    const duration = (60 / this.progression.bpm) * 0.8; // Play for 80% of a beat

    frequencies.forEach(freq => {
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, playTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, playTime + duration);

      osc.start(playTime);
      osc.stop(playTime + duration);
    });
  }


  // ===== PLAYBACK CONTROLS =====
  togglePlayback() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    this.isPlaying ? this.stopPlayback() : this.startPlayback();
  }

  startPlayback() {
    const activeSection = this.getActiveSection();
    if (!activeSection || activeSection.bars.length === 0) return;

    this.isPlaying = true;
    this.updatePlayButton();
    this.currentBarIndex = 0;

    const beatDuration = 60 / this.progression.bpm;
    const barDurationMs = beatDuration * 4 * 1000;

    const tick = () => {
      const bar = activeSection.bars[this.currentBarIndex];
      this.highlightBar(bar.id);
      
      const chordToPlay = bar.chords.find(c => c);
      if (chordToPlay) {
        this.playChord(chordToPlay);
      }

      this.currentBarIndex++;
      if (this.currentBarIndex >= activeSection.bars.length) {
        // Handle repeats
        const lastBar = activeSection.bars[activeSection.bars.length - 1];
        if (lastBar.repeatEnd) {
          const repeatStartIndex = activeSection.bars.findIndex(b => b.repeatStart);
          this.currentBarIndex = repeatStartIndex !== -1 ? repeatStartIndex : 0;
          // Play again immediately
          tick();
          return;
        }
        this.stopPlayback();
      }
    };

    tick();
    if (this.isPlaying) {
      this.playInterval = setInterval(tick, barDurationMs);
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    this.updatePlayButton();
    this.clearHighlights();
  }

  updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    if (!playBtn) return;
    
    const playIcon = playBtn.querySelector('.play-icon-path');
    const pauseIcon = playBtn.querySelector('.pause-icon-path');
    const text = playBtn.querySelector('.play-text');

    if (this.isPlaying) {
      playBtn.classList.add('playing');
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      text.textContent = 'Pause';
    } else {
      playBtn.classList.remove('playing');
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      text.textContent = 'Play';
    }
  }

  highlightBar(barId) {
    this.clearHighlights();
    const barEl = document.querySelector(`.bar[data-id="${barId}"]`);
    if (barEl) {
      const firstSlot = barEl.querySelector('.slot');
      if (firstSlot) {
        firstSlot.classList.add('playing');
      }
    }
  }

  clearHighlights() {
    document.querySelectorAll('.slot.playing').forEach(el => el.classList.remove('playing'));
  }

  // ===== DOM MANIPULATION & RENDERING =====
  render() {
    this.renderSongInfo();
    this.renderSectionList();
    this.renderBars();
    this.saveToStorage();
  }

  renderSongInfo() {
    document.getElementById('songTitle').value = this.progression.title;
    document.getElementById('songArtist').value = this.progression.artist;
    document.getElementById('keySelect').value = this.progression.key;
    document.getElementById('bpmInput').value = this.progression.bpm;
  }

  renderSectionList() {
    const sectionListContainer = document.querySelector('.section-list');
    sectionListContainer.innerHTML = '';
    this.progression.sections.forEach(section => {
      const itemEl = document.createElement('div');
      itemEl.className = 'section-list-item';
      itemEl.dataset.id = section.id;
      if (section.id === this.activeSectionId) {
        itemEl.classList.add('active');
      }
      
      itemEl.innerHTML = `
        <input class="section-item-name" value="${section.name}" data-action="update-section-name" placeholder="Section Name" />
        <button class="header-btn icon-btn delete-section-btn" data-action="delete-section" title="Delete Section">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      `;
      sectionListContainer.appendChild(itemEl);
    });
  }

  renderBars() {
    const barsContainer = document.querySelector('.bars-container');
    barsContainer.innerHTML = '';
    const activeSection = this.getActiveSection();

    if (!activeSection) {
      barsContainer.innerHTML = `
        <div class="no-section-selected">
          <p>Select a section on the left to view its bars, or add a new one.</p>
        </div>`;
      return;
    }

    activeSection.bars.forEach((bar, index) => {
      const barEl = this.createBarElement(activeSection.id, bar, index + 1);
      barsContainer.appendChild(barEl);
    });
  }

  createBarElement(sectionId, bar, barNumber) {
    const barEl = document.createElement('div');
    barEl.className = 'bar';
    barEl.dataset.id = bar.id;
    if (bar.repeatStart) barEl.classList.add('repeat-start');
    if (bar.repeatEnd) barEl.classList.add('repeat-end');

    barEl.innerHTML = `
      <div class="bar-header">
        <div class="bar-number">${barNumber}</div>
        <div class="bar-controls">
          <button class="repeat-btn ${bar.repeatStart ? 'active' : ''}" data-action="toggle-repeat-start" title="Toggle Repeat Start">||:</button>
          <button class="repeat-btn ${bar.repeatEnd ? 'active' : ''}" data-action="toggle-repeat-end" title="Toggle Repeat End">:||</button>
        </div>
      </div>
      <div class="slots">
        ${bar.chords.map((chord, slotIndex) => this.createSlotHTML(sectionId, bar.id, slotIndex, chord)).join('')}
      </div>
      ${bar.repeatStart ? '<div class="repeat-sign repeat-start-sign">||:</div>' : ''}
      ${bar.repeatEnd ? '<div class="repeat-sign repeat-end-sign">:||</div>' : ''}
    `;
    return barEl;
  }

  createSlotHTML(sectionId, barId, slotIndex, chord) {
    const hasChord = chord && chord.root;
    return `
      <div class="slot ${hasChord ? 'has-chord' : ''}" data-section-id="${sectionId}" data-bar-id="${barId}" data-slot-index="${slotIndex}">
        ${hasChord
          ? `
            <div class="chord-display">
              <span class="chord-name">${this.getDisplayChord(chord)}</span>
              ${chord.extension ? `<sup class="chord-extension">${chord.extension}</sup>` : ''}
            </div>
            <button class="delete-chord-btn" data-action="delete-chord" title="Delete Chord">×</button>
          `
          : '<div class="add-chord-placeholder">+</div>'
        }
      </div>
    `;
  }

  getDisplayChord(chord) {
    return chord.root;
  }

  // ===== ACTIONS (triggered by events) =====
  addSection() {
    const newSection = {
      id: `s_${Date.now()}`,
      name: `Section ${this.progression.sections.length + 1}`,
      bars: Array.from({ length: 4 }, () => this.createEmptyBar())
    };
    this.progression.sections.push(newSection);
    this.activeSectionId = newSection.id;
    this.render();
  }

  deleteSection(sectionId) {
    if (confirm('Are you sure you want to delete this section?')) {
      this.progression.sections = this.progression.sections.filter(s => s.id !== sectionId);
      if (this.activeSectionId === sectionId) {
        this.activeSectionId = this.progression.sections[0]?.id || null;
      }
      this.render();
    }
  }

  updateSectionName(sectionId, newName) {
    const section = this.progression.sections.find(s => s.id === sectionId);
    if (section) {
      section.name = newName;
      this.saveToStorage();
    }
  }

  toggleRepeat(barId, type) {
    const section = this.getActiveSection();
    const bar = section?.bars.find(b => b.id === barId);
    if (bar) {
      bar[type] = !bar[type];
      this.renderBars();
      this.saveToStorage();
    }
  }

  createEmptyBar() {
    return {
      id: `b_${Date.now()}_${Math.random()}`,
      chords: [null, null, null, null],
      repeatStart: false,
      repeatEnd: false
    };
  }

  updateChord(sectionId, barId, slotIndex, newChordData) {
    const section = this.progression.sections.find(s => s.id === sectionId);
    const bar = section?.bars.find(b => b.id === barId);
    if (bar) {
      if (newChordData) {
        bar.chords[slotIndex] = { ...bar.chords[slotIndex], ...newChordData };
      } else {
        bar.chords[slotIndex] = null;
      }
      this.renderBars();
      this.saveToStorage();
    }
  }

  // ===== INLINE SELECTORS =====
  openChordSelector(slotEl) {
    this.closeAllSelectors();
    document.body.classList.add('selector-open');

    const selector = document.createElement('div');
    selector.className = 'chord-selector active';
    const chords = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    selector.innerHTML = `
      <div class="selector-grid">
        ${chords.map(c => `<button class="selector-btn" data-action="select-chord" data-value="${c}">${c}</button>`).join('')}
      </div>
    `;
    slotEl.appendChild(selector);
    this.currentEdit = slotEl.dataset;
  }

  openExtensionSelector(slotEl) {
    this.closeAllSelectors();
    document.body.classList.add('selector-open');

    const selector = document.createElement('div');
    selector.className = 'extension-selector active';
    const extensions = ['7', 'maj7', 'm7', '9', 'add9', 'sus2', 'sus4', '6', '11', '13'];
    selector.innerHTML = `
      <div class="selector-grid">
        ${extensions.map(e => `<button class="selector-btn" data-action="select-extension" data-value="${e}">${e}</button>`).join('')}
      </div>
      <div class="extension-footer">
        <button class="btn-clear-ext" data-action="select-extension" data-value="">Clear Extension</button>
      </div>
    `;
    slotEl.appendChild(selector);
    this.currentEdit = slotEl.dataset;
  }

  closeAllSelectors() {
    document.querySelectorAll('.chord-selector, .extension-selector').forEach(el => el.remove());
    document.body.classList.remove('selector-open');
    this.currentEdit = null;
  }

  // ===== EVENT HANDLING =====
  setupEventListeners() {
    document.addEventListener('click', e => {
      const target = e.target;
      const actionEl = target.closest('[data-action]');
      const sectionItemEl = target.closest('.section-list-item');

      if (actionEl) {
        e.stopPropagation();
        const action = actionEl.dataset.action;
        const value = actionEl.dataset.value;
        const slotEl = target.closest('.slot');
        const barEl = target.closest('.bar');

        switch (action) {
          case 'select-chord':
            this.updateChord(this.currentEdit.sectionId, this.currentEdit.barId, this.currentEdit.slotIndex, { root: value });
            this.closeAllSelectors();
            break;
          case 'select-extension':
            this.updateChord(this.currentEdit.sectionId, this.currentEdit.barId, this.currentEdit.slotIndex, { extension: value });
            this.closeAllSelectors();
            break;
          case 'delete-chord':
            this.updateChord(slotEl.dataset.sectionId, slotEl.dataset.barId, slotEl.dataset.slotIndex, null);
            break;
          case 'add-section':
            this.addSection();
            break;
          case 'delete-section':
            this.deleteSection(target.closest('.section-list-item').dataset.id);
            break;
          case 'toggle-repeat-start':
            this.toggleRepeat(barEl.dataset.id, 'repeatStart');
            break;
          case 'toggle-repeat-end':
            this.toggleRepeat(barEl.dataset.id, 'repeatEnd');
            break;
        }
      } else if (sectionItemEl) {
        this.setActiveSection(sectionItemEl.dataset.id);
      } else if (target.closest('.slot')) {
        this.openChordSelector(target.closest('.slot'));
      } else if (!target.closest('.chord-selector, .extension-selector')) {
        this.closeAllSelectors();
      }
    });

    document.addEventListener('contextmenu', e => {
      const slotEl = e.target.closest('.slot');
      if (slotEl && slotEl.classList.contains('has-chord')) {
        e.preventDefault();
        this.openExtensionSelector(slotEl);
      }
    });

    document.addEventListener('input', e => {
      const target = e.target;
      if (target.dataset.field) {
        this.updateProgressionField(target.dataset.field, target.value);
      } else if (target.dataset.action === 'update-section-name') {
        const sectionId = target.closest('.section-list-item').dataset.id;
        this.updateSectionName(sectionId, target.value);
      }
    });
    
    document.addEventListener('change', e => {
        const target = e.target;
        if (target.dataset.field) {
            this.updateProgressionField(target.dataset.field, target.value);
        }
    });

    document.getElementById('playBtn').addEventListener('click', () => this.togglePlayback());
    document.querySelector('.btn-import').addEventListener('click', () => this.importJSON());
    document.querySelector('.btn-export').addEventListener('click', () => this.exportJSON());

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeAllSelectors();
      if (e.code === 'Space' && !e.target.matches('input, select')) {
        e.preventDefault();
        this.togglePlayback();
      }
    });
  }

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported && Array.isArray(imported.sections)) {
            this.progression = { ...this.getDefaultProgression(), ...imported };
            this.activeSectionId = this.progression.sections[0]?.id || null;
            this.stopPlayback();
            this.render();
          } else {
            alert('Invalid file format.');
          }
        } catch (err) {
          alert(`Error reading file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  exportJSON() {
    const dataStr = JSON.stringify(this.progression, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const title = this.progression.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'progression';
    link.download = `${title}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  window.chordApp = new ChordProgressionApp();
});
