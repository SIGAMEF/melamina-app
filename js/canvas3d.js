// === CANVAS3D.JS v6 — zoom con rueda + multi-módulo ===
let canvas3d, ctx3d;
let rot3DX=20, rot3DY=-30, zoom3D=1;
let is3DDragging=false, drag3DStart=null;

function initCanvas3D() {
  canvas3d=document.getElementById('canvas-3d');
  if(!canvas3d) return;
  ctx3d=canvas3d.getContext('2d');

  canvas3d.addEventListener('mousedown',  e=>{is3DDragging=true;drag3DStart={x:e.clientX,y:e.clientY,rx:rot3DX,ry:rot3DY};});
  canvas3d.addEventListener('mousemove',  e=>{if(!is3DDragging)return;rot3DY=drag3DStart.ry+(e.clientX-drag3DStart.x)*0.45;rot3DX=Math.max(-30,Math.min(80,drag3DStart.rx-(e.clientY-drag3DStart.y)*0.45));redraw3D();});
  canvas3d.addEventListener('mouseup',    ()=>{is3DDragging=false;});
  canvas3d.addEventListener('mouseleave', ()=>{is3DDragging=false;});
  // FIX: zoom con rueda en vista 3D
  canvas3d.addEventListener('wheel', e=>{e.preventDefault();zoom3D=Math.max(0.2,Math.min(5,zoom3D*(e.deltaY<0?1.12:0.9)));redraw3D();},{passive:false});
  redraw3D();
}

function rotate3D(dy,dx){rot3DY+=dy;rot3DX=Math.max(-30,Math.min(80,rot3DX+dx));redraw3D();}
function reset3D(){rot3DX=20;rot3DY=-30;zoom3D=1;redraw3D();}

function project3D(x,y,z){
  const ry=rot3DY*Math.PI/180,rx=rot3DX*Math.PI/180;
  const x1=x*Math.cos(ry)-z*Math.sin(ry),z1=x*Math.sin(ry)+z*Math.cos(ry);
  const y2=y*Math.cos(rx)-z1*Math.sin(rx);
  return{px:x1,py:-y2};
}

function redraw3D(){
  // Buscar el canvas correcto según la vista activa
  let cv=document.getElementById('canvas-3d');
  const solo3dView=document.getElementById('view-3d');
  if(solo3dView&&solo3dView.classList.contains('active')){
    cv=document.getElementById('canvas-3d-solo')||cv;
  }
  if(!cv) return;
  const ctx=cv.getContext('2d');
  const W=cv.width,H=cv.height;
  if(!W||!H) return;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0c0c0e';ctx.fillRect(0,0,W,H);

  // Renderizar todos los módulos
  if(!STATE.modules.length){
    ctx.fillStyle='#4a5068';ctx.font='13px Space Grotesk,sans-serif';ctx.textAlign='center';
    ctx.fillText('Diseña un mueble para ver la vista 3D',W/2,H/2);
    return;
  }

  // Calcular bounding box de todos los módulos
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,maxZ=0;
  STATE.modules.forEach(mod=>{
    minX=Math.min(minX,mod.offsetX); maxX=Math.max(maxX,mod.offsetX+mod.ancho);
    minY=Math.min(minY,mod.offsetY); maxY=Math.max(maxY,mod.offsetY+mod.alto);
    maxZ=Math.max(maxZ,mod.prof);
  });
  const totalW=maxX-minX,totalH=maxY-minY;
  const maxDim=Math.max(totalW,totalH,maxZ)*1.5;
  const scale3=Math.min(W,H)*0.45/maxDim*zoom3D;
  const cx=W/2,cy=H/2;

  // Colección de todos los paneles de todos los módulos
  const allPanels=[];
  STATE.modules.forEach(mod=>{
    const ox=mod.offsetX-minX-(totalW/2);
    const oy=mod.offsetY-minY-(totalH/2);
    const panels=buildModulePanels3D(mod,ox,oy);
    allPanels.push(...panels);
  });

  // Ordenar por profundidad
  allPanels.sort((pa,pb)=>{
    const da=pa.verts.reduce((s,v)=>{const pp=project3D(v[0],v[1],v[2]);return s+pp.px+pp.py;},0)/pa.verts.length;
    const db=pb.verts.reduce((s,v)=>{const pp=project3D(v[0],v[1],v[2]);return s+pp.px+pp.py;},0)/pb.verts.length;
    return da-db;
  });

  const toScreen=(x,y,z)=>{const pp=project3D(x,y,z);return{sx:cx+pp.px*scale3,sy:cy+pp.py*scale3};};
  allPanels.forEach(p=>drawPanel3D(ctx,p,toScreen));
  drawAxes3D(ctx,W,H,scale3);

  // Zoom level indicator
  ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font='10px Space Grotesk,sans-serif';ctx.textAlign='right';
  ctx.fillText(`${Math.round(zoom3D*100)}%`,W-8,H-8);
}

function buildModulePanels3D(mod,ox,oy){
  const a=mod.ancho,h=mod.alto,p=mod.prof,t=STATE.thick/10;
  const netA=a-2*t;
  const panels=[];
  // ox,oy son offset del módulo en el mundo 3D (centrado)
  const v=(lx,ly,lz)=>[ox+lx, oy+ly, lz];

  panels.push({verts:[v(0,0,0),v(0,h,0),v(0,h,p),v(0,0,p)],fill:'rgba(168,128,64,0.5)',stroke:'#8a6828'});
  panels.push({verts:[v(a,0,0),v(a,h,0),v(a,h,p),v(a,0,p)],fill:'rgba(168,128,64,0.5)',stroke:'#8a6828'});
  panels.push({verts:[v(t,h,0),v(t+netA,h,0),v(t+netA,h,p),v(t,h,p)],fill:'rgba(200,169,110,0.7)',stroke:'#8a6828'});
  panels.push({verts:[v(t,0,0),v(t+netA,0,0),v(t+netA,0,p),v(t,0,p)],fill:'rgba(200,169,110,0.7)',stroke:'#8a6828'});

  if(mod.conFondo) panels.push({verts:[v(t,t,0),v(t+netA,t,0),v(t+netA,h-t,0),v(t,h-t,0)],fill:'rgba(160,120,50,0.2)',stroke:'rgba(200,169,110,0.25)'});

  if(mod.conRail){
    const n=Math.max(1,parseInt(mod.numRails)||1);
    const spacing=(h-2*t)/(n+1);
    for(let i=1;i<=n;i++){const ry=t+spacing*i;panels.push({verts:[v(t,ry,0),v(t+netA,ry,0),v(t+netA,ry+8,0),v(t,ry+8,0)],fill:'rgba(224,82,82,0.2)',stroke:'#e05252'});}
  }

  mod.divisions.forEach(div=>{
    const sf=div.startFrac||0,ef=div.endFrac||1;
    const dy1=t+sf*(h-2*t),dy2=t+ef*(h-2*t);
    panels.push({verts:[v(div.pos,dy1,0),v(div.pos,dy2,0),v(div.pos,dy2,p),v(div.pos,dy1,p)],fill:'rgba(74,158,255,0.2)',stroke:'#4a9eff'});
  });

  const sortedDivs=[...mod.divisions].sort((a,b)=>a.pos-b.pos);
  mod.shelves.forEach(sh=>{
    const sf=sh.startFrac||0,ef=sh.endFrac||1;
    const xL=t+sf*netA,xR=t+ef*netA;
    const inside=sortedDivs.filter(d=>d.pos>xL+0.1&&d.pos<xR-0.1);
    const cuts=[xL,...inside.map(d=>d.pos),xR];
    for(let ci=0;ci<cuts.length-1;ci++){
      const lAdj=cuts[ci]+(ci>0?t/2:0),rAdj=cuts[ci+1]-(ci<cuts.length-2?t/2:0);
      if(rAdj-lAdj>0.2) panels.push({verts:[v(lAdj,sh.pos,0),v(rAdj,sh.pos,0),v(rAdj,sh.pos,p),v(lAdj,sh.pos,p)],fill:'rgba(60,184,122,0.2)',stroke:'#3cb87a'});
    }
  });

  return panels;
}

function drawPanel3D(ctx,panel,toScreen){
  if(panel.verts.length<3) return;
  const pts=panel.verts.map(v=>toScreen(v[0],v[1],v[2]));
  ctx.beginPath();ctx.moveTo(pts[0].sx,pts[0].sy);
  pts.slice(1).forEach(p=>ctx.lineTo(p.sx,p.sy));ctx.closePath();
  ctx.fillStyle=panel.fill;ctx.fill();
  ctx.strokeStyle=panel.stroke;ctx.lineWidth=0.8;ctx.stroke();
}

function drawAxes3D(ctx,W,H,scale3){
  const ox=30,oy=H-30,l=22;
  const axPt=(x,y,z)=>{const pp=project3D(x,y,z);return{sx:ox+pp.px*(l/40),sy:oy+pp.py*(l/40)};};
  const o=axPt(0,0,0);
  [[axPt(40,0,0),'#e05252','X'],[axPt(0,40,0),'#3cb87a','Y'],[axPt(0,0,40),'#4a9eff','Z']].forEach(([end,c,lbl])=>{
    ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(o.sx,o.sy);ctx.lineTo(end.sx,end.sy);ctx.stroke();
    ctx.fillStyle=c;ctx.font='9px Space Grotesk,sans-serif';ctx.fillText(lbl,end.sx+3,end.sy+3);
  });
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.font='9px Space Grotesk,sans-serif';ctx.textAlign='left';
  ctx.fillText('Arrastra → rotar · Rueda → zoom',36,H-8);
}
