import defaultConfigJson from "./bulletinMissions/default.json";
import holyHeartlandConfigJson from "./bulletinMissions/holy-heartland.json";
import ironFrontierConfigJson from "./bulletinMissions/iron-frontier.json";
import type { InventoryResourceRarity } from "../../types/game";

export interface BulletinMissionAcceptanceConfig {
  baseAcceptedLimit: number;
}

export interface BulletinMissionRewardValueConfig {
  base: number;
  perScore: number;
  min: number;
  swingRange: [number, number];
}

export interface BulletinMissionDominionConfig {
  missionCount: {
    collect: number;
    hunt: number;
  };
  collect: {
    targetTypeCountRange: [number, number];
    requiredByRarity: Record<InventoryResourceRarity, [number, number]>;
  };
  hunt: {
    targetTypeCountRange: [number, number];
    requiredCountRange: [number, number];
  };
  reward: {
    materialRewardCountRange: [number, number];
    consumableRewardCountRange: [number, number];
    allowedMaterialRarities: InventoryResourceRarity[];
    allowedConsumableRarities: InventoryResourceRarity[];
    bounty: BulletinMissionRewardValueConfig;
    reputation: BulletinMissionRewardValueConfig;
  };
}

interface BulletinMissionRewardValueConfigRaw {
  base?: number;
  perScore?: number;
  min?: number;
  swingRange?: number[];
}

interface BulletinMissionDominionConfigRaw {
  missionCount?: {
    collect?: number;
    hunt?: number;
  };
  collect?: {
    targetTypeCountRange?: number[];
    requiredByRarity?: Partial<Record<InventoryResourceRarity, number[]>>;
  };
  hunt?: {
    targetTypeCountRange?: number[];
    requiredCountRange?: number[];
  };
  reward?: {
    materialRewardCountRange?: number[];
    consumableRewardCountRange?: number[];
    allowedMaterialRarities?: InventoryResourceRarity[];
    allowedConsumableRarities?: InventoryResourceRarity[];
    bounty?: BulletinMissionRewardValueConfigRaw;
    reputation?: BulletinMissionRewardValueConfigRaw;
  };
}

const ALL_RARITIES: InventoryResourceRarity[] = ["common", "uncommon", "rare", "epic"];

const BULLETIN_MISSION_ACCEPTANCE_CONFIG: BulletinMissionAcceptanceConfig = {
  baseAcceptedLimit: 4
};

function clampInt(value: number | undefined, fallback: number, min: number): number {
  const numberValue = Number.isFinite(value) ? Math.floor(value ?? fallback) : fallback;
  return Math.max(min, numberValue);
}

function sanitizeRange(raw: number[] | undefined, fallback: [number, number], min: number): [number, number] {
  const first = clampInt(raw?.[0], fallback[0], min);
  const second = clampInt(raw?.[1], fallback[1], min);
  if (first <= second) {
    return [first, second];
  }
  return [second, first];
}

function sanitizeRatioRange(raw: number[] | undefined, fallback: [number, number]): [number, number] {
  const first = Number.isFinite(raw?.[0]) ? (raw?.[0] as number) : fallback[0];
  const second = Number.isFinite(raw?.[1]) ? (raw?.[1] as number) : fallback[1];
  const safeFirst = Math.max(0, first);
  const safeSecond = Math.max(0, second);
  if (safeFirst <= safeSecond) {
    return [safeFirst, safeSecond];
  }
  return [safeSecond, safeFirst];
}

function sanitizeRarityPool(
  raw: InventoryResourceRarity[] | undefined,
  fallback: InventoryResourceRarity[]
): InventoryResourceRarity[] {
  if (!raw) {
    return [...fallback];
  }
  const pool = raw.filter((rarity) => ALL_RARITIES.includes(rarity));
  if (pool.length > 0) {
    return [...new Set(pool)];
  }
  return [...fallback];
}

function sanitizeRewardValueConfig(
  raw: BulletinMissionRewardValueConfigRaw | undefined,
  fallback: BulletinMissionRewardValueConfig
): BulletinMissionRewardValueConfig {
  return {
    base: clampInt(raw?.base, fallback.base, 0),
    perScore: Number.isFinite(raw?.perScore) ? Math.max(0, raw?.perScore ?? fallback.perScore) : fallback.perScore,
    min: clampInt(raw?.min, fallback.min, 0),
    swingRange: sanitizeRatioRange(raw?.swingRange, fallback.swingRange)
  };
}

function sanitizeConfig(
  raw: BulletinMissionDominionConfigRaw | undefined,
  fallback: BulletinMissionDominionConfig
): BulletinMissionDominionConfig {
  return {
    missionCount: {
      collect: clampInt(raw?.missionCount?.collect, fallback.missionCount.collect, 0),
      hunt: clampInt(raw?.missionCount?.hunt, fallback.missionCount.hunt, 0)
    },
    collect: {
      targetTypeCountRange: sanitizeRange(
        raw?.collect?.targetTypeCountRange,
        fallback.collect.targetTypeCountRange,
        1
      ),
      requiredByRarity: {
        common: sanitizeRange(raw?.collect?.requiredByRarity?.common, fallback.collect.requiredByRarity.common, 1),
        uncommon: sanitizeRange(raw?.collect?.requiredByRarity?.uncommon, fallback.collect.requiredByRarity.uncommon, 1),
        rare: sanitizeRange(raw?.collect?.requiredByRarity?.rare, fallback.collect.requiredByRarity.rare, 1),
        epic: sanitizeRange(raw?.collect?.requiredByRarity?.epic, fallback.collect.requiredByRarity.epic, 1)
      }
    },
    hunt: {
      targetTypeCountRange: sanitizeRange(raw?.hunt?.targetTypeCountRange, fallback.hunt.targetTypeCountRange, 1),
      requiredCountRange: sanitizeRange(raw?.hunt?.requiredCountRange, fallback.hunt.requiredCountRange, 1)
    },
    reward: {
      materialRewardCountRange: sanitizeRange(
        raw?.reward?.materialRewardCountRange,
        fallback.reward.materialRewardCountRange,
        0
      ),
      consumableRewardCountRange: sanitizeRange(
        raw?.reward?.consumableRewardCountRange,
        fallback.reward.consumableRewardCountRange,
        0
      ),
      allowedMaterialRarities: sanitizeRarityPool(
        raw?.reward?.allowedMaterialRarities,
        fallback.reward.allowedMaterialRarities
      ),
      allowedConsumableRarities: sanitizeRarityPool(
        raw?.reward?.allowedConsumableRarities,
        fallback.reward.allowedConsumableRarities
      ),
      bounty: sanitizeRewardValueConfig(raw?.reward?.bounty, fallback.reward.bounty),
      reputation: sanitizeRewardValueConfig(raw?.reward?.reputation, fallback.reward.reputation)
    }
  };
}

const RAW_DEFAULT_BULLETIN_MISSION_CONFIG = defaultConfigJson as BulletinMissionDominionConfigRaw;
const RAW_HOLY_HEARTLAND_BULLETIN_MISSION_CONFIG = holyHeartlandConfigJson as BulletinMissionDominionConfigRaw;
const RAW_IRON_FRONTIER_BULLETIN_MISSION_CONFIG = ironFrontierConfigJson as BulletinMissionDominionConfigRaw;

const DEFAULT_BULLETIN_MISSION_CONFIG: BulletinMissionDominionConfig = {
  missionCount: {
    collect: 2,
    hunt: 2
  },
  collect: {
    targetTypeCountRange: [1, 2],
    requiredByRarity: {
      common: [6, 12],
      uncommon: [4, 9],
      rare: [3, 6],
      epic: [2, 4]
    }
  },
  hunt: {
    targetTypeCountRange: [1, 2],
    requiredCountRange: [4, 10]
  },
  reward: {
    materialRewardCountRange: [1, 2],
    consumableRewardCountRange: [1, 1],
    allowedMaterialRarities: [...ALL_RARITIES],
    allowedConsumableRarities: [...ALL_RARITIES],
    bounty: {
      base: 220,
      perScore: 42,
      min: 300,
      swingRange: [1, 1]
    },
    reputation: {
      base: 4,
      perScore: 0.9,
      min: 8,
      swingRange: [1, 1]
    }
  }
};

const SANITIZED_DEFAULT_BULLETIN_MISSION_CONFIG = sanitizeConfig(
  RAW_DEFAULT_BULLETIN_MISSION_CONFIG,
  DEFAULT_BULLETIN_MISSION_CONFIG
);

const DOMINION_BULLETIN_MISSION_CONFIGS: Record<string, BulletinMissionDominionConfig> = {
  "holy-heartland": sanitizeConfig(
    RAW_HOLY_HEARTLAND_BULLETIN_MISSION_CONFIG,
    SANITIZED_DEFAULT_BULLETIN_MISSION_CONFIG
  ),
  "iron-frontier": sanitizeConfig(
    RAW_IRON_FRONTIER_BULLETIN_MISSION_CONFIG,
    SANITIZED_DEFAULT_BULLETIN_MISSION_CONFIG
  )
};

export function getBulletinMissionConfigByDominion(dominionId: string): BulletinMissionDominionConfig {
  return DOMINION_BULLETIN_MISSION_CONFIGS[dominionId] ?? SANITIZED_DEFAULT_BULLETIN_MISSION_CONFIG;
}

export function getBulletinMissionAcceptedLimit(extraCapacity = 0): number {
  const bonus = Number.isFinite(extraCapacity) ? Math.max(0, Math.floor(extraCapacity)) : 0;
  return Math.max(0, BULLETIN_MISSION_ACCEPTANCE_CONFIG.baseAcceptedLimit + bonus);
}
