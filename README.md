# pcb-design · PCB 设计一站式技能

一套把 **IPC 设计标准 + 嘉立创 EDA 实操 + 深度布线方法论 + 验收判据 + 常用模块知识** 整合在一起的
PCB 设计与打样技能，用于 AI Agent（如 DSH / Claude / Codex 等支持「文件系统技能」的宿主）在
「画原理图 / 画 PCB / 布线 / DRC 归零 / 叠层阻抗 / 打样 / 验收」任务中直接调用。

## 内容

```
pcb-design/
├─ SKILL.md                     # 总纲：路由表 + 12 条铁律 + 工作流 + 速查 + 索引
├─ references/
│  ├─ electrical-clearance-current.md   # IPC-2221 间距(Table 6-1)/载流/铜厚线宽
│  ├─ stackup-impedance.md              # 传输线阻抗/叠层/Dk-Df/去耦
│  ├─ holes-lands-vias.md               # 焊盘环宽/孔/盲埋孔/盖油
│  ├─ materials-finishes-dfm.md         # 材料/表面处理/阻焊/DFM
│  ├─ acceptance-6012-a600.md           # IPC-6012E 性能值 + IPC-A-600G 外观判据
│  ├─ eda-automation-api.md             # 嘉立创EDA 接入/工具/官方API/踩坑
│  ├─ eda-board-process.md              # 双层板布局→布线→GND→DRC 实战
│  ├─ eda-deep-routing.md               # 转向罚分布线器/连通自检/DRC 归零
│  └─ wiki-modules-knowledge.md         # 常用模块 + 阻抗/铺铜/过孔/丝印/工艺
└─ scripts/                             # 可交给 eda_exec 运行的 JS 工具（__OPTS__ 注入参数）
   ├─ smart_route.js  net_check.js  gnd_solver.js  board_audit.js
   ├─ floating_pad_audit.js  route_simplify2.js  chamfer_safe.js
   ├─ net_repair.js  net_router.js
```

## 怎么用

**作为 AI 技能（推荐）**：把整个 `pcb-design/` 目录放进宿主的技能目录，例如：

- 便携版 DSH：`<DSH_HOME>/skills/pcb-design/`
- 安装版 DSH：`%USERPROFILE%\.dsh\skills\pcb-design\`
- 其它 Agent（Claude Skills / Codex 等）：放进其 `skills/` 目录，`SKILL.md` 的 frontmatter 会被识别。

AI 命中「画 PCB / 布线 / DRC / 叠层阻抗 / 打样 / 验收」等关键词时即加载 `SKILL.md`，再按需读 `references/`。

**人读**：直接读 `SKILL.md` 的「铁律 / 工作流 / 速查」，细节查 `references/`。

## 覆盖与依据

- 设计标准：IPC-2221《Generic Standard on Printed Board Design》全文
- 外观验收：IPC-A-600G《Acceptability of Printed Boards》全文
- 性能/鉴定：IPC-6012E《刚性印制板的鉴定及性能规范》中文版全文
- 实操：嘉立创 EDA Pro（EasyEDA Pro）官方 `eda.*` API 真机实测
- 知识：嘉立创官方 wiki（教育文档中心）PCB 相关文章汇总

> 本项目对 IPC 标准仅做**要点提炼与数值汇总**（事实/规则），**不含**标准原文全文；IPC 标准版权归 IPC 所有，
> 详见 [NOTICE.md](NOTICE.md)。请以正式采购的标准原文为准。

## 许可

- 代码（`scripts/*.js`）与本文档：**PolyForm Noncommercial License 1.0.0**（见 [LICENSE](LICENSE)）。
  **✅ 允许个人及任何非商业用途**（个人学习/研究/实验/业余项目，以及教育、公益、科研、政府等非商业组织）；
  **⛔ 禁止任何商业用途**（商用需另行获得授权）。
- IPC 标准相关：见 [NOTICE.md](NOTICE.md)。
- 商用授权：请联系作者。
