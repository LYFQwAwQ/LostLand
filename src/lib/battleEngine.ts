import { generateBattleDropsFromTable } from "../data/battleDrops";
import { battleElementTriggers } from "../data/battleElementTriggers";
import { DEFAULT_ACTIVE_SKILL_ID, battleActiveSkills, battlePassiveSkills, battleTalents } from "../data/battleSkills";
import type {
  BattleActiveSkillDefinition,
  BattleDropSummary,
  BattleElement,
  BattleLogEntry,
  BattleReplayActionSnapshot,
  BattleReplayDamageCause,
  BattleReplayData,
  BattleReplayDropStats,
  BattleReplayStatusChangeAction,
  BattleReplayUnitStat,
  BattleRuntimeState,
  BattleRuntimeUnit,
  BattleSide,
  BattleSkillExtraEffect,
  BattleStatBlock,
  BattleStatFlatKey,
  BattleStatModifier,
  BattleStatusEffectPolarity,
  BattleStatusApplication,
  BattleStatusInstance,
  BattleStatusKey,
  BattleUnitTemplate
} from "../types/battle";

const BATTLE_ELEMENTS: BattleElement[] = ["fire", "water", "ice", "wind", "life", "light", "undead", "dark"];
const ACTION_THRESHOLD = 10_000;
const ACTION_SPEED_COEFFICIENT = 42;
const DEFENSE_K = 1000;
const LOG_LIMIT = 180;
const MAX_ACTIONS_PER_STEP = 3;
const EVA_CAP = 0.5;
const MULTIPLICATIVE_MODIFIER_KEYS = new Set<BattleStatFlatKey>(["maxHp", "maxMp", "str", "int", "agi", "def"]);
const NEGATIVE_STATUS_KEYS = new Set<BattleStatusKey>(["frozen", "stunned", "poisoned", "burning", "weakened", "taunted"]);
const POSITIVE_STATUS_KEYS = new Set<BattleStatusKey>(["guarded", "shielded", "immune"]);
const REPLAY_VIEWS: BattleReplayData["views"] = [
  { key: "stats", title: "战斗统计", description: "单位造成/承受伤害、治疗与击杀统计。" },
  { key: "drops", title: "掉落统计", description: "按掉落类型分类统计，支持装备筛选。" },
  { key: "actions", title: "行动快照", description: "按时间记录每次行动与技能产出。" },
  { key: "status", title: "状态变化", description: "记录异常状态施加、刷新与过期轨迹。" }
];

interface CreateBattleRuntimeParams {
  battleId: string;
  nodeId: string;
  suppression: number;
  archetype: string;
  allyTeam: BattleUnitTemplate[];
  enemyTeam: BattleUnitTemplate[];
}

interface TurnAccumulator {
  damageDone: number;
  healDone: number;
  targetUnitIds: Set<string>;
  targetUnitNames: Set<string>;
}

interface DamageRecordMeta {
  timeMs: number;
  cause: BattleReplayDamageCause;
  skillId: string | null;
  skillName: string | null;
}

function createElementRecord(initial = 0): Record<BattleElement, number> {
  return {
    fire: initial,
    water: initial,
    ice: initial,
    wind: initial,
    life: initial,
    light: initial,
    undead: initial,
    dark: initial
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomOf<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function copyUnit(unit: BattleRuntimeUnit): BattleRuntimeUnit {
  return {
    ...unit,
    stats: {
      ...unit.stats,
      elementBoost: { ...unit.stats.elementBoost },
      elementRes: { ...unit.stats.elementRes }
    },
    cooldowns: { ...unit.cooldowns },
    statuses: unit.statuses.map((status) => ({ ...status })),
    activeSkillIds: [...unit.activeSkillIds],
    passiveSkillIds: [...unit.passiveSkillIds],
    loadout: {
      talentSlot: unit.loadout.talentSlot,
      activeSlots: [...unit.loadout.activeSlots],
      passiveSlots: [...unit.loadout.passiveSlots]
    },
    tags: [...unit.tags]
  };
}

function copyReplayData(replay: BattleReplayData): BattleReplayData {
  return {
    views: replay.views.map((view) => ({ ...view })),
    unitStats: replay.unitStats.map((stat) => ({ ...stat })),
    actionSnapshots: replay.actionSnapshots.map((snapshot) => ({
      ...snapshot,
      targetUnitIds: [...snapshot.targetUnitIds],
      targetUnitNames: [...snapshot.targetUnitNames]
    })),
    damageEvents: replay.damageEvents.map((event) => ({ ...event })),
    statusChanges: replay.statusChanges.map((change) => ({ ...change })),
    dropStats: {
      totalEntries: replay.dropStats.totalEntries,
      byCategory: { ...replay.dropStats.byCategory },
      materials: replay.dropStats.materials.map((item) => ({ ...item }))
    }
  };
}

function createEmptyDropStats(): BattleReplayDropStats {
  return {
    totalEntries: 0,
    byCategory: {
      equipment: 0,
      material: 0
    },
    materials: []
  };
}

function createInitialReplayData(units: BattleRuntimeUnit[]): BattleReplayData {
  const unitStats: BattleReplayUnitStat[] = units.map((unit) => ({
    unitId: unit.id,
    unitName: unit.name,
    side: unit.side,
    damageDealt: 0,
    damageTaken: 0,
    healDone: 0,
    healTaken: 0,
    kills: 0,
    deaths: 0,
    actionCount: 0
  }));

  return {
    views: REPLAY_VIEWS.map((view) => ({ ...view })),
    unitStats,
    actionSnapshots: [],
    damageEvents: [],
    statusChanges: [],
    dropStats: createEmptyDropStats()
  };
}

function ensureUnitStat(replay: BattleReplayData, unit: BattleRuntimeUnit): BattleReplayUnitStat {
  const existing = replay.unitStats.find((item) => item.unitId === unit.id);
  if (existing) {
    existing.unitName = unit.name;
    existing.side = unit.side;
    return existing;
  }

  const created: BattleReplayUnitStat = {
    unitId: unit.id,
    unitName: unit.name,
    side: unit.side,
    damageDealt: 0,
    damageTaken: 0,
    healDone: 0,
    healTaken: 0,
    kills: 0,
    deaths: 0,
    actionCount: 0
  };
  replay.unitStats.push(created);
  return created;
}

function recordDamageEvent(
  replay: BattleReplayData,
  source: BattleRuntimeUnit,
  target: BattleRuntimeUnit,
  amount: number,
  meta: DamageRecordMeta
): void {
  if (amount <= 0) {
    return;
  }
  const sourceStat = ensureUnitStat(replay, source);
  const targetStat = ensureUnitStat(replay, target);
  sourceStat.damageDealt += amount;
  targetStat.damageTaken += amount;

  replay.damageEvents.push({
    id: `dmg-${meta.timeMs}-${replay.damageEvents.length + 1}`,
    timeMs: meta.timeMs,
    sourceUnitId: source.id,
    sourceUnitName: source.name,
    targetUnitId: target.id,
    targetUnitName: target.name,
    amount,
    cause: meta.cause,
    skillId: meta.skillId,
    skillName: meta.skillName
  });
}

function recordHealEvent(
  replay: BattleReplayData,
  source: BattleRuntimeUnit,
  target: BattleRuntimeUnit,
  amount: number,
  timeMs: number,
  skillId: string | null,
  skillName: string | null
): void {
  if (amount <= 0) {
    return;
  }
  const sourceStat = ensureUnitStat(replay, source);
  const targetStat = ensureUnitStat(replay, target);
  sourceStat.healDone += amount;
  targetStat.healTaken += amount;

  replay.damageEvents.push({
    id: `heal-${timeMs}-${replay.damageEvents.length + 1}`,
    timeMs,
    sourceUnitId: source.id,
    sourceUnitName: source.name,
    targetUnitId: target.id,
    targetUnitName: target.name,
    amount: -amount,
    cause: "other",
    skillId,
    skillName
  });
}

function recordStatusChange(
  replay: BattleReplayData,
  action: BattleReplayStatusChangeAction,
  status: BattleStatusInstance,
  unit: BattleRuntimeUnit,
  sourceUnit: BattleRuntimeUnit | null,
  timeMs: number
): void {
  replay.statusChanges.push({
    id: `status-${timeMs}-${replay.statusChanges.length + 1}`,
    timeMs,
    action,
    statusKey: status.key,
    unitId: unit.id,
    unitName: unit.name,
    sourceUnitId: sourceUnit?.id ?? null,
    sourceUnitName: sourceUnit?.name ?? null,
    remainingTurns: status.remainingTurns,
    potency: status.potency
  });
}

function buildDropStats(drops: BattleDropSummary | null): BattleReplayDropStats {
  const stats = createEmptyDropStats();
  if (!drops) {
    return stats;
  }

  const materialMap = new Map<string, BattleReplayDropStats["materials"][number]>();
  drops.entries.forEach((entry) => {
    stats.totalEntries += 1;
    stats.byCategory[entry.category] += entry.quantity;
    if (entry.material) {
      const existing = materialMap.get(entry.material.id);
      if (existing) {
        existing.quantity += entry.quantity;
      } else {
        materialMap.set(entry.material.id, {
          materialId: entry.material.id,
          name: entry.material.name,
          rarity: entry.material.rarity,
          quantity: entry.quantity
        });
      }
    }
  });

  stats.materials = [...materialMap.values()].sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  });
  return stats;
}

function buildBaseStats(template: BattleUnitTemplate): BattleStatBlock {
  return {
    maxHp: Math.max(1, template.baseStats.maxHp),
    maxMp: Math.max(0, template.baseStats.maxMp),
    str: Math.max(0, template.baseStats.str),
    int: Math.max(0, template.baseStats.int),
    agi: Math.max(1, template.baseStats.agi),
    def: Math.max(0, template.baseStats.def),
    penetration: Math.max(0, template.baseStats.penetration ?? 0),
    armorPenPct: clamp(template.baseStats.armorPenPct ?? 0, 0, 0.95),
    critRate: clamp(template.baseStats.critRate ?? 0.05, 0, 0.95),
    critDamage: Math.max(1.2, template.baseStats.critDamage ?? 1.5),
    evasion: clamp(template.baseStats.evasion ?? 0.02, 0, EVA_CAP),
    aggro: Math.max(1, template.baseStats.aggro ?? 50),
    lifeSteal: clamp(template.baseStats.lifeSteal ?? 0, 0, 0.95),
    thorns: clamp(template.baseStats.thorns ?? 0, 0, 0.95),
    damageBoost: template.baseStats.damageBoost ?? 0,
    damageReduction: template.baseStats.damageReduction ?? 0,
    elementalPierce: template.baseStats.elementalPierce ?? 0,
    allRes: template.baseStats.allRes ?? 0,
    allBoost: template.baseStats.allBoost ?? 0,
    elementBoost: {
      ...createElementRecord(0),
      ...(template.baseStats.elementBoost ?? {})
    },
    elementRes: {
      ...createElementRecord(0),
      ...(template.baseStats.elementRes ?? {})
    }
  };
}

function applyStatModifier(stats: BattleStatBlock, modifier: BattleStatModifier): BattleStatBlock {
  const next: BattleStatBlock = {
    ...stats,
    elementBoost: { ...stats.elementBoost },
    elementRes: { ...stats.elementRes }
  };

  if (modifier.flat) {
    (Object.keys(modifier.flat) as BattleStatFlatKey[]).forEach((key) => {
      const value = modifier.flat?.[key];
      if (typeof value !== "number") {
        return;
      }
      next[key] += value;
    });
  }

  if (modifier.ratio) {
    (Object.keys(modifier.ratio) as BattleStatFlatKey[]).forEach((key) => {
      const ratio = modifier.ratio?.[key];
      if (typeof ratio !== "number") {
        return;
      }
      const prevValue = next[key];
      next[key] = MULTIPLICATIVE_MODIFIER_KEYS.has(key) ? prevValue * (1 + ratio) : prevValue + ratio;
    });
  }

  if (modifier.elementBoost) {
    BATTLE_ELEMENTS.forEach((element) => {
      const value = modifier.elementBoost?.[element];
      if (typeof value === "number") {
        next.elementBoost[element] += value;
      }
    });
  }

  if (modifier.elementRes) {
    BATTLE_ELEMENTS.forEach((element) => {
      const value = modifier.elementRes?.[element];
      if (typeof value === "number") {
        next.elementRes[element] += value;
      }
    });
  }

  next.maxHp = Math.max(1, Math.round(next.maxHp));
  next.maxMp = Math.max(0, Math.round(next.maxMp));
  next.str = Math.max(0, Math.round(next.str));
  next.int = Math.max(0, Math.round(next.int));
  next.agi = Math.max(1, Math.round(next.agi));
  next.def = Math.max(0, Math.round(next.def));
  next.penetration = Math.max(0, Math.round(next.penetration));
  next.armorPenPct = clamp(next.armorPenPct, 0, 0.95);
  next.critRate = clamp(next.critRate, 0, 0.95);
  next.critDamage = Math.max(1, next.critDamage);
  next.evasion = clamp(next.evasion, 0, EVA_CAP);
  next.aggro = Math.max(1, next.aggro);
  next.lifeSteal = clamp(next.lifeSteal, 0, 0.95);
  next.thorns = clamp(next.thorns, 0, 0.95);
  next.damageReduction = clamp(next.damageReduction, -0.5, 0.9);
  next.damageBoost = clamp(next.damageBoost, -0.8, 2);
  next.elementalPierce = clamp(next.elementalPierce, 0, 0.95);
  next.allRes = clamp(next.allRes, -0.5, 0.95);
  next.allBoost = clamp(next.allBoost, -0.5, 2);
  BATTLE_ELEMENTS.forEach((element) => {
    next.elementBoost[element] = clamp(next.elementBoost[element], -0.5, 2);
    next.elementRes[element] = clamp(next.elementRes[element], -0.8, 0.95);
  });
  return next;
}

function buildRuntimeUnit(template: BattleUnitTemplate): BattleRuntimeUnit {
  const activeSkillIds = template.loadout.activeSlots
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .filter((skillId) => !!battleActiveSkills[skillId]);
  const passiveSkillIds = template.loadout.passiveSlots
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .filter((skillId) => !!battlePassiveSkills[skillId]);
  const talentId = template.loadout.talentSlot && battleTalents[template.loadout.talentSlot] ? template.loadout.talentSlot : null;

  let finalStats = buildBaseStats(template);
  passiveSkillIds.forEach((passiveId) => {
    finalStats = applyStatModifier(finalStats, battlePassiveSkills[passiveId].modifiers);
  });
  if (talentId) {
    finalStats = applyStatModifier(finalStats, battleTalents[talentId].modifiers);
  }

  const cooldownKeys = new Set(activeSkillIds);
  cooldownKeys.add(DEFAULT_ACTIVE_SKILL_ID);
  const cooldowns: Record<string, number> = {};
  cooldownKeys.forEach((skillId) => {
    cooldowns[skillId] = 0;
  });

  return {
    id: template.id,
    name: template.name,
    side: template.side,
    level: template.level,
    slot: template.slot,
    avatar: template.avatar,
    tags: template.tags ?? [],
    alive: true,
    currentHp: finalStats.maxHp,
    currentMp: finalStats.maxMp,
    actionValue: 0,
    stats: finalStats,
    loadout: {
      talentSlot: template.loadout.talentSlot,
      activeSlots: [...template.loadout.activeSlots],
      passiveSlots: [...template.loadout.passiveSlots]
    },
    activeSkillIds,
    passiveSkillIds,
    talentId,
    cooldowns,
    statuses: []
  };
}

function appendLog(logs: BattleLogEntry[], timeMs: number, tone: BattleLogEntry["tone"], text: string): BattleLogEntry[] {
  const next = [...logs, { id: `${timeMs}-${logs.length + 1}`, timeMs, tone, text }];
  return next.slice(-LOG_LIMIT);
}

function livingUnits(units: BattleRuntimeUnit[], side: BattleSide): BattleRuntimeUnit[] {
  return units.filter((unit) => unit.side === side && unit.alive && unit.currentHp > 0);
}

function findBlockingStatus(unit: BattleRuntimeUnit): BattleStatusInstance | null {
  return unit.statuses.find((status) => status.remainingTurns > 0 && (status.key === "frozen" || status.key === "stunned")) ?? null;
}

function getStatusPotency(unit: BattleRuntimeUnit, key: BattleStatusInstance["key"]): number {
  return unit.statuses
    .filter((status) => status.key === key && status.remainingTurns > 0)
    .reduce((sum, status) => sum + status.potency, 0);
}

function hasPositiveStatus(unit: BattleRuntimeUnit, key: BattleStatusKey): boolean {
  return unit.statuses.some((status) => status.key === key && status.remainingTurns > 0);
}

function statusPolarity(key: BattleStatusKey): BattleStatusEffectPolarity {
  if (NEGATIVE_STATUS_KEYS.has(key)) {
    return "negative";
  }
  if (POSITIVE_STATUS_KEYS.has(key)) {
    return "positive";
  }
  return "all";
}

function matchesStatusPolarity(key: BattleStatusKey, polarity: BattleStatusEffectPolarity): boolean {
  if (polarity === "all") {
    return true;
  }
  return statusPolarity(key) === polarity;
}

function removeStatusesByRule(
  unit: BattleRuntimeUnit,
  source: BattleRuntimeUnit,
  polarity: BattleStatusEffectPolarity,
  removeCount: number,
  replay: BattleReplayData,
  timeMs: number
): BattleStatusInstance[] {
  const removable = unit.statuses
    .filter((status) => status.remainingTurns > 0)
    .filter((status) => matchesStatusPolarity(status.key, polarity))
    .sort((left, right) => {
      if (right.remainingTurns !== left.remainingTurns) {
        return right.remainingTurns - left.remainingTurns;
      }
      return right.potency - left.potency;
    });

  const picked = removable.slice(0, Math.max(1, removeCount));
  if (picked.length === 0) {
    return [];
  }

  const pickedIds = new Set(picked.map((status) => status.id));
  unit.statuses = unit.statuses.filter((status) => !pickedIds.has(status.id));
  picked.forEach((status) => {
    recordStatusChange(replay, "removed", status, unit, source, timeMs);
  });
  return picked;
}

function resolveShieldAbsorption(
  target: BattleRuntimeUnit,
  incomingDamage: number,
  source: BattleRuntimeUnit,
  replay: BattleReplayData,
  timeMs: number
): { damageAfterShield: number; absorbed: number } {
  let remaining = Math.max(0, incomingDamage);
  if (remaining <= 0) {
    return { damageAfterShield: 0, absorbed: 0 };
  }

  const shields = target.statuses
    .filter((status) => status.key === "shielded" && status.remainingTurns > 0 && status.potency > 0)
    .sort((left, right) => left.remainingTurns - right.remainingTurns);

  if (shields.length === 0) {
    return { damageAfterShield: remaining, absorbed: 0 };
  }

  let absorbed = 0;
  shields.forEach((shield) => {
    if (remaining <= 0) {
      return;
    }
    const block = Math.min(remaining, Math.max(0, shield.potency));
    if (block <= 0) {
      return;
    }
    shield.potency -= block;
    absorbed += block;
    remaining -= block;
  });

  const stillActive: BattleStatusInstance[] = [];
  target.statuses.forEach((status) => {
    if (status.key !== "shielded") {
      stillActive.push(status);
      return;
    }
    if (status.remainingTurns <= 0 || status.potency <= 0) {
      const statusSource = source.id === status.sourceUnitId ? source : null;
      recordStatusChange(replay, "removed", { ...status, potency: Math.max(0, status.potency) }, target, statusSource, timeMs);
      return;
    }
    stillActive.push(status);
  });
  target.statuses = stillActive;

  return { damageAfterShield: Math.max(0, remaining), absorbed };
}

function computeScalingValue(basePower: number, scaling: BattleActiveSkillDefinition["scaling"], actor: BattleRuntimeUnit): number {
  const missingHp = actor.stats.maxHp - actor.currentHp;
  return (
    basePower +
    actor.stats.str * (scaling.str ?? 0) +
    actor.stats.int * (scaling.int ?? 0) +
    actor.stats.agi * (scaling.agi ?? 0) +
    actor.stats.def * (scaling.def ?? 0) +
    actor.stats.maxHp * (scaling.maxHp ?? 0) +
    missingHp * (scaling.missingHp ?? 0)
  );
}

function resolveTauntTarget(actor: BattleRuntimeUnit, enemies: BattleRuntimeUnit[]): BattleRuntimeUnit | null {
  const taunts = actor.statuses
    .filter((status) => status.key === "taunted" && status.remainingTurns > 0)
    .sort((left, right) => right.remainingTurns - left.remainingTurns);
  for (const taunt of taunts) {
    const taunter = enemies.find((enemy) => enemy.id === taunt.sourceUnitId && enemy.alive);
    if (taunter) {
      return taunter;
    }
  }
  return null;
}

function applyDamage(
  source: BattleRuntimeUnit,
  target: BattleRuntimeUnit,
  value: number,
  replay: BattleReplayData,
  meta: DamageRecordMeta
): number {
  const rawDamage = Math.max(1, Math.round(value));
  const { damageAfterShield } = resolveShieldAbsorption(target, rawDamage, source, replay, meta.timeMs);
  const damage = Math.max(0, Math.round(damageAfterShield));
  if (damage <= 0) {
    return 0;
  }
  const aliveBefore = target.alive && target.currentHp > 0;
  target.currentHp = Math.max(0, target.currentHp - damage);
  if (target.currentHp <= 0) {
    target.alive = false;
  }
  recordDamageEvent(replay, source, target, damage, meta);
  if (aliveBefore && !target.alive && source.id !== target.id) {
    ensureUnitStat(replay, source).kills += 1;
    ensureUnitStat(replay, target).deaths += 1;
  }
  return damage;
}

function applyHeal(
  source: BattleRuntimeUnit,
  target: BattleRuntimeUnit,
  value: number,
  replay: BattleReplayData,
  timeMs: number,
  skillId: string | null,
  skillName: string | null
): number {
  const heal = Math.max(1, Math.round(value));
  const next = Math.min(target.stats.maxHp, target.currentHp + heal);
  const actual = next - target.currentHp;
  target.currentHp = next;
  recordHealEvent(replay, source, target, actual, timeMs, skillId, skillName);
  return actual;
}

function applyTurnStartStatus(
  unit: BattleRuntimeUnit,
  units: BattleRuntimeUnit[],
  logs: BattleLogEntry[],
  timeMs: number,
  replay: BattleReplayData
): BattleLogEntry[] {
  let nextLogs = logs;

  unit.statuses.forEach((status) => {
    if (status.remainingTurns <= 0 || !unit.alive) {
      return;
    }
    if (status.key === "poisoned" || status.key === "burning") {
      const ratio = clamp(status.potency, 0.01, 0.2);
      const damage = Math.max(1, Math.round(unit.stats.maxHp * ratio));
      const source = units.find((candidate) => candidate.id === status.sourceUnitId) ?? unit;
      const dealt = applyDamage(source, unit, damage, replay, {
        timeMs,
        cause: "status",
        skillId: null,
        skillName: status.key
      });
      nextLogs = appendLog(nextLogs, timeMs, "debuff", `${unit.name} 受到持续伤害 ${dealt}`);
    }
  });

  const reducedStatuses: BattleStatusInstance[] = [];
  unit.statuses.forEach((status) => {
    const reduced = { ...status, remainingTurns: status.remainingTurns - 1 };
    if (reduced.remainingTurns > 0) {
      reducedStatuses.push(reduced);
    } else {
      const source = units.find((candidate) => candidate.id === status.sourceUnitId) ?? null;
      recordStatusChange(replay, "expired", { ...status, remainingTurns: 0 }, unit, source, timeMs);
    }
  });
  unit.statuses = reducedStatuses;

  return nextLogs;
}

function applyStatus(
  target: BattleRuntimeUnit,
  source: BattleRuntimeUnit,
  application: BattleStatusApplication | undefined,
  timeMs: number,
  logs: BattleLogEntry[],
  replay: BattleReplayData
): BattleLogEntry[] {
  if (!application || !target.alive) {
    return logs;
  }
  const polarity = statusPolarity(application.key);
  if (polarity === "negative" && hasPositiveStatus(target, "immune")) {
    return appendLog(logs, timeMs, "buff", `${target.name} 免疫了 ${application.key}`);
  }
  if (Math.random() > application.chance) {
    return logs;
  }

  const potency = application.potency ?? (application.key === "guarded" ? 0.2 : application.key === "weakened" ? 0.15 : 0.03);
  const existing = target.statuses.find((status) => status.key === application.key);
  if (existing) {
    existing.remainingTurns = Math.max(existing.remainingTurns, application.duration);
    existing.potency = application.key === "shielded" ? existing.potency + potency : Math.max(existing.potency, potency);
    existing.sourceUnitId = source.id;
    recordStatusChange(replay, "refreshed", existing, target, source, timeMs);
  } else {
    const created: BattleStatusInstance = {
      id: `${target.id}-${application.key}-${timeMs}-${target.statuses.length + 1}`,
      key: application.key,
      remainingTurns: application.duration,
      potency,
      sourceUnitId: source.id
    };
    target.statuses.push(created);
    recordStatusChange(replay, "applied", created, target, source, timeMs);
  }

  return appendLog(
    logs,
    timeMs,
    polarity === "negative" ? "debuff" : "buff",
    `${source.name} 对 ${target.name} 施加 ${application.key} (${application.duration} 回合)`
  );
}

function chooseByWeight<T>(entries: Array<{ weight: number; value: T }>): T | null {
  const valid = entries.filter((entry) => entry.weight > 0);
  if (valid.length === 0) {
    return null;
  }
  const sum = valid.reduce((acc, item) => acc + item.weight, 0);
  const roll = Math.random() * sum;
  let cursor = 0;
  for (const item of valid) {
    cursor += item.weight;
    if (roll <= cursor) {
      return item.value;
    }
  }
  return valid[valid.length - 1]?.value ?? null;
}

function battlefieldSkillWeightBonus(archetype: string, category: BattleActiveSkillDefinition["category"]): number {
  const key = archetype.toUpperCase();
  if (key === "BL1") {
    if (category === "assault") return 8;
    if (category === "afflict") return 4;
    if (category === "succor") return -6;
  }
  if (key === "BL2") {
    if (category === "afflict") return 12;
    if (category === "inspire") return 6;
  }
  if (key === "BL3") {
    if (category === "assault") return 10;
    if (category === "defend") return 5;
    if (category === "succor") return 4;
  }
  return 0;
}

function selectSkill(actor: BattleRuntimeUnit, units: BattleRuntimeUnit[], archetype: string): BattleActiveSkillDefinition {
  const skillIds = actor.activeSkillIds.length > 0 ? actor.activeSkillIds : [DEFAULT_ACTIVE_SKILL_ID];
  const usable = skillIds
    .map((skillId) => battleActiveSkills[skillId] ?? null)
    .filter((skill): skill is BattleActiveSkillDefinition => !!skill)
    .filter((skill) => actor.currentMp >= skill.mpCost && (actor.cooldowns[skill.id] ?? 0) <= 0);

  if (usable.length === 0) {
    return battleActiveSkills[DEFAULT_ACTIVE_SKILL_ID];
  }

  const allies = livingUnits(units, actor.side);
  const enemies = livingUnits(units, actor.side === "ally" ? "enemy" : "ally");
  const selfHpRatio = actor.currentHp / actor.stats.maxHp;
  const allyLowestHpRatio = allies.length
    ? allies.reduce((lowest, unit) => Math.min(lowest, unit.currentHp / unit.stats.maxHp), 1)
    : 1;
  const enemyLowestHpRatio = enemies.length
    ? enemies.reduce((lowest, unit) => Math.min(lowest, unit.currentHp / unit.stats.maxHp), 1)
    : 1;

  const weighted = usable.map((skill) => {
    let weight = skill.baseWeight;
    weight += actor.stats.damageBoost * 60;
    weight += actor.stats.allBoost * 40;
    weight += battlefieldSkillWeightBonus(archetype, skill.category);

    const tuning = skill.weightTuning;
    if (tuning?.selfHpBelow && selfHpRatio <= tuning.selfHpBelow.threshold) {
      weight += tuning.selfHpBelow.delta;
    }
    if (tuning?.allyHpBelow && allyLowestHpRatio <= tuning.allyHpBelow.threshold) {
      weight += tuning.allyHpBelow.delta;
    }
    if (tuning?.enemyHpBelow && enemyLowestHpRatio <= tuning.enemyHpBelow.threshold) {
      weight += tuning.enemyHpBelow.delta;
    }
    if (tuning?.enemyCountAtLeast && enemies.length >= tuning.enemyCountAtLeast.count) {
      weight += tuning.enemyCountAtLeast.delta;
    }
    return { weight: Math.max(1, weight), value: skill };
  });

  return chooseByWeight(weighted) ?? usable[0];
}

function chooseSingleEnemyTarget(candidates: BattleRuntimeUnit[]): BattleRuntimeUnit | null {
  if (candidates.length === 0) {
    return null;
  }
  const front = candidates.filter((unit) => unit.slot.line === "front");
  const pool = front.length > 0 ? front : candidates;
  return (
    chooseByWeight(
      pool.map((unit) => ({
        value: unit,
        weight: Math.max(1, unit.stats.aggro + (1 - unit.currentHp / unit.stats.maxHp) * 60)
      }))
    ) ?? pool[0]
  );
}

function resolveTargets(skill: BattleActiveSkillDefinition, actor: BattleRuntimeUnit, units: BattleRuntimeUnit[]): BattleRuntimeUnit[] {
  const allies = livingUnits(units, actor.side);
  const enemies = livingUnits(units, actor.side === "ally" ? "enemy" : "ally");

  if (skill.targetType === "self") {
    return actor.alive ? [actor] : [];
  }
  if (skill.targetType === "allEnemies") {
    return enemies;
  }
  if (skill.targetType === "allAllies") {
    return allies;
  }
  if (skill.targetType === "singleEnemy") {
    const forced = resolveTauntTarget(actor, enemies);
    if (forced) {
      return [forced];
    }
    const target = chooseSingleEnemyTarget(enemies);
    return target ? [target] : [];
  }
  if (skill.targetType === "lowestHpAlly") {
    const target = allies
      .filter((unit) => unit.alive)
      .sort((left, right) => left.currentHp / left.stats.maxHp - right.currentHp / right.stats.maxHp)[0];
    return target ? [target] : [];
  }
  if (skill.targetType === "singleAlly") {
    const pick = randomOf(allies);
    return pick ? [pick] : [];
  }
  return [];
}

function computeSkillBase(skill: BattleActiveSkillDefinition, actor: BattleRuntimeUnit): number {
  return computeScalingValue(skill.basePower, skill.scaling, actor);
}

function resolveElementTriggerBase(
  valueSource: "dealtDamage" | "attackerMaxHp" | "attackerMissingHp" | "targetMaxHp" | undefined,
  attacker: BattleRuntimeUnit,
  target: BattleRuntimeUnit,
  dealtDamage: number
): number {
  if (valueSource === "attackerMaxHp") {
    return attacker.stats.maxHp;
  }
  if (valueSource === "attackerMissingHp") {
    return Math.max(0, attacker.stats.maxHp - attacker.currentHp);
  }
  if (valueSource === "targetMaxHp") {
    return target.stats.maxHp;
  }
  return dealtDamage;
}

function renderElementTriggerLog(
  template: string,
  actorName: string,
  targetName: string,
  value: number,
  label: string
): string {
  return template
    .replace("{actor}", actorName)
    .replace("{target}", targetName)
    .replace("{value}", `${value}`)
    .replace("{label}", label);
}

function applyElementalTrigger(
  element: BattleElement | undefined,
  attacker: BattleRuntimeUnit,
  target: BattleRuntimeUnit,
  units: BattleRuntimeUnit[],
  dealtDamage: number,
  logs: BattleLogEntry[],
  timeMs: number,
  replay: BattleReplayData,
  accumulator: TurnAccumulator
): BattleLogEntry[] {
  if (!element || dealtDamage <= 0 || !target.alive) {
    return logs;
  }

  const trigger = battleElementTriggers[element];
  if (!trigger) {
    return logs;
  }

  let nextLogs = logs;
  const sourceBase = resolveElementTriggerBase(trigger.valueSource, attacker, target, dealtDamage);
  const scaled = (trigger.ratio ?? 0) * sourceBase;
  const effectValue = Math.max(1, Math.round(typeof trigger.flat === "number" ? trigger.flat : scaled));
  const triggerLabel = trigger.replaySkillName ?? trigger.name;

  if (trigger.effect === "bonusDamageToTarget") {
    const applied = applyDamage(attacker, target, effectValue, replay, {
      timeMs,
      cause: "element",
      skillId: null,
      skillName: trigger.replaySkillName ?? trigger.name
    });
    accumulator.damageDone += applied;
    accumulator.targetUnitIds.add(target.id);
    accumulator.targetUnitNames.add(target.name);
    nextLogs = appendLog(
      nextLogs,
      timeMs,
      "damage",
      renderElementTriggerLog(trigger.logTemplate, attacker.name, target.name, applied, triggerLabel)
    );
    return nextLogs;
  }

  if (trigger.effect === "restoreMpToSelf") {
    const before = attacker.currentMp;
    attacker.currentMp = Math.min(attacker.stats.maxMp, attacker.currentMp + effectValue);
    const actual = attacker.currentMp - before;
    if (actual > 0) {
      nextLogs = appendLog(
        nextLogs,
        timeMs,
        "buff",
        renderElementTriggerLog(trigger.logTemplate, attacker.name, target.name, actual, triggerLabel)
      );
    }
    return nextLogs;
  }

  if (trigger.effect === "reduceTargetAction") {
    target.actionValue = Math.max(0, target.actionValue - effectValue);
    nextLogs = appendLog(
      nextLogs,
      timeMs,
      "debuff",
      renderElementTriggerLog(trigger.logTemplate, attacker.name, target.name, effectValue, triggerLabel)
    );
    return nextLogs;
  }

  if (trigger.effect === "boostSelfAction") {
    attacker.actionValue = Math.min(ACTION_THRESHOLD - 1, attacker.actionValue + effectValue);
    nextLogs = appendLog(
      nextLogs,
      timeMs,
      "buff",
      renderElementTriggerLog(trigger.logTemplate, attacker.name, target.name, effectValue, triggerLabel)
    );
    return nextLogs;
  }

  if (trigger.effect === "healAllies") {
    const allies = livingUnits(units, attacker.side);
    allies.forEach((ally) => {
      const healed = applyHeal(attacker, ally, effectValue, replay, timeMs, null, trigger.replaySkillName ?? trigger.name);
      if (healed > 0) {
        accumulator.healDone += healed;
        accumulator.targetUnitIds.add(ally.id);
        accumulator.targetUnitNames.add(ally.name);
      }
    });
    nextLogs = appendLog(
      nextLogs,
      timeMs,
      "heal",
      renderElementTriggerLog(trigger.logTemplate, attacker.name, target.name, effectValue, triggerLabel)
    );
    return nextLogs;
  }

  if (trigger.effect === "reduceTargetMaxHp") {
    target.stats.maxHp = Math.max(1, target.stats.maxHp - effectValue);
    if (target.currentHp > target.stats.maxHp) {
      target.currentHp = target.stats.maxHp;
    }
    nextLogs = appendLog(
      nextLogs,
      timeMs,
      "debuff",
      renderElementTriggerLog(trigger.logTemplate, attacker.name, target.name, effectValue, triggerLabel)
    );
  }
  return nextLogs;
}

function performDamageSkill(
  skill: BattleActiveSkillDefinition,
  attacker: BattleRuntimeUnit,
  targets: BattleRuntimeUnit[],
  units: BattleRuntimeUnit[],
  logs: BattleLogEntry[],
  timeMs: number,
  replay: BattleReplayData,
  accumulator: TurnAccumulator
): BattleLogEntry[] {
  let nextLogs = logs;
  const basePower = computeSkillBase(skill, attacker);

  targets.forEach((target) => {
    if (!target.alive) {
      return;
    }
    if (Math.random() < clamp(target.stats.evasion, 0, EVA_CAP)) {
      nextLogs = appendLog(nextLogs, timeMs, "miss", `${attacker.name} 的 ${skill.name} 被 ${target.name} 闪避`);
      accumulator.targetUnitIds.add(target.id);
      accumulator.targetUnitNames.add(target.name);
      return;
    }

    const crit = (skill.canCrit ?? true) && Math.random() < clamp(attacker.stats.critRate, 0, 0.95);
    const critZone = crit ? Math.max(1, attacker.stats.critDamage) : 1;
    const effectiveDef = Math.max(0, target.stats.def * (1 - clamp(attacker.stats.armorPenPct, 0, 0.95)) - attacker.stats.penetration);
    const defZone = DEFENSE_K / (DEFENSE_K + effectiveDef);
    const element = skill.element;
    const boost = element ? attacker.stats.elementBoost[element] : 0;
    const res = element ? target.stats.elementRes[element] : 0;
    const effRes = clamp((res + target.stats.allRes) - attacker.stats.elementalPierce, -0.85, 0.95);
    const elemZone = element ? (1 + boost + attacker.stats.allBoost) * (1 - effRes) : 1;
    const weakenedPenalty = getStatusPotency(attacker, "weakened");
    const guardedBonus = getStatusPotency(target, "guarded");
    const extraZone = Math.max(0.1, 1 + attacker.stats.damageBoost - weakenedPenalty);
    const reductionZone = Math.max(0.1, 1 - clamp(target.stats.damageReduction + guardedBonus, -0.8, 0.9));
    const finalDamage = Math.max(1, Math.round(basePower * critZone * defZone * elemZone * extraZone * reductionZone));
    const dealt = applyDamage(attacker, target, finalDamage, replay, {
      timeMs,
      cause: "skill",
      skillId: skill.id,
      skillName: skill.name
    });
    accumulator.damageDone += dealt;
    accumulator.targetUnitIds.add(target.id);
    accumulator.targetUnitNames.add(target.name);

    nextLogs = appendLog(
      nextLogs,
      timeMs,
      "damage",
      `${attacker.name} 使用 ${skill.name} 对 ${target.name} 造成 ${dealt} 伤害${crit ? " (暴击)" : ""}`
    );

    if (attacker.stats.lifeSteal > 0 && dealt > 0 && attacker.alive) {
      const heal = Math.max(1, Math.round(dealt * attacker.stats.lifeSteal));
      const healed = applyHeal(attacker, attacker, heal, replay, timeMs, skill.id, `${skill.name}-吸血`);
      if (healed > 0) {
        accumulator.healDone += healed;
        accumulator.targetUnitIds.add(attacker.id);
        accumulator.targetUnitNames.add(attacker.name);
        nextLogs = appendLog(nextLogs, timeMs, "heal", `${attacker.name} 吸血回复 ${healed}`);
      }
    }

    if (target.stats.thorns > 0 && dealt > 0 && attacker.alive) {
      const reflect = Math.max(1, Math.round(dealt * target.stats.thorns));
      const reflected = applyDamage(target, attacker, reflect, replay, {
        timeMs,
        cause: "thorns",
        skillId: null,
        skillName: "反伤"
      });
      nextLogs = appendLog(nextLogs, timeMs, "damage", `${target.name} 反伤 ${reflected}`);
    }

    nextLogs = applyElementalTrigger(skill.element, attacker, target, units, dealt, nextLogs, timeMs, replay, accumulator);
    nextLogs = applyStatus(target, attacker, skill.targetStatus, timeMs, nextLogs, replay);

    if (typeof skill.actionDeltaTarget === "number") {
      target.actionValue = Math.max(0, target.actionValue - skill.actionDeltaTarget);
    }
  });

  return nextLogs;
}

function performHealSkill(
  skill: BattleActiveSkillDefinition,
  actor: BattleRuntimeUnit,
  targets: BattleRuntimeUnit[],
  logs: BattleLogEntry[],
  timeMs: number,
  replay: BattleReplayData,
  accumulator: TurnAccumulator
): BattleLogEntry[] {
  let nextLogs = logs;
  const basePower = computeSkillBase(skill, actor);

  targets.forEach((target) => {
    if (!target.alive) {
      return;
    }
    const healPower = Math.max(1, Math.round(basePower * (1 + actor.stats.allBoost)));
    const healed = applyHeal(actor, target, healPower, replay, timeMs, skill.id, skill.name);
    accumulator.healDone += healed;
    accumulator.targetUnitIds.add(target.id);
    accumulator.targetUnitNames.add(target.name);
    nextLogs = appendLog(nextLogs, timeMs, "heal", `${actor.name} 使用 ${skill.name} 为 ${target.name} 回复 ${healed}`);
    nextLogs = applyStatus(target, actor, skill.targetStatus, timeMs, nextLogs, replay);
  });

  return nextLogs;
}

function applyExtraEffects(
  skill: BattleActiveSkillDefinition,
  actor: BattleRuntimeUnit,
  targets: BattleRuntimeUnit[],
  logs: BattleLogEntry[],
  timeMs: number,
  replay: BattleReplayData,
  accumulator: TurnAccumulator
): BattleLogEntry[] {
  if (!skill.extraEffects || skill.extraEffects.length === 0) {
    return logs;
  }
  let nextLogs = logs;

  skill.extraEffects.forEach((effect: BattleSkillExtraEffect) => {
    const effectTargets = effect.target === "self" ? [actor] : targets;
    if (effect.type === "applyStatus") {
      effectTargets.forEach((target) => {
        nextLogs = applyStatus(target, actor, effect.application, timeMs, nextLogs, replay);
        accumulator.targetUnitIds.add(target.id);
        accumulator.targetUnitNames.add(target.name);
      });
      return;
    }

    if (effect.type === "actionDelta") {
      effectTargets.forEach((target) => {
        target.actionValue = clamp(target.actionValue + effect.delta, 0, ACTION_THRESHOLD - 1);
        accumulator.targetUnitIds.add(target.id);
        accumulator.targetUnitNames.add(target.name);
        const tone = effect.delta >= 0 ? "buff" : "debuff";
        nextLogs = appendLog(
          nextLogs,
          timeMs,
          tone,
          `${skill.name} 调整 ${target.name} 行动值 ${effect.delta >= 0 ? "+" : ""}${Math.round(effect.delta)}`
        );
      });
      return;
    }

    if (effect.type === "shield") {
      const shieldValue = Math.max(1, Math.round(computeScalingValue(effect.basePower, effect.scaling, actor)));
      effectTargets.forEach((target) => {
        accumulator.targetUnitIds.add(target.id);
        accumulator.targetUnitNames.add(target.name);
        nextLogs = applyStatus(
          target,
          actor,
          {
            key: "shielded",
            chance: 1,
            duration: effect.duration,
            potency: shieldValue
          },
          timeMs,
          nextLogs,
          replay
        );
        nextLogs = appendLog(nextLogs, timeMs, "buff", `${target.name} 获得 ${shieldValue} 点护盾`);
      });
      return;
    }

    if (effect.type === "cleanse" || effect.type === "dispel") {
      const defaultPolarity: BattleStatusEffectPolarity = effect.type === "cleanse" ? "negative" : "positive";
      const polarity = effect.polarity ?? defaultPolarity;
      const removeCount = Math.max(1, effect.removeCount ?? 1);
      effectTargets.forEach((target) => {
        accumulator.targetUnitIds.add(target.id);
        accumulator.targetUnitNames.add(target.name);
        const removed = removeStatusesByRule(target, actor, polarity, removeCount, replay, timeMs);
        if (removed.length <= 0) {
          return;
        }
        const removedText = removed.map((status) => status.key).join("、");
        nextLogs = appendLog(
          nextLogs,
          timeMs,
          effect.type === "cleanse" ? "buff" : "debuff",
          `${skill.name} 从 ${target.name} ${effect.type === "cleanse" ? "净化" : "驱散"}：${removedText}`
        );
      });
      return;
    }
  });

  return nextLogs;
}

function reduceCooldownsAfterAction(actor: BattleRuntimeUnit, usedSkillId: string | null): void {
  Object.keys(actor.cooldowns).forEach((skillId) => {
    if (skillId === usedSkillId) {
      return;
    }
    if (actor.cooldowns[skillId] > 0) {
      actor.cooldowns[skillId] -= 1;
    }
  });

  if (usedSkillId) {
    const usedSkill = battleActiveSkills[usedSkillId];
    if (usedSkill) {
      actor.cooldowns[usedSkillId] = usedSkill.cooldown;
    }
  }
}

function aliveCount(units: BattleRuntimeUnit[], side: BattleSide): number {
  return units.filter((unit) => unit.side === side && unit.alive).length;
}

function detectWinner(units: BattleRuntimeUnit[]): BattleSide | null {
  const allyAlive = aliveCount(units, "ally");
  const enemyAlive = aliveCount(units, "enemy");
  if (allyAlive <= 0 && enemyAlive <= 0) {
    return "enemy";
  }
  if (enemyAlive <= 0) {
    return "ally";
  }
  if (allyAlive <= 0) {
    return "enemy";
  }
  return null;
}

function resolveEnemyPrototypeId(unit: BattleRuntimeUnit): string {
  const tagged = unit.tags.find((tag) => tag.startsWith("enemy:"));
  if (tagged) {
    return tagged.slice("enemy:".length);
  }
  return unit.id.replace(/-\d+$/, "");
}

function generateDrops(runtime: BattleRuntimeState): BattleDropSummary {
  const defeatedEnemies = runtime.units
    .filter((unit) => unit.side === "enemy" && !unit.alive)
    .map((unit) => ({
      unitId: unit.id,
      unitName: unit.name,
      prototypeId: resolveEnemyPrototypeId(unit),
      level: unit.level
    }));

  return generateBattleDropsFromTable({
    battleId: runtime.battleId,
    nodeId: runtime.nodeId,
    elapsedMs: runtime.elapsedMs,
    enemies: defeatedEnemies
  });
}

function processActorTurn(runtime: BattleRuntimeState, actorIndex: number): BattleRuntimeState {
  const units = runtime.units.map(copyUnit);
  const actor = units[actorIndex];
  if (!actor || !actor.alive) {
    return { ...runtime, units };
  }

  const replay = copyReplayData(runtime.replay);
  let logs = [...runtime.logs];
  const timeMs = runtime.elapsedMs;
  logs = applyTurnStartStatus(actor, units, logs, timeMs, replay);
  if (!actor.alive) {
    actor.actionValue = 0;
    reduceCooldownsAfterAction(actor, null);
    return { ...runtime, units, logs, replay };
  }

  const blocked = findBlockingStatus(actor);
  if (blocked) {
    actor.actionValue = 0;
    reduceCooldownsAfterAction(actor, null);
    logs = appendLog(logs, timeMs, "debuff", `${actor.name} 受 ${blocked.key} 影响，跳过行动`);
    return { ...runtime, units, logs, replay };
  }

  const selectedSkill = selectSkill(actor, units, runtime.archetype);
  const targets = resolveTargets(selectedSkill, actor, units);
  const accumulator: TurnAccumulator = {
    damageDone: 0,
    healDone: 0,
    targetUnitIds: new Set<string>(),
    targetUnitNames: new Set<string>()
  };

  ensureUnitStat(replay, actor).actionCount += 1;
  actor.currentMp = Math.max(0, actor.currentMp - selectedSkill.mpCost);
  logs = appendLog(logs, timeMs, "system", `${actor.name} 释放 ${selectedSkill.name}`);

  if (selectedSkill.effect === "damage") {
    logs = performDamageSkill(selectedSkill, actor, targets, units, logs, timeMs, replay, accumulator);
  } else {
    logs = performHealSkill(selectedSkill, actor, targets, logs, timeMs, replay, accumulator);
  }

  logs = applyExtraEffects(selectedSkill, actor, targets, logs, timeMs, replay, accumulator);

  if (selectedSkill.selfStatus) {
    logs = applyStatus(actor, actor, selectedSkill.selfStatus, timeMs, logs, replay);
  }

  if (typeof selectedSkill.actionDeltaSelf === "number") {
    actor.actionValue = clamp(actor.actionValue + selectedSkill.actionDeltaSelf, 0, ACTION_THRESHOLD - 1);
  }

  const snapshot: BattleReplayActionSnapshot = {
    id: `action-${timeMs}-${replay.actionSnapshots.length + 1}`,
    timeMs,
    actorUnitId: actor.id,
    actorUnitName: actor.name,
    skillId: selectedSkill.id,
    skillName: selectedSkill.name,
    targetUnitIds: [...accumulator.targetUnitIds],
    targetUnitNames: [...accumulator.targetUnitNames],
    damageDone: accumulator.damageDone,
    healDone: accumulator.healDone
  };
  replay.actionSnapshots.push(snapshot);

  reduceCooldownsAfterAction(actor, selectedSkill.id);
  actor.actionValue = 0;

  units.forEach((unit) => {
    if (unit.currentHp <= 0) {
      unit.currentHp = 0;
      unit.alive = false;
    }
  });

  return { ...runtime, units, logs, replay };
}

function finalizeBattle(runtime: BattleRuntimeState, winner: BattleSide, drops: BattleDropSummary | null, baseLogs?: BattleLogEntry[]): BattleRuntimeState {
  let logs = baseLogs ?? runtime.logs;
  const replay = copyReplayData(runtime.replay);
  replay.dropStats = buildDropStats(drops);

  if (winner === "ally" && drops) {
    drops.entries.forEach((entry) => {
      if (entry.category === "equipment" && entry.equipment) {
        logs = appendLog(logs, runtime.elapsedMs, "drop", `掉落装备：${entry.equipment.templateName} (${entry.equipment.quality}/${entry.equipment.rank})`);
      } else if (entry.category === "material" && entry.material) {
        logs = appendLog(logs, runtime.elapsedMs, "drop", `掉落材料：${entry.material.name} x${entry.quantity}`);
      }
    });
  }

  return {
    ...runtime,
    status: "finished",
    winner,
    logs,
    drops,
    replay
  };
}

export function createBattleRuntime(params: CreateBattleRuntimeParams): BattleRuntimeState {
  const allyTeam = params.allyTeam.map(buildRuntimeUnit);
  const enemyTeam = params.enemyTeam.map(buildRuntimeUnit);
  const units = [...allyTeam, ...enemyTeam];

  const logs: BattleLogEntry[] = [
    {
      id: "init-1",
      timeMs: 0,
      tone: "system",
      text: `进入战斗：${params.nodeId}（压制 ${params.suppression}%）`
    }
  ];

  return {
    battleId: params.battleId,
    nodeId: params.nodeId,
    suppression: params.suppression,
    archetype: params.archetype,
    status: "idle",
    winner: null,
    elapsedMs: 0,
    tickCount: 0,
    speedMultiplier: 1,
    units,
    logs,
    drops: null,
    replay: createInitialReplayData(units)
  };
}

export function setBattleRunning(runtime: BattleRuntimeState, running: boolean): BattleRuntimeState {
  if (runtime.status === "finished") {
    return runtime;
  }
  return {
    ...runtime,
    status: running ? "running" : "idle"
  };
}

export function setBattleSpeed(runtime: BattleRuntimeState, speedMultiplier: number): BattleRuntimeState {
  return {
    ...runtime,
    speedMultiplier: clamp(speedMultiplier, 0.5, 6)
  };
}

export function endBattle(runtime: BattleRuntimeState): BattleRuntimeState {
  if (runtime.status === "finished") {
    return runtime;
  }
  const logs = appendLog(runtime.logs, runtime.elapsedMs, "system", "战斗被手动结束");
  return finalizeBattle({ ...runtime, logs }, "enemy", runtime.drops, logs);
}

export function stepBattle(runtime: BattleRuntimeState, deltaMs: number): BattleRuntimeState {
  if (runtime.status !== "running" || runtime.winner) {
    return runtime;
  }

  const units = runtime.units.map(copyUnit);
  const deltaSeconds = Math.max(0.01, deltaMs / 1000);
  units.forEach((unit) => {
    if (!unit.alive) {
      return;
    }
    unit.actionValue += unit.stats.agi * ACTION_SPEED_COEFFICIENT * deltaSeconds * runtime.speedMultiplier;
  });

  let next: BattleRuntimeState = {
    ...runtime,
    elapsedMs: runtime.elapsedMs + deltaMs,
    tickCount: runtime.tickCount + 1,
    units
  };

  let processed = 0;
  while (processed < MAX_ACTIONS_PER_STEP) {
    let nextActorIndex = -1;
    let maxActionValue = ACTION_THRESHOLD;
    next.units.forEach((unit, index) => {
      if (!unit.alive) {
        return;
      }
      if (unit.actionValue >= ACTION_THRESHOLD && unit.actionValue >= maxActionValue) {
        nextActorIndex = index;
        maxActionValue = unit.actionValue;
      }
    });

    if (nextActorIndex < 0) {
      break;
    }

    next = processActorTurn(next, nextActorIndex);
    const winner = detectWinner(next.units);
    if (winner) {
      const logs = appendLog(next.logs, next.elapsedMs, "system", winner === "ally" ? "战斗胜利" : "战斗失败");
      const drops = winner === "ally" ? generateDrops(next) : null;
      return finalizeBattle({ ...next, logs }, winner, drops, logs);
    }

    processed += 1;
  }

  return next;
}
