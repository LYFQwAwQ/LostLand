export type EnhancementAidEffectType = "success_boost" | "failure_protection";

export interface EnhancementAidDefinition {
  id: string;
  name: string;
  description: string;
  effectType: EnhancementAidEffectType;
  successRateBonus: number;
  preserveMaterialOnFailure: boolean;
  initialStock: number;
}

export const ENHANCEMENT_AID_DEFINITIONS: EnhancementAidDefinition[] = [
  {
    id: "enhance_lucky_talisman",
    name: "幸运护符",
    description: "本次强化成功率 +8%。",
    effectType: "success_boost",
    successRateBonus: 0.08,
    preserveMaterialOnFailure: false,
    initialStock: 8
  },
  {
    id: "enhance_guard_rune",
    name: "固守符印",
    description: "本次强化失败时保护主材料不被消耗（金币仍会扣除）。",
    effectType: "failure_protection",
    successRateBonus: 0,
    preserveMaterialOnFailure: true,
    initialStock: 5
  }
];

export const ENHANCEMENT_AID_BY_ID: Record<string, EnhancementAidDefinition> = ENHANCEMENT_AID_DEFINITIONS.reduce<
  Record<string, EnhancementAidDefinition>
>((acc, definition) => {
  acc[definition.id] = definition;
  return acc;
}, {});

export function buildDefaultEnhancementAidStock(): Record<string, number> {
  return ENHANCEMENT_AID_DEFINITIONS.reduce<Record<string, number>>((acc, definition) => {
    const quantity = Math.max(0, Math.floor(definition.initialStock));
    if (quantity > 0) {
      acc[definition.id] = quantity;
    }
    return acc;
  }, {});
}

