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
- [ ] ST1/ST2 节点商店补齐“非装备品类”的完整交易闭环（当前 ST1 已接通建筑材料买入，ST2 仍为静态预览）：建议从 `src/pages/NodeActionPage.tsx` 的 `build_materials/market` 交易区块继续扩展材料卖出、消耗品交易与大宗贸易，再在 `src/state/EquipmentInventoryProvider.tsx` 增加对应买卖结算接口，并统一到 `src/data/config/economyConfig.ts` / 建材配置文件管理价格与刷新参数。
- [ ] 建筑材料交易页补齐“素材交易页”后续能力：当前仅支持按主城浮动价格购买，尚未提供材料卖出、批量采购模板、历史价格对比与跨主城价差提示；建议从 `src/pages/NodeActionPage.tsx` 的 `build_materials` 分支入手扩展交互区块，并将可调参数沉淀到 `src/data/config/buildingMaterialMarkets/*.json`。
- [ ] 建筑材料库存上限接入正式规则（当前不设上限）：需要明确按“单材料上限 / 总仓储上限 / 仓储建筑加成”中的哪种策略生效，并在 `src/state/EquipmentInventoryProvider.tsx` 的建材买入与奖励入包链路统一校验，避免超量写入。
- [ ] 布告栏任务刷新策略升级为正式版（当前为“地区首次加载后生成固定 2 收集 + 2 讨伐，不自动轮换”）；建议从 `src/lib/bulletinMissionSystem.ts` 增加刷新规则，再在 `MapSystemProvider` 增加月刷新/补位触发。
- [ ] 任务大厅“高级任务出现概率提升”正式接入（当前只接入任务栏上限成长）：建议在 `src/data/config/bulletinMissionConfig.ts` 新增“高阶任务权重加成”字段，并在 `src/lib/bulletinMissionSystem.ts` 按 `mission_hall` 等级修正生成权重。
- [ ] 补齐“非中央大陆”疆域的布告栏任务配置文件（当前仅中央大陆 `holy-heartland`、`iron-frontier` 已配置，其余疆域走 `default` 回退）；建议从 `src/data/config/bulletinMissions/` 按疆域新增 JSON，并在 `src/data/config/bulletinMissionConfig.ts` 登记映射后做一次平衡性联调。
- [ ] 记忆获取流程接入正式产出链路（当前仅提供默认初始拥有记忆）。
- [ ] 记忆数值效果接入战斗结算链路（当前记忆仅有文案与穿戴状态，不会影响战斗面板）；建议从 `src/data/heroMemories.ts` 增加结构化数值字段，并在 `src/lib/battleAdapters.ts` / `src/lib/battleEngine.ts` 接入结算。
- [ ] 删除“同次启动同职业天赋优先去重”测试逻辑，改回正式版抽样分布。
- [ ] 组织功能建筑子界面继续从占位弹窗升级为可操作页面（远征调度室/秘法图书馆），并与组织等级、资源消耗、结算回写打通。当前铁匠铺已接入真实强化功能，可参考 `src/pages/OrganizationPage.tsx` 中 `foundry` 分支与 `src/components/forge/ForgeEnhancementPanel.tsx` 的复用方式扩展其余功能建筑。
- [ ] 强化辅助材料接入正式产出与循环消耗链路：当前“幸运护符/固守符印”仅以内置初始库存联调，尚未接入战斗掉落、任务奖励或商店兑换。后续需在 `src/state/EquipmentInventoryProvider.tsx` 建立统一入包接口，再从 `src/lib/battleEngine.ts` 战斗结算、`src/lib/bulletinMissionSystem.ts` 任务奖励、`src/pages/NodeActionPage.tsx` 节点交易入口中选择至少一条稳定产出来源，最后在 `src/data/config/equipmentEnhancementAidConfig.ts` 沉淀可调参数（掉率/奖励数量/兑换价格）。
- [ ] 基地核心“基地状态”补齐完整组织信息面板（当前仅展示已建造建筑数量）；建议从 `src/pages/OrganizationPage.tsx` 的 `base_core` -> `status` 子界面扩展组织评级明细、建筑等级统计、地块产能、驻防/资源流入汇总等字段，并与 `src/state/OrganizationProvider.tsx` 建立稳定读取接口。
- [ ] 基地核心“主线任务”接入正式完成条件与奖励结算（当前为“标记完成（测试）”按钮）；建议从 `src/data/organizationData.ts` 的 `organizationMainQuestDefinitions` 补充前置条件/完成条件/奖励字段，在 `src/state/OrganizationProvider.tsx` 接入真实状态推进，再在 `src/pages/OrganizationPage.tsx` 替换测试按钮为系统事件驱动完成。
- [ ] 组织评级升级逻辑接入正式规则与数据源（当前仅模拟经验接口）。
- [ ] 组织建筑等级上限扩展到 Lv.10 与后续阶段：当前所有建筑升级表只开放到 Lv.6，需在 `src/data/organizationData.ts` 补齐 Lv.6→10 升级消耗、效果与边界校验，并联动 `docs/百科/建筑百科.md` 与配置指南。
- [ ] 组织地块扩张规则补齐为正式版（连通性约束、扩张范围预览、扩张来源与消耗平衡）。
- [ ] 训练营“驻训槽位”接入真实流程：当前 `training_camp` 槽位可点击但不生效，需补齐“指派英雄 -> 挂机经验累计 -> 结算回写”链路，建议从 `src/pages/OrganizationPage.tsx` 的训练营分支与战斗/经验状态源协同实现。
- [ ] 实装酒馆招募逻辑：根据随机生成规则，实装普通英雄的生成（随机名字、职业、初始波动属性、技能） 。并将招募到的英雄真实加入运行时队伍 Provider。

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
