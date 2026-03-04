import type { EquipmentTemplate } from "../types/game";

const standardRankWeights = {
  crude: 36,
  fine: 38,
  superior: 20,
  perfect: 6
} as const;

const standardQualityWeights = {
  common: 32,
  uncommon: 28,
  rare: 20,
  epic: 12,
  legendary: 6,
  mythic: 2
} as const;

export const equipmentTemplates: EquipmentTemplate[] = [
  {
    id: "dawn-helm",
    name: "曙光战盔",
    slot: "head",
    subtype: "heavyHelm",
    baseWeight: 14,
    t1Stats: [
      { key: "hp", label: "生命值", lvl1Base: 120, growthRate: 18 },
      { key: "def", label: "物理防御", lvl1Base: 18, growthRate: 3 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "def", label: "物理防御", min: 5, max: 18, weight: 34 },
      { key: "hp", label: "生命值", min: 25, max: 95, weight: 28 },
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.04, weight: 22 },
      { key: "thorns", label: "反伤", min: 0.01, max: 0.06, weight: 16 }
    ]
  },
  {
    id: "starveil-hood",
    name: "星纱兜帽",
    slot: "head",
    subtype: "lightHelm",
    baseWeight: 12,
    t1Stats: [
      { key: "mp", label: "法力值", lvl1Base: 95, growthRate: 16 },
      { key: "int", label: "智力", lvl1Base: 11, growthRate: 2 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "int", label: "智力", min: 2, max: 9, weight: 34 },
      { key: "evasion", label: "闪避率", min: 0.01, max: 0.05, weight: 26 },
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.04, weight: 18 },
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.04, weight: 22 }
    ]
  },
  {
    id: "fortress-armor",
    name: "堡垒重甲",
    slot: "armor",
    subtype: "heavyArmor",
    baseWeight: 15,
    t1Stats: [
      { key: "hp", label: "生命值", lvl1Base: 170, growthRate: 30 },
      { key: "def", label: "物理防御", lvl1Base: 36, growthRate: 6 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "def", label: "物理防御", min: 10, max: 30, weight: 32 },
      { key: "hp", label: "生命值", min: 40, max: 140, weight: 26 },
      { key: "thorns", label: "反伤", min: 0.02, max: 0.09, weight: 22 },
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.05, weight: 20 }
    ]
  },
  {
    id: "ashen-robe",
    name: "灰烬法袍",
    slot: "armor",
    subtype: "robe",
    baseWeight: 20,
    t1Stats: [
      { key: "hp", label: "生命值", lvl1Base: 90, growthRate: 16 },
      { key: "int", label: "智力", lvl1Base: 12, growthRate: 2 },
      { key: "mp", label: "法力值", lvl1Base: 70, growthRate: 14 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "int", label: "智力", min: 3, max: 12, weight: 28 },
      { key: "elementalPierce", label: "元素穿透", min: 0.02, max: 0.08, weight: 24 },
      { key: "allBoost", label: "全元素加成", min: 0.01, max: 0.04, weight: 18 },
      { key: "evasion", label: "闪避率", min: 0.01, max: 0.04, weight: 30 }
    ]
  },
  {
    id: "iron-longsword",
    name: "黑铁长剑",
    slot: "oneHand",
    subtype: "longSword",
    baseWeight: 22,
    t1Stats: [
      { key: "str", label: "力量", lvl1Base: 14, growthRate: 2 },
      { key: "agi", label: "敏捷", lvl1Base: 10, growthRate: 1 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "str", label: "力量", min: 2, max: 8, weight: 36 },
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.05, weight: 20 },
      { key: "penetration", label: "物理穿透", min: 6, max: 24, weight: 24 },
      { key: "lifeSteal", label: "吸血", min: 0.01, max: 0.03, weight: 20 }
    ]
  },
  {
    id: "tower-shield",
    name: "誓约塔盾",
    slot: "oneHand",
    subtype: "shield",
    baseWeight: 18,
    t1Stats: [
      { key: "def", label: "物理防御", lvl1Base: 30, growthRate: 5 },
      { key: "hp", label: "生命值", lvl1Base: 140, growthRate: 24 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "def", label: "物理防御", min: 8, max: 24, weight: 40 },
      { key: "thorns", label: "反伤", min: 0.02, max: 0.08, weight: 20 },
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.04, weight: 22 },
      { key: "hp", label: "生命值", min: 30, max: 120, weight: 18 }
    ]
  },
  {
    id: "oath-greatsword",
    name: "誓约巨剑",
    slot: "twoHand",
    subtype: "greatSword",
    baseWeight: 11,
    t1Stats: [
      { key: "str", label: "力量", lvl1Base: 22, growthRate: 4 },
      { key: "penetration", label: "物理穿透", lvl1Base: 12, growthRate: 2 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "str", label: "力量", min: 4, max: 14, weight: 30 },
      { key: "critDamage", label: "暴击伤害", min: 0.08, max: 0.24, weight: 24 },
      { key: "penetration", label: "物理穿透", min: 8, max: 30, weight: 28 },
      { key: "lifeSteal", label: "吸血", min: 0.01, max: 0.05, weight: 18 }
    ]
  },
  {
    id: "storm-spear",
    name: "破阵长矛",
    slot: "twoHand",
    subtype: "spear",
    baseWeight: 10,
    t1Stats: [
      { key: "agi", label: "敏捷", lvl1Base: 18, growthRate: 3 },
      { key: "penetration", label: "物理穿透", lvl1Base: 10, growthRate: 2 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "agi", label: "敏捷", min: 3, max: 12, weight: 28 },
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.06, weight: 26 },
      { key: "penetration", label: "物理穿透", min: 8, max: 28, weight: 30 },
      { key: "evasion", label: "闪避率", min: 0.01, max: 0.04, weight: 16 }
    ]
  },
  {
    id: "war-bracer",
    name: "征战护手",
    slot: "bracer",
    subtype: "plateBracer",
    baseWeight: 16,
    t1Stats: [
      { key: "str", label: "力量", lvl1Base: 11, growthRate: 2 },
      { key: "def", label: "物理防御", lvl1Base: 14, growthRate: 2 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "str", label: "力量", min: 2, max: 8, weight: 26 },
      { key: "def", label: "物理防御", min: 4, max: 15, weight: 30 },
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.04, weight: 20 },
      { key: "lifeSteal", label: "吸血", min: 0.01, max: 0.03, weight: 24 }
    ]
  },
  {
    id: "spell-bracer",
    name: "咒纹护手",
    slot: "bracer",
    subtype: "clothBracer",
    baseWeight: 14,
    t1Stats: [
      { key: "int", label: "智力", lvl1Base: 10, growthRate: 2 },
      { key: "mp", label: "法力值", lvl1Base: 60, growthRate: 10 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "int", label: "智力", min: 2, max: 8, weight: 32 },
      { key: "elementalPierce", label: "元素穿透", min: 0.02, max: 0.07, weight: 26 },
      { key: "allBoost", label: "全元素加成", min: 0.01, max: 0.04, weight: 20 },
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.04, weight: 22 }
    ]
  },
  {
    id: "steel-greaves",
    name: "钢纹护腿",
    slot: "legs",
    subtype: "heavyLegGuard",
    baseWeight: 14,
    t1Stats: [
      { key: "hp", label: "生命值", lvl1Base: 130, growthRate: 20 },
      { key: "def", label: "物理防御", lvl1Base: 20, growthRate: 3 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "def", label: "物理防御", min: 6, max: 20, weight: 32 },
      { key: "hp", label: "生命值", min: 28, max: 110, weight: 24 },
      { key: "evasion", label: "闪避率", min: 0.01, max: 0.04, weight: 20 },
      { key: "thorns", label: "反伤", min: 0.01, max: 0.06, weight: 24 }
    ]
  },
  {
    id: "ranger-legguard",
    name: "巡风护腿",
    slot: "legs",
    subtype: "lightLegGuard",
    baseWeight: 12,
    t1Stats: [
      { key: "agi", label: "敏捷", lvl1Base: 12, growthRate: 2 },
      { key: "hp", label: "生命值", lvl1Base: 90, growthRate: 14 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "agi", label: "敏捷", min: 2, max: 9, weight: 32 },
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.04, weight: 24 },
      { key: "evasion", label: "闪避率", min: 0.01, max: 0.05, weight: 24 },
      { key: "penetration", label: "物理穿透", min: 5, max: 18, weight: 20 }
    ]
  },
  {
    id: "fire-medium",
    name: "灼焰媒介",
    slot: "castingMedium",
    subtype: "fireMedium",
    baseWeight: 15,
    t1Stats: [
      { key: "int", label: "智力", lvl1Base: 16, growthRate: 3 },
      { key: "mp", label: "法力值", lvl1Base: 80, growthRate: 15 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "elementalPierce", label: "元素穿透", min: 0.03, max: 0.1, weight: 30 },
      { key: "critDamage", label: "暴击伤害", min: 0.05, max: 0.2, weight: 20 },
      { key: "allBoost", label: "全元素加成", min: 0.01, max: 0.04, weight: 18 },
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.05, weight: 32 }
    ]
  },
  {
    id: "frost-medium",
    name: "霜语媒介",
    slot: "castingMedium",
    subtype: "frostMedium",
    baseWeight: 12,
    t1Stats: [
      { key: "int", label: "智力", lvl1Base: 15, growthRate: 3 },
      { key: "mp", label: "法力值", lvl1Base: 88, growthRate: 16 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.06, weight: 30 },
      { key: "allBoost", label: "全元素加成", min: 0.01, max: 0.04, weight: 24 },
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.05, weight: 20 },
      { key: "elementalPierce", label: "元素穿透", min: 0.02, max: 0.08, weight: 26 }
    ]
  },
  {
    id: "storm-medium",
    name: "风暴媒介",
    slot: "castingMedium",
    subtype: "stormMedium",
    baseWeight: 10,
    t1Stats: [
      { key: "int", label: "智力", lvl1Base: 18, growthRate: 3 },
      { key: "agi", label: "敏捷", lvl1Base: 10, growthRate: 2 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.06, weight: 26 },
      { key: "critDamage", label: "暴击伤害", min: 0.06, max: 0.22, weight: 24 },
      { key: "elementalPierce", label: "元素穿透", min: 0.02, max: 0.09, weight: 30 },
      { key: "evasion", label: "闪避率", min: 0.01, max: 0.04, weight: 20 }
    ]
  },
  {
    id: "fire-core",
    name: "余烬核心",
    slot: "castingCore",
    subtype: "fireCore",
    baseWeight: 8,
    t1Stats: [
      { key: "int", label: "智力", lvl1Base: 22, growthRate: 4 },
      { key: "mp", label: "法力值", lvl1Base: 66, growthRate: 11 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "critRate", label: "暴击率", min: 0.015, max: 0.06, weight: 24 },
      { key: "critDamage", label: "暴击伤害", min: 0.08, max: 0.24, weight: 20 },
      { key: "elementalPierce", label: "元素穿透", min: 0.02, max: 0.09, weight: 30 },
      { key: "allBoost", label: "全元素加成", min: 0.015, max: 0.05, weight: 26 }
    ]
  },
  {
    id: "oath-ring",
    name: "誓约戒指",
    slot: "accessory",
    subtype: "ring",
    baseWeight: 12,
    t1Stats: [
      { key: "str", label: "力量", lvl1Base: 9, growthRate: 2 },
      { key: "critRate", label: "暴击率", lvl1Base: 0.012, growthRate: 0.002 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "str", label: "力量", min: 2, max: 9, weight: 32 },
      { key: "critRate", label: "暴击率", min: 0.01, max: 0.05, weight: 26 },
      { key: "lifeSteal", label: "吸血", min: 0.01, max: 0.04, weight: 22 },
      { key: "penetration", label: "物理穿透", min: 6, max: 22, weight: 20 }
    ]
  },
  {
    id: "star-necklace",
    name: "星辉项链",
    slot: "accessory",
    subtype: "necklace",
    baseWeight: 10,
    t1Stats: [
      { key: "hp", label: "生命值", lvl1Base: 110, growthRate: 18 },
      { key: "allRes", label: "全元素抗性", lvl1Base: 0.012, growthRate: 0.002 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "hp", label: "生命值", min: 20, max: 100, weight: 28 },
      { key: "allRes", label: "全元素抗性", min: 0.01, max: 0.05, weight: 30 },
      { key: "allBoost", label: "全元素加成", min: 0.01, max: 0.04, weight: 20 },
      { key: "def", label: "物理防御", min: 5, max: 18, weight: 22 }
    ]
  },
  {
    id: "ember-bracelet",
    name: "余烬手镯",
    slot: "accessory",
    subtype: "bracelet",
    baseWeight: 11,
    t1Stats: [
      { key: "int", label: "智力", lvl1Base: 10, growthRate: 2 },
      { key: "allBoost", label: "全元素加成", lvl1Base: 0.01, growthRate: 0.002 }
    ],
    rankWeights: { ...standardRankWeights },
    qualityWeights: { ...standardQualityWeights },
    affixPool: [
      { key: "int", label: "智力", min: 2, max: 9, weight: 30 },
      { key: "elementalPierce", label: "元素穿透", min: 0.02, max: 0.08, weight: 28 },
      { key: "allBoost", label: "全元素加成", min: 0.01, max: 0.05, weight: 24 },
      { key: "mp", label: "法力值", min: 20, max: 90, weight: 18 }
    ]
  }
];
