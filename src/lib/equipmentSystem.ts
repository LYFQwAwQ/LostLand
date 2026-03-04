import type {
  EquipmentAffixTemplate,
  EquipmentGenerationEnvironment,
  EquipmentGenerationRequest,
  EquipmentQuality,
  EquipmentRank,
  EquipmentTemplate,
  GeneratedEquipment,
  GeneratedEquipmentAffix,
  GeneratedEquipmentStat
} from "../types/game";

const DEFAULT_EQUIPMENT_LEVEL = 1;
export const SOCKET_UNLOCK_LEVEL_STEP = 20;

export const EQUIPMENT_RANK_LABELS: Record<EquipmentRank, string> = {
  crude: "劣质",
  fine: "精良",
  superior: "卓越",
  perfect: "完美"
};

export const EQUIPMENT_QUALITY_LABELS: Record<EquipmentQuality, string> = {
  common: "普通",
  uncommon: "优秀",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
  mythic: "神话"
};

export const EQUIPMENT_QUALITY_COLOR_LABELS: Record<EquipmentQuality, string> = {
  common: "白",
  uncommon: "绿",
  rare: "蓝",
  epic: "紫",
  legendary: "橙",
  mythic: "红"
};

export const EQUIPMENT_QUALITY_AFFIX_COUNT: Record<EquipmentQuality, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5
};

export const EQUIPMENT_RANK_PERCENT_RANGES: Record<EquipmentRank, { min: number; max: number }> = {
  crude: { min: -0.05, max: 0.05 },
  fine: { min: 0.05, max: 0.15 },
  superior: { min: 0.15, max: 0.3 },
  perfect: { min: 0.3, max: 0.5 }
};

export const DEFAULT_EQUIPMENT_ENVIRONMENT: EquipmentGenerationEnvironment = {
  id: "neutral-default",
  label: "默认环境",
  rankWeightMultipliers: {
    crude: 1,
    fine: 1,
    superior: 1,
    perfect: 1
  },
  qualityWeightMultipliers: {
    common: 1,
    uncommon: 1,
    rare: 1,
    epic: 1,
    legendary: 1,
    mythic: 1
  }
};

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeLevel(level?: number): number {
  if (!Number.isFinite(level)) {
    return DEFAULT_EQUIPMENT_LEVEL;
  }
  return Math.max(1, Math.floor(level as number));
}

function normalizeSeed(seed?: number | string): number {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.floor(seed);
  }
  if (typeof seed === "string" && seed.trim().length > 0) {
    return hashSeed(seed.trim());
  }
  return hashSeed(`${Date.now()}-${Math.random()}`);
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

function rollInRange(min: number, max: number, random: () => number): number {
  if (max <= min) {
    return min;
  }
  return min + (max - min) * random();
}

function applyMultipliers<T extends string>(
  source: Record<T, number>,
  multipliers: Partial<Record<T, number>> | undefined
): Array<{ key: T; weight: number }> {
  return (Object.keys(source) as T[]).map((key) => ({
    key,
    weight: Math.max(0, source[key] * (multipliers?.[key] ?? 1))
  }));
}

function pickWeighted<T>(entries: Array<{ key: T; weight: number }>, random: () => number): T {
  const total = entries.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    throw new Error("Weighted pool total must be > 0.");
  }

  const target = random() * total;
  let cursor = 0;

  for (const item of entries) {
    cursor += item.weight;
    if (target <= cursor) {
      return item.key;
    }
  }

  return entries[entries.length - 1].key;
}

function pickAffix(affixPool: EquipmentAffixTemplate[], random: () => number): EquipmentAffixTemplate {
  if (affixPool.length === 0) {
    throw new Error("Affix pool must not be empty when affix count > 0.");
  }
  return pickWeighted(
    affixPool.map((affix) => ({
      key: affix,
      weight: Math.max(0, affix.weight)
    })),
    random
  );
}

function buildBaseStats(
  template: EquipmentTemplate,
  level: number,
  rankPercent: number
): GeneratedEquipmentStat[] {
  const multiplier = 1 + rankPercent;
  return template.t1Stats.map((stat) => {
    const baseValue = stat.lvl1Base + (level - 1) * stat.growthRate;
    return {
      key: stat.key,
      label: stat.label,
      baseValue: round(baseValue, 3),
      finalValue: round(baseValue * multiplier, 3)
    };
  });
}

function buildAffixes(
  template: EquipmentTemplate,
  count: number,
  rankPercent: number,
  random: () => number
): GeneratedEquipmentAffix[] {
  if (count <= 0) {
    return [];
  }

  const multiplier = 1 + rankPercent;
  const list: GeneratedEquipmentAffix[] = [];

  for (let i = 0; i < count; i += 1) {
    const affix = pickAffix(template.affixPool, random);
    const rolledValue = rollInRange(affix.min, affix.max, random);
    list.push({
      key: affix.key,
      label: affix.label,
      rolledValue: round(rolledValue, 3),
      finalValue: round(rolledValue * multiplier, 3)
    });
  }

  return list;
}

function getEnvironment(environment?: EquipmentGenerationEnvironment): EquipmentGenerationEnvironment {
  if (!environment) {
    return DEFAULT_EQUIPMENT_ENVIRONMENT;
  }
  return {
    ...DEFAULT_EQUIPMENT_ENVIRONMENT,
    ...environment,
    rankWeightMultipliers: {
      ...DEFAULT_EQUIPMENT_ENVIRONMENT.rankWeightMultipliers,
      ...environment.rankWeightMultipliers
    },
    qualityWeightMultipliers: {
      ...DEFAULT_EQUIPMENT_ENVIRONMENT.qualityWeightMultipliers,
      ...environment.qualityWeightMultipliers
    }
  };
}

function rollRank(
  template: EquipmentTemplate,
  environment: EquipmentGenerationEnvironment,
  random: () => number
): { rank: EquipmentRank; rankPercent: number } {
  const rank = pickWeighted(
    applyMultipliers(template.rankWeights, environment.rankWeightMultipliers),
    random
  );
  const range = EQUIPMENT_RANK_PERCENT_RANGES[rank];
  return {
    rank,
    rankPercent: round(rollInRange(range.min, range.max, random), 4)
  };
}

function rollQuality(
  template: EquipmentTemplate,
  environment: EquipmentGenerationEnvironment,
  random: () => number
): EquipmentQuality {
  return pickWeighted(
    applyMultipliers(template.qualityWeights, environment.qualityWeightMultipliers),
    random
  );
}

function generateUid(templateId: string, sourceSeed: number, index: number): string {
  return `${templateId}-${sourceSeed.toString(36)}-${index.toString(36)}`;
}

export function getSocketCountByLevel(level: number): number {
  return Math.floor(Math.max(1, level) / SOCKET_UNLOCK_LEVEL_STEP);
}

export function generateEquipmentFromTemplate(
  template: EquipmentTemplate,
  request: EquipmentGenerationRequest = {},
  serial = 0
): GeneratedEquipment {
  const seed = normalizeSeed(request.seed);
  const level = normalizeLevel(request.level);
  const random = seededRandom(seed + serial * 17);
  const environment = getEnvironment(request.environment);
  const source = request.source ?? "manual-debug";

  const { rank, rankPercent } = rollRank(template, environment, random);
  const quality = rollQuality(template, environment, random);
  const affixCount = EQUIPMENT_QUALITY_AFFIX_COUNT[quality];
  const t1Stats = buildBaseStats(template, level, rankPercent);
  const affixes = buildAffixes(template, affixCount, rankPercent, random);

  return {
    uid: generateUid(template.id, seed, serial),
    templateId: template.id,
    templateName: template.name,
    slot: template.slot,
    subtype: template.subtype,
    level,
    rank,
    quality,
    rankPercent,
    affixCount,
    sockets: getSocketCountByLevel(level),
    t1Stats,
    affixes,
    source,
    environmentId: environment.id
  };
}

export function generateEquipmentFromPool(
  templates: EquipmentTemplate[],
  request: EquipmentGenerationRequest = {},
  serial = 0
): GeneratedEquipment {
  if (templates.length === 0) {
    throw new Error("Template pool must not be empty.");
  }

  const seed = normalizeSeed(request.seed);
  const random = seededRandom(seed + serial * 19);
  const template = pickWeighted(
    templates.map((item) => ({ key: item, weight: Math.max(0, item.baseWeight) })),
    random
  );

  return generateEquipmentFromTemplate(template, { ...request, seed }, serial);
}

export function generateEquipmentBatch(
  templates: EquipmentTemplate[],
  count: number,
  request: EquipmentGenerationRequest = {}
): GeneratedEquipment[] {
  const safeCount = Math.max(0, Math.floor(count));
  const list: GeneratedEquipment[] = [];
  const seed = normalizeSeed(request.seed);

  for (let i = 0; i < safeCount; i += 1) {
    list.push(generateEquipmentFromPool(templates, { ...request, seed }, i));
  }

  return list;
}
