
const OPTS = __OPTS__;
const X0=0, Y0=-3760, W=3960, H=3780, NC=W*H;
const T=(n)=>Date.now();

async function build(){
  const pours = await eda.pcb_PrimitivePour.getAll();
  const poured = await eda.pcb_PrimitivePoured.getAll();
  const P = await eda.pcb_PrimitivePad.getAll();
  const Ln = await eda.pcb_PrimitiveLine.getAll();
  const V = await eda.pcb_PrimitiveVia.getAll();
  const pourLayer={}; pours.forEach(p=>pourLayer[p.primitiveId]=p.layer);
  const A=new Uint8Array(NC),B=new Uint8Array(NC);
  const NA=new Uint8Array(NC),NB=new Uint8Array(NC);
  function circle(a,x,y,r,out){ const x1=Math.floor(x-r-X0),x2=Math.ceil(x+r-X0),y1=Math.floor(y-r-Y0),y2=Math.ceil(y+r-Y0);
    for(let cy=Math.max(0,y1);cy<=Math.min(H-1,y2);cy++){ const dy=(cy+Y0)-y; for(let cx=Math.max(0,x1);cx<=Math.min(W-1,x2);cx++){ const dx=(cx+X0)-x; if(dx*dx+dy*dy<=r*r){const i=cy*W+cx;a[i]=1; if(out)out.push(i);} } } }
  function capsule(a,x1,y1,x2,y2,r,out){ const minx=Math.floor(Math.min(x1,x2)-r-X0),maxx=Math.ceil(Math.max(x1,x2)+r-X0),miny=Math.floor(Math.min(y1,y2)-r-Y0),maxy=Math.ceil(Math.max(y1,y2)+r-Y0);
    const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy;
    for(let cy=Math.max(0,miny);cy<=Math.min(H-1,maxy);cy++){ const py=(cy+Y0); for(let cx=Math.max(0,minx);cx<=Math.min(W-1,maxx);cx++){ const px=(cx+X0); let t=0; if(L2>0){ t=((px-x1)*dx+(py-y1)*dy)/L2; if(t<0)t=0; else if(t>1)t=1; } const qx=x1+t*dx-px, qy=y1+t*dy-py; if(qx*qx+qy*qy<=r*r){const i=cy*W+cx;a[i]=1; if(out)out.push(i);} } } }
  function rect(a,cx0,cy0,w,h,rot,out){ let p=w/2,q=h/2; const r=Math.round((rot||0))%180; if(r===90){ const t=p;p=q;q=t; }
    const x1=Math.floor(cx0-p-X0),x2=Math.ceil(cx0+p-X0),y1=Math.floor(cy0-q-Y0),y2=Math.ceil(cy0+q-Y0);
    for(let cy=Math.max(0,y1);cy<=Math.min(H-1,y2);cy++) for(let cx=Math.max(0,x1);cx<=Math.min(W-1,x2);cx++){const i=cy*W+cx;a[i]=1; if(out)out.push(i);} }
  function parseRing(ring){ const pts=[]; let i=0; if(typeof ring[0]==='number'){ pts.push([ring[0]*10, ring[1]*10]); i=2; }
    while(i<ring.length){ const t=ring[i];
      if(t==='L'){ pts.push([ring[i+1]*10, ring[i+2]*10]); i+=3; }
      else if(t==='ARC'){ pts.push([ring[i+2]*10, ring[i+3]*10]); i+=4; }
      else { pts.push([ring[i]*10, ring[i+1]*10]); i+=2; } }
    return pts; }
  function rings(a,rr){ const edges=[];
    for(const pts of rr){ for(let i=0;i<pts.length;i++){ const p=pts[i], q=pts[(i+1)%pts.length]; if(p[1]!==q[1]) edges.push([p[0],p[1],q[0],q[1]]); } }
    for(let cy=0;cy<H;cy++){ const y=cy+Y0+0.5; const xs=[];
      for(const e of edges){ const ax=e[0],ay=e[1],bx=e[2],by=e[3]; if((ay<=y&&by>y)||(by<=y&&ay>y)){ const t=(y-ay)/(by-ay); xs.push(ax+t*(bx-ax)); } }
      if(xs.length<2) continue; xs.sort((p,q)=>p-q);
      for(let i=0;i+1<xs.length;i+=2){ let cx1=Math.ceil(xs[i]-X0), cx2=Math.floor(xs[i+1]-X0); if(cx1<0)cx1=0; if(cx2>W-1)cx2=W-1; for(let cx=cx1;cx<=cx2;cx++) a[cy*W+cx]=1; } } }
  for(const pd of poured){ const lay=pourLayer[pd.pourPrimitiveId]; const arr=(lay===1)?A:B;
    for(const f of pd.pourFills){ const cp=f.path&&f.path.complexPolygon; if(!cp)continue; const rr=[]; for(const r of cp) rr.push(parseRing(r)); rings(arr,rr); } }
  const isG=n=>String(n||'')==='GND';
  function padShape(p,a,out){ const s=p.pad||['RECT',20,20,0]; const k=s[0],w=s[1],h=s[2];
    if(k==='ELLIPSE') circle(a,p.x,p.y,Math.max(w,h)/2,out);
    else if(k==='OVAL'){ if(h>=w) capsule(a,p.x,p.y-(h-w)/2,p.x,p.y+(h-w)/2,w/2,out); else capsule(a,p.x-(w-h)/2,p.y,p.x+(w-h)/2,p.y,h/2,out); }
    else rect(a,p.x,p.y,w,h,p.rotation,out); }
  const gnds=P.filter(p=>isG(p.net));
  for(const p of P){ const lay=(p.layer===12)?[A,B]:(p.layer===1?[A]:[B]); const layN=(p.layer===12)?[NA,NB]:(p.layer===1?[NA]:[NB]);
    if(isG(p.net)){ for(const a of lay) padShape(p,a,null); } else { for(const a of layN) padShape(p,a,null); } }
  for(const l of Ln){ const a=(l.layer===1)?A:B; if(isG(l.net)) capsule(a,l.startX,l.startY,l.endX,l.endY,Math.max(l.lineWidth,4)/2,null); else capsule((l.layer===1)?NA:NB,l.startX,l.startY,l.endX,l.endY,Math.max(l.lineWidth,4)/2,null); }
  for(const v of V){ if(isG(v.net)){ circle(A,v.x,v.y,v.diameter/2,null); circle(B,v.x,v.y,v.diameter/2,null); } else { circle(NA,v.x,v.y,v.diameter/2,null); circle(NB,v.x,v.y,v.diameter/2,null); } }
  return {pours,poured,P,Ln,V,A,B,NA,NB,padShape,isG,gnds,circle,capsule};
}
function labelOf(M){ const lbl=new Int32Array(NC); let next=1; const st=[];
  for(let s=0;s<NC;s++){ if(!M[s]||lbl[s]) continue; const id=next++; lbl[s]=id; st.length=0; st.push(s);
    while(st.length){ const cur=st.pop(); const cy=(cur/W)|0, cx=cur-cy*W;
      if(cy>0){ const n=cur-W; if(M[n]&&!lbl[n]){lbl[n]=id;st.push(n);} } if(cy<H-1){ const n=cur+W; if(M[n]&&!lbl[n]){lbl[n]=id;st.push(n);} }
      if(cx>0){ const n=cur-1; if(M[n]&&!lbl[n]){lbl[n]=id;st.push(n);} } if(cx<W-1){ const n=cur+1; if(M[n]&&!lbl[n]){lbl[n]=id;st.push(n);} } } }
  return {lbl,next}; }

async function solve(){
  const G = await build();
  const LA = labelOf(G.A), LB = labelOf(G.B);
  const OFF = LA.next;
  const par=new Int32Array(OFF+LB.next+2); for(let i=0;i<par.length;i++)par[i]=i;
  function find(x){ while(par[x]!==x){ par[x]=par[par[x]]; x=par[x]; } return x; }
  function uni(a,b){ a=find(a); b=find(b); if(a!==b) par[a]=b; }
  for(const v of G.V){ if(!G.isG(v.net))continue; const cx=Math.round(v.x-X0), cy=Math.round(v.y-Y0); if(cx<0||cy<0||cx>=W||cy>=H)continue; const i=cy*W+cx; if(LA.lbl[i]&&LB.lbl[i]) uni(LA.lbl[i],OFF+LB.lbl[i]); }
  const padInfo=G.gnds.map(p=>{ const lay=(p.layer===12)?[G.A,G.B]:(p.layer===1?[G.A]:[G.B]); const out=[]; const nodes=new Set();
    for(let k=0;k<lay.length;k++){ out.length=0; G.padShape(p,lay[k],out); const isTop=(k===0&&p.layer!==2); const L=isTop?LA.lbl:LB.lbl;
      for(const c of out){ const L0=L[c]; if(L0) nodes.add(isTop?L0:OFF+L0); } }
    const arr=[...nodes]; for(let i=1;i<arr.length;i++) uni(arr[0],arr[i]); return {node:arr[0]||0, x:p.x, y:p.y, num:p.padNumber, layer:p.layer}; });
  function groups(){ const m=new Map(); for(const pi of padInfo){ const r=pi.node?find(pi.node):0; if(!m.has(r)) m.set(r,[]); m.get(r).push(pi); } return m; }
  const gm=groups();
  const res=[];
  for(const [r,pads] of gm){ res.push({root:r, n:pads.length, pads:pads.map(p=>[p.x,p.y,p.num,p.layer])}); }
  res.sort((a,b)=>b.n-a.n);
  for(const g of res){ let x1=1e9,x2=-1e9,y1=1e9,y2=-1e9; for(const p of g.pads){ if(p[0]<x1)x1=p[0]; if(p[0]>x2)x2=p[0]; if(p[1]<y1)y1=p[1]; if(p[1]>y2)y2=p[1]; } g.bbox=[x1,y1,x2,y2]; }
  return {G, LA, LB, OFF, find, uni, padInfo, groups:res, gm};
}

function stitchPlan(R){
  const {G,LA,LB,OFF,find,uni} = R;
  const ov=new Map();
  for(let i=0;i<NC;i++){ if(!G.A[i]||!G.B[i]) continue; const key=LA.lbl[i]*1000000+LB.lbl[i]; let e=ov.get(key); if(!e){ e={n:0,cells:[]}; ov.set(key,e);} e.n++; if(e.cells.length<2500 && (e.n%5===0)) e.cells.push(i); }
  const pairs=[...ov.entries()].map(([k,e])=>({a:Math.floor(k/1000000), b:k%1000000, n:e.n, cells:e.cells})).sort((x,y)=>y.n-x.n);
  const holes=[]; for(const v of G.V) holes.push([v.x,v.y,v.holeDiameter]); for(const p of G.P){ if(p.hole) holes.push([p.x,p.y,40]); }
  function okSite(cx,cy){ const Rr=11;
    for(let dy=-Rr;dy<=Rr;dy++){ const cy2=cy+dy; if(cy2<0||cy2>=H) return false; for(let dx=-Rr;dx<=Rr;dx++){ if(dx*dx+dy*dy>Rr*Rr)continue; const cx2=cx+dx; if(cx2<0||cx2>=W) return false; const i=cy2*W+cx2; if(!G.A[i]||!G.B[i]) return false; } }
    const wx=cx+X0, wy=cy+Y0;
    for(const hh of holes){ const dx=wx-hh[0], dy=wy-hh[1]; const lim=6+hh[2]/2+6; if(dx*dx+dy*dy<lim*lim) return false; }
    return true; }
  const chosen=[];
  for(const pr of pairs){ const na=pr.a, nb=OFF+pr.b; if(find(na)===find(nb)) continue;
    for(let t=0;t<pr.cells.length;t++){ const i=pr.cells[t]; const cy=(i/W)|0, cx=i-cy*W; if(okSite(cx,cy)){ chosen.push([cx+X0,cy+Y0,pr.n]); uni(na,nb); break; } } }
  // recount groups
  const m=new Map(); for(const pi of R.padInfo){ const r=pi.node?find(pi.node):0; if(!m.has(r)) m.set(r,[]); m.get(r).push(pi); }
  return {chosen, groups:[...m.values()].sort((a,b)=>b.length-a.length)};
}

if (OPTS.mode === 'diagnose') {
  const R = await solve();
  return JSON.stringify({n: R.groups.length, groups: R.groups.slice(0,14).map(g=>({n:g.n, bbox:g.bbox.map(Math.round), pad:g.pads[0]}))});
}
if (OPTS.mode === 'stitch') {
  const R = await solve();
  const plan = stitchPlan(R);
  let created=[], err=null;
  if (OPTS.apply) {
    for (const c of plan.chosen) {
      try { const v = await eda.pcb_PrimitiveVia.create('GND', c[0], c[1], 12, 20, 0, undefined, 0, false); created.push(v && v.primitiveId ? v.primitiveId : 'ok'); }
      catch(e){ err = String(e); created.push('ERR:'+String(e).slice(0,60)); }
    }
  }
  return JSON.stringify({before: R.groups.length, chosen: plan.chosen.length, after: plan.groups.length, agroups: plan.groups.slice(0,12).map(g=>({n:g.length, pads:g.slice(0,4).map(p=>[Math.round(p.x),Math.round(p.y),p.num])})), created: created.length, err});
}

if (OPTS.mode === 'route') {
  const R = await solve();
  const {G, LA, LB, OFF, find, uni} = R;
  const roots = R.groups.map(g=>g.root);
  const mainRoot = roots[0];
  const S=4, W4=Math.ceil(3960/S), H4=Math.ceil(3780/S), NF=W4*H4;
  const O1=new Uint8Array(NF), O2=new Uint8Array(NF), V1=new Uint8Array(NF), V2=new Uint8Array(NF);
  const inBoard=(x,y)=> x>=20 && x<=3917 && y<=-20 && y>=-3720;
  function rC(arr,x,y,r){ const x1=Math.floor((x-r)/S),x2=Math.ceil((x+r)/S),y1=Math.floor((y-r+3760)/S),y2=Math.ceil((y+r+3760)/S);
    for(let cy=Math.max(0,y1);cy<=Math.min(H4-1,y2);cy++){ const py=cy*S-3760+2; const dy=py-y; for(let cx=Math.max(0,x1);cx<=Math.min(W4-1,x2);cx++){ const px=cx*S+2; const dx=px-x; if(dx*dx+dy*dy<=r*r) arr[cy*W4+cx]=1; } } }
  function rCap(arr,x1,y1,x2,y2,r){ const minx=Math.floor((Math.min(x1,x2)-r)/S),maxx=Math.ceil((Math.max(x1,x2)+r)/S),miny=Math.floor((Math.min(y1,y2)-r+3760)/S),maxy=Math.ceil((Math.max(y1,y2)+r+3760)/S);
    const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy;
    for(let cy=Math.max(0,miny);cy<=Math.min(H4-1,maxy);cy++){ const py=cy*S-3760+2; for(let cx=Math.max(0,minx);cx<=Math.min(W4-1,maxx);cx++){ const px=cx*S+2; let t=0; if(L2>0){ t=((px-x1)*dx+(py-y1)*dy)/L2; if(t<0)t=0; else if(t>1)t=1; } const qx=x1+t*dx-px, qy=y1+t*dy-py; if(qx*qx+qy*qy<=r*r) arr[cy*W4+cx]=1; } } }
  function rRect(arr,cx0,cy0,w,h,rot,pad){ let a=w/2+pad,b=h/2+pad; const rr=Math.round((rot||0))%180; if(rr===90){ const t=a;a=b;b=t; }
    const x1=Math.floor((cx0-a)/S),x2=Math.ceil((cx0+a)/S),y1=Math.floor((cy0-b+3760)/S),y2=Math.ceil((cy0+b+3760)/S);
    for(let cy=Math.max(0,y1);cy<=Math.min(H4-1,y2);cy++) for(let cx=Math.max(0,x1);cx<=Math.min(W4-1,x2);cx++) arr[cy*W4+cx]=1; }
  function padRaster(arr,p,pad){ const s=p.pad||['RECT',20,20,0]; const k=s[0],w=s[1],h=s[2];
    if(k==='ELLIPSE') rC(arr,p.x,p.y,Math.max(w,h)/2+pad);
    else if(k==='OVAL'){ if(h>=w) rCap(arr,p.x,p.y-(h-w)/2,p.x,p.y+(h-w)/2,w/2+pad); else rCap(arr,p.x-(w-h)/2,p.y,p.x+(w-h)/2,p.y,h/2+pad); }
    else rRect(arr,p.x,p.y,w,h,p.rotation,pad); }
  for(const p of G.P){ const l1=(p.layer===1||p.layer===12), l2=(p.layer===2||p.layer===12);
    if(G.isG(p.net)){ if(l1) padRaster(V1,p,8); if(l2) padRaster(V2,p,8); }
    else { if(l1){ padRaster(O1,p,10); padRaster(V1,p,17); } if(l2){ padRaster(O2,p,10); padRaster(V2,p,17); } } }
  for(const l of G.Ln){ if(G.isG(l.net)) continue; const arr=(l.layer===1)?O1:O2, arr2=(l.layer===1)?V1:V2; const r=(l.lineWidth||6)/2;
    rCap(arr,l.startX,l.startY,l.endX,l.endY,r+10); rCap(arr2,l.startX,l.startY,l.endX,l.endY,r+17); }
  for(const v of G.V){ if(!G.isG(v.net)){ rC(O1,v.x,v.y,v.diameter/2+10); rC(O2,v.x,v.y,v.diameter/2+10); }
    rC(V1,v.x,v.y,v.diameter/2+12); rC(V2,v.x,v.y,v.diameter/2+12); }
  // boundary bar
  const border=(arr)=>{ for(let cy=0;cy<H4;cy++)for(let cx=0;cx<W4;cx++){ const x=cx*S+2,y=cy*S-3760+2; if(!inBoard(x,y)) arr[cy*W4+cx]=1; } };
  border(O1); border(O2); border(V1); border(V2);
  // seed cells: main group pads
  const seeds=[];
  for(const pi of R.padInfo){ if(!pi.node) continue; if(find(pi.node)!==mainRoot) continue;
    const p = G.gnds.find(q=>Math.abs(q.x-pi.x)<1e-6 && Math.abs(q.y-pi.y)<1e-6);
    if(!p) continue;
    const cellOf=(x,y)=>{ const cx=Math.floor(x/S), cy=Math.floor((y+3760)/S); return cy*W4+cx; };
    const c0=cellOf(p.x,p.y);
    if(p.layer===1||p.layer===12) seeds.push(c0);
    if(p.layer===2||p.layer===12) seeds.push(NF+c0);
  }
  // target cells per group
  const groupCells=new Map();
  for(const g of R.groups){ if(g.root===mainRoot) continue; const set=[];
    for(const pd of g.pads){ const p=G.gnds.find(q=>Math.abs(q.x-pd[0])<1e-6 && Math.abs(q.y-pd[1])<1e-6); if(!p) continue;
      const cx=Math.floor(p.x/S), cy=Math.floor((p.y+3760)/S); const c=cy*W4+cx;
      if(p.layer===1||p.layer===12) set.push(c);
      if(p.layer===2||p.layer===12) set.push(NF+c);
    }
    groupCells.set(g.root, set);
  }
  // dijkstra
  const NN=2*NF;
  const dist=new Float32Array(NN).fill(Infinity);
  const prev=new Int32Array(NN).fill(-1);
  const heapC=[], heapS=[];
  function push(c,s){ let i=heapC.length; heapC.push(c); heapS.push(s);
    while(i>0){ const p=(i-1)>>1; if(heapC[p]<=heapC[i]) break; const tc=heapC[p],ts=heapS[p]; heapC[p]=heapC[i];heapS[p]=heapS[i];heapC[i]=tc;heapS[i]=ts; i=p; } }
  function pop(){ const n=heapC.length-1; if(n<0) return null; const c=heapC[0], s=heapS[0];
    heapC[0]=heapC[n]; heapS[0]=heapS[n]; heapC.pop(); heapS.pop(); let i=0;
    while(true){ const l=2*i+1,r=l+1; let m=i; if(l<heapC.length&&heapC[l]<heapC[m])m=l; if(r<heapC.length&&heapC[r]<heapC[m])m=r; if(m===i)break; const tc=heapC[m],ts=heapS[m]; heapC[m]=heapC[i];heapS[m]=heapS[i];heapC[i]=tc;heapS[i]=ts; i=m; }
    return {c,s}; }
  for(const s of seeds){ if(dist[s]===0) continue; dist[s]=0; push(0,s); }
  const D=[[1,0,10],[-1,0,10],[0,1,10],[0,-1,10],[1,1,14],[1,-1,14],[-1,1,14],[-1,-1,14]];
  let pops=0;
  while(heapC.length && pops<4000000){ const it=pop(); pops++; const st=it.s, d=it.c; if(d>dist[st]) continue;
    const lay=st>=NF?1:0, ci=st%NF, cy=(ci/W4)|0, cx=ci-cy*W4;
    const obs = lay===0?O1:O2;
    for(let k=0;k<8;k++){ const nx=cx+D[k][0], ny=cy+D[k][1]; if(nx<0||ny<0||nx>=W4||ny>=H4) continue; const ni=ny*W4+nx; if(obs[ni]) continue;
      const nd=d+D[k][2]; const ns=lay*NF+ni; if(nd<dist[ns]){ dist[ns]=nd; prev[ns]=st; push(nd,ns); } }
    if(OPTS.noVia) continue;
    if(!V1[ci]||!V2[ci]) continue;
    const os=lay===0?NF+ci:ci; const nd2=d+900;
    if(nd2<dist[os]){ dist[os]=nd2; prev[os]=st; push(nd2,os); }
  }
  // build routes
  const results=[];
  for(const g of R.groups){ if(g.root===mainRoot) continue;
    const cands=groupCells.get(g.root)||[]; let best=-1, bd=Infinity;
    for(const c of cands){ if(dist[c]<bd){ bd=dist[c]; best=c; } }
    if(best<0||bd===Infinity){ results.push({root:g.root, n:g.n, ok:false, why:'nopath', pad:g.pads[0], bd:0}); continue; }
    const path=[]; let cur=best; let guard=0;
    while(cur>=0 && guard++<20000){ path.push(cur); cur=prev[cur]; }
    path.reverse();
    results.push({root:g.root, n:g.n, ok:true, bd:Math.round(bd), len:path.length, path:path.map(s=>[ (s%NF)%W4*S+2, Math.floor((s%NF)/W4)*S-3760+2, s>=NF?2:1 ])});
  }
  const emit = [];
  let nLines=0, nVias=0, errs=[]; const skipped=[];
  function obsAt(lay, x, y){ const cx=Math.floor(x/S), cy=Math.floor((y+3760)/S); if(cx<0||cy<0||cx>=W4||cy>=H4) return 1; const arr=(lay===1)?O1:O2; return arr[cy*W4+cx]; }
  function dirOK(a,b){ const dx=b[0]-a[0], dy=b[1]-a[1]; return dx===0||dy===0||Math.abs(dx)===Math.abs(dy); }
  function segClear(lay,a,b){ const dx=b[0]-a[0], dy=b[1]-a[1]; const n=Math.max(Math.abs(dx),Math.abs(dy)); const steps=Math.ceil(n/2);
    for(let k=0;k<=steps;k++){ const t=steps?k/steps:0; if(obsAt(lay,a[0]+dx*t,a[1]+dy*t)) return false; } return true; }
  function simplify(path){ const out=[path[0]]; let i=0;
    while(i<path.length-1){
      if(path[i+1][2]!==path[i][2]){ out.push(path[i+1]); i=i+1; continue; }
      let pick=-1;
      for(let j=path.length-1;j>i;j--){ if(path[j][2]!==path[i][2]) continue; if(!dirOK(path[i],path[j])) continue; if(segClear(path[i][2],path[i],path[j])){ pick=j; break; } }
      if(pick<0) pick=i+1;
      out.push(path[pick]); i=pick; }
    return out; }
  for(const r of results){ if(!r.ok||!r.path) continue;
    const sp=simplify(r.path);
    emit.push({n:r.n, pts:sp});
    const viaPts=[]; for(let k=0;k<sp.length-1;k++){ const a=sp[k], b=sp[k+1]; if(a[2]!==b[2]) viaPts.push(a); }
    const existing=G.V.map(v=>[v.x,v.y]); const fresh=[]; let clash=false;
    for(const vp of viaPts){ for(const e of existing){ if(Math.hypot(vp[0]-e[0],vp[1]-e[1])<20){ clash=true; break; } } if(clash)break;
      for(const f of fresh){ if(Math.hypot(vp[0]-f[0],vp[1]-f[1])<20){ clash=true; break; } } if(clash)break; fresh.push(vp); }
    if(clash){ skipped.push([r.n, viaPts.length]); continue; }
    if(!OPTS.apply) continue;
    for(let k=0;k<sp.length-1;k++){
      const a=sp[k], b=sp[k+1];
      if(a[2]!==b[2]){ try { await eda.pcb_PrimitiveVia.create('GND', a[0], a[1], 12, 20, 0, undefined, 0, false); nVias++; } catch(e){ errs.push(String(e).slice(0,60)); } continue; }
      if(a[0]===b[0]&&a[1]===b[1]) continue;
      try { await eda.pcb_PrimitiveLine.create('GND', a[2], a[0], a[1], b[0], b[1], 6, false); nLines++; } catch(e){ errs.push(String(e).slice(0,60)); }
    } }
  // ray-based fallback for pads still isolated
  const rayFix=[];
  {
    const cellOf=(x,y)=>{ const cx=Math.floor(x/S), cy=Math.floor((y+3760)/S); if(cx<0||cy<0||cx>=W4||cy>=H4) return -1; return cy*W4+cx; };
    const isMainCell=(lay,ci)=>{ if(ci<0) return false; const L=lay===0?LA.lbl[ci]:LB.lbl[ci]; if(!L) return false; return find(lay===0?L:OFF+L)===find(mainRoot); };
    const freeCell=(lay,ci)=>{ if(ci<0) return false; return (lay===0?O1[ci]:O2[ci])===0; };
    for(const g of R.groups){ if(g.root===mainRoot) continue; if(find(g.root)===find(mainRoot)) continue;
      for(const pd of g.pads){
        const p=G.gnds.find(q=>Math.abs(q.x-pd[0])<1e-6 && Math.abs(q.y-pd[1])<1e-6); if(!p) continue;
        const lays = (p.layer===12)?[0,1]:(p.layer===1?[0]:[1]);
        let hit=null, hitLay=0;
        for(const lay of lays){ if(hit) break;
          for(let ai=0;ai<144 && !hit;ai++){
            const ang=ai*Math.PI*2/144; const dx=Math.cos(ang), dy=Math.sin(ang);
            for(let t=8;t<=140;t+=1){
              const x=p.x+dx*t, y=p.y+dy*t; const ci=cellOf(x,y);
              if(!freeCell(lay,ci)) break;
              if(isMainCell(lay,ci)){ hit=[x,y]; hitLay=lay; break; }
            }
          }
        }
        if(!hit) continue;
        if(OPTS.apply){ try { await eda.pcb_PrimitiveLine.create('GND', hitLay===0?1:2, p.x, p.y, hit[0], hit[1], 6, false); nLines++; } catch(e){ errs.push(String(e).slice(0,60)); } }
        uni(g.root, mainRoot);
        rayFix.push([Math.round(p.x),Math.round(p.y),Math.round(hit[0]),Math.round(hit[1]),hitLay===0?1:2]);
        break;
      }
    }
  }
  if(OPTS.apply){ try{ await eda.pcb_Document.save(); }catch(e){} }
  return JSON.stringify({applied: !!OPTS.apply, mainRootPads: R.groups[0].n, nLines, nVias, skipped, rayFix, errs: errs.slice(0,4), plans: emit.map(e=>({n:e.n, segs:e.pts.length-1, pts:e.pts.map(p=>[Math.round(p[0]),Math.round(p[1]),p[2]])}))});
}
if (OPTS.mode === 'map') {
  const R = await solve();
  const {G, LA, LB, OFF, find} = R;
  const mainRoot = R.groups[0].root;
  const MR = find(mainRoot);
  function ch(cx,cy,lay){
    const i=cy*W+cx; const A=lay===0?G.A:G.B, N=lay===0?G.NA:G.NB, L=lay===0?LA.lbl:LB.lbl;
    if(N[i]) return '#';
    if(A[i]){ const l=L[i]; if(l && find(lay===0?l:OFF+l)===MR) return '+'; return 'o'; }
    return '.';
  }
  const out=[];
  for(const c of OPTS.crops){
    out.push('--- '+JSON.stringify(c));
    for(let y=c[1]; y>=c[3]; y-=c[4]){ let line='';
      for(let x=c[0]; x<=c[2]; x+=c[4]){ const cx=Math.round(x-X0), cy=Math.round(y-Y0); if(cx<0||cy<0||cx>=W||cy>=H){ line+='?'; continue; } line+=ch(cx,cy,c[5]); }
      out.push(line); }
  }
  return out.join('\n');
}


if (OPTS.mode === 'orphans') {
  const R = await solve();
  const {G, LA, LB, OFF, find} = R;
  const mainRoot = find(R.groups[0].root);
  const N = G.Ln.length + G.V.length;
  const la=[], lb=[];
  for(let i=0;i<NC;i++){ la.push(LA.lbl[i]); }
  function lineMain(l){
    const arr = l.layer===1?G.A:G.B, lbl = l.layer===1?LA.lbl:LB.lbl;
    const x1=l.startX,y1=l.startY,x2=l.endX,y2=l.endY, r=Math.max((l.lineWidth||6)/2,2);
    const mnx=Math.floor(Math.min(x1,x2)-r-X0),mxx=Math.ceil(Math.max(x1,x2)+r-X0),mny=Math.floor(Math.min(y1,y2)-r-Y0),mxy=Math.ceil(Math.max(y1,y2)+r-Y0);
    const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy;
    for(let cy=Math.max(0,mny);cy<=Math.min(H-1,mxy);cy++){ const py=cy+Y0; for(let cx=Math.max(0,mnx);cx<=Math.min(W-1,mxx);cx++){ const px=cx+X0; let t=0;
      if(L2>0){ t=((px-x1)*dx+(py-y1)*dy)/L2; if(t<0)t=0; else if(t>1)t=1; }
      const qx=x1+t*dx-px,qy=y1+t*dy-py; if(qx*qx+qy*qy>r*r) continue;
      const i=cy*W+cx; const L0=lbl[i]; if(!L0) continue;
      const nd = (l.layer===1)? L0 : OFF+L0;
      if(find(nd)===mainRoot) return true; } }
    return false;
  }
  const badL=[], badV=[];
  for(const l of G.Ln){ if(!G.isG(l.net)) continue; if(!lineMain(l)) badL.push({id:l.primitiveId, net:l.net, layer:l.layer, a:[Math.round(l.startX),Math.round(l.startY)], b:[Math.round(l.endX),Math.round(l.endY)]}); }
  for(const v of G.V){ if(!G.isG(v.net)) continue;
    const cx=Math.round(v.x-X0), cy=Math.round(v.y-Y0); const i=cy*W+cx;
    const okA = LA.lbl[i] && find(LA.lbl[i])===mainRoot;
    const okB = LB.lbl[i] && find(OFF+LB.lbl[i])===mainRoot;
    if(!okA && !okB) badV.push({id:v.primitiveId, at:[Math.round(v.x),Math.round(v.y)]}); }
  return JSON.stringify({orphanLines: badL.length, orphanVias: badV.length, lines: badL.slice(0,20), vias: badV.slice(0,10)});
}
return JSON.stringify({mode: OPTS.mode, err: 'unknown mode'});

