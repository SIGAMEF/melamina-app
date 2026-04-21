// === DIALOG.JS v7 ===
// Diálogos modales para: ángulo en L, arco, explotar módulo

// ─── Diálogo genérico ─────────────────────────────────────────────────────
function showDialog(title, bodyHTML, onConfirm) {
  let overlay = document.getElementById('dlg-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dlg-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div style="background:#181c25;border:1px solid #2a3045;border-radius:10px;min-width:320px;max-width:440px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #2a3045">
        <span style="font-weight:600;font-size:14px;color:#e8eaf0">${title}</span>
        <button onclick="closeDialog()" style="background:none;border:none;color:#555d72;font-size:18px;cursor:pointer;line-height:1">✕</button>
      </div>
      <div id="dlg-body" style="padding:18px">${bodyHTML}</div>
      <div style="display:flex;gap:8px;padding:12px 18px;border-top:1px solid #2a3045">
        <button onclick="closeDialog()" style="flex:1;padding:8px;border:1px solid #2a3045;border-radius:6px;background:transparent;color:#8b92a8;cursor:pointer;font-size:13px">Cancelar</button>
        <button id="dlg-confirm" style="flex:2;padding:8px;border:none;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer;font-size:13px;font-weight:600">Aceptar</button>
      </div>
    </div>`;
  overlay.style.display = 'flex';
  document.getElementById('dlg-confirm').onclick = () => { onConfirm(); closeDialog(); };
}

function closeDialog() {
  const o = document.getElementById('dlg-overlay');
  if (o) o.style.display = 'none';
}

// ─── Diálogo: Ángulo en L ─────────────────────────────────────────────────
// Crea dos tableros formando un ángulo de 90° (brazo horizontal + brazo vertical)
function dialogAngulo(callback) {
  const body = `
    <p style="font-size:12px;color:#8b92a8;margin-bottom:14px">Define las dos tablas que forman el ángulo en L. Se crearán como un módulo en esquina.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <div style="font-size:11px;color:#3b82f6;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Tablero A (horizontal)</div>
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px">Largo (cm)</label>
        <input id="ang-a-largo" type="number" value="60" min="5" max="500"
          style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px;margin-top:8px">Profundidad (cm)</label>
        <input id="ang-a-prof" type="number" value="45" min="5" max="200"
          style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
      </div>
      <div>
        <div style="font-size:11px;color:#10b981;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Tablero B (vertical)</div>
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px">Alto (cm)</label>
        <input id="ang-b-alto" type="number" value="200" min="5" max="500"
          style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px;margin-top:8px">Profundidad (cm)</label>
        <input id="ang-b-prof" type="number" value="45" min="5" max="200"
          style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
      </div>
    </div>
    <div style="margin-top:10px">
      <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px">Grosor melamina (mm)</label>
      <select id="ang-grosor" style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
        <option value="18" selected>18 mm (estándar)</option>
        <option value="15">15 mm</option>
        <option value="25">25 mm</option>
      </select>
    </div>
    <div style="margin-top:12px;padding:8px;background:#1f2433;border-radius:6px;font-size:11px;color:#8b92a8">
      💡 Se crearán dos tableros independientes posicionados en L. Podrás moverlos juntos o separados.
    </div>`;

  showDialog('Crear ángulo en L (90°)', body, () => {
    const aLargo = parseFloat(document.getElementById('ang-a-largo').value) || 60;
    const aProf  = parseFloat(document.getElementById('ang-a-prof').value)  || 45;
    const bAlto  = parseFloat(document.getElementById('ang-b-alto').value)  || 200;
    const bProf  = parseFloat(document.getElementById('ang-b-prof').value)  || 45;
    const grosor = parseInt(document.getElementById('ang-grosor').value)    || 18;
    callback({ aLargo, aProf, bAlto, bProf, grosor });
  });
}

// ─── Diálogo: Arco / curva ────────────────────────────────────────────────
// Crea un módulo con forma de arco (tablero curvo — se representa como dos tableros con ángulo)
function dialogArco(callback) {
  const body = `
    <p style="font-size:12px;color:#8b92a8;margin-bottom:14px">El arco se representa como dos tableros que se unen en ángulo. Define sus dimensiones:</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div>
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px">Largo total del arco (cm)</label>
        <input id="arc-largo" type="number" value="60" min="5" max="500"
          style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px;margin-top:8px">Alto (cm)</label>
        <input id="arc-alto" type="number" value="30" min="5" max="200"
          style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
      </div>
      <div>
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px">Profundidad (cm)</label>
        <input id="arc-prof" type="number" value="45" min="5" max="200"
          style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
        <label style="font-size:11px;color:#8b92a8;display:block;margin-bottom:3px;margin-top:8px">Segmentos del arco</label>
        <select id="arc-segs" style="width:100%;padding:6px 8px;background:#1f2433;border:1px solid #2a3045;border-radius:6px;color:#e8eaf0;font-size:13px">
          <option value="2">2 tableros (simple)</option>
          <option value="3" selected>3 tableros (suave)</option>
          <option value="4">4 tableros (muy suave)</option>
        </select>
      </div>
    </div>
    <div style="margin-top:12px;padding:8px;background:#1f2433;border-radius:6px;font-size:11px;color:#8b92a8">
      💡 Cada segmento es un tablero de melamina cortado con ángulo. El corte diagonal se indica en el despiece.
    </div>`;

  showDialog('Crear arco / curva', body, () => {
    const largo = parseFloat(document.getElementById('arc-largo').value) || 60;
    const alto  = parseFloat(document.getElementById('arc-alto').value)  || 30;
    const prof  = parseFloat(document.getElementById('arc-prof').value)  || 45;
    const segs  = parseInt(document.getElementById('arc-segs').value)    || 3;
    callback({ largo, alto, prof, segs });
  });
}

// ─── Diálogo: Explotar módulo ─────────────────────────────────────────────
function dialogExplotar(mod, callback) {
  const faces = buildFaceList(mod);
  const rows = faces.map((f, i) => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1f2433;cursor:pointer">
      <input type="checkbox" id="face-${i}" checked style="accent-color:#3b82f6">
      <div style="width:10px;height:10px;border-radius:2px;background:${f.color};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:12px;color:#e8eaf0">${f.label}</div>
        <div style="font-size:10px;color:#555d72;font-family:monospace">${f.w}×${f.h}mm</div>
      </div>
    </label>`).join('');

  const body = `
    <p style="font-size:12px;color:#8b92a8;margin-bottom:12px">
      Selecciona las caras que quieres conservar como piezas individuales.<br>
      Las desmarcadas se <strong style="color:#ef4444">eliminarán del despiece</strong>.
    </p>
    <div style="max-height:280px;overflow-y:auto">${rows}</div>
    <div style="margin-top:10px;padding:8px;background:#1f2433;border-radius:6px;font-size:11px;color:#8b92a8">
      ⚡ Las piezas que cruzan divisiones se fraccionarán automáticamente.
    </div>`;

  showDialog(`Explotar módulo — ${mod.ancho}×${mod.alto}cm`, body, () => {
    const kept = faces.filter((_, i) => document.getElementById(`face-${i}`)?.checked);
    callback(kept);
  });
}

// Genera la lista de caras de un módulo
function buildFaceList(mod) {
  const t = STATE.thick / 10;
  const a = mod.ancho, h = mod.alto, p = mod.prof;
  const netA = a - 2*t, netH = h - 2*t;
  const faces = [];
  const C = ['rgba(212,168,67,.8)','rgba(184,140,46,.8)','rgba(74,158,255,.8)','rgba(60,184,122,.8)','rgba(224,82,82,.8)','rgba(160,100,200,.8)'];

  faces.push({ label:'Lateral Izquierdo', w:Math.round(p*10), h:Math.round(h*10), color:C[0], type:'lateral-izq' });
  faces.push({ label:'Lateral Derecho',   w:Math.round(p*10), h:Math.round(h*10), color:C[0], type:'lateral-der' });
  faces.push({ label:'Tapa Superior',     w:Math.round(netA*10), h:Math.round(p*10), color:C[1], type:'tapa-sup' });
  faces.push({ label:'Tapa Inferior',     w:Math.round(netA*10), h:Math.round(p*10), color:C[1], type:'tapa-inf' });

  if (mod.conFondo)
    faces.push({ label:'Fondo', w:Math.round(netA*10), h:Math.round(netH*10), color:C[4], type:'fondo' });

  if (mod.conRail) {
    const n = Math.max(1, parseInt(mod.numRails)||1);
    for (let i=0;i<n;i++) faces.push({ label:`Rail anclaje ${n>1?i+1:''}`, w:Math.round(netA*10), h:80, color:C[5], type:`rail-${i}` });
  }

  // Divisiones verticales (con longitud ajustada)
  mod.divisions.forEach((div, idx) => {
    const sf = div.startFrac||0, ef = div.endFrac||1;
    const realH = Math.max(1, (ef-sf)*netH);
    faces.push({ label:`División vertical ${idx+1}`, w:Math.round(p*10), h:Math.round(realH*10), color:C[2], type:`div-v-${idx}`, divIdx:idx });
  });

  // Estantes horizontales — ya fraccionados
  const sortedDivs = [...mod.divisions].sort((a,b)=>a.pos-b.pos);
  mod.shelves.forEach((sh, idx) => {
    const sf=sh.startFrac||0, ef=sh.endFrac||1;
    const xL=t+sf*netA, xR=t+ef*netA;
    const inside=sortedDivs.filter(d=>d.pos>xL+0.1&&d.pos<xR-0.1);
    const cuts=[xL,...inside.map(d=>d.pos),xR];
    for(let ci=0;ci<cuts.length-1;ci++){
      const l=cuts[ci]+(ci>0?t/2:0), r=cuts[ci+1]-(ci<cuts.length-2?t/2:0);
      const w=r-l;
      if(w>0.2) faces.push({ label:`Estante ${idx+1}${cuts.length>2?' sec.'+(ci+1):''}`, w:Math.round(w*10), h:Math.round(p*10), color:C[3], type:`shelf-${idx}-${ci}`, shIdx:idx, secIdx:ci });
    }
  });

  return faces;
}
