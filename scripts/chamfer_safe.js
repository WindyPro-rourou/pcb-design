
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
function clearSeg(net, lay, x1,y1,x2,y2, hw, skip1, skip2){
  const n=Math.max(1,Math.ceil(Math.hypot(x2-x1,y2-y1)));
  for(let k=0;k<=n;k++){ const t=k/n; const x=x1+(x2-x1)*t, y=y1+(y2-y1)*t;
    for(const p of P){ if(p.net===net) continue; if(p.layer!==12 && p.layer!==lay) continue; if(dPadPt(padGeom(p),x,y) < hw+6) return false; }
    for(const l of L){ if(l.net===net||l.layer!==lay) continue; if(l.primitiveId===skip1||l.primitiveId===skip2) continue;
      if(ptSeg(x,y,l.startX,l.startY,l.endX,l.endY) < hw+(l.lineWidth||6)/2+6) return false; }
    for(const v of V){ if(v.net===net) continue; if(Math.hypot(x-v.x,y-v.y) < hw+v.diameter/2+6) return false; } }
  return true; }
const byNet=new Map();
for(const l of L){ if(!l.net) continue; const k=l.net+'|'+l.layer; if(!byNet.has(k)) byNet.set(k,[]); byNet.get(k).push(l); }
const joints=[];
for(const [k,arr] of byNet){ const pts=new Map(); const key=(x,y)=>Math.round(x*2)+','+Math.round(y*2);
  for(const l of arr){ for(const [x,y] of [[l.startX,l.startY],[l.endX,l.endY]]){ const kk=key(x,y); if(!pts.has(kk)) pts.set(kk,[]); pts.get(kk).push(l); } }
  for(const [kk,ls] of pts){ if(ls.length!==2) continue; const A=ls[0],B=ls[1]; if(A.primitiveId===B.primitiveId) continue;
    const jx=+kk.split(',')[0]/2, jy=+kk.split(',')[1]/2;
    function away(l){ const dx=l.endX-l.startX, dy=l.endY-l.startY, n=Math.hypot(dx,dy)||1;
      if(Math.hypot(l.startX-jx,l.startY-jy)<0.6) return [dx/n,dy/n]; return [-dx/n,-dy/n]; }
    const a1=away(A), a2=away(B);
    const ang=Math.acos(Math.max(-1,Math.min(1,a1[0]*a2[0]+a1[1]*a2[1])))*180/Math.PI;
    if(ang>75&&ang<105) joints.push({jx,jy,A,B,a1,a2}); } }
let done=0, skip=0, blocked=0;
for(const j of joints){
  const {jx,jy,A,B,a1,a2}=j;
  const lenA=Math.hypot(A.endX-A.startX,A.endY-A.startY), lenB=Math.hypot(B.endX-B.startX,B.endY-B.startY);
  const d=Math.min(14, lenA*0.35, lenB*0.35);
  if(d<4){ skip++; continue; }
  const hw=(A.lineWidth||6)/2;
  const Ax=jx+a1[0]*d, Ay=jy+a1[1]*d, Bx=jx+a2[0]*d, By=jy+a2[1]*d;
  if(!clearSeg(A.net, A.layer, Ax,Ay,Bx,By, hw, A.primitiveId, B.primitiveId)){ blocked++; continue; }
  const PA=[Math.hypot(A.startX-jx,A.startY-jy)<0.6?A.endX:A.startX, Math.hypot(A.startX-jx,A.startY-jy)<0.6?A.endY:A.startY];
  const PB=[Math.hypot(B.startX-jx,B.startY-jy)<0.6?B.endX:B.startX, Math.hypot(B.startX-jx,B.startY-jy)<0.6?B.endY:B.startY];
  await eda.pcb_PrimitiveLine.delete([A.primitiveId,B.primitiveId]);
  await eda.pcb_PrimitiveLine.create(A.net, A.layer, PA[0],PA[1], Ax,Ay, hw*2, false);
  await eda.pcb_PrimitiveLine.create(A.net, A.layer, Ax,Ay, Bx,By, hw*2, false);
  await eda.pcb_PrimitiveLine.create(A.net, A.layer, Bx,By, PB[0],PB[1], hw*2, false);
  done++;
}
await eda.pcb_Document.save();
return JSON.stringify({joints: joints.length, chamfered: done, tooShort: skip, blocked});
