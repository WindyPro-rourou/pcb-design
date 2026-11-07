
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
  if(dPadPt(g,a[0],a[1])<0.01||dPadPt(g,b[0],b[1])<0.01) return 0;
  const pts=[[g.x1,g.y1],[g.x2,g.y1],[g.x2,g.y2],[g.x1,g.y2]];
  let m=1e9; for(let k=0;k<4;k++){ const dd=segSeg(a,b,pts[k],pts[(k+1)%4]); if(dd<m)m=dd; } return m; }
function dPadPad(A,B){ const ga=padGeom(A), gb=padGeom(B);
  if(ga.c&&gb.c) return Math.max(0,Math.hypot(ga.c[0]-gb.c[0],ga.c[1]-gb.c[1])-ga.r-gb.r);
  function samp(g){ if(g.c) return [[g.c[0]+g.r,g.c[1]],[g.c[0]-g.r,g.c[1]],[g.c[0],g.c[1]+g.r],[g.c[0],g.c[1]-g.r],[g.c[0],g.c[1]]];
    if(g.c1) return [g.c1,g.c2,[(g.c1[0]+g.c2[0])/2,(g.c1[1]+g.c2[1])/2]];
    return [[g.x1,g.y1],[g.x2,g.y1],[g.x2,g.y2],[g.x1,g.y2],[(g.x1+g.x2)/2,(g.y1+g.y2)/2]]; }
  let best=1e9; const sa=samp(ga), sb=samp(gb);
  for(const p1 of sa) for(const p2 of sb){ const d=Math.hypot(p1[0]-p2[0],p1[1]-p2[1]); if(d<best)best=d; }
  return Math.max(0,best-(ga.r||0)-(gb.r||0)); }
function touch(A,B){ if(!A.lay.some(x=>B.lay.includes(x))) return false; let d=1e9;
  if(A.t==='p'&&B.t==='p') d=dPadPad(A.o,B.o);
  else if(A.t==='l'&&B.t==='l') d=segSeg([A.o.startX,A.o.startY],[A.o.endX,A.o.endY],[B.o.startX,B.o.startY],[B.o.endX,B.o.endY])-(A.o.lineWidth||6)/2-(B.o.lineWidth||6)/2;
  else if(A.t==='v'&&B.t==='v') d=Math.hypot(A.o.x-B.o.x,A.o.y-B.o.y)-A.o.diameter/2-B.o.diameter/2;
  else if(A.t==='p'&&B.t==='v') d=dPadPt(padGeom(A.o),B.o.x,B.o.y)-B.o.diameter/2;
  else if(A.t==='v'&&B.t==='p') d=dPadPt(padGeom(B.o),A.o.x,A.o.y)-A.o.diameter/2;
  else if(A.t==='p'&&B.t==='l') d=dPadSeg(padGeom(A.o),[B.o.startX,B.o.startY],[B.o.endX,B.o.endY])-(B.o.lineWidth||6)/2;
  else if(A.t==='l'&&B.t==='p') d=dPadSeg(padGeom(B.o),[A.o.startX,A.o.startY],[A.o.endX,A.o.endY])-(A.o.lineWidth||6)/2;
  else if(A.t==='l'&&B.t==='v') d=ptSeg(B.o.x,B.o.y,A.o.startX,A.o.startY,A.o.endX,A.o.endY)-(A.o.lineWidth||6)/2-B.o.diameter/2;
  else if(A.t==='v'&&B.t==='l') d=ptSeg(A.o.x,A.o.y,B.o.startX,B.o.startY,B.o.endX,B.o.endY)-(B.o.lineWidth||6)/2-A.o.diameter/2;
  return d<=0.2; }
// find isolated pads per net
const nets=new Set(); P.forEach(p=>nets.add(p.net));
const todo=[];
for(const net of nets){ if(!net||net==='GND') continue;
  const items=[];
  for(const p of P) if(p.net===net) items.push({t:'p',o:p,lay:(p.layer===12?[1,2]:[p.layer])});
  for(const l of L) if(l.net===net) items.push({t:'l',o:l,lay:[l.layer]});
  for(const v of V) if(v.net===net) items.push({t:'v',o:v,lay:[1,2]});
  const N=items.length; const padsI=[]; for(let i=0;i<N;i++) if(items[i].t==='p') padsI.push(i);
  if(padsI.length<2) continue;
  const par=items.map((_,i)=>i); const f=(x)=>{ while(par[x]!==x){ par[x]=par[par[x]]; x=par[x]; } return x; };
  const u=(a,b)=>{ a=f(a);b=f(b); if(a!==b) par[a]=b; };
  for(let i=0;i<N;i++) for(let j=i+1;j<N;j++){ if(touch(items[i],items[j])) u(i,j); }
  const compOf=new Map();
  for(const i of padsI){ const r=f(i); if(!compOf.has(r)) compOf.set(r,[]); compOf.get(r).push(i); }
  if(compOf.size<2) continue;
  const groups=[...compOf.values()]; const big=groups.reduce((a,b)=>a.length>=b.length?a:b);
  for(const g of groups){ if(g===big) continue; for(const i of g) todo.push({net, pad:items[i].o}); }
}
// bridge each isolated pad to nearest same-net copper
const made=[], failed=[];
for(const {net,pad} of todo){
  if(!pad) continue;
  const lay=(pad.layer===12?1:pad.layer);
  function clearSeg(ax,ay,bx,by){ const n=Math.ceil(Math.hypot(bx-ax,by-ay));
    for(let k=0;k<=n;k++){ const t=n?k/n:0; const x=ax+(bx-ax)*t, y=ay+(by-ay)*t;
      for(const l of L){ if(l.net===net||l.layer!==lay) continue; if(ptSeg(x,y,l.startX,l.startY,l.endX,l.endY) < 9) return false; }
      for(const p of P){ if(p.net===net) continue; if(p.layer!==12 && p.layer!==lay) continue; if(dPadPt(padGeom(p),x,y) < 9) return false; }
      for(const v of V){ if(v.net===net) continue; if(Math.hypot(x-v.x,y-v.y) < 13) return false; } }
    return true; }
  const cands=[];
  for(const l of L){ if(l.net!==net) continue; if(l.layer!==lay && l.layer!==12) continue;
    const len=Math.hypot(l.endX-l.startX,l.endY-l.startY); const st=Math.max(1,Math.floor(len/3));
    for(let i=0;i<=st;i++){ const t=i/st; cands.push([l.startX+(l.endX-l.startX)*t, l.startY+(l.endY-l.startY)*t]); } }
  for(const v of V){ if(v.net===net) cands.push([v.x,v.y]); }
  let best=null,bd=1e9;
  for(const c of cands){ const d=Math.hypot(c[0]-pad.x,c[1]-pad.y); if(d<8||d>130) continue;
    if(c[0]<30||c[0]>3907||c[1]>-30||c[1]<-3710) continue;
    if(!clearSeg(pad.x,pad.y,c[0],c[1])) continue;
    if(d<bd){ bd=d; best=c; } }
  if(!best){ failed.push([net, Math.round(pad.x), Math.round(pad.y)]); continue; }
  try{ await eda.pcb_PrimitiveLine.create(net, lay, pad.x,pad.y, best[0],best[1], 6, false); made.push([net, Math.round(bd)]); }
  catch(e){ failed.push([net,'ERR']); }
}
await eda.pcb_Document.save();
return JSON.stringify({isolated: todo.length, bridged: made.length, failed: failed.length, failList: failed.slice(0,10)});
