# TODO：项目后续开发（通用）

> 统一收敛临时实现和后续排期项，按模块与优先级维护。

## P0（高优先）

- [ ] 落地“地图压制门槛”到高阶掉落池：当前压制值会影响敌人强度，但未按经济设定限制高品质掉落。需在战斗掉落链路补齐“低级图压满最高到紫；80级+地图压满后才进入橙/红池”的硬门槛规则，建议从 `src/data/battleDrops.ts` 的环境权重与 `src/lib/battleEngine.ts` 的掉落入口一起接入。
- [ ] 消耗品实装：当前消耗品（如治疗药剂）只有示例库存。需要实装在战斗内外使用消耗品的逻辑

## P1（功能完整性）

- [ ] 世界地图结算模式扩展为可选策略（当前仅支持“结算当前地区”）。
- [ ] 测试结束后恢复“非中央大陆入口”开放策略（当前 `WorldMapPage` 临时仅开放中央大陆，其他大陆按钮置灰且 URL 会强制回写）；建议从 `src/pages/WorldMapPage.tsx` 的大陆按钮禁用逻辑与 selection 归一化逻辑回收。
- [ ] 大陆层“顶级装备掉落池”接入实际掉落计算链路（当前仅有配置字段，未接逻辑）。
- [ ] 酒馆招募系统从占位升级为闭环（查看候选 -> 签约消耗 -> 入队英雄池）。
- [ ] 传奇英雄获取流程接入正式规则（BOSS 材料/任务条件/解锁反馈）。
- [ ] 传奇装备获取流程接入正式渠道（当前仅支持在英雄页/背包页管理固定配置，不含产出闭环，且测试期默认拥有全部传奇装备）；建议从 `src/state/EquipmentInventoryProvider.tsx` 的 `ownedLegendaryEquipmentIds` 状态切换为正式产出写入入口，再在 `src/pages/NodeActionPage.tsx` / `src/lib/bulletinMissionSystem.ts` / 战斗结算链路中接入掉落或任务解锁来源，并同步补充 `src/data/config/legendaryEquipments.json` 的解锁条件字段设计。
- [ ] 测试结束后移除“默认拥有全部传奇装备”逻辑，改为仅显示并允许装备已解锁的传奇装备；可从 `src/state/EquipmentInventoryProvider.tsx` 的 `buildDefaultOwnedLegendaryEquipmentIds` 回退策略与 `src/pages/InventoryPage.tsx` 的传奇装备页签说明文案入手。
- [ ] 测试结束后移除“弥亚固定初始英雄”注入，恢复为仅通过正式传奇获取规则出现。
- [ ] 给玩家英雄补齐“种族”属性并接入完整战斗配置链路（当前仅敌方配置已加入种族字段）。
- [ ] 英雄技能获取系统接入正式流程（当前仅支持“创建随机英雄时初始获得技能”）。
- [ ] 消耗品库存接入正式产出与消耗链路（当前为示例库存实现）。
- [ ] ST1/ST2 节点商店补齐“非装备品类”的正式交易闭环（当前仅完成基础装备买卖）：需要把材料、消耗品与后续大宗贸易从静态表升级为真实库存与结算；建议先从 `src/pages/NodeActionPage.tsx` 的 `shop/market` 交易区块拆分交易类型，再在 `src/state/EquipmentInventoryProvider.tsx` 增加材料/消耗品买卖接口，最后统一到 `src/data/config/economyConfig.ts` 管理价格与库存参数。
- [ ] 布告栏任务刷新策略升级为正式版（当前为“地区首次加载后生成固定 2 收集 + 2 讨伐，不自动轮换”）；建议从 `src/lib/bulletinMissionSystem.ts` 增加刷新规则，再在 `MapSystemProvider` 增加月刷新/补位触发。
- [ ] 将“可同时接取任务上限”升级为可成长系统（当前 `baseAcceptedLimit=4` 仅固定生效）；建议从 `src/data/config/bulletinMissionConfig.ts` 的 `getBulletinMissionAcceptedLimit(extraCapacity)` 入手，新增上限加成来源（如组织建筑等级/科技/声望），并在 `src/state/MapSystemProvider.tsx` 将加成接入实际校验，再同步到 `src/pages/NodeActionPage.tsx` 和 `src/pages/OrganizationPage.tsx` 的计数展示文案。
- [ ] 补齐“非中央大陆”疆域的布告栏任务配置文件（当前仅中央大陆 `holy-heartland`、`iron-frontier` 已配置，其余疆域走 `default` 回退）；建议从 `src/data/config/bulletinMissions/` 按疆域新增 JSON，并在 `src/data/config/bulletinMissionConfig.ts` 登记映射后做一次平衡性联调。
- [ ] 记忆获取流程接入正式产出链路（当前仅提供默认初始拥有记忆）。
- [ ] 记忆数值效果接入战斗结算链路（当前记忆仅有文案与穿戴状态，不会影响战斗面板）；建议从 `src/data/heroMemories.ts` 增加结构化数值字段，并在 `src/lib/battleAdapters.ts` / `src/lib/battleEngine.ts` 接入结算。
- [ ] 删除“同次启动同职业天赋优先去重”测试逻辑，改回正式版抽样分布。
- [ ] 组织功能建筑子界面从占位弹窗升级为可操作页面（铁匠铺/远征/图书馆）。
- [ ] 基地核心“基地状态”补齐完整组织信息面板（当前仅展示已建造建筑数量）；建议从 `src/pages/OrganizationPage.tsx` 的 `base_core` -> `status` 子界面扩展组织评级明细、建筑等级统计、地块产能、驻防/资源流入汇总等字段，并与 `src/state/OrganizationProvider.tsx` 建立稳定读取接口。
- [ ] 基地核心“主线任务”接入正式完成条件与奖励结算（当前为“标记完成（测试）”按钮）；建议从 `src/data/organizationData.ts` 的 `organizationMainQuestDefinitions` 补充前置条件/完成条件/奖励字段，在 `src/state/OrganizationProvider.tsx` 接入真实状态推进，再在 `src/pages/OrganizationPage.tsx` 替换测试按钮为系统事件驱动完成。
- [ ] 组织评级升级逻辑接入正式规则与数据源（当前仅模拟经验接口）。
- [ ] 组织地块扩张规则补齐为正式版（连通性约束、扩张范围预览、扩张来源与消耗平衡）。
- [ ] 实装酒馆招募逻辑：根据随机生成规则，实装普通英雄的生成（随机名字、职业、初始波动属性、技能） 。并将招募到的英雄真实加入运行时队伍 Provider。
- [ ] 经验与升级逻辑：当前英雄似乎缺失了明确的经验获取和升级链路（参考经验公式 $\text{Next\_Level\_EXP} = \text{Current\_Level}^{2.8} \times 50$） 。需要让挂机战斗真实产出经验

## P2（数值与内容）

- [ ] 扩充职业技能库、怪物库、Boss 脚本与地区特色词缀。
- [ ] 队伍光环、站位加成与组织系统加成接入统一数值配置。
- [ ] 组织建筑效果接入战斗与队伍系统的实际计算链路（当前仅展示说明）。
- [ ] 组织评级自动化：接入真实的组织经验来源（英雄战力沉淀、地区声望突破、特殊事件结算） ，移除模拟按钮
- [ ] 实装功能建筑收益：将训练营（Barracks）的经验加成（每级提升5%）  等数值真实挂载到战斗结算系统中
- [ ] 远征调度实装：开发远征调度室（Dispatch Center） ，让玩家抽到的多余英雄能派出去执行任务获取材料，解决英雄冗余的挫败感

## P3（工程与体验）

- [ ] 增加战斗与装备核心逻辑自动化测试（公式、状态机、随机权重）。
- [ ] 增加日志筛选与性能优化（高倍速 Tick 聚合、渲染节流）。
- [ ] 为关键状态提供本地持久化（编队、技能槽位、筛选条件）。
