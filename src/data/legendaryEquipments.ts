import legendaryEquipmentsConfigJson from "./config/legendaryEquipments.json";
import legendaryEquipmentSkillsConfigJson from "./config/legendaryEquipmentSkills.json";
import type {
  EquipmentQuality,
  EquipmentRank,
  EquipmentSlot,
  EquipmentStatKey,
  EquipmentSubtype,
  GeneratedEquipment,
  GeneratedEquipmentAffix,
  GeneratedEquipmentStat,
  LegendaryEquipmentDefinition,
  LegendaryEquipmentFixedStat,
  LegendaryEquipmentSkillDefinition
} from "../types/game";

interface LegendaryEquipmentSkillsConfig {
  skills?: Array<{
    id?: unknown;
    name?: unknown;
    description?: unknown;
  }>;
}

interface LegendaryEquipmentFixedStatConfig {
  key?: unknown;
  value?: unknown;
}

interface LegendaryEquipmentsConfig {
  equipments?: Array<{
    id?: unknown;
    name?: unknown;
    title?: unknown;
    lore?: unknown;
    slot?: unknown;
    subtype?: unknown;
    level?: unknown;
    rank?: unknown;
    quality?: unknown;
    t1Stats?: unknown;
    affixes?: unknown;
    passiveSkillId?: unknown;
  }>;
}

const VALID_EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "head",
  "armor",
  "oneHand",
  "twoHand",
  "bracer",
  "legs",
  "shoes",
  "accessory",
  "castingMedium",
  "castingCore"
];
const VALID_EQUIPMENT_SUBTYPES: EquipmentSubtype[] = [
  "heavyHelm",
  "lightHelm",
  "lightArmor",
  "heavyArmor",
  "robe",
  "shield",
  "longSword",
  "staff",
  "greatSword",
  "spear",
  "plateBracer",
  "clothBracer",
  "lightLegGuard",
  "heavyLegGuard",
  "clothShoes",
  "plateBoots",
  "fireMedium",
  "frostMedium",
  "stormMedium",
  "fireCore",
  "rangerBoots",
  "ring",
  "necklace",
  "bracelet"
];
const VALID_EQUIPMENT_RANKS: EquipmentRank[] = ["crude", "fine", "superior", "perfect"];
const VALID_EQUIPMENT_QUALITIES: EquipmentQuality[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const VALID_EQUIPMENT_STAT_KEYS: EquipmentStatKey[] = [
  "hp",
  "mp",
  "str",
  "int",
  "agi",
  "def",
  "magicDefense",
  "penetration",
  "magicPenetration",
  "critRate",
  "critDamage",
  "evasion",
  "aggro",
  "lifeSteal",
  "thorns",
  "physicalDamageBoost",
  "magicDamageBoost",
  "elementalDamageBoost",
  "damageBoost",
  "damageReduction",
  "elementalPierce",
  "allRes",
  "allBoost",
  "armorPiercePct",
  "magicPiercePct"
];

const EQUIPMENT_SLOT_SET = new Set<EquipmentSlot>(VALID_EQUIPMENT_SLOTS);
const EQUIPMENT_SUBTYPE_SET = new Set<EquipmentSubtype>(VALID_EQUIPMENT_SUBTYPES);
const EQUIPMENT_RANK_SET = new Set<EquipmentRank>(VALID_EQUIPMENT_RANKS);
const EQUIPMENT_QUALITY_SET = new Set<EquipmentQuality>(VALID_EQUIPMENT_QUALITIES);
const EQUIPMENT_STAT_KEY_SET = new Set<EquipmentStatKey>(VALID_EQUIPMENT_STAT_KEYS);

const EQUIPMENT_STAT_LABELS: Record<EquipmentStatKey, string> = {
  hp: "生命值",
  mp: "法力值",
  str: "力量",
  int: "智力",
  agi: "敏捷",
  def: "物理防御",
  magicDefense: "魔法防御",
  penetration: "物理穿透",
  magicPenetration: "魔法穿透",
  critRate: "暴击率",
  critDamage: "暴击伤害",
  evasion: "闪避率",
  aggro: "仇恨",
  lifeSteal: "吸血",
  thorns: "反伤",
  physicalDamageBoost: "物理伤害增加",
  magicDamageBoost: "魔法伤害增加",
  elementalDamageBoost: "元素伤害增加",
  damageBoost: "最终伤害增加",
  damageReduction: "最终伤害减免",
  elementalPierce: "元素穿透",
  allRes: "全元素抗性",
  allBoost: "元素伤害增加",
  armorPiercePct: "物理百分比穿透",
  magicPiercePct: "魔法百分比穿透"
};

export const LEGENDARY_EQUIPMENT_RUNE_SLOT_COUNT = 5;

const FALLBACK_SKILL: LegendaryEquipmentSkillDefinition = {
  id: "legendary_equip_skill_fallback",
  name: "古老回响",
  description: "被动：该装备的实际技能配置缺失，当前仅用于占位展示。"
};

const FALLBACK_SLOT: EquipmentSlot = "accessory";
const FALLBACK_SUBTYPE: EquipmentSubtype = "ring";
const FALLBACK_LEVEL = 1;
const FALLBACK_RANK: EquipmentRank = "perfect";
const FALLBACK_QUALITY: EquipmentQuality = "legendary";
const FALLBACK_T1_STATS: LegendaryEquipmentFixedStat[] = [{ key: "hp", value: 200 }];
const FALLBACK_AFFIXES: LegendaryEquipmentFixedStat[] = [{ key: "allRes", value: 0.03 }];

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number(value.toFixed(6));
}

function asPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function asEquipmentSlot(value: unknown): EquipmentSlot | null {
  if (typeof value !== "string") {
    return null;
  }
  return EQUIPMENT_SLOT_SET.has(value as EquipmentSlot) ? (value as EquipmentSlot) : null;
}

function asEquipmentSubtype(value: unknown): EquipmentSubtype | null {
  if (typeof value !== "string") {
    return null;
  }
  return EQUIPMENT_SUBTYPE_SET.has(value as EquipmentSubtype) ? (value as EquipmentSubtype) : null;
}

function asEquipmentRank(value: unknown): EquipmentRank | null {
  if (typeof value !== "string") {
    return null;
  }
  return EQUIPMENT_RANK_SET.has(value as EquipmentRank) ? (value as EquipmentRank) : null;
}

function asEquipmentQuality(value: unknown): EquipmentQuality | null {
  if (typeof value !== "string") {
    return null;
  }
  return EQUIPMENT_QUALITY_SET.has(value as EquipmentQuality) ? (value as EquipmentQuality) : null;
}

function asEquipmentStatKey(value: unknown): EquipmentStatKey | null {
  if (typeof value !== "string") {
    return null;
  }
  return EQUIPMENT_STAT_KEY_SET.has(value as EquipmentStatKey) ? (value as EquipmentStatKey) : null;
}

function buildSkillList(rawConfig: LegendaryEquipmentSkillsConfig): LegendaryEquipmentSkillDefinition[] {
  const source = Array.isArray(rawConfig.skills) ? rawConfig.skills : [];
  const seen = new Set<string>();
  const result: LegendaryEquipmentSkillDefinition[] = [];

  source.forEach((entry) => {
    const id = asNonEmptyString(entry.id);
    const name = asNonEmptyString(entry.name);
    const description = asNonEmptyString(entry.description);
    if (!id || !name || !description || seen.has(id)) {
      return;
    }
    seen.add(id);
    result.push({ id, name, description });
  });

  if (result.length <= 0) {
    return [FALLBACK_SKILL];
  }
  return result;
}

function buildById<T extends { id: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

function normalizeFixedStats(
  input: unknown,
  fallbackStats: LegendaryEquipmentFixedStat[]
): LegendaryEquipmentFixedStat[] {
  const source = Array.isArray(input) ? (input as LegendaryEquipmentFixedStatConfig[]) : [];
  const result: LegendaryEquipmentFixedStat[] = [];

  source.forEach((entry) => {
    const key = asEquipmentStatKey(entry.key);
    const value = asFiniteNumber(entry.value);
    if (!key || value === null) {
      return;
    }
    result.push({ key, value });
  });

  if (result.length <= 0) {
    return [...fallbackStats];
  }
  return result;
}

function buildLegendaryEquipments(
  rawConfig: LegendaryEquipmentsConfig,
  skillMap: Record<string, LegendaryEquipmentSkillDefinition>
): LegendaryEquipmentDefinition[] {
  const source = Array.isArray(rawConfig.equipments) ? rawConfig.equipments : [];
  const seen = new Set<string>();
  const fallbackSkillId = Object.keys(skillMap)[0] ?? FALLBACK_SKILL.id;
  const result: LegendaryEquipmentDefinition[] = [];

  source.forEach((entry) => {
    const id = asNonEmptyString(entry.id);
    const name = asNonEmptyString(entry.name);
    const title = asNonEmptyString(entry.title);
    const lore = asNonEmptyString(entry.lore);
    const configuredSkillId = asNonEmptyString(entry.passiveSkillId);
    if (!id || !name || !title || !lore || seen.has(id)) {
      return;
    }

    const passiveSkillId = configuredSkillId && skillMap[configuredSkillId] ? configuredSkillId : fallbackSkillId;
    const slot = asEquipmentSlot(entry.slot) ?? FALLBACK_SLOT;
    const subtype = asEquipmentSubtype(entry.subtype) ?? FALLBACK_SUBTYPE;
    const level = asPositiveInteger(entry.level, FALLBACK_LEVEL);
    const rank = asEquipmentRank(entry.rank) ?? FALLBACK_RANK;
    const quality = asEquipmentQuality(entry.quality) ?? FALLBACK_QUALITY;
    const t1Stats = normalizeFixedStats(entry.t1Stats, FALLBACK_T1_STATS);
    const affixes = normalizeFixedStats(entry.affixes, FALLBACK_AFFIXES);

    seen.add(id);
    result.push({
      id,
      name,
      title,
      lore,
      slot,
      subtype,
      level,
      rank,
      quality,
      t1Stats,
      affixes,
      runeSlotCount: LEGENDARY_EQUIPMENT_RUNE_SLOT_COUNT,
      passiveSkillId
    });
  });

  return result;
}

function buildGeneratedStats(stats: LegendaryEquipmentFixedStat[]): GeneratedEquipmentStat[] {
  return stats.map((stat) => ({
    key: stat.key,
    label: EQUIPMENT_STAT_LABELS[stat.key],
    baseValue: stat.value,
    finalValue: stat.value
  }));
}

function buildGeneratedAffixes(stats: LegendaryEquipmentFixedStat[]): GeneratedEquipmentAffix[] {
  return stats.map((stat) => ({
    key: stat.key,
    label: EQUIPMENT_STAT_LABELS[stat.key],
    rolledValue: stat.value,
    finalValue: stat.value
  }));
}

function buildLegendaryItem(definition: LegendaryEquipmentDefinition): GeneratedEquipment {
  return {
    uid: `legendary-fixed-${definition.id}`,
    templateId: definition.id,
    templateName: definition.name,
    slot: definition.slot,
    subtype: definition.subtype,
    level: definition.level,
    rank: definition.rank,
    quality: definition.quality,
    rankPercent: 0,
    affixCount: definition.affixes.length,
    sockets: definition.runeSlotCount,
    t1Stats: buildGeneratedStats(definition.t1Stats),
    affixes: buildGeneratedAffixes(definition.affixes),
    source: "legendary-fixed",
    environmentId: "legendary-fixed"
  };
}

const skillList = buildSkillList(legendaryEquipmentSkillsConfigJson as LegendaryEquipmentSkillsConfig);

export const legendaryEquipmentSkillsById: Record<string, LegendaryEquipmentSkillDefinition> = buildById(skillList);
export const legendaryEquipmentSkills = skillList;
export const legendaryEquipments = buildLegendaryEquipments(
  legendaryEquipmentsConfigJson as LegendaryEquipmentsConfig,
  legendaryEquipmentSkillsById
);
export const legendaryEquipmentById: Record<string, LegendaryEquipmentDefinition> = buildById(legendaryEquipments);

export const legendaryEquipmentItems: GeneratedEquipment[] = legendaryEquipments.map(buildLegendaryItem);
export const legendaryEquipmentItemById: Record<string, GeneratedEquipment> = legendaryEquipments.reduce<Record<string, GeneratedEquipment>>(
  (acc, definition, index) => {
    acc[definition.id] = legendaryEquipmentItems[index];
    return acc;
  },
  {}
);
export const legendaryEquipmentUidById: Record<string, string> = legendaryEquipments.reduce<Record<string, string>>((acc, definition) => {
  acc[definition.id] = legendaryEquipmentItemById[definition.id].uid;
  return acc;
}, {});
export const legendaryEquipmentIdByUid: Record<string, string> = Object.entries(legendaryEquipmentUidById).reduce<
  Record<string, string>
>((acc, [equipmentId, uid]) => {
  acc[uid] = equipmentId;
  return acc;
}, {});
