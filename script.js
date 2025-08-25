// ===== CHORD PROGRESSION APP - VANILLA JAVASCRIPT =====

// Application State
const state = {
    progression: [],
    settings: {
        key: 'C',
        scale: 'major',
        bpm: 120,
        theme: 'dark'
    },
    playback: {
        isPlaying: false,
        currentIndex: 0,
        intervalId: null
    },
    audio: {
        context: null,
        initialized: false
    }
};

// Scale definitions (intervals from root)
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10]
};

// Roman numeral to scale degree mapping
const ROMAN_TO_DEGREE = {
    'I': 0, 'ii': 1, 'iii': 2, 'IV': 3, 'V': 4, 'vi': 5, 'vii°': 6
};

// Note names
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// DOM Elements
let elements = {};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    cacheElements();
    setupEventListeners();
    loadState();
    updateUI();
    setStatus('App geladen und bereit');
}

function cacheElements() {
    elements = {
        // Theme
        themeToggle: document.getElementById('theme-toggle'),
        
        // Settings
        keySelect: document.getElementById('key-select'),
        scaleSelect: document.getElementById('scale-select'),
        bpmSlider: document.getElementById('bpm-slider'),
        bpmValue: document.getElementById('bpm-value'),
        
        // Chord Input
        chordInput: document.getElementById('chord-input'),
        addBtn: document.getElementById('add-chord'),
        
        // Progression
        playBtn: document.getElementById('play-btn'),
        stopBtn: document.getElementById('stop-btn'),
        progressionList: document.getElementById('progression-list'),
        progressionEmpty: document.getElementById('progression-empty'),
        
        // Data
        exportBtn: document.getElementById('export-btn'),
        importBtn: document.getElementById('import-btn'),
        importFile: document.getElementById('import-file'),
        clearBtn: document.getElementById('clear-btn'),
        exportArea: document.getElementById('export-area'),
        
        // Status
        status: document.getElementById('status')
    };
}

function setupEventListeners() {
    // Theme Toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Settings
    elements.keySelect.addEventListener('change', (e) => {
        state.settings.key = e.target.value;
        saveState();
        setStatus(`Tonart geändert zu ${e.target.value}`);
    });
    
    elements.scaleSelect.addEventListener('change', (e) => {
        state.settings.scale = e.target.value;
        saveState();
        setStatus(`Skala geändert zu ${e.target.selectedOptions[0].text}`);
    });
    
    elements.bpmSlider.addEventListener('input', (e) => {
        state.settings.bpm = parseInt(e.target.value);
        elements.bpmValue.textContent = state.settings.bpm;
        saveState();
        
        // Update playback speed if playing
        if (state.playback.isPlaying) {
            restartPlayback();
        }
    });
    
    // Chord Input
    elements.chordInput.addEventListener('change', (e) => {
        elements.addBtn.disabled = !e.target.value;
    });
    
    elements.addBtn.addEventListener('click', addChord);
    
    // Playback
    elements.playBtn.addEventListener('click', startPlayback);
    elements.stopBtn.addEventListener('click', stopPlayback);
    
    // Data
    elements.exportBtn.addEventListener('click', exportData);
    elements.importBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', importData);
    elements.clearBtn.addEventListener('click', clearProgression);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
}

// ===== AUDIO FUNCTIONS =====
function initializeAudio() {
    if (state.audio.initialized) return Promise.resolve();
    
    try {
        state.audio.context = new (window.AudioContext || window.webkitAudioContext)();
        state.audio.initialized = true;
        
        // Resume context if suspended (browser autoplay policy)
        if (state.audio.context.state === 'suspended') {
            return state.audio.context.resume();
        }
        
        return Promise.resolve();
    } catch (error) {
        console.error('Audio initialization failed:', error);
        setStatus('Audio konnte nicht initialisiert werden');
        return Promise.reject(error);
    }
}

function noteToFreq(note, octave = 4) {
    const noteIndex = NOTES.indexOf(note);
    if (noteIndex === -1) return 440; // Fallback to A4
    
    // A4 = 440Hz is note index 9, octave 4
    const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9);
    return 440 * Math.pow(2, semitonesFromA4 / 12);
}

function getRootNote(romanNumeral) {
    const degree = ROMAN_TO_DEGREE[romanNumeral];
    if (degree === undefined) return state.settings.key;
    
    const keyIndex = NOTES.indexOf(state.settings.key);
    const scaleIntervals = SCALES[state.settings.scale];
    const rootInterval = scaleIntervals[degree];
    
    const rootIndex = (keyIndex + rootInterval) % 12;
    return NOTES[rootIndex];
}

async function playChord(romanNumeral, duration = 500) {
    try {
        await initializeAudio();
        
        const rootNote = getRootNote(romanNumeral);
        const freq = noteToFreq(rootNote, 4);
        
        // Create oscillator
        const oscillator = state.audio.context.createOscillator();
        const gainNode = state.audio.context.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(state.audio.context.destination);
        
        // Configure sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, state.audio.context.currentTime);
        
        // Envelope
        gainNode.gain.setValueAtTime(0, state.audio.context.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, state.audio.context.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, state.audio.context.currentTime + duration / 1000);
        
        // Start and stop
        oscillator.start(state.audio.context.currentTime);
        oscillator.stop(state.audio.context.currentTime + duration / 1000);
        
    } catch (error) {
        console.error('Playback error:', error);
        setStatus('Wiedergabe-Fehler aufgetreten');
    }
}

// ===== PROGRESSION FUNCTIONS =====
function addChord() {
    const romanNumeral = elements.chordInput.value;
    if (!romanNumeral) return;
    
    const chord = {
        id: Date.now().toString(),
        roman: romanNumeral,
        timestamp: Date.now()
    };
    
    state.progression.push(chord);
    elements.chordInput.value = '';
    elements.addBtn.disabled = true;
    
    saveState();
    updateProgressionDisplay();
    setStatus(`Akkord ${romanNumeral} hinzugefügt`);
}

function removeChord(id) {
    const index = state.progression.findIndex(chord => chord.id === id);
    if (index === -1) return;
    
    const chord = state.progression[index];
    state.progression.splice(index, 1);
    
    // Adjust current playback index if necessary
    if (state.playback.currentIndex >= index && state.playback.currentIndex > 0) {
        state.playback.currentIndex--;
    }
    
    saveState();
    updateProgressionDisplay();
    setStatus(`Akkord ${chord.roman} entfernt`);
}

function moveChord(id, direction) {
    const index = state.progression.findIndex(chord => chord.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= state.progression.length) return;
    
    // Swap elements
    [state.progression[index], state.progression[newIndex]] = 
    [state.progression[newIndex], state.progression[index]];
    
    // Adjust playback index if necessary
    if (state.playback.currentIndex === index) {
        state.playback.currentIndex = newIndex;
    } else if (state.playback.currentIndex === newIndex) {
        state.playback.currentIndex = index;
    }
    
    saveState();
    updateProgressionDisplay();
    setStatus(`Akkord ${direction === 'up' ? 'nach oben' : 'nach unten'} verschoben`);
}

function clearProgression() {
    if (state.progression.length === 0) return;
    
    if (confirm('Alle Akkorde löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
        stopPlayback();
        state.progression = [];
        state.playback.currentIndex = 0;
        
        saveState();
        updateProgressionDisplay();
        setStatus('Alle Akkorde gelöscht');
    }
}

// ===== PLAYBACK FUNCTIONS =====
async function startPlayback() {
    if (state.progression.length === 0) {
        setStatus('Keine Akkorde zum Abspielen vorhanden');
        return;
    }
    
    try {
        await initializeAudio();
        
        state.playback.isPlaying = true;
        elements.playBtn.disabled = true;
        elements.stopBtn.disabled = false;
        
        // Calculate interval from BPM (assuming quarter notes)
        const interval = (60 / state.settings.bpm) * 1000;
        
        // Start playback loop
        playCurrentChord();
        state.playback.intervalId = setInterval(() => {
            state.playback.currentIndex++;
            if (state.playback.currentIndex >= state.progression.length) {
                state.playback.currentIndex = 0;
            }
            playCurrentChord();
        }, interval);
        
        updateProgressionDisplay();
        setStatus(`Wiedergabe gestartet (${state.settings.bpm} BPM)`);
        
    } catch (error) {
        console.error('Playback start failed:', error);
        setStatus('Wiedergabe konnte nicht gestartet werden');
        stopPlayback();
    }
}

function stopPlayback() {
    if (!state.playback.isPlaying) return;
    
    state.playback.isPlaying = false;
    elements.playBtn.disabled = false;
    elements.stopBtn.disabled = true;
    
    if (state.playback.intervalId) {
        clearInterval(state.playback.intervalId);
        state.playback.intervalId = null;
    }
    
    state.playback.currentIndex = 0;
    updateProgressionDisplay();
    setStatus('Wiedergabe gestoppt');
}

function restartPlayback() {
    if (state.playback.isPlaying) {
        stopPlayback();
        setTimeout(startPlayback, 100);
    }
}

function playCurrentChord() {
    if (!state.playback.isPlaying || state.progression.length === 0) return;
    
    const chord = state.progression[state.playback.currentIndex];
    if (chord) {
        playChord(chord.roman);
        updateProgressionDisplay();
    }
}

// ===== UI FUNCTIONS =====
function updateUI() {
    // Settings
    elements.keySelect.value = state.settings.key;
    elements.scaleSelect.value = state.settings.scale;
    elements.bpmSlider.value = state.settings.bpm;
    elements.bpmValue.textContent = state.settings.bpm;
    
    // Theme
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    elements.themeToggle.textContent = state.settings.theme === 'dark' ? '☀️' : '🌙';
    elements.themeToggle.title = state.settings.theme === 'dark' ? 'Helles Theme' : 'Dunkles Theme';
    
    // Progression
    updateProgressionDisplay();
}

function updateProgressionDisplay() {
    const list = elements.progressionList;
    const empty = elements.progressionEmpty;
    
    if (state.progression.length === 0) {
        list.style.display = 'none';
        empty.style.display = 'block';
        return;
    }
    
    list.style.display = 'grid';
    empty.style.display = 'none';
    
    list.innerHTML = state.progression.map((chord, index) => {
        const isPlaying = state.playback.isPlaying && state.playback.currentIndex === index;
        const rootNote = getRootNote(chord.roman);
        
        return `
            <li class="chord-item ${isPlaying ? 'playing' : ''}" role="listitem">
                <div class="chord-info">
                    <span class="chord-name">${chord.roman}</span>
                    <span class="chord-index">${index + 1}</span>
                </div>
                <div class="chord-details">
                    <small>Grundton: ${rootNote}</small>
                </div>
                <div class="chord-controls">
                    <button onclick="moveChord('${chord.id}', 'up')" 
                            title="Nach oben verschieben"
                            ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button onclick="moveChord('${chord.id}', 'down')" 
                            title="Nach unten verschieben"
                            ${index === state.progression.length - 1 ? 'disabled' : ''}>↓</button>
                    <button onclick="playChord('${chord.roman}')" 
                            title="Akkord anspielen">♪</button>
                    <button onclick="removeChord('${chord.id}')" 
                            title="Akkord entfernen" 
                            class="danger">×</button>
                </div>
            </li>
        `;
    }).join('');
}

function toggleTheme() {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    saveState();
    updateUI();
    setStatus(`${state.settings.theme === 'dark' ? 'Dunkles' : 'Helles'} Theme aktiviert`);
}

function setStatus(message) {
    elements.status.textContent = message;
    console.log('Status:', message);
}

// ===== DATA FUNCTIONS =====
function saveState() {
    try {
        const data = {
            progression: state.progression,
            settings: state.settings,
            timestamp: Date.now(),
            version: '1.0'
        };
        localStorage.setItem('chordProgressionApp', JSON.stringify(data));
    } catch (error) {
        console.error('Save failed:', error);
        setStatus('Speichern fehlgeschlagen');
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem('chordProgressionApp');
        if (!saved) return;
        
        const data = JSON.parse(saved);
        
        // Validate and merge data
        if (data.progression && Array.isArray(data.progression)) {
            state.progression = data.progression;
        }
        
        if (data.settings && typeof data.settings === 'object') {
            state.settings = { ...state.settings, ...data.settings };
        }
        
        setStatus('Daten geladen');
    } catch (error) {
        console.error('Load failed:', error);
        setStatus('Laden fehlgeschlagen');
    }
}

function exportData() {
    try {
        const data = {
            progression: state.progression,
            settings: state.settings,
            exported: new Date().toISOString(),
            version: '1.0'
        };
        
        const jsonString = JSON.stringify(data, null, 2);
        elements.exportArea.value = jsonString;
        elements.exportArea.select();
        
        // Try to copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(jsonString).then(() => {
                setStatus('Daten exportiert und in Zwischenablage kopiert');
            }).catch(() => {
                setStatus('Daten exportiert');
            });
        } else {
            setStatus('Daten exportiert');
        }
        
    } catch (error) {
        console.error('Export failed:', error);
        setStatus('Export fehlgeschlagen');
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate structure
            if (!data.progression || !Array.isArray(data.progression)) {
                throw new Error('Ungültige Datenstruktur');
            }
            
            // Confirm import
            if (!confirm(`${data.progression.length} Akkorde importieren? Aktuelle Daten werden überschrieben.`)) {
                return;
            }
            
            // Stop playback
            stopPlayback();
            
            // Import data
            state.progression = data.progression;
            if (data.settings) {
                state.settings = { ...state.settings, ...data.settings };
            }
            
            saveState();
            updateUI();
            setStatus(`${data.progression.length} Akkorde importiert`);
            
        } catch (error) {
            console.error('Import failed:', error);
            setStatus('Import fehlgeschlagen: Ungültige Datei');
        }
    };
    
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// ===== KEYBOARD HANDLING =====
function handleKeyboard(event) {
    // Escape to stop playback
    if (event.key === 'Escape' && state.playback.isPlaying) {
        stopPlayback();
        return;
    }
    
    // Space to play/stop (if not in input)
    if (event.key === ' ' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        event.preventDefault();
        if (state.playback.isPlaying) {
            stopPlayback();
        } else {
            startPlayback();
        }
        return;
    }
    
    // Enter to add chord (if chord selected)
    if (event.key === 'Enter' && event.target === elements.chordInput) {
        event.preventDefault();
        if (elements.chordInput.value) {
            addChord();
        }
        return;
    }
}

// ===== GLOBAL FUNCTIONS (for inline event handlers) =====
window.moveChord = moveChord;
window.removeChord = removeChord;
window.playChord = playChord;

// ===== ERROR HANDLING =====
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    setStatus('Ein Fehler ist aufgetreten');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    setStatus('Ein Fehler ist aufgetreten');
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
    stopPlayback();
    if (state.audio.context) {
        state.audio.context.close();
    }
});
