// Chord Progression App (Vanilla JS)
// Modern UI wired to index.html + styles.css

// ===== Constants =====
const SLOTS_PER_BAR = 4;
const ROMANS = ["I", "ii", "iii", "IV", "V", "vi", "viiø"];

// ===== State =====
const state = {
  title: "",
  artist: "",
  sections: [ makeSection("Intro", 4) ]
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
  addSection: document.getElementById('addSectionBtn'),
  sections: document.getElementById('sectionsContainer'),
  romanMenu: null
};

// dynamic popovers
let romanOverlay = null; // { sIdx, bIdx, slot }

// ===== Init =====
attachEvents();
render();

function attachEvents() {
  els.addSection.addEventListener('click', () => { state.sections.push(makeSection('New Section', 4)); render(); });
  els.title.addEventListener('input', () => state.title = els.title.value);
  els.artist.addEventListener('input', () => state.artist = els.artist.value);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRomanMenu(); });
}

// (no-op utils kept minimal)

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

  // no repeat handles in simplified version

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
          label.textContent = chordObj.roman;
          chordEl.appendChild(label);

          const closeBtn = document.createElement('button');
          closeBtn.className = 'close';
          closeBtn.title = 'Clear this slot';
          closeBtn.textContent = '×';
          closeBtn.addEventListener('click', (e)=>{ e.stopPropagation(); setSlot(sIdx,bIdx,slot,null); });
          chordEl.appendChild(closeBtn);

          // Click/Enter to change roman
          chordEl.addEventListener('click', (e)=>{
            e.stopPropagation();
            openRomanMenu(e.clientX, e.clientY, { sIdx, bIdx, slot });
          });
          chordEl.addEventListener('keydown', (e)=>{
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const r = slotEl.getBoundingClientRect();
              openRomanMenu(r.left + r.width/2, r.top + r.height/2, { sIdx, bIdx, slot });
            }
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

          // Also allow clicking the slot background
          slotEl.addEventListener('click', (e)=>{
            // ignore if the button handled it
            if (e.target === addBtn) return;
            const r = slotEl.getBoundingClientRect();
            openRomanMenu(r.left + r.width/2, r.top + r.height/2, { sIdx, bIdx, slot });
          });
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
      setSlot(ctx.sIdx, ctx.bIdx, ctx.slot, { roman: r });
      closeRomanMenu();
    }
  });
  // click outside to close
  menu.addEventListener('mousedown', (e)=>{ if (e.target === menu) closeRomanMenu(); });
}
function closeRomanMenu(){ const m=document.getElementById('romanMenu'); if(m){ m.remove(); romanOverlay=null; } }
// Utilities
document.addEventListener('contextmenu', (e)=>{
  if (e.target.closest('.bar') || e.target.closest('.chord')) e.preventDefault();
});
