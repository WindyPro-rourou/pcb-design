const OPTS = __OPTS__;

const NET = OPTS.net;
const P = await eda.pcb_PrimitivePad.getAll();
const L = await eda.pcb_PrimitiveLine.getAll();
const V = await eda.pcb_PrimitiveVia.getAll();
const X0=0,Y0=-3760,S=4,W4=Math.ceil(3960/S),H4=Math.ceil(3780/S),NF=W4*H4;
const O1=new Uint8Array(NF),O2=new Uint8Array(NF),K1=new Uint8Array(NF),K2=new Uint8Array(NF);
const inB=(x,y)=> x>=20 && x<=3917 && y<=-20 && y>=-3720;
function rC(a,x,y,r){ const x1=Math.floor((x-r)/S),x2=Math.ceil((x+r)/S),y1=Math.floor((y-r+3760)/S),y2=Math.ceil((y+r+3760)/S);
  for(let cy=Math.max(0,y1);cy<=Math.min(H4-1,y2);cy++){ const py=cy*S-3760+2, dy=py-y; for(let cx=Math.max(0,x1);cx<=Math.min(W4-1,x2);cx++){ const px=cx*S+2, dx=px-x; if(dx*dx+dy*dy<=r*r) a[cy*W4+cx]=1; } } }
function rCap(a,x1,y1,x2,y2,r){ const mnx=Math.floor((Math.min(x1,x2)-r)/S),mxx=Math.ceil((Math.max(x1,x2)+r)/S),mny=Math.floor((Math.min(y1,y2)-r+3760)/S),mxy=Math.ceil((Math.max(y1,y2)+r+3760)/S);
  const dx=x2-x1,dy=y2-y1,L2=dx*dx+dy*dy;
  for(let cy=Math.max(0,mny);cy<=Math.min(H4-1,mxy);cy++){ const py=cy*S-3760+2; for(let cx=Math.max(0,mnx);cx<=Math.min(W4-1,mxx);cx++){ const px=cx*S+2; let t=0; if(L2>0){ t=((px-x1)*dx+(py-y1)*dy)/L2; if(t<0)t=0; else if(t>1)t=1; } const qx=x1+t*dx-px,qy=y1+t*dy-py; if(qx*qx+qy*qy<=r*r) a[cy*W4+cx]=1; } } }
function rRect(a,cx0,cy0,w,h,rot,pad){ let W=w/2+pad,H=h/2+pad; if(Math.round((rot||0))%180===90){ const t=W;W=H;H=t; }
  const x1=Math.floor((cx0-W)/S),x2=Math.ceil((cx0+W)/S),y1=Math.floor((cy0-H+3760)/S),y2=Math.ceil((cy0+H+3760)/S);
  for(let cy=Math.max(0,y1);cy<=Math.min(H4-1,y2);cy++) for(let cx=Math.max(0,x1);cx<=Math.min(W4-1,x2);cx++) a[cy*W4+cx]=1; }
function padR(a,p,pad){ const s=p.pad||['RECT',20,20,0]; const k=s[0],w=s[1],h=s[2];
  if(k==='ELLIPSE') rC(a,p.x,p.y,Math.max(w,h)/2+pad);
  else if(k==='OVAL'){ if(h>=w) rCap(a,p.x,p.y-(h-w)/2,p.x,p.y+(h-w)/2,w/2+pad); else rCap(a,p.x-(w-h)/2,p.y,p.x+(w-h)/2,p.y,h/2+pad); }
  else rRect(a,p.x,p.y,w,h,p.rotation,pad); }
for(const p of P){ if(p.net===NET) continue; if(!p.net) continue; const l1=(p.layer===1||p.layer===12), l2=(p.layer===2||p.layer===12);
  if(l1){ padR(O1,p,15); padR(K1,p,22); } if(l2){ padR(O2,p,15); padR(K2,p,22); } }
for(const l of L){ if(l.net===NET) continue; const r=(l.lineWidth||6)/2;
  rCap((l.layer===1)?O1:O2, l.startX,l.startY,l.endX,l.endY, r+15); rCap((l.layer===1)?K1:K2, l.startX,l.startY,l.endX,l.endY, r+22); }
for(const v of V){ if(v.net===NET) continue; rC(O1,v.x,v.y,v.diameter/2+20); rC(O2,v.x,v.y,v.diameter/2+20); rC(K1,v.x,v.y,v.diameter/2+22); rC(K2,v.x,v.y,v.diameter/2+22); }
for(let cy=0;cy<H4;cy++) for(let cx=0;cx<W4;cx++){ const x=cx*S+2,y=cy*S-3760+2; if(!inB(x,y)){ const i=cy*W4+cx; O1[i]=1;O2[i]=1;K1[i]=1;K2[i]=1; } }
const W1=new Uint8Array(NF), W2=new Uint8Array(NF);
for(const p of P){ if(p.net!==NET) continue; if(p.layer===1||p.layer===12) padR(W1,p,0); if(p.layer===2||p.layer===12) padR(W2,p,0); }
for(const l of L){ if(l.net!==NET) continue; rCap((l.layer===1)?W1:W2, l.startX,l.startY,l.endX,l.endY, (l.lineWidth||6)/2); }
for(const v of V){ if(v.net!==NET) continue; rC(W1,v.x,v.y,v.diameter/2); rC(W2,v.x,v.y,v.diameter/2); }
const pads = P.filter(p=>p.net===NET);
if(OPTS.mode==='map'){
  const cs=OPTS.crop; const rows=[];
  for(let y=cs[1]; y>=cs[3]; y-=cs[4]){ let line='';
    for(let x=cs[0]; x<=cs[2]; x+=cs[4]){ const cx=Math.floor(x/S), cy=Math.floor((y+3760)/S);
      if(cx<0||cy<0||cx>=W4||cy>=H4){ line+='?'; continue; }
      const i=cy*W4+cx; const lay = cs[5]||1;
      const Wm = lay===0?W1:W2, Om = lay===0?O1:O2;
      line += Wm[i] ? (Om[i]?'X':'P') : (Om[i]?'#':'.'); }
    rows.push(line); }
  return rows.join('\n');
}
const cellOf=(x,y)=>{ const cx=Math.floor(x/S), cy=Math.floor((y+3760)/S); if(cx<0||cy<0||cx>=W4||cy>=H4) return -1; return cy*W4+cx; };
function inShape(p,x,y){ const s=p.pad||['RECT',20,20,0]; const k=s[0],w=s[1],h=s[2];
  if(k==='ELLIPSE') return Math.hypot(x-p.x,y-p.y)<=Math.max(w,h)/2;
  if(k==='OVAL'){ if(h>=w){ const cy=Math.max(Math.min(y,p.y+(h-w)/2),p.y-(h-w)/2); return Math.hypot(x-p.x,y-cy)<=w/2; } const cx=Math.max(Math.min(x,p.x+(w-h)/2),p.x-(w-h)/2); return Math.hypot(x-cx,y-p.y)<=h/2; }
  let W=w/2,H=h/2; if(Math.round((p.rotation||0))%180===90){ const t=W;W=H;H=t; }
  return Math.abs(x-p.x)<=W && Math.abs(y-p.y)<=H; }
function padSeeds(p){ const out=[];
  const cx0=Math.floor((p.x-70)/S), cx1=Math.ceil((p.x+70)/S), cy0=Math.floor((p.y-70+3760)/S), cy1=Math.ceil((p.y+70+3760)/S);
  for(let cy=Math.max(0,cy0);cy<=Math.min(H4-1,cy1);cy++) for(let cx=Math.max(0,cx0);cx<=Math.min(W4-1,cx1);cx++){
    const x=cx*S+2, y=cy*S-3760+2; if(!inShape(p,x,y)) continue;
    if(p.layer===1||p.layer===12) out.push(cy*W4+cx);
    if(p.layer===2||p.layer===12) out.push(NF+cy*W4+cx); }
  return out; }
const NN=2*NF;
const dist=new Float32Array(NN).fill(Infinity), prev=new Int32Array(NN).fill(-1);
const hc=[],hs=[];
function push(c,s){ let i=hc.length; hc.push(c); hs.push(s); while(i>0){ const p=(i-1)>>1; if(hc[p]<=hc[i])break; const tc=hc[p],ts=hs[p]; hc[p]=hc[i];hs[p]=hs[i];hc[i]=tc;hs[i]=ts; i=p; } }
function pop(){ const n=hc.length-1; if(n<0)return null; const c=hc[0],s=hs[0]; hc[0]=hc[n];hs[0]=hs[n]; hc.pop();hs.pop(); let i=0;
  while(true){ const l=2*i+1,r=l+1; let m=i; if(l<hc.length&&hc[l]<hc[m])m=l; if(r<hc.length&&hc[r]<hc[m])m=r; if(m===i)break; const tc=hc[m],ts=hs[m]; hc[m]=hc[i];hs[m]=hs[i];hc[i]=tc;hs[i]=ts; i=m; } return {c,s}; }
let SRC = OPTS.srcIdx || 0;
if(OPTS.srcX!==undefined && OPTS.srcY!==undefined){ let bi=-1,bd=1e12; pads.forEach((p,i)=>{ const d=Math.hypot(p.x-OPTS.srcX,p.y-OPTS.srcY); if(d<bd){bd=d;bi=i;} }); if(bi>=0) SRC=bi; }
for(const s of padSeeds(pads[SRC])){ if(dist[s]!==0){ dist[s]=0; push(0,s); } }
const D=[[1,0,10],[-1,0,10],[0,1,10],[0,-1,10],[1,1,14],[1,-1,14],[-1,1,14],[-1,-1,14]];
let it=0;
while(hc.length && it<6000000){ const cur=pop(); it++; const st=cur.s,d=cur.c; if(d>dist[st])continue;
  const lay=st>=NF?1:0, ci=st%NF, cy=(ci/W4)|0, cx=ci-cy*W4; const obs=lay===0?O1:O2;
  for(let k=0;k<8;k++){ const nx=cx+D[k][0], ny=cy+D[k][1]; if(nx<0||ny<0||nx>=W4||ny>=H4)continue; const ni=ny*W4+nx; if(obs[ni])continue;
    const nd=d+D[k][2], ns=lay*NF+ni; if(nd<dist[ns]){ dist[ns]=nd; prev[ns]=st; push(nd,ns); } }
  if(!K1[ci]||!K2[ci]) continue;
  const os=lay===0?NF+ci:ci, nd2=d+900; if(nd2<dist[os]){ dist[os]=nd2; prev[os]=st; push(nd2,os); } }
function simplify(path){ function obsAt(lay,x,y){ const cx=Math.floor(x/S),cy=Math.floor((y+3760)/S); if(cx<0||cy<0||cx>=W4||cy>=H4)return 1; return (lay===1?O1:O2)[cy*W4+cx]; }
  function dirOK(a,b){ const dx=b[0]-a[0],dy=b[1]-a[1]; return dx===0||dy===0||Math.abs(dx)===Math.abs(dy); }
  function clear(lay,a,b){ const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.max(Math.abs(dx),Math.abs(dy)),st=Math.ceil(n/2); for(let k=0;k<=st;k++){ const t=st?k/st:0; if(obsAt(lay,a[0]+dx*t,a[1]+dy*t))return false; } return true; }
  const out=[path[0]]; let i=0;
  while(i<path.length-1){ if(path[i+1][2]!==path[i][2]){ out.push(path[i+1]); i++; continue; }
    let pick=-1;
    for(let j=path.length-1;j>i;j--){ if(path[j][2]!==path[i][2])continue; if(!dirOK(path[i],path[j]))continue; if(clear(path[i][2],path[i],path[j])){ pick=j; break; } }
    if(pick<0) pick=i+1; out.push(path[pick]); i=pick; }
  return out; }
if(OPTS.toNet){
  const sx=OPTS.srcX, sy=OPTS.srcY; let best=-1,bd=Infinity;
  for(let i=0;i<NF;i++){ if(!W1[i]&&!W2[i]) continue; const cy=(i/W4)|0, cx=i-cy*W4; const x=cx*S+2, y=cy*S-3760+2;
    if(Math.hypot(x-sx,y-sy)<70) continue;
    if(W1[i] && dist[i]<bd){ bd=dist[i]; best=i; }
    if(W2[i] && dist[NF+i]<bd){ bd=dist[NF+i]; best=NF+i; } }
  if(best<0||bd===Infinity) return JSON.stringify({net:NET, mode:'toNet', ok:false, why:'nopath'});
  const path=[]; let cur=best,g=0; while(cur>=0&&g++<40000){ path.push(cur); cur=prev[cur]; }
  path.reverse();
  const sp0=path.map(s=>[(s%NF)%W4*S+2, Math.floor((s%NF)/W4)*S-3760+2, (s>=NF?2:1)]);
  const sp=simplify(sp0);
  let nL=0,nV=0;
  if(OPTS.apply){ for(let k=0;k<sp.length-1;k++){ const a=sp[k],b=sp[k+1];
      if(a[2]!==b[2]){ try{ await eda.pcb_PrimitiveVia.create(NET, a[0],a[1], 12,20,0, undefined,0,false); nV++; }catch(e){} continue; }
      if(a[0]===b[0]&&a[1]===b[1])continue;
      try{ await eda.pcb_PrimitiveLine.create(NET, a[2], a[0],a[1],b[0],b[1], 6, false); nL++; }catch(e){} }
    await eda.pcb_Document.save(); }
  return JSON.stringify({net:NET, mode:'toNet', nL, nV, segs:sp.length-1, sp:sp.map(p=>[Math.round(p[0]),Math.round(p[1]),p[2]])});
}
if(OPTS.toX!==undefined && OPTS.toY!==undefined){
  const c0=cellOf(OPTS.toX,OPTS.toY); let best=-1,bd=Infinity;
  for(const c of [c0, NF+c0]){ if(c>=0 && dist[c]<bd){ bd=dist[c]; best=c; } }
  if(best<0||bd===Infinity) return JSON.stringify({net:NET, mode:'toXY', ok:false, why:'nopath'});
  const path=[]; let cur=best,g=0; while(cur>=0&&g++<40000){ path.push(cur); cur=prev[cur]; }
  path.reverse();
  const sp0=path.map(s=>[(s%NF)%W4*S+2, Math.floor((s%NF)/W4)*S-3760+2, (s>=NF?2:1)]);
  if(sp0.length>1 && Math.hypot(sp0[0][0]-OPTS.toX, sp0[0][1]-OPTS.toY) > Math.hypot(sp0[sp0.length-1][0]-OPTS.toX, sp0[sp0.length-1][1]-OPTS.toY)) sp0.reverse();
  const sp=simplify(sp0);
  let nL=0,nV=0;
  if(OPTS.apply){ for(let k=0;k<sp.length-1;k++){ const a=sp[k],b=sp[k+1];
      if(a[2]!==b[2]){ try{ await eda.pcb_PrimitiveVia.create(NET, a[0],a[1], 12,20,0, undefined,0,false); nV++; }catch(e){} continue; }
      if(a[0]===b[0]&&a[1]===b[1])continue;
      try{ await eda.pcb_PrimitiveLine.create(NET, a[2], a[0],a[1],b[0],b[1], 6, false); nL++; }catch(e){} } 
    await eda.pcb_Document.save(); }
  return JSON.stringify({net:NET, mode:'toXY', nL, nV, segs:sp.length-1, sp:sp.map(p=>[Math.round(p[0]),Math.round(p[1]),p[2]])});
}
const res=[]; let nL=0,nV=0;
let onlyList=[]; if(OPTS.onlyNearest){ let bi=-1,bd=1e12;
  for(let pi=0;pi<pads.length;pi++){ if(pi===SRC) continue; for(const c of padSeeds(pads[pi])){ if(dist[c]<bd){ bd=dist[c]; bi=pi; } } }
  if(bi>=0) onlyList=[bi]; }
const targets = OPTS.onlyNearest ? onlyList : pads.map((_,i)=>i).filter(i=>i!==SRC);
for(const pi of targets){
  const tg=padSeeds(pads[pi]); let best=-1,bd=Infinity;
  for(const c of tg){ if(dist[c]<bd){ bd=dist[c]; best=c; } }
  if(best<0||bd===Infinity){ res.push({pad:pi, ok:false}); continue; }
  const path=[]; let cur=best, g=0; while(cur>=0&&g++<40000){ path.push(cur); cur=prev[cur]; }
  path.reverse();
  const pts=path.map(s=>({ lay:(s>=NF?2:1), x:(s%NF)%W4*S+2, y:Math.floor((s%NF)/W4)*S-3760+2 }));
  const sp=simplify(pts.map(p=>[p.x,p.y,p.lay]));
  if(OPTS.apply){ for(let k=0;k<sp.length-1;k++){ const a=sp[k],b=sp[k+1];
      if(a[2]!==b[2]){ try{ await eda.pcb_PrimitiveVia.create(NET, a[0],a[1], 12,20,0, undefined,0,false); nV++; }catch(e){} continue; }
      if(a[0]===b[0]&&a[1]===b[1])continue;
      try{ await eda.pcb_PrimitiveLine.create(NET, a[2], a[0],a[1],b[0],b[1], 6, false); nL++; }catch(e){} } }
  res.push({pad:pi, ok:true, dist:Math.round(bd), segs:sp.length-1, pts:sp.map(p=>[Math.round(p[0]),Math.round(p[1]),p[2]])});
}
if(OPTS.apply) await eda.pcb_Document.save();
return JSON.stringify({net:NET, pads:pads.length, nL, nV, res});
