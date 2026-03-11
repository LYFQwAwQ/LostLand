import { generateEquipmentBatch } from "../lib/equipmentSystem";
import type { BattleDropEntry, BattleDropSummary, BattleMaterialRarity } from "../types/battle";
import type { EquipmentGenerationEnvironment, EquipmentTemplate } from "../types/game";
import { equipmentTemplates } from "./equipmentTemplates";

interface MaterialDropRule {
  id: string;
  name: string;
  rarity: BattleMaterialRarity;
  weight: number;
  quantity: [number, number];
}

interface EquipmentDropRule {
  id: string;
  weight: number;
  templateIds: string[];
  count: [number, number];
  levelOffset: number;
  environment: EquipmentGenerationEnvironment;
}

interface EnemyDropTable {
  materialRolls: [number, number];
  equipmentRolls: [number, number];
  materials: MaterialDropRule[];
  equipments: EquipmentDropRule[];
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
    crude: 1.2,
    fine: 1.15,
    superior: 0.8,
    perfect: 0.45
  },
  qualityWeightMultipliers: {
    common: 1.35,
    uncommon: 1.2,
    rare: 0.75,
    epic: 0.4,
    legendary: 0.16,
    mythic: 0.04
  }
};

const midTierEnvironment: EquipmentGenerationEnvironment = {
  id: "battle-mid-tier",
  label: "战斗掉落（中阶）",
  rankWeightMultipliers: {
    crude: 0.95,
    fine: 1.08,
    superior: 1.05,
    perfect: 0.7
  },
  qualityWeightMultipliers: {
    common: 0.95,
    uncommon: 1.1,
    rare: 1.05,
    epic: 0.82,
    legendary: 0.38,
    mythic: 0.12
  }
};

const highTierEnvironment: EquipmentGenerationEnvironment = {
  id: "battle-high-tier",
  label: "战斗掉落（高阶）",
  rankWeightMultipliers: {
    crude: 0.72,
    fine: 0.96,
    superior: 1.18,
    perfect: 1.08
  },
  qualityWeightMultipliers: {
    common: 0.62,
    uncommon: 0.88,
    rare: 1.18,
    epic: 1.1,
    legendary: 0.72,
    mythic: 0.25
  }
};

const ENEMY_DROP_TABLES: Record<string, EnemyDropTable> = {
  "beast-hound": {
    materialRolls: [1, 2],
    equipmentRolls: [0, 1],
    materials: [
      { id: "beast_fang", name: "裂齿犬牙", rarity: "common", weight: 52, quantity: [1, 3] },
      { id: "coarse_hide", name: "粗制兽皮", rarity: "common", weight: 34, quantity: [1, 2] },
      { id: "feral_claw", name: "狂化利爪", rarity: "uncommon", weight: 14, quantity: [1, 1] }
    ],
    equipments: [
      {
        id: "hound-strike-kit",
        weight: 55,
        templateIds: ["iron-longsword", "war-bracer", "ranger-legguard"],
        count: [1, 1],
        levelOffset: 0,
        environment: lowTierEnvironment
      },
      {
        id: "hound-guard-kit",
        weight: 35,
        templateIds: ["tower-shield", "steel-greaves", "dawn-helm"],
        count: [1, 1],
        levelOffset: 0,
        environment: lowTierEnvironment
      },
      {
        id: "hound-relic-kit",
        weight: 10,
        templateIds: ["oath-ring"],
        count: [1, 1],
        levelOffset: 1,
        environment: midTierEnvironment
      }
    ]
  },
  "beast-spewer": {
    materialRolls: [2, 3],
    equipmentRolls: [0, 1],
    materials: [
      { id: "corrosive_slime", name: "腐沼黏液", rarity: "common", weight: 46, quantity: [1, 3] },
      { id: "venom_gland", name: "腐毒腺体", rarity: "uncommon", weight: 34, quantity: [1, 2] },
      { id: "shadow_crystal", name: "暗雾结晶", rarity: "rare", weight: 20, quantity: [1, 1] }
    ],
    equipments: [
      {
        id: "spewer-ritual-kit",
        weight: 44,
        templateIds: ["spell-bracer", "frost-medium", "starveil-hood"],
        count: [1, 1],
        levelOffset: 0,
        environment: midTierEnvironment
      },
      {
        id: "spewer-core-kit",
        weight: 28,
        templateIds: ["storm-medium", "fire-medium", "ember-bracelet"],
        count: [1, 1],
        levelOffset: 1,
        environment: midTierEnvironment
      },
      {
        id: "spewer-rare-kit",
        weight: 28,
        templateIds: ["fire-core", "star-necklace"],
        count: [1, 1],
        levelOffset: 1,
        environment: highTierEnvironment
      }
    ]
  },
  "beast-brute": {
    materialRolls: [2, 4],
    equipmentRolls: [1, 1],
    materials: [
      { id: "thorn_carapace", name: "荆棘甲片", rarity: "common", weight: 38, quantity: [1, 3] },
      { id: "hardened_tendon", name: "硬化筋腱", rarity: "uncommon", weight: 36, quantity: [1, 2] },
      { id: "war_beast_core", name: "战兽核心", rarity: "rare", weight: 26, quantity: [1, 1] }
    ],
    equipments: [
      {
        id: "brute-frontline-kit",
        weight: 46,
        templateIds: ["fortress-armor", "oath-greatsword", "steel-greaves"],
        count: [1, 1],
        levelOffset: 0,
        environment: midTierEnvironment
      },
      {
        id: "brute-weapon-kit",
        weight: 36,
        templateIds: ["storm-spear", "tower-shield", "war-bracer"],
        count: [1, 1],
        levelOffset: 1,
        environment: highTierEnvironment
      },
      {
        id: "brute-relic-kit",
        weight: 18,
        templateIds: ["oath-ring", "star-necklace"],
        count: [1, 1],
        levelOffset: 1,
        environment: highTierEnvironment
      }
    ]
  },
  "beast-priest": {
    materialRolls: [2, 4],
    equipmentRolls: [1, 2],
    materials: [
      { id: "ritual_bone", name: "祭祀骨片", rarity: "uncommon", weight: 36, quantity: [1, 2] },
      { id: "black_tallow", name: "黑蜡残渣", rarity: "rare", weight: 34, quantity: [1, 2] },
      { id: "void_relic", name: "虚冥遗物", rarity: "epic", weight: 30, quantity: [1, 1] }
    ],
    equipments: [
      {
        id: "priest-arcane-kit",
        weight: 42,
        templateIds: ["ashen-robe", "fire-core", "storm-medium"],
        count: [1, 1],
        levelOffset: 1,
        environment: highTierEnvironment
      },
      {
        id: "priest-mystic-kit",
        weight: 34,
        templateIds: ["starveil-hood", "spell-bracer", "ember-bracelet"],
        count: [1, 1],
        levelOffset: 1,
        environment: highTierEnvironment
      },
      {
        id: "priest-legend-kit",
        weight: 24,
        templateIds: ["star-necklace", "oath-ring"],
        count: [1, 1],
        levelOffset: 2,
        environment: highTierEnvironment
      }
    ]
  }
};

const DEFAULT_DROP_TABLE: EnemyDropTable = {
  materialRolls: [1, 2],
  equipmentRolls: [0, 1],
  materials: [
    { id: "worn_scrap", name: "破损残片", rarity: "common", weight: 70, quantity: [1, 2] },
    { id: "stable_fragment", name: "稳定碎块", rarity: "uncommon", weight: 30, quantity: [1, 1] }
  ],
  equipments: [
    {
      id: "default-equipment-kit",
      weight: 100,
      templateIds: ["iron-longsword", "war-bracer", "oath-ring", "spell-bracer"],
      count: [1, 1],
      levelOffset: 0,
      environment: lowTierEnvironment
    }
  ]
};

function buildMaterialDropCatalog(): BattleDropMaterialCatalogEntry[] {
  const sourceMap = new Map<
    string,
    {
      id: string;
      name: string;
      rarity: BattleMaterialRarity;
      sourceEnemyPrototypeIds: Set<string>;
    }
  >();

  const appendRules = (sourceEnemyPrototypeId: string, rules: MaterialDropRule[]) => {
    rules.forEach((rule) => {
      const existing = sourceMap.get(rule.id);
      if (existing) {
        existing.sourceEnemyPrototypeIds.add(sourceEnemyPrototypeId);
        return;
      }
      sourceMap.set(rule.id, {
        id: rule.id,
        name: rule.name,
        rarity: rule.rarity,
        sourceEnemyPrototypeIds: new Set([sourceEnemyPrototypeId])
      });
    });
  };

  Object.entries(ENEMY_DROP_TABLES).forEach(([enemyPrototypeId, table]) => {
    appendRules(enemyPrototypeId, table.materials);
  });
  appendRules("default", DEFAULT_DROP_TABLE.materials);

  return [...sourceMap.values()]
    .map((item) => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      sourceEnemyPrototypeIds: [...item.sourceEnemyPrototypeIds].sort((left, right) => left.localeCompare(right, "en-US"))
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
}

const MATERIAL_DROP_CATALOG = buildMaterialDropCatalog();

export function getMaterialDropCatalog(): BattleDropMaterialCatalogEntry[] {
  return MATERIAL_DROP_CATALOG.map((item) => ({
    ...item,
    sourceEnemyPrototypeIds: [...item.sourceEnemyPrototypeIds]
  }));
}

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
  const pool = templateIds.map((id) => templateMap.get(id)).filter((item): item is EquipmentTemplate => !!item);
  return pool.length > 0 ? pool : equipmentTemplates;
}

export function generateBattleDropsFromTable(params: GenerateBattleDropsParams): BattleDropSummary {
  const random = createRandom(hashSeed(`${params.battleId}:${params.nodeId}:${params.elapsedMs}`));
  const entries: BattleDropEntry[] = [];
  const items: BattleDropSummary["items"] = [];
  let entrySerial = 0;

  params.enemies.forEach((enemy, enemyIndex) => {
    const table = ENEMY_DROP_TABLES[enemy.prototypeId] ?? DEFAULT_DROP_TABLE;
    const materialRolls = rollInt(table.materialRolls[0], table.materialRolls[1], random);
    const equipmentRolls = rollInt(table.equipmentRolls[0], table.equipmentRolls[1], random);

    for (let rollIndex = 0; rollIndex < materialRolls; rollIndex += 1) {
      const rule = pickWeighted(table.materials, random);
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
      const rule = pickWeighted(table.equipments, random);
      const count = Math.max(0, rollInt(rule.count[0], rule.count[1], random));
      if (count <= 0) {
        continue;
      }

      const level = clamp(enemy.level + rule.levelOffset, 1, 30);
      const pool = resolveTemplatePool(rule.templateIds);
      const generated = generateEquipmentBatch(pool, count, {
        level,
        seed: `${params.battleId}:${enemy.unitId}:${rule.id}:${rollIndex + 1}`,
        source: `battle:${params.nodeId}:${enemy.prototypeId}`,
        environment: rule.environment
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
