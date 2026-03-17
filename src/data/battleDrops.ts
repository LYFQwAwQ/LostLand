import { generateEquipmentBatch } from "../lib/equipmentSystem";
import type { BattleDropEntry, BattleDropSummary, BattleMaterialRarity } from "../types/battle";
import type { EquipmentGenerationEnvironment, EquipmentQuality, EquipmentTemplate } from "../types/game";
import { enemyPrototypeById, enemyPrototypeCatalog, type EnemyRace, type EnemyRarityTier } from "./battleUnits";
import { equipmentTemplates } from "./equipmentTemplates";

interface MaterialDefinition {
  id: string;
  name: string;
  race: EnemyRace;
  rarity: BattleMaterialRarity;
  baseWeight: number;
  quantity: [number, number];
}

interface RarityDropConfig {
  materialRolls: [number, number];
  equipmentRolls: [number, number];
  levelOffset: number;
  baseEnvironment: EquipmentGenerationEnvironment;
}

export interface BattleDropEnemyContext {
  unitId: string;
  unitName: string;
  prototypeId: string;
  level: number;
}

export interface GenerateBattleDropsParams {
  battleId: string;
  nodeId: string;
  elapsedMs: number;
  enemies: BattleDropEnemyContext[];
}

export interface BattleDropMaterialCatalogEntry {
  id: string;
  name: string;
  rarity: BattleMaterialRarity;
  sourceEnemyPrototypeIds: string[];
}

const templateMap = new Map<string, EquipmentTemplate>(equipmentTemplates.map((template) => [template.id, template]));

const lowTierEnvironment: EquipmentGenerationEnvironment = {
  id: "battle-low-tier",
  label: "战斗掉落（低阶）",
  rankWeightMultipliers: {
    crude: 1.18,
    fine: 1.12,
    superior: 0.86,
    perfect: 0.52
  },
  qualityWeightMultipliers: {
    common: 1.28,
    uncommon: 1.16,
    rare: 0.8,
    epic: 0.44,
    legendary: 0.18,
    mythic: 0.04
  }
};

const midTierEnvironment: EquipmentGenerationEnvironment = {
  id: "battle-mid-tier",
  label: "战斗掉落（中阶）",
  rankWeightMultipliers: {
    crude: 0.96,
    fine: 1.06,
    superior: 1.08,
    perfect: 0.74
  },
  qualityWeightMultipliers: {
    common: 0.98,
    uncommon: 1.08,
    rare: 1.06,
    epic: 0.86,
    legendary: 0.42,
    mythic: 0.12
  }
};

const highTierEnvironment: EquipmentGenerationEnvironment = {
  id: "battle-high-tier",
  label: "战斗掉落（高阶）",
  rankWeightMultipliers: {
    crude: 0.72,
    fine: 0.92,
    superior: 1.18,
    perfect: 1.12
  },
  qualityWeightMultipliers: {
    common: 0.62,
    uncommon: 0.84,
    rare: 1.16,
    epic: 1.14,
    legendary: 0.78,
    mythic: 0.28
  }
};

const DROP_CONFIG_BY_RARITY: Record<EnemyRarityTier, RarityDropConfig> = {
  common: {
    materialRolls: [1, 2],
    equipmentRolls: [0, 1],
    levelOffset: 0,
    baseEnvironment: lowTierEnvironment
  },
  elite: {
    materialRolls: [2, 3],
    equipmentRolls: [1, 1],
    levelOffset: 1,
    baseEnvironment: midTierEnvironment
  },
  champion: {
    materialRolls: [2, 4],
    equipmentRolls: [1, 2],
    levelOffset: 1,
    baseEnvironment: midTierEnvironment
  },
  lord: {
    materialRolls: [3, 4],
    equipmentRolls: [1, 2],
    levelOffset: 2,
    baseEnvironment: highTierEnvironment
  },
  calamity: {
    materialRolls: [4, 5],
    equipmentRolls: [2, 3],
    levelOffset: 3,
    baseEnvironment: highTierEnvironment
  }
};

const MATERIAL_RARITY_WEIGHT_BY_ENEMY_RARITY: Record<EnemyRarityTier, Record<BattleMaterialRarity, number>> = {
  common: { common: 1.2, uncommon: 0.82, rare: 0.45, epic: 0.2 },
  elite: { common: 1, uncommon: 1, rare: 0.74, epic: 0.34 },
  champion: { common: 0.88, uncommon: 1.06, rare: 1, epic: 0.58 },
  lord: { common: 0.74, uncommon: 0.98, rare: 1.2, epic: 0.9 },
  calamity: { common: 0.6, uncommon: 0.86, rare: 1.3, epic: 1.25 }
};

function defaultQuantityByRarity(rarity: BattleMaterialRarity): [number, number] {
  if (rarity === "common") {
    return [1, 3];
  }
  if (rarity === "uncommon") {
    return [1, 2];
  }
  if (rarity === "rare") {
    return [1, 2];
  }
  return [1, 1];
}

function createMaterial(
  race: EnemyRace,
  id: string,
  name: string,
  rarity: BattleMaterialRarity,
  baseWeight: number,
  quantity: [number, number] = defaultQuantityByRarity(rarity)
): MaterialDefinition {
  return { race, id, name, rarity, baseWeight, quantity };
}

const MATERIAL_POOL_BY_RACE: Record<EnemyRace, MaterialDefinition[]> = {
  undead: [
    createMaterial("undead", "undead_grave_dust", "墓尘", "common", 42),
    createMaterial("undead", "undead_lantern_wax", "冥灯蜡", "uncommon", 28),
    createMaterial("undead", "undead_ossified_powder", "骨化粉尘", "common", 34),
    createMaterial("undead", "undead_soul_resin", "魂烬树脂", "rare", 18),
    createMaterial("undead", "undead_bone_shard", "枯骨碎片", "common", 30),
    createMaterial("undead", "undead_marrow_ash", "髓灰", "common", 26),
    createMaterial("undead", "undead_shade_cloth", "幽影残布", "uncommon", 24),
    createMaterial("undead", "undead_wraith_ink", "幽魂墨滴", "uncommon", 22),
    createMaterial("undead", "undead_crypt_iron", "墓窟黑铁", "uncommon", 20),
    createMaterial("undead", "undead_grim_amber", "冥珀", "rare", 14),
    createMaterial("undead", "undead_void_nail", "虚骸钉", "rare", 12),
    createMaterial("undead", "undead_night_blossom", "夜壳花瓣", "uncommon", 18),
    createMaterial("undead", "undead_lord_phylactery", "魂匣碎核", "epic", 8),
    createMaterial("undead", "undead_catacomb_heart", "古陵心核", "epic", 6)
  ],
  beast: [
    createMaterial("beast", "beast_hunter_fur", "猎群兽皮", "common", 40),
    createMaterial("beast", "beast_blood_marrow", "兽血髓", "uncommon", 28),
    createMaterial("beast", "beast_sunscale_fragment", "曦鳞碎片", "rare", 16),
    createMaterial("beast", "beast_tempered_horn", "淬炼兽角", "common", 34),
    createMaterial("beast", "beast_primal_heart", "原兽心核", "rare", 18),
    createMaterial("beast", "beast_ridge_claw", "脊爪", "common", 30),
    createMaterial("beast", "beast_bristle_plate", "硬鬃甲片", "uncommon", 24),
    createMaterial("beast", "beast_talon_resin", "裂爪树脂", "uncommon", 22),
    createMaterial("beast", "beast_moonhide", "月纹皮膜", "common", 24),
    createMaterial("beast", "beast_howl_gland", "嚎鸣腺体", "uncommon", 18),
    createMaterial("beast", "beast_alpha_eye", "首领瞳晶", "rare", 14),
    createMaterial("beast", "beast_storm_spine", "风暴脊骨", "rare", 12),
    createMaterial("beast", "beast_king_fang", "兽王獠牙", "epic", 8),
    createMaterial("beast", "beast_ancient_totem", "荒古图腾骨", "epic", 6)
  ],
  human: [
    createMaterial("human", "human_ancient_coin", "旧王钱币", "common", 42),
    createMaterial("human", "human_caravan_salt", "商队盐晶", "common", 34),
    createMaterial("human", "human_rune_ink", "符印墨液", "uncommon", 24),
    createMaterial("human", "human_refined_steel", "精炼钢锭", "uncommon", 28),
    createMaterial("human", "human_masterwork_gear", "大师级机芯", "epic", 8),
    createMaterial("human", "human_forged_rivet", "锻铆钉", "common", 30),
    createMaterial("human", "human_reinforced_plate", "加固装甲片", "uncommon", 24),
    createMaterial("human", "human_watchspring", "守望发条", "uncommon", 22),
    createMaterial("human", "human_treated_leather", "鞣制皮革", "common", 24),
    createMaterial("human", "human_command_seal", "军令封蜡", "rare", 16),
    createMaterial("human", "human_runed_bearing", "符文轴承", "rare", 14),
    createMaterial("human", "human_merc_contract", "雇佣契据", "common", 20),
    createMaterial("human", "human_ceremonial_chalice", "祭礼圣杯碎片", "rare", 12),
    createMaterial("human", "human_imperial_core", "帝国机核", "epic", 6)
  ],
  aberrant: [
    createMaterial("aberrant", "aberrant_spore_dust", "异孢粉尘", "common", 38),
    createMaterial("aberrant", "aberrant_venom_sac", "异化毒囊", "common", 34),
    createMaterial("aberrant", "aberrant_chitin_plate", "突变甲壳", "uncommon", 28),
    createMaterial("aberrant", "aberrant_twitch_tendon", "扭曲腱索", "uncommon", 24),
    createMaterial("aberrant", "aberrant_fever_bile", "疫热胆汁", "rare", 18),
    createMaterial("aberrant", "aberrant_mire_eye", "沼魇眼核", "rare", 16),
    createMaterial("aberrant", "aberrant_rot_fang", "腐锐獠牙", "uncommon", 22),
    createMaterial("aberrant", "aberrant_chaos_pollen", "混沌孢团", "rare", 14),
    createMaterial("aberrant", "aberrant_warped_marrow", "畸变髓质", "uncommon", 20),
    createMaterial("aberrant", "aberrant_echo_membrane", "回音膜层", "common", 24),
    createMaterial("aberrant", "aberrant_plague_core", "瘟灾核", "epic", 8),
    createMaterial("aberrant", "aberrant_void_nucleus", "虚渊核", "epic", 6)
  ]
};

const EQUIPMENT_TEMPLATE_IDS_BY_RACE: Record<EnemyRace, { front: string[]; back: string[]; mix: string[] }> = {
  undead: {
    front: ["fortress-armor", "tower-shield", "steel-greaves", "dawn-helm", "war-bracer"],
    back: ["ashen-robe", "starveil-hood", "spell-bracer", "frost-medium", "storm-medium", "fire-core", "ember-bracelet", "star-necklace"],
    mix: ["iron-longsword", "oath-ring", "oath-greatsword"]
  },
  beast: {
    front: ["iron-longsword", "storm-spear", "windstride-boots", "ranger-legguard", "war-bracer", "steel-greaves"],
    back: ["ranger-legguard", "windstride-boots", "storm-medium", "oath-ring", "ember-bracelet", "spell-bracer"],
    mix: ["oath-greatsword", "tower-shield", "star-necklace"]
  },
  human: {
    front: ["fortress-armor", "dawn-helm", "tower-shield", "oath-greatsword", "steel-greaves", "war-bracer", "iron-longsword"],
    back: ["starveil-hood", "ashen-robe", "spell-bracer", "fire-medium", "frost-medium", "star-necklace", "oath-ring"],
    mix: ["storm-spear", "fire-core", "ember-bracelet"]
  },
  aberrant: {
    front: ["fortress-armor", "tower-shield", "oath-greatsword", "steel-greaves", "war-bracer"],
    back: ["ashen-robe", "spell-bracer", "fire-core", "storm-medium", "ember-bracelet", "star-necklace"],
    mix: ["iron-longsword", "oath-ring", "frost-medium"]
  }
};

const QUALITY_ORDER: EquipmentQuality[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function rollInt(min: number, max: number, random: () => number): number {
  const safeMin = Math.floor(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  if (safeMin === safeMax) {
    return safeMin;
  }
  return safeMin + Math.floor(random() * (safeMax - safeMin + 1));
}

function pickWeighted<T extends { weight: number }>(pool: T[], random: () => number): T {
  const total = pool.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) {
    return pool[0];
  }
  const threshold = random() * total;
  let cursor = 0;
  for (const item of pool) {
    cursor += Math.max(0, item.weight);
    if (threshold <= cursor) {
      return item;
    }
  }
  return pool[pool.length - 1];
}

function resolveTemplatePool(templateIds: string[]): EquipmentTemplate[] {
  const pool = templateIds.map((id) => templateMap.get(id)).filter((item): item is EquipmentTemplate => Boolean(item));
  return pool.length > 0 ? pool : equipmentTemplates;
}

function resolveRaceTemplateIds(race: EnemyRace, slotHint: "front" | "back", rarityTier: EnemyRarityTier): string[] {
  const racePool = EQUIPMENT_TEMPLATE_IDS_BY_RACE[race];
  const baseIds = slotHint === "front" ? racePool.front : racePool.back;
  if (rarityTier === "common") {
    return baseIds;
  }
  if (rarityTier === "elite") {
    return [...baseIds, ...racePool.mix.slice(0, 1)];
  }
  if (rarityTier === "champion") {
    return [...baseIds, ...racePool.mix.slice(0, 2)];
  }
  return [...baseIds, ...racePool.mix];
}

function resolveTierRank(rarityTier: EnemyRarityTier): number {
  if (rarityTier === "common") {
    return 0;
  }
  if (rarityTier === "elite") {
    return 1;
  }
  if (rarityTier === "champion") {
    return 2;
  }
  if (rarityTier === "lord") {
    return 3;
  }
  return 4;
}

function buildEnemyEnvironment(
  base: EquipmentGenerationEnvironment,
  targetQuality: EquipmentQuality,
  rarityTier: EnemyRarityTier
): EquipmentGenerationEnvironment {
  const targetIndex = QUALITY_ORDER.indexOf(targetQuality);
  const tierRank = resolveTierRank(rarityTier);
  const qualityWeightMultipliers = QUALITY_ORDER.reduce<Partial<Record<EquipmentQuality, number>>>((acc, quality, index) => {
    const distance = Math.abs(index - targetIndex);
    const focusMultiplier = distance === 0 ? 1.35 : distance === 1 ? 1.12 : distance === 2 ? 0.9 : 0.72;
    const upwardBias = index >= 2 ? 1 + tierRank * 0.06 : Math.max(0.65, 1 - tierRank * 0.05);
    const baseMultiplier = base.qualityWeightMultipliers?.[quality] ?? 1;
    acc[quality] = baseMultiplier * focusMultiplier * upwardBias;
    return acc;
  }, {});

  return {
    id: `${base.id}-${rarityTier}-${targetQuality}`,
    label: `${base.label}-${rarityTier}`,
    rankWeightMultipliers: base.rankWeightMultipliers,
    qualityWeightMultipliers
  };
}

function resolveMaterialPoolByEnemy(race: EnemyRace, rarityTier: EnemyRarityTier): Array<MaterialDefinition & { weight: number }> {
  const rarityWeightMap = MATERIAL_RARITY_WEIGHT_BY_ENEMY_RARITY[rarityTier];
  return MATERIAL_POOL_BY_RACE[race].map((material) => ({
    ...material,
    weight: Math.max(1, material.baseWeight * rarityWeightMap[material.rarity])
  }));
}

const MATERIAL_DROP_CATALOG = buildMaterialDropCatalog();

function buildMaterialDropCatalog(): BattleDropMaterialCatalogEntry[] {
  const sourceByRace = enemyPrototypeCatalog.reduce<Record<EnemyRace, string[]>>(
    (acc, profile) => {
      acc[profile.race].push(profile.id);
      return acc;
    },
    { undead: [], beast: [], human: [], aberrant: [] }
  );

  const allMaterials = [...MATERIAL_POOL_BY_RACE.undead, ...MATERIAL_POOL_BY_RACE.beast, ...MATERIAL_POOL_BY_RACE.human, ...MATERIAL_POOL_BY_RACE.aberrant];
  return allMaterials
    .map((material) => ({
      id: material.id,
      name: material.name,
      rarity: material.rarity,
      sourceEnemyPrototypeIds: [...sourceByRace[material.race]].sort((left, right) => left.localeCompare(right, "en-US"))
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

export function getMaterialDropCatalog(): BattleDropMaterialCatalogEntry[] {
  return MATERIAL_DROP_CATALOG.map((item) => ({
    ...item,
    sourceEnemyPrototypeIds: [...item.sourceEnemyPrototypeIds]
  }));
}

const DEFAULT_ENEMY_PROFILE = {
  race: "human" as EnemyRace,
  rarityTier: "common" as EnemyRarityTier,
  lootQualityTier: "common" as EquipmentQuality,
  slotHint: "front" as const
};

export function generateBattleDropsFromTable(params: GenerateBattleDropsParams): BattleDropSummary {
  const random = createRandom(hashSeed(`${params.battleId}:${params.nodeId}:${params.elapsedMs}`));
  const entries: BattleDropEntry[] = [];
  const items: BattleDropSummary["items"] = [];
  let entrySerial = 0;

  params.enemies.forEach((enemy, enemyIndex) => {
    const profile = enemyPrototypeById[enemy.prototypeId] ?? {
      ...DEFAULT_ENEMY_PROFILE,
      id: enemy.prototypeId,
      name: enemy.unitName,
      encounterWeight: 100,
      difficultyMultiplier: 0,
      baseLevel: enemy.level
    };
    const dropConfig = DROP_CONFIG_BY_RARITY[profile.rarityTier];
    const materialRolls = rollInt(dropConfig.materialRolls[0], dropConfig.materialRolls[1], random);
    const equipmentRolls = rollInt(dropConfig.equipmentRolls[0], dropConfig.equipmentRolls[1], random);
    const materialPool = resolveMaterialPoolByEnemy(profile.race, profile.rarityTier);

    for (let rollIndex = 0; rollIndex < materialRolls; rollIndex += 1) {
      const rule = pickWeighted(materialPool, random);
      const quantity = Math.max(1, rollInt(rule.quantity[0], rule.quantity[1], random));
      entrySerial += 1;
      entries.push({
        id: `mat-${enemyIndex + 1}-${rollIndex + 1}-${entrySerial}`,
        category: "material",
        quantity,
        sourceEnemyId: enemy.prototypeId,
        sourceEnemyName: enemy.unitName,
        equipment: null,
        material: {
          id: rule.id,
          name: rule.name,
          rarity: rule.rarity
        }
      });
    }

    for (let rollIndex = 0; rollIndex < equipmentRolls; rollIndex += 1) {
      const templateIds = resolveRaceTemplateIds(profile.race, profile.slotHint, profile.rarityTier);
      const pool = resolveTemplatePool(templateIds);
      const level = clamp(enemy.level + dropConfig.levelOffset, 1, 30);
      const environment = buildEnemyEnvironment(dropConfig.baseEnvironment, profile.lootQualityTier, profile.rarityTier);
      const generated = generateEquipmentBatch(pool, 1, {
        level,
        seed: `${params.battleId}:${enemy.unitId}:eq:${rollIndex + 1}`,
        source: `battle:${params.nodeId}:${enemy.prototypeId}`,
        environment
      });

      generated.forEach((item, itemIndex) => {
        items.push(item);
        entrySerial += 1;
        entries.push({
          id: `eq-${enemyIndex + 1}-${rollIndex + 1}-${itemIndex + 1}-${entrySerial}`,
          category: "equipment",
          quantity: 1,
          sourceEnemyId: enemy.prototypeId,
          sourceEnemyName: enemy.unitName,
          equipment: item,
          material: null
        });
      });
    }
  });

  return {
    generatedAt: params.elapsedMs,
    items,
    entries
  };
}

