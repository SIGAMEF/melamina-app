// === CALC.JS v5 ===
// FIX: estantes se cortan SOLO entre divisiones que los cruzan físicamente
// FIX: división horizontal "engancha" con divisiones verticales más cercanas

function computePieces() {
  const a = STATE.ancho, h = STATE.alto, p = STATE.prof, t = STATE.thick / 10;
  const pieces = [];
  const netA = a - 2 * t;   // ancho interior entre laterales
  const netH = h - 2 * t;   // alto interior entre tapas

  // ── Laterales ──
  pieces.push({ label:'Lateral Izq', qty:1, wcm:p, hcm:h, w:Math.round(p*10), h:Math.round(h*10), color:PIECE_COLORS[0] });
  pieces.push({ label:'Lateral Der', qty:1, wcm:p, hcm:h, w:Math.round(p*10), h:Math.round(h*10), color:PIECE_COLORS[0] });

  // ── Tapas ──
  pieces.push({ label:'Tapa Superior', qty:1, wcm:netA, hcm:p, w:Math.round(netA*10), h:Math.round(p*10), color:PIECE_COLORS[1] });
  pieces.push({ label:'Tapa Inferior', qty:1, wcm:netA, hcm:p, w:Math.round(netA*10), h:Math.round(p*10), color:PIECE_COLORS[1] });

  // ── Fondo ──
  if (STATE.conFondo) {
    pieces.push({ label:'Fondo', qty:1, wcm:netA, hcm:netH, w:Math.round(netA*10), h:Math.round(netH*10), color:PIECE_COLORS[4] });
  }

  // ── Rails (FIX: numRails) ──
  if (STATE.conRail) {
    const n = Math.max(1, parseInt(STATE.numRails) || 1);
    for (let i = 0; i < n; i++) {
      pieces.push({ label:`Rail anclaje${n>1?' '+(i+1):''}`, qty:1, wcm:netA, hcm:8, w:Math.round(netA*10), h:80, color:PIECE_COLORS[5] });
    }
  }

  // ── Divisiones verticales ──
  // Cada división tiene startFrac/endFrac → altura real de la pieza
  STATE.divisions.forEach((div, idx) => {
    const sf = div.startFrac !== undefined ? div.startFrac : 0;
    const ef = div.endFrac   !== undefined ? div.endFrac   : 1;
    const realH = Math.max(1, (ef - sf) * netH);
    pieces.push({
      label: `División ${idx+1}`, qty:1,
      wcm:p, hcm:realH,
      w:Math.round(p*10), h:Math.round(realH*10),
      color:PIECE_COLORS[2]
    });
  });

  // ── Estantes horizontales ──
  // REGLA CLAVE: Un estante se secciona entre las divisiones verticales
  // que están físicamente dentro de su rango horizontal (startFrac→endFrac).
  // Si el estante va de 0% a 100%, lo cruzan todas las divisiones.
  // Si va de 0% a 50%, solo lo cruzan las divisiones en la mitad izquierda.

  const sortedDivs = [...STATE.divisions].sort((a, b) => a.pos - b.pos);

  STATE.shelves.forEach((sh, idx) => {
    const sf = sh.startFrac !== undefined ? sh.startFrac : 0;
    const ef = sh.endFrac   !== undefined ? sh.endFrac   : 1;

    // Límites X del estante en cm (absolutos dentro del mueble)
    const xLeft  = t + sf * netA;
    const xRight = t + ef * netA;

    // Divisiones que caen DENTRO del rango del estante
    const inside = sortedDivs.filter(d => d.pos > xLeft + 0.2 && d.pos < xRight - 0.2);

    if (inside.length === 0) {
      // Estante continuo
      const w = xRight - xLeft;
      if (w > 0.5) {
        pieces.push({ label:`Estante ${idx+1}`, qty:1, wcm:w, hcm:p, w:Math.round(w*10), h:Math.round(p*10), color:PIECE_COLORS[3] });
      }
    } else {
      // Seccionar en segmentos entre divisiones
      // Los puntos de corte son: xLeft, pos de cada div inside, xRight
      // El ancho de cada segmento descuenta medio grosor de división en cada extremo interior
      const cuts = [xLeft, ...inside.map(d => d.pos), xRight];
      for (let ci = 0; ci < cuts.length - 1; ci++) {
        const rawL = cuts[ci];
        const rawR = cuts[ci + 1];
        // Descontar grosor de divisiones en los bordes interiores
        const l = rawL + (ci > 0 ? t / 2 : 0);
        const r = rawR - (ci < cuts.length - 2 ? t / 2 : 0);
        const w = r - l;
        if (w > 0.5) {
          pieces.push({
            label: `Est.${idx+1} Sec.${ci+1}`, qty:1,
            wcm:w, hcm:p,
            w:Math.round(w*10), h:Math.round(p*10),
            color:PIECE_COLORS[3]
          });
        }
      }
    }
  });

  STATE.pieces = pieces;
  return pieces;
}

// ─── recalc ──────────────────────────────────────────────────────────────────
function recalc() {
  const pieces = computePieces();
  const totalM2   = pieces.reduce((s, p) => s + p.w * p.h, 0) / 1e6;
  const planchaM2 = (STATE.planchaW * STATE.planchaH) / 1e6;
  const result    = packPieces(pieces);
  const nP        = result.sheets.length;
  const usedM2    = result.sheets.reduce((s, sh) => s + sh.placed.reduce((a, p) => a + p.w * p.h, 0), 0) / 1e6;
  const waste     = nP > 0 ? Math.round((1 - usedM2 / (nP * planchaM2)) * 100) : 0;

  STATE.planchasNeeded = nP;
  STATE.areaTotal = totalM2;

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('calc-planchas', nP);
  set('calc-area-total', totalM2.toFixed(3));
  set('calc-area-plancha', planchaM2.toFixed(3));
  set('calc-desperdicio', waste);
  set('plancha-format', `${STATE.planchaW} × ${STATE.planchaH} mm`);
  set('note-grosor', STATE.thick);

  updatePiecesList(pieces);
  updateSummary();

  // Actualizar plan de corte si está visible
  const cutView = document.getElementById('view-cut');
  if (cutView && cutView.classList.contains('active')) renderCutPlan();

  // 3D siempre disponible
  if (typeof redraw3D === 'function') {
    try { redraw3D(); } catch(e) {}
  }
}

function updatePiecesList(pieces) {
  const list = document.getElementById('pieces-list');
  if (!list) return;
  if (!pieces.length) {
    list.innerHTML = '<span class="no-items">Diseña tu mueble para ver las piezas</span>';
    return;
  }
  list.innerHTML = pieces.map(p => `
    <div class="piece-item">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0"></div>
        <span class="piece-name">${p.label}</span>
      </div>
      <div>
        <span class="piece-dim">${p.wcm.toFixed(0)}×${p.hcm.toFixed(0)}cm</span>
        <div class="piece-mm">${p.w}×${p.h} mm</div>
      </div>
    </div>`).join('');

  const detail = document.getElementById('pieces-detail');
  if (detail) {
    detail.innerHTML = pieces.map(p => `
      <div class="piece-item">
        <span class="piece-name" style="font-size:11px">${p.label}</span>
        <span class="piece-mm">${p.w}×${p.h}mm</span>
      </div>`).join('');
  }
}

function updateSummary() {
  const typeN  = {'mueble-alto':'Mueble alto','mueble-bajo':'Mueble bajo','repisa':'Repisas','escritorio':'Escritorio'};
  const mountN = {'libre':'Libre','anclaje':'Anclaje a pared'};
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  set('sum-type',  typeN[STATE.type]   || STATE.type);
  set('sum-mount', mountN[STATE.mount] || STATE.mount);
  set('sum-thick', STATE.thick + ' mm');
}
