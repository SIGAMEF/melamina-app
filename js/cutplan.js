// === CUTPLAN.JS v8 ===
// Cada fila del plan de corte tiene botón ✕ que llama excludePiece() → actualiza despiece, 2D y 3D.

const PIECE_COLORS=[
  'rgba(212,168,67,0.75)',  // lateral
  'rgba(184,140,46,0.75)',  // tapa
  'rgba(74,158,255,0.75)',  // división
  'rgba(60,184,122,0.75)',  // estante
  'rgba(224,82,82,0.75)',   // fondo
  'rgba(160,100,200,0.75)', // rail
];

// ─── Maximal Rectangles Bin Packing ──────────────────────────────────────
function packPieces(pieces){
  if(!pieces||!pieces.length) return{sheets:[]};
  const sorted=[...pieces].sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h));
  const PW=STATE.planchaW, PH=STATE.planchaH, KERF=4;
  const sheets=[]; let remaining=[...sorted];

  while(remaining.length>0){
    const freeRects=[{x:0,y:0,w:PW,h:PH}];
    const placed=[], notPlaced=[];
    remaining.forEach(piece=>{
      let best=null, bestFit=Infinity;
      for(const fr of freeRects){
        for(const[pw,ph]of[[piece.w,piece.h],[piece.h,piece.w]]){
          if(pw+KERF<=fr.w&&ph+KERF<=fr.h){const fit=Math.min(fr.w-pw,fr.h-ph);if(fit<bestFit){bestFit=fit;best={fr,pw,ph};}}
        }
      }
      if(best){
        const{fr,pw,ph}=best;
        const item={...piece,x:fr.x,y:fr.y,w:pw,h:ph,rotated:pw!==piece.w};
        placed.push(item);
        const newF=[];
        for(const r of freeRects){
          if(!rectsOverlap(r,item,KERF)){newF.push(r);continue;}
          if(r.x<item.x)newF.push({x:r.x,y:r.y,w:item.x-r.x,h:r.h});
          if(r.x+r.w>item.x+pw+KERF)newF.push({x:item.x+pw+KERF,y:r.y,w:r.x+r.w-(item.x+pw+KERF),h:r.h});
          if(r.y<item.y)newF.push({x:r.x,y:r.y,w:r.w,h:item.y-r.y});
          if(r.y+r.h>item.y+ph+KERF)newF.push({x:r.x,y:item.y+ph+KERF,w:r.w,h:r.y+r.h-(item.y+ph+KERF)});
        }
        freeRects.length=0;
        outer:for(const r of newF){if(r.w<20||r.h<20)continue;for(const r2 of newF){if(r!==r2&&r2.x<=r.x&&r2.y<=r.y&&r2.x+r2.w>=r.x+r.w&&r2.y+r2.h>=r.y+r.h)continue outer;}freeRects.push(r);}
      } else notPlaced.push(piece);
    });
    sheets.push({placed,freeRects});
    remaining=notPlaced;
  }
  return{sheets};
}
function rectsOverlap(r,item,kerf){return!(item.x>=r.x+r.w||item.x+item.w+kerf<=r.x||item.y>=r.y+r.h||item.y+item.h+kerf<=r.y);}

// ─── Render ───────────────────────────────────────────────────────────────
function renderCutPlan(){
  const container=document.getElementById('cut-plan-content');
  if(!container){console.warn('cut-plan-content not found');return;}
  const pieces=computePieces();
  container.innerHTML='';

  if(!pieces.length){
    container.innerHTML='<p style="color:#5a5a58;padding:24px;font-size:13px">Agrega dimensiones y estructura para ver el plan de corte.<br><small style="opacity:.6">Si eliminaste todas las piezas, usa "Restaurar" en el panel de propiedades.</small></p>';
    return;
  }

  const result=packPieces(pieces);
  const projectName=document.getElementById('project-name')?.textContent||'Mi Mueble';
  const fecha=new Date().toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'});

  // ── CABECERA ──
  const hdr=document.createElement('div');
  hdr.className='cut-header';
  hdr.innerHTML=`
    <div class="cut-header-top">
      <div class="cut-logo"><div style="font-size:17px;font-weight:700;color:#d4a843">▪ MelaminaDesign</div><div style="font-size:11px;color:#5a5a58;margin-top:2px">Hoja de Despiece y Plan de Corte</div></div>
      <div class="cut-header-info">
        <table class="info-table">
          <tr><td>Proyecto:</td><td><strong>${projectName}</strong></td><td>Fecha:</td><td>${fecha}</td></tr>
          <tr><td>Material:</td><td><strong>Melamina ${STATE.thick}mm</strong></td><td>Plancha:</td><td>${STATE.planchaW}×${STATE.planchaH}mm</td></tr>
          <tr><td>Planchas:</td><td><strong>${result.sheets.length}</strong></td><td>Desperdicio:</td><td>${calcWaste(result,pieces)}%</td></tr>
        </table>
      </div>
    </div>`;
  container.appendChild(hdr);

  // ── TABLA DE PIEZAS — con botón eliminar por fila ──
  const tbl=document.createElement('div');
  tbl.className='cut-table-section';
  tbl.innerHTML=`
    <div class="canto-legend">
      <strong>Simbología de canto:</strong>
      <span class="canto-sym">D = Delgado 0.4mm</span>
      <span class="canto-sym">G = Grueso 1–2mm</span>
      <span class="canto-sym">— = Sin canto</span>
      <span class="canto-sym">L1=Sup · L2=Inf · A1=Izq · A2=Der</span>
      <span style="margin-left:auto;font-size:10px;color:#5a5a58">✕ en cada fila = quitar del despiece (actualiza diseño y planchas)</span>
    </div>
    <table class="cut-table">
      <thead>
        <tr>
          <th class="th-n">N°</th><th class="th-desc">Descripción</th><th class="th-qty">Cant.</th>
          <th class="th-dim">Largo<br><small>mm</small></th><th class="th-dim">Ancho<br><small>mm</small></th>
          <th class="th-veta">Veta</th>
          <th class="th-canto">L1</th><th class="th-canto">L2</th><th class="th-canto">A1</th><th class="th-canto">A2</th>
          <th class="th-obs">Observaciones</th>
          <th style="width:28px"></th>
        </tr>
      </thead>
      <tbody>
        ${pieces.map((p,i)=>{
          const c=defaultCanto(p);
          return`<tr class="cut-row" id="cut-row-${i}">
            <td class="td-n">${i+1}</td>
            <td class="td-desc"><div style="display:flex;align-items:center;gap:6px">
              <div style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0"></div>${p.label}</div></td>
            <td class="td-qty">${p.qty||1}</td>
            <td class="td-dim"><strong>${p.w}</strong></td><td class="td-dim"><strong>${p.h}</strong></td>
            <td class="td-veta"><select class="canto-sel"><option>SÍ</option><option>NO</option></select></td>
            <td class="td-canto">${c.L1}</td><td class="td-canto">${c.L2}</td>
            <td class="td-canto">${c.A1}</td><td class="td-canto">${c.A2}</td>
            <td class="td-obs"><input type="text" class="obs-input" placeholder="—"></td>
            <td style="text-align:center;padding:0">
              <button onclick="excludePieceFromTable('${p._modId}','${p._faceKey}')"
                title="Quitar del despiece — actualiza diseño 2D, 3D y planchas"
                style="background:none;border:none;color:#ef444466;cursor:pointer;font-size:14px;padding:4px;border-radius:3px;transition:color .15s"
                onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#ef444466'">✕</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="2" style="text-align:right;font-size:11px;color:#9a9a96">TOTAL:</td>
        <td style="font-weight:700;color:#d4a843">${pieces.reduce((s,p)=>s+(p.qty||1),0)}</td>
        <td colspan="9" style="font-size:10px;color:#5a5a58;padding-left:8px">
          Área: ${(pieces.reduce((s,p)=>s+p.w*p.h*(p.qty||1),0)/1e6).toFixed(3)} m²
          &nbsp;|&nbsp; ${result.sheets.length} planchas ${STATE.planchaW}×${STATE.planchaH}mm
        </td>
      </tr></tfoot>
    </table>`;
  container.appendChild(tbl);

  // ── PLANOS DE DISTRIBUCIÓN ──
  result.sheets.forEach((sheet,idx)=>{
    const usedA=sheet.placed.reduce((s,p)=>s+p.w*p.h,0);
    const usage=Math.round(usedA/(STATE.planchaW*STATE.planchaH)*100);
    const div=document.createElement('div');
    div.className='cut-plan-sheet';
    div.innerHTML=`<h3 class="sheet-title">
      Plancha ${idx+1} de ${result.sheets.length}
      <span class="usage-badge" style="background:${usage>75?'#3cb87a':'#d4a843'}22;color:${usage>75?'#3cb87a':'#d4a843'};padding:2px 8px;border-radius:3px;font-size:11px">${usage}% aprovechada</span>
      <span style="font-size:11px;color:#5a5a58;margin-left:8px">${STATE.planchaW}×${STATE.planchaH}mm · ${STATE.thick}mm</span>
    </h3>`;
    const cvs=document.createElement('canvas');
    const dW=Math.min(560,container.clientWidth-32);
    const dH=Math.round(dW*STATE.planchaH/STATE.planchaW);
    cvs.width=dW; cvs.height=dH;
    cvs.style.cssText=`width:${dW}px;height:${dH}px;display:block;border:1px solid #2a2a1e;border-radius:4px`;
    div.appendChild(cvs);
    drawSheet(cvs.getContext('2d'),sheet,dW,dH);
    const leg=document.createElement('div'); leg.className='cut-legend';
    const seen=new Set();
    sheet.placed.forEach(p=>{if(!seen.has(p.label)){seen.add(p.label);leg.innerHTML+=`<div class="legend-item"><div class="legend-swatch" style="background:${p.color}"></div><span>${p.label} (${p.w}×${p.h}mm)</span></div>`;}});
    div.appendChild(leg);
    container.appendChild(div);
  });

  // ── PLANO DE ARMADO ──
  const asmDiv=document.createElement('div');
  asmDiv.className='assembly-section';
  asmDiv.innerHTML='<h3 class="sheet-title" style="margin-top:24px">Plano de armado (vista frontal)</h3>';
  asmDiv.appendChild(buildAssemblySVG());
  asmDiv.innerHTML+=`
    <div style="margin-top:12px">
      <table class="cut-table">
        <thead><tr><th style="width:32px">Paso</th><th>Pieza</th><th>Medida (mm)</th><th>Instrucción</th></tr></thead>
        <tbody>${buildAssemblySteps().map((s,i)=>`<tr>
          <td class="td-n">${i+1}</td>
          <td class="td-desc"><div style="display:flex;align-items:center;gap:6px"><div style="width:8px;height:8px;border-radius:2px;background:${s.color};flex-shrink:0"></div>${s.label}</div></td>
          <td style="text-align:center;font-family:monospace;font-size:12px">${s.dim}</td>
          <td style="font-size:11px;color:#9a9a96;padding:5px 8px">${s.nota}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  container.appendChild(asmDiv);

  // ── RESUMEN ──
  const sumDiv=document.createElement('div');
  sumDiv.className='cut-summary';
  sumDiv.innerHTML=`
    <h3>Resumen de materiales</h3>
    <table class="summary-table">
      <tr><th>Material</th><th>Espesor</th><th>Formato</th><th>Cantidad</th><th>Uso</th></tr>
      <tr><td>Melamina (estructura)</td><td>${STATE.thick}mm</td><td>${STATE.planchaW}×${STATE.planchaH}mm</td><td>${result.sheets.length} planchas</td><td>Laterales, tapas, divisiones, estantes</td></tr>
    </table>
    <div class="cut-footer-note">
      <p>⚠ Medidas finales después del kerf de sierra (4mm). Tapacanto grueso: descontar 1mm por canto.</p>
      <p>Generado con MelaminaDesign · ${fecha}</p>
    </div>`;
  container.appendChild(sumDiv);
}

// Eliminar pieza desde la tabla de corte → actualiza todo
function excludePieceFromTable(modId, faceKey){
  excludePiece(modId, faceKey); // de calc.js — recalc() + redraw2D() incluidos
  // Re-renderizar el plan de corte
  setTimeout(()=>renderCutPlan(), 50);
  showNotification(`Pieza eliminada del despiece. El diseño 2D, 3D y las planchas se actualizaron.`);
}

function showNotification(msg){
  let n=document.getElementById('cut-notification');
  if(!n){
    n=document.createElement('div');
    n.id='cut-notification';
    n.style.cssText='position:sticky;top:0;background:#1f2433;border:1px solid #10b981;border-radius:6px;padding:10px 16px;font-size:12px;color:#10b981;z-index:10;margin-bottom:12px;display:flex;align-items:center;gap:10px';
    const container=document.getElementById('cut-plan-content');
    if(container) container.prepend(n);
  }
  n.innerHTML=`<span>✓</span><span>${msg}</span><button onclick="this.parentElement.style.display='none'" style="margin-left:auto;background:none;border:none;color:#10b981;cursor:pointer;font-size:16px">✕</button>`;
  n.style.display='flex';
  setTimeout(()=>{if(n)n.style.display='none';},5000);
}

// ─── SVG de armado ────────────────────────────────────────────────────────
function buildAssemblySVG(){
  // Usar el primer módulo activo con piezas
  const mod=getActiveModule()||STATE.modules[0];
  if(!mod) return document.createElementNS('http://www.w3.org/2000/svg','svg');

  const a=mod.ancho, h=mod.alto, p=mod.prof, t=STATE.thick/10;
  const SVG_W=500, SVG_H=Math.max(180,Math.round(SVG_W*h/Math.max(a,1)));
  const PAD=50, fw=SVG_W-PAD*2, fh=SVG_H-PAD*2, scX=fw/a, scY=fh/h, fx=PAD, fy=PAD;
  const ts=t*scX, tsY=t*scY;
  const ex=mod.excludedFaces||new Set();
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('width',SVG_W); svg.setAttribute('height',SVG_H+36);
  svg.setAttribute('viewBox',`0 0 ${SVG_W} ${SVG_H+36}`);
  svg.style.cssText='display:block;border:1px solid #2a2a1e;border-radius:4px;background:#111110;margin-top:8px';

  const r=(x,y,w,hh,fill,stroke,sw=0.8,opacity=1)=>{const el=document.createElementNS(ns,'rect');el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('width',w);el.setAttribute('height',hh);el.setAttribute('fill',fill);el.setAttribute('stroke',stroke);el.setAttribute('stroke-width',sw);el.setAttribute('opacity',opacity);return el;};
  const txt=(x,y,str,sz=9,col='#9a9a96',anchor='middle')=>{const el=document.createElementNS(ns,'text');el.setAttribute('x',x);el.setAttribute('y',y);el.setAttribute('font-size',sz);el.setAttribute('fill',col);el.setAttribute('text-anchor',anchor);el.setAttribute('font-family','Space Grotesk,sans-serif');el.textContent=str;return el;};
  const ln=(x1,y1,x2,y2,stroke='rgba(255,255,255,0.15)',sw=0.5)=>{const el=document.createElementNS(ns,'line');el.setAttribute('x1',x1);el.setAttribute('y1',y1);el.setAttribute('x2',x2);el.setAttribute('y2',y2);el.setAttribute('stroke',stroke);el.setAttribute('stroke-width',sw);return el;};

  // Fondo
  svg.appendChild(r(fx,fy,fw,fh,'rgba(212,168,67,0.03)','#2a2a1e'));

  if(!ex.has('lateral-izq')) svg.appendChild(r(fx,fy,ts,fh,'rgba(212,168,67,0.3)','#d4a843'));
  if(!ex.has('lateral-der')) svg.appendChild(r(fx+fw-ts,fy,ts,fh,'rgba(212,168,67,0.3)','#d4a843'));
  if(!ex.has('tapa-sup'))    svg.appendChild(r(fx+ts,fy,fw-2*ts,tsY,'rgba(184,140,46,0.35)','#b88c2e'));
  if(!ex.has('tapa-inf'))    svg.appendChild(r(fx+ts,fy+fh-tsY,fw-2*ts,tsY,'rgba(184,140,46,0.35)','#b88c2e'));
  if(!ex.has('fondo')&&mod.conFondo) svg.appendChild(r(fx+ts,fy+tsY,fw-2*ts,fh-2*tsY,'rgba(224,82,82,0.15)','rgba(224,82,82,0.3)',0.5));

  // Divisiones
  mod.divisions.forEach((div,idx)=>{
    const key=`div-v-${idx}`;
    if(ex.has(key)) return;
    const dx=fx+div.pos*scX;
    const sf=div.startFrac||0, ef=div.endFrac||1;
    const inH=fh-2*tsY;
    const dy1=fy+tsY+sf*inH, dy2=fy+tsY+ef*inH;
    svg.appendChild(r(dx-ts/2,dy1,ts,dy2-dy1,'rgba(74,158,255,0.3)','#4a9eff',0.8));
    svg.appendChild(ln(fx,fy+fh+8,dx,fy+fh+8,'rgba(74,158,255,0.4)',0.5));
    svg.appendChild(txt(dx,fy+fh+20,`${div.pos.toFixed(1)}cm`,8,'#4a9eff'));
  });

  // Estantes
  const sortedDivs=[...mod.divisions].sort((a,b)=>a.pos-b.pos);
  const netA=a-2*t;
  mod.shelves.forEach((sh,idx)=>{
    const sy2d=fy+fh-sh.pos*scY;
    const sf=sh.startFrac||0, ef=sh.endFrac||1;
    const xLcm=t+sf*netA, xRcm=t+ef*netA;
    const inside=sortedDivs.filter(d=>d.pos>xLcm+0.1&&d.pos<xRcm-0.1);
    const cuts=[xLcm,...inside.map(d=>d.pos),xRcm];
    for(let ci=0;ci<cuts.length-1;ci++){
      if(ex.has(`shelf-${idx}-${ci}`)) continue;
      const lAdj=cuts[ci]+(ci>0?t/2:0), rAdj=cuts[ci+1]-(ci<cuts.length-2?t/2:0);
      if(rAdj-lAdj>0.2) svg.appendChild(r(fx+lAdj*scX,sy2d-tsY/2,(rAdj-lAdj)*scX,Math.max(1,tsY),'rgba(60,184,122,0.3)','#3cb87a',0.8));
    }
    svg.appendChild(txt(fx-6,sy2d+3,`${sh.pos.toFixed(1)}`,8,'#3cb87a','end'));
  });

  // Cotas
  svg.appendChild(ln(fx,fy-16,fx+fw,fy-16,'rgba(255,255,255,0.2)',0.5));
  svg.appendChild(txt(fx+fw/2,fy-20,`${a}cm (${a*10}mm)`,9,'#9a9a96'));
  svg.appendChild(ln(fx+fw+16,fy,fx+fw+16,fy+fh,'rgba(255,255,255,0.2)',0.5));
  const gt=document.createElementNS(ns,'text');
  gt.setAttribute('transform',`translate(${fx+fw+26},${fy+fh/2}) rotate(-90)`);
  gt.setAttribute('font-size','9');gt.setAttribute('fill','#9a9a96');gt.setAttribute('text-anchor','middle');gt.setAttribute('font-family','Space Grotesk,sans-serif');
  gt.textContent=`${h}cm (${h*10}mm)`;svg.appendChild(gt);

  const legY=SVG_H+22;
  [['#d4a843','Lateral'],['#b88c2e','Tapa'],['#4a9eff','División'],['#3cb87a','Estante'],['#e05252','Fondo']].forEach(([c,l],i)=>{
    svg.appendChild(r(10+i*80,legY-8,8,8,c,c)); svg.appendChild(txt(22+i*80,legY,l,9,'#9a9a96','start'));
  });
  return svg;
}

function buildAssemblySteps(){
  const mod=getActiveModule()||STATE.modules[0]; if(!mod) return[];
  const t=STATE.thick/10, a=mod.ancho, h=mod.alto, p=mod.prof, netA=a-2*t;
  const ex=mod.excludedFaces||new Set();
  const steps=[];
  if(!ex.has('lateral-izq')) steps.push({label:'Lateral Izquierdo',dim:`${Math.round(p*10)}×${Math.round(h*10)}mm`,color:PIECE_COLORS[0],nota:'Vertical en el extremo izquierdo'});
  if(!ex.has('lateral-der')) steps.push({label:'Lateral Derecho',  dim:`${Math.round(p*10)}×${Math.round(h*10)}mm`,color:PIECE_COLORS[0],nota:'Vertical en el extremo derecho'});
  if(!ex.has('tapa-inf'))    steps.push({label:'Tapa Inferior',    dim:`${Math.round(netA*10)}×${Math.round(p*10)}mm`,color:PIECE_COLORS[1],nota:'Encajar entre laterales al ras del suelo'});
  if(!ex.has('tapa-sup'))    steps.push({label:'Tapa Superior',    dim:`${Math.round(netA*10)}×${Math.round(p*10)}mm`,color:PIECE_COLORS[1],nota:'Encajar entre laterales en la parte superior'});
  if(!ex.has('fondo')&&mod.conFondo) steps.push({label:'Fondo',dim:`${Math.round(netA*10)}×${Math.round((h-2*t)*10)}mm`,color:PIECE_COLORS[4],nota:'Insertar desde atrás'});
  mod.divisions.forEach((d,i)=>{if(!ex.has(`div-v-${i}`)){const rH=Math.round(((d.endFrac||1)-(d.startFrac||0))*(h-2*t)*10);steps.push({label:`División ${i+1}`,dim:`${Math.round(p*10)}×${rH}mm`,color:PIECE_COLORS[2],nota:`A ${d.pos.toFixed(1)}cm del lateral izquierdo`});}});
  mod.shelves.forEach((s,i)=>steps.push({label:`Estante ${i+1}`,dim:`— × ${Math.round(p*10)}mm`,color:PIECE_COLORS[3],nota:`A ${s.pos.toFixed(1)}cm del suelo`}));
  if(mod.conRail){const n=Math.max(1,parseInt(mod.numRails)||1);for(let i=0;i<n;i++){if(!ex.has(`rail-${i}`))steps.push({label:`Rail${n>1?' '+(i+1):''}`,dim:`${Math.round(netA*10)}×80mm`,color:PIECE_COLORS[5],nota:'Atornillar a la pared'});}}
  return steps;
}

function drawSheet(ctx,sheet,W,H){
  const sx=W/STATE.planchaW, sy=H/STATE.planchaH;
  ctx.fillStyle='#1a1a00'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=0.5;
  for(let x=0;x<=STATE.planchaW;x+=100){ctx.beginPath();ctx.moveTo(x*sx,0);ctx.lineTo(x*sx,H);ctx.stroke();}
  for(let y=0;y<=STATE.planchaH;y+=100){ctx.beginPath();ctx.moveTo(0,y*sy);ctx.lineTo(W,y*sy);ctx.stroke();}
  ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='8px Space Grotesk,sans-serif'; ctx.textAlign='left';
  for(let x=0;x<=STATE.planchaW;x+=500) ctx.fillText(`${x/10}cm`,x*sx+2,10);
  sheet.placed.forEach(p=>{
    const px=p.x*sx, py=p.y*sy, pw=p.w*sx, ph=p.h*sy;
    ctx.fillStyle=p.color; ctx.fillRect(px+1,py+1,pw-2,ph-2);
    ctx.strokeStyle=p.color.replace('0.75','1'); ctx.lineWidth=1; ctx.strokeRect(px+1,py+1,pw-2,ph-2);
    if(ph>16&&pw>36){
      ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.font=`${Math.max(7,Math.min(11,pw/9))}px Space Grotesk,sans-serif`;
      ctx.fillText(p.label,px+pw/2,py+ph/2+(ph>28?-5:3));
      if(ph>28){ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font=`${Math.max(6,Math.min(9,pw/11))}px Space Grotesk,sans-serif`;ctx.fillText(`${p.w}×${p.h}mm`,px+pw/2,py+ph/2+8);}
    }
  });
  ctx.strokeStyle='#555500'; ctx.lineWidth=1.5; ctx.strokeRect(0,0,W,H);
}

function defaultCanto(p){
  const l=(p.label||'').toLowerCase();
  if(l.includes('lateral'))    return{L1:'G',L2:'G',A1:'G',A2:'G'};
  if(l.includes('tapa'))       return{L1:'G',L2:'G',A1:'—',A2:'—'};
  if(l.includes('div')||l.includes('ción')) return{L1:'D',L2:'—',A1:'—',A2:'—'};
  if(l.includes('est'))        return{L1:'D',L2:'—',A1:'—',A2:'—'};
  return{L1:'—',L2:'—',A1:'—',A2:'—'};
}

function calcWaste(result,pieces){
  const used=pieces.reduce((s,p)=>s+p.w*p.h*(p.qty||1),0);
  const total=result.sheets.length*STATE.planchaW*STATE.planchaH;
  return total>0?Math.round((1-used/total)*100):0;
}
