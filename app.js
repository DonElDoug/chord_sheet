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
      this.render();
    }
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
        // Basic validation to ensure we're not loading malformed data
        if (parsed && Array.isArray(parsed.sections)) {
          this.progression = { ...this.getDefaultProgression(), ...parsed };
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
      if (field === 'key' || field === 'displayMode') {
        this.render();
      }
      this.saveToStorage();
    }
  }

  // ===== AUDIO SYSTEM =====
  initAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported. Playback will be disabled.');
      alert('Your browser does not support the Web Audio API, so playback is disabled.');
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
    const allBars = this.progression.sections.flatMap(s => s.bars);
    if (allBars.length === 0) return;

    this.isPlaying = true;
    this.updatePlayButton();
    this.currentBarIndex = 0;

    const beatDuration = 60 / this.progression.bpm;
    const barDurationMs = beatDuration * 4 * 1000;

    const tick = () => {
      const bar = allBars[this.currentBarIndex];
      this.highlightBar(bar.id);
      
      // Play the first valid chord in the bar
      const chordToPlay = bar.chords.find(c => c);
      if (chordToPlay) {
        this.playChord(chordToPlay);
      }

      this.currentBarIndex++;
      if (this.currentBarIndex >= allBars.length) {
        this.stopPlayback();
      }
    };

    tick(); // Play first bar immediately
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
      // Highlight the first slot of the bar
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
    this.renderSections();
    this.saveToStorage();
  }

  renderSongInfo() {
    document.getElementById('songTitle').value = this.progression.title;
    document.getElementById('songArtist').value = this.progression.artist;
    document.getElementById('keySelect').value = this.progression.key;
    document.getElementById('bpmInput').value = this.progression.bpm;
  }

  renderSections() {
    const sectionsContainer = document.querySelector('.sections');
    sectionsContainer.innerHTML = '';
    let globalBarIndex = 1;
    this.progression.sections.forEach(section => {
      const sectionEl = this.createSectionElement(section, globalBarIndex);
      sectionsContainer.appendChild(sectionEl);
      globalBarIndex += section.bars.length;
    });
  }

  createSectionElement(section, startingBarNum) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'section';
    sectionEl.dataset.id = section.id;

    sectionEl.innerHTML = `
      <div class="section-header">
        <input class="section-title" value="${section.name}" data-action="update-section-name" placeholder="Section Name" />
        <div class="section-controls">
          <button class="header-btn icon-btn" data-action="add-bar" title="Add Bar">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button class="header-btn icon-btn delete-section-btn" data-action="delete-section" title="Delete Section">
            <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
      <div class="bars-grid">
        ${section.bars.map((bar, i) => this.createBarHTML(section.id, bar, i + startingBarNum)).join('')}
      </div>
    `;
    return sectionEl;
  }

  createBarHTML(sectionId, bar, barNumber) {
    return `
      <div class="bar" data-id="${bar.id}">
        <div class="bar-number">${barNumber}</div>
        <div class="slots">
          ${bar.chords.map((chord, slotIndex) => this.createSlotHTML(sectionId, bar.id, slotIndex, chord)).join('')}
        </div>
      </div>
    `;
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
    // This logic can be expanded for absolute chords
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
    this.render();
  }

  deleteSection(sectionId) {
    if (confirm('Are you sure you want to delete this section?')) {
      this.progression.sections = this.progression.sections.filter(s => s.id !== sectionId);
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

  addBar(sectionId) {
    const section = this.progression.sections.find(s => s.id === sectionId);
    if (section) {
      section.bars.push(this.createEmptyBar());
      this.render();
    }
  }

  createEmptyBar() {
    return {
      id: `b_${Date.now()}_${Math.random()}`,
      chords: [null, null, null, null]
    };
  }

  updateChord(sectionId, barId, slotIndex, newChordData) {
    const section = this.progression.sections.find(s => s.id === sectionId);
    const bar = section?.bars.find(b => b.id === barId);
    if (bar) {
      if (newChordData) {
        bar.chords[slotIndex] = { ...bar.chords[slotIndex], ...newChordData };
      } else {
        bar.chords[slotIndex] = null; // Clear the chord
      }
      this.render();
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
    // Delegated main click handler
    document.addEventListener('click', e => {
      const target = e.target;
      const actionEl = target.closest('[data-action]');
      
      if (actionEl) {
        const action = actionEl.dataset.action;
        const value = actionEl.dataset.value;
        const slotEl = target.closest('.slot');
        const sectionEl = target.closest('.section');

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
            e.stopPropagation();
            this.updateChord(slotEl.dataset.sectionId, slotEl.dataset.barId, slotEl.dataset.slotIndex, null);
            break;
          case 'add-section':
            this.addSection();
            break;
          case 'add-bar':
            this.addBar(sectionEl.dataset.id);
            break;
          case 'delete-section':
            this.deleteSection(sectionEl.dataset.id);
            break;
        }
      } else if (target.closest('.slot')) {
        // Open chord selector on left click
        this.openChordSelector(target.closest('.slot'));
      } else if (!target.closest('.chord-selector, .extension-selector')) {
        // Close selectors if clicking outside
        this.closeAllSelectors();
      }
    });

    // Delegated context menu (right-click) handler
    document.addEventListener('contextmenu', e => {
      const slotEl = e.target.closest('.slot');
      if (slotEl && slotEl.classList.contains('has-chord')) {
        e.preventDefault();
        this.openExtensionSelector(slotEl);
      }
    });

    // Delegated input/change handler
    document.addEventListener('input', e => {
      const target = e.target;
      if (target.dataset.field) {
        this.updateProgressionField(target.dataset.field, target.value);
      } else if (target.dataset.action === 'update-section-name') {
        const sectionId = target.closest('.section').dataset.id;
        this.updateSectionName(sectionId, target.value);
      }
    });
    document.addEventListener('change', e => {
        const target = e.target;
        if (target.dataset.field) {
            this.updateProgressionField(target.dataset.field, target.value);
        }
    });

    // Global handlers
    document.getElementById('playBtn').addEventListener('click', () => this.togglePlayback());
    document.querySelector('.btn-import').addEventListener('click', () => this.importJSON());
    document.querySelector('.btn-export').addEventListener('click', () => this.exportJSON());
    document.querySelector('.btn-add-section').addEventListener('click', () => this.addSection());

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
