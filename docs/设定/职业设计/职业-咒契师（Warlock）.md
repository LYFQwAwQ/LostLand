# 新职业设计：咒契师（Warlock）

## 1. 职业定位
- 战斗定位：持续法术压制 / 负面状态扩散 / 自损换爆发。
- 阵位倾向：后排。
- 核心机制：通过“咒蚀层数”提升技能收益，擅长中长战。
- 与现有职业互补：
  - 对法师：补充持续伤害而非法术瞬爆。
  - 对祭司：祭司可抵消其自损代价。
  - 对圣骑/游侠：提供团队减抗与群体软控支撑。

## 2. 属性与成长建议（对齐现有口径）
- `statProfileByClass.base`
  - `hp`: 5400
  - `mp`: 3900
  - `str`: 64
  - `int`: 366
  - `agi`: 136
  - `def`: 152
- `statProfileByClass.variance`
  - `hp`: 900
  - `mp`: 620
  - `str`: 14
  - `int`: 60
  - `agi`: 24
  - `def`: 24
- `growthProfileByClass.base`
  - `hp`: 200
  - `mp`: 170
  - `str`: 2
  - `int`: 13
  - `agi`: 4
  - `def`: 3
- `growthProfileByClass.variance`
  - `hp`: 35
  - `mp`: 24
  - `str`: 1
  - `int`: 3
  - `agi`: 1
  - `def`: 1

## 3. 装备槽与装备倾向
- 建议装备槽（总计 9 槽）：
  - `手部 x1`
  - `护甲 x1`（法袍倾向）
  - `施法媒介 x3`
  - `施法核心 x1`
  - `饰品 x3`
- 武器/核心倾向：法杖 + 诅咒核心（沿用现有法系装备体系）。
- 词条偏好：`int`、`elementalPierce`、`allBoost`、`maxMp`。

## 4. 天赋池（2选1）
- `talent_covenant_of_ashes`
  - 名称：灰烬契约
  - 效果：增加 `14%` 暗元素增伤，技能命中附带微量自损（代价），换取 `8%` 全增伤。
- `talent_soul_tax`
  - 名称：魂税法印
  - 效果：对带负面状态目标额外 `12%` 伤害，击败目标时回复 `8%` 最大 MP。

## 5. 主动技能池（7个，保底1个）
- 保底主动：`warlock_void_bolt`

1. `warlock_void_bolt`（猛攻）
- 单体暗属性法术，系数：`108%INT`，低蓝耗高权重。

2. `warlock_rot_spread`（削弱）
- 对全体敌方施加中毒/灼烧其一（随机或按配置），并降低少量全抗。

3. `warlock_blood_contract`（激昂）
- 牺牲当前生命值一定比例，换取 2 回合 `allBoost` 与 `elementalPierce`。

4. `warlock_gravity_bind`（削弱）
- 单体伤害并后推行动条，附带短回合 `weakened`。

5. `warlock_soul_drain`（救援）
- 造成伤害并按比例转化为自身治疗（可通过伤害+自疗实现）。

6. `warlock_night_chant`（激昂）
- 全体友军提升法术相关收益（`allBoost` 小幅 + MP 回复）。

7. `warlock_eclipse_rite`（猛攻）
- 对全体敌方造成中高额暗属性伤害；若目标存在负面状态，额外结算一次小额追击。

## 6. 被动池（3选1~2）
- `passive_hex_mastery`
  - 增加 `int`、`elementalPierce`，提升负面状态相关技能权重。
- `passive_siphon_vein`
  - 技能命中后回复少量 MP，缓解长战蓝耗。
- `passive_pain_channel`
  - 当前生命越低，技能伤害越高（上限封顶，避免斩杀失控）。

## 7. AI 权重建议
- 行为优先级：
  1. 多目标时优先挂群体负面。
  2. 关键输出回合前先开自损增幅。
  3. 蓝量过低时优先吸取/回蓝类技能。
- `baseWeight` 建议偏策略型：起手不直接最高爆发，2-3回合后进入强势期。

## 8. 风险与平衡边界
- 主要风险：负面状态叠加过快导致群体战崩盘。
- 平衡抓手：
  - 控制群体挂状态技能的基础威力与持续回合。
  - 自损增幅必须有明确代价，且不可被无限无成本覆盖。
  - 与祭司联动时关注“自损被完全抵消”导致的上限溢出。
