// ===== GLOBAL STATE =====
let progression = {
  title: "Untitled Song",
  artist: "",
  key: "C",
  timeSignature: "4/4",
  bpm: 120,
  displayMode: "roman",
  sections: []
};

let isPlaying = false;
let currentBar = 0;
let playInterval = null;
let audioContext = null;

// ===== CORE FUNCTIONALITY =====
class ChordProgressionApp {
  constructor() {
    this.saveTimeout = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadFromStorage();
    
    // Add a default section if none exist
    if (progression.sections.length === 0) {
      this.addSection();
    }
    
    this.render();
    this.initAudio();
  }

  // ===== AUDIO SYSTEM =====
  initAudio() {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }

  playChord(chord) {
    if (!audioContext) return;
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    // Simple chord frequencies (C major as example)
    const frequencies = this.getChordFrequencies(chord);
    osc.frequency.setValueAtTime(frequencies[0], audioContext.currentTime);
    
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.5);
  }

  getChordFrequencies(chord) {
    // Simplified chord-to-frequency mapping
    const baseFreqs = {
      'I': 261.63,   // C
      'ii': 293.66,  // D
      'iii': 329.63, // E  
      'IV': 349.23,  // F
      'V': 392.00,   // G
      'vi': 440.00,  // A
      'vii°': 493.88 // B
    };
    return [baseFreqs[chord] || 261.63];
  }

  // ===== PLAYBACK CONTROLS =====
  togglePlayback() {
    if (isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (!progression.sections.length) return;
    
    isPlaying = true;
    this.updatePlayButton();
    
    const beatDuration = (60 / progression.bpm) * 1000; // ms per beat
    const barDuration = beatDuration * 4; // 4/4 time
    
    let totalBars = 0;
    progression.sections.forEach(section => {
      totalBars += section.bars.length;
    });
    
    if (totalBars === 0) return;
    
    currentBar = 0;
    
    playInterval = setInterval(() => {
      this.highlightCurrentBar();
      
      // Get current chord and play it
      const { chord } = this.getCurrentBarChord();
      if (chord) {
        this.playChord(chord.root);
      }
      
      currentBar++;
      if (currentBar >= totalBars) {
        this.stopPlayback();
      }
    }, barDuration);
  }

  stopPlayback() {
    isPlaying = false;
    currentBar = 0;
    
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
    
    this.updatePlayButton();
    this.clearHighlights();
  }

  updatePlayButton() {
    const playBtn = document.querySelector('.btn-play .play-icon');
    if (playBtn) {
      playBtn.textContent = isPlaying ? '⏸' : '▶';
    }
  }

  // ===== DATA MANAGEMENT =====
  saveToStorage() {
    // Debounce save operations for better performance
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem('chordProgression', JSON.stringify(progression));
      } catch (e) {
        console.warn('Could not save to localStorage');
      }
    }, 100);
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('chordProgression');
      if (saved) {
        progression = { ...progression, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Could not load from localStorage');
    }
  }

  exportJSON() {
    const dataStr = JSON.stringify(progression, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${progression.title || 'chord-progression'}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          progression = { ...progression, ...imported };
          this.render();
          this.saveToStorage();
        } catch (err) {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  // ===== SECTION MANAGEMENT =====
  addSection() {
    const section = {
      id: Date.now().toString(),
      name: `Section ${progression.sections.length + 1}`,
      bars: []
    };
    
    // Add 4 empty bars by default
    for (let i = 0; i < 4; i++) {
      section.bars.push(this.createEmptyBar());
    }
    
    progression.sections.push(section);
    this.render();
    this.saveToStorage();
  }

  deleteSection(sectionId) {
    progression.sections = progression.sections.filter(s => s.id !== sectionId);
    this.render();
    this.saveToStorage();
  }

  updateSectionName(sectionId, name) {
    const section = progression.sections.find(s => s.id === sectionId);
    if (section) {
      section.name = name;
      this.saveToStorage();
    }
  }

  // ===== BAR MANAGEMENT =====
  createEmptyBar() {
    return {
      id: Date.now().toString() + Math.random(),
      chords: [null, null, null, null] // 4 slots per bar
    };
  }

  addBar(sectionId) {
    const section = progression.sections.find(s => s.id === sectionId);
    if (section) {
      section.bars.push(this.createEmptyBar());
      this.render();
      this.saveToStorage();
    }
  }

  deleteBar(sectionId, barId) {
    const section = progression.sections.find(s => s.id === sectionId);
    if (section) {
      section.bars = section.bars.filter(b => b.id !== barId);
      this.render();
      this.saveToStorage();
    }
  }

  // ===== CHORD UTILITIES =====
  romanToChordName(roman, key) {
    const keyMap = {
      'C': ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'],
      'C#': ['C#', 'D#m', 'E#m', 'F#', 'G#', 'A#m', 'B#°'],
      'Db': ['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'C°'],
      'D': ['D', 'Em', 'F#m', 'G', 'A', 'Bm', 'C#°'],
      'D#': ['D#', 'E#m', 'F##m', 'G#', 'A#', 'B#m', 'C##°'],
      'Eb': ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm', 'D°'],
      'E': ['E', 'F#m', 'G#m', 'A', 'B', 'C#m', 'D#°'],
      'F': ['F', 'Gm', 'Am', 'Bb', 'C', 'Dm', 'E°'],
      'F#': ['F#', 'G#m', 'A#m', 'B', 'C#', 'D#m', 'E#°'],
      'Gb': ['Gb', 'Abm', 'Bbm', 'Cb', 'Db', 'Ebm', 'F°'],
      'G': ['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#°'],
      'G#': ['G#', 'A#m', 'B#m', 'C#', 'D#', 'E#m', 'F##°'],
      'Ab': ['Ab', 'Bbm', 'Cm', 'Db', 'Eb', 'Fm', 'G°'],
      'A': ['A', 'Bm', 'C#m', 'D', 'E', 'F#m', 'G#°'],
      'A#': ['A#', 'B#m', 'C##m', 'D#', 'E#', 'F##m', 'G##°'],
      'Bb': ['Bb', 'Cm', 'Dm', 'Eb', 'F', 'Gm', 'A°'],
      'B': ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m', 'A#°']
    };

    const romanMap = {
      'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'vii°': 6
    };

    const chords = keyMap[key] || keyMap['C'];
    const index = romanMap[roman];
    
    return index !== undefined ? chords[index] : roman;
  }

  // ===== CHORD MANAGEMENT =====
  openChordSelector(sectionId, barId, slotIndex, element) {
    this.closeAllSelectors();
    this.currentEdit = { sectionId, barId, slotIndex };
    
    // Create chord selector
    const selector = document.createElement('div');
    selector.className = 'chord-selector active';
    
    // Use template literal for better performance
    const chords = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const optionsHTML = chords.map(chord => 
      `<div class="chord-option" data-chord="${chord}">${chord}</div>`
    ).join('') + '<div class="chord-option" data-chord="">Clear</div>';
    
    selector.innerHTML = `<div class="chord-options">${optionsHTML}</div>`;
    
    element.appendChild(selector);
    
    // Use event delegation for better performance
    selector.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.classList.contains('chord-option')) {
        const chord = e.target.dataset.chord;
        if (chord) {
          this.selectChord(chord);
        } else {
          this.deleteChord(sectionId, barId, slotIndex);
        }
        this.closeAllSelectors();
      }
    });
  }

  openExtensionSelector(sectionId, barId, slotIndex, element) {
    this.closeAllSelectors();
    this.currentEdit = { sectionId, barId, slotIndex };
    
    // Create extension selector
    const selector = document.createElement('div');
    selector.className = 'extension-selector active';
    
    // Use template literal for better performance
    const extensions = ['7', '9', 'maj7', 'm7', 'sus2', 'sus4', 'add9', '6', '11', '13'];
    const optionsHTML = extensions.map(ext => 
      `<div class="extension-option" data-ext="${ext}">${ext}</div>`
    ).join('');
    
    selector.innerHTML = `
      <div class="extension-options">${optionsHTML}</div>
      <div class="extension-clear" data-ext="">Clear Extension</div>
    `;
    
    element.appendChild(selector);
    
    // Use event delegation for better performance
    selector.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.classList.contains('extension-option') || e.target.classList.contains('extension-clear')) {
        const extension = e.target.dataset.ext;
        this.applyExtension(extension);
        this.closeAllSelectors();
      }
    });
  }

  closeAllSelectors() {
    document.querySelectorAll('.chord-selector, .extension-selector').forEach(el => {
      el.remove();
    });
    this.currentEdit = null;
  }

  selectChord(chordSymbol) {
    if (!this.currentEdit) return;
    
    const { sectionId, barId, slotIndex } = this.currentEdit;
    const section = progression.sections.find(s => s.id === sectionId);
    const bar = section?.bars.find(b => b.id === barId);
    
    if (bar) {
      bar.chords[slotIndex] = {
        root: chordSymbol,
        extension: null,
        slash: null
      };
    }
    
    this.render();
    this.saveToStorage();
  }

  applyExtension(extension) {
    if (!this.currentEdit) return;
    
    const { sectionId, barId, slotIndex } = this.currentEdit;
    const section = progression.sections.find(s => s.id === sectionId);
    const bar = section?.bars.find(b => b.id === barId);
    const currentChord = bar?.chords[slotIndex];
    
    if (bar && currentChord) {
      currentChord.extension = extension || null;
      this.render();
      this.saveToStorage();
    } else if (bar && extension) {
      // If no chord exists but extension is applied, create a I chord
      bar.chords[slotIndex] = {
        root: 'I',
        extension: extension,
        slash: null
      };
      this.render();
      this.saveToStorage();
    }
  }

  deleteChord(sectionId, barId, slotIndex) {
    const section = progression.sections.find(s => s.id === sectionId);
    const bar = section?.bars.find(b => b.id === barId);
    
    if (bar) {
      bar.chords[slotIndex] = null;
      this.render();
      this.saveToStorage();
    }
  }

  // ===== EVENT HANDLERS =====
  setupEventListeners() {
    // Song info updates
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('song-input')) {
        const field = e.target.dataset.field;
        progression[field] = e.target.value;
        this.saveToStorage();
      }
    });

    // Handle display mode change
    document.addEventListener('change', (e) => {
      if (e.target.id === 'displayMode') {
        progression.displayMode = e.target.value;
        this.render();
        this.saveToStorage();
      }
      if (e.target.dataset.field === 'key') {
        progression.key = e.target.value;
        this.render();
        this.saveToStorage();
      }
    });

    // Handle all clicks
    document.addEventListener('click', (e) => {
      // Play button
      if (e.target.closest('.btn-play')) {
        this.togglePlayback();
        return;
      }
      
      // Add section
      if (e.target.closest('.btn-add-section')) {
        this.addSection();
        return;
      }

      // Export/Import
      if (e.target.closest('.btn-export')) {
        this.exportJSON();
        return;
      }
      if (e.target.closest('.btn-import')) {
        this.importJSON();
        return;
      }

      // Handle slot clicks (left click for chords)
      const slot = e.target.closest('.slot');
      if (slot && !e.target.closest('.delete-btn') && !e.target.closest('.chord-selector') && !e.target.closest('.extension-selector')) {
        e.preventDefault();
        e.stopPropagation();
        const sectionId = slot.dataset.sectionId;
        const barId = slot.dataset.barId;
        const slotIndex = parseInt(slot.dataset.slotIndex);
        
        this.openChordSelector(sectionId, barId, slotIndex, slot);
        return;
      }

      // Close selectors when clicking outside
      if (!e.target.closest('.chord-selector') && !e.target.closest('.extension-selector')) {
        this.closeAllSelectors();
      }
    });

    // Right click for extensions
    document.addEventListener('contextmenu', (e) => {
      const slot = e.target.closest('.slot');
      if (slot && !e.target.closest('.delete-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const sectionId = slot.dataset.sectionId;
        const barId = slot.dataset.barId;
        const slotIndex = parseInt(slot.dataset.slotIndex);
        
        this.openExtensionSelector(sectionId, barId, slotIndex, slot);
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllSelectors();
      }
      if (e.key === ' ' && !e.target.matches('input, textarea, select')) {
        e.preventDefault();
        this.togglePlayback();
      }
    });
  }

  // ===== RENDERING =====
  render() {
    this.renderSongInfo();
    this.renderSections();
  }

  renderSongInfo() {
    const titleInput = document.querySelector('input[data-field="title"]');
    const artistInput = document.querySelector('input[data-field="artist"]');
    const keySelect = document.querySelector('select[data-field="key"]');
    const bpmInput = document.querySelector('input[data-field="bpm"]');
    const displaySelect = document.getElementById('displayMode');

    if (titleInput) titleInput.value = progression.title;
    if (artistInput) artistInput.value = progression.artist;
    if (keySelect) keySelect.value = progression.key;
    if (bpmInput) bpmInput.value = progression.bpm;
    if (displaySelect) displaySelect.value = progression.displayMode;
  }

  renderSections() {
    const sectionsContainer = document.querySelector('.sections');
    if (!sectionsContainer) return;

    sectionsContainer.innerHTML = '';

    progression.sections.forEach((section, sectionIndex) => {
      const sectionEl = this.createSectionElement(section, sectionIndex);
      sectionsContainer.appendChild(sectionEl);
    });
  }

  createSectionElement(section, sectionIndex) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'section';
    
    let barNumber = 1;
    // Calculate starting bar number
    for (let i = 0; i < sectionIndex; i++) {
      barNumber += progression.sections[i].bars.length;
    }

    sectionEl.innerHTML = `
      <div class="section-header">
        <input 
          type="text" 
          class="section-name" 
          value="${section.name}"
          onchange="app.updateSectionName('${section.id}', this.value)"
        >
        <div class="section-controls">
          <button class="btn btn-secondary" onclick="app.addBar('${section.id}')">+ Bar</button>
          <button class="btn btn-secondary danger" onclick="app.deleteSection('${section.id}')">Delete</button>
        </div>
      </div>
      <div class="section-bars">
        ${section.bars.map((bar, barIndex) => 
          this.createBarHTML(section.id, bar, barNumber + barIndex)
        ).join('')}
      </div>
    `;

    return sectionEl;
  }

  createBarHTML(sectionId, bar, barNumber) {
    return `
      <div class="bar" data-bar-id="${bar.id}">
        <div class="bar-number">${barNumber}</div>
        <div class="bar-slots">
          ${bar.chords.map((chord, slotIndex) => `
            <div class="slot" data-section-id="${sectionId}" data-bar-id="${bar.id}" data-slot-index="${slotIndex}">
              ${chord ? `
                <div class="chord">
                  ${progression.displayMode === 'roman' 
                    ? chord.root 
                    : this.romanToChordName(chord.root, progression.key)
                  }
                  ${chord.extension ? `<sup class="chord-extension">${chord.extension}</sup>` : ''}
                  ${chord.slash ? `<span class="chord-slash">/${chord.slash}</span>` : ''}
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); app.deleteChord('${sectionId}', '${bar.id}', ${slotIndex})">×</button>
              ` : '<div class="empty-slot">+</div>'}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ===== PLAYBACK UTILITIES =====
  getCurrentBarChord() {
    let barIndex = 0;
    for (const section of progression.sections) {
      for (const bar of section.bars) {
        if (barIndex === currentBar) {
          return { chord: bar.chords.find(c => c) || null, bar };
        }
        barIndex++;
      }
    }
    return { chord: null, bar: null };
  }

  highlightCurrentBar() {
    this.clearHighlights();
    
    let barIndex = 0;
    for (const section of progression.sections) {
      for (const bar of section.bars) {
        if (barIndex === currentBar) {
          const barEl = document.querySelector(`[data-bar-id="${bar.id}"]`);
          if (barEl) {
            barEl.style.boxShadow = '0 0 0 3px var(--accent)';
          }
          return;
        }
        barIndex++;
      }
    }
  }

  clearHighlights() {
    document.querySelectorAll('.bar').forEach(bar => {
      bar.style.boxShadow = '';
    });
  }
}

// ===== INITIALIZATION =====
let app;

document.addEventListener('DOMContentLoaded', () => {
  app = new ChordProgressionApp();
});

// Expose app globally for debugging
window.chordApp = app;
