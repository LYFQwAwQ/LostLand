import { equipmentTemplates } from "../equipmentTemplates";

type EnhancementMaterialCategory = "undead" | "beast" | "human";

export interface EnhancementMaterialRequirement {
  materialId: string;
  baseQuantity: number;
  growthPerLevel: number;
}

export interface EnhancementMaterialCost {
  materialId: string;
  quantity: number;
}

export interface EnhancementStageRequirement {
  minLevel: number;
  maxLevel: number;
  materials: EnhancementMaterialRequirement[];
}

interface EnhancementTemplateRequirement {
  category: EnhancementMaterialCategory;
  stages: EnhancementStageRequirement[];
}

const ENHANCEMENT_STAGE_RANGES: Array<{ minLevel: number; maxLevel: number }> = [
  { minLevel: 1, maxLevel: 3 },
  { minLevel: 4, maxLevel: 6 },
  { minLevel: 7, maxLevel: 9 },
  { minLevel: 10, maxLevel: 15 }
];

const MATERIAL_CHAIN_BY_CATEGORY: Record<EnhancementMaterialCategory, EnhancementMaterialRequirement[]> = {
  undead: [
    { materialId: "undead_ossified_powder", baseQuantity: 2, growthPerLevel: 0.38 },
    { materialId: "undead_crypt_iron", baseQuantity: 2, growthPerLevel: 0.44 },
    { materialId: "undead_soul_resin", baseQuantity: 2, growthPerLevel: 0.5 },
    { materialId: "undead_lord_phylactery", baseQuantity: 1, growthPerLevel: 0.36 }
  ],
  beast: [
    { materialId: "beast_tempered_horn", baseQuantity: 2, growthPerLevel: 0.36 },
    { materialId: "beast_blood_marrow", baseQuantity: 2, growthPerLevel: 0.42 },
    { materialId: "beast_primal_heart", baseQuantity: 2, growthPerLevel: 0.48 },
    { materialId: "beast_king_fang", baseQuantity: 1, growthPerLevel: 0.34 }
  ],
  human: [
    { materialId: "human_refined_steel", baseQuantity: 2, growthPerLevel: 0.35 },
    { materialId: "human_reinforced_plate", baseQuantity: 2, growthPerLevel: 0.43 },
    { materialId: "human_runed_bearing", baseQuantity: 2, growthPerLevel: 0.5 },
    { materialId: "human_masterwork_gear", baseQuantity: 1, growthPerLevel: 0.34 }
  ]
};

const TEMPLATE_CATEGORY_BY_ID: Record<string, EnhancementMaterialCategory> = {
  "dawn-helm": "human",
  "fortress-armor": "human",
  "iron-longsword": "human",
  "tower-shield": "human",
  "oath-greatsword": "human",
  "war-bracer": "human",
  "steel-greaves": "human",

  "storm-spear": "beast",
  "ranger-legguard": "beast",
  "windstride-boots": "beast",
  "oath-ring": "beast",

  "starveil-hood": "undead",
  "ashen-robe": "undead",
  "spell-bracer": "undead",
  "fire-medium": "undead",
  "frost-medium": "undead",
  "storm-medium": "undead",
  "fire-core": "undead",
  "star-necklace": "undead",
  "ember-bracelet": "undead"
};

const TEMPLATE_SCALE_BY_ID: Record<string, number> = {
  "dawn-helm": 1.05,
  "fortress-armor": 1.3,
  "iron-longsword": 1.02,
  "tower-shield": 1.18,
  "oath-greatsword": 1.2,
  "war-bracer": 0.9,
  "steel-greaves": 1.05,
  "storm-spear": 1.08,
  "ranger-legguard": 0.88,
  "windstride-boots": 0.84,
  "oath-ring": 0.76,
  "starveil-hood": 0.86,
  "ashen-robe": 1.04,
  "spell-bracer": 0.84,
  "fire-medium": 0.95,
  "frost-medium": 0.95,
  "storm-medium": 0.95,
  "fire-core": 0.9,
  "star-necklace": 0.78,
  "ember-bracelet": 0.78
};

const DEFAULT_TEMPLATE_CATEGORY: EnhancementMaterialCategory = "human";
const DEFAULT_TEMPLATE_SCALE = 1;

export const ENHANCEMENT_CONFIG = {
  maxLevel: {
    normal: 10,
    legendary: 15
  },
  successRateByTargetLevel: {
    1: 1,
    2: 1,
    3: 1,
    4: 1,
    5: 1,
    6: 0.8,
    7: 0.7,
    8: 0.6,
    9: 0.5,
    10: 0.3,
    11: 0.28,
    12: 0.25,
    13: 0.22,
    14: 0.2,
    15: 0.18
  } as Record<number, number>,
  cumulativeStatBonusByLevel: {
    0: 0,
    1: 0.05,
    2: 0.1,
    3: 0.15,
    4: 0.2,
    5: 0.25,
    6: 0.29,
    7: 0.33,
    8: 0.37,
    9: 0.41,
    10: 0.51,
    11: 0.58,
    12: 0.65,
    13: 0.72,
    14: 0.79,
    15: 0.86
  } as Record<number, number>,
  goldCost: {
    levelFactor: 100,
    enhancementGrowth: 1.2
  },
  materialStageMultiplier: [
    { minLevel: 1, maxLevel: 3, multiplier: 1 },
    { minLevel: 4, maxLevel: 6, multiplier: 1.2 },
    { minLevel: 7, maxLevel: 9, multiplier: 1.45 },
    { minLevel: 10, maxLevel: 12, multiplier: 1.8 },
    { minLevel: 13, maxLevel: 15, multiplier: 2.2 }
  ],
  failureConsumesResources: true
} as const;

export const ENHANCEMENT_RELATED_MATERIAL_IDS = [
  "undead_ossified_powder",
  "undead_crypt_iron",
  "undead_soul_resin",
  "undead_lord_phylactery",
  "beast_tempered_horn",
  "beast_blood_marrow",
  "beast_primal_heart",
  "beast_king_fang",
  "human_refined_steel",
  "human_reinforced_plate",
  "human_runed_bearing",
  "human_masterwork_gear"
] as const;

function buildTemplateRequirement(templateId: string): EnhancementTemplateRequirement {
  const category = TEMPLATE_CATEGORY_BY_ID[templateId] ?? DEFAULT_TEMPLATE_CATEGORY;
  const scale = TEMPLATE_SCALE_BY_ID[templateId] ?? DEFAULT_TEMPLATE_SCALE;
  const chain = MATERIAL_CHAIN_BY_CATEGORY[category];
  const stages = ENHANCEMENT_STAGE_RANGES.map((range, index) => {
    const chainEntry = chain[index] ?? chain[chain.length - 1];
    return {
      minLevel: range.minLevel,
      maxLevel: range.maxLevel,
      materials: [
        {
          materialId: chainEntry.materialId,
          baseQuantity: chainEntry.baseQuantity * scale,
          growthPerLevel: chainEntry.growthPerLevel * scale
        }
      ]
    };
  });
  return {
    category,
    stages
  };
}

const TEMPLATE_ENHANCEMENT_REQUIREMENTS: Record<string, EnhancementTemplateRequirement> = equipmentTemplates.reduce<
  Record<string, EnhancementTemplateRequirement>
>((acc, template) => {
  acc[template.id] = buildTemplateRequirement(template.id);
  return acc;
}, {});

export function resolveEnhancementMaxLevel(isLegendary: boolean): number {
  return isLegendary ? ENHANCEMENT_CONFIG.maxLevel.legendary : ENHANCEMENT_CONFIG.maxLevel.normal;
}

export function getEnhancementSuccessRate(targetLevel: number): number {
  const safeLevel = Math.max(1, Math.floor(targetLevel));
  return ENHANCEMENT_CONFIG.successRateByTargetLevel[safeLevel] ?? 0;
}

export function getEnhancementStatBonus(level: number): number {
  const safeLevel = Math.max(0, Math.floor(level));
  return ENHANCEMENT_CONFIG.cumulativeStatBonusByLevel[safeLevel] ?? 0;
}

export function getEnhancementTemplateRequirement(templateId: string): EnhancementTemplateRequirement {
  return TEMPLATE_ENHANCEMENT_REQUIREMENTS[templateId] ?? buildTemplateRequirement(templateId);
}

export function resolveEnhancementGoldCost(itemLevel: number, targetEnhanceLevel: number): number {
  const safeItemLevel = Math.max(1, Math.floor(itemLevel));
  const safeEnhanceLevel = Math.max(1, Math.floor(targetEnhanceLevel));
  const rawCost =
    safeItemLevel *
    ENHANCEMENT_CONFIG.goldCost.levelFactor *
    Math.pow(ENHANCEMENT_CONFIG.goldCost.enhancementGrowth, safeEnhanceLevel);
  return Math.max(1, Math.round(rawCost));
}

function resolveMaterialStageMultiplier(targetEnhanceLevel: number): number {
  const safeLevel = Math.max(1, Math.floor(targetEnhanceLevel));
  const matched = ENHANCEMENT_CONFIG.materialStageMultiplier.find(
    (stage) => safeLevel >= stage.minLevel && safeLevel <= stage.maxLevel
  );
  return matched?.multiplier ?? 1;
}

function resolveStageRequirement(
  requirement: EnhancementTemplateRequirement,
  targetEnhanceLevel: number
): EnhancementStageRequirement {
  const safeLevel = Math.max(1, Math.floor(targetEnhanceLevel));
  const exact = requirement.stages.find((stage) => safeLevel >= stage.minLevel && safeLevel <= stage.maxLevel);
  return exact ?? requirement.stages[requirement.stages.length - 1];
}

export function resolveEnhancementMaterialCost(templateId: string, targetEnhanceLevel: number): EnhancementMaterialCost[] {
  const safeLevel = Math.max(1, Math.floor(targetEnhanceLevel));
  const stageMultiplier = resolveMaterialStageMultiplier(safeLevel);
  const templateRequirement = getEnhancementTemplateRequirement(templateId);
  const stageRequirement = resolveStageRequirement(templateRequirement, safeLevel);

  return stageRequirement.materials
    .map((material) => {
      const scaledQuantity = (material.baseQuantity + material.growthPerLevel * (safeLevel - 1)) * stageMultiplier;
      return {
        materialId: material.materialId,
        quantity: Math.max(1, Math.ceil(scaledQuantity))
      };
    })
    .filter((item) => item.quantity > 0);
}
