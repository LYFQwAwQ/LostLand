import type {
  BattleActiveSkillDefinition,
  BattlePassiveSkillDefinition,
  BattleTalentDefinition
} from "../types/battle";

export const DEFAULT_ACTIVE_SKILL_ID = "basic_attack";

export const battleActiveSkills: Record<string, BattleActiveSkillDefinition> = {
  basic_attack: {
    id: "basic_attack",
    name: "基础攻击",
    kind: "active",
    category: "assault",
    description: "基础单体攻击，不消耗 MP。",
    targetType: "singleEnemy",
    effect: "damage",
    damageType: "physical",
    mpCost: 0,
    cooldown: 0,
    baseWeight: 100,
    basePower: 72,
    scaling: { str: 0.95 },
    canCrit: true
  },
  paladin_shield_slam: {
    id: "paladin_shield_slam",
    name: "圣盾猛击",
    kind: "active",
    category: "defend",
    description: "以盾牌震击敌人，并提高自身防守。",
    targetType: "singleEnemy",
    effect: "damage",
    damageType: "physical",
    mpCost: 14,
    cooldown: 2,
    baseWeight: 110,
    basePower: 88,
    scaling: { str: 0.8, def: 0.25 },
    canCrit: true,
    targetStatus: {
      key: "stunned",
      chance: 0.25,
      duration: 1
    },
    selfStatus: {
      key: "guarded",
      chance: 1,
      duration: 1,
      potency: 0.25
    },
    weightTuning: {
      selfHpBelow: { threshold: 0.45, delta: 30 }
    }
  },
  paladin_holy_blade: {
    id: "paladin_holy_blade",
    name: "圣辉斩",
    kind: "active",
    category: "assault",
    description: "附带光元素的高伤害斩击。",
    targetType: "singleEnemy",
    effect: "damage",
    damageType: "physical",
    element: "light",
    mpCost: 22,
    cooldown: 3,
    baseWeight: 125,
    basePower: 132,
    scaling: { str: 0.9, int: 0.2 },
    canCrit: true,
    weightTuning: {
      enemyHpBelow: { threshold: 0.35, delta: 28 }
    }
  },
  paladin_prayer: {
    id: "paladin_prayer",
    name: "祈佑",
    kind: "active",
    category: "succor",
    description: "治疗当前生命值最低的友军。",
    targetType: "lowestHpAlly",
    effect: "heal",
    element: "life",
    mpCost: 18,
    cooldown: 2,
    baseWeight: 105,
    basePower: 102,
    scaling: { int: 0.65, maxHp: 0.025 },
    canCrit: false,
    weightTuning: {
      allyHpBelow: { threshold: 0.5, delta: 42 }
    }
  },
  paladin_command: {
    id: "paladin_command",
    name: "战阵号令",
    kind: "active",
    category: "inspire",
    description: "鼓舞全体，恢复少量生命并为自身提供守护。",
    targetType: "allAllies",
    effect: "heal",
    element: "life",
    mpCost: 20,
    cooldown: 4,
    baseWeight: 90,
    basePower: 58,
    scaling: { int: 0.38 },
    canCrit: false,
    selfStatus: {
      key: "guarded",
      chance: 1,
      duration: 2,
      potency: 0.2
    },
    weightTuning: {
      allyHpBelow: { threshold: 0.55, delta: 30 },
      enemyCountAtLeast: { count: 3, delta: 15 }
    }
  },
  mage_arcane_bolt: {
    id: "mage_arcane_bolt",
    name: "奥术冲击",
    kind: "active",
    category: "assault",
    description: "高频率的单体法术攻击。",
    targetType: "singleEnemy",
    effect: "damage",
    damageType: "magic",
    element: "fire",
    mpCost: 12,
    cooldown: 1,
    baseWeight: 120,
    basePower: 86,
    scaling: { int: 1.05 },
    canCrit: true
  },
  mage_frost_nova: {
    id: "mage_frost_nova",
    name: "霜环爆发",
    kind: "active",
    category: "afflict",
    description: "寒冰爆发攻击全体敌人，并有概率冻结。",
    targetType: "allEnemies",
    effect: "damage",
    damageType: "magic",
    element: "ice",
    mpCost: 26,
    cooldown: 4,
    baseWeight: 108,
    basePower: 72,
    scaling: { int: 0.8 },
    canCrit: true,
    targetStatus: {
      key: "frozen",
      chance: 0.22,
      duration: 1
    },
    weightTuning: {
      enemyCountAtLeast: { count: 3, delta: 30 }
    }
  },
  mage_flame_wave: {
    id: "mage_flame_wave",
    name: "烈焰波",
    kind: "active",
    category: "assault",
    description: "火焰扫射，对前后排敌人造成伤害并附加灼烧。",
    targetType: "allEnemies",
    effect: "damage",
    damageType: "magic",
    element: "fire",
    mpCost: 24,
    cooldown: 3,
    baseWeight: 110,
    basePower: 78,
    scaling: { int: 0.92 },
    canCrit: true,
    targetStatus: {
      key: "burning",
      chance: 0.4,
      duration: 2,
      potency: 0.04
    },
    weightTuning: {
      enemyCountAtLeast: { count: 2, delta: 18 }
    }
  },
  mage_mana_current: {
    id: "mage_mana_current",
    name: "潮汐导引",
    kind: "active",
    category: "inspire",
    description: "召唤流水回路，为全体友军回复生命。",
    targetType: "allAllies",
    effect: "heal",
    element: "water",
    mpCost: 22,
    cooldown: 4,
    baseWeight: 92,
    basePower: 64,
    scaling: { int: 0.65 },
    canCrit: false,
    weightTuning: {
      allyHpBelow: { threshold: 0.58, delta: 35 }
    }
  },
  mage_emergency_barrier: {
    id: "mage_emergency_barrier",
    name: "紧急护幕",
    kind: "active",
    category: "defend",
    description: "恢复自身并进入守护状态。",
    targetType: "self",
    effect: "heal",
    element: "wind",
    mpCost: 16,
    cooldown: 3,
    baseWeight: 96,
    basePower: 82,
    scaling: { int: 0.5, maxHp: 0.02 },
    canCrit: false,
    selfStatus: {
      key: "guarded",
      chance: 1,
      duration: 1,
      potency: 0.2
    },
    actionDeltaSelf: 380,
    weightTuning: {
      selfHpBelow: { threshold: 0.4, delta: 40 }
    }
  },
  enemy_claw: {
    id: "enemy_claw",
    name: "撕裂爪击",
    kind: "active",
    category: "assault",
    description: "野兽的基础爪击。",
    targetType: "singleEnemy",
    effect: "damage",
    damageType: "physical",
    mpCost: 0,
    cooldown: 0,
    baseWeight: 100,
    basePower: 68,
    scaling: { str: 0.9 },
    canCrit: true
  },
  enemy_poison_spit: {
    id: "enemy_poison_spit",
    name: "毒液喷吐",
    kind: "active",
    category: "afflict",
    description: "对单体目标施加中毒。",
    targetType: "singleEnemy",
    effect: "damage",
    damageType: "magic",
    element: "dark",
    mpCost: 10,
    cooldown: 2,
    baseWeight: 108,
    basePower: 74,
    scaling: { int: 0.45, str: 0.4 },
    canCrit: true,
    targetStatus: {
      key: "poisoned",
      chance: 0.45,
      duration: 3,
      potency: 0.035
    }
  },
  enemy_rush: {
    id: "enemy_rush",
    name: "狂袭",
    kind: "active",
    category: "inspire",
    description: "瞬间加速并攻击单体目标。",
    targetType: "singleEnemy",
    effect: "damage",
    damageType: "physical",
    element: "wind",
    mpCost: 12,
    cooldown: 2,
    baseWeight: 104,
    basePower: 76,
    scaling: { str: 0.84 },
    canCrit: true,
    actionDeltaSelf: 420
  }
};

export const battlePassiveSkills: Record<string, BattlePassiveSkillDefinition> = {
  passive_plate_mastery: {
    id: "passive_plate_mastery",
    name: "板甲精通",
    kind: "passive",
    description: "提升生命、防御和减伤。",
    modifiers: {
      flat: { maxHp: 420, def: 38 },
      ratio: { damageReduction: 0.06 }
    }
  },
  passive_resolute_heart: {
    id: "passive_resolute_heart",
    name: "坚毅之心",
    kind: "passive",
    description: "提升嘲讽和吸血。",
    modifiers: {
      flat: { aggro: 24 },
      ratio: { lifeSteal: 0.04 }
    }
  },
  passive_arcane_flow: {
    id: "passive_arcane_flow",
    name: "奥术潮汐",
    kind: "passive",
    description: "提升法力和法术强度。",
    modifiers: {
      flat: { maxMp: 240, int: 25, elementalPierce: 0.05 }
    }
  },
  passive_frost_focus: {
    id: "passive_frost_focus",
    name: "冰霜专注",
    kind: "passive",
    description: "提升暴击率与寒冰加成。",
    modifiers: {
      flat: { critRate: 0.05 },
      elementBoost: { ice: 0.12 }
    }
  },
  passive_enemy_feral: {
    id: "passive_enemy_feral",
    name: "野性",
    kind: "passive",
    description: "敌人基础成长增益。",
    modifiers: {
      flat: { str: 18, agi: 14 }
    }
  }
};

export const battleTalents: Record<string, BattleTalentDefinition> = {
  talent_oathbound_guard: {
    id: "talent_oathbound_guard",
    name: "誓约守壁",
    kind: "talent",
    description: "强化守护姿态与光元素输出。",
    modifiers: {
      ratio: { maxHp: 0.08, damageReduction: 0.04 },
      elementBoost: { light: 0.12 }
    }
  },
  talent_starweaver: {
    id: "talent_starweaver",
    name: "群星织法",
    kind: "talent",
    description: "强化元素增伤与暴击。",
    modifiers: {
      flat: { critRate: 0.04, allBoost: 0.08, elementalPierce: 0.05 }
    }
  },
  talent_enemy_predator: {
    id: "talent_enemy_predator",
    name: "掠食本能",
    kind: "talent",
    description: "提升敌方攻击倾向。",
    modifiers: {
      ratio: { damageBoost: 0.06 }
    }
  }
};

export function getBattleActiveSkill(skillId: string): BattleActiveSkillDefinition | null {
  return battleActiveSkills[skillId] ?? null;
}

export function getBattlePassiveSkill(skillId: string): BattlePassiveSkillDefinition | null {
  return battlePassiveSkills[skillId] ?? null;
}

export function getBattleTalent(skillId: string): BattleTalentDefinition | null {
  return battleTalents[skillId] ?? null;
}
