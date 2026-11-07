# 嘉立创EDA Pro 深度布线：转向罚分/连通自检/铺铜/DRC归零（深度布线经验）

# 嘉立创 EDA Pro 深度布线与验收

这套东西来自一块真实双层板的完整交付（一块 ESP32-S3 双层板，100×95mm，54 器件，44 网络，
约 900 段走线 / 280 过孔 / 4 块铺铜）。所有数字都是实测，不是估计。

## 何时用这份技能

- 自动布线跑完了，但走线是「阶梯」、有悬空短线、同网络多股平行 —— 要修成像人画的。
- 用户说「检查飞线」「不要直角」「高频干扰」「优化走线」。
- DRC 跑不完（有铺铜时），但必须证明板子是通的。
- 打样前要做一次全量检测。

## 0. 一分钟速查（先记住这几条，能省掉几天）

1. **铺铜填充过期是「DRC 上千条错误」的头号原因**。症状：几乎全是 `Copper Region(Filled) to Track/Pad/Via/Hole`，`minDistance` 恒为 0。修法：对每块铺铜 `rebuildCopperRegion()`，再跑一次 DRC —— 我实测 **1267 → 20，一步**。
   **反过来也成立**：DRC 跑 5 分钟甚至 300s 超时，几乎一定是填充过期（填充越"错"越慢）；填充刷新后同一块板 DRC 只要 **5 秒**，可以直接当 oracle 用。**每次改铜 → 重铺 → 再 DRC。**
2. **无网络焊盘（`net === ''`）是最阴的盲区**：按网络过滤的自检脚本（`net_check` 的 `if(!net) continue`、审计、间距路由掩膜）都会把它当成不存在，可它实物上是铜。两个不同网络的线压到同一个空网络焊盘 = **真短路，但所有自检都报 0 短路**。→ 必须单独跑「空网络焊盘审计」：33 个空焊盘 × 全部铜，间距必须 ≥6 mil。
3. **铺铜填充坐标是「mil / 10」**（读到 392 就是 3920 mil）。判断方法：取所有填充点 bbox，板宽 ÷ bbox 宽 ≈ 10 就是它。**过期填充的 bbox 会明显小于板框**（例如只有右下角 10mm），这是最快的判别法。
4. **只看「未布线」计数器会被骗**：它不把铺铜连通算进去，而且刷新滞后。自己算。
5. **过孔放置必须单独做可行性检查**：走线的间距掩膜约束不了过孔环（半径 10），这是「线擦过孔」短路的根因。
6. **转向罚分**是把「机器画的」变成「人画的」的唯一有效手段。步长代价 10，转向罚 140，过孔罚 7000。
7. 每改一次板子都要**立刻验证连通**；删过孔/删线经常打断必经路径。
8. `pcb_*` API 在 PCB **不是当前活动文档**时返回 null 或抛 `Cannot read properties of null (reading 'map')` → 先 `openDocument(pcbUuid)`。
9. **路由器失败会先把该网络的铜全删掉**（它先删后布），失败就留一条断网。→ 跑之前确认 `pads.length>0`，跑完**必须**看返回值的 `failed`/`connPads`，不为 0 就立刻补。
10. **路由成功≠EasyEDA 认为连通**：A* 终点落在焊盘内的过孔上时，DRC 仍报 `Connection Error`。→ 布完给每个端点补一段**显式落进焊盘中心**的短线（10~25 mil）。
11. 删除操作前先备份：`eda_export` 每次都建时间戳目录，天然是回滚点。

## 1. 连接与环境

桌面版走内置 MCP HTTP：

```powershell
# 必须以 --mcp http --port <port> 启动，否则只有插件面板没有 API
& '<嘉立创EDA安装目录>\lceda-pro.exe' --mcp http --port 49631
```

- 健康检查：`eda_status` → `ready/connected/health(mcp:4.1.78.xxxx sessions:N)`
- 卡死恢复：`Stop-Process -Name lceda-pro -Force` 后重启，然后
  `dmt_Project.openProject(<projectUuid>)` → `dmt_EditorControl.openDocument(<pcbUuid>)`
- 长操作（自动布线、大导出、慢 create）走 `eda_task`：`submit` 拿 taskId，`get` 轮询；
  **硬上限 300s**，超时即 failed。

## 2. 单位与坐标系（最容易翻车的地方）

| 对象 | 单位 | 说明 |
|---|---|---|
| 板框/焊盘/走线/过孔 | **mil** | 例：100mm 板 = 3937 mil |
| Y 轴 | **负值往下** | 设计坐标 Y = data_y + 3740（板高） |
| 铺铜填充多边形 | **mil × 10** | 读出来要 `×10` 才是 mil |
| 板框区域 Region | mil | `layer: 11` |

铺铜填充的 `complexPolygon` 编码（务必按这个解析，否则形状全错）：

```js
// 数组里混着数字与 'L'/'ARC' 记号
// 首点是两个数字；之后 'L' 表示直线到(下一个x,下一个y)；
// 'ARC' 后面跟 3 个数：(角度, 终点x, 终点y) —— 终点是第 2、3 个
function parseRing(ring){
  const pts=[]; let i=0;
  if(typeof ring[0]==='number'){ pts.push([ring[0]*10, ring[1]*10]); i=2; }
  while(i<ring.length){
    const t=ring[i];
    if(t==='L'){ pts.push([ring[i+1]*10, ring[i+2]*10]); i+=3; }
    else if(t==='ARC'){ pts.push([ring[i+2]*10, ring[i+3]*10]); i+=4; }
    else { pts.push([ring[i]*10, ring[i+1]*10]); i+=2; }
  }
  return pts;
}
```

## 3. 官方 API：签名与坑

### 2.1 图元创建（顺序参数错一个就「无法创建」）

```js
// 多边形（板框/铜区轮廓）：注意 net 在最前面
pcb_PrimitivePolyline.create(net, layer, polygon, lineWidth, lock)
// 铺铜：create 完必须 rebuildCopperRegion()，否则 DRC 会说没连上
const pour = await pcb_PrimitivePour.create('GND', 1, ['R',x,y,w,h,0,0],
                  'solid', /*preserveSilos*/ false, 'GND_TOP', /*priority*/2, 0.2, false);
await pour.rebuildCopperRegion();
// 走线 / 过孔 / 丝印文字
pcb_PrimitiveLine.create(net, layer, x1,y1,x2,y2, width, lock)
pcb_PrimitiveVia.create(net, x, y, holeDia, outerDia, viaType, undefined, 0, false)
pcb_PrimitiveString.create(layer, x, y, text, 'default', fontSize, lineWidth,
                           3 /*alignMode*/, 0, false, 0, false, false)
```

- **丝印字体必须传 `'default'`**，传 `SimHei`/`Arial` 会报「无法创建文本图元」。中文在 default 下不一定有字形，重要信息用拉丁字母兜底。
- **过孔外径 ≥ 19.7 mil**（嘉立创 min via diameter），我统一 20 mil 环 / 12 mil 孔。
- `pcb_PrimitivePad.delete([ids])` 对非焊盘 id **静默 no-op**。
- `getPrimitivesInRegion` 只返回 `Line/Component/Via/Region`，**不含 Pad/Pour**。

### 2.2 设计规则

```js
const cur = await eda.pcb_Drc.getCurrentRuleConfiguration();  // {config, name}
const cfg = cur.config;
const sp = cfg.Spacing['Safe Spacing']['copperThickness1oz'].tables['1'];
sp.content[7] = [0.1524, ...];           // 第 7 行 = Copper/Plane Zone 间距
await eda.pcb_Drc.overwriteCurrentRuleConfiguration(cfg);   // 传 cfg，不是 cur！
```

- `overwriteCurrentRuleConfiguration` 传外层对象会**静默失败返回 null**，必须传 `.config`。
- 把 Copper/Plane Zone 从 0.254mm 降到 0.1524mm（6 mil），铺铜会多钻出很多缝隙（连通域会明显减少）。
- **注意**：星火计划免费打样**不支持过孔塞油/塞树脂**（6 层以上才可选），所以焊盘内过孔要么挪走、要么手工补焊。

### 2.3 原理图侧（会踩到的两个）

- **导线本身不定义网络**，必须有网络标志：`sch_PrimitiveComponent.createNetFlag('Power'|'Ground', 名称, x, y, rot, mirror)`。`createNetPort` 会抛「数据不符合规范」。
- **图框**是 `componentType:'sheet'` 的器件，内置 uuid：
  A4 `bc676184ec9748d7b372ad543982403a`、A2 `6fd7efafc49e4f3896f12123eeccfba2`、
  A3 `0c5d0e47f9f04f14b0906112873b8a58`、A1 `510b08ce35694f9b887aceb56517bf87`。
  若 `component.uuid` 被写成字符串名字（如 `'Drawing-Symbol_A4'`）而 `symbol.uuid` 是另一个，
  DRC 会刷几千条「元件的 符号 属性有误」。修复 = 删掉重放一个内部一致的。
  在 240+ 图元的页面上 create 一个 sheet 器件要 30s+，**用 eda_task**。

## 4. 让 DRC 变得可用，再用它

### 4.0 第一步永远是「重铺铺铜」（`rebuildCopperRegion`）

```js
const ids = await eda.pcb_PrimitivePour.getAllPrimitiveId();
for (const id of ids) {
  const p = (await eda.pcb_PrimitivePour.get([id]))[0];
  await p.rebuildCopperRegion();          // 返回 IPCB_PrimitivePoured | undefined
}
const d = await eda.pcb_Drc.check(true, false, true);  // 详细模式，返回分组数组
```

- 返回 `undefined` 的那块铺铜**没有填充**（多边形退化时会出现）：DRC 反而**不报它**，
  所以「没报错 ≠ 没问题」，要单独确认每块 pour 都拿得到 fill。
- 改完要 `await eda.pcb_Document.save()`，否则下次打开又回到旧填充。
- **每次改铜（加线/删线/改过孔/移元件）都会让填充过期**，正确循环是：
  **改铜 → rebuildCopperRegion → DRC → 改下一处**。跳过重铺，看到的就是上千条假错误。

**判别「假错误 vs 真缺陷」：**

| 观察 | 结论 |
|---|---|
| 几乎全是 `Copper Region(Filled) to …`，且 `errData.minDistance === 0` | 填充过期（假） |
| 出现具体 `SMD Pad to Track` / `Track to Via` / `Hole to Hole`，且 `minDistance` 有小数 | 真缺陷，逐条修 |
| `minDistance` 单位是 **10 mil**（0.1887 → 1.9 mil） | 换算别搞错 |

### 4.1 DRC 的三个入口

| 调用 | 用途 |
|---|---|
| `pcb_Drc.check(true,false,true)` | 返回分组数组 `[{name, list:[{name, list:[item]}]}]`，item 内有 `objs`（真图元 id）、`errData`、`pos`、`explanation` |
| `pcb_Drc.check(true,false,false)` | 只回 boolean，快 |
| `eda_task` 提交上面的代码 | 长检查走后台，绕开 MCP 60s 预算 |

`objs` 才是图元 id；`obj1.suffix` 只是给人看的标签（形如 `(NET): e869`），**别拿 suffix 当 id**。
填充为最新时 DRC 只要 **5 秒**（这块板 925 段走线 / 277 过孔），完全可以进迭代循环。

### 4.2 自写引擎（需要精确定量时）

**不要**用「未布线」计数器下结论。两套自写引擎，互相独立：

### 4.3 非 GND 网络：并查集 + 精确几何（`scripts/net_check.js`）

- 图元：焊盘（RECT/ELLIPSE/OVAL 胶囊）、走线（胶囊）、过孔（圆），按层过滤，过孔跨层。
- 两个图元「相连」= 最小距离 ≤ 0（**容差必须为 0**；容差 0.3 会把 0.3 mil 的假接触算成连通，后面删线就断）。
- 输出：每个网络里所有焊盘是否同属一个连通域；以及**孤儿铜**（不含焊盘的铜岛）。

```
把 scripts/net_check.js 内容里的 __OPTS__ 换成 {"skip":["GND"]}，交给 eda_exec。
期望输出 {"broken":[]}
```

### 4.4 GND：1 mil 栅格化 + 洪泛（`scripts/gnd_solver.js`）

- 把所有 GND 铜（含 4 块铺铜的填充多边形，坐标 ×10）栅格化到 1 mil 网格，8 邻域连通。
- 通过过孔把上下层连起来（DSU）。
- 输出连通域数量、每个域里的焊盘、**孤儿**（不含焊盘的铜）。

```
__OPTS__ = {"mode":"diagnose"}   → 期望 {"n":1,...}
__OPTS__ = {"mode":"orphans"}    → 期望 orphanLines=0, orphanVias=0
```

**判据**：非 GND 全部 1 域 + GND 61/61 同域 + 两类孤儿都为 0，才算「飞线清零」。
EasyEDA 面板上仍可能显示「未布线 N」——那是它不把铺铜连通计入，可以向用户解释并让对方点一次「飞线→重新计算」核对。

## 5. 布线：转向罚分路由器（`scripts/smart_route.js`）

**这是把阶梯变成人画的关键**。普通 A* 只会找最短路，出来是楼梯；加上转向罚分和过孔罚分，
它会优先「一条直线 + 一次 45° 让位」。

### 5.1 参数（实测好用的值）

| 参数 | 值 | 作用 |
|---|---|---|
| 栅格 G | 10 mil | 10 mil 栅格出来的线天然对齐，像人画的 |
| 步长代价 | 10（轴向）/ 14（对角） | 常规 |
| **转向罚分** | **140** | 比走 14 步弯路还贵 → 宁可绕远也不频繁拐弯 |
| **过孔罚分** | **7000** | 换层极贵 → 一条网络通常只换 0~2 次层 |
| 障碍掩膜 maskPad | 16 mil | 到**焊盘边缘**的距离（10 mil 栅格下量化误差 ~5，保证实际 ≥6） |
| maskLine | 18 mil | 到**走线中线的距离**（减去双方半宽仍然 ≥6） |
| maskVia | 24 mil | 到**过孔中心**的距离 |

### 5.2 必须补的「过孔可行性」检查（血泪）

走线的掩膜只能保证**路径单元格**离别的铜够远，但过孔有 10 mil 半径。
不加这层检查，就会出现「线擦过孔 -5.9 mil」的短路。

```js
function viaAllowed(cell){              // 带缓存
  const x=..., y=...; const R=10;       // 过孔半径
  for(pad of 其它网络焊盘) if(dPadPt(pad,x,y) < R+6) return false;
  for(line of 其它网络走线) if(ptSeg(x,y,line) < R+halfWidth+6) return false;
  for(via of 其它网络过孔) if(dist < R+viaR+8) return false;
  return true;                          // 只有 true 才允许换层
}
```

### 5.3 多焊盘网络：增量连接，不要「从 pad0 星形发散」

从 pad0 连到每个 pad 会让两段路径重叠（又变回「同网络多股平行」）。
正确做法：**先连 pad0 → 最近的 pad；之后每个 pad 连到「已有的任意网络铜」**，
每连一条就把它的几何加进 goal 掩膜。

### 5.4 太挤导致找不到路怎么办

按这个顺序放宽，每档都要重新验证间距：

```
maskPad 16 / maskLine 18 / maskVia 24   ← 默认
maskPad 12 / maskLine 13 / maskVia 19   ← 一般够
maskPad 10 / maskLine 11 / maskVia 16   ← 极限（U1 55mil 引脚扇出、USB-C 0.5mm 间距）
```

**关键几何事实**：55 mil 间距、39 mil 宽度的引脚排，两脚之间只剩 16 mil 净空，
6 mil 线要 6+6+6=18 mil 才过得去 → **这种焊盘只能垂直逃逸，不能从两脚之间穿**。
所以 maskPad 一旦 ≥16，焊盘的垂直逃逸通道（y 方向 ±(h/2+16)）会把整个焊盘围死，
Dijkstra 直接从起点就没有可走的邻居 → 表现为「1.8 秒就失败」。**maskPad ≤ 12 才有逃逸口。**

### 5.5 失败模式：它会先把网络删光

`smart_route` 的第一件事是**删掉该网络的全部铜再重布**。所以：

- 失败（`failed>0`）时网络就**断在那儿**，而且脚本末尾通常会 `save()` → 断网被存盘。
- 若 A* 只是「迭代次数用完」（我在 150 万次上限处见过，35 秒后 `failed:1, madeSegs:0`），
  把上限调到 800 万次通常就能过：`it<(OPTS.iters||8000000)`。仓库里的 `smart_route2.js` 就是这个变体。
- **跑完必须看返回值**：`connPads === pads.length && failed === 0` 才算成功；
  立刻 `rebuildCopperRegion()` + `pcb_Drc.check` 复核，别接着做下一件事。
- 网络重建后**给每个端点补一段显式短线落进焊盘中心**（10~25 mil）。
  终点停在焊盘内的过孔上时，几何上明明是通的，EasyEDA 仍会报 `Connection Error`。

## 6. 分块工作流（一次只碰一块）

1. 按物理区域/功能把网络分组：屏/SPI → 按键旋钮 → 电源充电 → 音频/I2C/USB → 主电源 → GND。
2. 每块内逐条网络跑 `smart_route`（它自己会先删掉该网络旧铜再重布）。
3. 每块跑完立刻 `net_check` + `gnd diagnose`，断了的立刻修，别攒着。
4. 全部跑完再做「阶梯合并 → 倒角 → 去重过孔 → 最终审计」。
5. **每次大改之后重新导出 Gerber**（我吃过「文档里写 191,954 B，磁盘上还是旧文件」的亏）。

## 7. 清理操作：顺序和验证要求

| 操作 | 工具 | 必须验证什么 |
|---|---|---|
| 删冗余回路（非桥边） | `route_cleanup2.js` | 删完所有图元仍连通（容差 0） |
| 合并共线相邻段 | 内联脚本 | 几何完全等价，断不了 |
| 阶梯合并（改成 45°+直线） | `route_simplify2.js` | 新段间距 ≥6；只在地标点之间做 |
| 倒角 90° | `chamfer_safe.js` | **新 45° 段必须做间距检查**（早期版本没查，捅出十几个短路） |
| 去重过孔 | 内联脚本 | 同坐标/近坐标的重复孔，删一个 |
| 挪焊盘内过孔 | 内联脚本 | ⚠️ **必须验证另一层侧仍接触同网络铜**，否则一挪就断 |

**删线优先级**：想保留「直的一根」就**先删最短的**（阶梯碎片）；想保留「短捷路径」就**先删最长的**（绕远的那股）。选错方向会把好线删掉。

## 8. 制造检查（嘉立创免费/标准工艺）

| 项 | 阈值 | 我的做法 |
|---|---|---|
| 线宽/间距 | ≥ 5/5 mil（

最小 3.5 mil 能力） | 设计规则 6 mil，实测最小 6.2 |
| 过孔 | 外径 ≥19.7 mil，孔 ≥0.3mm | 20/12 mil |
| 孔间距 | 中心距 ≥ 0.5mm | 实测最小边距 10.1 mil |
| 板子尺寸 | ≤100×100mm 免费档 | 100.0×95.0 |
| 层数/板厚 | 2 层 / 1.6mm | ✓ |
| **过孔塞油** | 免费档**不支持** | 焊盘内过孔必须挪走或手焊 |

审计脚本会算：线-线 / 线-焊盘 / 线-过孔最小间距、孔-孔边距、**焊盘内孔数**、亚 4 mil 对数。

## 9. 全量检测清单（交付前跑一遍）

```
[PCB] 0 铺铜填充是否最新（4 块 pour 全部 rebuild 后才能跑下面的）期望 每块都有 fill
[PCB] 1 短路（线-线/线-盘/线-孔）          期望 0
[PCB] 1b 空网络焊盘审计                     期望 0 处 <6 mil
[PCB] 1c EasyEDA DRC（详细模式）            期望 只剩 Netlist 同步提示
[PCB] 2 线-线最小间距                       期望 ≥6 mil
[PCB] 3 线-焊盘最小间距                     期望 ≥6 mil
[PCB] 4 线-过孔最小间距                     期望 ≥4 mil
[PCB] 5 亚 4 mil 间距对数                   期望 0
[PCB] 6 孔-孔边距 / 冲突数                  期望 ≥8 mil / 0
[PCB] 7 焊盘内孔数                          期望 0（或明确记录）
[PCB] 8 非 GND 网络连通                     43/43
[PCB] 9 GND 连通                            61/61 同一域
[PCB]10 孤儿铜（含 GND）                    0
[PCB]11 天线预留带内走线                    0
[PCB]12 90° 折角                            只允许短腿出线折角
[其他]13 外壳干涉自检                       45 项 0 干涉
[其他]14 固件测试                           7/7 套
[其他]15 跨图纸一致性                        26 项 0 FAIL
[其他]16 Gerber 条目 / BOM 行数 / 交付文件数 逐项核对
```

本项目的实测终值（可作基准）：
`0 短路 / 线-线 8.1 mil / 线-盘 6.2 mil / 线-孔 5.4 mil / 亚 4 mil 0 对 /
孔冲突 0 / 43 网络全通 / GND 61 同域 / 孤儿 0 / 天线带 0 / 90° 折角 15（全短腿）/
925 段 / 277 过孔 / 187,700 mil 总长
（2026-11-03 重铺+修 5 处短路后：DRC 只剩 1 条网表同步提示；
 Gerber 181,140 B / 16 条目；33 个空网络焊盘全部 ≥6 mil；90° 折角 20 → 13（全短腿））`

## 10. 脚本清单

| 脚本 | 作用 | 调用方式 |
|---|---|---|
| `net_check.js` | 非 GND 网络连通 + 孤儿铜 | `__OPTS__={"skip":["GND"]}` |
| `gnd_solver.js` | GND 栅格连通/孤儿/补线/出图 | `{"mode":"diagnose"\|"orphans"\|"route"\|"map"}` |
| `board_audit.js` | 孤儿、90° 折角、天线带、焊盘分类 | `__OPTS__={}` |
| `smart_route.js` | 转向罚分路由器（主力） | `{"net":"SPI_MOSI","grid":10,"turn":140,"viaCost":7000,"maskPad":16}` |
| `smart_route2.js` | 同上，迭代上限 150 万→800 万，去掉自动 save，返回 `iters` | 同上，可加 `"iters":8000000` |
| `floating_pad_audit.js` | **空网络焊盘审计**（33 个空焊盘 × 全部铜，<6 mil 就报）| `__OPTS__={}` |
| `net_router.js` | 4mil 栅格老路由器（兜底，含 toNet/toXY 模式） | `{"net":"X","srcIdx":0,"apply":true}` |
| `route_simplify2.js` | 阶梯合并 | `{"budget":50000,"maxops":120}` |
| `chamfer_safe.js` | 90° 倒角（带间距检查） | 无参数 |
| `net_repair.js` | 把孤立焊盘桥到最近同网络铜 | 无参数 |

所有脚本都是「交给 `eda_exec` 的一段 JS」，用 `__OPTS__` 占位符注入参数。

## 11. 血泪教训（19 条）

1. **DRC 不是 oracle —— 除非你先重铺**：填充过期时它又慢又假（5 分钟、上千条）；重铺后 5 秒、可信。顺序永远是「重铺 → DRC → 自写几何复核」。
1b. **每个端点都要显式落到焊盘里**：终点停在焊盘内的过孔上，EasyEDA 仍判 `Connection Error`。
2. **「未布线」计数器不可信**：不含铺铜、且滞后。
3. **删过孔会断网**：删之前先算它是不是必经路径；删完立刻验证。
4. **挪焊盘内过孔会断网**：新位置必须在另一层也碰到同网络铜。
5. **倒角不做间距检查 = 造假短路**：早期版本一次捅出 20 多处。
6. **容差不一致会「假达标」**：审计用 0.3、连通用 0，就会删掉真正需要的线。
7. **掩膜越宽越难布**：为了安全把 maskPad 加到 24，55mil 引脚排直接无路可走。
8. **过孔要单独判**：走线掩膜管不了过孔环。
9. **多焊盘网络别星形发散**：会重新制造「同网络多股平行」。
10. **每轮大改后重导 Gerber**：磁盘上的旧文件会骗你。
11. **先备份再动手**：`eda_export` 的时间戳目录就是回滚点。
12. **自动化的天花板要早点承认**：这块板我跑了 60+ 次重布，最后收敛靠的是「补上过孔可行性检查」这一个根因修复，而不是继续调参。
13. **铺铜过期会伪造上千条 DRC 错误，也会让 DRC 慢到 5 分钟**：同一块板，重铺后 1267 → 20，耗时 5 分钟 → 5 秒。先重铺，再谈 DRC。
14. **跳过 GND 的自检会漏掉 GND 短路**：`net_check` 用 `skip:["GND"]` 跑出来的「0 短路」不含 GND；GND 要单独用栅格洪泛验，并且要把「铺铜 to X 距离 0」当成短路看。
15. **无网络焊盘必须当成障碍物**：33 个空网络焊盘（轻触开关地侧、TF 座机械脚、咪头备用脚）在按网络过滤的脚本里等于不存在，结果两条信号线都压在同一个空焊盘上 → 互短。要么给焊盘补网络，要么把铜绕开，二选一，别忽略。
16. **老结论要重测**：这次重铺后发现，之前那句「GND 61/61 同域」是用**过镀（盖住信号铜）的旧填充**算出来的。结论没变（重铺后仍 61/61），但**方法本身是错的**——同一个数字，两个原因，必须换方法复核。
17. **DRC 面板里的 “Import Changes” 是「删了重建」，不是同步**（血案）：原理图里「PCB 上没有」的器件会被整批加进来（这次多了 47 个原型件），已有器件被打散成网格（旋转归 0、全翻到顶层），**227 个焊盘网络被打乱**（89 个错标 BOOST_OUT、32 个清空），堆叠飞线把 MCP 任务队列压死。**永远不要点它**；DRC 里那条 Netlist 提示忽略即可。
18. **恢复方法（可复用）**：① 器件回位用上一版 `Pick_Place` 坐标文件（mm×39.3701→mil，Mid X/Y 就是器件原点，rotation/layer 一并写回）；② 焊盘网络以**未受损的铜箔为唯一真值**逐焊盘几何反推——实测 194 个焊盘各自只接触唯一一个网络、0 歧义，另 33 个按设计留空；③ 重铺 + 保存 + 全量复验。
19. **「无网络焊盘」会藏真缺陷**：这次 DRC 报的两条连接性错误里，一条是电池负极限 BT1_2——它原本是空网络焊盘，所以 DRC **从来不检查它**，实际上电池负极悬空。给焊盘补上网络后才暴露并被修好（GND 焊盘 61→62）。所以「空网络焊盘」不只是制造短路的隐患，还会掩盖断路。


## 12. 可复用的提示词骨架

> 打开 PCB（先 openDocument）。跑 diagnose 看现在有几个 GND 域、几个孤儿。
> 对 <网络> 跑 smart_route（grid 10 / turn 140 / viaCost 7000），失败就降到 maskPad 12，
> 再降到 10。每块跑完立刻 net_check + gnd diagnose。
> 全通之后跑 board_audit：孤儿、90°、天线带都要 0。
> 然后 chamfer_safe，再跑一遍净空审计（期望 0 短路 / 亚 4mil 0 对）。
> 最后 eda_export 并把 export/final 与 deliver 同步，报告实测数字。