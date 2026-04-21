// === CANVAS2D.JS v8 ===
// EXPLOTAR: desagrupa el módulo IN PLACE (sin mover nada).
// Cada cara se vuelve seleccionable/eliminable individualmente.
// La cara eliminada se añade a excludedFaces y desaparece visual y del despiece.
// El módulo mantiene su forma visual con las caras restantes.

let canvas2d, ctx2d;
let zoomFactor=1, panOffX=0, panOffY=0;
let isDragging=false, dragTarget=null, dragType=null, dragEdge=null;
let isPanning=false, panStart={x:0,y:0};
let currentTool='select';
let lineState=null;

const SNAP_PX=10, GRID_SNAP=5;

const COLORS={
  grid:'rgba(255,255,255,0.04)', border:'#d4a843', borderActive:'#3b82f6',
  division:'#4a9eff', divFill:'rgba(74,158,255,0.22)',
  shelf:'#3cb87a', shelfFill:'rgba(60,184,122,0.22)',
  selected:'#ffffff', dim:'#9a9a96', dimLine:'rgba(255,255,255,0.1)',
  rail:'#e05252', railFill:'rgba(224,82,82,0.16)',
  lateral:'rgba(212,168,67,0.18)', latStroke:'#d4a843',
  tapa:'rgba(184,140,46,0.20)', tapStroke:'#b88c2e',
  excluded:'rgba(255,255,255,0.04)', excludedStroke:'rgba(255,255,255,0.1)',
  faceHover:'rgba(255,255,255,0.08)',
  snap:'#facc15', linePreview:'rgba(250,204,21,0.8)',
};

const BASE_SCALE=4;
function ws(){ return BASE_SCALE*zoomFactor; }

function initCanvas2D(){
  canvas2d=document.getElementById('main-canvas');
  if(!canvas2d) return;
  ctx2d=canvas2d.getContext('2d');
  canvas2d.addEventListener('mousedown', onDown);
  canvas2d.addEventListener('mousemove', onMove);
  canvas2d.addEventListener('mouseup',   onUp);
  canvas2d.addEventListener('dblclick',  onDblClick);
  canvas2d.addEventListener('wheel',     onWheel2D, {passive:false});
  canvas2d.addEventListener('mouseleave',()=>{ if(canvas2d) canvas2d.style.cursor='default'; });
  redraw2D();
}

// ─── Coordinate helpers ───────────────────────────────────────────────────
function clientToWorld(cx,cy){
  if(!canvas2d) return{wx:0,wy:0};
  const r=canvas2d.getBoundingClientRect();
  const sx=(cx-r.left)*(canvas2d.width/r.width);
  const sy=(cy-r.top)*(canvas2d.height/r.height);
  return{wx:(sx-panOffX)/ws(), wy:(sy-panOffY)/ws()};
}
function worldToScreen(wx,wy){ return{sx:wx*ws()+panOffX, sy:wy*ws()+panOffY}; }
function snapGrid(v){ return Math.round(v/GRID_SNAP)*GRID_SNAP; }

function snapToModule(wx,wy){
  let best={wx, wy, snapX:false, snapY:false, modId:null};
  for(const mod of STATE.modules){
    const ox=mod.offsetX, oy=mod.offsetY;
    const lx=wx-ox, ly=wy-oy;
    const tol=SNAP_PX/ws();
    const vLines=[0, mod.ancho, ...mod.divisions.map(d=>d.pos)];
    for(const vx of vLines){ if(Math.abs(lx-vx)<tol){best.wx=ox+vx;best.snapX=true;best.modId=mod.id;} }
    const hLines=[0, mod.alto, ...mod.shelves.map(s=>s.pos)];
    for(const hy of hLines){ if(Math.abs(ly-hy)<tol){best.wy=oy+hy;best.snapY=true;best.modId=mod.id;} }
  }
  if(!best.snapX) best.wx=snapGrid(wx);
  if(!best.snapY) best.wy=snapGrid(wy);
  return best;
}

function centerView(){
  if(!canvas2d||!STATE.modules.length) return;
  const mod=STATE.modules[0];
  panOffX=canvas2d.width/2-(mod.offsetX+mod.ancho/2)*ws();
  panOffY=canvas2d.height/2-(mod.offsetY+mod.alto/2)*ws();
}

// ─── Main draw ────────────────────────────────────────────────────────────
function redraw2D(){
  if(!ctx2d||!canvas2d) return;
  const W=canvas2d.width, H=canvas2d.height;
  ctx2d.clearRect(0,0,W,H);
  drawGrid(W,H);
  STATE.modules.forEach(mod=>drawModule(mod));
  drawLineToolPreview();
  updateInfoBar();
}

function drawGrid(W,H){
  const step=10*ws();
  ctx2d.strokeStyle=COLORS.grid; ctx2d.lineWidth=0.5;
  for(let x=panOffX%step;x<W;x+=step){ctx2d.beginPath();ctx2d.moveTo(x,0);ctx2d.lineTo(x,H);ctx2d.stroke();}
  for(let y=panOffY%step;y<H;y+=step){ctx2d.beginPath();ctx2d.moveTo(0,y);ctx2d.lineTo(W,y);ctx2d.stroke();}
}

// Convierte faceKey a color para modo explotado
const FACE_COLORS={
  'lateral-izq':'rgba(212,168,67,0.35)',
  'lateral-der':'rgba(212,168,67,0.35)',
  'tapa-sup':'rgba(184,140,46,0.35)',
  'tapa-inf':'rgba(184,140,46,0.35)',
  'fondo':'rgba(224,82,82,0.25)',
};
function faceColor(key){
  if(key.startsWith('div-v'))   return 'rgba(74,158,255,0.35)';
  if(key.startsWith('shelf'))   return 'rgba(60,184,122,0.35)';
  if(key.startsWith('rail'))    return 'rgba(160,100,200,0.35)';
  return FACE_COLORS[key]||'rgba(200,200,200,0.2)';
}
function faceStroke(key){
  if(key.startsWith('div-v'))  return '#4a9eff';
  if(key.startsWith('shelf'))  return '#3cb87a';
  if(key.startsWith('rail'))   return '#e05252';
  if(key==='lateral-izq'||key==='lateral-der') return '#d4a843';
  if(key==='tapa-sup'||key==='tapa-inf')       return '#b88c2e';
  if(key==='fondo')                             return '#e05252';
  return '#888';
}

function drawModule(mod){
  const W=ws(), t=STATE.thick/10;
  const isActive=mod.id===STATE.activeModuleId;
  const ox=mod.offsetX, oy=mod.offsetY;
  const a=mod.ancho, h=mod.alto, p=mod.prof, netA=a-2*t;
  const s=worldToScreen(ox,oy);
  const fw=a*W, fh=h*W, ts=t*W;
  const ex=mod.excludedFaces||new Set();

  // ── Modo EXPLOTADO: dibuja caras individuales seleccionables ──
  if(mod.exploded){
    drawExplodedModule(mod, s, fw, fh, ts, t, netA, ex);
  } else {
    // Modo normal
    if(mod.conFondo){ ctx2d.fillStyle='rgba(255,255,255,0.02)'; ctx2d.fillRect(s.sx,s.sy,fw,fh); }

    // Laterales
    if(!ex.has('lateral-izq')) solidRect(s.sx,s.sy,ts,fh,COLORS.latStroke,COLORS.lateral);
    else dimmedRect(s.sx,s.sy,ts,fh);
    if(!ex.has('lateral-der')) solidRect(s.sx+fw-ts,s.sy,ts,fh,COLORS.latStroke,COLORS.lateral);
    else dimmedRect(s.sx+fw-ts,s.sy,ts,fh);

    // Tapas
    if(!ex.has('tapa-sup')) solidRect(s.sx+ts,s.sy,fw-2*ts,ts,COLORS.tapStroke,COLORS.tapa);
    else dimmedRect(s.sx+ts,s.sy,fw-2*ts,ts);
    if(!ex.has('tapa-inf')) solidRect(s.sx+ts,s.sy+fh-ts,fw-2*ts,ts,COLORS.tapStroke,COLORS.tapa);
    else dimmedRect(s.sx+ts,s.sy+fh-ts,fw-2*ts,ts);

    // Rails
    if(mod.conRail){
      const n=Math.max(1,parseInt(mod.numRails)||1);
      const rh=8*W, sp=(fh-2*ts)/(n+1);
      for(let i=1;i<=n;i++){
        if(ex.has(`rail-${i-1}`)) continue;
        const ry=s.sy+ts+sp*i-rh/2;
        ctx2d.fillStyle=COLORS.railFill; ctx2d.fillRect(s.sx+ts,ry,fw-2*ts,rh);
        ctx2d.strokeStyle=COLORS.rail; ctx2d.lineWidth=1;
        ctx2d.setLineDash([4,3]); ctx2d.strokeRect(s.sx+ts,ry,fw-2*ts,rh); ctx2d.setLineDash([]);
        ctx2d.fillStyle=COLORS.rail; ctx2d.font=`${Math.max(7,8*zoomFactor)}px Space Grotesk,sans-serif`;
        ctx2d.textAlign='center'; ctx2d.fillText(`RAIL${n>1?' '+i:''}`,s.sx+ts+(fw-2*ts)/2,ry+rh/2+3);
      }
    }

    // Divisiones
    mod.divisions.forEach((div,idx)=>{
      const key=`div-v-${idx}`;
      const isSel=isSelItem('division',div.id,mod.id);
      const dx=s.sx+div.pos*W;
      const sf=div.startFrac||0, ef=div.endFrac||1;
      const intH=fh-2*ts;
      const panY=s.sy+ts+sf*intH, panH=(ef-sf)*intH;
      if(!ex.has(key)){
        ctx2d.fillStyle=isSel?'rgba(74,158,255,0.38)':COLORS.divFill;
        ctx2d.fillRect(dx-ts/2,panY,ts,panH);
        ctx2d.strokeStyle=isSel?COLORS.selected:COLORS.division;
        ctx2d.lineWidth=isSel?2:1;
        ctx2d.strokeRect(dx-ts/2,panY,ts,panH);
        ctx2d.fillStyle=COLORS.division; ctx2d.font=`${Math.max(7,7*zoomFactor)}px Space Grotesk,sans-serif`;
        ctx2d.textAlign='center'; ctx2d.fillText(`${div.pos.toFixed(1)}`,dx,s.sy+fh+13);
        if(isSel){drawHandle(dx,panY,COLORS.division);drawHandle(dx,panY+panH,COLORS.division);}
      } else { dimmedRect(dx-ts/2,panY,ts,panH); }
    });

    // Estantes
    const sortedDivs=[...mod.divisions].sort((a,b)=>a.pos-b.pos);
    mod.shelves.forEach((sh,idx)=>{
      const isSel=isSelItem('shelf',sh.id,mod.id);
      const sy2=s.sy+fh-sh.pos*W;
      const sf=sh.startFrac||0, ef=sh.endFrac||1;
      const xLcm=t+sf*netA, xRcm=t+ef*netA;
      const inside=sortedDivs.filter(d=>d.pos>xLcm+0.1&&d.pos<xRcm-0.1);
      const cuts=[xLcm,...inside.map(d=>d.pos),xRcm];
      for(let ci=0;ci<cuts.length-1;ci++){
        const key=`shelf-${idx}-${ci}`;
        const lAdj=cuts[ci]+(ci>0?t/2:0);
        const rAdj=cuts[ci+1]-(ci<cuts.length-2?t/2:0);
        if(rAdj-lAdj<0.2) continue;
        const sxPx=s.sx+lAdj*W, swPx=(rAdj-lAdj)*W, shPx=Math.max(2,ts);
        if(!ex.has(key)){
          ctx2d.fillStyle=isSel?'rgba(60,184,122,0.38)':COLORS.shelfFill;
          ctx2d.fillRect(sxPx,sy2-shPx/2,swPx,shPx);
          ctx2d.strokeStyle=isSel?COLORS.selected:COLORS.shelf;
          ctx2d.lineWidth=isSel?2:1;
          ctx2d.strokeRect(sxPx,sy2-shPx/2,swPx,shPx);
        } else { dimmedRect(sxPx,sy2-shPx/2,swPx,shPx); }
      }
      ctx2d.fillStyle=COLORS.shelf; ctx2d.font=`${Math.max(7,7*zoomFactor)}px Space Grotesk,sans-serif`;
      ctx2d.textAlign='left'; ctx2d.fillText(`${sh.pos.toFixed(1)}`,s.sx+fw+5,sy2+3);
      if(isSel){ drawHandle(s.sx+(t+sf*netA)*W,sy2,COLORS.shelf); drawHandle(s.sx+(t+ef*netA)*W,sy2,COLORS.shelf); }
    });
  }

  // Marco exterior
  ctx2d.strokeStyle=isActive?COLORS.borderActive:COLORS.border;
  ctx2d.lineWidth=isActive?2:1.5;
  ctx2d.strokeRect(s.sx,s.sy,fw,fh);

  // Cotas
  drawCotas(mod,s,fw,fh);

  // Etiqueta multi-módulo
  if(STATE.modules.length>1){
    const idx=STATE.modules.indexOf(mod);
    ctx2d.fillStyle=isActive?COLORS.borderActive:COLORS.border;
    ctx2d.font=`bold ${Math.max(9,10*zoomFactor)}px Space Grotesk,sans-serif`;
    ctx2d.textAlign='left';
    ctx2d.fillText(`M${idx+1}: ${mod.ancho}×${mod.alto}cm${mod.exploded?' [EXPLOTADO]':''}`,s.sx,s.sy-10);
  }
}

// ─── Modo explotado: cada cara es un rectángulo seleccionable ─────────────
function drawExplodedModule(mod, s, fw, fh, ts, t, netA, ex){
  const W=ws();
  const faces=getModuleFaces(mod);

  faces.forEach(face=>{
    const isSel=STATE.selectedItem?.type==='face'&&STATE.selectedItem?.faceKey===face.key&&STATE.selectedItem?.moduleId===mod.id;
    const isExcl=ex.has(face.key);

    if(isExcl){
      // Cara eliminada: mostrar muy tenue con tachado
      dimmedRect(face.px,face.py,face.pw,face.ph);
      // Tachado
      ctx2d.strokeStyle='rgba(239,68,68,0.25)'; ctx2d.lineWidth=1;
      ctx2d.beginPath();
      ctx2d.moveTo(face.px,face.py); ctx2d.lineTo(face.px+face.pw,face.py+face.ph); ctx2d.stroke();
      ctx2d.moveTo(face.px+face.pw,face.py); ctx2d.lineTo(face.px,face.py+face.ph); ctx2d.stroke();
      return;
    }

    const fc=faceColor(face.key), fs=faceStroke(face.key);
    ctx2d.fillStyle=isSel?fc.replace(/[\d.]+\)$/,'0.55)'):fc;
    ctx2d.fillRect(face.px,face.py,face.pw,face.ph);
    ctx2d.strokeStyle=isSel?COLORS.selected:fs;
    ctx2d.lineWidth=isSel?2.5:1;
    ctx2d.strokeRect(face.px+0.5,face.py+0.5,face.pw-1,face.ph-1);

    // Etiqueta
    if(face.pw>30&&face.ph>12){
      ctx2d.fillStyle=isSel?'#fff':fs;
      ctx2d.font=`${Math.max(7,Math.min(11,face.pw/8))}px Space Grotesk,sans-serif`;
      ctx2d.textAlign='center'; ctx2d.textBaseline='middle';
      ctx2d.fillText(face.shortLabel,face.px+face.pw/2,face.py+face.ph/2);
      ctx2d.textBaseline='alphabetic';
    }

    if(isSel){ drawHandle(face.px,face.py,fs); drawHandle(face.px+face.pw,face.py+face.ph,fs); }
  });

  // Indicador de modo explotado
  ctx2d.fillStyle='rgba(245,158,11,0.7)'; ctx2d.font=`bold ${Math.max(8,9*zoomFactor)}px Space Grotesk,sans-serif`;
  ctx2d.textAlign='center';
  ctx2d.fillText('↑ clic en cara para seleccionar → Supr para eliminar',s.sx+fw/2,s.sy+fh+28);
}

// Genera la lista de caras POSICIONADAS en píxeles de pantalla para el módulo
function getModuleFaces(mod){
  const W=ws(), t=STATE.thick/10;
  const s=worldToScreen(mod.offsetX, mod.offsetY);
  const fw=mod.ancho*W, fh=mod.alto*W, ts=t*W, netA=mod.ancho-2*t;
  const faces=[];

  const f=(key,shortLabel,px,py,pw,ph)=>faces.push({key,shortLabel,px,py,pw,ph});

  f('lateral-izq','Lat Izq', s.sx,s.sy, ts,fh);
  f('lateral-der','Lat Der', s.sx+fw-ts,s.sy, ts,fh);
  f('tapa-sup','Tapa Sup', s.sx+ts,s.sy, fw-2*ts,ts);
  f('tapa-inf','Tapa Inf', s.sx+ts,s.sy+fh-ts, fw-2*ts,ts);

  if(mod.conFondo) f('fondo','Fondo', s.sx+ts,s.sy+ts, (fw-2*ts),(fh-2*ts));

  const rh=8*W;
  if(mod.conRail){
    const n=Math.max(1,parseInt(mod.numRails)||1);
    const sp=(fh-2*ts)/(n+1);
    for(let i=0;i<n;i++) f(`rail-${i}`,`Rail${n>1?' '+(i+1):''}`, s.sx+ts,s.sy+ts+sp*(i+1)-rh/2, fw-2*ts,rh);
  }

  const intH=fh-2*ts;
  mod.divisions.forEach((div,idx)=>{
    const sf=div.startFrac||0, ef=div.endFrac||1;
    const dx=s.sx+div.pos*W;
    f(`div-v-${idx}`,`Div ${idx+1}`, dx-ts/2,s.sy+ts+sf*intH, ts,(ef-sf)*intH);
  });

  const sortedDivs=[...mod.divisions].sort((a,b)=>a.pos-b.pos);
  mod.shelves.forEach((sh,idx)=>{
    const sfh=sh.startFrac||0, efh=sh.endFrac||1;
    const xL=t+sfh*netA, xR=t+efh*netA;
    const inside=sortedDivs.filter(d=>d.pos>xL+0.1&&d.pos<xR-0.1);
    const cuts=[xL,...inside.map(d=>d.pos),xR];
    const sy2=s.sy+fh-sh.pos*W;
    for(let ci=0;ci<cuts.length-1;ci++){
      const lAdj=cuts[ci]+(ci>0?t/2:0);
      const rAdj=cuts[ci+1]-(ci<cuts.length-2?t/2:0);
      if(rAdj-lAdj>0.2) f(`shelf-${idx}-${ci}`,`Est ${idx+1}${cuts.length>2?'.'+( ci+1):''}`, s.sx+lAdj*W,sy2-ts/2, (rAdj-lAdj)*W,Math.max(2,ts));
    }
  });

  return faces;
}

function dimmedRect(x,y,w,h){
  ctx2d.fillStyle=COLORS.excluded; ctx2d.fillRect(x,y,w,h);
  ctx2d.strokeStyle=COLORS.excludedStroke; ctx2d.lineWidth=0.5; ctx2d.setLineDash([3,3]);
  ctx2d.strokeRect(x,y,w,h); ctx2d.setLineDash([]);
}

// ─── Line tool preview ────────────────────────────────────────────────────
function drawLineToolPreview(){
  if(!lineState||!lineState._mouseWX) return;
  const s1=worldToScreen(lineState.startX,lineState.startY);
  const s2=worldToScreen(lineState._mouseWX,lineState._mouseWY);
  ctx2d.strokeStyle=COLORS.linePreview; ctx2d.lineWidth=1.5;
  ctx2d.setLineDash([6,4]);
  ctx2d.beginPath(); ctx2d.moveTo(s1.sx,s1.sy); ctx2d.lineTo(s2.sx,s2.sy); ctx2d.stroke();
  ctx2d.setLineDash([]);
  if(lineState._snapX||lineState._snapY){
    ctx2d.beginPath(); ctx2d.arc(s2.sx,s2.sy,5,0,Math.PI*2);
    ctx2d.fillStyle=COLORS.snap; ctx2d.fill();
  }
  const dx=lineState._mouseWX-lineState.startX, dy=lineState._mouseWY-lineState.startY;
  const len=Math.sqrt(dx*dx+dy*dy);
  ctx2d.fillStyle='rgba(250,204,21,0.9)'; ctx2d.font=`${Math.max(9,10*zoomFactor)}px Space Grotesk,sans-serif`;
  ctx2d.textAlign='left'; ctx2d.fillText(`${len.toFixed(1)} cm`,(s1.sx+s2.sx)/2+8,(s1.sy+s2.sy)/2-6);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function solidRect(x,y,w,h,stroke,fill){
  ctx2d.fillStyle=fill; ctx2d.fillRect(x,y,w,h);
  ctx2d.strokeStyle=stroke; ctx2d.lineWidth=1; ctx2d.strokeRect(x,y,w,h);
}
function drawHandle(x,y,color){
  ctx2d.beginPath(); ctx2d.arc(x,y,5,0,Math.PI*2);
  ctx2d.fillStyle=color; ctx2d.fill();
  ctx2d.strokeStyle='#fff'; ctx2d.lineWidth=1; ctx2d.stroke();
}
function isSelItem(type,id,modId){ return STATE.selectedItem?.type===type&&STATE.selectedItem?.id===id&&STATE.selectedItem?.moduleId===modId; }

function drawCotas(mod,s,fw,fh){
  ctx2d.strokeStyle=COLORS.dimLine; ctx2d.fillStyle=COLORS.dim; ctx2d.lineWidth=0.5;
  ctx2d.font=`${Math.max(8,8*zoomFactor)}px Space Grotesk,sans-serif`;
  ctx2d.setLineDash([2,3]);
  ctx2d.beginPath();
  ctx2d.moveTo(s.sx,s.sy-5); ctx2d.lineTo(s.sx,s.sy-20);
  ctx2d.moveTo(s.sx+fw,s.sy-5); ctx2d.lineTo(s.sx+fw,s.sy-20);
  ctx2d.moveTo(s.sx,s.sy-20); ctx2d.lineTo(s.sx+fw,s.sy-20);
  ctx2d.stroke(); ctx2d.setLineDash([]);
  ctx2d.textAlign='center'; ctx2d.fillText(`${mod.ancho}cm (${cmToMm(mod.ancho)}mm)`,s.sx+fw/2,s.sy-24);
  ctx2d.setLineDash([2,3]);
  ctx2d.beginPath();
  ctx2d.moveTo(s.sx+fw+5,s.sy); ctx2d.lineTo(s.sx+fw+22,s.sy);
  ctx2d.moveTo(s.sx+fw+5,s.sy+fh); ctx2d.lineTo(s.sx+fw+22,s.sy+fh);
  ctx2d.moveTo(s.sx+fw+22,s.sy); ctx2d.lineTo(s.sx+fw+22,s.sy+fh);
  ctx2d.stroke(); ctx2d.setLineDash([]);
  ctx2d.save(); ctx2d.translate(s.sx+fw+34,s.sy+fh/2); ctx2d.rotate(-Math.PI/2);
  ctx2d.textAlign='center'; ctx2d.fillText(`${mod.alto}cm (${cmToMm(mod.alto)}mm)`,0,0); ctx2d.restore();
  ctx2d.textAlign='center'; ctx2d.fillStyle='rgba(212,168,67,0.45)';
  ctx2d.fillText(`${STATE.thick}mm | Prof ${mod.prof}cm`,s.sx+fw/2,s.sy+fh+18);
}

function updateInfoBar(){
  const mod=getActiveModule();
  const el=document.getElementById('canvas-info');
  if(el&&mod) el.textContent=`${mod.ancho}×${mod.alto}×${mod.prof}cm | ${STATE.thick}mm | ${mod.divisions.length}div ${mod.shelves.length}est${mod.exploded?' | EXPLOTADO':''}`;
}

// ─── Hit testing ──────────────────────────────────────────────────────────
function hitTestAll(wx,wy){
  const t=STATE.thick/10;
  const ordered=[...STATE.modules].sort((a,b)=>a.id===STATE.activeModuleId?-1:1);

  for(const mod of ordered){
    // Si está explotado, testear caras individuales primero
    if(mod.exploded){
      const faces=getModuleFaces(mod);
      for(const face of faces){
        const ex=mod.excludedFaces||new Set();
        if(ex.has(face.key)) continue; // caras eliminadas no son clicables
        const ss={sx:face.px,sy:face.py};
        const mex=worldToScreen(mod.offsetX,mod.offsetY);
        // Convertir px de pantalla a coordenadas mundo para el hit
        const {wx:fwxL}=clientToWorld(face.px,face.py);
        const {wx:fwxR}=clientToWorld(face.px+face.pw,face.py+face.ph);
        const {wy:fwyT}=clientToWorld(face.px,face.py);
        const {wy:fwyB}=clientToWorld(face.px,face.py+face.ph);
        if(wx>=fwxL&&wx<=fwxR&&wy>=fwyT&&wy<=fwyB){
          return{type:'face', faceKey:face.key, moduleId:mod.id, shortLabel:face.shortLabel};
        }
      }
    }

    const lx=wx-mod.offsetX, ly=wy-mod.offsetY;
    for(const div of mod.divisions){ if(Math.abs(lx-div.pos)<t*2.5) return{type:'division',id:div.id,moduleId:mod.id}; }
    for(const sh of mod.shelves)   { if(Math.abs(ly-sh.pos)<t*2.5)  return{type:'shelf',   id:sh.id, moduleId:mod.id}; }
    if(lx>=-t&&lx<=mod.ancho+t&&ly>=-t&&ly<=mod.alto+t) return{type:'module',id:mod.id,moduleId:mod.id};
  }
  return null;
}

// ─── Events ───────────────────────────────────────────────────────────────
function onDown(e){
  if(!canvas2d) return;
  const{wx,wy}=clientToWorld(e.clientX,e.clientY);

  if(e.button===1||(e.button===0&&e.altKey)){
    isPanning=true; panStart={x:e.clientX-panOffX,y:e.clientY-panOffY};
    canvas2d.style.cursor='grabbing'; return;
  }
  if(e.button!==0) return;

  if(currentTool==='line'){
    const snap=snapToModule(wx,wy);
    if(!lineState){ lineState={startX:snap.wx,startY:snap.wy,modId:snap.modId}; }
    else{ commitLine(snap.wx,snap.wy); }
    redraw2D(); return;
  }
  if(currentTool==='angle'){ dialogAngulo(({aLargo,aProf,bAlto,bProf})=>insertAnguloModules(wx,wy,aLargo,aProf,bAlto,bProf)); return; }
  if(currentTool==='arc')  { dialogArco(({largo,alto,prof,segs})=>insertArcoModules(wx,wy,largo,alto,prof,segs)); return; }

  // EXPLOTAR: toggle exploded en el módulo clickeado
  if(currentTool==='explode'){
    const hit=hitTestAll(wx,wy);
    if(hit&&(hit.type==='module'||hit.type==='face')){
      const mod=STATE.modules.find(m=>m.id===hit.moduleId);
      if(mod){ mod.exploded=!mod.exploded; redraw2D(); showExplodeHint(mod); }
    }
    return;
  }

  // SELECT
  const hit=hitTestAll(wx,wy);
  if(hit){
    if(hit.type==='module'){ STATE.activeModuleId=hit.id; syncSidebarToModule(); }
    else if(hit.type==='face'){ STATE.activeModuleId=hit.moduleId; }
    STATE.selectedItem=hit;
    isDragging=true; dragTarget=hit.id||hit.faceKey; dragType=hit.type; dragEdge=null;
    canvas2d.style.cursor='grabbing';
    showSelectedPanel(); redraw2D();
  } else {
    STATE.selectedItem=null; hideSelectedPanel(); redraw2D();
  }
}

function showExplodeHint(mod){
  const info=document.getElementById('selected-info');
  if(info){
    if(mod.exploded) info.textContent='Módulo explotado: clic en una cara para seleccionarla → Supr para eliminarla del diseño y del despiece';
    else info.textContent='Módulo agrupado. Usa la herramienta Explotar (X) para desagrupar caras.';
  }
}

function onMove(e){
  if(!canvas2d) return;
  if(isPanning){ panOffX=e.clientX-panStart.x; panOffY=e.clientY-panStart.y; redraw2D(); return; }
  const{wx,wy}=clientToWorld(e.clientX,e.clientY);

  if(currentTool==='line'&&lineState){
    const snap=snapToModule(wx,wy);
    lineState._mouseWX=snap.wx; lineState._mouseWY=snap.wy;
    lineState._snapX=snap.snapX; lineState._snapY=snap.snapY;
    redraw2D(); return;
  }

  if(isDragging&&dragTarget!==null){
    const mod=STATE.modules.find(m=>m.id===(STATE.selectedItem?.moduleId||STATE.activeModuleId));
    if(!mod) return;
    const lx=wx-mod.offsetX, ly=wy-mod.offsetY;
    const t=STATE.thick/10;

    if(dragType==='module'){
      mod.offsetX=snapGrid(wx-mod.ancho/2);
      mod.offsetY=snapGrid(wy-mod.alto/2);
    } else if(dragType==='division'){
      const div=mod.divisions.find(d=>d.id===dragTarget);
      if(div){
        if(dragEdge==='start'){const f=Math.max(0,Math.min(div.endFrac-0.05,(ly-t)/(mod.alto-2*t)));div.startFrac=Math.round(f*20)/20;}
        else if(dragEdge==='end'){const f=Math.max(div.startFrac+0.05,Math.min(1,(ly-t)/(mod.alto-2*t)));div.endFrac=Math.round(f*20)/20;}
        else div.pos=parseFloat(Math.max(t,Math.min(mod.ancho-t,lx)).toFixed(1));
        updatePanelLists(mod); updateSelectedPanelCurrent();
      }
    } else if(dragType==='shelf'){
      const sh=mod.shelves.find(s=>s.id===dragTarget);
      if(sh){
        if(dragEdge==='start'){const f=Math.max(0,Math.min(sh.endFrac-0.05,(lx-t)/(mod.ancho-2*t)));sh.startFrac=Math.round(f*20)/20;}
        else if(dragEdge==='end'){const f=Math.max(sh.startFrac+0.05,Math.min(1,(lx-t)/(mod.ancho-2*t)));sh.endFrac=Math.round(f*20)/20;}
        else sh.pos=parseFloat(Math.max(t,Math.min(mod.alto-t,ly)).toFixed(1));
        updatePanelLists(mod); updateSelectedPanelCurrent();
      }
    }
    recalc(); redraw2D(); return;
  }

  const hit=hitTestAll(wx,wy);
  canvas2d.style.cursor=hit?(hit.type==='module'?'move':hit.type==='face'?'pointer':'grab'):'crosshair';
}

function onUp(){
  isPanning=false; isDragging=false; dragTarget=null; dragType=null; dragEdge=null;
  canvas2d.style.cursor='crosshair';
  recalc(); updatePanelLists(getActiveModule());
}

function onDblClick(e){
  if(currentTool!=='select') return;
  const{wx,wy}=clientToWorld(e.clientX,e.clientY);
  const mod=getActiveModule(); if(!mod) return;
  const lx=wx-mod.offsetX, ly=wy-mod.offsetY;
  const t=STATE.thick/10;
  if(lx>t&&lx<mod.ancho-t&&ly>t&&ly<mod.alto-t){
    const dv=Math.abs(lx-mod.ancho/2), dh=Math.abs(ly-mod.alto/2);
    if(dv<dh||e.shiftKey){
      mod.divisions.push({id:nextId(),pos:parseFloat(lx.toFixed(1)),startFrac:0,endFrac:1});
      document.getElementById('count-div-v').textContent=mod.divisions.length;
    } else {
      mod.shelves.push({id:nextId(),pos:parseFloat(ly.toFixed(1)),startFrac:0,endFrac:1});
      document.getElementById('count-div-h').textContent=mod.shelves.length;
    }
    updatePanelLists(mod); recalc(); redraw2D();
  }
}

function onWheel2D(e){
  e.preventDefault();
  const f=e.deltaY<0?1.12:0.9;
  const r=canvas2d.getBoundingClientRect();
  const sx=(e.clientX-r.left)*(canvas2d.width/r.width);
  const sy=(e.clientY-r.top)*(canvas2d.height/r.height);
  panOffX=sx-(sx-panOffX)*f; panOffY=sy-(sy-panOffY)*f;
  zoomFactor=Math.max(0.15,Math.min(12,zoomFactor*f));
  const el=document.getElementById('zoom-level'); if(el) el.textContent=Math.round(zoomFactor*100)+'%';
  redraw2D();
}

// ─── LINE TOOL ────────────────────────────────────────────────────────────
function commitLine(endX,endY){
  if(!lineState) return;
  const mod=STATE.modules.find(m=>m.id===lineState.modId)||getActiveModule();
  if(!mod){lineState=null;return;}
  const dx=Math.abs(endX-lineState.startX), dy=Math.abs(endY-lineState.startY);
  const t=STATE.thick/10;
  if(dx<1&&dy<1){lineState=null;return;}
  if(dx>=dy){
    const posX=Math.max(t,Math.min(mod.ancho-t,((lineState.startX+endX)/2)-mod.offsetX));
    const intH=mod.alto-2*t;
    const y1=Math.min(lineState.startY,endY)-mod.offsetY-t;
    const y2=Math.max(lineState.startY,endY)-mod.offsetY-t;
    const sf=Math.max(0,Math.min(0.95,y1/intH));
    const ef=Math.max(sf+0.05,Math.min(1,y2/intH));
    mod.divisions.push({id:nextId(),pos:parseFloat(posX.toFixed(1)),startFrac:parseFloat(sf.toFixed(2)),endFrac:parseFloat(ef.toFixed(2))});
    document.getElementById('count-div-v').textContent=mod.divisions.length;
  } else {
    const posY=Math.max(t,Math.min(mod.alto-t,((lineState.startY+endY)/2)-mod.offsetY));
    const intW=mod.ancho-2*t;
    const x1=Math.min(lineState.startX,endX)-mod.offsetX-t;
    const x2=Math.max(lineState.startX,endX)-mod.offsetX-t;
    const sf=Math.max(0,Math.min(0.95,x1/intW));
    const ef=Math.max(sf+0.05,Math.min(1,x2/intW));
    mod.shelves.push({id:nextId(),pos:parseFloat(posY.toFixed(1)),startFrac:parseFloat(sf.toFixed(2)),endFrac:parseFloat(ef.toFixed(2))});
    document.getElementById('count-div-h').textContent=mod.shelves.length;
  }
  lineState=null;
  updatePanelLists(mod); recalc(); redraw2D();
}

// ─── ÁNGULO / ARCO (sin cambios) ──────────────────────────────────────────
function insertAnguloModules(wx,wy,aLargo,aProf,bAlto,bProf){
  const modA=createModule({ancho:aLargo,alto:STATE.thick/10,prof:aProf,conFondo:false,conRail:false,offsetX:snapGrid(wx),offsetY:snapGrid(wy),_label:'Tablero horizontal (L)'});
  const modB=createModule({ancho:STATE.thick/10,alto:bAlto,prof:bProf,conFondo:false,conRail:false,offsetX:snapGrid(wx),offsetY:snapGrid(wy),_label:'Tablero vertical (L)'});
  STATE.modules.push(modA,modB);
  STATE.activeModuleId=modA.id;
  syncSidebarToModule(); recalc(); redraw2D(); redraw3D(); updateModuleSelector();
}
function insertArcoModules(wx,wy,largo,alto,prof,segs){
  const segW=largo/segs;
  for(let i=0;i<segs;i++){
    const mod=createModule({ancho:segW,alto:alto,prof:prof,conFondo:false,conRail:false,offsetX:snapGrid(wx+i*segW),offsetY:snapGrid(wy),_label:`Arco seg.${i+1}`});
    STATE.modules.push(mod);
  }
  STATE.activeModuleId=STATE.modules[STATE.modules.length-1].id;
  syncSidebarToModule(); recalc(); redraw2D(); redraw3D(); updateModuleSelector();
}

// ─── Tool management ──────────────────────────────────────────────────────
function setCurrentTool(tool){
  currentTool=tool; lineState=null;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
  const cursors={select:'default',line:'crosshair',angle:'crosshair',arc:'crosshair',explode:'cell'};
  if(canvas2d) canvas2d.style.cursor=cursors[tool]||'crosshair';
  const el=document.getElementById('st-tool'); if(el) el.textContent=tool;
  const hints={
    select:'Clic para seleccionar · Doble clic = agregar división · Alt+drag = pan',
    line:'Clic 1 = inicio · Clic 2 = fin → crea división/estante (snap a bordes automático)',
    angle:'Clic en el canvas → configura el ángulo en L',
    arc:'Clic en el canvas → configura el arco',
    explode:'Clic en módulo → activa/desactiva modo explotado. En modo explotado: clic en cara → Supr = eliminar',
  };
  const selInfo=document.getElementById('selected-info'); if(selInfo) selInfo.textContent=hints[tool]||'';
}

// ─── DELETE: soporta eliminar cara en modo explotado ──────────────────────
function deleteSelected(){
  if(!STATE.selectedItem) return;
  const{type,id,moduleId,faceKey}=STATE.selectedItem;

  if(type==='face'){
    // Eliminar cara del módulo: agregarla a excludedFaces
    const mod=STATE.modules.find(m=>m.id===moduleId);
    if(mod){
      if(!mod.excludedFaces) mod.excludedFaces=new Set();
      mod.excludedFaces.add(faceKey);
      STATE.selectedItem=null;
      recalc(); redraw2D();
      showToast(`Cara "${faceKey}" eliminada del despiece y del diseño.`);
    }
    return;
  }

  if(type==='division'){const mod=STATE.modules.find(m=>m.id===moduleId);if(mod)mod.divisions=mod.divisions.filter(d=>d.id!==id);}
  else if(type==='shelf'){const mod=STATE.modules.find(m=>m.id===moduleId);if(mod)mod.shelves=mod.shelves.filter(s=>s.id!==id);}
  else if(type==='module'&&STATE.modules.length>1){STATE.modules=STATE.modules.filter(m=>m.id!==id);STATE.activeModuleId=STATE.modules[0].id;syncSidebarToModule();}

  STATE.selectedItem=null; hideSelectedPanel();
  const mod=getActiveModule();
  if(mod){document.getElementById('count-div-v').textContent=mod.divisions.length;document.getElementById('count-div-h').textContent=mod.shelves.length;}
  recalc(); redraw2D();
}

// ─── N divisiones ─────────────────────────────────────────────────────────
function addNDivisions(type,delta){
  const mod=getActiveModule(); if(!mod) return;
  if(type==='v'){
    const n=Math.max(0,mod.divisions.length+delta);
    mod.divisions=[];
    for(let i=1;i<=n;i++) mod.divisions.push({id:nextId(),pos:parseFloat(((mod.ancho/(n+1))*i).toFixed(1)),startFrac:0,endFrac:1});
    document.getElementById('count-div-v').textContent=n;
  } else {
    const n=Math.max(0,mod.shelves.length+delta);
    mod.shelves=[];
    for(let i=1;i<=n;i++) mod.shelves.push({id:nextId(),pos:parseFloat(((mod.alto/(n+1))*i).toFixed(1)),startFrac:0,endFrac:1});
    document.getElementById('count-div-h').textContent=n;
  }
  STATE.selectedItem=null; hideSelectedPanel();
  updatePanelLists(mod); recalc(); redraw2D();
}

function addDivision(){addNDivisions('v',1);}
function addShelf(){addNDivisions('h',1);}

// ─── Panel lateral ────────────────────────────────────────────────────────
function showSelectedPanel(){const p=document.getElementById('selected-panel');if(p)p.style.display='block';updateSelectedPanelCurrent();}
function hideSelectedPanel(){const p=document.getElementById('selected-panel');if(p)p.style.display='none';}

function updateSelectedPanelCurrent(){
  const detail=document.getElementById('selected-detail'); if(!detail||!STATE.selectedItem) return;
  const{type,id,moduleId,faceKey,shortLabel}=STATE.selectedItem;
  const mod=STATE.modules.find(m=>m.id===moduleId);

  if(type==='face'&&mod){
    const ex=mod.excludedFaces||new Set();
    detail.innerHTML=`
      <div style="font-size:12px;color:#e8eaf0;margin-bottom:10px">Cara: <strong>${shortLabel||faceKey}</strong></div>
      <div style="font-size:11px;color:#8b92a8;margin-bottom:10px">Módulo ${STATE.modules.indexOf(mod)+1} — ${mod.ancho}×${mod.alto}cm</div>
      ${ex.has(faceKey)?
        `<button onclick="restoreFace('${moduleId}','${faceKey}')" style="width:100%;padding:7px;border:1px solid #10b981;border-radius:5px;background:none;color:#10b981;cursor:pointer;font-size:12px">↩ Restaurar esta cara</button>`
        :
        `<button onclick="excludePiece('${moduleId}','${faceKey}')" style="width:100%;padding:7px;border:1px solid #ef4444;border-radius:5px;background:none;color:#ef4444;cursor:pointer;font-size:12px">✕ Eliminar del diseño y despiece</button>`
      }`;
  } else if(type==='division'&&mod){
    const div=mod.divisions.find(d=>d.id===id); if(!div) return;
    const sf=Math.round((div.startFrac||0)*100), ef=Math.round((div.endFrac||1)*100);
    detail.innerHTML=`
      <div class="sel-row"><label>Posición (cm desde izq)</label>
        <input type="number" step="0.5" min="0.5" max="${mod.ancho-0.5}" value="${div.pos.toFixed(1)}"
          onchange="updateItemPropM(${moduleId},${id},'div','pos',+this.value)"></div>
      <div class="sel-row"><label>Empieza (% alto)</label>
        <input type="range" min="0" max="95" step="5" value="${sf}"
          oninput="updateItemPropM(${moduleId},${id},'div','startFrac',this.value/100);this.nextSibling.textContent=this.value+'%'"><span>${sf}%</span></div>
      <div class="sel-row"><label>Termina (% alto)</label>
        <input type="range" min="5" max="100" step="5" value="${ef}"
          oninput="updateItemPropM(${moduleId},${id},'div','endFrac',this.value/100);this.nextSibling.textContent=this.value+'%'"><span>${ef}%</span></div>
      <div class="sel-row" style="margin-top:4px">
        <span style="font-size:11px;color:#5a5a58">~${Math.round(((div.endFrac||1)-(div.startFrac||0))*mod.alto)}cm</span>
        <button onclick="deleteSelected()" style="margin-left:auto;color:#e05252;background:none;border:none;cursor:pointer;font-size:11px">× Eliminar</button>
      </div>`;
  } else if(type==='shelf'&&mod){
    const sh=mod.shelves.find(s=>s.id===id); if(!sh) return;
    const sf=Math.round((sh.startFrac||0)*100), ef=Math.round((sh.endFrac||1)*100);
    detail.innerHTML=`
      <div class="sel-row"><label>Posición (cm desde suelo)</label>
        <input type="number" step="0.5" min="0.5" max="${mod.alto-0.5}" value="${sh.pos.toFixed(1)}"
          onchange="updateItemPropM(${moduleId},${id},'shelf','pos',+this.value)"></div>
      <div class="sel-row"><label>Empieza (% ancho)</label>
        <input type="range" min="0" max="95" step="5" value="${sf}"
          oninput="updateItemPropM(${moduleId},${id},'shelf','startFrac',this.value/100);this.nextSibling.textContent=this.value+'%'"><span>${sf}%</span></div>
      <div class="sel-row"><label>Termina (% ancho)</label>
        <input type="range" min="5" max="100" step="5" value="${ef}"
          oninput="updateItemPropM(${moduleId},${id},'shelf','endFrac',this.value/100);this.nextSibling.textContent=this.value+'%'"><span>${ef}%</span></div>
      <div class="sel-row" style="margin-top:4px">
        <span style="font-size:11px;color:#5a5a58">~${Math.round(((sh.endFrac||1)-(sh.startFrac||0))*mod.ancho)}cm</span>
        <button onclick="deleteSelected()" style="margin-left:auto;color:#e05252;background:none;border:none;cursor:pointer;font-size:11px">× Eliminar</button>
      </div>`;
  } else if(type==='module'&&mod){
    const ex=mod.excludedFaces||new Set();
    detail.innerHTML=`
      <div style="font-size:11px;color:#9a9a96;margin-bottom:8px">Módulo ${STATE.modules.indexOf(mod)+1}${mod._label?' — '+mod._label:''}</div>
      <div class="sel-row"><label>Ancho (cm)</label><input type="number" value="${mod.ancho}" onchange="updateModuleProp(${mod.id},'ancho',+this.value)"></div>
      <div class="sel-row"><label>Alto (cm)</label><input type="number" value="${mod.alto}" onchange="updateModuleProp(${mod.id},'alto',+this.value)"></div>
      <div class="sel-row"><label>Prof (cm)</label><input type="number" value="${mod.prof}" onchange="updateModuleProp(${mod.id},'prof',+this.value)"></div>
      <button onclick="toggleExplode(${mod.id})" style="margin-top:8px;width:100%;padding:6px;border:1px solid #f59e0b;border-radius:5px;background:none;color:#f59e0b;cursor:pointer;font-size:12px">
        ${mod.exploded?'🔒 Agrupar (salir de explotar)':'⚡ Explotar — seleccionar caras individualmente'}
      </button>
      ${ex.size>0?`<button onclick="restoreAllPieces(${mod.id})" style="margin-top:6px;width:100%;padding:6px;border:1px solid #10b981;border-radius:5px;background:none;color:#10b981;cursor:pointer;font-size:12px">↩ Restaurar ${ex.size} cara(s) eliminada(s)</button>`:''}
      ${STATE.modules.length>1?`<button onclick="deleteSelected()" style="margin-top:6px;width:100%;color:#e05252;background:none;border:1px solid #e05252;border-radius:5px;padding:6px;cursor:pointer;font-size:12px">× Eliminar módulo</button>`:''}`;
  }
}

function toggleExplode(modId){
  const mod=STATE.modules.find(m=>m.id===modId); if(!mod) return;
  mod.exploded=!mod.exploded;
  STATE.selectedItem={type:'module',id:modId,moduleId:modId};
  showSelectedPanel(); redraw2D(); showExplodeHint(mod);
}

function restoreFace(modId,faceKey){
  const mod=STATE.modules.find(m=>m.id==parseInt(modId)||m.id===modId); if(!mod) return;
  if(mod.excludedFaces) mod.excludedFaces.delete(faceKey);
  recalc(); redraw2D(); updateSelectedPanelCurrent();
}

function updateItemPropM(moduleId,itemId,itemType,key,val){
  const mod=STATE.modules.find(m=>m.id===moduleId); if(!mod) return;
  if(itemType==='div'){const d=mod.divisions.find(d=>d.id===itemId);if(d)d[key]=parseFloat(val);}
  else{const s=mod.shelves.find(s=>s.id===itemId);if(s)s[key]=parseFloat(val);}
  updatePanelLists(mod); recalc(); redraw2D(); updateSelectedPanelCurrent();
}
function updateModuleProp(moduleId,key,val){
  const mod=STATE.modules.find(m=>m.id===moduleId); if(!mod) return;
  mod[key]=parseFloat(val); recalc(); redraw2D(); updateSelectedPanelCurrent();
}

function updatePanelLists(mod){
  if(!mod) mod=getActiveModule(); if(!mod) return;
  const dList=document.getElementById('divisions-list');
  if(dList) dList.innerHTML=!mod.divisions.length?'<span class="no-items">Ninguna aún</span>':
    mod.divisions.sort((a,b)=>a.pos-b.pos).map(d=>`
      <div class="division-item" onclick="selectItemFromList('division',${d.id},${mod.id})">
        <div style="display:flex;align-items:center;gap:4px">
          <div style="width:6px;height:6px;background:#4a9eff;border-radius:50%"></div>
          <input type="number" step="0.5" value="${d.pos.toFixed(1)}" class="pos-input"
            onclick="event.stopPropagation()" onchange="event.stopPropagation();updateItemPropM(${mod.id},${d.id},'div','pos',+this.value)">
          <span style="font-size:10px;color:#5a5a58">cm</span>
        </div>
        <span style="font-size:10px;color:#5a5a58">${Math.round(((d.endFrac||1)-(d.startFrac||0))*mod.alto)}cm</span>
        <button onclick="event.stopPropagation();deleteItemDirect('div',${d.id},${mod.id})">×</button>
      </div>`).join('');
  const sList=document.getElementById('shelves-list');
  if(sList) sList.innerHTML=!mod.shelves.length?'<span class="no-items">Ninguno aún</span>':
    mod.shelves.sort((a,b)=>a.pos-b.pos).map(s=>`
      <div class="division-item" onclick="selectItemFromList('shelf',${s.id},${mod.id})">
        <div style="display:flex;align-items:center;gap:4px">
          <div style="width:6px;height:6px;background:#3cb87a;border-radius:50%"></div>
          <input type="number" step="0.5" value="${s.pos.toFixed(1)}" class="pos-input"
            onclick="event.stopPropagation()" onchange="event.stopPropagation();updateItemPropM(${mod.id},${s.id},'shelf','pos',+this.value)">
          <span style="font-size:10px;color:#5a5a58">cm suelo</span>
        </div>
        <span style="font-size:10px;color:#5a5a58">${Math.round(((s.endFrac||1)-(s.startFrac||0))*mod.ancho)}cm</span>
        <button onclick="event.stopPropagation();deleteItemDirect('shelf',${s.id},${mod.id})">×</button>
      </div>`).join('');
  document.getElementById('count-div-v').textContent=mod.divisions.length;
  document.getElementById('count-div-h').textContent=mod.shelves.length;
}

function selectItemFromList(type,id,moduleId){STATE.selectedItem={type,id,moduleId};STATE.activeModuleId=moduleId;showSelectedPanel();redraw2D();}
function deleteItemDirect(type,id,moduleId){
  const mod=STATE.modules.find(m=>m.id===moduleId); if(!mod) return;
  if(type==='div') mod.divisions=mod.divisions.filter(d=>d.id!==id);
  else mod.shelves=mod.shelves.filter(s=>s.id!==id);
  if(STATE.selectedItem?.id===id){STATE.selectedItem=null;hideSelectedPanel();}
  document.getElementById('count-div-v').textContent=mod.divisions.length;
  document.getElementById('count-div-h').textContent=mod.shelves.length;
  updatePanelLists(mod); recalc(); redraw2D();
}

function syncSidebarToModule(){
  const mod=getActiveModule(); if(!mod) return;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  set('ctrl-ancho',mod.ancho); set('ctrl-alto',mod.alto); set('ctrl-prof',mod.prof);
  const pill=(id,val)=>{const e=document.getElementById(id);if(!e)return;e.textContent=val?'SÍ':'NO';e.classList.toggle('off',!val);};
  pill('toggle-fondo',mod.conFondo); pill('toggle-rail',mod.conRail); pill('toggle-patas',mod.conPatas);
  const rcr=document.getElementById('rail-count-row'); if(rcr) rcr.style.display=mod.conRail?'flex':'none';
  const nrd=document.getElementById('num-rails-display'); if(nrd) nrd.textContent=mod.numRails||1;
  updatePanelLists(mod);
}

function showToast(msg){
  let t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;bottom:48px;left:50%;transform:translateX(-50%);background:#1f2433;border:1px solid #3b82f6;border-radius:6px;padding:10px 18px;font-size:12px;color:#e8eaf0;z-index:3000;max-width:400px;text-align:center';document.body.appendChild(t);}
  t.textContent=msg; t.style.display='block';
  setTimeout(()=>{ if(t) t.style.display='none'; },4000);
}

function zoom(factor){
  if(!canvas2d) return;
  zoomFactor=Math.max(0.15,Math.min(12,zoomFactor*factor));
  panOffX=canvas2d.width/2-(canvas2d.width/2-panOffX)*factor;
  panOffY=canvas2d.height/2-(canvas2d.height/2-panOffY)*factor;
  const el=document.getElementById('zoom-level'); if(el) el.textContent=Math.round(zoomFactor*100)+'%';
  redraw2D();
}
function resetZoom(){zoomFactor=1;const el=document.getElementById('zoom-level');if(el)el.textContent='100%';centerView();redraw2D();}
function setTool(t){setCurrentTool(t);}
