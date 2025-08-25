// ===== CHORD PROGRESSION APP =====
class ChordProgressionApp {
  constructor() {
    // Core State
    this.bars = JSON.parse(localStorage.getItem('chord-progression') || '[]');
    this.songTitle = localStorage.getItem('song-title') || 'Untitled Song';
    this.key = localStorage.getItem('key') || 'C';
    this.bpm = parseInt(localStorage.getItem('bpm') || '120');
    
    // Playback State
    this.isPlaying = false;
    this.playPosition = 0;
    this.playTimeout = null;
    this.audioContext = null;
    
    // UI State
    this.currentBar = null;
    this.currentSlot = null;
    
    // DOM Elements
    this.elements = {
      songTitle: document.getElementById('song-title'),
      keySelector: document.getElementById('key-selector'),
      bpmDisplay: document.getElementById('bpm-display'),
      bpmSlider: document.getElementById('bpm-slider'),
      playBtn: document.getElementById('play-btn'),
      addBarBtn: document.getElementById('add-bar-btn'),
      clearBtn: document.getElementById('clear-btn'),
      exportBtn: document.getElementById('export-btn'),
      importBtn: document.getElementById('import-btn'),
      importFile: document.getElementById('import-file'),
      progression: document.getElementById('progression'),
      playhead: document.getElementById('playhead'),
      chordModal: document.getElementById('chord-modal'),
      extensionModal: document.getElementById('extension-modal'),
      repeatModal: document.getElementById('repeat-modal')
    };
    
    // Roman Numeral System
    this.romanNumerals = {
      'C': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'C#': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Db': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'D': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'D#': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Eb': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'E': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'F': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'F#': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Gb': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'G': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'G#': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Ab': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'A': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'A#': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'Bb': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
      'B': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
    };
    
    // Note frequencies for audio
    this.noteFrequencies = {
      'C': 261.63, 'C#': 277.18, 'Db': 277.18, 'D': 293.66,
      'D#': 311.13, 'Eb': 311.13, 'E': 329.63, 'F': 349.23,
      'F#': 369.99, 'Gb': 369.99, 'G': 392.00, 'G#': 415.30,
      'Ab': 415.30, 'A': 440.00, 'A#': 466.16, 'Bb': 466.16, 'B': 493.88
    };
    
    this.init();
  }

  // ===== INITIALIZATION =====
  init() {
    this.setupEventListeners();
    this.loadData();
    this.render();
    console.log('🎵 Chord Progression App initialized');
  }

  setupEventListeners() {
    // Header Controls
    this.elements.songTitle.addEventListener('input', () => this.saveSongTitle());
    this.elements.keySelector.addEventListener('change', () => this.changeKey());
    this.elements.bpmSlider.addEventListener('input', () => this.changeBPM());
    this.elements.playBtn.addEventListener('click', () => this.togglePlayback());
    
    // Controls
    this.elements.addBarBtn.addEventListener('click', () => this.addBar());
    this.elements.clearBtn.addEventListener('click', () => this.clearAll());
    this.elements.exportBtn.addEventListener('click', () => this.exportData());
    this.elements.importBtn.addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile.addEventListener('change', (e) => this.importData(e));
    
    // Progression (Event Delegation)
    this.elements.progression.addEventListener('click', (e) => this.handleProgressionClick(e));
    this.elements.progression.addEventListener('contextmenu', (e) => this.handleProgressionRightClick(e));
    
    // Modal Handlers
    this.setupModalHandlers();
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    
    // Audio Context (on user gesture)
    document.addEventListener('click', () => this.initAudio(), { once: true });
  }

  setupModalHandlers() {
    // Close modals on backdrop click
    [this.elements.chordModal, this.elements.extensionModal, this.elements.repeatModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModals();
      });
    });
    
    // Chord selection
    this.elements.chordModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('chord-btn')) {
        this.selectChord(e.target.dataset.chord);
      }
    });
    
    // Extension selection
    this.elements.extensionModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('ext-btn')) {
        this.selectExtension(e.target.dataset.extension);
      } else if (e.target.classList.contains('btn-clear-ext')) {
        this.clearExtension();
      }
    });
    
    // Repeat selection
    this.elements.repeatModal.addEventListener('click', (e) => {
      if (e.target.classList.contains('repeat-btn')) {
        this.selectRepeat(e.target.dataset.repeat);
      }
    });
  }

  // ===== DATA MANAGEMENT =====
  loadData() {
    this.elements.songTitle.value = this.songTitle;
    this.elements.keySelector.value = this.key;
    this.elements.bpmSlider.value = this.bpm;
    this.elements.bpmDisplay.textContent = this.bpm;
    
    if (this.bars.length === 0) {
      this.addBar(); // Start with one bar
    }
  }

  saveData() {
    localStorage.setItem('chord-progression', JSON.stringify(this.bars));
    localStorage.setItem('song-title', this.songTitle);
    localStorage.setItem('key', this.key);
    localStorage.setItem('bpm', this.bpm.toString());
  }

  saveSongTitle() {
    this.songTitle = this.elements.songTitle.value;
    this.saveData();
  }

  changeKey() {
    this.key = this.elements.keySelector.value;
    this.saveData();
  }

  changeBPM() {
    this.bpm = parseInt(this.elements.bpmSlider.value);
    this.elements.bpmDisplay.textContent = this.bpm;
    this.saveData();
  }

  // ===== BAR MANAGEMENT =====
  addBar() {
    const newBar = {
      id: Date.now(),
      slots: [null, null, null, null],
      repeat: null
    };
    this.bars.push(newBar);
    this.saveData();
    this.render();
  }

  removeBar(barId) {
    this.bars = this.bars.filter(bar => bar.id !== barId);
    this.saveData();
    this.render();
  }

  // ===== CHORD MANAGEMENT =====
  handleProgressionClick(e) {
    e.preventDefault();
    
    const slot = e.target.closest('.slot');
    const deleteBtn = e.target.closest('.delete-btn');
    const barRepeat = e.target.closest('.bar-repeat');
    const removeBarBtn = e.target.closest('.remove-bar');
    
    if (deleteBtn) {
      this.deleteChord(slot);
    } else if (barRepeat) {
      this.openRepeatModal(barRepeat.dataset.barId);
    } else if (removeBarBtn) {
      this.removeBar(parseInt(removeBarBtn.dataset.barId));
    } else if (slot) {
      this.openChordModal(slot);
    }
  }

  handleProgressionRightClick(e) {
    e.preventDefault();
    
    const slot = e.target.closest('.slot');
    if (slot && slot.dataset.chord) {
      this.openExtensionModal(slot);
    }
  }

  openChordModal(slot) {
    this.currentBar = parseInt(slot.dataset.barId);
    this.currentSlot = parseInt(slot.dataset.slotIndex);
    this.populateChordModal();
    this.elements.chordModal.classList.add('active');
  }

  openExtensionModal(slot) {
    this.currentBar = parseInt(slot.dataset.barId);
    this.currentSlot = parseInt(slot.dataset.slotIndex);
    this.elements.extensionModal.classList.add('active');
  }

  openRepeatModal(barId) {
    this.currentBar = parseInt(barId);
    this.elements.repeatModal.classList.add('active');
  }

  populateChordModal() {
    const chordGrid = this.elements.chordModal.querySelector('.chord-grid');
    const romanNumerals = this.romanNumerals[this.key];
    
    chordGrid.innerHTML = romanNumerals.map(numeral => 
      `<button class="chord-btn" data-chord="${numeral}">${numeral}</button>`
    ).join('');
  }

  selectChord(chord) {
    const bar = this.bars.find(b => b.id === this.currentBar);
    if (bar) {
      bar.slots[this.currentSlot] = { chord, extension: null };
      this.saveData();
      this.render();
      this.playChordSound(chord);
    }
    this.closeModals();
  }

  selectExtension(extension) {
    const bar = this.bars.find(b => b.id === this.currentBar);
    if (bar && bar.slots[this.currentSlot]) {
      bar.slots[this.currentSlot].extension = extension;
      this.saveData();
      this.render();
    }
    this.closeModals();
  }

  clearExtension() {
    const bar = this.bars.find(b => b.id === this.currentBar);
    if (bar && bar.slots[this.currentSlot]) {
      bar.slots[this.currentSlot].extension = null;
      this.saveData();
      this.render();
    }
    this.closeModals();
  }

  selectRepeat(repeat) {
    const bar = this.bars.find(b => b.id === this.currentBar);
    if (bar) {
      bar.repeat = repeat === 'none' ? null : repeat;
      this.saveData();
      this.render();
    }
    this.closeModals();
  }

  deleteChord(slot) {
    const barId = parseInt(slot.dataset.barId);
    const slotIndex = parseInt(slot.dataset.slotIndex);
    
    const bar = this.bars.find(b => b.id === barId);
    if (bar) {
      bar.slots[slotIndex] = null;
      this.saveData();
      this.render();
    }
  }

  closeModals() {
    this.elements.chordModal.classList.remove('active');
    this.elements.extensionModal.classList.remove('active');
    this.elements.repeatModal.classList.remove('active');
    this.currentBar = null;
    this.currentSlot = null;
  }

  // ===== RENDERING =====
  render() {
    this.renderProgression();
  }

  renderProgression() {
    const rows = [];
    for (let i = 0; i < this.bars.length; i += 4) {
      rows.push(this.bars.slice(i, i + 4));
    }

    this.elements.progression.innerHTML = rows.map((row, rowIndex) => 
      `<div class="bar-row">
        ${row.map((bar, index) => this.renderBar(bar, rowIndex * 4 + index + 1)).join('')}
      </div>`
    ).join('');
  }

  renderBar(bar, barNumber) {
    return `
      <div class="bar" data-bar-id="${bar.id}">
        <div class="bar-number">${barNumber}</div>
        ${bar.repeat ? `<div class="bar-repeat" data-bar-id="${bar.id}">${bar.repeat}</div>` : ''}
        <button class="remove-bar" data-bar-id="${bar.id}" title="Remove bar">×</button>
        <div class="slots">
          ${bar.slots.map((slot, index) => this.renderSlot(slot, bar.id, index)).join('')}
        </div>
      </div>
    `;
  }

  renderSlot(slot, barId, slotIndex) {
    if (!slot) {
      return `
        <div class="slot" data-bar-id="${barId}" data-slot-index="${slotIndex}">
          <span class="empty-slot">+</span>
        </div>
      `;
    }

    return `
      <div class="slot has-chord" data-bar-id="${barId}" data-slot-index="${slotIndex}" data-chord="${slot.chord}">
        <span class="chord">${slot.chord}</span>
        ${slot.extension ? `<span class="chord-extension">${slot.extension}</span>` : ''}
        <button class="delete-btn" title="Delete chord">×</button>
      </div>
    `;
  }

  // ===== AUDIO SYSTEM =====
  initAudio() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  playChordSound(chord) {
    if (!this.audioContext) return;
    
    const rootNote = this.getRootNote(chord);
    const frequency = this.noteFrequencies[rootNote];
    
    if (frequency) {
      this.playTone(frequency, 0.3);
    }
  }

  getRootNote(romanNumeral) {
    const scaleNotes = {
      'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      'C#': ['C#', 'D#', 'F', 'F#', 'G#', 'A#', 'C'],
      'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
      'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
      'D#': ['D#', 'F', 'G', 'G#', 'A#', 'C', 'D'],
      'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
      'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
      'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
      'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'F'],
      'Gb': ['Gb', 'Ab', 'Bb', 'B', 'Db', 'Eb', 'F'],
      'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      'G#': ['G#', 'A#', 'C', 'C#', 'D#', 'F', 'G'],
      'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
      'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
      'A#': ['A#', 'C', 'D', 'D#', 'F', 'G', 'A'],
      'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
      'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#']
    };
    
    const scale = scaleNotes[this.key];
    const romanMap = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
    const index = romanMap.indexOf(romanNumeral.replace(/[^IViv°]/g, ''));
    
    return scale[index] || this.key;
  }

  playTone(frequency, duration) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // ===== PLAYBACK SYSTEM =====
  togglePlayback() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  startPlayback() {
    if (this.bars.length === 0) return;
    
    this.isPlaying = true;
    this.playPosition = 0;
    this.elements.playBtn.classList.add('playing');
    this.elements.playBtn.innerHTML = '<span>⏸</span> Pause';
    this.elements.playhead.classList.add('active');
    
    this.playNextBeat();
  }

  stopPlayback() {
    this.isPlaying = false;
    clearTimeout(this.playTimeout);
    this.elements.playBtn.classList.remove('playing');
    this.elements.playBtn.innerHTML = '<span>▶</span> Play';
    this.elements.playhead.classList.remove('active');
    this.clearPlayingSlots();
  }

  playNextBeat() {
    if (!this.isPlaying) return;
    
    this.clearPlayingSlots();
    
    const totalSlots = this.getTotalSlots();
    if (this.playPosition >= totalSlots) {
      this.playPosition = 0; // Loop
    }
    
    const { barIndex, slotIndex } = this.getBarAndSlotFromPosition(this.playPosition);
    this.highlightCurrentSlot(barIndex, slotIndex);
    this.updatePlayhead();
    
    const bar = this.bars[barIndex];
    if (bar && bar.slots[slotIndex]) {
      this.playChordSound(bar.slots[slotIndex].chord);
    }
    
    this.playPosition++;
    
    const beatDuration = (60 / this.bpm) * 1000; // ms per beat
    this.playTimeout = setTimeout(() => this.playNextBeat(), beatDuration);
  }

  getTotalSlots() {
    return this.bars.reduce((total, bar) => total + 4, 0);
  }

  getBarAndSlotFromPosition(position) {
    const barIndex = Math.floor(position / 4);
    const slotIndex = position % 4;
    return { barIndex, slotIndex };
  }

  highlightCurrentSlot(barIndex, slotIndex) {
    const bar = this.bars[barIndex];
    if (!bar) return;
    
    const slot = document.querySelector(`[data-bar-id="${bar.id}"][data-slot-index="${slotIndex}"]`);
    if (slot) {
      slot.classList.add('playing');
    }
  }

  clearPlayingSlots() {
    document.querySelectorAll('.slot.playing').forEach(slot => {
      slot.classList.remove('playing');
    });
  }

  updatePlayhead() {
    const { barIndex, slotIndex } = this.getBarAndSlotFromPosition(this.playPosition);
    const bar = this.bars[barIndex];
    if (!bar) return;
    
    const slot = document.querySelector(`[data-bar-id="${bar.id}"][data-slot-index="${slotIndex}"]`);
    if (slot) {
      const rect = slot.getBoundingClientRect();
      this.elements.playhead.style.left = rect.left + 'px';
    }
  }

  // ===== UTILITIES =====
  clearAll() {
    if (confirm('Clear all bars? This cannot be undone.')) {
      this.bars = [];
      this.stopPlayback();
      this.addBar(); // Add one empty bar
      this.saveData();
      this.render();
    }
  }

  exportData() {
    const data = {
      songTitle: this.songTitle,
      key: this.key,
      bpm: this.bpm,
      bars: this.bars,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.songTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_progression.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.songTitle = data.songTitle || 'Imported Song';
        this.key = data.key || 'C';
        this.bpm = data.bpm || 120;
        this.bars = data.bars || [];
        
        this.stopPlayback();
        this.loadData();
        this.saveData();
        this.render();
        
        console.log('✅ Song imported successfully');
      } catch (error) {
        alert('Error importing file. Please check the format.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
  }

  handleKeyboard(e) {
    if (e.target.tagName === 'INPUT') return; // Don't interfere with input fields
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlayback();
        break;
      case 'Escape':
        this.closeModals();
        break;
      case 'KeyN':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.addBar();
        }
        break;
    }
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ChordProgressionApp();
});

// Service Worker Registration (for PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered'))
      .catch(error => console.log('SW registration failed'));
  });
}
