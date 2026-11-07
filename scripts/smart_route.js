
const OPTS = __OPTS__;
const T0=Date.now();
const NET=OPTS.net, G=OPTS.grid||10, TURN=OPTS.turn||160, VIAC=OPTS.viaCost||2500;
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
const X0=0, Y0=-3800, W=Math.ceil(3960/G), H=Math.ceil(3800/G), NC=W*H;
const obsA=new Uint8Array(NC), obsB=new Uint8Array(NC);
const maskP=OPTS.maskPad||16, maskL=OPTS.maskLine||18, maskV=OPTS.maskVia||24;
function cellOf(x,y){ const cx=Math.floor((x-X0)/G), cy=Math.floor((y-Y0)/G); if(cx<0||cy<0||cx>=W||cy>=H) return -1; return cy*W+cx; }
for(const p of P){ if(p.net===NET) continue;
  const g=padGeom(p); const ly1=(p.layer===1||p.layer===12), ly2=(p.layer===2||p.layer===12);
  const b=g.c?{x1:g.c[0]-g.r-maskP,y1:g.c[1]-g.r-maskP,x2:g.c[0]+g.r+maskP,y2:g.c[1]+g.r+maskP}:g.c1?{x1:Math.min(g.c1[0],g.c2[0])-g.r-maskP,y1:Math.min(g.c1[1],g.c2[1])-g.r-maskP,x2:Math.max(g.c1[0],g.c2[0])+g.r+maskP,y2:Math.max(g.c1[1],g.c2[1])+g.r+maskP}:{x1:g.x1-maskP,y1:g.y1-maskP,x2:g.x2+maskP,y2:g.y2+maskP};
  for(const arr of [ly1?obsA:null, ly2?obsB:null]){ if(!arr) continue;
    for(let cy=Math.max(0,Math.floor((b.y1-Y0)/G)); cy<=Math.min(H-1,Math.ceil((b.y2-Y0)/G)); cy++)
      for(let cx=Math.max(0,Math.floor((b.x1-X0)/G)); cx<=Math.min(W-1,Math.ceil((b.x2-X0)/G)); cx++){
        const px=cx*G+G/2, py=cy*G+G/2+Y0;
        if(dPadPt(g,px,py) <= maskP) arr[cy*W+cx]=1; } } }
for(const l of L){ if(l.net===NET) continue;
  const r=maskL+(l.lineWidth||6)/2;
  for(const arr of [(l.layer===1||l.layer===12)?obsA:null,(l.layer===2||l.layer===12)?obsB:null]){ if(!arr) continue;
    const x1=Math.min(l.startX,l.endX),x2=Math.max(l.startX,l.endX),y1=Math.min(l.startY,l.endY),y2=Math.max(l.startY,l.endY);
    for(let cy=Math.max(0,Math.floor((y1-r-Y0)/G)); cy<=Math.min(H-1,Math.ceil((y2+r-Y0)/G)); cy++)
      for(let cx=Math.max(0,Math.floor((x1-r-X0)/G)); cx<=Math.min(W-1,Math.ceil((x2+r-X0)/G)); cx++){
        const px=cx*G+G/2, py=cy*G+G/2+Y0;
        if(ptSeg(px,py,l.startX,l.startY,l.endX,l.endY) <= r) arr[cy*W+cx]=1; } } }
for(const v of V){ if(v.net===NET) continue; const r=maskV+v.diameter/2;
  for(const arr of [obsA,obsB]){ for(let cy=Math.max(0,Math.floor((v.y-r-Y0)/G)); cy<=Math.min(H-1,Math.ceil((v.y+r-Y0)/G)); cy++)
    for(let cx=Math.max(0,Math.floor((v.x-r-X0)/G)); cx<=Math.min(W-1,Math.ceil((v.x+r-X0)/G)); cx++){ const px=cx*G+G/2, py=cy*G+G/2+Y0;
      if(Math.hypot(px-v.x,py-v.y)<=r) arr[cy*W+cx]=1; } } }
for(let cy=0;cy<H;cy++) for(let cx=0;cx<W;cx++){ const px=cx*G+G/2, py=cy*G+G/2+Y0;
  if(px<25||px>3912||py>-25||py<-3715){ const i=cy*W+cx; obsA[i]=1; obsB[i]=1; } }
// delete own copper
{ const nl=L.filter(l=>l.net===NET); if(nl.length) await eda.pcb_PrimitiveLine.delete(nl.map(l=>l.primitiveId));
  const nv=V.filter(v=>v.net===NET); if(nv.length) await eda.pcb_PrimitiveVia.delete(nv.map(v=>v.primitiveId)); }
// own copper masks (goal)
const goalA=new Uint8Array(NC), goalB=new Uint8Array(NC);
function addGoalSeg(lay,x1,y1,x2,y2){ const arr=lay===1?goalA:goalB;
  const xa=Math.min(x1,x2),xb=Math.max(x1,x2),ya=Math.min(y1,y2),yb=Math.max(y1,y2);
  for(let cy=Math.max(0,Math.floor((ya-6-Y0)/G)); cy<=Math.min(H-1,Math.ceil((yb+6-Y0)/G)); cy++)
    for(let cx=Math.max(0,Math.floor((xa-6-X0)/G)); cx<=Math.min(W-1,Math.ceil((xb+6-X0)/G)); cx++){
      const px=cx*G+G/2, py=cy*G+G/2+Y0;
      if(ptSeg(px,py,x1,y1,x2,y2)<=6) arr[cy*W+cx]=1; } }
function addGoalPad(p){ const g=padGeom(p); const lays=(p.layer===12?[1,2]:[p.layer]);
  for(const lay of lays){ const arr=lay===1?goalA:goalB;
    for(let cy=Math.max(0,Math.floor((p.y-80-Y0)/G)); cy<=Math.min(H-1,Math.ceil((p.y+80-Y0)/G)); cy++)
      for(let cx=Math.max(0,Math.floor((p.x-80-X0)/G)); cx<=Math.min(W-1,Math.ceil((p.x+80-X0)/G)); cx++){
        const px=cx*G+G/2, py=cy*G+G/2+Y0;
        if(dPadPt(g,px,py)<=0.01) arr[cy*W+cx]=1; } } }
const pads = P.filter(p=>p.net===NET);
if(!pads.length) return JSON.stringify({err:'no pads'});
addGoalPad(pads[0]);
const viaCache=new Int8Array(NC).fill(-1);
function viaAllowed(cell){ if(viaCache[cell]===0) return false; if(viaCache[cell]===1) return true;
  const cy=(cell/W)|0, cx=cell-cy*W; const x=cx*G+G/2, y=cy*G+G/2+Y0; const R=10;
  for(const p of P){ if(p.net===NET) continue; const g=padGeom(p); if(dPadPt(g,x,y) < R+6){ viaCache[cell]=0; return false; } }
  for(const l of L){ if(l.net===NET) continue; if(ptSeg(x,y,l.startX,l.startY,l.endX,l.endY) < R+(l.lineWidth||6)/2+6){ viaCache[cell]=0; return false; } }
  for(const v of V){ if(v.net===NET) continue; if(Math.hypot(x-v.x,y-v.y) < R+v.diameter/2+8){ viaCache[cell]=0; return false; } }
  viaCache[cell]=1; return true; }
const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const DN=8, NS=NC*DN*2;
const dist=new Float32Array(NS), prev=new Int32Array(NS);
const hc=[], hs=[];
function push(c,s){ let i=hc.length; hc.push(c); hs.push(s); while(i>0){ const p=(i-1)>>1; if(hc[p]<=hc[i])break; const tc=hc[p],ts=hs[p]; hc[p]=hc[i];hs[p]=hs[i];hc[i]=tc;hs[i]=ts; i=p; } }
function pop(){ const n=hc.length-1; if(n<0)return null; const c=hc[0],s=hs[0]; hc[0]=hc[n];hs[0]=hs[n]; hc.pop();hs.pop(); let i=0;
  while(true){ const l=2*i+1,r=l+1; let m=i; if(l<hc.length&&hc[l]<hc[m])m=l; if(r<hc.length&&hc[r]<hc[m])m=r; if(m===i)break; const tc=hc[m],ts=hs[m]; hc[m]=hc[i];hs[m]=hs[i];hc[i]=tc;hs[i]=ts; i=m; } return {c,s}; }
let madeSegs=0, madeVias=0, failed=0, connPads=1;
for(let pi=1; pi<pads.length; pi++){
  if(Date.now()-T0 > (OPTS.budget||70000)) { failed += (pads.length-pi); break; }
  const pad=pads[pi]; const g=padGeom(pad);
  const lays=(pad.layer===12?[1,2]:[pad.layer]);
  // reset search
  hc.length=0; hs.length=0;
  for(let i=0;i<NS;i++){ dist[i]=Infinity; prev[i]=-1; }
  let seeded=false;
  for(const lay of lays){ const arr=lay===1?obsA:obsB; const li=(lay===1?0:1);
    for(let cy=Math.max(0,Math.floor((pad.y-80-Y0)/G)); cy<=Math.min(H-1,Math.ceil((pad.y+80-Y0)/G)); cy++)
      for(let cx=Math.max(0,Math.floor((pad.x-80-X0)/G)); cx<=Math.min(W-1,Math.ceil((pad.x+80-X0)/G)); cx++){
        const px=cx*G+G/2, py=cy*G+G/2+Y0;
        if(dPadPt(g,px,py)>0.01) continue;
        const cell=cy*W+cx;
        for(let d=0;d<DN;d++){ const s=((li*NC+cell)*DN+d); if(dist[s]>0){ dist[s]=0; prev[s]=-1; push(0,s); seeded=true; } } } }
  if(!seeded){ failed++; continue; }
  const goal = (lay)=> lay===0?goalA:goalB;
  let best=-1, bd=Infinity, it=0;
  while(hc.length && it<1500000){ const cur=pop(); it++; const st=cur.s, d=cur.c; if(d>dist[st]) continue;
    const dd=st%DN, rest=(st-dd)/DN, lay=Math.floor(rest/NC), cell=rest-lay*NC;
    if(goal(lay)[cell] && d>0){ bd=d; best=st; break; }
    const cy=(cell/W)|0, cx=cell-cy*W; const obs=lay===0?obsA:obsB;
    for(let k=0;k<DN;k++){ const nx=cx+DIRS[k][0], ny=cy+DIRS[k][1]; if(nx<0||ny<0||nx>=W||ny>=H) continue;
      const ni=ny*W+nx; if(obs[ni]) continue;
      const step=(k<4)?G:Math.round(G*1.414);
      const cost=d+step+((k===dd)?0:TURN);
      const ns=((lay*NC+ni)*DN+k);
      if(cost<dist[ns]){ dist[ns]=cost; prev[ns]=st; push(cost,ns); } }
    const nl2=1-lay; if(viaAllowed(cell)) { const ns2=((nl2*NC+cell)*DN+dd); const c2=d+VIAC; if(c2<dist[ns2]){ dist[ns2]=c2; prev[ns2]=st; push(c2,ns2); } } }
  if(best<0){ failed++; continue; }
  // backtrack
  const raw=[]; let cur=best, guard=0;
  while(cur>=0 && guard++<300000){ const dd=cur%DN, rest=(cur-dd)/DN, lay=Math.floor(rest/NC), cell=rest-lay*NC;
    const cy=(cell/W)|0, cx=cell-cy*W;
    raw.push([cx*G+G/2, cy*G+G/2+Y0, lay===0?1:2, dd]); cur=prev[cur]; }
  raw.reverse();
  // simplify: keep direction changes
  const simp=[];
  for(let i=0;i<raw.length;i++){ if(i===0||i===raw.length-1){ simp.push(raw[i]); continue; }
    const a=raw[i-1], b=raw[i], c=raw[i+1];
    if(b[2]!==a[2]||b[2]!==c[2]){ simp.push(b); continue; }
    const d1=[b[0]-a[0],b[1]-a[1]], d2=[c[0]-b[0],c[1]-b[1]];
    const cr=d1[0]*d2[1]-d1[1]*d2[0];
    if(cr!==0) simp.push(b); }
  // emit
  for(let i=0;i<simp.length-1;i++){ const a=simp[i], b=simp[i+1];
    if(a[2]!==b[2]){ try{ const v=await eda.pcb_PrimitiveVia.create(NET, a[0],a[1],12,20,0,undefined,0,false); madeVias++; addGoalSeg(a[2],a[0],a[1],a[0],a[1]); }catch(e){} continue; }
    if(Math.abs(a[0]-b[0])<0.05 && Math.abs(a[1]-b[1])<0.05) continue;
    try{ await eda.pcb_PrimitiveLine.create(NET, a[2], a[0],a[1],b[0],b[1], 6, false); madeSegs++; addGoalSeg(a[2],a[0],a[1],b[0],b[1]); }catch(e){} }
  addGoalPad(pad); connPads++; }
if(OPTS.apply!==false) await eda.pcb_Document.save();
return JSON.stringify({net:NET, pads:pads.length, connPads, madeSegs, madeVias, failed, ms:Date.now()-T0});
