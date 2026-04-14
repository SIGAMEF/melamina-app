// === CANVAS2D.JS v5 ===
// FIX: estantes se dibujan exactamente hasta las divisiones más cercanas
// FIX: posición de divisiones/estantes editable con input
// FIX: largo ajustable con sliders en panel lateral

let canvas2d, ctx2d;
let zoomFactor = 1;
let isDragging = false, dragTarget = null, dragType = null, dragEdge = null;

const COLORS = {
  bg:'#111113', grid:'rgba(255,255,255,0.04)', border:'#d4a843',
  division:'#4a9eff', divisionFill:'rgba(74,158,255,0.22)',
  shelf:'#3cb87a', shelfFill:'rgba(60,184,122,0.22)',
  selected:'#ffffff', dim:'#9a9a96', dimLine:'rgba(255,255,255,0.12)',
  rail:'#e05252', railFill:'rgba(224,82,82,0.18)',
  lateral:'rgba(212,168,67,0.18)', lateralStroke:'#d4a843',
  tapa:'rgba(184,140,46,0.22)', tapaStroke:'#b88c2e',
};

function initCanvas2D() {
  canvas2d = document.getElementById('main-canvas');
  if (!canvas2d) return;
  ctx2d = canvas2d.getContext('2d');
  canvas2d.addEventListener('click',     onCanvas2DClick);
  canvas2d.addEventListener('mousemove', onCanvas2DMove);
  canvas2d.addEventListener('mouseleave',() => { canvas2d.style.cursor='default'; });
  canvas2d.addEventListener('mousedown', onCanvas2DDown);
  canvas2d.addEventListener('mouseup',   onCanvas2DUp);
  canvas2d.addEventListener('dblclick',  onCanvas2DDblClick);
  redraw2D();
}

// ─── Layout ───────────────────────────────────────────────────────────────
function getLayout() {
  if (!canvas2d) return null;
  const W = canvas2d.width, H = canvas2d.height;
  const margin = 70, dimOff = 40;
  const availW = W - margin*2 - dimOff;
  const availH = H - margin*2 - dimOff;
  const scale = Math.min(availW / STATE.ancho, availH / STATE.alto) * zoomFactor;
  const fw = STATE.ancho * scale, fh = STATE.alto * scale;
  const fx = (W - fw) / 2, fy = (H - fh) / 2;
  return { scale, fw, fh, fx, fy, W, H };
}

function clientToCanvas(cx, cy) {
  const rect = canvas2d.getBoundingClientRect();
  return {
    x: (cx - rect.left) * (canvas2d.width / rect.width),
    y: (cy - rect.top)  * (canvas2d.height / rect.height),
  };
}
function canvasToMueble(cx, cy) {
  const L = getLayout(); if (!L) return {mx:0,my:0};
  return { mx: (cx - L.fx) / L.scale, my: STATE.alto - (cy - L.fy) / L.scale };
}

// ─── Main draw ────────────────────────────────────────────────────────────
function redraw2D() {
  if (!ctx2d || !canvas2d) return;
  const L = getLayout(); if (!L) return;
  const { scale, fw, fh, fx, fy, W, H } = L;
  ctx2d.clearRect(0, 0, W, H);
  drawGrid(W, H);
  drawMueble(L);
  drawDimensions(L);
  updateInfoBar(L);
}

function drawGrid(W, H) {
  const step = 40 * zoomFactor;
  ctx2d.strokeStyle = COLORS.grid; ctx2d.lineWidth = 0.5;
  for (let x = 0; x < W; x += step) { ctx2d.beginPath(); ctx2d.moveTo(x,0); ctx2d.lineTo(x,H); ctx2d.stroke(); }
  for (let y = 0; y < H; y += step) { ctx2d.beginPath(); ctx2d.moveTo(0,y); ctx2d.lineTo(W,y); ctx2d.stroke(); }
}

function drawMueble(L) {
  const { scale, fw, fh, fx, fy } = L;
  const t = STATE.thick / 10, ts = t * scale;
  const netW = fw - 2 * ts;

  // Fondo
  if (STATE.conFondo) {
    ctx2d.fillStyle = 'rgba(255,255,255,0.03)';
    ctx2d.fillRect(fx+1, fy+1, fw-2, fh-2);
  }

  // Laterales
  solidPanel(fx, fy, ts, fh, COLORS.lateralStroke, COLORS.lateral);
  solidPanel(fx+fw-ts, fy, ts, fh, COLORS.lateralStroke, COLORS.lateral);

  // Tapas
  solidPanel(fx+ts, fy,        netW, ts, COLORS.tapaStroke, COLORS.tapa);
  solidPanel(fx+ts, fy+fh-ts,  netW, ts, COLORS.tapaStroke, COLORS.tapa);

  // Rail
  if (STATE.conRail) {
    const n = Math.max(1, parseInt(STATE.numRails)||1);
    // Múltiples rails distribuidos proporcionalmente verticalmente
    // Por convención, rails van en la parte superior (para colgar)
    const railH = 8 * scale;
    for (let i = 0; i < n; i++) {
      const ry = fy + ts + i * (railH + 4*scale);
      ctx2d.fillStyle = COLORS.railFill; ctx2d.fillRect(fx+ts, ry, netW, railH);
      ctx2d.strokeStyle = COLORS.rail; ctx2d.lineWidth=1;
      ctx2d.setLineDash([4,3]); ctx2d.strokeRect(fx+ts, ry, netW, railH); ctx2d.setLineDash([]);
      ctx2d.fillStyle=COLORS.rail; ctx2d.font=`${Math.max(8,9*zoomFactor)}px Space Grotesk,sans-serif`;
      ctx2d.textAlign='center'; ctx2d.fillText(`RAIL${n>1?' '+(i+1):''}  8cm`, fx+ts+netW/2, ry+railH/2+3);
    }
  }

  // ── Divisiones verticales ──
  STATE.divisions.forEach(div => {
    const isSel = STATE.selectedItem?.type==='division' && STATE.selectedItem?.id===div.id;
    const dx = fx + div.pos * scale;
    const sf = div.startFrac !== undefined ? div.startFrac : 0;
    const ef = div.endFrac   !== undefined ? div.endFrac   : 1;
    const intH = fh - 2*ts;
    const panY = fy + ts + sf * intH;
    const panH = (ef - sf) * intH;

    ctx2d.fillStyle  = isSel ? 'rgba(74,158,255,0.35)' : COLORS.divisionFill;
    ctx2d.fillRect(dx - ts/2, panY, ts, panH);
    ctx2d.strokeStyle = isSel ? COLORS.selected : COLORS.division;
    ctx2d.lineWidth = isSel ? 2 : 1;
    ctx2d.strokeRect(dx - ts/2, panY, ts, panH);

    // Cota posición
    ctx2d.fillStyle = COLORS.division;
    ctx2d.font = `${Math.max(8,9*zoomFactor)}px Space Grotesk,sans-serif`;
    ctx2d.textAlign = 'center';
    ctx2d.fillText(`${div.pos.toFixed(1)}`, dx, fy+fh+14);

    // Handles si seleccionado
    if (isSel) {
      drawHandle(dx, panY, COLORS.division);
      drawHandle(dx, panY+panH, COLORS.division);
    }
  });

  // ── Estantes horizontales ──
  // FIX PRINCIPAL: el estante se dibuja de xLeft a xRight
  // donde xLeft/xRight respetan startFrac/endFrac,
  // y se "corta" visualmente en cada división que lo cruza.
  const sortedDivs = [...STATE.divisions].sort((a,b) => a.pos - b.pos);
  const netA = STATE.ancho - 2*t;

  STATE.shelves.forEach(sh => {
    const isSel = STATE.selectedItem?.type==='shelf' && STATE.selectedItem?.id===sh.id;
    const sf = sh.startFrac !== undefined ? sh.startFrac : 0;
    const ef = sh.endFrac   !== undefined ? sh.endFrac   : 1;
    const sy = fy + fh - sh.pos * scale;

    // Límites X del estante (absolutos en cm)
    const xLeftCm  = t + sf * netA;
    const xRightCm = t + ef * netA;

    // Divisiones que cruzan este estante
    const inside = sortedDivs.filter(d => d.pos > xLeftCm + 0.1 && d.pos < xRightCm - 0.1);
    const cuts = [xLeftCm, ...inside.map(d => d.pos), xRightCm];

    for (let ci = 0; ci < cuts.length - 1; ci++) {
      const lCm = cuts[ci];
      const rCm = cuts[ci+1];
      // Descontar grosor de divisiones interiores
      const lAdj = lCm + (ci > 0 ? t/2 : 0);
      const rAdj = rCm - (ci < cuts.length-2 ? t/2 : 0);
      if (rAdj - lAdj < 0.2) continue;

      const sxPx = fx + lAdj * scale;
      const swPx = (rAdj - lAdj) * scale;
      const shPx = Math.max(2, t * scale);

      ctx2d.fillStyle  = isSel ? 'rgba(60,184,122,0.38)' : COLORS.shelfFill;
      ctx2d.fillRect(sxPx, sy - shPx/2, swPx, shPx);
      ctx2d.strokeStyle = isSel ? COLORS.selected : COLORS.shelf;
      ctx2d.lineWidth = isSel ? 2 : 1;
      ctx2d.strokeRect(sxPx, sy - shPx/2, swPx, shPx);
    }

    // Cota altura
    ctx2d.fillStyle = COLORS.shelf;
    ctx2d.font = `${Math.max(8,9*zoomFactor)}px Space Grotesk,sans-serif`;
    ctx2d.textAlign = 'left';
    ctx2d.fillText(`${sh.pos.toFixed(1)}`, fx+fw+6, sy+3);

    // Handles si seleccionado
    if (isSel) {
      const sxStart = fx + xLeftCm * scale;
      const sxEnd   = fx + xRightCm * scale;
      drawHandle(sxStart, sy, COLORS.shelf);
      drawHandle(sxEnd,   sy, COLORS.shelf);
    }
  });

  // Marco exterior
  ctx2d.strokeStyle = COLORS.border; ctx2d.lineWidth = 1.5;
  ctx2d.strokeRect(fx, fy, fw, fh);

  // Patas
  if (STATE.conPatas) {
    const ph = 3*scale, pw = Math.min(4, STATE.ancho*0.05)*scale;
    const ts2 = t*scale;
    ctx2d.fillStyle = 'rgba(255,255,255,0.15)';
    ctx2d.fillRect(fx+ts2+2, fy+fh, pw, ph);
    ctx2d.fillRect(fx+fw-ts2-2-pw, fy+fh, pw, ph);
  }
}

function solidPanel(x, y, w, h, stroke, fill) {
  ctx2d.fillStyle = fill; ctx2d.fillRect(x, y, w, h);
  ctx2d.strokeStyle = stroke; ctx2d.lineWidth = 1; ctx2d.strokeRect(x, y, w, h);
}

function drawHandle(x, y, color) {
  ctx2d.beginPath(); ctx2d.arc(x, y, 5, 0, Math.PI*2);
  ctx2d.fillStyle = color; ctx2d.fill();
  ctx2d.strokeStyle = '#fff'; ctx2d.lineWidth = 1; ctx2d.stroke();
}

function drawDimensions(L) {
  const { scale, fw, fh, fx, fy } = L;
  ctx2d.strokeStyle = COLORS.dimLine; ctx2d.fillStyle = COLORS.dim;
  ctx2d.lineWidth = 0.5; ctx2d.font = `${Math.max(9,10*zoomFactor)}px Space Grotesk,sans-serif`;

  // Ancho
  ctx2d.setLineDash([3,3]);
  ctx2d.beginPath();
  ctx2d.moveTo(fx,fy-7); ctx2d.lineTo(fx,fy-24);
  ctx2d.moveTo(fx+fw,fy-7); ctx2d.lineTo(fx+fw,fy-24);
  ctx2d.moveTo(fx,fy-24); ctx2d.lineTo(fx+fw,fy-24);
  ctx2d.stroke(); ctx2d.setLineDash([]);
  ctx2d.textAlign='center';
  ctx2d.fillText(`${STATE.ancho} cm (${cmToMm(STATE.ancho)} mm)`, fx+fw/2, fy-28);

  // Alto
  ctx2d.setLineDash([3,3]);
  ctx2d.beginPath();
  ctx2d.moveTo(fx+fw+7,fy); ctx2d.lineTo(fx+fw+28,fy);
  ctx2d.moveTo(fx+fw+7,fy+fh); ctx2d.lineTo(fx+fw+28,fy+fh);
  ctx2d.moveTo(fx+fw+28,fy); ctx2d.lineTo(fx+fw+28,fy+fh);
  ctx2d.stroke(); ctx2d.setLineDash([]);
  ctx2d.save();
  ctx2d.translate(fx+fw+40, fy+fh/2); ctx2d.rotate(-Math.PI/2);
  ctx2d.textAlign='center';
  ctx2d.fillText(`${STATE.alto} cm (${cmToMm(STATE.alto)} mm)`, 0, 0);
  ctx2d.restore();

  // Info inferior
  ctx2d.textAlign='left'; ctx2d.fillStyle='rgba(212,168,67,0.6)';
  ctx2d.fillText(`⬛ ${STATE.thick}mm`, fx+2, fy+fh+24);
  ctx2d.fillStyle=COLORS.dim; ctx2d.textAlign='center';
  ctx2d.fillText(`Prof: ${STATE.prof} cm`, fx+fw/2, fy+fh+24);
}

function updateInfoBar() {
  const el = document.getElementById('canvas-info');
  if (el) el.textContent = `${STATE.ancho}×${STATE.alto}×${STATE.prof} cm | ${STATE.thick}mm | ${STATE.divisions.length} div. | ${STATE.shelves.length} est.`;
}

// ─── Hit testing ──────────────────────────────────────────────────────────
function hitTest(mx, my) {
  const t = STATE.thick / 10;
  for (const div of STATE.divisions) {
    if (Math.abs(mx - div.pos) < t*2.5) return { type:'division', id:div.id };
  }
  for (const sh of STATE.shelves) {
    if (Math.abs(my - sh.pos) < t*2.5) return { type:'shelf', id:sh.id };
  }
  return null;
}

// ─── Events ───────────────────────────────────────────────────────────────
function onCanvas2DDown(e) {
  if (!canvas2d) return;
  const { x, y } = clientToCanvas(e.clientX, e.clientY);
  const { mx, my } = canvasToMueble(x, y);
  const L = getLayout(); if (!L) return;
  const { scale, fx, fy, fw, fh } = L;
  const t = STATE.thick/10, ts = t*scale;

  // ¿Handle de inicio/fin del elemento seleccionado?
  if (STATE.selectedItem) {
    const netA = STATE.ancho - 2*t;
    if (STATE.selectedItem.type === 'division') {
      const div = STATE.divisions.find(d => d.id===STATE.selectedItem.id);
      if (div) {
        const dx = fx + div.pos*scale;
        const intH = fh - 2*ts;
        const sf = div.startFrac||0, ef = div.endFrac||1;
        const topY = fy + ts + sf*intH, botY = fy + ts + ef*intH;
        if (Math.abs(x-dx)<12 && Math.abs(y-topY)<12) { isDragging=true; dragTarget=div.id; dragType='division'; dragEdge='start'; return; }
        if (Math.abs(x-dx)<12 && Math.abs(y-botY)<12) { isDragging=true; dragTarget=div.id; dragType='division'; dragEdge='end';   return; }
      }
    }
    if (STATE.selectedItem.type === 'shelf') {
      const sh = STATE.shelves.find(s => s.id===STATE.selectedItem.id);
      if (sh) {
        const sy = fy + fh - sh.pos*scale;
        const sf = sh.startFrac||0, ef = sh.endFrac||1;
        const sxL = fx + (t + sf*netA)*scale;
        const sxR = fx + (t + ef*netA)*scale;
        if (Math.abs(y-sy)<12 && Math.abs(x-sxL)<12) { isDragging=true; dragTarget=sh.id; dragType='shelf'; dragEdge='start'; return; }
        if (Math.abs(y-sy)<12 && Math.abs(x-sxR)<12) { isDragging=true; dragTarget=sh.id; dragType='shelf'; dragEdge='end';   return; }
      }
    }
  }

  // ¿Hit en un elemento?
  const hit = hitTest(mx, my);
  if (hit) {
    isDragging=true; dragTarget=hit.id; dragType=hit.type; dragEdge=null;
    STATE.selectedItem=hit; canvas2d.style.cursor='grabbing';
    showSelectedPanel(); redraw2D();
  }
}

function onCanvas2DMove(e) {
  if (!canvas2d) return;
  const { x, y } = clientToCanvas(e.clientX, e.clientY);
  const { mx, my } = canvasToMueble(x, y);
  const L = getLayout(); if (!L) return;
  const t = STATE.thick/10, ts = t*L.scale;
  const netA = STATE.ancho - 2*t;
  const netH = STATE.alto  - 2*t;

  if (isDragging && dragTarget !== null) {
    if (dragType==='division') {
      const div = STATE.divisions.find(d => d.id===dragTarget);
      if (div) {
        if (dragEdge==='start') {
          const frac = Math.max(0, Math.min(div.endFrac-0.05, (L.fh - 2*ts - (L.fy+L.fh-y-ts)) / (L.fh-2*ts)));
          // frac vertical desde top
          const topFrac = Math.max(0, Math.min(div.endFrac-0.05, (y - L.fy - ts) / (L.fh-2*ts)));
          div.startFrac = Math.round(topFrac*20)/20;
        } else if (dragEdge==='end') {
          const botFrac = Math.max(div.startFrac+0.05, Math.min(1, (y - L.fy - ts) / (L.fh-2*ts)));
          div.endFrac = Math.round(botFrac*20)/20;
        } else {
          div.pos = parseFloat(Math.max(t*1.5, Math.min(STATE.ancho-t*1.5, mx)).toFixed(1));
        }
        updatePanelLists(); updateSelectedPanel();
      }
    } else if (dragType==='shelf') {
      const sh = STATE.shelves.find(s => s.id===dragTarget);
      if (sh) {
        if (dragEdge==='start') {
          const lFrac = Math.max(0, Math.min(sh.endFrac-0.05, (x - L.fx - ts) / (L.fw-2*ts)));
          sh.startFrac = Math.round(lFrac*20)/20;
        } else if (dragEdge==='end') {
          const rFrac = Math.max(sh.startFrac+0.05, Math.min(1, (x - L.fx - ts) / (L.fw-2*ts)));
          sh.endFrac = Math.round(rFrac*20)/20;
        } else {
          sh.pos = parseFloat(Math.max(t*1.5, Math.min(STATE.alto-t*1.5, my)).toFixed(1));
        }
        updatePanelLists(); updateSelectedPanel();
      }
    }
    recalc(); redraw2D();
  } else {
    const hit = hitTest(mx, my);
    if (hit) canvas2d.style.cursor='grab';
    else canvas2d.style.cursor='crosshair';
  }
}

function onCanvas2DUp() {
  isDragging=false; dragTarget=null; dragType=null; dragEdge=null;
  canvas2d.style.cursor='crosshair';
  recalc(); updatePanelLists();
}

function onCanvas2DClick(e) {
  if (!canvas2d) return;
  const { x, y } = clientToCanvas(e.clientX, e.clientY);
  const { mx, my } = canvasToMueble(x, y);
  const hit = hitTest(mx, my);
  STATE.selectedItem = hit;
  if (hit) { showSelectedPanel(); }
  else { hideSelectedPanel(); }
  redraw2D();
}

function onCanvas2DDblClick(e) {
  if (!canvas2d) return;
  const { x, y } = clientToCanvas(e.clientX, e.clientY);
  const { mx, my } = canvasToMueble(x, y);
  const t = STATE.thick/10;
  if (mx > t && mx < STATE.ancho-t && my > t && my < STATE.alto-t) {
    const distV = Math.abs(mx - STATE.ancho/2);
    const distH = Math.abs(my - STATE.alto/2);
    if (distV < distH || e.shiftKey) {
      STATE.divisions.push({ id:nextId(), pos:parseFloat(mx.toFixed(1)), startFrac:0, endFrac:1 });
      document.getElementById('count-div-v').textContent = STATE.divisions.length;
    } else {
      STATE.shelves.push({ id:nextId(), pos:parseFloat(my.toFixed(1)), startFrac:0, endFrac:1 });
      document.getElementById('count-div-h').textContent = STATE.shelves.length;
    }
    updatePanelLists(); recalc(); redraw2D();
  }
}

// ─── N divisiones automáticas ──────────────────────────────────────────────
function addNDivisions(type, delta) {
  if (type==='v') {
    const n = Math.max(0, STATE.divisions.length + delta);
    STATE.divisions = [];
    for (let i=1; i<=n; i++) STATE.divisions.push({ id:nextId(), pos:parseFloat(((STATE.ancho/(n+1))*i).toFixed(1)), startFrac:0, endFrac:1 });
    document.getElementById('count-div-v').textContent = n;
  } else {
    const n = Math.max(0, STATE.shelves.length + delta);
    STATE.shelves = [];
    for (let i=1; i<=n; i++) STATE.shelves.push({ id:nextId(), pos:parseFloat(((STATE.alto/(n+1))*i).toFixed(1)), startFrac:0, endFrac:1 });
    document.getElementById('count-div-h').textContent = n;
  }
  STATE.selectedItem=null; hideSelectedPanel();
  updatePanelLists(); recalc(); redraw2D();
}

function addDivision() { addNDivisions('v', 1); }
function addShelf()    { addNDivisions('h', 1); }

function deleteSelected() {
  if (!STATE.selectedItem) return;
  if (STATE.selectedItem.type==='division') STATE.divisions=STATE.divisions.filter(d=>d.id!==STATE.selectedItem.id);
  else STATE.shelves=STATE.shelves.filter(s=>s.id!==STATE.selectedItem.id);
  STATE.selectedItem=null; hideSelectedPanel();
  document.getElementById('count-div-v').textContent=STATE.divisions.length;
  document.getElementById('count-div-h').textContent=STATE.shelves.length;
  updatePanelLists(); recalc(); redraw2D();
}

// ─── Panel elemento seleccionado ───────────────────────────────────────────
function showSelectedPanel() {
  const p = document.getElementById('selected-panel');
  if (p) p.style.display='block';
  updateSelectedPanel();
}
function hideSelectedPanel() {
  const p = document.getElementById('selected-panel');
  if (p) p.style.display='none';
}

function updateSelectedPanel() {
  const detail = document.getElementById('selected-detail');
  if (!detail || !STATE.selectedItem) return;
  const { type, id } = STATE.selectedItem;

  if (type==='division') {
    const div = STATE.divisions.find(d=>d.id===id);
    if (!div) return;
    const sf=Math.round((div.startFrac||0)*100), ef=Math.round((div.endFrac||1)*100);
    detail.innerHTML=`
      <div class="sel-row"><label>Posición (cm desde izq)</label>
        <input type="number" step="0.5" min="0.5" max="${STATE.ancho-0.5}" value="${div.pos.toFixed(1)}"
          onchange="updateItemProp(${id},'pos',+this.value,'v')"></div>
      <div class="sel-row"><label>Empieza (% alto)</label>
        <input type="range" min="0" max="95" step="5" value="${sf}"
          oninput="updateItemProp(${id},'startFrac',this.value/100,'v');this.nextSibling.textContent=this.value+'%'">
        <span>${sf}%</span></div>
      <div class="sel-row"><label>Termina (% alto)</label>
        <input type="range" min="5" max="100" step="5" value="${ef}"
          oninput="updateItemProp(${id},'endFrac',this.value/100,'v');this.nextSibling.textContent=this.value+'%'">
        <span>${ef}%</span></div>
      <div class="sel-row" style="margin-top:4px">
        <span style="font-size:11px;color:#5a5a58">Largo: ~${Math.round(((div.endFrac||1)-(div.startFrac||0))*STATE.alto)}cm</span>
        <button onclick="removeDivision(${id})" style="margin-left:auto;color:#e05252;background:none;border:none;cursor:pointer;font-size:11px">× Eliminar</button>
      </div>`;
  } else {
    const sh = STATE.shelves.find(s=>s.id===id);
    if (!sh) return;
    const sf=Math.round((sh.startFrac||0)*100), ef=Math.round((sh.endFrac||1)*100);
    detail.innerHTML=`
      <div class="sel-row"><label>Posición (cm desde suelo)</label>
        <input type="number" step="0.5" min="0.5" max="${STATE.alto-0.5}" value="${sh.pos.toFixed(1)}"
          onchange="updateItemProp(${id},'pos',+this.value,'h')"></div>
      <div class="sel-row"><label>Empieza (% ancho)</label>
        <input type="range" min="0" max="95" step="5" value="${sf}"
          oninput="updateItemProp(${id},'startFrac',this.value/100,'h');this.nextSibling.textContent=this.value+'%'">
        <span>${sf}%</span></div>
      <div class="sel-row"><label>Termina (% ancho)</label>
        <input type="range" min="5" max="100" step="5" value="${ef}"
          oninput="updateItemProp(${id},'endFrac',this.value/100,'h');this.nextSibling.textContent=this.value+'%'">
        <span>${ef}%</span></div>
      <div class="sel-row" style="margin-top:4px">
        <span style="font-size:11px;color:#5a5a58">Largo: ~${Math.round(((sh.endFrac||1)-(sh.startFrac||0))*STATE.ancho)}cm</span>
        <button onclick="removeShelf(${id})" style="margin-left:auto;color:#e05252;background:none;border:none;cursor:pointer;font-size:11px">× Eliminar</button>
      </div>`;
  }
}

function updateItemProp(id, key, val, type) {
  if (type==='v') {
    const div=STATE.divisions.find(d=>d.id===id); if(!div) return;
    div[key]=parseFloat(val);
  } else {
    const sh=STATE.shelves.find(s=>s.id===id); if(!sh) return;
    sh[key]=parseFloat(val);
  }
  updatePanelLists(); recalc(); redraw2D(); updateSelectedPanel();
}

function removeDivision(id) {
  STATE.divisions=STATE.divisions.filter(d=>d.id!==id);
  if(STATE.selectedItem?.id===id){STATE.selectedItem=null;hideSelectedPanel();}
  document.getElementById('count-div-v').textContent=STATE.divisions.length;
  updatePanelLists(); recalc(); redraw2D();
}
function removeShelf(id) {
  STATE.shelves=STATE.shelves.filter(s=>s.id!==id);
  if(STATE.selectedItem?.id===id){STATE.selectedItem=null;hideSelectedPanel();}
  document.getElementById('count-div-h').textContent=STATE.shelves.length;
  updatePanelLists(); recalc(); redraw2D();
}

// ─── Panel lists ──────────────────────────────────────────────────────────
function updatePanelLists() {
  const dList = document.getElementById('divisions-list');
  if (dList) {
    dList.innerHTML = STATE.divisions.length===0
      ? '<span class="no-items">Ninguna aún</span>'
      : STATE.divisions.sort((a,b)=>a.pos-b.pos).map(d=>`
          <div class="division-item" onclick="selectItem('division',${d.id})">
            <div style="display:flex;align-items:center;gap:4px">
              <div style="width:6px;height:6px;background:#4a9eff;border-radius:50%"></div>
              <input type="number" step="0.5" value="${d.pos.toFixed(1)}" class="pos-input" title="cm desde izquierda"
                onclick="event.stopPropagation()"
                onchange="event.stopPropagation();updateItemProp(${d.id},'pos',+this.value,'v')">
              <span style="font-size:10px;color:#5a5a58">cm</span>
            </div>
            <span style="font-size:10px;color:#5a5a58">${Math.round(((d.endFrac||1)-(d.startFrac||0))*STATE.alto)}cm largo</span>
            <button onclick="event.stopPropagation();removeDivision(${d.id})">×</button>
          </div>`).join('');
  }
  const sList = document.getElementById('shelves-list');
  if (sList) {
    sList.innerHTML = STATE.shelves.length===0
      ? '<span class="no-items">Ninguno aún</span>'
      : STATE.shelves.sort((a,b)=>a.pos-b.pos).map(s=>`
          <div class="division-item" onclick="selectItem('shelf',${s.id})">
            <div style="display:flex;align-items:center;gap:4px">
              <div style="width:6px;height:6px;background:#3cb87a;border-radius:50%"></div>
              <input type="number" step="0.5" value="${s.pos.toFixed(1)}" class="pos-input" title="cm desde suelo"
                onclick="event.stopPropagation()"
                onchange="event.stopPropagation();updateItemProp(${s.id},'pos',+this.value,'h')">
              <span style="font-size:10px;color:#5a5a58">cm suelo</span>
            </div>
            <span style="font-size:10px;color:#5a5a58">${Math.round(((s.endFrac||1)-(s.startFrac||0))*STATE.ancho)}cm largo</span>
            <button onclick="event.stopPropagation();removeShelf(${s.id})">×</button>
          </div>`).join('');
  }
}

function selectItem(type, id) {
  STATE.selectedItem={type,id}; showSelectedPanel(); redraw2D();
}

// ─── Zoom ─────────────────────────────────────────────────────────────────
function zoom(factor) {
  zoomFactor=Math.max(0.3, Math.min(4, zoomFactor*factor));
  const el=document.getElementById('zoom-level'); if(el) el.textContent=Math.round(zoomFactor*100)+'%';
  redraw2D();
}
function resetZoom() {
  zoomFactor=1;
  const el=document.getElementById('zoom-level'); if(el) el.textContent='100%';
  redraw2D();
}
function setTool(t) {
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tool-'+t)?.classList.add('active');
}
