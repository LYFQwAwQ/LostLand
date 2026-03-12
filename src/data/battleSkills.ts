import type {
  BattleActiveSkillDefinition,
  BattleDamageType,
  BattleElement,
  BattlePassiveSkillDefinition,
  BattleSkillCategory,
  BattleSkillExtraEffect,
  BattleSkillPool,
  BattleSkillRarity,
  BattleSkillScaling,
  BattleStatusApplication,
  BattleStatusEffectPolarity,
  BattleStatusKey,
  BattleTalentDefinition,
  BattleTalentRarity,
  BattleTargetType
} from "../types/battle";
import legendaryHeroSkillsConfigJson from "./config/legendaryHeroSkills.json";
import type { HeroClass } from "../types/game";

const HERO_CLASSES: HeroClass[] = ["paladin", "mage", "ranger", "priest"];
const SKILL_POOLS: BattleSkillPool[] = ["common", "class", "enemy"];
const SKILL_CATEGORIES: BattleSkillCategory[] = ["assault", "defend", "inspire", "afflict", "succor"];
const TARGET_TYPES: BattleTargetType[] = ["self", "singleEnemy", "allEnemies", "randomEnemies", "singleAlly", "allAllies", "lowestHpAlly"];
const DAMAGE_TYPES: BattleDamageType[] = ["physical", "magic"];
const ELEMENTS: BattleElement[] = ["fire", "water", "ice", "wind", "life", "light", "undead", "dark"];
const STATUS_KEYS: BattleStatusKey[] = [
  "frozen",
  "stunned",
  "poisoned",
  "burning",
  "guarded",
  "weakened",
  "shielded",
  "immune",
  "taunted"
];
const TALENT_RARITIES: BattleTalentRarity[] = ["common", "rare", "epic", "legendary", "unique"];
const SKILL_RARITIES: BattleSkillRarity[] = ["common", "rare", "epic", "legendary"];
const STATUS_EFFECT_POLARITIES: BattleStatusEffectPolarity[] = ["positive", "negative", "all"];
const ACTIVE_CATEGORY_FILE_NAMES = new Set<string>(["assault.json", "defend.json", "inspire.json", "afflict.json", "succor.json"]);
const FLAT_KEYS = [
  "maxHp",
  "maxMp",
  "str",
  "int",
  "agi",
  "def",
  "penetration",
  "armorPenPct",
  "critRate",
  "critDamage",
  "evasion",
  "aggro",
  "lifeSteal",
  "thorns",
  "damageBoost",
  "damageReduction",
  "elementalPierce",
  "allRes",
  "allBoost"
] as const;

const FALLBACK_BASIC_ATTACK: BattleActiveSkillDefinition = {
  id: "basic_attack",
  name: "基础攻击",
  kind: "active",
  rarity: "common",
  skillPool: "common",
  allowedHeroClasses: ["paladin", "mage", "ranger", "priest"],
  category: "assault",
  description: "配置缺失时的保底技能。",
  targetType: "singleEnemy",
  effect: "damage",
  damageType: "physical",
  mpCost: 0,
  cooldown: 0,
  baseWeight: 100,
  basePower: 70,
  scaling: { str: 0.9 },
  canCrit: true
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function parseEnum<T extends string>(value: unknown, candidates: readonly T[], fallback: T): T {
  if (typeof value === "string" && candidates.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

function parseHeroClassList(value: unknown): HeroClass[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is HeroClass => typeof item === "string" && HERO_CLASSES.includes(item as HeroClass));
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const result = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return result.length > 0 ? result : undefined;
}

function parseScaling(value: unknown): BattleSkillScaling {
  if (!isObject(value)) {
    return {};
  }
  return {
    str: typeof value.str === "number" ? value.str : undefined,
    int: typeof value.int === "number" ? value.int : undefined,
    agi: typeof value.agi === "number" ? value.agi : undefined,
    def: typeof value.def === "number" ? value.def : undefined,
    maxHp: typeof value.maxHp === "number" ? value.maxHp : undefined,
    missingHp: typeof value.missingHp === "number" ? value.missingHp : undefined
  };
}

function parseStatusApplication(value: unknown): BattleStatusApplication | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const key = parseEnum(value.key, STATUS_KEYS, "poisoned");
  const chance = parseNumber(value.chance, 0);
  const duration = Math.max(0, Math.round(parseNumber(value.duration, 0)));
  if (chance <= 0 || duration <= 0) {
    return undefined;
  }
  const potency = typeof value.potency === "number" ? value.potency : undefined;
  return {
    key,
    chance,
    duration,
    potency
  };
}

function parseFlatRecord(value: unknown): Record<string, number> | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const result: Record<string, number> = {};
  FLAT_KEYS.forEach((key) => {
    const parsed = value[key];
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      result[key] = parsed;
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseElementRecord(value: unknown): Record<string, number> | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const result: Record<string, number> = {};
  ELEMENTS.forEach((key) => {
    const parsed = value[key];
    if (typeof parsed === "number" && Number.isFinite(parsed)) {
      result[key] = parsed;
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
}

function parseExtraEffects(value: unknown): BattleSkillExtraEffect[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const effects: BattleSkillExtraEffect[] = [];
  value.forEach((entry) => {
    if (!isObject(entry) || typeof entry.type !== "string") {
      return;
    }
    const target = parseEnum(entry.target, ["self", "targets"], "targets");
    if (entry.type === "applyStatus") {
      const application = parseStatusApplication(entry.application);
      if (application) {
        effects.push({
          type: "applyStatus",
          target,
          application
        });
      }
      return;
    }
    if (entry.type === "actionDelta") {
      const delta = parseNumber(entry.delta, 0);
      if (delta !== 0) {
        effects.push({
          type: "actionDelta",
          target,
          delta
        });
      }
      return;
    }
    if (entry.type === "shield") {
      const duration = Math.max(1, Math.round(parseNumber(entry.duration, 1)));
      const basePower = parseNumber(entry.basePower, 0);
      if (basePower <= 0) {
        return;
      }
      effects.push({
        type: "shield",
        target,
        duration,
        basePower,
        scaling: parseScaling(entry.scaling)
      });
      return;
    }
    if (entry.type === "cleanse") {
      effects.push({
        type: "cleanse",
        target,
        removeCount: Math.max(1, Math.round(parseNumber(entry.removeCount, 1))),
        polarity: parseEnum(entry.polarity, STATUS_EFFECT_POLARITIES, "negative")
      });
      return;
    }
    if (entry.type === "dispel") {
      effects.push({
        type: "dispel",
        target,
        removeCount: Math.max(1, Math.round(parseNumber(entry.removeCount, 1))),
        polarity: parseEnum(entry.polarity, STATUS_EFFECT_POLARITIES, "positive")
      });
      return;
    }
    if (entry.type === "healAlliesOnKill") {
      const ratio = parseNumber(entry.ratio, 0);
      if (ratio > 0) {
        effects.push({
          type: "healAlliesOnKill",
          ratio
        });
      }
    }
  });
  return effects.length > 0 ? effects : undefined;
}

function parseWeightTuning(value: unknown): BattleActiveSkillDefinition["weightTuning"] {
  if (!isObject(value)) {
    return undefined;
  }
  const parsePair = (input: unknown) => {
    if (!isObject(input)) {
      return undefined;
    }
    const threshold = parseNumber(input.threshold, NaN);
    const delta = parseNumber(input.delta, NaN);
    if (!Number.isFinite(threshold) || !Number.isFinite(delta)) {
      return undefined;
    }
    return { threshold, delta };
  };
  const parseCountPair = (input: unknown) => {
    if (!isObject(input)) {
      return undefined;
    }
    const count = Math.max(1, Math.round(parseNumber(input.count, NaN)));
    const delta = parseNumber(input.delta, NaN);
    if (!Number.isFinite(count) || !Number.isFinite(delta)) {
      return undefined;
    }
    return { count, delta };
  };
  return {
    selfHpBelow: parsePair(value.selfHpBelow),
    allyHpBelow: parsePair(value.allyHpBelow),
    enemyHpBelow: parsePair(value.enemyHpBelow),
    enemyCountAtLeast: parseCountPair(value.enemyCountAtLeast)
  };
}

function parseActiveSkill(value: unknown): BattleActiveSkillDefinition | null {
  if (!isObject(value)) {
    return null;
  }
  const id = parseString(value.id, "");
  const name = parseString(value.name, "");
  if (!id || !name) {
    return null;
  }
  const effect = parseEnum(value.effect, ["damage", "heal"], "damage");
  const targetType = parseEnum(value.targetType, TARGET_TYPES, "singleEnemy");
  return {
    id,
    name,
    kind: "active",
    rarity: parseEnum(value.rarity, SKILL_RARITIES, "common"),
    skillPool: parseEnum(value.skillPool, SKILL_POOLS, "common"),
    allowedHeroClasses: parseHeroClassList(value.allowedHeroClasses),
    conflictSkillIds: parseStringArray(value.conflictSkillIds),
    category: parseEnum(value.category, SKILL_CATEGORIES, "assault"),
    description: parseString(value.description, ""),
    targetType,
    targetCount:
      targetType === "randomEnemies" && typeof value.targetCount === "number"
        ? Math.max(1, Math.round(value.targetCount))
        : undefined,
    effect,
    damageType: effect === "damage" ? parseEnum(value.damageType, DAMAGE_TYPES, "physical") : undefined,
    element: value.element ? parseEnum(value.element, ELEMENTS, "fire") : undefined,
    mpCost: Math.max(0, Math.round(parseNumber(value.mpCost, 0))),
    cooldown: Math.max(0, Math.round(parseNumber(value.cooldown, 0))),
    baseWeight: parseNumber(value.baseWeight, 100),
    basePower: parseNumber(value.basePower, 0),
    scaling: parseScaling(value.scaling),
    canCrit: typeof value.canCrit === "boolean" ? value.canCrit : effect === "damage",
    hitCount: typeof value.hitCount === "number" ? Math.max(1, Math.round(value.hitCount)) : undefined,
    selfStatus: parseStatusApplication(value.selfStatus),
    targetStatus: parseStatusApplication(value.targetStatus),
    actionDeltaSelf: typeof value.actionDeltaSelf === "number" ? value.actionDeltaSelf : undefined,
    actionDeltaTarget: typeof value.actionDeltaTarget === "number" ? value.actionDeltaTarget : undefined,
    extraEffects: parseExtraEffects(value.extraEffects),
    weightTuning: parseWeightTuning(value.weightTuning)
  };
}

function parsePassiveSkill(value: unknown): BattlePassiveSkillDefinition | null {
  if (!isObject(value)) {
    return null;
  }
  const id = parseString(value.id, "");
  const name = parseString(value.name, "");
  if (!id || !name) {
    return null;
  }
  const modifiers = isObject(value.modifiers) ? value.modifiers : {};
  return {
    id,
    name,
    kind: "passive",
    rarity: parseEnum(value.rarity, SKILL_RARITIES, "common"),
    skillPool: parseEnum(value.skillPool, SKILL_POOLS, "common"),
    allowedHeroClasses: parseHeroClassList(value.allowedHeroClasses),
    conflictSkillIds: parseStringArray(value.conflictSkillIds),
    description: parseString(value.description, ""),
    modifiers: {
      flat: parseFlatRecord(modifiers.flat),
      ratio: parseFlatRecord(modifiers.ratio),
      elementBoost: parseElementRecord(modifiers.elementBoost),
      elementRes: parseElementRecord(modifiers.elementRes)
    }
  };
}

function parseTalentSkill(value: unknown): BattleTalentDefinition | null {
  if (!isObject(value)) {
    return null;
  }
  const id = parseString(value.id, "");
  const name = parseString(value.name, "");
  if (!id || !name) {
    return null;
  }
  const modifiers = isObject(value.modifiers) ? value.modifiers : {};
  return {
    id,
    name,
    kind: "talent",
    rarity: parseEnum(value.rarity, TALENT_RARITIES, "common"),
    skillPool: parseEnum(value.skillPool, SKILL_POOLS, "common"),
    allowedHeroClasses: parseHeroClassList(value.allowedHeroClasses),
    conflictSkillIds: parseStringArray(value.conflictSkillIds),
    description: parseString(value.description, ""),
    modifiers: {
      flat: parseFlatRecord(modifiers.flat),
      ratio: parseFlatRecord(modifiers.ratio),
      elementBoost: parseElementRecord(modifiers.elementBoost),
      elementRes: parseElementRecord(modifiers.elementRes)
    }
  };
}

function buildById<T extends { id: string }>(items: T[]): Record<string, T> {
  return items.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

interface LegendaryHeroSkillsConfig {
  activeSkills?: unknown;
  passiveSkills?: unknown;
  talents?: unknown;
}

function parseConfigFromFiles(skillFiles: Record<string, unknown>, legendaryConfig?: LegendaryHeroSkillsConfig) {
  const activeRawItems: unknown[] = [];
  const passiveRawItems: unknown[] = [];
  const talentRawItems: unknown[] = [];
  let configuredDefault = FALLBACK_BASIC_ATTACK.id;

  Object.entries(skillFiles)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([path, value]) => {
    const fileName = path.split("/").pop()?.toLowerCase() ?? "";
    if (fileName === "meta.json" && isObject(value)) {
      configuredDefault = parseString(value.defaultActiveSkillId, configuredDefault);
      return;
    }
    if (ACTIVE_CATEGORY_FILE_NAMES.has(fileName)) {
      if (Array.isArray(value)) {
        activeRawItems.push(...value);
      }
      return;
    }
    if (fileName === "passives.json") {
      if (Array.isArray(value)) {
        passiveRawItems.push(...value);
      }
      return;
    }
    if (fileName === "talents.json" && Array.isArray(value)) {
      talentRawItems.push(...value);
    }
  });

  if (legendaryConfig) {
    if (Array.isArray(legendaryConfig.activeSkills)) {
      activeRawItems.push(...legendaryConfig.activeSkills);
    }
    if (Array.isArray(legendaryConfig.passiveSkills)) {
      passiveRawItems.push(...legendaryConfig.passiveSkills);
    }
    if (Array.isArray(legendaryConfig.talents)) {
      talentRawItems.push(...legendaryConfig.talents);
    }
  }

  const activeSkills = activeRawItems.map(parseActiveSkill).filter((item): item is BattleActiveSkillDefinition => Boolean(item));
  const passiveSkills = passiveRawItems.map(parsePassiveSkill).filter((item): item is BattlePassiveSkillDefinition => Boolean(item));
  const talents = talentRawItems.map(parseTalentSkill).filter((item): item is BattleTalentDefinition => Boolean(item));

  if (!activeSkills.some((skill) => skill.id === FALLBACK_BASIC_ATTACK.id)) {
    activeSkills.unshift(FALLBACK_BASIC_ATTACK);
  }

  const resolvedDefault = activeSkills.some((skill) => skill.id === configuredDefault)
    ? configuredDefault
    : FALLBACK_BASIC_ATTACK.id;

  return {
    defaultActiveSkillId: resolvedDefault,
    activeSkills,
    passiveSkills,
    talents
  };
}

const rawSkillFileModules = import.meta.glob("./battleSkills/*/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const parsedConfig = parseConfigFromFiles(rawSkillFileModules, legendaryHeroSkillsConfigJson as LegendaryHeroSkillsConfig);

export const DEFAULT_ACTIVE_SKILL_ID = parsedConfig.defaultActiveSkillId;
export const battleActiveSkills: Record<string, BattleActiveSkillDefinition> = buildById(parsedConfig.activeSkills);
export const battlePassiveSkills: Record<string, BattlePassiveSkillDefinition> = buildById(parsedConfig.passiveSkills);
export const battleTalents: Record<string, BattleTalentDefinition> = buildById(parsedConfig.talents);

export function getBattleActiveSkill(skillId: string): BattleActiveSkillDefinition | null {
  return battleActiveSkills[skillId] ?? null;
}

export function getBattlePassiveSkill(skillId: string): BattlePassiveSkillDefinition | null {
  return battlePassiveSkills[skillId] ?? null;
}

export function getBattleTalent(skillId: string): BattleTalentDefinition | null {
  return battleTalents[skillId] ?? null;
}
