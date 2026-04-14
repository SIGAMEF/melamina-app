// === APP.JS v5 ===
// Arquitectura limpia: cada canvas tiene su ID fijo, no hay rerouting.
// Split view: main-canvas (2D) + canvas-3d (3D) simultáneamente.
// Solo 2D: main-canvas-solo. Solo 3D: canvas-3d-solo.

let _currentView = 'split';

function initApp() {
  document.getElementById('ctrl-ancho').value  = STATE.ancho;
  document.getElementById('ctrl-alto').value   = STATE.alto;
  document.getElementById('ctrl-prof').value   = STATE.prof;
  document.getElementById('ctrl-grosor').value = STATE.thick;

  syncTogglePills();

  // Inicializar canvas 2D apuntado a main-canvas (split view por defecto)
  initCanvas2D();
  initCanvas3D();

  recalc();
  redraw2D();
  redraw3D();
  updatePanelLists();

  window.addEventListener('resize', onResize);
  setView('split');
  setTimeout(onResize, 50); // asegurar tamaños correctos
}

function onResize() {
  sizeAllCanvases();
  redraw2D();
  redraw3D();
}

function sizeAllCanvases() {
  const area = document.getElementById('canvas-area');
  if (!area) return;
  const areaH = Math.max(200, area.clientHeight - 50);
  const areaW = area.clientWidth;

  if (_currentView === 'split') {
    const half = Math.floor((areaW - 4) / 2);
    sz('main-canvas',      half, areaH);
    sz('canvas-3d',        half, areaH);
  } else if (_currentView === '2d') {
    sz('main-canvas-solo', areaW, areaH);
  } else if (_currentView === '3d') {
    sz('canvas-3d-solo',   areaW, areaH);
  }
  // También dimensionar los ocultos por si el usuario cambia de vista
  const half = Math.floor((areaW - 4) / 2);
  sz('main-canvas',      half, areaH);
  sz('canvas-3d',        half, areaH);
}

function sz(id, w, h) {
  const c = document.getElementById(id);
  if (c && w > 0 && h > 0) { c.width = w; c.height = h; }
}

// ─── View switching ────────────────────────────────────────────────────────
function setView(view) {
  _currentView = view;
  ['split','2d','3d','cut'].forEach(v => {
    document.getElementById('view-'+v)?.classList.toggle('active', v===view);
    document.getElementById('btn-view-'+v)?.classList.toggle('active', v===view);
  });

  sizeAllCanvases();

  if (view==='split'||view==='2d') {
    // canvas2d usa siempre main-canvas; en split y en solo2d
    const targetId = view==='split' ? 'main-canvas' : 'main-canvas-solo';
    canvas2d = document.getElementById(targetId);
    if (canvas2d) ctx2d = canvas2d.getContext('2d');
    redraw2D();
  }
  if (view==='split'||view==='3d') {
    // 3D actualiza en el canvas visible
    redraw3D();
  }
  if (view==='cut') {
    renderCutPlan();
  }
}

// ─── Dimensiones ──────────────────────────────────────────────────────────
function updateDimension(key, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return;
  if (key==='ancho') STATE.ancho=Math.max(20,Math.min(500,v));
  if (key==='alto')  STATE.alto =Math.max(20,Math.min(500,v));
  if (key==='prof')  STATE.prof =Math.max(10,Math.min(100,v));
  if (key==='grosor'){ STATE.thick=parseInt(value); const ng=document.getElementById('note-grosor'); if(ng) ng.textContent=STATE.thick; }

  // Re-distribuir al cambiar dimensiones
  if (STATE.divisions.length && key==='ancho') {
    const n=STATE.divisions.length;
    STATE.divisions.forEach((d,i)=>{ d.pos=parseFloat(((STATE.ancho/(n+1))*(i+1)).toFixed(1)); });
  }
  if (STATE.shelves.length && key==='alto') {
    const n=STATE.shelves.length;
    STATE.shelves.forEach((s,i)=>{ s.pos=parseFloat(((STATE.alto/(n+1))*(i+1)).toFixed(1)); });
  }

  recalc(); redraw2D(); redraw3D(); updatePanelLists();
}

function openDimPanel() { document.getElementById('ctrl-ancho')?.focus(); }

// ─── Propiedades ──────────────────────────────────────────────────────────
function toggleProp(prop) {
  if (prop==='fondo'){ STATE.conFondo=!STATE.conFondo; if(STATE.conFondo) STATE.conRail=false; }
  if (prop==='rail') { STATE.conRail=!STATE.conRail;   if(STATE.conRail)  STATE.conFondo=false; }
  if (prop==='patas') STATE.conPatas=!STATE.conPatas;
  syncTogglePills(); recalc(); redraw2D(); redraw3D();
}

function syncTogglePills() {
  const pill=(id,val)=>{ const e=document.getElementById(id); if(!e) return; e.textContent=val?'SÍ':'NO'; e.classList.toggle('off',!val); };
  pill('toggle-fondo',STATE.conFondo);
  pill('toggle-rail', STATE.conRail);
  pill('toggle-patas',STATE.conPatas);
  const rcr=document.getElementById('rail-count-row');
  if(rcr) rcr.style.display=STATE.conRail?'flex':'none';
}

function changeNumRails(delta) {
  STATE.numRails=Math.max(1,Math.min(6,(STATE.numRails||1)+delta));
  const el=document.getElementById('num-rails-display'); if(el) el.textContent=STATE.numRails;
  recalc(); redraw2D(); redraw3D();
}

// ─── Export ───────────────────────────────────────────────────────────────
function exportPDF() {
  setView('cut');
  setTimeout(()=>window.print(), 700);
}

// ─── Shortcuts ────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
  if (e.key==='Delete'||e.key==='Backspace') deleteSelected();
  if (e.key==='1') setView('split');
  if (e.key==='2') setView('2d');
  if (e.key==='3') setView('3d');
  if (e.key==='4') setView('cut');
  if (e.key==='d') addDivision();
  if (e.key==='s') addShelf();
  if (e.key==='+'||e.key==='=') zoom(1.2);
  if (e.key==='-') zoom(0.8);
  if (e.key==='0') resetZoom();
  if (e.key==='Escape'){ STATE.selectedItem=null; if(typeof hideSelectedPanel==='function') hideSelectedPanel(); redraw2D(); }
});
