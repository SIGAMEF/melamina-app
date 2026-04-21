// === APP.JS v7 ===
// Solo vista split (2D+3D) y Plan de Corte — sin vistas "solo 2D" / "solo 3D" no funcionales

let _currentView='split';

function initApp() {
  const firstMod=createModule({
    type:   STATE._wizardType  ||'mueble-alto',
    mount:  STATE._wizardMount ||'libre',
    ancho:  STATE._wizardAncho ||90,
    alto:   STATE._wizardAlto  ||200,
    prof:   STATE._wizardProf  ||45,
    conFondo: STATE._wizardFondo!==undefined?STATE._wizardFondo:true,
    conRail:  STATE._wizardRail||false,
    offsetX:10, offsetY:10,
  });
  STATE.modules=[firstMod];
  STATE.activeModuleId=firstMod.id;
  STATE.thick=STATE._wizardThick||18;

  // Sync UI
  document.getElementById('ctrl-ancho').value=firstMod.ancho;
  document.getElementById('ctrl-alto').value=firstMod.alto;
  document.getElementById('ctrl-prof').value=firstMod.prof;
  document.getElementById('ctrl-grosor').value=STATE.thick;
  syncTogglePillsFromModule(firstMod);

  initCanvas2D();
  initCanvas3D();
  centerView();
  recalc();
  redraw2D();
  redraw3D();
  updatePanelLists(firstMod);
  updateModuleSelector();

  window.addEventListener('resize', onResize);
  setView('split');
  setTimeout(onResize, 60);
}

function onResize(){
  sizeAllCanvases();
  redraw2D();
  redraw3D();
}

function sizeAllCanvases(){
  const area=document.getElementById('canvas-area'); if(!area) return;
  const aH=Math.max(200,area.clientHeight-50), aW=area.clientWidth;
  const half=Math.floor((aW-4)/2);
  sz('main-canvas',half,aH);
  sz('canvas-3d',half,aH);
}
function sz(id,w,h){const c=document.getElementById(id);if(c&&w>0&&h>0){c.width=w;c.height=h;}}

// ─── View switching — solo split y cut ─────────────────────────────────────
function setView(view){
  _currentView=view;
  ['split','cut'].forEach(v=>{
    document.getElementById('view-'+v)?.classList.toggle('active',v===view);
    document.getElementById('btn-view-'+v)?.classList.toggle('active',v===view);
  });
  sizeAllCanvases();
  if(view==='split'){ redraw2D(); redraw3D(); }
  if(view==='cut')  { renderCutPlan(); }
}

// ─── Dimensiones ────────────────────────────────────────────────────────────
function updateDimension(key,value){
  const v=parseFloat(value); if(isNaN(v)||v<=0) return;
  const mod=getActiveModule(); if(!mod) return;
  if(key==='ancho') mod.ancho=Math.max(5,Math.min(500,v));
  if(key==='alto')  mod.alto =Math.max(5,Math.min(500,v));
  if(key==='prof')  mod.prof =Math.max(5,Math.min(200,v));
  if(key==='grosor'){STATE.thick=parseInt(value);const ng=document.getElementById('note-grosor');if(ng)ng.textContent=STATE.thick;}

  // Re-distribuir automáticamente
  if(mod.divisions.length&&key==='ancho'){const n=mod.divisions.length;mod.divisions.forEach((d,i)=>{d.pos=parseFloat(((mod.ancho/(n+1))*(i+1)).toFixed(1));});}
  if(mod.shelves.length&&key==='alto')   {const n=mod.shelves.length;   mod.shelves.forEach((s,i)  =>{s.pos=parseFloat(((mod.alto/(n+1))*(i+1)).toFixed(1));});}

  recalc(); redraw2D(); redraw3D(); updatePanelLists(mod);
}

function openDimPanel(){document.getElementById('ctrl-ancho')?.focus();}

// ─── Propiedades ────────────────────────────────────────────────────────────
function toggleProp(prop){
  const mod=getActiveModule(); if(!mod) return;
  if(prop==='fondo'){mod.conFondo=!mod.conFondo;if(mod.conFondo)mod.conRail=false;}
  if(prop==='rail') {mod.conRail =!mod.conRail; if(mod.conRail) mod.conFondo=false;}
  if(prop==='patas') mod.conPatas=!mod.conPatas;
  syncTogglePillsFromModule(mod); recalc(); redraw2D(); redraw3D();
}

function syncTogglePillsFromModule(mod){
  if(!mod)return;
  const pill=(id,val)=>{const e=document.getElementById(id);if(!e)return;e.textContent=val?'SÍ':'NO';e.classList.toggle('off',!val);};
  pill('toggle-fondo',mod.conFondo);pill('toggle-rail',mod.conRail);pill('toggle-patas',mod.conPatas);
  const rcr=document.getElementById('rail-count-row');if(rcr)rcr.style.display=mod.conRail?'flex':'none';
  const nrd=document.getElementById('num-rails-display');if(nrd)nrd.textContent=mod.numRails||1;
}
function syncTogglePills(){syncTogglePillsFromModule(getActiveModule());}

function changeNumRails(delta){
  const mod=getActiveModule();if(!mod)return;
  mod.numRails=Math.max(1,Math.min(6,(mod.numRails||1)+delta));
  const el=document.getElementById('num-rails-display');if(el)el.textContent=mod.numRails;
  recalc();redraw2D();redraw3D();
}

// ─── Módulos ─────────────────────────────────────────────────────────────────
function addNewModule(){
  const lastMod=STATE.modules[STATE.modules.length-1];
  const newMod=createModule({
    type:lastMod?.type||'mueble-alto',
    ancho:lastMod?.ancho||90, alto:lastMod?.alto||200, prof:lastMod?.prof||45,
    offsetX:lastMod?lastMod.offsetX+lastMod.ancho+20:10,
    offsetY:lastMod?lastMod.offsetY:10,
  });
  STATE.modules.push(newMod);
  STATE.activeModuleId=newMod.id;
  syncSidebarToModule();
  recalc();redraw2D();redraw3D();
  updateModuleSelector();
}

function updateModuleSelector(){
  const sel=document.getElementById('module-selector');if(!sel)return;
  sel.innerHTML=STATE.modules.map((m,i)=>`<option value="${m.id}" ${m.id===STATE.activeModuleId?'selected':''}>M${i+1}: ${m.ancho}×${m.alto}cm${m._label?' ('+m._label+')':''}</option>`).join('');
}

function selectActiveModule(id){
  STATE.activeModuleId=parseInt(id);
  syncSidebarToModule();
  redraw2D();
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportPDF(){
  setView('cut');
  setTimeout(()=>window.print(),800);
}

// ─── Shortcuts ────────────────────────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
  if(e.key==='Delete'||e.key==='Backspace') deleteSelected();
  if(e.key==='1') setView('split');
  if(e.key==='4') setView('cut');
  if(e.key==='v'||e.key==='V') setCurrentTool('select');
  if(e.key==='l'||e.key==='L') setCurrentTool('line');
  if(e.key==='a'||e.key==='A') setCurrentTool('angle');
  if(e.key==='c'||e.key==='C') setCurrentTool('arc');
  if(e.key==='x'||e.key==='X') setCurrentTool('explode');
  if(e.key==='+'||e.key==='=') zoom(1.2);
  if(e.key==='-') zoom(0.8);
  if(e.key==='0') resetZoom();
  if(e.key==='Escape'){lineState=null;STATE.selectedItem=null;if(typeof hideSelectedPanel==='function')hideSelectedPanel();redraw2D();}
});

function nuevoMueble(){
  STATE.modules=[];STATE.shapes=[];STATE.selectedItem=null;_idCounter=1;
  document.getElementById('wizard').style.display='flex';
  const app=document.getElementById('app');
  app.classList.add('app-hidden');app.classList.remove('app-visible');
}
