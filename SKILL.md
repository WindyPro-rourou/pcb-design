---
name: pcb-design
metadata:
  version: 1.0.0
  author: pcb-design contributors
description: >
  PCB 设计与制造的一站式技能（把本机积累的 PCB 经验整合为一体）：
  ① 设计标准依据——IPC-2221 通用设计准则（间距/线宽载流/焊盘环宽/叠层阻抗/材料/DFM 全表）；
  ② 嘉立创 EDA（EasyEDA Pro）实时自动化的接入/工具/官方 API 与真机踩坑；
  ③ 双层板从布局到自动布线、GND、DRC 归零的实战流程，以及「转向罚分」深度布线器与连通自检脚本；
  ④ 验收标准——IPC-A-600G 外观判据 + IPC-6012E 性能/鉴定分 Class 数值；
  ⑤ 常用模块设计与知识点（LDO/DC-DC/晶振/USB/HDMI/MIPI/以太网/天线…、阻抗/串扰/叠层/过孔/铺铜/接地/丝印）。
  当任务涉及「画 PCB / 布线 / 自动布线 / DRC 归零 / 叠层 / 阻抗 / 环宽 / 过孔 / 嘉立创 EDA /
  EasyEDA / 原理图 / 打样 / IPC-2221 / IPC-A-600 / IPC-6012 / PCB 设计规范 / 飞线清零」时使用。
---

# PCB 设计总纲（pcb-design）

> 这份技能把盘内四类 PCB 经验**整合为一个入口**：设计标准(IPC) + EDA 实操(嘉立创 EasyEDA Pro) +
> 深度布线方法论 + 验收判据 + 模块/知识点。**先按第 1 节判断任务类型，再跳到对应 reference。**

## 0. 材料来源（整合了哪些东西）

| 来源 | 内容 | 本技能对应 |
|---|---|---|
| **IPC-2221**(1998 全文) + IPC-A-600G(2004 全文) + IPC-6012E-CN(2020 全文) | 设计准则、外观判据、性能/鉴定分 Class 数值 | `references/ipc-*`、`references/acceptance-6012-a600.md` |
| EDA 自动化 | 嘉立创 EDA 三档接入、24 工具、官方 `eda.*` API、真机踩坑 | `references/eda-automation-api.md` |
| 双层板实战经验 | 双层板实战：布局均衡/外壳对齐/45°/自动布线分批/GND 环/过孔间距 | `references/eda-board-process.md` |
| 深度布线经验 | 深度布线：转向罚分路由器、双引擎连通自检、铺铜过期、DRC 归零、量产检查 | `references/eda-deep-routing.md` + `scripts/*.js` |
| 嘉立创官方 wiki（92 篇） | 常用模块设计与知识点 | `references/wiki-modules-knowledge.md` |

---

## 1. 任务 → 查哪一篇（路由表）

| 你要做的事 | 先看 |
|---|---|
| **要从需求完整画一块板（总流程 + 每步自检关卡 G0~G5）** | `references/drawing-playbook.md` ⭐先读 |
| 间距留多少 / 线宽能过多大电流 / 环宽/焊盘怎么算 / 叠层与阻抗 / 材料选型 | `references/electrical-clearance-current.md`、`stackup-impedance.md`、`holes-lands-vias.md`、`materials-finishes-dfm.md` |
| 板子做出来合不合格、外观/切片判据、验收数值分 Class | `references/acceptance-6012-a600.md` |
| 连不上 EDA / 用什么工具 / 官方 API 怎么写 / 报错排查 | `references/eda-automation-api.md` |
| 放件、连线、原理图、原理图转 PCB、DRC、导出打样包 | `references/eda-automation-api.md` + `eda-board-process.md` |
| 布局/自动布线跑不通/自动布线难看/飞线清零/铺铜连通/DRC 上千条 | `references/eda-board-process.md` + `eda-deep-routing.md` |
| 具体模块怎么画（LDO/USB/HDMI/MIPI/以太网/天线…）/ 阻抗/串扰/过孔/铺铜/丝印 | `references/wiki-modules-knowledge.md` |
| 制造/DFM/打样被板厂打回/拼板/表面处理选型/钢网立碑/盘中孔背钻 | `references/manufacturing-dfm.md` |

---

## 2. 铁律（跨 IPC + EDA，先记住这 12 条）

**设计（IPC-2221）**
1. **先定 Class(1/2/3) / 板类型(Type 1–6) / 叠层**，再动手；设计值取 **≥IPC-2221 设计最小值**（内环0.03/外环0.05/非支撑0.15mm 等），不要压到验收下限。
2. 最小成品线宽 **0.1mm**；避免间距/线宽 ≤0.1mm；外层裸露间距按 **Table 6-1**（≤30V 取 0.1mm，>500V 按每伏系数叠加）。
3. 焊盘 = 成品孔 + 2×环宽 + 制造余量（A0.4/B0.25/C0.2mm）；厚径比 ≤5:1；孔盘差 ≥0.6mm；相邻孔残余基材 ≥0.5mm。
4. 叠层要**对称**，信号层夹在参考平面间，参考平面不随意分割；相邻无平面隔开的信号层正交布线。翘曲 SMT≤0.75%/其他≤1.5%。

**EDA 实操（嘉立创 EDA）**
5. **改文档前先 `openDocument` 到正确文档**（原理图 documentType=1，PCB=3）；`pcb_*`/`sch_*` 只有在当前文档对的时候才不报 null。
6. **引脚坐标只读不猜**：布线唯一依据是 `getAllPinsByPrimitiveId()`；位号不自动分配（新件 R?/U?）。
7. **放置走四步**：`create()` → 读属性快照 → `modify({designator, otherProperty})` → 读引脚。复杂页 create 极慢（80×），批量放新页/走后台任务。
8. **`importChanges()` 不可靠**（返回 true 但 0 元件）；原理图→PCB 用 `eda_sch_to_pcb`（取 component.name → `lib_Device.search` → 放置）。

**布线与验证（deep-routing）**
9. **DRC 前必重铺铺铜**：每次改铜（加/删线、改过孔、移件）都要 `rebuildCopperRegion()` → `save()` → 再 DRC。否则看到上千条假错误（`minDistance===0`）、DRC 还会慢到几分钟；重铺后同一块板 1267→20、5 分钟→5 秒。
10. **自动布线必须分批**（原生 `autoRouting` 900s 硬上限且超时不留中间结果，每批 3~5 网 + `keep`）；要「像人画的」用**转向罚分路由器**（`scripts/smart_route.js`：grid10 / turn140 / viaCost7000）。
11. **空网络焊盘是盲区**：`net===''` 的焊盘在按网络过滤的自检里"不存在"，可实物是铜 → 必须单独跑空网络焊盘审计；布完给每个端点补一段**显式落进焊盘中心**的短线，否则终点落在焊盘内过孔上仍报 Connection Error。
12. **导出前跑全量检测清单**（短路/线线/线盘/线孔间距/亚4mil/孔冲突/焊盘内孔/连通域/孤儿铜/90°折角/天线带），每次大改后**重新导出 Gerber**。

---

## 3. 从 0 到可打样：标准工作流

```
A. 需求&标准：定性能等级(Class)、板类型、电压/叠层/阻抗 → 按 IPC-2221 取值 (references/ipc-*)
B. 接 EDA：eda_status 确认 backend/connected → eda_board_overview 看当前文档
C. 原理图：eda_pick_spot → eda_place(拿引脚) → eda_wire/eda_netflag → eda_save → 等 8~10s → eda_sch_drc/eda_verify
D. 原理图→PCB：eda_sch_to_pcb → 布局(固定件先就位、可动件摊开、外壳/端口朝向) → 重铺
E. 布线：先 GND 环/地网络，再分批布线；难看用转向罚分路由器；每块跑完立刻连通自检
F. 归零：rebuildCopperRegion → DRC(详细) → 自写几何复核；间距类错误回布局
G. 验收：eda_export 出 Gerber/BOM/坐标 → 按 IPC-6012E 性能 + IPC-A-600G 外观判 (references/acceptance-*)
（随时）eda_trace 截图 · eda_snapshot 紧急保存 · eda_task 跑长任务
```

**验收三件套**：对象数量符合预期 + DRC 干净 + 截图目视正常，三者齐了才算完成。

---

## 4. 关键数值速查

- **电气间距**（外层裸露/内层，按峰值电压）：≤30V 0.1/0.05mm；51–100V 0.6/0.1mm；>500V + 每伏 0.0025(B1)/0.005(B2)… 见 Table 6-1。
- **最小环宽**：设计 内0.03/外0.05/非支撑0.15mm；验收 C3 内25µm/外支撑50µm/外非支撑150µm。
- **孔铜**：通/盲/埋 C3 平均25µm/最小20µm；微导通孔 12/10µm；埋芯 15/13µm。
- **介质耐压**：≥80µm 间距 500V，<80µm 250V（Class2/3）。**绝缘电阻**：C2 接收500MΩ/湿热100MΩ，C3 500MΩ。
- **载流**：线宽/铜厚由温升查 Figure 6-4（含10%降额；板厚≤0.8mm或铜≥108µm 再降15%）；速估 `I=k·ΔT^0.44·A^0.725`，k=0.024外/0.048内。
- **嘉立创工艺**：线宽/间距 ≥5/5mil（能力3.5mil，设计取6mil）；过孔外径≥19.7mil、孔≥0.3mm；板厚1.6mm、2层；**免费档不支持过孔塞油**（焊盘内过孔要挪走/手焊）。
- **DFM**：过 DRC ≠ 过 DFM；线宽/线距/孔/环宽/板边距按板厂能力留余量；V-cut 同层直线不转弯、盘中孔必塞孔研磨、多层给叠层表、拼板加 ≥5mm 工艺边+≥3 Mark。详见 `references/manufacturing-dfm.md`。

---

## 5. references 索引

| 文件 | 内容 |
|---|---|
| `references/electrical-clearance-current.md` | Table 6-1 间距全表、>500V 算法、Figure 6-4 载流、铜厚/线宽公差 |
| `references/stackup-impedance.md` | 4 种传输线阻抗/电容公式、叠层顺序、Dk/Df、去耦电感 |
| `references/holes-lands-vias.md` | 焊盘=a+2b+c、Table 9-1~9-5、环宽、热焊盘、盲埋孔、盖油 |
| `references/materials-finishes-dfm.md` | 材料选择、Table 4-1/4-3/4-5、表面处理、阻焊/三防、DFM 与投板检查 |
| `references/acceptance-6012-a600.md` | **IPC-6012E** 性能值(环宽/孔铜/孔内空洞/热应力后完整性/表面处理/阻焊/耐压/绝缘/铜厚) + **IPC-A-600G** 外观判据 |
| `references/eda-automation-api.md` | 嘉立创EDA 三档接入、24 工具、官方 `eda.*` API、坐标单位、踩坑清单、排错决策树 |
| `references/eda-board-process.md` | 双层板实战：布局均衡/外壳开孔对齐/45°禁直角/自动布线分批/GND 环形地线/过孔间距/API 陷阱/脚本规模上限 |
| `references/eda-deep-routing.md` | 转向罚分路由器、双引擎连通自检、铺铜过期判别、DRC 归零、清理顺序、量产检查与 19 条血泪教训 |
| `references/wiki-modules-knowledge.md` | 常用模块(15 类)+阻抗/高速+电源地铺铜+走线间距载流+生产工艺 的知识点汇总 |
| `references/manufacturing-dfm.md` | 板厂工艺能力速查 / DFM 十大坑 / 拼板(V-cut·邮票孔·工艺边·Mark) / 表面处理选型(ENIG黑盘等) / 钢网立碑 / 盘中孔·背钻 / 阻抗叠层 / 下单检查清单 |
| `references/drawing-playbook.md` | ⭐**Agent 画板作战手册**：需求→叠层→原理图→布局→布线→DFM→交付 的分步 SOP + 自检关卡 G0~G5 + "画坏"修正表 + 开工提示词骨架 |

## 6. scripts 索引（交给 `eda_exec` 的 JS，用 `__OPTS__` 注入参数）

| 脚本 | 作用 |
|---|---|
| `smart_route.js` | 转向罚分路由器（主力；grid10/turn140/viaCost7000/maskPad16） |
| `net_check.js` | 非 GND 网络连通 + 孤儿铜（`__OPTS__={"skip":["GND"]}`） |
| `gnd_solver.js` | GND 栅格连通/孤儿/补线（`{"mode":"diagnose"}`） |
| `board_audit.js` | 孤儿、90°折角、天线带、焊盘分类 |
| `floating_pad_audit.js` | 空网络焊盘审计（33 类空焊盘×全铜，<6mil 报警） |
| `route_simplify2.js` | 阶梯合并成 45°+直线 |
| `chamfer_safe.js` | 90° 倒角（带间距检查） |
| `net_repair.js` | 孤立焊盘桥到最近同网络铜 |
| `net_router.js` | 4mil 栅格老路由器（兜底） |

> 这些脚本来自一次真实双层板交付（一块 ESP32-S3 双层板，100×95mm，54 器件、44 网络、约 900 段/280 过孔/4 铺铜），
> 数字均实测，可直接复用到嘉立创双层板。详细用法见 `references/eda-deep-routing.md`。
