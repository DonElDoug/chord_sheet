// ===== GLOBAL STATE =====
let progression = {
  title: "Untitled Song",
  artist: "",
  key: "C",
  timeSignature: "4/4",
  bpm: 120,
  sections: []
};

let isPlaying = false;
let currentBar = 0;
let playInterval = null;
let audioContext = null;

// ===== CORE FUNCTIONALITY =====
class ChordProgressionApp {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadFromStorage();
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
    const playBtn = document.querySelector('.btn-play');
    if (playBtn) {
      playBtn.textContent = isPlaying ? '⏸' : '▶';
    }
  }

  // ===== DATA MANAGEMENT =====
  saveToStorage() {
    try {
      localStorage.setItem('chordProgression', JSON.stringify(progression));
    } catch (e) {
      console.warn('Could not save to localStorage');
    }
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

  // ===== CHORD MANAGEMENT =====
  openChordMenu(sectionId, barId, slotIndex) {
    this.currentEdit = { sectionId, barId, slotIndex };
    
    const menu = document.getElementById('chord-menu');
    menu.style.display = 'flex';
    
    // Reset extension selection
    document.querySelectorAll('.ext-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
  }

  closeChordMenu() {
    const menu = document.getElementById('chord-menu');
    menu.style.display = 'none';
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
    this.closeChordMenu();
  }

  selectExtension(ext) {
    // Toggle extension selection
    const btn = event.target;
    const wasSelected = btn.classList.contains('selected');
    
    document.querySelectorAll('.ext-btn').forEach(b => b.classList.remove('selected'));
    
    if (!wasSelected) {
      btn.classList.add('selected');
    }
  }

  applyChordWithExtension() {
    if (!this.currentEdit) return;
    
    const selectedExt = document.querySelector('.ext-btn.selected');
    const extension = selectedExt?.textContent || null;
    
    const { sectionId, barId, slotIndex } = this.currentEdit;
    const section = progression.sections.find(s => s.id === sectionId);
    const bar = section?.bars.find(b => b.id === barId);
    const currentChord = bar?.chords[slotIndex];
    
    if (bar && currentChord) {
      currentChord.extension = extension;
      this.render();
      this.saveToStorage();
    }
    
    this.closeChordMenu();
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

    // Play button
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-play')) {
        this.togglePlayback();
      }
    });

    // Add section
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-add-section')) {
        this.addSection();
      }
    });

    // Export/Import
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-export')) {
        this.exportJSON();
      }
      if (e.target.classList.contains('btn-import')) {
        this.importJSON();
      }
    });

    // Close menus on background click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('context-menu')) {
        this.closeChordMenu();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeChordMenu();
      }
      if (e.key === ' ' && !e.target.matches('input, textarea')) {
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

    if (titleInput) titleInput.value = progression.title;
    if (artistInput) artistInput.value = progression.artist;
    if (keySelect) keySelect.value = progression.key;
    if (bpmInput) bpmInput.value = progression.bpm;
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
            <div class="slot" onclick="app.openChordMenu('${sectionId}', '${bar.id}', ${slotIndex})">
              ${chord ? `
                <div class="chord">
                  ${chord.root}
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

// ===== CHORD MENU FUNCTIONS =====
function selectChord(chord) {
  app.selectChord(chord);
}

function selectExtension(ext) {
  app.selectExtension(ext);
}

function applyExtension() {
  app.applyChordWithExtension();
}

function closeMenu() {
  app.closeChordMenu();
}

// ===== INITIALIZATION =====
let app;

document.addEventListener('DOMContentLoaded', () => {
  app = new ChordProgressionApp();
});

// Expose app globally for debugging
window.chordApp = app;
