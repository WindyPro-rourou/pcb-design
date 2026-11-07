const OPTS = __OPTS__;
const P = await eda.pcb_PrimitivePad.getAll();
const L = await eda.pcb_PrimitiveLine.getAll();
const V = await eda.pcb_PrimitiveVia.getAll();
function ptSeg(px,py,x1,y1,x2,y2){ const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy; let t=0; if(L2>0){ t=((px-x1)*dx+(py-y1)*dy)/L2; if(t<0)t=0; else if(t>1)t=1; } const qx=x1+t*dx-px, qy=y1+t*dy-py; return Math.sqrt(qx*qx+qy*qy); }
function segSeg(a,b,c,d){
  const d1=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const d2=(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
  const d3=(d[0]-c[0])*(a[1]-c[1])-(d[1]-c[1])*(a[0]-c[0]);
  const d4=(d[0]-c[0])*(b[1]-c[1])-(d[1]-c[1])*(b[0]-c[0]);
  if(((d1>0&&d2<0)||(d1<0&&d2>0))&&((d3>0&&d4<0)||(d3<0&&d4>0))) return 0;
  return Math.min(ptSeg(a[0],a[1],c[0],c[1],d[0],d[1]), ptSeg(b[0],b[1],c[0],c[1],d[0],d[1]), ptSeg(c[0],c[1],a[0],a[1],b[0],b[1]), ptSeg(d[0],d[1],a[0],a[1],b[0],b[1])); }
function padGeom(p){ const s=p.pad||['RECT',20,20,0]; const k=s[0],w=s[1],h=s[2];
  if(k==='ELLIPSE') return {c:[p.x,p.y],r:Math.max(w,h)/2};
  if(k==='OVAL'){ if(h>=w) return {c1:[p.x,p.y-(h-w)/2],c2:[p.x,p.y+(h-w)/2],r:w/2}; return {c1:[p.x-(w-h)/2,p.y],c2:[p.x+(w-h)/2,p.y],r:h/2}; }
  let W=w/2,H=h/2; if(Math.round((p.rotation||0))%180===90){ const t=W;W=H;H=t; }
  return {x1:p.x-W,x2:p.x+W,y1:p.y-H,y2:p.y+H}; }
function dPadPt(g,x,y){ if(g.c) return Math.max(0,Math.hypot(x-g.c[0],y-g.c[1])-g.r);
  if(g.c1) return Math.max(0,ptSeg(x,y,g.c1[0],g.c1[1],g.c2[0],g.c2[1])-g.r);
  const dx=Math.max(Math.max(g.x1-x,0),x-g.x2), dy=Math.max(Math.max(g.y1-y,0),y-g.y2); return Math.hypot(dx,dy); }
function dPadSeg(g,a,b){ if(g.c) return Math.max(0,ptSeg(g.c[0],g.c[1],a[0],a[1],b[0],b[1])-g.r);
  if(g.c1) return Math.max(0,segSeg(a,b,g.c1,g.c2)-g.r);
  const pts=[[g.x1,g.y1],[g.x2,g.y1],[g.x2,g.y2],[g.x1,g.y2]];
  if(dPadPt(g,a[0],a[1])===0||dPadPt(g,b[0],b[1])===0) return 0;
  let m=1e9; for(let k=0;k<4;k++){ const dd=segSeg(a,b,pts[k],pts[(k+1)%4]); if(dd<m)m=dd; } return m; }
function dPadPad(A,B){ const ga=padGeom(A), gb=padGeom(B);
  if(ga.c&&gb.c) return Math.max(0,Math.hypot(ga.c[0]-gb.c[0],ga.c[1]-gb.c[1])-ga.r-gb.r);
  let best=1e9;
  function samp(g){ if(g.c) return [[g.c[0]+g.r,g.c[1]],[g.c[0]-g.r,g.c[1]],[g.c[0],g.c[1]+g.r],[g.c[0],g.c[1]-g.r],[g.c[0],g.c[1]]];
    if(g.c1) return [g.c1,g.c2,[(g.c1[0]+g.c2[0])/2,(g.c1[1]+g.c2[1])/2]];
    return [[g.x1,g.y1],[g.x2,g.y1],[g.x2,g.y2],[g.x1,g.y2],[(g.x1+g.x2)/2,(g.y1+g.y2)/2]]; }
  const sa=samp(ga), sb=samp(gb);
  for(const p1 of sa) for(const p2 of sb){ const d=Math.hypot(p1[0]-p2[0],p1[1]-p2[1]); if(d<best)best=d; }
  return Math.max(0,best-(ga.r||0)-(gb.r||0)); }

// ---- 1. orphan copper (no pad in component) ----
const nets=new Set(); P.forEach(p=>nets.add(p.net)); L.forEach(l=>nets.add(l.net)); V.forEach(v=>nets.add(v.net));
const orphans=[];
for(const net of nets){ if(!net) continue;
  const items=[];
  for(const p of P) if(p.net===net) items.push({t:'p',o:p,lay:(p.layer===12?[1,2]:[p.layer])});
  for(const l of L) if(l.net===net) items.push({t:'l',o:l,lay:[l.layer]});
  for(const v of V) if(v.net===net) items.push({t:'v',o:v,lay:[1,2]});
  const n=items.length; if(n<2) continue;
  const par=items.map((_,i)=>i); const f=(x)=>{ while(par[x]!==x){ par[x]=par[par[x]]; x=par[x]; } return x; };
  const u=(a,b)=>{ a=f(a);b=f(b); if(a!==b) par[a]=b; };
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
    const A=items[i],B=items[j]; if(!A.lay.some(x=>B.lay.includes(x))) continue;
    let d=1e9;
    if(A.t==='p'&&B.t==='p') d=dPadPad(A.o,B.o);
    else if(A.t==='l'&&B.t==='l') d=segSeg([A.o.startX,A.o.startY],[A.o.endX,A.o.endY],[B.o.startX,B.o.startY],[B.o.endX,B.o.endY])-(A.o.lineWidth||6)/2-(B.o.lineWidth||6)/2;
    else if(A.t==='v'&&B.t==='v') d=Math.hypot(A.o.x-B.o.x,A.o.y-B.o.y)-A.o.diameter/2-B.o.diameter/2;
    else if(A.t==='p'&&B.t==='v') d=dPadPt(padGeom(A.o),B.o.x,B.o.y)-B.o.diameter/2;
    else if(A.t==='v'&&B.t==='p') d=dPadPt(padGeom(B.o),A.o.x,A.o.y)-A.o.diameter/2;
    else if(A.t==='p'&&B.t==='l') d=dPadSeg(padGeom(A.o),[B.o.startX,B.o.startY],[B.o.endX,B.o.endY])-(B.o.lineWidth||6)/2;
    else if(A.t==='l'&&B.t==='p') d=dPadSeg(padGeom(B.o),[A.o.startX,A.o.startY],[A.o.endX,A.o.endY])-(A.o.lineWidth||6)/2;
    else if(A.t==='l'&&B.t==='v') d=ptSeg(B.o.x,B.o.y,A.o.startX,A.o.startY,A.o.endX,A.o.endY)-(A.o.lineWidth||6)/2-B.o.diameter/2;
    else if(A.t==='v'&&B.t==='l') d=ptSeg(A.o.x,A.o.y,B.o.startX,B.o.startY,B.o.endX,B.o.endY)-(B.o.lineWidth||6)/2-A.o.diameter/2;
    if(d<=0) u(i,j); }
  const comp=new Map();
  items.forEach((it,i)=>{ const r0=f(i); if(!comp.has(r0)) comp.set(r0,{pads:0,lines:0,vias:0,sample:null}); const c=comp.get(r0);
    c[it.t==='p'?'pads':(it.t==='l'?'lines':'vias')]++; if(!c.sample) c.sample=[it.t, Math.round((it.o.x!==undefined?it.o.x:(it.o.startX!==undefined?it.o.startX:0))), Math.round((it.o.y!==undefined?it.o.y:(it.o.startY!==undefined?it.o.startY:0)))]; });
  for(const [r0,c] of comp) if(c.pads===0 && net!=='GND') orphans.push({net, lines:c.lines, vias:c.vias, at:c.sample});
}
// ---- 2. right angles ----
let rightAngles=0; const raSamples=[];
const byNet=new Map();
for(const l of L){ const k=l.net+'|'+l.layer; if(!byNet.has(k)) byNet.set(k,[]); byNet.get(k).push(l); }
for(const [k,arr] of byNet){ const pts=new Map();
  const key=(x,y)=>Math.round(x*2)+','+Math.round(y*2);
  for(const l of arr){ for(const [x,y] of [[l.startX,l.startY],[l.endX,l.endY]]){ const kk=key(x,y); if(!pts.has(kk)) pts.set(kk,[]); pts.get(kk).push(l); } }
  for(const [kk,ls] of pts){ if(ls.length!==2) continue;
    const A=ls[0],B=ls[1];
    const va=[A.endX-A.startX, A.endY-A.startY], vb=[B.endX-B.startX, B.endY-B.startY];
    // direction away from joint
    function away(l, px,py){ const dx=l.endX-l.startX, dy=l.endY-l.startY; const L2=Math.hypot(dx,dy)||1;
      if(Math.hypot(l.startX-px,l.startY-py)<0.6) return [dx/L2,dy/L2]; return [-dx/L2,-dy/L2]; }
    const jx=+kk.split(',')[0]/2, jy=+kk.split(',')[1]/2;
    const a1=away(A,jx,jy), a2=away(B,jx,jy);
    const dot=a1[0]*a2[0]+a1[1]*a2[1];
    const ang=Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
    if(ang>75 && ang<105){ rightAngles++; if(raSamples.length<10) raSamples.push({net:A.net, at:[Math.round(jx),Math.round(jy)], ang:Math.round(ang)}); } } }
// ---- 3. antenna keepout ----
const KO=[2690,3490,-20,-340];
let inKo=0; const koLines=[];
for(const l of L){ const inside=(x,y)=> x>KO[0]&&x<KO[1]&&y<KO[2]&&y>KO[3];
  if(inside(l.startX,l.startY)||inside(l.endX,l.endY)){ inKo++; if(koLines.length<6) koLines.push([l.net, Math.round(l.startX),Math.round(l.startY),Math.round(l.endX),Math.round(l.endY)]); } }
let koVias=0; for(const v of V){ if(v.x>KO[0]&&v.x<KO[1]&&v.y<KO[2]&&v.y>KO[3]) koVias++; }
return JSON.stringify({orphans: orphans.length, orphanList: orphans.slice(0,8), rightAngles, raSamples, koTraces: inKo, koVias, koLines});
