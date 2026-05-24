# 新职业设计：影刃（Assassin）

## 1. 职业定位
- 战斗定位：高速单体爆发 / 收割 / 行动条干扰。
- 阵位倾向：后排优先（可临时切前排补刀）。
- 核心资源：高敏捷转化暴击与穿透，依赖“标记”窗口完成击杀。
- 与现有职业互补：
  - 对圣骑：补足单体终结能力。
  - 对法师：提供行动条打断，防止敌方高权重技能连发。
  - 对祭司：在治疗保护下稳定叠层收割。

## 2. 属性与成长建议（对齐现有口径）
- `statProfileByClass.base`
  - `hp`: 6100
  - `mp`: 1500
  - `str`: 198
  - `int`: 88
  - `agi`: 338
  - `def`: 186
- `statProfileByClass.variance`
  - `hp`: 1100
  - `mp`: 240
  - `str`: 32
  - `int`: 18
  - `agi`: 56
  - `def`: 28
- `growthProfileByClass.base`
  - `hp`: 230
  - `mp`: 52
  - `str`: 8
  - `int`: 2
  - `agi`: 12
  - `def`: 4
- `growthProfileByClass.variance`
  - `hp`: 40
  - `mp`: 10
  - `str`: 2
  - `int`: 1
  - `agi`: 2
  - `def`: 1

## 3. 装备槽与装备倾向
- 建议装备槽（总计 8 槽）：
  - `手部 x2`（主手/副手）
  - `护甲 x1`（轻甲导向）
  - `鞋 x1`（高敏捷词条优先）
  - `饰品 x4`
- 武器倾向：单手武器双持（不使用双手武器逻辑）。
- 词条偏好：`critRate`、`critDamage`、`penetration`、`agi`。

## 4. 天赋池（2选1）
- `talent_shadow_hunt`
  - 名称：影猎律动
  - 效果：增加 `10%` 暴击率、`8%` 护甲穿透百分比；对生命低于 `35%` 的目标额外 `12%` 伤害。
- `talent_night_oath`
  - 名称：夜誓步伐
  - 效果：增加 `14%` 行动条获取速度（可映射为敏捷收益），首次出手额外提高 `18%` 技能权重。

## 5. 主动技能池（7个，保底1个）
- 保底主动：`assassin_quick_pierce`

1. `assassin_quick_pierce`（猛攻）
- 单体物理伤害，系数：`95%AGI + 35%STR`，冷却短，基础权重高。
- 目标血量低于 40% 时权重提升。

2. `assassin_mark_of_fall`（削弱）
- 对单体施加“破绽标记”（可用 `weakened` + 易伤描述实现）。
- 标记目标受到影刃伤害提高，持续 2 回合。

3. `assassin_black_feather`（猛攻）
- 随机 2 段突袭（可配置 `hitCount`），优先命中被标记单位。

4. `assassin_smoke_recast`（坚守）
- 自身获得短时减伤与闪避提升（`damageReduction` + `evasion`）。

5. `assassin_nerve_cut`（削弱）
- 单体中伤并附带行动条后推（`actionDeltaTarget < 0`）。

6. `assassin_execution_arc`（猛攻）
- 对低生命目标造成高倍率终结伤害；若击杀，触发小幅自我回复 MP。

7. `assassin_battle_focus`（激昂）
- 自身获得暴击与全增伤短 buff（`critRate` + `allBoost`），为下轮爆发铺垫。

## 6. 被动池（3选1~2）
- `passive_shadow_edge`
  - 增加 `agi` 与 `critDamage`。
- `passive_cold_blooded`
  - 对负面状态目标额外伤害（映射 `damageBoost`），增加少量 `penetration`。
- `passive_silent_step`
  - 增加 `evasion` 与 `damageReduction`，降低被集火风险。

## 7. AI 权重建议
- 行为优先级：
  1. 敌方低血可收割时优先终结。
  2. 若敌方高威胁单位行动条接近满，优先使用后推技能。
  3. 若无击杀窗口，优先挂标记再爆发。
- `baseWeight` 整体高于游侠，冷却略高于基础攻击，避免无脑连斩。

## 8. 风险与平衡边界
- 主要风险：前中期过强导致“先手秒杀”压制其他输出职业。
- 平衡抓手：
  - 下调基础防御与生命成长，明确其“高收益高风险”。
  - 收割技能设置明确门槛（血线阈值 / 冷却）。
  - 行动条干扰技能伤害保持中低。
