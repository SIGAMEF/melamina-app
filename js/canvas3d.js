// === CANVAS3D.JS v5 ===
// 3D siempre renderiza en canvas-3d (split view)
// Si se abre modal 3D, renderiza también ahí

let canvas3d, ctx3d;
let rot3DX = 20, rot3DY = -30;
let is3DDragging = false, drag3DStart = null;

function initCanvas3D() {
  canvas3d = document.getElementById('canvas-3d');
  if (!canvas3d) return;
  ctx3d = canvas3d.getContext('2d');

  canvas3d.addEventListener('mousedown', e => {
    is3DDragging=true; drag3DStart={x:e.clientX,y:e.clientY,rx:rot3DX,ry:rot3DY};
  });
  canvas3d.addEventListener('mousemove', e => {
    if (!is3DDragging) return;
    rot3DY = drag3DStart.ry + (e.clientX-drag3DStart.x)*0.45;
    rot3DX = Math.max(-30, Math.min(80, drag3DStart.rx - (e.clientY-drag3DStart.y)*0.45));
    redraw3D();
  });
  canvas3d.addEventListener('mouseup',   () => { is3DDragging=false; });
  canvas3d.addEventListener('mouseleave',() => { is3DDragging=false; });
  redraw3D();
}

function rotate3D(dy, dx) { rot3DY+=dy; rot3DX=Math.max(-30,Math.min(80,rot3DX+dx)); redraw3D(); }
function reset3D()         { rot3DX=20; rot3DY=-30; redraw3D(); }

function project3D(x, y, z) {
  const ry=rot3DY*Math.PI/180, rx=rot3DX*Math.PI/180;
  const x1=x*Math.cos(ry)-z*Math.sin(ry), z1=x*Math.sin(ry)+z*Math.cos(ry);
  const y2=y*Math.cos(rx)-z1*Math.sin(rx), z2=y*Math.sin(rx)+z1*Math.cos(rx);
  return {px:x1, py:-y2, pz:z2};
}

function redraw3D() {
  // Buscar el canvas correcto según la vista activa
  let cv = document.getElementById('canvas-3d');
  // Si la vista split está activa, usar canvas-3d; si vista solo 3d, usar canvas-3d-solo
  const solo3d = document.getElementById('view-3d');
  if (solo3d && solo3d.classList.contains('active')) {
    cv = document.getElementById('canvas-3d-solo') || cv;
  }
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W=cv.width, H=cv.height;
  if (!W || !H) return;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0c0c0e'; ctx.fillRect(0,0,W,H);

  const a=STATE.ancho, h=STATE.alto, p=STATE.prof, t=STATE.thick/10;
  const maxDim=Math.max(a,h,p)*1.6;
  const scale3=Math.min(W,H)*0.5/maxDim;
  const cx=W/2, cy=H/2+h*scale3*0.1;

  function toScreen(x,y,z) {
    const pp=project3D(x-a/2, y-h/2, z-p/2);
    return {sx: cx+pp.px*scale3, sy: cy+pp.py*scale3};
  }

  const panels=buildPanels3D(a,h,p,t);

  panels.sort((pa,pb) => {
    const da=pa.verts.reduce((s,v)=>s+project3D(v[0]-a/2,v[1]-h/2,v[2]-p/2).pz,0)/pa.verts.length;
    const db=pb.verts.reduce((s,v)=>s+project3D(v[0]-a/2,v[1]-h/2,v[2]-p/2).pz,0)/pb.verts.length;
    return da-db;
  });

  panels.forEach(panel => drawPanel3D(ctx, panel, toScreen));
  drawAxes3D(ctx, W, H);
  drawLabels3D(ctx, a, h, p, toScreen);

  // Hint si canvas muy pequeño
  if (W < 200) {
    ctx.fillStyle='rgba(154,154,150,0.6)'; ctx.font='10px Space Grotesk,sans-serif';
    ctx.textAlign='center'; ctx.fillText('Vista 3D', W/2, H/2);
  }
}

function buildPanels3D(a,h,p,t) {
  const panels=[];
  const W='#c8a96e', D='#a88040', E='#8a6828';
  const divC='#4a9eff', shC='#3cb87a', railC='#e05252';
  const netA=a-2*t;

  panels.push({verts:[[0,0,0],[0,h,0],[0,h,p],[0,0,p]], fill:'rgba(168,128,64,0.4)', stroke:E});
  panels.push({verts:[[a,0,0],[a,h,0],[a,h,p],[a,0,p]], fill:'rgba(168,128,64,0.4)', stroke:E});
  panels.push({verts:[[t,h,0],[t+netA,h,0],[t+netA,h,p],[t,h,p]], fill:'rgba(200,169,110,0.6)', stroke:E});
  panels.push({verts:[[t,0,0],[t+netA,0,0],[t+netA,0,p],[t,0,p]], fill:'rgba(200,169,110,0.6)', stroke:E});

  if (STATE.conFondo) {
    panels.push({verts:[[t,t,0],[t+netA,t,0],[t+netA,h-t,0],[t,h-t,0]], fill:'rgba(160,120,50,0.2)', stroke:'rgba(200,169,110,0.3)'});
  }

  if (STATE.conRail) {
    const n=Math.max(1,parseInt(STATE.numRails)||1);
    const railH=8, spacing=(h-2*t)/(n+1);
    for (let i=1;i<=n;i++) {
      const ry=t+spacing*i;
      panels.push({verts:[[t,ry,0],[t+netA,ry,0],[t+netA,ry+railH,0],[t,ry+railH,0]], fill:'rgba(224,82,82,0.25)', stroke:railC});
    }
  }

  STATE.divisions.forEach(div => {
    const sf=div.startFrac||0, ef=div.endFrac||1;
    const dy1=t+sf*(h-2*t), dy2=t+ef*(h-2*t);
    panels.push({verts:[[div.pos,dy1,0],[div.pos,dy2,0],[div.pos,dy2,p],[div.pos,dy1,p]], fill:'rgba(74,158,255,0.2)', stroke:divC});
  });

  const sortedDivs=[...STATE.divisions].sort((a,b)=>a.pos-b.pos);
  STATE.shelves.forEach(sh => {
    const sf=sh.startFrac||0, ef=sh.endFrac||1;
    const xL=t+sf*netA, xR=t+ef*netA;
    const inside=sortedDivs.filter(d=>d.pos>xL+0.1&&d.pos<xR-0.1);
    const cuts=[xL,...inside.map(d=>d.pos),xR];
    for(let ci=0;ci<cuts.length-1;ci++){
      const lAdj=cuts[ci]+(ci>0?t/2:0);
      const rAdj=cuts[ci+1]-(ci<cuts.length-2?t/2:0);
      if(rAdj-lAdj>0.2) panels.push({verts:[[lAdj,sh.pos,0],[rAdj,sh.pos,0],[rAdj,sh.pos,p],[lAdj,sh.pos,p]], fill:'rgba(60,184,122,0.2)', stroke:shC});
    }
  });

  return panels;
}

function drawPanel3D(ctx, panel, toScreen) {
  if (panel.verts.length<3) return;
  const pts=panel.verts.map(v=>toScreen(v[0],v[1],v[2]));
  ctx.beginPath(); ctx.moveTo(pts[0].sx,pts[0].sy);
  pts.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy)); ctx.closePath();
  ctx.fillStyle=panel.fill; ctx.fill();
  ctx.strokeStyle=panel.stroke; ctx.lineWidth=0.8; ctx.stroke();
}

function drawAxes3D(ctx, W, H) {
  const ox=30, oy=H-30, l=24;
  const axPt=(x,y,z)=>{const pp=project3D(x,y,z); return{sx:ox+pp.px*(l/40),sy:oy+pp.py*(l/40)};};
  const o=axPt(0,0,0);
  [[axPt(40,0,0),'#e05252','X'],[axPt(0,40,0),'#3cb87a','Y'],[axPt(0,0,40),'#4a9eff','Z']].forEach(([end,c,lbl])=>{
    ctx.strokeStyle=c; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(o.sx,o.sy); ctx.lineTo(end.sx,end.sy); ctx.stroke();
    ctx.fillStyle=c; ctx.font='9px Space Grotesk,sans-serif'; ctx.fillText(lbl,end.sx+3,end.sy+3);
  });
}

function drawLabels3D(ctx, a, h, p, toScreen) {
  ctx.fillStyle='rgba(154,154,150,0.7)'; ctx.font='10px Space Grotesk,sans-serif'; ctx.textAlign='center';
  const top=toScreen(a/2,h+2,p/2); ctx.fillText(`${a}cm`,top.sx,top.sy);
  const side=toScreen(a+2,h/2,p/2); ctx.fillText(`${h}cm`,side.sx,side.sy);
}
