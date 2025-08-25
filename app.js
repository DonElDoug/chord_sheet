// Chord Progression App (Vanilla JS)
// Modern UI wired to index.html + styles.css

// ===== Constants =====
const SLOTS_PER_BAR = 4;
const ROMANS = ["I", "ii", "iii", "IV", "V", "vi", "viiø"];

// ===== State =====
const state = {
  title: "",
  artist: "",
  bpm: "",
  key: "",
  sections: [ makeSection("Intro", 2) ]
};

function makeSection(name, bars) {
  return { id: cryptoId(), name, bars: Array.from({ length: bars }, makeBar) };
}
function makeBar() {
  return { slots: Array.from({ length: SLOTS_PER_BAR }, () => null) };
}
function cryptoId() { return Math.random().toString(36).slice(2, 9); }

// ===== DOM =====
const els = {
  title: document.getElementById('songTitle'),
  artist: document.getElementById('songArtist'),
  bpm: document.getElementById('songBpm'),
  key: document.getElementById('songKey'),
  addSection: document.getElementById('addSectionBtn'),
  sections: document.getElementById('sectionsContainer')
};

// dynamic popovers
let romanOverlay = null; // { sIdx, bIdx, slot }

// ===== Init =====
attachEvents();
render();

function attachEvents() {
  els.addSection.addEventListener('click', () => { state.sections.push(makeSection('New Section', 2)); render(); });
  els.title.addEventListener('input', () => state.title = els.title.value);
  els.artist.addEventListener('input', () => state.artist = els.artist.value);
  els.bpm.addEventListener('input', () => state.bpm = els.bpm.value);
  els.key.addEventListener('input', () => state.key = els.key.value);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRomanMenu(); });
}

// (no-op utils kept minimal)

// ===== Render =====
function render() {
  // Update header inputs
  els.title.value = state.title;
  els.artist.value = state.artist;
  els.bpm.value = state.bpm;
  els.key.value = state.key;

  // Render sections
  els.sections.innerHTML = '';
  state.sections.forEach((section, sIdx) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'section';

    // Section label on the left
    const label = document.createElement('input');
    label.className = 'section-label';
    label.value = section.name;
    label.addEventListener('input', () => section.name = label.value);

    // Bars on the right
    const barsContainer = document.createElement('div');
    barsContainer.className = 'section-bars';

    section.bars.forEach((bar, bIdx) => {
      const barEl = document.createElement('div');
      barEl.className = 'bar';

      // Bar number
      const barNumber = document.createElement('div');
      barNumber.className = 'bar-number';
      barNumber.textContent = bIdx + 1;
      barEl.appendChild(barNumber);

      // Slots
      const slotsContainer = document.createElement('div');
      slotsContainer.className = 'bar-slots';

      for (let slot = 0; slot < SLOTS_PER_BAR; slot++) {
        const slotEl = document.createElement('div');
        slotEl.className = 'slot';
        slotEl.dataset.slot = slot;

        const chordObj = bar.slots[slot];
        if (chordObj) {
          slotEl.innerHTML = `<div class="chord">${chordObj.roman}</div>`;
        } else {
          slotEl.innerHTML = `<div class="empty-slot">·</div>`;
        }

        // Click to open roman picker
        slotEl.addEventListener('click', (e) => {
          e.stopPropagation();
          openRomanMenu({ sIdx, bIdx, slot });
        });

        slotsContainer.appendChild(slotEl);
      }

      barEl.appendChild(slotsContainer);
      barsContainer.appendChild(barEl);
    });

    sectionEl.appendChild(label);
    sectionEl.appendChild(barsContainer);
    els.sections.appendChild(sectionEl);

    // Section controls
    const controls = document.createElement('div');
    controls.className = 'section-controls';
    
    const addBarBtn = button('+ Bar', 'btn', () => { section.bars.push(makeBar()); render(); });
    const delBtn = button('Delete Section', 'btn danger', () => { state.sections.splice(sIdx, 1); render(); });
    
    controls.append(addBarBtn, delBtn);
    els.sections.appendChild(controls);
  });
}

function button(text, cls, onClick){ const b=document.createElement('button'); b.className=cls; b.textContent=text; b.addEventListener('click', onClick); return b; }

function setSlot(sIdx,bIdx,slot,val){ state.sections[sIdx].bars[bIdx].slots[slot]=val; render(); }

// ===== Menus =====
function openRomanMenu(ctx) {
  closeRomanMenu();
  romanOverlay = ctx;
  
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.id = 'romanMenu';
  
  menu.innerHTML = `
    <div class="menu-content">
      <h3>Choose Roman Numeral</h3>
      <div class="roman-grid">
        ${ROMANS.map(r => `<button class="roman-btn" data-r="${r}">${r}</button>`).join('')}
      </div>
      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button class="btn" id="clearChord">Clear</button>
        <button class="btn" id="closeRoman">Cancel</button>
      </div>
    </div>`;
  
  document.body.appendChild(menu);
  
  // Event handlers
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    if (btn.id === 'closeRoman') {
      closeRomanMenu();
    } else if (btn.id === 'clearChord') {
      setSlot(ctx.sIdx, ctx.bIdx, ctx.slot, null);
      closeRomanMenu();
    } else {
      const r = btn.getAttribute('data-r');
      if (r) {
        setSlot(ctx.sIdx, ctx.bIdx, ctx.slot, { roman: r });
        closeRomanMenu();
      }
    }
  });
  
  // Click outside to close
  menu.addEventListener('click', (e) => {
    if (e.target === menu) closeRomanMenu();
  });
}

function closeRomanMenu() {
  const m = document.getElementById('romanMenu');
  if (m) {
    m.remove();
    romanOverlay = null;
  }
}
// Utilities
document.addEventListener('contextmenu', (e)=>{
  if (e.target.closest('.bar') || e.target.closest('.chord')) e.preventDefault();
});
