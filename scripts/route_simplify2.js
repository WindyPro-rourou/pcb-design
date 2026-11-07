const OPTS = __OPTS__;

const T0=Date.now();
const BUDGET = OPTS.budget || 70000;
const MAXOPS = OPTS.maxops || 90;
const P = await eda.pcb_PrimitivePad.getAll();
const L0 = await eda.pcb_PrimitiveLine.getAll();
const V = await eda.pcb_PrimitiveVia.getAll();
function ptSeg(px,py,x1,y1,x2,y2){ const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy; let t=0; if(L2>0){ t=((px-x1)*dx+(py-y1)*dy)/L2; if(t<0)t=0; else if(t>1)t=1; } const qx=x1+t*dx-px, qy=y1+t*dy-py; return Math.sqrt(qx*qx+qy*qy); }
function padGeom(p){ const s=p.pad||['RECT',20,20,0]; const k=s[0],w=s[1],h=s[2];
  if(k==='ELLIPSE') return {c:[p.x,p.y],r:Math.max(w,h)/2};
  if(k==='OVAL'){ if(h>=w) return {c1:[p.x,p.y-(h-w)/2],c2:[p.x,p.y+(h-w)/2],r:w/2}; return {c1:[p.x-(w-h)/2,p.y],c2:[p.x+(w-h)/2,p.y],r:h/2}; }
  let W=w/2,H=h/2; if(Math.round((p.rotation||0))%180===90){ const t=W;W=H;H=t; }
  return {x1:p.x-W,x2:p.x+W,y1:p.y-H,y2:p.y+H}; }
function dPadPt(g,x,y){ if(g.c) return Math.max(0,Math.hypot(x-g.c[0],y-g.c[1])-g.r);
  if(g.c1) return Math.max(0,ptSeg(x,y,g.c1[0],g.c1[1],g.c2[0],g.c2[1])-g.r);
  const dx=Math.max(Math.max(g.x1-x,0),x-g.x2), dy=Math.max(Math.max(g.y1-y,0),y-g.y2); return Math.hypot(dx,dy); }
// ---- spatial grid of obstacles ----
const GS=100, GW=Math.ceil(4000/GS), GH=Math.ceil(3900/GS);
const grid=new Array(GW*GH); for(let i=0;i<grid.length;i++) grid[i]=[];
function cellOf(x,y){ const cx=Math.floor(x/GS), cy=Math.floor((y+3900)/GS); if(cx<0||cy<0||cx>=GW||cy>=GH) return -1; return cy*GW+cx; }
function insert(item, x1,y1,x2,y2, pad){
  const c1=cellOf(x1-pad,y1-pad), c2=cellOf(x2+pad,y2+pad);
  for(let cy=Math.max(0,Math.floor((y1-pad+3900)/GS)); cy<=Math.min(GH-1,Math.floor((y2+pad+3900)/GS)); cy++)
    for(let cx=Math.max(0,Math.floor((x1-pad)/GS)); cx<=Math.min(GW-1,Math.floor((x2+pad)/GS)); cx++) grid[cy*GW+cx].push(item);
}
const padsG = P.map(p=>({p, g:padGeom(p)}));
for(const o of padsG){ const b=o.g; const x1=b.c?b.c[0]-b.r:(b.c1?Math.min(b.c1[0],b.c2[0])-b.r:b.x1); const x2=b.c?b.c[0]+b.r:(b.c1?Math.max(b.c1[0],b.c2[0])+b.r:b.x2);
  const y1=b.c?b.c[1]-b.r:(b.c1?Math.min(b.c1[1],b.c2[1])-b.r:b.y1); const y2=b.c?b.c[1]+b.r:(b.c1?Math.max(b.c1[1],b.c2[1])+b.r:b.y2);
  insert({t:'p',o}, x1,y1,x2,y2, 18); }
for(const l of L0){ insert({t:'l',o:l}, Math.min(l.startX,l.endX),Math.min(l.startY,l.endY),Math.max(l.startX,l.endX),Math.max(l.startY,l.endY), 18); }
for(const v of V){ insert({t:'v',o:v}, v.x-20,v.y-20,v.x+20,v.y+20, 18); }
function clearSeg(net, lay, x1,y1,x2,y2, hw, selfIds){
  const n = Math.max(1, Math.ceil(Math.hypot(x2-x1,y2-y1)/3));
  for(let k=0;k<=n;k++){ const t=k/n; const x=x1+(x2-x1)*t, y=y1+(y2-y1)*t;
    const cx=Math.floor(x/GS), cy=Math.floor((y+3900)/GS);
    for(let ay=cy-1; ay<=cy+1; ay++){ if(ay<0||ay>=GH) continue;
      for(let ax=cx-1; ax<=cx+1; ax++){ if(ax<0||ax>=GW) continue;
        for(const it of grid[ay*GW+ax]){
          if(it.o.net===net) continue;
          if(it.t==='p'){ if(it.o.layer!==12 && it.o.layer!==lay) continue; if(dPadPt(it.g,x,y) < hw+6) return false; }
          else if(it.t==='l'){ if(it.o.layer!==lay) continue; if(selfIds && selfIds.has(it.o.primitiveId)) continue; if(ptSeg(x,y,it.o.startX,it.o.startY,it.o.endX,it.o.endY) < hw+(it.o.lineWidth||6)/2+6) return false; }
          else { if(Math.hypot(x-it.o.x,y-it.o.y) < hw+it.o.diameter/2+6) return false; } } } } }
  return true; }
const key=(x,y)=>Math.round(x*2)/2+','+Math.round(y*2)/2;
const byNL=new Map();
for(const l of L0){ if(!l.net) continue; const k=l.net+'|'+l.layer; if(!byNL.has(k)) byNL.set(k,[]); byNL.get(k).push(l); }
const ops=[]; let scanned=0;
for(const [k,segs] of byNL){
  if(Date.now()-T0 > BUDGET*0.45) break;
  if(segs.length<3) continue;
  const net=segs[0].net, lay=segs[0].layer, hw=(segs[0].lineWidth||6)/2;
  const selfIds=new Set(segs.map(s=>s.primitiveId));
  const ptMap=new Map();
  for(const l of segs){ for(const [x,y] of [[l.startX,l.startY],[l.endX,l.endY]]){ const kk=key(x,y); if(!ptMap.has(kk)) ptMap.set(kk,{x,y,segs:[]}); ptMap.get(kk).segs.push(l); } }
  const fixed=new Set();
  for(const [kk,o] of ptMap){ if(o.segs.length!==2){ fixed.add(kk); continue; }
    for(const p of P){ if(p.net!==net) continue; if(p.layer!==12 && p.layer!==lay) continue; if(dPadPt(padGeom(p),o.x,o.y)<0.5){ fixed.add(kk); break; } }
    if(fixed.has(kk)) continue;
    for(const v of V){ if(v.net!==net) continue; if(Math.hypot(o.x-v.x,o.y-v.y) < v.diameter/2+0.5){ fixed.add(kk); break; } } }
  const visited=new Set();
  for(const s0 of segs){
    if(visited.has(s0.primitiveId)) continue;
    const chain=[s0]; visited.add(s0.primitiveId);
    // forward
    let ck=key(s0.endX,s0.endY), cur=s0;
    while(true){ const o=ptMap.get(ck); if(!o||o.segs.length!==2||fixed.has(ck)) break;
      const other=o.segs[0].primitiveId===cur.primitiveId?o.segs[1]:o.segs[0];
      if(visited.has(other.primitiveId)||other.primitiveId===s0.primitiveId) break;
      visited.add(other.primitiveId); chain.push(other);
      ck = key(other.startX,other.startY)===ck ? key(other.endX,other.endY) : key(other.startX,other.startY); cur=other; }
    // backward
    ck=key(s0.startX,s0.startY); cur=s0;
    while(true){ const o=ptMap.get(ck); if(!o||o.segs.length!==2||fixed.has(ck)) break;
      const other=o.segs[0].primitiveId===cur.primitiveId?o.segs[1]:o.segs[0];
      if(visited.has(other.primitiveId)||other.primitiveId===s0.primitiveId) break;
      visited.add(other.primitiveId); chain.unshift(other);
      ck = key(other.startX,other.startY)===ck ? key(other.endX,other.endY) : key(other.startX,other.startY); cur=other; }
    if(chain.length<3) continue;
    scanned++;
    const pts=[]; let pk=key(chain[0].startX,chain[0].startY); pts.push([chain[0].startX,chain[0].startY]);
    for(const s of chain){ if(key(s.startX,s.startY)===pk){ pts.push([s.endX,s.endY]); pk=key(s.endX,s.endY); } else { pts.push([s.startX,s.startY]); pk=key(s.startX,s.startY); } }
    const outPts=[pts[0]]; let i=0;
    while(i<pts.length-1){
      if(Date.now()-T0 > BUDGET) break;
      let limit=pts.length-1;
      for(let t=i+1;t<pts.length-1;t++){ if(fixed.has(key(pts[t][0],pts[t][1]))){ limit=t; break; } }
      let chosen=-1, corner=null;
      for(let j=limit;j>i;j--){
        const S=pts[i], T=pts[j]; const dx=T[0]-S[0], dy=T[1]-S[1];
        const axis=(Math.abs(dx)<0.3)||(Math.abs(dy)<0.3)||(Math.abs(Math.abs(dx)-Math.abs(dy))<0.3);
        if(axis && clearSeg(net,lay,S[0],S[1],T[0],T[1],hw,selfIds)){ chosen=j; corner=null; break; }
        if(j-i>=2){
          const adx=Math.abs(dx), ady=Math.abs(dy), m=Math.min(adx,ady);
          if(m>0.5){ const sx=dx>0?1:-1, sy=dy>0?1:-1;
            for(const c of [[S[0]+sx*m, S[1]+sy*m], [T[0]-sx*m, T[1]-sy*m]]){
              if(Math.abs(c[0]-S[0])<0.4 && Math.abs(c[1]-S[1])<0.4) continue;
              if(Math.abs(c[0]-T[0])<0.4 && Math.abs(c[1]-T[1])<0.4) continue;
              if(clearSeg(net,lay,S[0],S[1],c[0],c[1],hw,selfIds) && clearSeg(net,lay,c[0],c[1],T[0],T[1],hw,selfIds)){ chosen=j; corner=c; break; } }
            if(chosen>0) break; } } }
      if(chosen<0){ outPts.push(pts[i+1]); i=i+1; continue; }
      if(corner){ outPts.push(corner); outPts.push(pts[chosen]); } else outPts.push(pts[chosen]);
      i=chosen; }
    if(outPts.length-1 < chain.length) ops.push({net, lay, hw, oldIds: chain.map(s=>s.primitiveId), pts: outPts});
    if(ops.length>=MAXOPS) break; }
  if(ops.length>=MAXOPS) break; }
// apply
let applied=0, failed=0;
for(const op of ops){
  if(Date.now()-T0 > BUDGET+20000) break;
  const created=[]; let ok=true;
  for(let i=0;i<op.pts.length-1;i++){ const a=op.pts[i], b=op.pts[i+1];
    if(Math.abs(a[0]-b[0])<0.05 && Math.abs(a[1]-b[1])<0.05) continue;
    try{ const r=await eda.pcb_PrimitiveLine.create(op.net,op.lay,a[0],a[1],b[0],b[1],op.hw*2,false); if(r&&r.primitiveId) created.push(r.primitiveId); else ok=false; }
    catch(e){ ok=false; break; } }
  if(ok && created.length){ await eda.pcb_PrimitiveLine.delete(op.oldIds); applied++; }
  else { if(created.length) await eda.pcb_PrimitiveLine.delete(created); failed++; } }
await eda.pcb_Document.save();
const L1 = await eda.pcb_PrimitiveLine.getAll();
const lens = L1.map(l=>Math.hypot(l.endX-l.startX,l.endY-l.startY));
return JSON.stringify({scanned, ops: ops.length, applied, failed, lines:L1.length, short12:lens.filter(x=>x<12).length, ms: Date.now()-T0});
