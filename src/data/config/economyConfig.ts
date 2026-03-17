import { computeEquipmentInternalScore } from "../../lib/equipmentScoring";
import type { EquipmentQuality, EquipmentRank, EquipmentSlot, GeneratedEquipment } from "../../types/game";

const QUALITY_PRICE_MULTIPLIER: Record<EquipmentQuality, number> = {
  common: 1,
  uncommon: 1.35,
  rare: 2.1,
  epic: 3.9,
  legendary: 8.5,
  mythic: 15
};

const RANK_PRICE_MULTIPLIER: Record<EquipmentRank, number> = {
  crude: 0.88,
  fine: 1,
  superior: 1.2,
  perfect: 1.5
};

export interface EquipmentQuickSellFilter {
  qualities?: EquipmentQuality[];
  ranks?: EquipmentRank[];
  slots?: EquipmentSlot[];
  minLevel?: number | null;
  maxLevel?: number | null;
  minScore?: number | null;
  maxScore?: number | null;
  minEnhanceLevel?: number | null;
  maxEnhanceLevel?: number | null;
  excludeEnhanced?: boolean;
}

export const ECONOMY_CONFIG = {
  initialGold: 1000,
  initialReputation: 0,
  backpack: {
    normalEquipmentCapacity: 100,
    seedInventoryCount: 64
  },
  equipmentTrade: {
    offerCountByAction: {
      shop: 8,
      market: 10
    },
    levelPriceFactor: 50,
    qualityPriceMultiplier: QUALITY_PRICE_MULTIPLIER,
    rankPriceMultiplier: RANK_PRICE_MULTIPLIER,
    scoreBlendWeight: 0.14,
    scoreNormalizationBase: 180,
    enhancementLevelPriceWeight: 0.03,
    buyMarkup: 1.12,
    sellRatio: 0.55,
    minBasePrice: 20,
    minBuyPrice: 80,
    minSellPrice: 40,
    roundStep: 5,
    quickSell: {
      defaultFilter: {
        maxLevel: 25,
        qualities: ["common", "uncommon", "rare"],
        ranks: ["crude", "fine"],
        excludeEnhanced: true,
        maxEnhanceLevel: 0
      } satisfies EquipmentQuickSellFilter
    }
  }
} as const;

function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const safeStep = Math.max(1, Math.floor(step));
  return Math.max(0, Math.round(value / safeStep) * safeStep);
}

function resolveBasePrice(item: GeneratedEquipment, enhancementLevel = 0): number {
  const score = computeEquipmentInternalScore(item);
  const qualityMultiplier = ECONOMY_CONFIG.equipmentTrade.qualityPriceMultiplier[item.quality];
  const rankMultiplier = ECONOMY_CONFIG.equipmentTrade.rankPriceMultiplier[item.rank];
  const normalizedScore = Math.max(0, score) / ECONOMY_CONFIG.equipmentTrade.scoreNormalizationBase;
  const scoreMultiplier = 1 + normalizedScore * ECONOMY_CONFIG.equipmentTrade.scoreBlendWeight;
  const enhancementMultiplier =
    1 + Math.max(0, Math.floor(enhancementLevel)) * ECONOMY_CONFIG.equipmentTrade.enhancementLevelPriceWeight;
  const levelBasePrice = Math.max(1, Math.floor(item.level)) * ECONOMY_CONFIG.equipmentTrade.levelPriceFactor;
  const rawPrice = levelBasePrice * qualityMultiplier * rankMultiplier * scoreMultiplier * enhancementMultiplier;
  return Math.max(
    ECONOMY_CONFIG.equipmentTrade.minBasePrice,
    roundToStep(rawPrice, ECONOMY_CONFIG.equipmentTrade.roundStep)
  );
}

export function getEquipmentBaseTradePrice(item: GeneratedEquipment, enhancementLevel = 0): number {
  return resolveBasePrice(item, enhancementLevel);
}

export function getEquipmentBuyPrice(item: GeneratedEquipment, enhancementLevel = 0): number {
  const price = resolveBasePrice(item, enhancementLevel) * ECONOMY_CONFIG.equipmentTrade.buyMarkup;
  return Math.max(
    ECONOMY_CONFIG.equipmentTrade.minBuyPrice,
    roundToStep(price, ECONOMY_CONFIG.equipmentTrade.roundStep)
  );
}

export function getEquipmentSellPrice(item: GeneratedEquipment, enhancementLevel = 0): number {
  const price = resolveBasePrice(item, enhancementLevel) * ECONOMY_CONFIG.equipmentTrade.sellRatio;
  return Math.max(
    ECONOMY_CONFIG.equipmentTrade.minSellPrice,
    roundToStep(price, ECONOMY_CONFIG.equipmentTrade.roundStep)
  );
}
