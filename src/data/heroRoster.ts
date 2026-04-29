import heroGenerationConfigJson from "./config/heroGeneration.json";
import legendaryHeroesConfigJson from "./config/legendaryHeroes.json";
import { battleActiveSkills, battlePassiveSkills, battleTalents } from "./battleSkills";
import type { Hero, HeroClass, HeroSkillRarity, HeroStatGrowth } from "../types/game";

interface HeroStatsNumeric {
  hp: number;
  mp: number;
  str: number;
  int: number;
  agi: number;
  def: number;
}

interface HeroLoadoutPool {
  talentIds: string[];
  activeSkillIds: string[];
  passiveSkillIds: string[];
  fixedGuaranteedActiveSkillId?: string;
  alwaysIncludeActiveSkillIds?: string[];
  activePickCount?: number;
  passivePickCount?: number;
  activePickCountRange?: {
    min: number;
    max: number;
  };
  passivePickCountRange?: {
    min: number;
    max: number;
  };
  totalCountWeightDecay?: number;
}

interface HeroGenerationConfig {
  randomHeroCountPerStartup: number;
  legendarySpawnChance: number;
  randomSkillRarityWeights?: {
    common: number;
    rare: number;
    epic: number;
  };
  classRollWeights: Record<HeroClass, number>;
  namePools: {
    familyNames: string[];
    givenNames: string[];
  };
  titlePoolByClass: Record<HeroClass, string[]>;
  imagePoolByClass: Record<HeroClass, string[]>;
  statProfileByClass: Record<HeroClass, { base: HeroStatsNumeric; variance: HeroStatsNumeric }>;
  growthProfileByClass: Record<HeroClass, { base: HeroStatsNumeric; variance: HeroStatsNumeric }>;
  standardLoadoutPools: Record<HeroClass, HeroLoadoutPool>;
}

interface LegendaryHeroConfigEntry {
  id: string;
  name: string;
  title: string;
  heroClass: HeroClass;
  image: string;
  stats: HeroStatsNumeric;
  growth: HeroStatsNumeric;
  loadout: {
    talentId: string | null;
    activeSkillIds: string[];
    passiveSkillIds: string[];
  };
}

interface LegendaryHeroesConfig {
  heroes: LegendaryHeroConfigEntry[];
}

interface RandomSkillRarityWeights {
  common: number;
  rare: number;
  epic: number;
}

const DEFAULT_RANDOM_SKILL_RARITY_WEIGHTS: RandomSkillRarityWeights = {
  common: 0.8,
  rare: 0.19,
  epic: 0.01
};

const heroGenerationConfig = heroGenerationConfigJson as HeroGenerationConfig;
const legendaryHeroesConfig = legendaryHeroesConfigJson as LegendaryHeroesConfig;

const BASE_FIXED_HEROES: Hero[] = [
  {
    id: "arthur",
    name: "阿瑟·列维坦",
    title: "圣壁守望者",
    heroClass: "paladin",
    image: "/images/heroes/hero-placeholder.svg",
    rarity: "standard",
    origin: "fixed",
    learnedSkills: {
      talentIds: ["talent_oathbound_guard"],
      activeSkillIds: [
        "paladin_holy_blade",
        "paladin_shield_slam",
        "paladin_war_provoke",
        "paladin_bulwark_vow",
        "paladin_prayer",
        "paladin_command",
        "basic_attack"
      ],
      passiveSkillIds: ["passive_plate_mastery", "passive_resolute_heart"]
    },
    loadoutPreset: {
      talentId: "talent_oathbound_guard",
      activeSkillIds: [
        "paladin_holy_blade",
        "paladin_shield_slam",
        "paladin_war_provoke",
        "paladin_bulwark_vow",
        "paladin_prayer",
        "paladin_command",
        "basic_attack"
      ],
      passiveSkillIds: ["passive_plate_mastery", "passive_resolute_heart"]
    },
    stats: { hp: "12,500", mp: "800", str: "245", int: "85", agi: "112", def: "450" },
    statGrowth: { hp: 480, mp: 22, str: 10, int: 2, agi: 4, def: 11 }
  },
  {
    id: "selene",
    name: "塞琳娜·逐星",
    title: "星环织法者",
    heroClass: "mage",
    image: "/images/heroes/hero-placeholder.svg",
    rarity: "standard",
    origin: "fixed",
    learnedSkills: {
      talentIds: ["talent_starweaver"],
      activeSkillIds: [
        "mage_flame_wave",
        "mage_arcane_bolt",
        "mage_frost_nova",
        "mage_null_field",
        "mage_clear_mind",
        "mage_mana_current",
        "mage_emergency_barrier",
        "basic_attack"
      ],
      passiveSkillIds: ["passive_arcane_flow", "passive_frost_focus"]
    },
    loadoutPreset: {
      talentId: "talent_starweaver",
      activeSkillIds: [
        "mage_flame_wave",
        "mage_arcane_bolt",
        "mage_frost_nova",
        "mage_null_field",
        "mage_clear_mind",
        "mage_mana_current",
        "mage_emergency_barrier",
        "basic_attack"
      ],
      passiveSkillIds: ["passive_arcane_flow", "passive_frost_focus"]
    },
    stats: { hp: "4,200", mp: "4,500", str: "42", int: "380", agi: "156", def: "120" },
    statGrowth: { hp: 170, mp: 170, str: 2, int: 13, agi: 5, def: 3 }
  },
  // TODO(test): 测试结束后，从固定初始英雄中移除弥亚（legendary-priest-miya），恢复为纯随机传奇产出。
  {
    id: "legendary-priest-miya",
    name: "弥亚",
    title: "翡翠之灵",
    heroClass: "priest",
    image: "/images/heroes/Miya.png",
    rarity: "legendary",
    origin: "fixed",
    learnedSkills: {
      talentIds: ["talent_legend_miya_pulse_of_yggdrasil"],
      activeSkillIds: [
        "skill_legend_miya_emerald_baptism",
        "basic_attack"
      ],
      passiveSkillIds: ["passive_legend_miya_universal_resonance"]
    },
    loadoutPreset: {
      talentId: "talent_legend_miya_pulse_of_yggdrasil",
      activeSkillIds: [
        "skill_legend_miya_emerald_baptism",
        "basic_attack"
      ],
      passiveSkillIds: ["passive_legend_miya_universal_resonance"]
    },
    stats: { hp: "7,600", mp: "6,200", str: "88", int: "520", agi: "166", def: "232" },
    statGrowth: { hp: 260, mp: 200, str: 3, int: 16, agi: 5, def: 5 }
  }
];

const HERO_CLASSES: HeroClass[] = ["paladin", "mage", "ranger", "priest"];

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967295;
  };
}

function pickOne<T>(list: T[], random: () => number): T {
  if (list.length === 0) {
    throw new Error("Cannot pick from an empty list.");
  }
  const index = Math.min(list.length - 1, Math.floor(random() * list.length));
  return list[index];
}

function pickWeightedClass(weights: Record<HeroClass, number>, random: () => number): HeroClass {
  const entries = HERO_CLASSES.map((heroClass) => ({
    heroClass,
    weight: Math.max(0, weights[heroClass] ?? 0)
  }));

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return "ranger";
  }

  const target = random() * totalWeight;
  let cursor = 0;
  for (const entry of entries) {
    cursor += entry.weight;
    if (target <= cursor) {
      return entry.heroClass;
    }
  }
  return entries[entries.length - 1].heroClass;
}

function toDisplayStat(value: number): string {
  return Math.max(1, Math.round(value)).toLocaleString("en-US");
}

function rollNumericStats(heroClass: HeroClass, random: () => number): HeroStatsNumeric {
  const profile = heroGenerationConfig.statProfileByClass[heroClass];
  const keys: Array<keyof HeroStatsNumeric> = ["hp", "mp", "str", "int", "agi", "def"];

  return keys.reduce<HeroStatsNumeric>((acc, key) => {
    const base = profile.base[key];
    const variance = profile.variance[key];
    const delta = (random() * 2 - 1) * variance;
    acc[key] = Math.max(1, Math.round(base + delta));
    return acc;
  }, {
    hp: 1,
    mp: 1,
    str: 1,
    int: 1,
    agi: 1,
    def: 1
  });
}

function rollNumericGrowth(heroClass: HeroClass, random: () => number): HeroStatsNumeric {
  const profile = heroGenerationConfig.growthProfileByClass[heroClass];
  const keys: Array<keyof HeroStatsNumeric> = ["hp", "mp", "str", "int", "agi", "def"];

  return keys.reduce<HeroStatsNumeric>((acc, key) => {
    const base = profile.base[key];
    const variance = profile.variance[key];
    const delta = (random() * 2 - 1) * variance;
    acc[key] = Math.max(0, Math.round(base + delta));
    return acc;
  }, {
    hp: 0,
    mp: 0,
    str: 0,
    int: 0,
    agi: 0,
    def: 0
  });
}

function mapStatsToHero(stats: HeroStatsNumeric): Hero["stats"] {
  return {
    hp: toDisplayStat(stats.hp),
    mp: toDisplayStat(stats.mp),
    str: toDisplayStat(stats.str),
    int: toDisplayStat(stats.int),
    agi: toDisplayStat(stats.agi),
    def: toDisplayStat(stats.def)
  };
}

function mapGrowthToHero(growth: HeroStatsNumeric): HeroStatGrowth {
  return {
    hp: Math.max(0, Math.round(growth.hp)),
    mp: Math.max(0, Math.round(growth.mp)),
    str: Math.max(0, Math.round(growth.str)),
    int: Math.max(0, Math.round(growth.int)),
    agi: Math.max(0, Math.round(growth.agi)),
    def: Math.max(0, Math.round(growth.def))
  };
}

function normalizePickCountRange(
  range: { min: number; max: number } | undefined,
  fallbackCount: number
): { min: number; max: number } {
  const fallback = Math.max(0, Math.floor(fallbackCount));
  if (!range) {
    return { min: fallback, max: fallback };
  }
  const min = Number.isFinite(range.min) ? Math.max(0, Math.floor(range.min)) : fallback;
  const max = Number.isFinite(range.max) ? Math.max(min, Math.floor(range.max)) : min;
  return {
    min: Math.min(min, max),
    max
  };
}

function normalizeWeightDecay(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.55;
  }
  return Math.max(0.01, Math.min(1, value));
}

function chooseByWeight<T>(entries: Array<{ value: T; weight: number }>, random: () => number): T {
  const valid = entries.filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0);
  if (valid.length <= 0) {
    return entries[0].value;
  }
  const total = valid.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return valid[0].value;
  }
  const target = random() * total;
  let cursor = 0;
  for (const entry of valid) {
    cursor += entry.weight;
    if (target <= cursor) {
      return entry.value;
    }
  }
  return valid[valid.length - 1].value;
}

function isHeroSkillRarity(value: unknown): value is HeroSkillRarity {
  return value === "common" || value === "rare" || value === "epic" || value === "legendary";
}

function normalizeRandomSkillRarityWeights(
  weights?: HeroGenerationConfig["randomSkillRarityWeights"]
): RandomSkillRarityWeights {
  const common = typeof weights?.common === "number" && Number.isFinite(weights.common) ? weights.common : 0;
  const rare = typeof weights?.rare === "number" && Number.isFinite(weights.rare) ? weights.rare : 0;
  const epic = typeof weights?.epic === "number" && Number.isFinite(weights.epic) ? weights.epic : 0;
  const normalized = {
    common: Math.max(0, common),
    rare: Math.max(0, rare),
    epic: Math.max(0, epic)
  };
  const total = normalized.common + normalized.rare + normalized.epic;
  if (total <= 0) {
    return { ...DEFAULT_RANDOM_SKILL_RARITY_WEIGHTS };
  }
  return {
    common: normalized.common / total,
    rare: normalized.rare / total,
    epic: normalized.epic / total
  };
}

function rollRandomSkillRarity(random: () => number): HeroSkillRarity {
  return chooseByWeight<HeroSkillRarity>(
    [
      { value: "common", weight: RANDOM_SKILL_RARITY_WEIGHTS.common },
      { value: "rare", weight: RANDOM_SKILL_RARITY_WEIGHTS.rare },
      { value: "epic", weight: RANDOM_SKILL_RARITY_WEIGHTS.epic }
    ],
    random
  );
}

function normalizeTalentRarity(rarity: string | undefined): HeroSkillRarity {
  if (rarity === "legendary" || rarity === "unique") {
    return "legendary";
  }
  if (rarity === "epic") {
    return "epic";
  }
  if (rarity === "rare") {
    return "rare";
  }
  return "common";
}

function resolveConfiguredSkillRarity(skillId: string): HeroSkillRarity {
  const active = battleActiveSkills[skillId];
  if (active) {
    return active.rarity ?? "common";
  }
  const passive = battlePassiveSkills[skillId];
  if (passive) {
    return passive.rarity ?? "common";
  }
  const talent = battleTalents[skillId];
  if (talent) {
    return normalizeTalentRarity(talent.rarity);
  }
  return "common";
}

function collectSkillIds(learnedSkills: {
  talentIds: string[];
  activeSkillIds: string[];
  passiveSkillIds: string[];
}): string[] {
  return [...learnedSkills.talentIds, ...learnedSkills.activeSkillIds, ...learnedSkills.passiveSkillIds];
}

function buildLearnedSkillRarityByIds(skillIds: string[]): Record<string, HeroSkillRarity> {
  return [...new Set(skillIds.filter((skillId) => typeof skillId === "string" && skillId.length > 0))]
    .reduce<Record<string, HeroSkillRarity>>((acc, skillId) => {
      acc[skillId] = resolveConfiguredSkillRarity(skillId);
      return acc;
    }, {});
}

function cloneLearnedSkills(learnedSkills: Hero["learnedSkills"] | undefined): Hero["learnedSkills"] | undefined {
  if (!learnedSkills) {
    return undefined;
  }
  const talentIds = [...learnedSkills.talentIds];
  const activeSkillIds = [...learnedSkills.activeSkillIds];
  const passiveSkillIds = [...learnedSkills.passiveSkillIds];
  const fallback = buildLearnedSkillRarityByIds(collectSkillIds({ talentIds, activeSkillIds, passiveSkillIds }));
  const fromSource = learnedSkills.rarityBySkillId
    ? Object.entries(learnedSkills.rarityBySkillId).reduce<Record<string, HeroSkillRarity>>((acc, [skillId, rarity]) => {
        if (!fallback[skillId]) {
          return acc;
        }
        acc[skillId] = isHeroSkillRarity(rarity) ? rarity : fallback[skillId];
        return acc;
      }, {})
    : {};
  return {
    talentIds,
    activeSkillIds,
    passiveSkillIds,
    rarityBySkillId: { ...fallback, ...fromSource }
  };
}

function cloneStatGrowth(statGrowth: HeroStatGrowth): HeroStatGrowth {
  return {
    hp: statGrowth.hp,
    mp: statGrowth.mp,
    str: statGrowth.str,
    int: statGrowth.int,
    agi: statGrowth.agi,
    def: statGrowth.def
  };
}

const RANDOM_SKILL_RARITY_WEIGHTS = normalizeRandomSkillRarityWeights(heroGenerationConfig.randomSkillRarityWeights);

function chooseSkillPickCounts(
  activeRange: { min: number; max: number },
  passiveRange: { min: number; max: number },
  minRequiredActiveCount: number,
  minRequiredPassiveCount: number,
  decay: number,
  random: () => number
): { active: number; passive: number } {
  const combos: Array<{ value: { active: number; passive: number }; total: number }> = [];
  for (let active = activeRange.min; active <= activeRange.max; active += 1) {
    for (let passive = passiveRange.min; passive <= passiveRange.max; passive += 1) {
      combos.push({
        value: {
          active: Math.max(active, minRequiredActiveCount),
          passive: Math.max(passive, minRequiredPassiveCount)
        },
        total: Math.max(active, minRequiredActiveCount) + Math.max(passive, minRequiredPassiveCount)
      });
    }
  }

  if (combos.length <= 0) {
    return {
      active: Math.max(activeRange.min, minRequiredActiveCount),
      passive: Math.max(passiveRange.min, minRequiredPassiveCount)
    };
  }

  const minTotal = combos.reduce((min, item) => Math.min(min, item.total), Number.POSITIVE_INFINITY);
  const weighted = combos.map((item) => ({
    value: item.value,
    weight: Math.pow(decay, item.total - minTotal)
  }));
  return chooseByWeight(weighted, random);
}

function pickDistinctSkillsWithRequiredByRarity(
  pool: string[],
  count: number,
  requiredSkillIds: string[] | undefined,
  random: () => number
): string[] {
  const maxCount = Math.max(0, Math.floor(count));
  if (maxCount <= 0) {
    return [];
  }

  const uniquePool = [...new Set(pool.filter((skillId) => typeof skillId === "string" && skillId.length > 0))];
  if (uniquePool.length <= 0) {
    return [];
  }

  const required = [...new Set(requiredSkillIds ?? [])].filter((skillId) => uniquePool.includes(skillId));
  const finalCount = Math.min(uniquePool.length, Math.max(maxCount, required.length));
  const remainPool = uniquePool.filter((skillId) => !required.includes(skillId));
  const picked = [...required];

  while (picked.length < finalCount && remainPool.length > 0) {
    const targetRarity = rollRandomSkillRarity(random);
    const sameRarityCandidates = remainPool.filter((skillId) => resolveConfiguredSkillRarity(skillId) === targetRarity);
    const candidatePool = sameRarityCandidates.length > 0 ? sameRarityCandidates : remainPool;
    const selected = pickOne(candidatePool, random);
    picked.push(selected);
    const removeIndex = remainPool.indexOf(selected);
    if (removeIndex >= 0) {
      remainPool.splice(removeIndex, 1);
    }
  }

  return picked;
}

function pickTalentId(pool: string[], random: () => number, usedTalentIdsByClass: Set<string>): string | null {
  const uniqueTalentIds = [...new Set(pool.filter((skillId) => typeof skillId === "string" && skillId.length > 0))];
  if (uniqueTalentIds.length <= 0) {
    return null;
  }
  const unpickedTalentIds = uniqueTalentIds.filter((talentId) => !usedTalentIdsByClass.has(talentId));
  const candidatePool = unpickedTalentIds.length > 0 ? unpickedTalentIds : uniqueTalentIds;
  const talentId = pickOne(candidatePool, random);
  usedTalentIdsByClass.add(talentId);
  return talentId;
}

function buildStandardSkillPackage(
  heroClass: HeroClass,
  usedTalentIdsByClass: Set<string>,
  random: () => number
): {
  learnedSkills: NonNullable<Hero["learnedSkills"]>;
  loadoutPreset: NonNullable<Hero["loadoutPreset"]>;
} {
  const pool = heroGenerationConfig.standardLoadoutPools[heroClass];
  const activePickCountRange = normalizePickCountRange(
    pool.activePickCountRange,
    pool.activePickCount ?? pool.activeSkillIds.length
  );
  const passivePickCountRange = normalizePickCountRange(
    pool.passivePickCountRange,
    pool.passivePickCount ?? pool.passiveSkillIds.length
  );
  const fixedActiveSkillIds = [...new Set(pool.alwaysIncludeActiveSkillIds ?? [])].filter(
    (skillId) => pool.activeSkillIds.includes(skillId)
  );
  const fixedGuaranteedActiveSkillId = pool.fixedGuaranteedActiveSkillId && pool.activeSkillIds.includes(pool.fixedGuaranteedActiveSkillId)
    ? pool.fixedGuaranteedActiveSkillId
    : fixedActiveSkillIds[0] ?? null;
  const weightedPickCounts = chooseSkillPickCounts(
    activePickCountRange,
    passivePickCountRange,
    fixedGuaranteedActiveSkillId ? 1 : 0,
    0,
    normalizeWeightDecay(pool.totalCountWeightDecay),
    random
  );
  const activePickCount = weightedPickCounts.active;
  const passivePickCount = weightedPickCounts.passive;
  const talentId = pickTalentId(pool.talentIds, random, usedTalentIdsByClass);
  const activeSkillIds = pickDistinctSkillsWithRequiredByRarity(
    pool.activeSkillIds,
    activePickCount,
    fixedGuaranteedActiveSkillId ? [fixedGuaranteedActiveSkillId] : [],
    random
  );
  const passiveSkillIds = pickDistinctSkillsWithRequiredByRarity(pool.passiveSkillIds, passivePickCount, [], random);
  const talentIds = talentId ? [talentId] : [];
  const rarityBySkillId = buildLearnedSkillRarityByIds([...talentIds, ...activeSkillIds, ...passiveSkillIds]);
  return {
    learnedSkills: {
      talentIds,
      activeSkillIds: [...activeSkillIds],
      passiveSkillIds: [...passiveSkillIds],
      rarityBySkillId
    },
    loadoutPreset: {
      talentId,
      activeSkillIds,
      passiveSkillIds
    }
  };
}

function buildGeneratedName(usedNames: Set<string>, random: () => number): string {
  const familyName = pickOne(heroGenerationConfig.namePools.familyNames, random);
  const givenName = pickOne(heroGenerationConfig.namePools.givenNames, random);
  const baseName = `${familyName}·${givenName}`;
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  let suffix = 2;
  while (usedNames.has(`${baseName}-${suffix}`)) {
    suffix += 1;
  }
  const uniqueName = `${baseName}-${suffix}`;
  usedNames.add(uniqueName);
  return uniqueName;
}

function buildGeneratedStandardHero(
  index: number,
  usedNames: Set<string>,
  usedIds: Set<string>,
  usedTalentIdsByClassMap: Map<HeroClass, Set<string>>,
  random: () => number
): Hero {
  const heroClass = pickWeightedClass(heroGenerationConfig.classRollWeights, random);
  const idBase = `generated-${heroClass}-${index + 1}-${Math.floor(random() * 1e8).toString(36)}`;
  let heroId = idBase;
  let serial = 1;
  while (usedIds.has(heroId)) {
    heroId = `${idBase}-${serial}`;
    serial += 1;
  }
  usedIds.add(heroId);

  const stats = rollNumericStats(heroClass, random);
  const growth = rollNumericGrowth(heroClass, random);
  const titlePool = heroGenerationConfig.titlePoolByClass[heroClass];
  const imagePool = heroGenerationConfig.imagePoolByClass[heroClass];
  const usedTalentIdsByClass = usedTalentIdsByClassMap.get(heroClass) ?? new Set<string>();
  if (!usedTalentIdsByClassMap.has(heroClass)) {
    usedTalentIdsByClassMap.set(heroClass, usedTalentIdsByClass);
  }
  const skillPackage = buildStandardSkillPackage(heroClass, usedTalentIdsByClass, random);

  return {
    id: heroId,
    name: buildGeneratedName(usedNames, random),
    title: pickOne(titlePool, random),
    heroClass,
    image: pickOne(imagePool, random),
    rarity: "standard",
    origin: "generated",
    learnedSkills: skillPackage.learnedSkills,
    loadoutPreset: skillPackage.loadoutPreset,
    stats: mapStatsToHero(stats),
    statGrowth: mapGrowthToHero(growth)
  };
}

function buildLegendaryHero(entry: LegendaryHeroConfigEntry): Hero {
  const talentIds = entry.loadout.talentId ? [entry.loadout.talentId] : [];
  const activeSkillIds = [...entry.loadout.activeSkillIds];
  const passiveSkillIds = [...entry.loadout.passiveSkillIds];
  const rarityBySkillId = buildLearnedSkillRarityByIds(
    collectSkillIds({
      talentIds,
      activeSkillIds,
      passiveSkillIds
    })
  );
  return {
    id: entry.id,
    name: entry.name,
    title: entry.title,
    heroClass: entry.heroClass,
    image: entry.image,
    rarity: "legendary",
    origin: "generated",
    learnedSkills: {
      talentIds,
      activeSkillIds,
      passiveSkillIds,
      rarityBySkillId
    },
    loadoutPreset: {
      talentId: entry.loadout.talentId,
      activeSkillIds,
      passiveSkillIds
    },
    stats: mapStatsToHero(entry.stats),
    statGrowth: mapGrowthToHero(entry.growth)
  };
}

export function createStartupHeroes(): Hero[] {
  const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const random = createRandom(seed);

  const usedNames = new Set(BASE_FIXED_HEROES.map((hero) => hero.name));
  const usedIds = new Set(BASE_FIXED_HEROES.map((hero) => hero.id));
  const usedTalentIdsByClassMap = new Map<HeroClass, Set<string>>();
  const availableLegendary = legendaryHeroesConfig.heroes.filter((hero) => !usedIds.has(hero.id));

  const generatedHeroes: Hero[] = [];
  const randomCount = Math.max(0, Math.floor(heroGenerationConfig.randomHeroCountPerStartup));

  for (let index = 0; index < randomCount; index += 1) {
    const canRollLegendary = availableLegendary.length > 0;
    const shouldUseLegendary = canRollLegendary && random() < heroGenerationConfig.legendarySpawnChance;

    if (shouldUseLegendary) {
      const legendaryIndex = Math.floor(random() * availableLegendary.length);
      const [legendaryEntry] = availableLegendary.splice(legendaryIndex, 1);
      if (legendaryEntry && !usedIds.has(legendaryEntry.id)) {
        usedIds.add(legendaryEntry.id);
        usedNames.add(legendaryEntry.name);
        generatedHeroes.push(buildLegendaryHero(legendaryEntry));
        continue;
      }
    }

    generatedHeroes.push(buildGeneratedStandardHero(index, usedNames, usedIds, usedTalentIdsByClassMap, random));
  }

  return [
    ...BASE_FIXED_HEROES.map((hero) => ({
      ...hero,
      learnedSkills: cloneLearnedSkills(hero.learnedSkills),
      statGrowth: cloneStatGrowth(hero.statGrowth),
      loadoutPreset: hero.loadoutPreset
        ? {
            talentId: hero.loadoutPreset.talentId,
            activeSkillIds: [...hero.loadoutPreset.activeSkillIds],
            passiveSkillIds: [...hero.loadoutPreset.passiveSkillIds]
          }
        : undefined
    })),
    ...generatedHeroes
  ];
}
