# LostLand 开发文档总览

本目录以“当前代码真实结构”为准，目标不是解释概念，而是让后续开发者能在 10-20 分钟内定位到应该修改的文件。

## 1. 建议阅读顺序

1. `00-开发主指导.md`
   - 先看统一流程、状态归属、开发约束，避免一上来在页面里硬改。
2. `01-项目与目录总览.md`
   - 了解入口、路由、Provider、目录职责和跨模块调用链。
3. `08-架构总图与调用链图.md`
   - 快速看全局架构图，再按图定位具体模块。
4. 按任务类型进入对应模块文档。

## 2. 按需求定位文档

| 需求类型 | 优先文档 | 同时要看的代码 |
| --- | --- | --- |
| 世界地图 / 地区切换 / 月结算 / 地图生成 | `02-地图生成与月度结算模块.md` | `src/pages/WorldMapPage.tsx` `src/state/MapSystemProvider.tsx` `src/data/worldMapData.ts` `src/lib/topology.ts` `src/lib/monthlySimulation.ts` |
| 节点入口 / 布告栏 / 商店基础交易 / 仪式入口 | `03-节点交互模块.md` | `src/pages/NodeHubPage.tsx` `src/pages/NodeActionPage.tsx` `src/pages/RitualPage.tsx` `src/lib/mapRules.ts` |
| 英雄页 / 装备穿戴 / 技能配置 / 记忆 / 队伍预设 | `04-英雄与队伍模块.md` | `src/pages/HeroPage.tsx` `src/pages/TeamPage.tsx` `src/state/HeroRosterProvider.tsx` `src/state/BattleSetupProvider.tsx` `src/state/EquipmentInventoryProvider.tsx` |
| Provider / 类型 / 配置 / 静态数据边界 | `05-状态管理与数据模块.md` | `src/types/*.ts` `src/state/*.tsx` `src/data/*` |
| 样式 / 布局 / 页面 class 命名 | `06-UI与样式模块.md` | `src/styles.css` `src/components/layout/MainLayout.tsx` |
| 战斗流程 / 掉落 / 回放 / 技能释放 | `07-战斗系统模块.md` | `src/pages/BattlePage.tsx` `src/lib/battleEngine.ts` `src/lib/battleAdapters.ts` `src/data/battleSkills.ts` |
| 第一章收尾 / 章节可见遗留项排查 | `第一章剩余开发项.md` | `src/pages/NodeActionPage.tsx` `src/pages/RitualPage.tsx` `src/pages/OrganizationPage.tsx` `src/pages/InventoryPage.tsx` `src/pages/HeroPage.tsx` |
| 第一章占位功能正式设计 | `第一章占位功能设计方案.md` | `src/pages/NodeActionPage.tsx` `src/pages/RitualPage.tsx` `src/state/MapSystemProvider.tsx` `src/state/OrganizationProvider.tsx` `src/state/EquipmentInventoryProvider.tsx` |
| 调数值 / 改 JSON 配置 / 新增可调参数 | `配置文件修改指南.md` | `src/config/world` `src/data/config` `src/data/battleSkills` |
| 新增 / 调整战斗技能配置 | `战斗技能配置文件说明-策划.md` | `src/data/battleSkills.ts` `src/data/battleSkills/*/*.json` |

## 3. 文档索引

- `00-开发主指导.md`
  - 统一开发流程、开发约束、验证要求、文档更新要求。
- `01-项目与目录总览.md`
  - 项目入口、路由树、目录边界、核心调用链。
- `02-地图生成与月度结算模块.md`
  - 大陆/疆域/地区选择、地区懒加载、拓扑生成、月结算、回放。
- `03-节点交互模块.md`
  - 节点主界面、动作可达规则、布告栏闭环、ST1 交易与铁匠铺强化/打造闭环，以及 ST2/酒馆占位现状。
- `04-英雄与队伍模块.md`
  - 英雄页四个页签、装备栏、技能槽位、记忆系统、队伍预设。
- `05-状态管理与数据模块.md`
  - 全局状态归属、静态数据入口、Provider 边界、常见误区。
- `06-UI与样式模块.md`
  - `styles.css` 结构、布局入口、样式命名、改样式时的落点。
- `07-战斗系统模块.md`
  - 战斗页、引擎、回放、掉落、任务回写链路。
- `08-架构总图与调用链图.md`
  - 启动链、路由图、状态归属图、核心业务调用链总图。
- `第一章剩余开发项.md`
  - 汇总第一章当前仍会被玩家直接看到的测试态、占位态与半接通功能，并给出建议修复顺序。
- `第一章占位功能设计方案.md`
  - 补齐仪式、ST2 商铺、训练营、远征调度室、秘法图书馆、魔力增幅塔、消耗品、传说装备和记忆数值的正式设计边界。
- `配置文件修改指南.md`
  - 所有主要配置文件与参数入口的定位指南。
- `战斗技能配置文件说明-策划.md`
  - 战斗技能 JSON 的目录规则、字段说明、模板和排错方式。
- `TODO-项目后续开发.md`
  - 统一收敛临时实现和明确后续工作，不再新建模块私有 TODO。
- `../百科/怪物图鉴.md`
  - 当前敌方原型（亡灵/野兽/人类/异兽）与掉落定位的内部查阅文档。
- `../百科/材料图鉴.md`
  - 当前战斗材料全量条目（54 种）与四种族材料池权重说明。
- `../百科/装备强化消耗图鉴.md`
  - 装备强化规则、阶段换材链路、模板材料归属与消耗公式。
- `../百科/建筑百科.md`
  - 当前组织建筑全量清单（含训练营）、升级上限与功能接通状态说明。
- `../百科/系统机制百科.md`
  - 汇总核心系统机制、关键公式、配置入口与实现文件的统一查阅文档。
- `../章节脚本/第一章流程脚本表.md`
  - 第一章“基地修复 -> 建设扩编 -> 压制值100解放”剧情化流程脚本，包含主线任务链、支线教学、里程碑与功能开放白名单。
- `开发记录/开发记录模板.md`
  - 每次开发后新增开发记录时使用。
- `开发记录/2026-05-20-压制体系隐藏态重构.md`
  - 将压制推进重构为“隐藏状态 + 投影公式”的可扩展体系，统一接入战斗、委托与月结算。
- `开发记录/2026-05-20-百科补录压制体系公式.md`
  - 将新压制体系的隐藏态、评分公式、投影公式和行为改写口径补入 `docs/百科/系统机制百科.md`。
- `开发记录/2026-05-20-开发文档瘦身与入口收敛.md`
  - 本次文档整理记录，收敛必读入口、修正英雄池归属口径、精简历史索引。
- `开发记录/2026-05-21-第一章剩余开发项梳理.md`
  - 梳理第一章玩家可见的测试态/占位态残留，新增专门清单文档并补索引。
- `开发记录/2026-05-21-第一章占位功能设计补全.md`
  - 将第一章占位功能补成正式设计方案，并同步模块文档、百科和配置入口。
- `开发记录/2026-05-21-仪式-Boss与ST2商铺接通.md`
  - 接通第一章仪式 Boss、仪式结算回写与 ST2 商铺真实交易闭环。
- `开发记录/2026-05-21-仪式奖励新增两件传说装备.md`
  - 调整暗渠封印仪式通关奖励为解锁两件暗渠主题传说装备。
- `开发记录/2026-05-21-传说装备被动战斗实装.md`
  - 将 6 个传说装备被动从描述文本接入战斗运行时结算。
- `开发记录/2026-05-25-多分辨率布局挤压修复.md`
  - 修复中等分辨率下全局与核心页面（队伍/背包/战斗/地图信息区）布局挤压问题。
- `开发记录/2026-05-25-组织基地简化建筑升级界面替换.md`
  - 组织页切换为简化建筑/升级界面，取消地块与手动摆放接入，并保留旧实现代码。

较早的开发记录仍保留在 `docs/开发文档/开发记录/` 目录中，需要回溯时直接按文件名检索。

## 4. 当前项目最容易踩的坑

1. 英雄池由 `HeroRosterProvider` 托管，初始英雄只是种子数据。
   - 想做“运行时招募英雄 / 删除英雄 / 真正入队”，不能只改页面，必须先设计新的英雄状态源。
2. 地图状态、任务状态只在 `MapSystemProvider` 里。
   - 页面里不要自己维护“地区副本”或“任务副本”。
3. 装备、材料、消耗品、记忆库存只在 `EquipmentInventoryProvider` 里。
   - 节点页、英雄页、战斗页都只读/调用它，不要再存一份。
4. 战斗技能显示和战斗技能运行都依赖同一套 JSON。
   - 改 `src/data/battleSkills/*/*.json` 后，要同时考虑 HeroPage 候选列表和 `battleEngine` 实战效果。
5. 目前只有“中央大陆入口”在 UI 层开放。
   - 其他大陆配置已经存在，但 `WorldMapPage` 会把选择归一化回中央大陆。

## 5. 新开发者建议的代码阅读入口

1. `src/main.tsx`
2. `src/App.tsx`
3. `src/components/layout/MainLayout.tsx`
4. `src/state/MapSystemProvider.tsx`
5. `src/pages/WorldMapPage.tsx`
6. 再根据任务进入对应页面 / Provider / lib / data 文件

## 6. 文档维护要求

1. 改完代码后，至少更新一个对应模块文档。
2. 每次开发必须新增开发记录。
3. 新增文档或模块时，更新本文件索引。
4. 新增可调参数时，更新 `配置文件修改指南.md`。
