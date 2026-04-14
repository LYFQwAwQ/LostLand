import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getMaterialDropCatalog } from "../data/battleDrops";
import { getBuildingMaterialCatalog } from "../data/buildingMaterials";
import {
  ENHANCEMENT_CONFIG,
  getEnhancementStatBonus,
  getEnhancementSuccessRate,
  resolveEnhancementGoldCost,
  resolveEnhancementMaterialCost,
  resolveEnhancementMaxLevel
} from "../data/config/equipmentEnhancementConfig";
import {
  ENHANCEMENT_AID_BY_ID,
  ENHANCEMENT_AID_DEFINITIONS,
  buildDefaultEnhancementAidStock,
  type EnhancementAidDefinition
} from "../data/config/equipmentEnhancementAidConfig";
import {
  ECONOMY_CONFIG,
  getEquipmentBuyPrice,
  getEquipmentSellPrice,
  type EquipmentQuickSellFilter
} from "../data/config/economyConfig";
import {
  clampHeroLevel,
  createInitialHeroProgressState,
  getHeroNextLevelExp,
  resolveBattleBaseExpByEnemyLevels,
  resolveBattleEnemyAverageLevel,
  resolveBattleLevelDeltaMultiplier
} from "../data/config/heroProgressionConfig";
import { initialConsumableStacks } from "../data/consumables";
import { equipmentTemplates } from "../data/equipmentTemplates";
import { heroMemoryMap, initialOwnedHeroMemoryIds } from "../data/heroMemories";
import {
  legendaryEquipmentIdByUid,
  legendaryEquipmentItemById,
  legendaryEquipments,
  legendaryEquipmentSkillsById
} from "../data/legendaryEquipments";
import { heroes } from "../data/mockData";
import { getPairedPaladinHandSlot, isPaladinHandSlot } from "../lib/equipmentCatalog";
import { computeEquipmentInternalScore } from "../lib/equipmentScoring";
import { generateEquipmentBatch, generateEquipmentFromTemplate } from "../lib/equipmentSystem";
import type { BattleDropSummary } from "../types/battle";
import type {
  BulletinMissionReward,
  EquipmentTemplate,
  EquipmentQuality,
  EquipmentRank,
  EquipmentSlot,
  GeneratedEquipment,
  HeroProgressState,
  InventoryConsumableStack,
  InventoryMaterialStack,
  InventoryMemoryStack,
  InventoryMaterialSourceType,
  InventoryResourceRarity,
  LegendaryEquipmentDefinition,
  LegendaryEquipmentSkillDefinition
} from "../types/game";
import { useOrganization } from "./OrganizationProvider";

export interface EquippedOwner {
  heroId: string;
  slotId: string;
}

export interface EquipmentInventorySnapshot {
  seed: string;
  equippedByHero: Record<string, Record<string, string>>;
  equippedLegendaryByHero?: Record<string, string[]>;
  ownedLegendaryEquipmentIds?: string[];
  droppedEquipmentItems?: GeneratedEquipment[];
  soldEquipmentItemUids?: string[];
  lockedEquipmentItemUids?: string[];
  equipmentEnhancementByUid?: Record<string, number>;
  enhancementAidStock?: Record<string, number>;
  materialStock?: Record<string, number>;
  consumableStock?: Record<string, number>;
  memoryOwnedIds?: string[];
  equippedMemoryByHero?: Record<string, string>;
  heroProgressById?: Record<string, HeroProgressState>;
  gold?: number;
  reputation?: number;
}

export interface EquipmentTradeActionResult {
  ok: boolean;
  reason: string | null;
  price: number;
}

export interface EquipmentCraftRequest {
  recipeId: string;
  recipeName: string;
  templateId: string;
  level: number;
  targetQuality: EquipmentQuality;
  goldCost: number;
  materials: Array<{ materialId: string; quantity: number }>;
  sourceTag?: string;
}

export interface EquipmentCraftResult {
  ok: boolean;
  reason: string | null;
  recipeId: string;
  recipeName: string;
  craftedItem: GeneratedEquipment | null;
  goldCost: number;
  materials: Array<{ materialId: string; quantity: number }>;
}

export interface EquipmentBulkSellResult {
  soldCount: number;
  skippedCount: number;
  totalPrice: number;
}

export interface EquipmentBulkSellFilter extends EquipmentQuickSellFilter {}

export interface EquipmentEnhancementPreview {
  itemUid: string;
  templateId: string;
  currentLevel: number;
  targetLevel: number;
  maxLevel: number;
  currentBonus: number;
  targetBonus: number;
  baseSuccessRate: number;
  forgeBonusRate: number;
  aidSuccessRateBonus: number;
  successRateCap: number;
  successRate: number;
  goldCost: number;
  materialCost: Array<{ materialId: string; materialName: string; rarity: InventoryResourceRarity; quantity: number; owned: number }>;
  selectedAid: EquipmentEnhancementAidItem | null;
  aidCost: number;
  materialConsumedOnFailure: boolean;
  canEnhance: boolean;
  reason: string | null;
}

export interface EquipmentEnhancementResult {
  ok: boolean;
  success: boolean;
  itemUid: string;
  previousLevel: number;
  currentLevel: number;
  maxLevel: number;
  successRate: number;
  goldCost: number;
  materialCost: Array<{ materialId: string; quantity: number }>;
  usedAidId: string | null;
  usedAidName: string | null;
  aidConsumed: boolean;
  materialConsumed: boolean;
  materialPreservedByAid: boolean;
  reason: string | null;
}

export interface EquipmentEnhancementAidItem {
  id: string;
  name: string;
  description: string;
  effectType: EnhancementAidDefinition["effectType"];
  successRateBonus: number;
  preserveMaterialOnFailure: boolean;
  owned: number;
}

export interface EquipmentEnhancementAttemptOptions {
  aidId?: string | null;
}

export interface MaterialPurchaseEntry {
  materialId: string;
  quantity: number;
  unitPrice: number;
}

export interface MaterialPurchaseResult {
  ok: boolean;
  reason: string | null;
  totalCost: number;
}

export interface InventoryCostPayResult {
  ok: boolean;
  reason: string | null;
}

export interface HeroBattleExpGainResult {
  heroId: string;
  gainedExp: number;
  previousLevel: number;
  currentLevel: number;
  currentExp: number;
  nextLevelExp: number;
}

interface EquipmentInventoryContextValue {
  items: GeneratedEquipment[];
  itemMap: Map<string, GeneratedEquipment>;
  gold: number;
  reputation: number;
  normalEquipmentCapacity: number;
  normalEquipmentCount: number;
  isBackpackEquipmentFull: boolean;
  equippedByHero: Record<string, Record<string, string>>;
  legendaryEquipments: LegendaryEquipmentDefinition[];
  legendaryEquipmentSkillsById: Record<string, LegendaryEquipmentSkillDefinition>;
  ownedLegendaryEquipmentIds: string[];
  materialItems: InventoryMaterialStack[];
  enhancementAidItems: EquipmentEnhancementAidItem[];
  consumableItems: InventoryConsumableStack[];
  memoryItems: InventoryMemoryStack[];
  equippedMemoryByHero: Record<string, string>;
  heroProgressById: Record<string, HeroProgressState>;
  refreshItems: () => void;
  collectBattleDrops: (drops: BattleDropSummary | null | undefined) => void;
  grantBattleHeroExp: (allyHeroIds: string[], enemyLevels: number[]) => HeroBattleExpGainResult[];
  getHeroProgress: (heroId: string) => HeroProgressState;
  grantMissionRewards: (reward: BulletinMissionReward | null | undefined) => void;
  buyEquipment: (item: GeneratedEquipment) => EquipmentTradeActionResult;
  craftEquipment: (request: EquipmentCraftRequest) => EquipmentCraftResult;
  sellEquipment: (itemUid: string) => EquipmentTradeActionResult;
  sellEquipmentBulk: (filter: EquipmentBulkSellFilter) => EquipmentBulkSellResult;
  isEquipmentLocked: (itemUid: string) => boolean;
  setEquipmentLocked: (itemUid: string, locked: boolean) => boolean;
  getEquipmentEnhanceLevel: (itemUid: string) => number;
  getEquipmentEnhanceBonus: (itemUid: string) => number;
  getEquipmentEnhancementPreview: (itemUid: string, options?: EquipmentEnhancementAttemptOptions) => EquipmentEnhancementPreview | null;
  enhanceEquipment: (itemUid: string, options?: EquipmentEnhancementAttemptOptions) => EquipmentEnhancementResult;
  buyMaterials: (entries: MaterialPurchaseEntry[]) => MaterialPurchaseResult;
  payCost: (cost: { gold: number; materials: Array<{ materialId: string; quantity: number }> }) => InventoryCostPayResult;
  consumeMaterials: (materials: Array<{ materialId: string; quantity: number }>) => boolean;
  equipItem: (
    heroId: string,
    slotId: string,
    itemUid: string,
    options?: { forceReplaceHand?: boolean }
  ) => boolean;
  unequipItem: (heroId: string, slotId: string) => void;
  setHeroMemory: (heroId: string, memoryId: string | null) => boolean;
  getHeroMemory: (heroId: string) => string | null;
  getMemoryOwner: (memoryId: string) => string | null;
  getLegendaryEquipmentOwner: (equipmentId: string) => string | null;
  getItemOwner: (itemUid: string) => EquippedOwner | null;
  getItemOwners: (itemUid: string) => EquippedOwner[];
  exportSnapshot: () => EquipmentInventorySnapshot;
  importSnapshot: (snapshot: EquipmentInventorySnapshot) => void;
}

const DEFAULT_SEED = "global-inventory-seed";
const MATERIAL_CATALOG = [
  ...getMaterialDropCatalog().map((item) => ({ ...item, sourceType: "battle" as InventoryMaterialSourceType })),
  ...getBuildingMaterialCatalog()
];
const MATERIAL_CATALOG_MAP = new Map(MATERIAL_CATALOG.map((item) => [item.id, item]));
const HERO_IDS = heroes.map((hero) => hero.id);
const HERO_ID_SET = new Set(HERO_IDS);
const HERO_CLASS_BY_ID = new Map(heroes.map((hero) => [hero.id, hero.heroClass]));
const EQUIPMENT_TEMPLATE_BY_ID = new Map<string, EquipmentTemplate>(equipmentTemplates.map((template) => [template.id, template]));
const LEGENDARY_EQUIPMENT_ID_SET = new Set(legendaryEquipments.map((item) => item.id));
const LEGENDARY_EQUIPMENT_LIMIT_PER_HERO = 2;
const EQUIPMENT_QUALITY_KEYS: EquipmentQuality[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const RESOURCE_RARITY_ORDER: Record<InventoryResourceRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3
};
const NORMAL_EQUIPMENT_CAPACITY = Math.max(1, Math.floor(ECONOMY_CONFIG.backpack.normalEquipmentCapacity));

const EquipmentInventoryContext = createContext<EquipmentInventoryContextValue | null>(null);

function buildInventory(seed: string): GeneratedEquipment[] {
  return generateEquipmentBatch(equipmentTemplates, ECONOMY_CONFIG.backpack.seedInventoryCount, {
    seed,
    level: 1,
    source: "global-inventory"
  });
}

function mergeUniqueItems(groups: GeneratedEquipment[][]): GeneratedEquipment[] {
  const seen = new Set<string>();
  const merged: GeneratedEquipment[] = [];
  groups.forEach((group) => {
    group.forEach((item) => {
      if (seen.has(item.uid)) {
        return;
      }
      seen.add(item.uid);
      merged.push(item);
    });
  });
  return merged;
}

function normalizeDroppedEquipmentItems(items: GeneratedEquipment[] | null | undefined): GeneratedEquipment[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const seen = new Set<string>();
  const result: GeneratedEquipment[] = [];
  items.forEach((item) => {
    if (!item || typeof item.uid !== "string" || item.uid.length <= 0 || seen.has(item.uid)) {
      return;
    }
    seen.add(item.uid);
    result.push(item);
  });
  return result;
}

function normalizeSoldEquipmentItemUids(itemUids: string[] | null | undefined): string[] {
  if (!Array.isArray(itemUids)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  itemUids.forEach((itemUid) => {
    if (typeof itemUid !== "string" || itemUid.length <= 0 || seen.has(itemUid)) {
      return;
    }
    seen.add(itemUid);
    result.push(itemUid);
  });
  return result;
}

function normalizeLockedEquipmentItemUids(itemUids: string[] | null | undefined): string[] {
  if (!Array.isArray(itemUids)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  itemUids.forEach((itemUid) => {
    if (typeof itemUid !== "string" || itemUid.length <= 0 || seen.has(itemUid)) {
      return;
    }
    seen.add(itemUid);
    result.push(itemUid);
  });
  return result;
}

function normalizeEquipmentEnhancementByUid(
  input: Record<string, number> | null | undefined
): Record<string, number> {
  return Object.entries(input ?? {}).reduce<Record<string, number>>((acc, [itemUid, level]) => {
    if (typeof itemUid !== "string" || itemUid.length <= 0) {
      return acc;
    }
    if (typeof level !== "number" || !Number.isFinite(level)) {
      return acc;
    }
    const safeLevel = Math.max(0, Math.floor(level));
    if (safeLevel <= 0) {
      return acc;
    }
    acc[itemUid] = safeLevel;
    return acc;
  }, {});
}

function normalizeCurrencyValue(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Math.max(0, Math.floor(fallback));
  }
  return Math.max(0, Math.floor(value));
}

function cloneGeneratedEquipment(item: GeneratedEquipment): GeneratedEquipment {
  return {
    ...item,
    t1Stats: item.t1Stats.map((stat) => ({ ...stat })),
    affixes: item.affixes.map((affix) => ({ ...affix }))
  };
}

function countNormalEquipmentItems(items: GeneratedEquipment[]): number {
  return items.filter((item) => !legendaryEquipmentIdByUid[item.uid]).length;
}

function normalizeResourceStock(input: Record<string, number> | null | undefined): Record<string, number> {
  return Object.entries(input ?? {}).reduce<Record<string, number>>((acc, [id, quantity]) => {
    if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
      return acc;
    }
    const safeQuantity = Math.max(0, Math.floor(quantity));
    if (safeQuantity <= 0) {
      return acc;
    }
    acc[id] = safeQuantity;
    return acc;
  }, {});
}

function normalizeEnhancementAidStock(input: Record<string, number> | null | undefined): Record<string, number> {
  const normalized = normalizeResourceStock(input);
  return Object.entries(normalized).reduce<Record<string, number>>((acc, [aidId, quantity]) => {
    if (!ENHANCEMENT_AID_BY_ID[aidId]) {
      return acc;
    }
    acc[aidId] = quantity;
    return acc;
  }, {});
}

function createQualityLockedTemplate(template: EquipmentTemplate, quality: EquipmentQuality): EquipmentTemplate {
  const qualityWeights = EQUIPMENT_QUALITY_KEYS.reduce<Record<EquipmentQuality, number>>((acc, key) => {
    acc[key] = key === quality ? 1 : 0;
    return acc;
  }, {} as Record<EquipmentQuality, number>);
  return {
    ...template,
    qualityWeights
  };
}

function buildDefaultConsumableStock(): Record<string, number> {
  return initialConsumableStacks.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = Math.max(0, Math.floor(item.quantity));
    return acc;
  }, {});
}

function buildDefaultOwnedMemoryIds(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  initialOwnedHeroMemoryIds.forEach((memoryId) => {
    if (!heroMemoryMap.has(memoryId) || seen.has(memoryId)) {
      return;
    }
    seen.add(memoryId);
    result.push(memoryId);
  });
  return result;
}

function normalizeOwnedMemoryIds(memoryIds: string[] | null | undefined): string[] {
  if (!Array.isArray(memoryIds)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  memoryIds.forEach((memoryId) => {
    if (typeof memoryId !== "string" || memoryId.length <= 0) {
      return;
    }
    if (!heroMemoryMap.has(memoryId) || seen.has(memoryId)) {
      return;
    }
    seen.add(memoryId);
    result.push(memoryId);
  });
  return result;
}

function normalizeEquippedMemoryByHero(
  mapping: Record<string, string> | null | undefined,
  ownedMemoryIds: Set<string>
): Record<string, string> {
  const next: Record<string, string> = {};
  const used = new Set<string>();
  const source = mapping ?? {};
  const orderedHeroIds = [...heroes.map((hero) => hero.id), ...Object.keys(source).filter((heroId) => !HERO_CLASS_BY_ID.has(heroId))];

  orderedHeroIds.forEach((heroId) => {
    const heroClass = HERO_CLASS_BY_ID.get(heroId);
    if (!heroClass) {
      return;
    }
    const memoryId = source[heroId];
    if (typeof memoryId !== "string" || memoryId.length <= 0) {
      return;
    }
    const memory = heroMemoryMap.get(memoryId);
    if (!memory) {
      return;
    }
    if (memory.heroClass !== heroClass) {
      return;
    }
    if (!ownedMemoryIds.has(memoryId) || used.has(memoryId)) {
      return;
    }
    used.add(memoryId);
    next[heroId] = memoryId;
  });
  return next;
}

function buildDefaultHeroProgressById(): Record<string, HeroProgressState> {
  return HERO_IDS.reduce<Record<string, HeroProgressState>>((acc, heroId) => {
    acc[heroId] = createInitialHeroProgressState();
    return acc;
  }, {});
}

function normalizeHeroProgressById(
  input: Record<string, HeroProgressState> | null | undefined
): Record<string, HeroProgressState> {
  const initialProgress = createInitialHeroProgressState();
  return HERO_IDS.reduce<Record<string, HeroProgressState>>((acc, heroId) => {
    const source = input?.[heroId];
    const level = clampHeroLevel(source?.level ?? initialProgress.level);
    const nextLevelExp = getHeroNextLevelExp(level);
    const rawExp = typeof source?.exp === "number" && Number.isFinite(source.exp) ? Math.floor(source.exp) : 0;
    const exp = nextLevelExp > 0 ? Math.max(0, Math.min(nextLevelExp - 1, rawExp)) : 0;
    acc[heroId] = { level, exp };
    return acc;
  }, {});
}

function applyHeroExpGain(progress: HeroProgressState, gainExp: number): HeroProgressState {
  const safeGain = Math.max(0, Math.floor(gainExp));
  const normalizedLevel = clampHeroLevel(progress.level);
  const normalizedCurrentExp = Math.max(0, Math.floor(progress.exp));

  if (safeGain <= 0 || getHeroNextLevelExp(normalizedLevel) <= 0) {
    return {
      level: normalizedLevel,
      exp: getHeroNextLevelExp(normalizedLevel) > 0 ? normalizedCurrentExp : 0
    };
  }

  let level = normalizedLevel;
  let exp = normalizedCurrentExp + safeGain;

  while (true) {
    const nextLevelExp = getHeroNextLevelExp(level);
    if (nextLevelExp <= 0) {
      return {
        level,
        exp: 0
      };
    }
    if (exp < nextLevelExp) {
      return {
        level,
        exp
      };
    }
    exp -= nextLevelExp;
    level = clampHeroLevel(level + 1);
  }
}

function normalizeOwnedLegendaryEquipmentIds(equipmentIds: string[] | null | undefined): string[] {
  if (!Array.isArray(equipmentIds)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  equipmentIds.forEach((equipmentId) => {
    if (typeof equipmentId !== "string" || equipmentId.length <= 0 || seen.has(equipmentId)) {
      return;
    }
    if (!LEGENDARY_EQUIPMENT_ID_SET.has(equipmentId)) {
      return;
    }
    seen.add(equipmentId);
    result.push(equipmentId);
  });
  return result;
}

function buildDefaultOwnedLegendaryEquipmentIds(): string[] {
  return legendaryEquipments.map((item) => item.id);
}

function areStringMapEqual(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => left[key] === right[key]);
}

function resolveClampedEnhancementLevel(item: GeneratedEquipment | undefined, level: number): number {
  if (!item) {
    return 0;
  }
  const maxLevel = resolveEnhancementMaxLevel(Boolean(legendaryEquipmentIdByUid[item.uid]));
  return Math.max(0, Math.min(maxLevel, Math.floor(level)));
}

export function EquipmentInventoryProvider({ children }: { children: ReactNode }) {
  const { forgeEnhancementBonusRate } = useOrganization();
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [gold, setGold] = useState<number>(() => ECONOMY_CONFIG.initialGold);
  const [reputation, setReputation] = useState<number>(() => ECONOMY_CONFIG.initialReputation);
  const [equippedByHero, setEquippedByHero] = useState<Record<string, Record<string, string>>>({});
  const [ownedLegendaryEquipmentIds, setOwnedLegendaryEquipmentIds] = useState<string[]>(
    () => buildDefaultOwnedLegendaryEquipmentIds()
  );
  const [droppedEquipmentItems, setDroppedEquipmentItems] = useState<GeneratedEquipment[]>([]);
  const [soldEquipmentItemUids, setSoldEquipmentItemUids] = useState<string[]>([]);
  const [lockedEquipmentItemUids, setLockedEquipmentItemUids] = useState<string[]>([]);
  const [equipmentEnhancementByUid, setEquipmentEnhancementByUid] = useState<Record<string, number>>({});
  const [enhancementAidStock, setEnhancementAidStock] = useState<Record<string, number>>(() => buildDefaultEnhancementAidStock());
  const [materialStock, setMaterialStock] = useState<Record<string, number>>({});
  const [consumableStock, setConsumableStock] = useState<Record<string, number>>(() => buildDefaultConsumableStock());
  const [ownedMemoryIds, setOwnedMemoryIds] = useState<string[]>(() => buildDefaultOwnedMemoryIds());
  const [equippedMemoryByHero, setEquippedMemoryByHero] = useState<Record<string, string>>({});
  const [heroProgressById, setHeroProgressById] = useState<Record<string, HeroProgressState>>(() => buildDefaultHeroProgressById());

  const ownedMemoryIdSet = useMemo(() => new Set(ownedMemoryIds), [ownedMemoryIds]);
  const soldEquipmentUidSet = useMemo(() => new Set(soldEquipmentItemUids), [soldEquipmentItemUids]);
  const lockedEquipmentUidSet = useMemo(() => new Set(lockedEquipmentItemUids), [lockedEquipmentItemUids]);
  const ownedLegendaryEquipmentIdSet = useMemo(
    () => new Set(ownedLegendaryEquipmentIds),
    [ownedLegendaryEquipmentIds]
  );
  const ownedLegendaryItems = useMemo(
    () =>
      ownedLegendaryEquipmentIds
        .map((equipmentId) => legendaryEquipmentItemById[equipmentId])
        .filter((item): item is GeneratedEquipment => Boolean(item)),
    [ownedLegendaryEquipmentIds]
  );
  const items = useMemo(() => {
    return mergeUniqueItems([buildInventory(seed), droppedEquipmentItems, ownedLegendaryItems]).filter(
      (item) => !soldEquipmentUidSet.has(item.uid)
    );
  }, [droppedEquipmentItems, ownedLegendaryItems, seed, soldEquipmentUidSet]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.uid, item])), [items]);
  const normalEquipmentCount = useMemo(() => countNormalEquipmentItems(items), [items]);
  const isBackpackEquipmentFull = normalEquipmentCount >= NORMAL_EQUIPMENT_CAPACITY;

  const ownerMap = useMemo(() => {
    const map = new Map<string, EquippedOwner[]>();
    Object.entries(equippedByHero).forEach(([heroId, slots]) => {
      Object.entries(slots).forEach(([slotId, uid]) => {
        if (itemMap.has(uid)) {
          const list = map.get(uid) ?? [];
          list.push({ heroId, slotId });
          map.set(uid, list);
        }
      });
    });
    return map;
  }, [equippedByHero, itemMap]);

  const memoryOwnerMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(equippedMemoryByHero).forEach(([heroId, memoryId]) => {
      if (typeof memoryId !== "string" || memoryId.length <= 0) {
        return;
      }
      map.set(memoryId, heroId);
    });
    return map;
  }, [equippedMemoryByHero]);


  const materialItems = useMemo(() => {
    const merged: InventoryMaterialStack[] = MATERIAL_CATALOG.map((item) => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      quantity: materialStock[item.id] ?? 0,
      sourceEnemyPrototypeIds: [...item.sourceEnemyPrototypeIds],
      sourceType: item.sourceType
    }));

    Object.entries(materialStock).forEach(([materialId, quantity]) => {
      if (MATERIAL_CATALOG_MAP.has(materialId) || quantity <= 0) {
        return;
      }
      merged.push({
        id: materialId,
        name: materialId,
        rarity: "common",
        quantity,
        sourceEnemyPrototypeIds: ["unknown"],
        sourceType: "battle"
      });
    });

    return merged.sort((left, right) => {
      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }
      if (RESOURCE_RARITY_ORDER[right.rarity] !== RESOURCE_RARITY_ORDER[left.rarity]) {
        return RESOURCE_RARITY_ORDER[right.rarity] - RESOURCE_RARITY_ORDER[left.rarity];
      }
      return left.name.localeCompare(right.name, "zh-CN");
    });
  }, [materialStock]);

  const enhancementAidItems = useMemo(() => {
    return ENHANCEMENT_AID_DEFINITIONS.map<EquipmentEnhancementAidItem>((definition) => ({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      effectType: definition.effectType,
      successRateBonus: definition.successRateBonus,
      preserveMaterialOnFailure: definition.preserveMaterialOnFailure,
      owned: enhancementAidStock[definition.id] ?? 0
    }));
  }, [enhancementAidStock]);

  const consumableItems = useMemo(() => {
    return initialConsumableStacks
      .map((item) => ({
        ...item,
        quantity: consumableStock[item.id] ?? 0
      }))
      .sort((left, right) => {
        if (RESOURCE_RARITY_ORDER[right.rarity] !== RESOURCE_RARITY_ORDER[left.rarity]) {
          return RESOURCE_RARITY_ORDER[right.rarity] - RESOURCE_RARITY_ORDER[left.rarity];
        }
        return left.name.localeCompare(right.name, "zh-CN");
      });
  }, [consumableStock]);

  const memoryItems = useMemo(() => {
    const all = ownedMemoryIds
      .map((memoryId) => heroMemoryMap.get(memoryId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map<InventoryMemoryStack>((item) => ({
        id: item.id,
        heroClass: item.heroClass,
        title: item.title,
        quote: item.quote,
        effect: item.effect
      }));
    return all.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));
  }, [ownedMemoryIds]);

  useEffect(() => {
    const validUids = new Set(items.map((item) => item.uid));
    setEquippedByHero((prev) => {
      let changed = false;
      const next: Record<string, Record<string, string>> = {};

      Object.entries(prev).forEach(([heroId, slots]) => {
        const filtered = Object.fromEntries(Object.entries(slots).filter(([, uid]) => validUids.has(uid)));
        next[heroId] = filtered;
        if (Object.keys(filtered).length !== Object.keys(slots).length) {
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [items]);

  useEffect(() => {
    const validUids = new Set(items.map((item) => item.uid));
    setLockedEquipmentItemUids((prev) => {
      const next = prev.filter((itemUid) => validUids.has(itemUid));
      return next.length === prev.length ? prev : next;
    });
    setEquipmentEnhancementByUid((prev) => {
      const next: Record<string, number> = {};
      let changed = false;
      Object.entries(prev).forEach(([itemUid, level]) => {
        if (!validUids.has(itemUid)) {
          changed = true;
          return;
        }
        const item = itemMap.get(itemUid);
        const normalizedLevel = resolveClampedEnhancementLevel(item, level);
        if (normalizedLevel !== level) {
          changed = true;
        }
        if (normalizedLevel > 0) {
          next[itemUid] = normalizedLevel;
        }
      });
      if (!changed && Object.keys(next).length === Object.keys(prev).length) {
        return prev;
      }
      return next;
    });
  }, [itemMap, items]);

  useEffect(() => {
    setEquippedMemoryByHero((prev) => {
      const normalized = normalizeEquippedMemoryByHero(prev, ownedMemoryIdSet);
      return areStringMapEqual(prev, normalized) ? prev : normalized;
    });
  }, [ownedMemoryIdSet]);


  const refreshItems = () => {
    setDroppedEquipmentItems([]);
    setSoldEquipmentItemUids([]);
    setLockedEquipmentItemUids([]);
    setEquipmentEnhancementByUid({});
    setEnhancementAidStock(buildDefaultEnhancementAidStock());
    setSeed(`${Date.now()}`);
  };

  const collectBattleDrops = (drops: BattleDropSummary | null | undefined) => {
    if (!drops || drops.entries.length <= 0) {
      return;
    }

    setMaterialStock((prev) => {
      let changed = false;
      const next = { ...prev };

      drops.entries.forEach((entry) => {
        if (entry.category !== "material" || !entry.material) {
          return;
        }
        const quantity = Math.max(0, Math.floor(entry.quantity));
        if (quantity <= 0) {
          return;
        }
        next[entry.material.id] = (next[entry.material.id] ?? 0) + quantity;
        changed = true;
      });

      return changed ? next : prev;
    });

    const droppedEquipments = normalizeDroppedEquipmentItems(
      drops.items.length > 0
        ? drops.items
        : drops.entries
            .filter((entry) => entry.category === "equipment" && entry.equipment)
            .map((entry) => entry.equipment as GeneratedEquipment)
    );
    if (droppedEquipments.length > 0) {
      const legendaryDrops = droppedEquipments.filter(
        (item) => Boolean(legendaryEquipmentIdByUid[item.uid]) && !itemMap.has(item.uid)
      );
      const availableSlots = Math.max(0, NORMAL_EQUIPMENT_CAPACITY - normalEquipmentCount);
      const normalDrops =
        availableSlots > 0
          ? droppedEquipments
              .filter((item) => !legendaryEquipmentIdByUid[item.uid] && !itemMap.has(item.uid))
              .slice(0, availableSlots)
          : [];
      const acceptedDrops = [...legendaryDrops, ...normalDrops];
      if (acceptedDrops.length > 0) {
        setDroppedEquipmentItems((prev) => mergeUniqueItems([prev, acceptedDrops]));
      }
    }
  };

  const getHeroProgress = (heroId: string): HeroProgressState => {
    return heroProgressById[heroId] ?? createInitialHeroProgressState();
  };

  const grantBattleHeroExp = (allyHeroIds: string[], enemyLevels: number[]): HeroBattleExpGainResult[] => {
    const targetHeroIds = [...new Set(allyHeroIds.filter((heroId) => HERO_ID_SET.has(heroId)))];
    const normalizedEnemyLevels = enemyLevels
      .map((level) => Math.max(1, Math.floor(level)))
      .filter((level) => Number.isFinite(level) && level > 0);

    if (targetHeroIds.length <= 0 || normalizedEnemyLevels.length <= 0) {
      return [];
    }

    const baseExp = resolveBattleBaseExpByEnemyLevels(normalizedEnemyLevels);
    if (baseExp <= 0) {
      return [];
    }

    const enemyAverageLevel = resolveBattleEnemyAverageLevel(normalizedEnemyLevels);
    const resultByHeroId: Record<string, HeroBattleExpGainResult> = {};

    setHeroProgressById((prev) => {
      let changed = false;
      const next: Record<string, HeroProgressState> = { ...prev };

      targetHeroIds.forEach((heroId) => {
        const current = prev[heroId] ?? createInitialHeroProgressState();
        const previousLevel = clampHeroLevel(current.level);
        const canGainExp = getHeroNextLevelExp(previousLevel) > 0;
        const multiplier = resolveBattleLevelDeltaMultiplier(previousLevel, enemyAverageLevel);
        const gainedExp = canGainExp ? Math.max(0, Math.floor(baseExp * multiplier)) : 0;
        const updated = canGainExp ? applyHeroExpGain(current, gainedExp) : { level: previousLevel, exp: 0 };
        const nextLevelExp = getHeroNextLevelExp(updated.level);

        resultByHeroId[heroId] = {
          heroId,
          gainedExp,
          previousLevel,
          currentLevel: updated.level,
          currentExp: updated.exp,
          nextLevelExp
        };

        if (!prev[heroId] || prev[heroId].level !== updated.level || prev[heroId].exp !== updated.exp) {
          changed = true;
          next[heroId] = updated;
        }
      });

      return changed ? next : prev;
    });

    return targetHeroIds
      .map((heroId) => resultByHeroId[heroId])
      .filter((entry): entry is HeroBattleExpGainResult => Boolean(entry));
  };

  const grantMissionRewards = (reward: BulletinMissionReward | null | undefined) => {
    if (!reward) {
      return;
    }

    if (reward.materials.length > 0) {
      setMaterialStock((prev) => {
        const next = { ...prev };
        let changed = false;
        reward.materials.forEach((item) => {
          const quantity = Math.max(0, Math.floor(item.quantity));
          if (quantity <= 0) {
            return;
          }
          next[item.materialId] = (next[item.materialId] ?? 0) + quantity;
          changed = true;
        });
        return changed ? next : prev;
      });
    }

    if (reward.consumables.length > 0) {
      setConsumableStock((prev) => {
        const next = { ...prev };
        let changed = false;
        reward.consumables.forEach((item) => {
          const quantity = Math.max(0, Math.floor(item.quantity));
          if (quantity <= 0) {
            return;
          }
          next[item.consumableId] = (next[item.consumableId] ?? 0) + quantity;
          changed = true;
        });
        return changed ? next : prev;
      });
    }

    if (reward.bounty > 0) {
      setGold((prev) => prev + Math.max(0, Math.floor(reward.bounty)));
    }

    if (reward.reputation > 0) {
      setReputation((prev) => prev + Math.max(0, Math.floor(reward.reputation)));
    }
  };

  const buyEquipment = (item: GeneratedEquipment): EquipmentTradeActionResult => {
    if (!item || typeof item.uid !== "string" || item.uid.length <= 0) {
      return {
        ok: false,
        reason: "装备数据无效。",
        price: 0
      };
    }

    const price = getEquipmentBuyPrice(item, 0);
    if (itemMap.has(item.uid)) {
      return {
        ok: false,
        reason: "该装备已在背包中。",
        price
      };
    }

    if (!legendaryEquipmentIdByUid[item.uid] && isBackpackEquipmentFull) {
      return {
        ok: false,
        reason: "背包装备已达上限，无法买入。",
        price
      };
    }

    if (gold < price) {
      return {
        ok: false,
        reason: "金币不足。",
        price
      };
    }

    setGold((prev) => prev - price);
    setDroppedEquipmentItems((prev) => mergeUniqueItems([prev, [cloneGeneratedEquipment(item)]]));
    setSoldEquipmentItemUids((prev) => prev.filter((itemUid) => itemUid !== item.uid));
    setLockedEquipmentItemUids((prev) => prev.filter((itemUid) => itemUid !== item.uid));

    return {
      ok: true,
      reason: null,
      price
    };
  };

  const craftEquipment = (request: EquipmentCraftRequest): EquipmentCraftResult => {
    const recipeId = String(request.recipeId ?? "").trim();
    const recipeName = String(request.recipeName ?? "").trim();
    const templateId = String(request.templateId ?? "").trim();
    const safeLevel = Number.isFinite(request.level) ? Math.max(1, Math.floor(request.level)) : 1;
    const goldCost = Number.isFinite(request.goldCost) ? Math.max(0, Math.floor(request.goldCost)) : 0;
    const targetQuality = EQUIPMENT_QUALITY_KEYS.includes(request.targetQuality) ? request.targetQuality : "common";
    const sourceTag = String(request.sourceTag ?? "").trim();

    const normalizedMaterials = (request.materials ?? [])
      .map((entry) => ({
        materialId: String(entry.materialId ?? "").trim(),
        quantity: Number.isFinite(entry.quantity) ? Math.max(0, Math.floor(entry.quantity)) : 0
      }))
      .filter((entry) => entry.materialId.length > 0 && entry.quantity > 0);

    const fail = (reason: string): EquipmentCraftResult => ({
      ok: false,
      reason,
      recipeId,
      recipeName,
      craftedItem: null,
      goldCost,
      materials: normalizedMaterials
    });

    if (recipeId.length <= 0 || recipeName.length <= 0) {
      return fail("打造配方无效。");
    }
    const template = EQUIPMENT_TEMPLATE_BY_ID.get(templateId);
    if (!template) {
      return fail("配方模板不存在。");
    }
    if (goldCost <= 0 || normalizedMaterials.length <= 0) {
      return fail("配方消耗配置无效。");
    }
    if (isBackpackEquipmentFull) {
      return fail("背包已满，无法打造。");
    }
    if (gold < goldCost) {
      return fail("金币不足。");
    }
    const enoughMaterials = normalizedMaterials.every((entry) => (materialStock[entry.materialId] ?? 0) >= entry.quantity);
    if (!enoughMaterials) {
      return fail("打造材料不足。");
    }

    const payResult = payCost({
      gold: goldCost,
      materials: normalizedMaterials
    });
    if (!payResult.ok) {
      return fail(payResult.reason ?? "打造扣费失败。");
    }

    const templateForCraft = createQualityLockedTemplate(template, targetQuality);
    const craftedItem = generateEquipmentFromTemplate(
      templateForCraft,
      {
        level: safeLevel,
        seed: `forge-${recipeId}-${Date.now()}-${Math.random()}`,
        source: `forge:${sourceTag || "node"}:${recipeId}`
      },
      0
    );
    setDroppedEquipmentItems((prev) => [...prev, craftedItem]);

    return {
      ok: true,
      reason: null,
      recipeId,
      recipeName,
      craftedItem,
      goldCost,
      materials: normalizedMaterials
    };
  };

  const getEquipmentEnhanceLevel = (itemUid: string): number => {
    const level = equipmentEnhancementByUid[itemUid] ?? 0;
    return resolveClampedEnhancementLevel(itemMap.get(itemUid), level);
  };

  const getEquipmentEnhanceBonus = (itemUid: string): number => {
    return getEnhancementStatBonus(getEquipmentEnhanceLevel(itemUid));
  };

  const isEquipmentLocked = (itemUid: string): boolean => {
    return lockedEquipmentUidSet.has(itemUid);
  };

  const setEquipmentLocked = (itemUid: string, locked: boolean): boolean => {
    if (!itemMap.has(itemUid)) {
      return false;
    }
    setLockedEquipmentItemUids((prev) => {
      const exists = prev.includes(itemUid);
      if (locked) {
        if (exists) {
          return prev;
        }
        return [...prev, itemUid];
      }
      if (!exists) {
        return prev;
      }
      return prev.filter((entry) => entry !== itemUid);
    });
    return true;
  };

  const getEquipmentEnhancementPreview = (
    itemUid: string,
    options?: EquipmentEnhancementAttemptOptions
  ): EquipmentEnhancementPreview | null => {
    const item = itemMap.get(itemUid);
    if (!item) {
      return null;
    }

    const selectedAidDefinition = options?.aidId ? ENHANCEMENT_AID_BY_ID[options.aidId] ?? null : null;
    const selectedAid: EquipmentEnhancementAidItem | null = selectedAidDefinition
      ? {
          id: selectedAidDefinition.id,
          name: selectedAidDefinition.name,
          description: selectedAidDefinition.description,
          effectType: selectedAidDefinition.effectType,
          successRateBonus: selectedAidDefinition.successRateBonus,
          preserveMaterialOnFailure: selectedAidDefinition.preserveMaterialOnFailure,
          owned: enhancementAidStock[selectedAidDefinition.id] ?? 0
        }
      : null;
    const aidCost = selectedAid ? 1 : 0;
    const currentLevel = getEquipmentEnhanceLevel(itemUid);
    const maxLevel = resolveEnhancementMaxLevel(Boolean(legendaryEquipmentIdByUid[itemUid]));
    const targetLevel = Math.min(maxLevel, currentLevel + 1);
    const goldCost = resolveEnhancementGoldCost(item.level, targetLevel);
    const baseSuccessRate = getEnhancementSuccessRate(targetLevel);
    const maxConfigCap = Math.max(0, Math.min(1, ENHANCEMENT_CONFIG.successRate.absoluteCap));
    const successRateCapByMultiplier = Math.min(1, baseSuccessRate * ENHANCEMENT_CONFIG.successRate.capByBaseMultiplier);
    const successRateCap = Math.max(baseSuccessRate, Math.min(maxConfigCap, successRateCapByMultiplier));
    const forgeBonusRate = Math.max(0, forgeEnhancementBonusRate);
    const aidSuccessRateBonus = Math.max(0, selectedAid?.successRateBonus ?? 0);
    const successRate = Math.min(successRateCap, baseSuccessRate + forgeBonusRate + aidSuccessRateBonus);
    const materialConsumedOnFailure =
      selectedAid?.preserveMaterialOnFailure === true ? false : ENHANCEMENT_CONFIG.failureConsumesResources;
    const materialCost = resolveEnhancementMaterialCost(item.templateId, targetLevel).map((entry) => ({
      materialId: entry.materialId,
      materialName: MATERIAL_CATALOG_MAP.get(entry.materialId)?.name ?? entry.materialId,
      rarity: MATERIAL_CATALOG_MAP.get(entry.materialId)?.rarity ?? "common",
      quantity: entry.quantity,
      owned: materialStock[entry.materialId] ?? 0
    }));

    let reason: string | null = null;
    if (currentLevel >= maxLevel) {
      reason = "强化等级已达上限。";
    } else if (selectedAid && selectedAid.owned < aidCost) {
      reason = "辅助材料不足。";
    } else if (gold < goldCost) {
      reason = "金币不足。";
    } else if (materialCost.some((entry) => entry.owned < entry.quantity)) {
      reason = "强化材料不足。";
    }

    return {
      itemUid,
      templateId: item.templateId,
      currentLevel,
      targetLevel,
      maxLevel,
      currentBonus: getEnhancementStatBonus(currentLevel),
      targetBonus: getEnhancementStatBonus(targetLevel),
      baseSuccessRate,
      forgeBonusRate,
      aidSuccessRateBonus,
      successRateCap,
      successRate,
      goldCost,
      materialCost,
      selectedAid,
      aidCost,
      materialConsumedOnFailure,
      canEnhance: reason === null,
      reason
    };
  };

  const enhanceEquipment = (itemUid: string, options?: EquipmentEnhancementAttemptOptions): EquipmentEnhancementResult => {
    const item = itemMap.get(itemUid);
    const preview = getEquipmentEnhancementPreview(itemUid, options);
    if (!item || !preview) {
      return {
        ok: false,
        success: false,
        itemUid,
        previousLevel: 0,
        currentLevel: 0,
        maxLevel: resolveEnhancementMaxLevel(false),
        successRate: 0,
        goldCost: 0,
        materialCost: [],
        usedAidId: null,
        usedAidName: null,
        aidConsumed: false,
        materialConsumed: false,
        materialPreservedByAid: false,
        reason: "装备不存在。"
      };
    }

    if (!preview.canEnhance) {
      return {
        ok: false,
        success: false,
        itemUid,
        previousLevel: preview.currentLevel,
        currentLevel: preview.currentLevel,
        maxLevel: preview.maxLevel,
        successRate: preview.successRate,
        goldCost: preview.goldCost,
        materialCost: preview.materialCost.map((entry) => ({
          materialId: entry.materialId,
          quantity: entry.quantity
        })),
        usedAidId: preview.selectedAid?.id ?? null,
        usedAidName: preview.selectedAid?.name ?? null,
        aidConsumed: false,
        materialConsumed: false,
        materialPreservedByAid: false,
        reason: preview.reason
      };
    }

    setGold((prev) => Math.max(0, prev - preview.goldCost));
    if (preview.selectedAid && preview.aidCost > 0) {
      const aidId = preview.selectedAid.id;
      setEnhancementAidStock((prev) => {
        const next = { ...prev };
        const remain = (next[aidId] ?? 0) - preview.aidCost;
        if (remain > 0) {
          next[aidId] = remain;
        } else {
          delete next[aidId];
        }
        return next;
      });
    }

    const success = Math.random() <= preview.successRate;
    const materialConsumed = success || preview.materialConsumedOnFailure;
    if (materialConsumed) {
      setMaterialStock((prev) => {
        const next = { ...prev };
        preview.materialCost.forEach((entry) => {
          const remain = (next[entry.materialId] ?? 0) - entry.quantity;
          if (remain > 0) {
            next[entry.materialId] = remain;
          } else {
            delete next[entry.materialId];
          }
        });
        return next;
      });
    }

    const nextLevel = success ? preview.targetLevel : preview.currentLevel;
    if (success) {
      setEquipmentEnhancementByUid((prev) => ({
        ...prev,
        [itemUid]: nextLevel
      }));
    }

    return {
      ok: true,
      success,
      itemUid,
      previousLevel: preview.currentLevel,
      currentLevel: nextLevel,
      maxLevel: preview.maxLevel,
      successRate: preview.successRate,
      goldCost: preview.goldCost,
      materialCost: preview.materialCost.map((entry) => ({ materialId: entry.materialId, quantity: entry.quantity })),
      usedAidId: preview.selectedAid?.id ?? null,
      usedAidName: preview.selectedAid?.name ?? null,
      aidConsumed: preview.selectedAid !== null && preview.aidCost > 0,
      materialConsumed,
      materialPreservedByAid: !success && !materialConsumed && preview.selectedAid?.preserveMaterialOnFailure === true,
      reason: null
    };
  };

  const sellEquipment = (itemUid: string): EquipmentTradeActionResult => {
    if (typeof itemUid !== "string" || itemUid.length <= 0) {
      return {
        ok: false,
        reason: "装备 UID 无效。",
        price: 0
      };
    }

    const item = itemMap.get(itemUid);
    if (!item) {
      return {
        ok: false,
        reason: "背包中不存在该装备。",
        price: 0
      };
    }

    if (legendaryEquipmentIdByUid[item.uid]) {
      return {
        ok: false,
        reason: "传说装备禁止出售。",
        price: 0
      };
    }

    if (isEquipmentLocked(item.uid)) {
      return {
        ok: false,
        reason: "该装备已锁定，无法出售。",
        price: 0
      };
    }

    if ((ownerMap.get(item.uid) ?? []).length > 0) {
      return {
        ok: false,
        reason: "该装备已被英雄穿戴，无法出售。",
        price: 0
      };
    }

    const enhanceLevel = getEquipmentEnhanceLevel(item.uid);
    const price = getEquipmentSellPrice(item, enhanceLevel);
    if (price <= 0) {
      return {
        ok: false,
        reason: "该装备当前不可出售。",
        price: 0
      };
    }

    setDroppedEquipmentItems((prev) => prev.filter((entry) => entry.uid !== item.uid));
    setSoldEquipmentItemUids((prev) => (prev.includes(item.uid) ? prev : [...prev, item.uid]));
    setLockedEquipmentItemUids((prev) => prev.filter((uid) => uid !== item.uid));
    setEquipmentEnhancementByUid((prev) => {
      if (!prev[item.uid]) {
        return prev;
      }
      const next = { ...prev };
      delete next[item.uid];
      return next;
    });
    setGold((prev) => prev + price);

    return {
      ok: true,
      reason: null,
      price
    };
  };

  const sellEquipmentBulk = (filter: EquipmentBulkSellFilter): EquipmentBulkSellResult => {
    const qualitySet = new Set<EquipmentQuality>(filter.qualities ?? []);
    const rankSet = new Set<EquipmentRank>(filter.ranks ?? []);
    const slotSet = new Set<EquipmentSlot>(filter.slots ?? []);
    const minLevel = typeof filter.minLevel === "number" ? Math.max(1, Math.floor(filter.minLevel)) : null;
    const maxLevel = typeof filter.maxLevel === "number" ? Math.max(1, Math.floor(filter.maxLevel)) : null;
    const minScore = typeof filter.minScore === "number" ? Math.max(0, filter.minScore) : null;
    const maxScore = typeof filter.maxScore === "number" ? Math.max(0, filter.maxScore) : null;
    const minEnhanceLevel =
      typeof filter.minEnhanceLevel === "number" ? Math.max(0, Math.floor(filter.minEnhanceLevel)) : null;
    const maxEnhanceLevel =
      typeof filter.maxEnhanceLevel === "number" ? Math.max(0, Math.floor(filter.maxEnhanceLevel)) : null;

    const candidates = items
      .filter((item) => !legendaryEquipmentIdByUid[item.uid])
      .filter((item) => !isEquipmentLocked(item.uid))
      .filter((item) => (ownerMap.get(item.uid) ?? []).length <= 0)
      .map((item) => {
        const enhanceLevel = getEquipmentEnhanceLevel(item.uid);
        return {
          item,
          enhanceLevel,
          score: computeEquipmentInternalScore(item),
          price: getEquipmentSellPrice(item, enhanceLevel)
        };
      })
      .filter((entry) => {
        if (qualitySet.size > 0 && !qualitySet.has(entry.item.quality)) {
          return false;
        }
        if (rankSet.size > 0 && !rankSet.has(entry.item.rank)) {
          return false;
        }
        if (slotSet.size > 0 && !slotSet.has(entry.item.slot)) {
          return false;
        }
        if (minLevel !== null && entry.item.level < minLevel) {
          return false;
        }
        if (maxLevel !== null && entry.item.level > maxLevel) {
          return false;
        }
        if (minScore !== null && entry.score < minScore) {
          return false;
        }
        if (maxScore !== null && entry.score > maxScore) {
          return false;
        }
        if (minEnhanceLevel !== null && entry.enhanceLevel < minEnhanceLevel) {
          return false;
        }
        if (maxEnhanceLevel !== null && entry.enhanceLevel > maxEnhanceLevel) {
          return false;
        }
        if (filter.excludeEnhanced && entry.enhanceLevel > 0) {
          return false;
        }
        return entry.price > 0;
      });

    if (candidates.length <= 0) {
      return {
        soldCount: 0,
        skippedCount: 0,
        totalPrice: 0
      };
    }

    const soldUids = new Set(candidates.map((entry) => entry.item.uid));
    const totalPrice = candidates.reduce((sum, entry) => sum + entry.price, 0);

    setDroppedEquipmentItems((prev) => prev.filter((entry) => !soldUids.has(entry.uid)));
    setSoldEquipmentItemUids((prev) => {
      const set = new Set(prev);
      soldUids.forEach((uid) => set.add(uid));
      return [...set];
    });
    setLockedEquipmentItemUids((prev) => prev.filter((uid) => !soldUids.has(uid)));
    setEquipmentEnhancementByUid((prev) => {
      let changed = false;
      const next: Record<string, number> = {};
      Object.entries(prev).forEach(([uid, level]) => {
        if (soldUids.has(uid)) {
          changed = true;
          return;
        }
        next[uid] = level;
      });
      return changed ? next : prev;
    });
    setGold((prev) => prev + totalPrice);

    return {
      soldCount: candidates.length,
      skippedCount: 0,
      totalPrice
    };
  };

  const buyMaterials = (entries: MaterialPurchaseEntry[]): MaterialPurchaseResult => {
    if (!entries || entries.length <= 0) {
      return {
        ok: false,
        reason: "没有可购买的材料。",
        totalCost: 0
      };
    }

    const purchaseEntries = entries
      .map((entry) => ({
        materialId: String(entry.materialId ?? "").trim(),
        quantity: Math.max(0, Math.floor(entry.quantity)),
        unitPrice: Math.max(0, Math.floor(entry.unitPrice))
      }))
      .filter((entry) => entry.materialId.length > 0 && entry.quantity > 0 && entry.unitPrice > 0);

    if (purchaseEntries.length <= 0) {
      return {
        ok: false,
        reason: "材料购买参数无效。",
        totalCost: 0
      };
    }

    const totalCost = purchaseEntries.reduce((sum, entry) => sum + entry.quantity * entry.unitPrice, 0);
    if (totalCost <= 0) {
      return {
        ok: false,
        reason: "购买金额无效。",
        totalCost: 0
      };
    }

    if (gold < totalCost) {
      return {
        ok: false,
        reason: "金币不足。",
        totalCost
      };
    }

    setGold((prev) => Math.max(0, prev - totalCost));
    setMaterialStock((prev) => {
      const next = { ...prev };
      purchaseEntries.forEach((entry) => {
        next[entry.materialId] = (next[entry.materialId] ?? 0) + entry.quantity;
      });
      return next;
    });

    return {
      ok: true,
      reason: null,
      totalCost
    };
  };

  const payCost = (cost: { gold: number; materials: Array<{ materialId: string; quantity: number }> }): InventoryCostPayResult => {
    const goldCost = Math.max(0, Math.floor(cost.gold));
    const requirements = (cost.materials ?? [])
      .map((item) => ({
        materialId: String(item.materialId ?? "").trim(),
        quantity: Math.max(0, Math.floor(item.quantity))
      }))
      .filter((item) => item.materialId.length > 0 && item.quantity > 0);

    if (goldCost <= 0 && requirements.length <= 0) {
      return { ok: true, reason: null };
    }

    if (gold < goldCost) {
      return { ok: false, reason: "金币不足。" };
    }

    const hasEnoughMaterial = requirements.every((item) => (materialStock[item.materialId] ?? 0) >= item.quantity);
    if (!hasEnoughMaterial) {
      return { ok: false, reason: "材料不足。" };
    }

    if (goldCost > 0) {
      setGold((prev) => Math.max(0, prev - goldCost));
    }
    if (requirements.length > 0) {
      setMaterialStock((prev) => {
        const next = { ...prev };
        requirements.forEach((item) => {
          const remain = (next[item.materialId] ?? 0) - item.quantity;
          if (remain > 0) {
            next[item.materialId] = remain;
          } else {
            delete next[item.materialId];
          }
        });
        return next;
      });
    }

    return { ok: true, reason: null };
  };

  const consumeMaterials = (materials: Array<{ materialId: string; quantity: number }>): boolean => {
    if (!materials || materials.length <= 0) {
      return true;
    }

    const requirements = materials
      .map((item) => ({
        materialId: item.materialId,
        quantity: Math.max(0, Math.floor(item.quantity))
      }))
      .filter((item) => item.materialId.length > 0 && item.quantity > 0);

    if (requirements.length <= 0) {
      return true;
    }

    let consumed = false;
    setMaterialStock((prev) => {
      const hasEnough = requirements.every((item) => (prev[item.materialId] ?? 0) >= item.quantity);
      if (!hasEnough) {
        return prev;
      }

      const next = { ...prev };
      requirements.forEach((item) => {
        const remain = (next[item.materialId] ?? 0) - item.quantity;
        if (remain > 0) {
          next[item.materialId] = remain;
        } else {
          delete next[item.materialId];
        }
      });
      consumed = true;
      return next;
    });
    return consumed;
  };

  const equipItem = (
    heroId: string,
    slotId: string,
    itemUid: string,
    options: { forceReplaceHand?: boolean } = {}
  ): boolean => {
    const item = itemMap.get(itemUid);
    if (!item) {
      return false;
    }

    const owners = ownerMap.get(itemUid) ?? [];
    if (owners.some((owner) => owner.heroId !== heroId)) {
      return false;
    }

    const legendaryEquipmentId = legendaryEquipmentIdByUid[itemUid];
    if (legendaryEquipmentId && !ownedLegendaryEquipmentIdSet.has(legendaryEquipmentId)) {
      return false;
    }

    if (item.slot === "twoHand") {
      if (!isPaladinHandSlot(slotId)) {
        return false;
      }
      const pairedSlot = getPairedPaladinHandSlot(slotId);
      if (!pairedSlot) {
        return false;
      }
      const pairedUid = equippedByHero[heroId]?.[pairedSlot];
      if (pairedUid && pairedUid !== itemUid && !options.forceReplaceHand) {
        return false;
      }
    }

    setEquippedByHero((prev) => {
      const nextHeroSlots = { ...(prev[heroId] ?? {}) };
      const targetCurrentUid = nextHeroSlots[slotId];

      if (item.slot === "twoHand") {
        const pairedSlot = getPairedPaladinHandSlot(slotId);
        if (!pairedSlot) {
          return prev;
        }

        Object.entries(nextHeroSlots).forEach(([currentSlotId, uid]) => {
          if (uid === itemUid) {
            delete nextHeroSlots[currentSlotId];
          }
        });

        const pairedUid = nextHeroSlots[pairedSlot];
        if (pairedUid && pairedUid !== itemUid) {
          delete nextHeroSlots[pairedSlot];
        }

        if (targetCurrentUid) {
          const targetCurrentItem = itemMap.get(targetCurrentUid);
          if (targetCurrentItem?.slot === "twoHand") {
            const mirrorSlot = getPairedPaladinHandSlot(slotId);
            if (mirrorSlot) {
              delete nextHeroSlots[mirrorSlot];
            }
          }
        }

        nextHeroSlots[slotId] = itemUid;
        nextHeroSlots[pairedSlot] = itemUid;
      } else {
        Object.entries(nextHeroSlots).forEach(([currentSlotId, uid]) => {
          if (uid === itemUid && currentSlotId !== slotId) {
            delete nextHeroSlots[currentSlotId];
          }
        });

        if (targetCurrentUid) {
          const targetCurrentItem = itemMap.get(targetCurrentUid);
          if (targetCurrentItem?.slot === "twoHand" && isPaladinHandSlot(slotId)) {
            const mirrorSlot = getPairedPaladinHandSlot(slotId);
            if (mirrorSlot) {
              delete nextHeroSlots[mirrorSlot];
            }
          }
        }

        if (item.slot === "oneHand" && isPaladinHandSlot(slotId)) {
          const pairedSlot = getPairedPaladinHandSlot(slotId);
          if (pairedSlot) {
            const pairedUid = nextHeroSlots[pairedSlot];
            if (pairedUid) {
              const pairedItem = itemMap.get(pairedUid);
              if (pairedItem?.slot === "twoHand") {
                delete nextHeroSlots[pairedSlot];
                if (nextHeroSlots[slotId] === pairedUid) {
                  delete nextHeroSlots[slotId];
                }
              }
            }
          }
        }

        nextHeroSlots[slotId] = itemUid;
      }

      const legendaryUidCount = new Set(
        Object.values(nextHeroSlots).filter((uid) => Boolean(legendaryEquipmentIdByUid[uid]))
      ).size;
      if (legendaryUidCount > LEGENDARY_EQUIPMENT_LIMIT_PER_HERO) {
        return prev;
      }

      return {
        ...prev,
        [heroId]: nextHeroSlots
      };
    });
    return true;
  };

  const unequipItem = (heroId: string, slotId: string) => {
    setEquippedByHero((prev) => {
      const current = prev[heroId] ?? {};
      const currentUid = current[slotId];
      if (!currentUid) {
        return prev;
      }
      const nextSlots = { ...current };
      const currentItem = itemMap.get(currentUid);

      if (currentItem?.slot === "twoHand" && isPaladinHandSlot(slotId)) {
        const pairedSlot = getPairedPaladinHandSlot(slotId);
        if (pairedSlot && nextSlots[pairedSlot] === currentUid) {
          delete nextSlots[pairedSlot];
        }
      }

      delete nextSlots[slotId];
      return {
        ...prev,
        [heroId]: nextSlots
      };
    });
  };

  const setHeroMemory = (heroId: string, memoryId: string | null): boolean => {
    const heroClass = HERO_CLASS_BY_ID.get(heroId);
    if (!heroClass) {
      return false;
    }

    if (!memoryId) {
      setEquippedMemoryByHero((prev) => {
        if (!prev[heroId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[heroId];
        return next;
      });
      return true;
    }

    const memory = heroMemoryMap.get(memoryId);
    if (!memory) {
      return false;
    }
    if (memory.heroClass !== heroClass) {
      return false;
    }
    if (!ownedMemoryIdSet.has(memoryId)) {
      return false;
    }
    const owner = memoryOwnerMap.get(memoryId);
    if (owner && owner !== heroId) {
      return false;
    }

    setEquippedMemoryByHero((prev) => ({
      ...prev,
      [heroId]: memoryId
    }));
    return true;
  };

  const exportSnapshot = (): EquipmentInventorySnapshot => {
    const cloned = Object.entries(equippedByHero).reduce<Record<string, Record<string, string>>>((acc, [heroId, slots]) => {
      acc[heroId] = { ...slots };
      return acc;
    }, {});
    return {
      seed,
      gold,
      reputation,
      equippedByHero: cloned,
      ownedLegendaryEquipmentIds: [...ownedLegendaryEquipmentIds],
      droppedEquipmentItems: droppedEquipmentItems.map(cloneGeneratedEquipment),
      soldEquipmentItemUids: [...soldEquipmentItemUids],
      lockedEquipmentItemUids: [...lockedEquipmentItemUids],
      equipmentEnhancementByUid: { ...equipmentEnhancementByUid },
      enhancementAidStock: { ...enhancementAidStock },
      materialStock: { ...materialStock },
      consumableStock: { ...consumableStock },
      memoryOwnedIds: [...ownedMemoryIds],
      equippedMemoryByHero: { ...equippedMemoryByHero },
      heroProgressById: { ...heroProgressById }
    };
  };

  const importSnapshot = (snapshot: EquipmentInventorySnapshot) => {
    setSeed(typeof snapshot.seed === "string" && snapshot.seed.length > 0 ? snapshot.seed : DEFAULT_SEED);
    setGold(normalizeCurrencyValue(snapshot.gold, ECONOMY_CONFIG.initialGold));
    setReputation(normalizeCurrencyValue(snapshot.reputation, ECONOMY_CONFIG.initialReputation));
    const next = Object.entries(snapshot.equippedByHero ?? {}).reduce<Record<string, Record<string, string>>>((acc, [heroId, slots]) => {
      acc[heroId] = Object.entries(slots ?? {}).reduce<Record<string, string>>((slotAcc, [slotId, uid]) => {
        if (typeof uid === "string" && uid.length > 0) {
          slotAcc[slotId] = uid;
        }
        return slotAcc;
      }, {});
      return acc;
    }, {});
    setEquippedByHero(next);
    const fallbackLegendaryOwnedIds = buildDefaultOwnedLegendaryEquipmentIds();
    const importedLegendaryOwnedIds = snapshot.ownedLegendaryEquipmentIds
      ? normalizeOwnedLegendaryEquipmentIds(snapshot.ownedLegendaryEquipmentIds)
      : fallbackLegendaryOwnedIds;
    const normalizedLegendaryOwnedIds =
      importedLegendaryOwnedIds.length > 0 ? importedLegendaryOwnedIds : fallbackLegendaryOwnedIds;
    setOwnedLegendaryEquipmentIds(normalizedLegendaryOwnedIds);
    setDroppedEquipmentItems(normalizeDroppedEquipmentItems(snapshot.droppedEquipmentItems));
    setSoldEquipmentItemUids(normalizeSoldEquipmentItemUids(snapshot.soldEquipmentItemUids));
    setLockedEquipmentItemUids(normalizeLockedEquipmentItemUids(snapshot.lockedEquipmentItemUids));
    setEquipmentEnhancementByUid(normalizeEquipmentEnhancementByUid(snapshot.equipmentEnhancementByUid));
    setEnhancementAidStock({
      ...buildDefaultEnhancementAidStock(),
      ...normalizeEnhancementAidStock(snapshot.enhancementAidStock)
    });

    if (snapshot.materialStock) {
      setMaterialStock(normalizeResourceStock(snapshot.materialStock));
    }
    if (snapshot.consumableStock) {
      setConsumableStock({
        ...buildDefaultConsumableStock(),
        ...normalizeResourceStock(snapshot.consumableStock)
      });
    }

    const fallbackOwnedIds = buildDefaultOwnedMemoryIds();
    const importedOwned = snapshot.memoryOwnedIds ? normalizeOwnedMemoryIds(snapshot.memoryOwnedIds) : fallbackOwnedIds;
    const normalizedOwned = importedOwned.length > 0 ? importedOwned : fallbackOwnedIds;
    setOwnedMemoryIds(normalizedOwned);
    setEquippedMemoryByHero(normalizeEquippedMemoryByHero(snapshot.equippedMemoryByHero, new Set(normalizedOwned)));
    setHeroProgressById(normalizeHeroProgressById(snapshot.heroProgressById));
  };

  const value = useMemo<EquipmentInventoryContextValue>(
    () => ({
      items,
      itemMap,
      gold,
      reputation,
      normalEquipmentCapacity: NORMAL_EQUIPMENT_CAPACITY,
      normalEquipmentCount,
      isBackpackEquipmentFull,
      equippedByHero,
      legendaryEquipments,
      legendaryEquipmentSkillsById,
      ownedLegendaryEquipmentIds,
      materialItems,
      enhancementAidItems,
      consumableItems,
      memoryItems,
      equippedMemoryByHero,
      heroProgressById,
      refreshItems,
      collectBattleDrops,
      grantBattleHeroExp,
      getHeroProgress,
      grantMissionRewards,
      buyEquipment,
      craftEquipment,
      sellEquipment,
      sellEquipmentBulk,
      isEquipmentLocked,
      setEquipmentLocked,
      getEquipmentEnhanceLevel,
      getEquipmentEnhanceBonus,
      getEquipmentEnhancementPreview,
      enhanceEquipment,
      buyMaterials,
      payCost,
      consumeMaterials,
      equipItem,
      unequipItem,
      setHeroMemory,
      getHeroMemory(heroId) {
        return equippedMemoryByHero[heroId] ?? null;
      },
      getMemoryOwner(memoryId) {
        return memoryOwnerMap.get(memoryId) ?? null;
      },
      getLegendaryEquipmentOwner(equipmentId) {
        const item = legendaryEquipmentItemById[equipmentId];
        if (!item) {
          return null;
        }
        const owners = ownerMap.get(item.uid) ?? [];
        return owners.length > 0 ? owners[0].heroId : null;
      },
      getItemOwner(itemUid) {
        const list = ownerMap.get(itemUid);
        return list && list.length > 0 ? list[0] : null;
      },
      getItemOwners(itemUid) {
        return ownerMap.get(itemUid) ?? [];
      },
      exportSnapshot,
      importSnapshot
    }),
    [
      consumableItems,
      equippedByHero,
      equippedMemoryByHero,
      forgeEnhancementBonusRate,
      gold,
      grantBattleHeroExp,
      getHeroProgress,
      heroProgressById,
      itemMap,
      items,
      materialItems,
      memoryItems,
      enhancementAidItems,
      memoryOwnerMap,
      ownerMap,
      ownedLegendaryEquipmentIds,
      droppedEquipmentItems,
      enhancementAidStock,
      equipmentEnhancementByUid,
      lockedEquipmentItemUids,
      lockedEquipmentUidSet,
      isBackpackEquipmentFull,
      normalEquipmentCount,
      materialStock,
      ownedMemoryIdSet,
      reputation,
      soldEquipmentItemUids
    ]
  );

  return <EquipmentInventoryContext.Provider value={value}>{children}</EquipmentInventoryContext.Provider>;
}

export function useEquipmentInventory(): EquipmentInventoryContextValue {
  const context = useContext(EquipmentInventoryContext);
  if (!context) {
    throw new Error("useEquipmentInventory must be used within EquipmentInventoryProvider");
  }
  return context;
}


