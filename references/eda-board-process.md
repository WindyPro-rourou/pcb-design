# 嘉立创EDA 双层板实战流程：布局/自动布线分批/GND/过孔/API坑（双层板实战经验）

# 嘉立创 EDA 双层板实战流程（双层板实战经验）

> 这份 skill 的全部结论都来自一次真实项目（54 元件、100×95mm 双层、一块 ESP32-S3 双层板），
> 每一步都用 DRC 与渲染截图验证过。**按这里的顺序做能少走 25 轮弯路。**

---

## 0. 铁律（先记住这五条）

1. **不要手写布线器。** 嘉立创 EDA 自带 `eda.pcb_Document.autoRouting()`，默认就是 45° 拐角。
   我曾从零手写并迭代 25+ 轮，DRC 一直停在"间距 1136 / 未布通 ~470"；换官方布线器后**间距直接降到个位数**。
2. **自动布线必须分批。** 单次硬上限 **900s，超时则中间结果全部回退**（实测一次交 48 个网络，
   它跑到 685 条走线后整个回退到 5 条）。**每批 3~5 个网络 + `existingPrimitiveMode:'keep'`** 才能逐批累积。
3. **元件必须摊开。** 堆在一角的布局怎么布都布不通，而且 DRC 会报一堆"焊盘对焊盘"错误 ——
   **那不是走线问题，是布局问题**。
4. **禁直角走线。** 直角会造成阻抗突变与蚀刻"酸角"；一律 45° 斜切。官方布线器默认即是，
   但**自己画的 GND 环是矩形 → 必须做成八角环**。
5. **先谋机械，再谋电气。** 板子要装进外壳：**安装孔、端口朝向、开关位置、屏幕遮挡范围**
   全都必须在画线之前定下来，否则画完发现装不进去 = 全部重来。

---

## 1. 布局：影响最大、最容易做错的一步

### 1.1 均衡分布，不要堆在角落
- 用**全板网格（6~7 列 × 6~7 行）+ 蛇形排布**放置可动件，让邻件相邻（保持功能簇）。
- 判据：按 x/y 分 5 带统计元件数，**任何一带为 0 就说明有空区**，继续摊。
- 固定件先排除（见 1.3）。

### 1.2 用 DRC 明细当布局靶点
DRC 里这几类错误**全是布局问题，挪元件即可，不要试图改走线**：
`SMD Pad to SMD Pad` / `SMD Pad to TH Pad` / `Hole to SMD Pad` / `Board Outline to SMD Pad`。
实测：把 8 个挤在固定件旁的可动件挪开后，**间距错误从 20 直接降到 3**。

### 1.3 哪些件绝对不能动
**外壳开孔决定的件**：屏幕排母、按键、旋钮、TF 卡座、USB 座、指示灯。
冲突时**挪可动件**（排母/电容/电阻/二极管），不要挪固定件。

### 1.4 端口朝向（最容易被忽略）
- **TF 卡座**：卡座长轴决定卡是沿哪个轴进出的。**必须让开口朝向机壳的 TF 槽所在侧壁**。
  实测：卡座放在右壁旁但 `rot=0` 时开口朝板内 → 卡插不出去 → `setState_Rotation(180)` 翻转。
  判断方法：读卡座触点焊盘相对中心的偏移方向，转动后复查触点是否翻到另一侧。
- **USB 座**：必须贴边壁，插头才能插进来。
- **拨动开关**：拨杆要能伸到侧壁开孔；**开关要放在板子"正面"那一层**（若外壳按正面开槽），
  放在背面则拨杆够不到。

### 1.5 安装孔
- 从**外壳脚本**读参数（例如 `mount_inset: 6.0`、`mount_hole_d: 2.7`），按内缩量在四角打孔。
- 用 `pcb_PrimitivePad.create()` 造非金属化孔（见 §5.6）。
- 孔的周围要**清空铜箔**。

### 1.6 屏幕遮挡 → 天线位置
屏幕模组会盖住板子的大部分。**先把屏幕的覆盖范围算出来**（模组尺寸 + 排母中心坐标），
天线必须落在**屏幕覆盖不到的条带**里，并且该区域禁铜。

---

## 2. 布线：用官方自动布线器

### 2.1 正确调用
```js
await eda.pcb_Document.clearRouting('all');          // 清空旧走线

await eda.pcb_Document.autoRouting({
  cornerStyle: 0,                  // EPCB_AutoRoutingCornerStyle.DEGREE_45 ✅ 45° 斜切
  existingPrimitiveMode: 'keep',   // 保留上一批（'remove' 会推倒重来）
  optimization: 1,                 // EPCB_AutoRoutingOptimization.COMPLETION 布通率优先
  RoutingNets: ['TF_CS','KEY_ENC_A','KEY_ENC_B']     // ← 每批 3~5 个网络
});
```

| 枚举 | 值 |
|---|---|
| `EPCB_AutoRoutingCornerStyle` | `DEGREE_45 = 0` / `DEGREE_90 = 1` |
| `EPCB_AutoRoutingExistingPrimitiveMode` | `KEEP = 'keep'` / `REMOVE = 'remove'` |
| `EPCB_AutoRoutingOptimization` | `FASTER = 0` / `COMPLETION = 1` |
| `clearRouting(type)` | `'all' \| 'net' \| 'connection'` |

另有 `autoLayout()`（BETA 自动布局，风险自担）。

### 2.2 顺序：先 GND，后信号
**先把 GND 环铺好，再让布线器布信号。** 我搞反过一次：先布信号再补 GND 环 →
环与信号线打架，**间距错误从 3 反弹到 84**，只能全部回退重来。

### 2.3 大网络单独处理
**63 脚的 GND 这种巨型单网络，官方布线器搞不定**（会留下几十个未布通）。
→ 用 §3 的环形地线方案单独做，并在 `RoutingNets` 里**排除 GND**。

### 2.4 几何检查
布完后统计：
- 斜线段数（`|dx|>1 && |dy|>1`）应当**占相当比例**；若几乎为 0，说明倒角没生效。
- 直角接头数：把每段端点按 5mil 量化聚簇，同簇内同网络、一横一竖的两段即为直角。
  **理想应接近 0**（与焊盘的垂直连接是 T 型而非拐角，不计）。

---

## 3. GND：环形地线，不要铺铜

- **铺铜是坑**：填充成功（`PrimitivePoured=2`）却一直报 **277 个 GND 未连通**；
  改线宽、改规则 `Copper Zone → connectMode`(0/1/2) **全部无效**。实测参考工程 `pours=0`、GND 全靠走线。
- **正解**：**双层环形地线**（沿板边内缩 200mil、线宽 30~40mil）+ **每层多源 BFS 就近支线**（12mil）。
- **环宽要够**：环窄了会出现"支线末端差几 mil 接不上"的**假未连通**。实测 ≥40mil 稳定。
- **环要做成八角形**：四个直角全部 45° 切角。
- 支线 BFS 的占用模型：见 §4。

---

## 4. 占用模型：三层分离（自己写 BFS 时必需）

| 数组 | 含义 |
|---|---|
| `ownerNet` | 精确焊盘格（只有本网络的焊盘格） |
| `clearNet` | 净空区（按网络归属；冲突记 -1） |
| `pathUse` | 已铺走线（本网络可走；他网禁入；-1 为禁布） |

坑：**净空区一刀切封锁 → 焊盘被自己的净空区困死**，BFS 永远进不了目标
（表现为大量"找不到路径"却明明有空间）。

---

## 5. 过孔与间距：把物理约束算清楚

### 5.1 过孔间距硬约束（推导）
过孔 Ø D_v（半径 r）+ 走线宽 w（半宽 w/2）→ 中心距 D 时**边缘间隙 = D − r − w/2**，
规则要求 **≥6mil（涉孔间距）**：

| 孔径 | 线宽 | 要求 D | 网格上的留空格数 |
|---|---|---|---|
| Ø20mil | 10mil | ≥21mil | 20mil 网格 → **2 格** |
| Ø20mil | 5mil | ≥18.5mil | 20mil 网格 → **1 格** |

**用 5mil 细线可以把可用过孔位提高 2.8 倍**。实测用错（±1 格配 10mil 线，间隙仅 5mil）
直接产生 **137 条 `Track to Via` 错误**，改对后降到 17。

### 5.2 焊盘净空别给大
贴片 **1 格 / 插件 2 格** 就满足 6mil 规则。给成 2 格会吃掉大量空间，
实测一次跑出 **936 次"过孔位被拒"**。

### 5.3 嘉立创工艺下限（实测自设计规则配置）
| 项目 | 值 |
|---|---|
| 线宽下限 | **5 mil** |
| 过孔外径下限 | **19.7 mil**（孔径下限 11.8 mil）|
| 线与线间距 | **4 mil** |
| 涉孔间距 | **6 mil** |

### 5.4 焊盘层号
`layer`：**1 = 顶层，2 = 底层，12 = MULTI（插件/通孔）**。

### 5.5 空区被切碎
空闲率 66~67% 看着很高，但**自由区可能碎成几十块**（实测底层碎成 27 块、最大仅占全板 25%）。
判据：泛洪统计自由区连通块数；块数多说明**全是窄通道**，一个过孔禁布区就能截断 —— 这时该回去改布局。

### 5.6 造安装孔（非金属化）
```js
await eda.pcb_PrimitivePad.create(
  12,                                  // layer: MULTI
  '',                                  // padNumber
  x, y, 0,
  ['ELLIPSE', dia, dia],               // pad 形状：['ELLIPSE'|'RECT'|'OVAL'|'NGON', w, h]
  '',                                  // net 留空
  ['ROUND', dia],                      // hole：['ROUND', d] 或 ['SLOT', d, len]
  0, 0, 0,
  false                                // metallization = false → NPTH
);
```
（`EPCB_PrimitivePadShapeType`: `ELLIPSE='ELLIPSE'` / `RECTANGLE='RECT'` / `OBLONG='OVAL'` / `REGULAR_POLYGON='NGON'`；
`EPCB_PrimitivePadHoleType`: `ROUND='ROUND'` / `SLOT='SLOT'` / `RECTANGLE='RECT'`）

---

## 6. EDA API 陷阱清单（全部实测踩过）

| 坑 | 正解 |
|---|---|
| 元件移动 API | **`setState_X(x)` / `setState_Y(y)`**，不是 `setPosition`（会报 not a function）|
| 元件旋转/换层 | `setState_Rotation(deg)` / `setState_Layer(1\|2)`，改完调 `await c.done()` |
| 读导线端点 | **`getState_Line()`**（扁数组 `[x1,y1,x2,y2]`），不是 `getState_Points`/`getState_StartX` |
| 网络名 | `getState_Net()`（导线/焊盘/过孔都有）|
| PCB 丝印文字 | 类名是 **`pcb_PrimitiveString`**（不是 PrimitiveText）|
| PCB 没有 Hole 类 | 安装孔用 `pcb_PrimitivePad` 造（§5.6）；板框用 `pcb_PrimitivePolyline` |
| **零长度线段会卡死队列** | 绝不创建 `(x,y)→(x,y)`；发射前判断 `if (a.x===b.x && a.y===b.y) continue` |
| NC 引脚加导线会 `create failed` | 先 `setState_NoConnected(false)` + `done()` |
| 元件位号必须全局唯一 | 重名会继承别的网络 |
| 原理图 DRC | 必须打开**图页 uuid**（docType=1）；对整板 docType=3 会报 `doctype(3) not support check sch drc` |
| DRC 条目的图元 ID | **`obj1.suffix` 不是图元 ID**（真 ID 在 `objs` 数组里）；想定位坐标要读 `objs[].x/y` |
| DRC 不幂等 | 一轮验证只跑一次 |
| 元件 `getState_Name()` | 返回的常是模板 `={Value}`/`={Manufacturer Part}`，别当成实际值 |
| 建/删大量图元 | **必须顺序 `await`**，`Promise.all` 会静默丢段 |
| 单次调用时间 | 桥接层 HTTP 有 **~30s 硬超时**，但**后端会继续跑**；长任务不要用超时判定失败，之后用轻量调用探测状态 |
| EDA 窗口无响应 | 桥接 `/health` 仍显示 `edaConnected:true`、`pendingRequests:0`，但 `eda_exec` 一直超时 → 等窗口自己恢复或刷新页面 |

---

## 7. 验证：一定要"看图 + 读 DRC 明细"

- **截图**：`eda.dmt_EditorControl.getCurrentRenderedAreaImage()` → Blob → base64；
  先 `zoomToAllPrimitives()`。**只看数字会自欺**：我曾用数字"证明"倒角生效，
  截图一看 247 处直角照旧（真因是路径逐格、切角判断被 `floor(l1/2)=0` 跳过）。
- **DRC 明细**：不要只看总数，要按 `errorObjType` 分组、按网络统计、把 `objs` 坐标取出来定位到具体元件。
  "焊盘对焊盘"→ 布局问题；"Track/Via"→ 悬空铜箔；"Connection/Pad"→ 真实缺连。
- **分布统计**：分带统计元件数，找空区。
- **自由区连通块**：判断是否被切碎。

---

## 8. 推荐执行顺序（照抄即可）

1. 读**外壳脚本**拿到：板尺寸、安装孔内缩与孔径、屏幕模组尺寸与排母中心、各端口所在壁与坐标、按键位置。
2. 算清**屏幕覆盖范围**，确定天线可用条带。
3. **布局**：固定件就位 → 可动件按全板蛇形网格摊开 → 分带统计确认无空区。
4. **机械件**：打安装孔、端口转向（TF/USB/开关）、开关放正面。
5. **先 GND**：双层八角环形地线 + 就近支线（排除在自动布线之外）。
6. **后信号**：官方 `autoRouting` 分批（3~5 网/批，`keep`，45°）。
7. **验证**：DRC 明细 + 截图；间距类错误回到第 3 步挪元件。
8. 归零后导出 Gerber/BOM/坐标。


---

## 9. ★★ 致命：脚本规模会**堵死 EDA 主线程**（实测事故）

### 事故经过
用**一个** `invoke` 脚本在一页原理图上连续创建 **28 个元件 + ~150 个网络标签/电源标志 + ~50 条导线**
（全部顺序 `await`，共约 230 次 API 调用）→ **EDA 主线程卡死**：
- 客户端进程还在、端口 `49631` 仍显示 LISTEN
- 但 `Invoke-WebRequest` 一律「**目标计算机积极拒绝，无法连接**」，等待 45s 不恢复
- 只能**人工重启 EDA 客户端**

### 铁律
1. **单次脚本的 EDA 写操作上限：约 40~60 次**（元件 + 标签 + 导线合计）。
   超出就要拆成多个 `invoke`，每批之间让出事件循环（批间 sleep 1~2s）。
2. **不要在一个脚本里「放件 + 读引脚 + 贴全部标签」** —— 拆成：
   ① 只放件（10~15 个）→ ② 只拉线贴标（20~30 个）→ ③ 下一批。
3. 经验值（实测）：
   | 操作 | 单页规模 | 结果 |
   |---|---|---|
   | 10 元件 + 46 标签/导线（56 次）| 一页 | ✅ 顺利 |
   | 28 元件 + 200 标签/导线（~230 次）| 一页 | ❌ **卡死** |
4. 反过来，**只读**查询（getAll 之类）可以多，但一次也别超过 ~10 次。
5. 出事后**不要反复重试**（每次重试都是一次 20s+ 阻塞）；先确认进程在但端口拒绝 → 直接判定主线程卡死 → **请用户重启客户端**。

### 附带发现：建页 API 是存在的（别以为只能手点）
```js
eda.dmt_Schematic.createSchematicPage(schematicUuid, 'P2')   // 返回新页 uuid
eda.dmt_Schematic.getAllSchematicPagesInfo(schematicUuid)    // 列出全部页
eda.dmt_Schematic.modifySchematicPageName(schUuid, pageUuid, name)
eda.dmt_Schematic.modifySchematicPageTitleBlock(...)         // 图框/标题栏
eda.dmt_Schematic.copySchematicPage / deleteSchematicPage / reorderSchematicPages
eda.dmt_Board.createBoard / getAllBoardsInfo
```
> `dmt_Project` 里**没有**建页 API，全量搜命名空间时别只搜 `dmt_Project`。

### 绕开坏插件：直连官方 MCP（HTTP JSON-RPC）
DSH 插件挂掉时（`eda_status` / `eda_exec` 全部 "fetch failed"），只要**桌面客户端已开**，
可直接打它的 MCP 端口：
```powershell
# tools/list 看有哪些工具（通常只有 help / discover / call 三个）
# 执行任意 eda.* 代码：
$body = '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lceda-pro.call","arguments":{"path":"invoke","input":{"session":"<sessionId>","code":"return 1+1;"}}}}'
Invoke-WebRequest -Uri "http://127.0.0.1:49631/mcp" -Method POST -Body $body -ContentType 'application/json' \
  -Headers @{ 'Accept'='application/json, text/event-stream' } -UseBasicParsing
```
- 端口：插件托管 MCP 常为 **49631**（`lceda-pro --mcp http --port 49630` 是原生 CLI 的默认；以 `netstat` 实测为准）。
- **会话 id 必填**：`path="session.list"` 先拿（字段名是 `sessionId`，不是 `id`）。
- `code` 是**异步函数体**，用 `return` 返回；返回体在 `result.content[0].text` 里再套一层 `data`。
- 中文/引号多时**把 body 写文件再 `-InFile`**，不要拼命令行字符串。