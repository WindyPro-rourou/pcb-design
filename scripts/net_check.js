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
  if(!ga.c&&!gb.c){ const dx=Math.max(Math.max(ga.x1-gb.x2,gb.x1-ga.x2),0), dy=Math.max(Math.max(ga.y1-gb.y2,gb.y1-ga.y2),0); return Math.hypot(dx,dy); }
  let best=1e9;
  function samp(g){ if(g.c) return [[g.c[0]+g.r,g.c[1]],[g.c[0]-g.r,g.c[1]],[g.c[0],g.c[1]+g.r],[g.c[0],g.c[1]-g.r],[g.c[0],g.c[1]]];
    if(g.c1) return [g.c1,g.c2,[(g.c1[0]+g.c2[0])/2,(g.c1[1]+g.c2[1])/2]];
    return [[g.x1,g.y1],[g.x2,g.y1],[g.x2,g.y2],[g.x1,g.y2],[(g.x1+g.x2)/2,(g.y1+g.y2)/2]]; }
  const sa=samp(ga), sb=samp(gb);
  for(const p1 of sa) for(const p2 of sb){ const d=Math.hypot(p1[0]-p2[0],p1[1]-p2[1]); if(d<best)best=d; }
  const rb=(gb.r||0), ra=(ga.r||0);
  return Math.max(0,best-ra-rb);
}
const nets = new Set(); P.forEach(p=>nets.add(p.net)); L.forEach(l=>nets.add(l.net)); V.forEach(v=>nets.add(v.net));
const out=[];
for(const net of nets){ if(!net) continue; if(OPTS.skip && OPTS.skip.includes(net)) continue;
  const items=[];
  for(const p of P) if(p.net===net) items.push({t:'p',o:p,lay:(p.layer===12?[1,2]:[p.layer])});
  for(const l of L) if(l.net===net) items.push({t:'l',o:l,lay:[l.layer]});
  for(const v of V) if(v.net===net) items.push({t:'v',o:v,lay:[1,2]});
  const padsN=items.filter(i=>i.t==='p').length;
  if(padsN<2) continue;
  const par=items.map((_,i)=>i); const f=(x)=>{ while(par[x]!==x){ par[x]=par[par[x]]; x=par[x]; } return x; };
  const u=(a,b)=>{ a=f(a);b=f(b); if(a!==b) par[a]=b; };
  for(let i=0;i<items.length;i++) for(let j=i+1;j<items.length;j++){
    const A=items[i],B=items[j];
    if(!A.lay.some(L_=>B.lay.includes(L_))) continue;
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
  const proots=new Set(); items.forEach((it,i)=>{ if(it.t==='p') proots.add(f(i)); });
  if(proots.size>1) out.push({net, pads:padsN, groups:proots.size});
}
return JSON.stringify({broken: out});
