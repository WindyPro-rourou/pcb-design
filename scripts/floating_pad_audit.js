// 空网络焊盘审计：net==='' 的焊盘在按网络过滤的自检里等于不存在，但实物上是铜。
// 两个不同网络的线压到同一个空网络焊盘 = 真短路，而 net_check（skip GND）会报 0 短路。
// 用法：eda_exec({code: 'const __OPTS__={"minGap":6};\n' + 本文件})
const OPTS = __OPTS__ || {};
const MINGAP = OPTS.minGap || 6;
const P = await eda.pcb_PrimitivePad.getAll();
const L = await eda.pcb_PrimitiveLine.getAll();
const V = await eda.pcb_PrimitiveVia.getAll();
const pads = P.map(p=>({id:p.getState_PrimitiveId(), num:p.getState_PadNumber(), net:p.getState_Net(), x:p.getState_X(), y:p.getState_Y(), s:p.getState_Pad(), layer:p.getState_Layer(), rot:p.getState_Rotation()}));
const lines = L.map(l=>({id:l.getState_PrimitiveId(), net:l.getState_Net(), layer:l.getState_Layer(), a:[l.getState_StartX(),l.getState_StartY()], b:[l.getState_EndX(),l.getState_EndY()], w:l.getState_LineWidth()}));
const vias = V.map(v=>({id:v.getState_PrimitiveId(), net:v.getState_Net(), x:v.getState_X(), y:v.getState_Y()}));
function dims(p){ const s=p.s||['RECT',20,20,0]; return {kind:s[0], w:s[1]/2, h:s[2]/2}; }
function dPadPt(p,x,y){ const g=dims(p); if(g.kind==='ELLIPSE') return Math.max(0, Math.hypot(x-p.x,y-p.y)-Math.max(g.w,g.h));
  let w=g.w,h=g.h; if(Math.round(p.rot||0)%180===90){ const t=w;w=h;h=t; }
  const dx=Math.max(Math.max(p.x-w-x,0), x-(p.x+w)), dy=Math.max(Math.max(p.y-h-y,0), y-(p.y+h)); return Math.hypot(dx,dy); }
function dPadSeg(p,a,b){ const n=40; let m=1e9; for(let i=0;i<=n;i++){ const t=i/n; m=Math.min(m, dPadPt(p, a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)); } return m; }
const floating = pads.filter(p=>!p.net);
const bad = [];
for (const p of floating) {
  for (const l of lines) { if (l.layer!==1 && l.layer!==2 && l.layer!==12) continue; if (p.layer!==12 && l.layer!==p.layer) continue;
    const d = dPadSeg(p, l.a, l.b) - (l.w||6)/2; if (d < MINGAP) bad.push({pad:p.id, num:p.num, at:[Math.round(p.x),Math.round(p.y)], line:l.id, net:l.net, gap:Math.round(d*10)/10}); }
  for (const v of vias) { const d = dPadPt(p, v.x, v.y) - 10; if (d < MINGAP) bad.push({pad:p.id, num:p.num, at:[Math.round(p.x),Math.round(p.y)], via:v.id, net:v.net, gap:Math.round(d*10)/10}); }
}
return JSON.stringify({floatingPads: floating.length, violations: bad.length, bad: bad.slice(0, 40)});
