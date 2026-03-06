import type { BattleElement } from "../types/battle";

export type BattleElementTriggerValueSource = "dealtDamage" | "attackerMaxHp" | "attackerMissingHp" | "targetMaxHp";

export type BattleElementTriggerEffect =
  | "bonusDamageToTarget"
  | "restoreMpToSelf"
  | "reduceTargetAction"
  | "boostSelfAction"
  | "healAllies"
  | "reduceTargetMaxHp";

export interface BattleElementTriggerDefinition {
  element: BattleElement;
  name: string;
  description: string;
  effect: BattleElementTriggerEffect;
  valueSource?: BattleElementTriggerValueSource;
  ratio?: number;
  flat?: number;
  replaySkillName?: string;
  logTemplate: string;
}

export const battleElementTriggers: Record<BattleElement, BattleElementTriggerDefinition> = {
  fire: {
    element: "fire",
    name: "火焰",
    description: "追加造成本次伤害 10% 的火焰伤害。",
    effect: "bonusDamageToTarget",
    valueSource: "dealtDamage",
    ratio: 0.1,
    replaySkillName: "火焰余烬",
    logTemplate: "{label} 追加 {value} 点伤害"
  },
  water: {
    element: "water",
    name: "流水",
    description: "恢复本次伤害 5% 的 MP。",
    effect: "restoreMpToSelf",
    valueSource: "dealtDamage",
    ratio: 0.05,
    logTemplate: "{actor} 回复 {value} 点 MP"
  },
  ice: {
    element: "ice",
    name: "寒冰",
    description: "将目标行动条向后推 500 点。",
    effect: "reduceTargetAction",
    flat: 500,
    logTemplate: "{target} 行动条 -{value}"
  },
  wind: {
    element: "wind",
    name: "疾风",
    description: "将自身行动条向前推 500 点。",
    effect: "boostSelfAction",
    flat: 500,
    logTemplate: "{actor} 行动条 +{value}"
  },
  life: {
    element: "life",
    name: "生命",
    description: "为全体友军恢复本次伤害 5% 的生命值。",
    effect: "healAllies",
    valueSource: "dealtDamage",
    ratio: 0.05,
    replaySkillName: "生命回响",
    logTemplate: "{actor} 触发生命回响，友军回复 {value}"
  },
  light: {
    element: "light",
    name: "光明",
    description: "额外造成施法者最大生命值 5% 的伤害。",
    effect: "bonusDamageToTarget",
    valueSource: "attackerMaxHp",
    ratio: 0.05,
    replaySkillName: "光明之力",
    logTemplate: "{label} 追加 {value} 点伤害"
  },
  undead: {
    element: "undead",
    name: "亡灵",
    description: "额外造成施法者已损失生命值 5% 的伤害。",
    effect: "bonusDamageToTarget",
    valueSource: "attackerMissingHp",
    ratio: 0.05,
    replaySkillName: "亡灵之力",
    logTemplate: "{label} 追加 {value} 点伤害"
  },
  dark: {
    element: "dark",
    name: "黑暗",
    description: "降低目标最大生命值 1%（仅当场战斗）。",
    effect: "reduceTargetMaxHp",
    valueSource: "targetMaxHp",
    ratio: 0.01,
    logTemplate: "{target} 最大生命降低 {value}"
  }
};
