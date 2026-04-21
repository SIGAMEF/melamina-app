// === CALC.JS v8 ===
// Respeta excludedFaces de cada módulo: si una cara está excluida no se genera como pieza.

function computePieces() {
  const allPieces = [];
  STATE.modules.forEach((mod, mIdx) => {
    const prefix = STATE.modules.length > 1 ? `M${mIdx+1} ` : '';
    const pieces = computeModulePieces(mod, prefix);
    allPieces.push(...pieces);
  });
  STATE.pieces = allPieces;
  return allPieces;
}

function computeModulePieces(mod, prefix) {
  const a=mod.ancho, h=mod.alto, p=mod.prof, t=STATE.thick/10;
  const pieces=[];
  const netA=a-2*t, netH=h-2*t;
  const ex=mod.excludedFaces||new Set(); // caras excluidas de este módulo

  const push=(key, piece)=>{
    if (!ex.has(key)) pieces.push({...piece, _faceKey:key, _modId:mod.id});
  };

  push('lateral-izq', {label:`${prefix}Lateral Izq`,qty:1,wcm:p,hcm:h,w:Math.round(p*10),h:Math.round(h*10),color:PIECE_COLORS[0]});
  push('lateral-der', {label:`${prefix}Lateral Der`,qty:1,wcm:p,hcm:h,w:Math.round(p*10),h:Math.round(h*10),color:PIECE_COLORS[0]});
  push('tapa-sup',    {label:`${prefix}Tapa Superior`,qty:1,wcm:netA,hcm:p,w:Math.round(netA*10),h:Math.round(p*10),color:PIECE_COLORS[1]});
  push('tapa-inf',    {label:`${prefix}Tapa Inferior`,qty:1,wcm:netA,hcm:p,w:Math.round(netA*10),h:Math.round(p*10),color:PIECE_COLORS[1]});

  if (mod.conFondo)
    push('fondo', {label:`${prefix}Fondo`,qty:1,wcm:netA,hcm:netH,w:Math.round(netA*10),h:Math.round(netH*10),color:PIECE_COLORS[4]});

  if (mod.conRail) {
    const n=Math.max(1,parseInt(mod.numRails)||1);
    for(let i=0;i<n;i++)
      push(`rail-${i}`, {label:`${prefix}Rail${n>1?' '+(i+1):''}`,qty:1,wcm:netA,hcm:8,w:Math.round(netA*10),h:80,color:PIECE_COLORS[5]});
  }

  // Divisiones verticales
  mod.divisions.forEach((div,idx)=>{
    const key=`div-v-${idx}`;
    const sf=div.startFrac||0, ef=div.endFrac||1;
    const realH=Math.max(0.5,(ef-sf)*netH);
    push(key, {label:`${prefix}Div ${idx+1}`,qty:1,wcm:p,hcm:realH,w:Math.round(p*10),h:Math.round(realH*10),color:PIECE_COLORS[2]});
  });

  // Estantes
  const sortedDivs=[...mod.divisions].sort((a,b)=>a.pos-b.pos);
  mod.shelves.forEach((sh,idx)=>{
    const sf=sh.startFrac||0, ef=sh.endFrac||1;
    const xL=t+sf*netA, xR=t+ef*netA;
    const inside=sortedDivs.filter(d=>d.pos>xL+0.15&&d.pos<xR-0.15);
    if(!inside.length){
      const w=xR-xL;
      if(w>0.3) push(`shelf-${idx}-0`, {label:`${prefix}Est ${idx+1}`,qty:1,wcm:w,hcm:p,w:Math.round(w*10),h:Math.round(p*10),color:PIECE_COLORS[3]});
    } else {
      const cuts=[xL,...inside.map(d=>d.pos),xR];
      for(let ci=0;ci<cuts.length-1;ci++){
        const l=cuts[ci]+(ci>0?t/2:0), r=cuts[ci+1]-(ci<cuts.length-2?t/2:0);
        const w=r-l;
        if(w>0.3) push(`shelf-${idx}-${ci}`, {label:`${prefix}Est ${idx+1}${cuts.length>2?'.'+( ci+1):''}`,qty:1,wcm:w,hcm:p,w:Math.round(w*10),h:Math.round(p*10),color:PIECE_COLORS[3]});
      }
    }
  });

  return pieces;
}

function recalc() {
  const pieces=computePieces();
  const totalM2=pieces.reduce((s,p)=>s+p.w*p.h,0)/1e6;
  const planchaM2=(STATE.planchaW*STATE.planchaH)/1e6;
  const result=packPieces(pieces);
  const nP=result.sheets.length;
  const usedM2=result.sheets.reduce((s,sh)=>s+sh.placed.reduce((a,p)=>a+p.w*p.h,0),0)/1e6;
  const waste=nP>0?Math.round((1-usedM2/(nP*planchaM2))*100):0;

  STATE.planchasNeeded=nP; STATE.areaTotal=totalM2;
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  set('calc-planchas',nP);
  set('calc-area-total',totalM2.toFixed(3));
  set('calc-area-plancha',planchaM2.toFixed(3));
  set('calc-desperdicio',waste);
  set('plancha-format',`${STATE.planchaW}×${STATE.planchaH}mm`);
  set('note-grosor',STATE.thick);

  updatePiecesList(pieces);
  updateSummary();
  if(document.getElementById('view-cut')?.classList.contains('active')) renderCutPlan();
  try{redraw3D();}catch(e){}
}

function updatePiecesList(pieces) {
  const list=document.getElementById('pieces-list');
  if(!list) return;
  if(!pieces.length){list.innerHTML='<span class="no-items">Diseña tu mueble para ver las piezas</span>';return;}
  list.innerHTML=pieces.map(p=>`
    <div class="piece-item">
      <div style="display:flex;align-items:center;gap:6px;flex:1">
        <div style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0"></div>
        <span class="piece-name">${p.label}</span>
      </div>
      <span class="piece-dim">${p.wcm.toFixed(0)}×${p.hcm.toFixed(0)}cm</span>
      <button onclick="excludePiece('${p._modId}','${p._faceKey}')"
        style="margin-left:4px;background:none;border:none;color:#ef444480;cursor:pointer;font-size:13px;padding:0 2px"
        title="Quitar del despiece">✕</button>
    </div>`).join('');

  const detail=document.getElementById('pieces-detail');
  if(detail) detail.innerHTML=pieces.map(p=>`<div class="piece-item"><span class="piece-name" style="font-size:11px">${p.label}</span><span class="piece-mm">${p.w}×${p.h}mm</span></div>`).join('');
}

function updateSummary() {
  const mod=getActiveModule();
  const typeN={'mueble-alto':'Mueble alto','mueble-bajo':'Mueble bajo','repisa':'Repisas','escritorio':'Escritorio'};
  const mountN={'libre':'Libre','anclaje':'Anclaje a pared'};
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  if(mod){set('sum-type',typeN[mod.type]||mod.type);set('sum-mount',mountN[mod.mount]||mod.mount);}
  set('sum-thick',STATE.thick+' mm');
  set('sum-modules',STATE.modules.length);
}

// Excluir una pieza del despiece (desde el panel lateral o desde la tabla de corte)
function excludePiece(modId, faceKey) {
  const mod=STATE.modules.find(m=>m.id==parseInt(modId)||m.id===modId);
  if(!mod) return;
  if(!mod.excludedFaces) mod.excludedFaces=new Set();
  mod.excludedFaces.add(faceKey);
  recalc();
  redraw2D();
}

// Restaurar todas las piezas excluidas de un módulo
function restoreAllPieces(modId) {
  const mod=STATE.modules.find(m=>m.id==parseInt(modId)||m.id===modId);
  if(mod) mod.excludedFaces=new Set();
  recalc();
  redraw2D();
}
