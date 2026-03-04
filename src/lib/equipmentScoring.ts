import type { EquipmentQuality, EquipmentRank, GeneratedEquipment } from "../types/game";

export const EQUIPMENT_QUALITY_SCORE: Record<EquipmentQuality, number> = {
  common: 8,
  uncommon: 18,
  rare: 34,
  epic: 55,
  legendary: 82,
  mythic: 118
};

export const EQUIPMENT_RANK_SCORE: Record<EquipmentRank, number> = {
  crude: 6,
  fine: 18,
  superior: 40,
  perfect: 70
};

export const EQUIPMENT_SCORE_THRESHOLDS = {
  low: 48,
  fine: 82,
  rare: 120,
  epic: 162,
  legendary: 212
};

export type EquipmentScoreTier = "low" | "fine" | "rare" | "epic" | "legendary" | "mythic";

function normalizeStatValue(value: number): number {
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return value * 100;
  }
  return value;
}

export function computeEquipmentInternalScore(item: GeneratedEquipment): number {
  const t1Value = item.t1Stats.reduce((sum, stat) => sum + normalizeStatValue(stat.finalValue), 0);
  const affixValue = item.affixes.reduce((sum, affix) => sum + normalizeStatValue(affix.finalValue), 0);

  return (
    EQUIPMENT_QUALITY_SCORE[item.quality] +
    EQUIPMENT_RANK_SCORE[item.rank] +
    t1Value * 0.16 +
    affixValue * 0.24 +
    item.affixCount * 2
  );
}

export function resolveEquipmentScoreTier(score: number): EquipmentScoreTier {
  if (score < EQUIPMENT_SCORE_THRESHOLDS.low) {
    return "low";
  }
  if (score < EQUIPMENT_SCORE_THRESHOLDS.fine) {
    return "fine";
  }
  if (score < EQUIPMENT_SCORE_THRESHOLDS.rare) {
    return "rare";
  }
  if (score < EQUIPMENT_SCORE_THRESHOLDS.epic) {
    return "epic";
  }
  if (score < EQUIPMENT_SCORE_THRESHOLDS.legendary) {
    return "legendary";
  }
  return "mythic";
}
