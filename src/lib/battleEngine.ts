import { equipmentTemplates } from "../data/equipmentTemplates";
import { DEFAULT_ACTIVE_SKILL_ID, battleActiveSkills, battlePassiveSkills, battleTalents } from "../data/battleSkills";
import { generateEquipmentBatch } from "./equipmentSystem";
import type {
  BattleActiveSkillDefinition,
  BattleDropSummary,
  BattleElement,
  BattleLogEntry,
  BattleRuntimeState,
  BattleRuntimeUnit,
  BattleSide,
  BattleStatBlock,
  BattleStatFlatKey,
  BattleStatModifier,
  BattleStatusApplication,
  BattleStatusInstance,
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

interface CreateBattleRuntimeParams {
  battleId: string;
  nodeId: string;
  suppression: number;
  archetype: string;
  allyTeam: BattleUnitTemplate[];
  enemyTeam: BattleUnitTemplate[];
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

function applyTurnStartStatus(unit: BattleRuntimeUnit, logs: BattleLogEntry[], timeMs: number): BattleLogEntry[] {
  let nextLogs = logs;

  unit.statuses.forEach((status) => {
    if (status.remainingTurns <= 0 || !unit.alive) {
      return;
    }

    if (status.key === "poisoned" || status.key === "burning") {
      const ratio = clamp(status.potency, 0.01, 0.2);
      const damage = Math.max(1, Math.round(unit.stats.maxHp * ratio));
      unit.currentHp = Math.max(0, unit.currentHp - damage);
      if (unit.currentHp <= 0) {
        unit.alive = false;
      }
      nextLogs = appendLog(nextLogs, timeMs, "debuff", `${unit.name} 受到持续伤害 ${damage}`);
    }
  });

  unit.statuses = unit.statuses
    .map((status) => ({ ...status, remainingTurns: status.remainingTurns - 1 }))
    .filter((status) => status.remainingTurns > 0);

  return nextLogs;
}

function applyStatus(
  target: BattleRuntimeUnit,
  source: BattleRuntimeUnit,
  application: BattleStatusApplication | undefined,
  timeMs: number,
  logs: BattleLogEntry[]
): BattleLogEntry[] {
  if (!application || !target.alive) {
    return logs;
  }
  if (Math.random() > application.chance) {
    return logs;
  }

  const potency = application.potency ?? (application.key === "guarded" ? 0.2 : application.key === "weakened" ? 0.15 : 0.03);
  const existing = target.statuses.find((status) => status.key === application.key);
  if (existing) {
    existing.remainingTurns = Math.max(existing.remainingTurns, application.duration);
    existing.potency = Math.max(existing.potency, potency);
  } else {
    target.statuses.push({
      id: `${target.id}-${application.key}-${timeMs}-${target.statuses.length + 1}`,
      key: application.key,
      remainingTurns: application.duration,
      potency,
      sourceUnitId: source.id
    });
  }

  return appendLog(logs, timeMs, "debuff", `${source.name} 对 ${target.name} 施加 ${application.key} (${application.duration} 回合)`);
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
  const scaling = skill.scaling;
  const missingHp = actor.stats.maxHp - actor.currentHp;
  return (
    skill.basePower +
    actor.stats.str * (scaling.str ?? 0) +
    actor.stats.int * (scaling.int ?? 0) +
    actor.stats.def * (scaling.def ?? 0) +
    actor.stats.maxHp * (scaling.maxHp ?? 0) +
    missingHp * (scaling.missingHp ?? 0)
  );
}

function applyDamage(attacker: BattleRuntimeUnit, target: BattleRuntimeUnit, value: number): number {
  const damage = Math.max(1, Math.round(value));
  target.currentHp = Math.max(0, target.currentHp - damage);
  if (target.currentHp <= 0) {
    target.alive = false;
  }
  return damage;
}

function applyHeal(target: BattleRuntimeUnit, value: number): number {
  const heal = Math.max(1, Math.round(value));
  const next = Math.min(target.stats.maxHp, target.currentHp + heal);
  const actual = next - target.currentHp;
  target.currentHp = next;
  return actual;
}

function applyElementalTrigger(
  element: BattleElement | undefined,
  attacker: BattleRuntimeUnit,
  target: BattleRuntimeUnit,
  units: BattleRuntimeUnit[],
  dealtDamage: number,
  logs: BattleLogEntry[],
  timeMs: number
): BattleLogEntry[] {
  if (!element || dealtDamage <= 0 || !target.alive) {
    return logs;
  }
  let nextLogs = logs;

  if (element === "fire") {
    const bonus = Math.max(1, Math.round(dealtDamage * 0.1));
    applyDamage(attacker, target, bonus);
    nextLogs = appendLog(nextLogs, timeMs, "damage", `火焰余烬追加 ${bonus} 点伤害`);
    return nextLogs;
  }

  if (element === "water") {
    const recover = Math.max(1, Math.round(dealtDamage * 0.05));
    const before = attacker.currentMp;
    attacker.currentMp = Math.min(attacker.stats.maxMp, attacker.currentMp + recover);
    const actual = attacker.currentMp - before;
    if (actual > 0) {
      nextLogs = appendLog(nextLogs, timeMs, "buff", `${attacker.name} 回复 ${actual} 点 MP`);
    }
    return nextLogs;
  }

  if (element === "ice") {
    target.actionValue = Math.max(0, target.actionValue - 500);
    nextLogs = appendLog(nextLogs, timeMs, "debuff", `${target.name} 行动条 -500`);
    return nextLogs;
  }

  if (element === "wind") {
    attacker.actionValue = Math.min(ACTION_THRESHOLD - 1, attacker.actionValue + 500);
    nextLogs = appendLog(nextLogs, timeMs, "buff", `${attacker.name} 行动条 +500`);
    return nextLogs;
  }

  if (element === "life") {
    const allies = livingUnits(units, attacker.side);
    const amount = Math.max(1, Math.round(dealtDamage * 0.05));
    allies.forEach((ally) => {
      applyHeal(ally, amount);
    });
    nextLogs = appendLog(nextLogs, timeMs, "heal", `${attacker.name} 触发生命回响，友军回复 ${amount}`);
    return nextLogs;
  }

  if (element === "light") {
    const bonus = Math.max(1, Math.round(attacker.stats.maxHp * 0.05));
    applyDamage(attacker, target, bonus);
    nextLogs = appendLog(nextLogs, timeMs, "damage", `光明之力追加 ${bonus} 点伤害`);
    return nextLogs;
  }

  if (element === "undead") {
    const missingHp = Math.max(0, attacker.stats.maxHp - attacker.currentHp);
    const bonus = Math.max(1, Math.round(missingHp * 0.05));
    applyDamage(attacker, target, bonus);
    nextLogs = appendLog(nextLogs, timeMs, "damage", `亡灵之力追加 ${bonus} 点伤害`);
    return nextLogs;
  }

  if (element === "dark") {
    const reduce = Math.max(1, Math.round(target.stats.maxHp * 0.01));
    target.stats.maxHp = Math.max(1, target.stats.maxHp - reduce);
    if (target.currentHp > target.stats.maxHp) {
      target.currentHp = target.stats.maxHp;
    }
    nextLogs = appendLog(nextLogs, timeMs, "debuff", `${target.name} 最大生命降低 ${reduce}`);
  }

  return nextLogs;
}

function performDamageSkill(
  skill: BattleActiveSkillDefinition,
  attacker: BattleRuntimeUnit,
  targets: BattleRuntimeUnit[],
  units: BattleRuntimeUnit[],
  logs: BattleLogEntry[],
  timeMs: number
): BattleLogEntry[] {
  let nextLogs = logs;
  const basePower = computeSkillBase(skill, attacker);

  targets.forEach((target) => {
    if (!target.alive) {
      return;
    }

    if (Math.random() < clamp(target.stats.evasion, 0, EVA_CAP)) {
      nextLogs = appendLog(nextLogs, timeMs, "miss", `${attacker.name} 的 ${skill.name} 被 ${target.name} 闪避`);
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
    const dealt = applyDamage(attacker, target, finalDamage);

    nextLogs = appendLog(
      nextLogs,
      timeMs,
      "damage",
      `${attacker.name} 使用 ${skill.name} 对 ${target.name} 造成 ${dealt} 伤害${crit ? " (暴击)" : ""}`
    );

    if (attacker.stats.lifeSteal > 0 && dealt > 0 && attacker.alive) {
      const heal = Math.max(1, Math.round(dealt * attacker.stats.lifeSteal));
      const healed = applyHeal(attacker, heal);
      if (healed > 0) {
        nextLogs = appendLog(nextLogs, timeMs, "heal", `${attacker.name} 吸血回复 ${healed}`);
      }
    }

    if (target.stats.thorns > 0 && dealt > 0 && attacker.alive) {
      const reflect = Math.max(1, Math.round(dealt * target.stats.thorns));
      const reflected = applyDamage(target, attacker, reflect);
      nextLogs = appendLog(nextLogs, timeMs, "damage", `${target.name} 反伤 ${reflected}`);
    }

    nextLogs = applyElementalTrigger(skill.element, attacker, target, units, dealt, nextLogs, timeMs);
    nextLogs = applyStatus(target, attacker, skill.targetStatus, timeMs, nextLogs);

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
  timeMs: number
): BattleLogEntry[] {
  let nextLogs = logs;
  const basePower = computeSkillBase(skill, actor);

  targets.forEach((target) => {
    if (!target.alive) {
      return;
    }
    const healPower = Math.max(1, Math.round(basePower * (1 + actor.stats.allBoost)));
    const healed = applyHeal(target, healPower);
    nextLogs = appendLog(nextLogs, timeMs, "heal", `${actor.name} 使用 ${skill.name} 为 ${target.name} 回复 ${healed}`);
    nextLogs = applyStatus(target, actor, skill.targetStatus, timeMs, nextLogs);
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

function generateDrops(runtime: BattleRuntimeState): BattleDropSummary {
  const bonusBySuppression = Math.floor(runtime.suppression / 34);
  const archetypeBonus = runtime.archetype === "BL3" ? 1 : runtime.archetype === "BL2" ? 0 : 0;
  const count = clamp(1 + bonusBySuppression + archetypeBonus, 1, 4);
  const level = clamp(1 + Math.floor(runtime.suppression / 15) + (runtime.archetype === "BL3" ? 2 : 0), 1, 25);

  // TODO(战斗掉落): 当前沿用全局装备生成器，后续接入怪物掉落表、地图压制修正与保底机制。
  const items = generateEquipmentBatch(equipmentTemplates, count, {
    level,
    seed: `${runtime.battleId}-${runtime.elapsedMs}-drops`,
    source: `battle:${runtime.nodeId}`
  });

  return {
    generatedAt: runtime.elapsedMs,
    items
  };
}

function processActorTurn(runtime: BattleRuntimeState, actorIndex: number): BattleRuntimeState {
  const units = runtime.units.map(copyUnit);
  const actor = units[actorIndex];
  if (!actor || !actor.alive) {
    return { ...runtime, units };
  }

  let logs = [...runtime.logs];
  const timeMs = runtime.elapsedMs;
  logs = applyTurnStartStatus(actor, logs, timeMs);
  if (!actor.alive) {
    actor.actionValue = 0;
    reduceCooldownsAfterAction(actor, null);
    return { ...runtime, units, logs };
  }

  const blocked = findBlockingStatus(actor);
  if (blocked) {
    actor.actionValue = 0;
    reduceCooldownsAfterAction(actor, null);
    logs = appendLog(logs, timeMs, "debuff", `${actor.name} 受 ${blocked.key} 影响，跳过行动`);
    return { ...runtime, units, logs };
  }

  const selectedSkill = selectSkill(actor, units, runtime.archetype);
  const targets = resolveTargets(selectedSkill, actor, units);

  actor.currentMp = Math.max(0, actor.currentMp - selectedSkill.mpCost);
  logs = appendLog(logs, timeMs, "system", `${actor.name} 释放 ${selectedSkill.name}`);

  if (selectedSkill.effect === "damage") {
    logs = performDamageSkill(selectedSkill, actor, targets, units, logs, timeMs);
  } else {
    logs = performHealSkill(selectedSkill, actor, targets, logs, timeMs);
  }

  if (selectedSkill.selfStatus) {
    logs = applyStatus(actor, actor, selectedSkill.selfStatus, timeMs, logs);
  }

  if (typeof selectedSkill.actionDeltaSelf === "number") {
    actor.actionValue = clamp(actor.actionValue + selectedSkill.actionDeltaSelf, 0, ACTION_THRESHOLD - 1);
  }

  reduceCooldownsAfterAction(actor, selectedSkill.id);
  actor.actionValue = 0;

  units.forEach((unit) => {
    if (unit.currentHp <= 0) {
      unit.currentHp = 0;
      unit.alive = false;
    }
  });

  return { ...runtime, units, logs };
}

export function createBattleRuntime(params: CreateBattleRuntimeParams): BattleRuntimeState {
  const allyTeam = params.allyTeam.map(buildRuntimeUnit);
  const enemyTeam = params.enemyTeam.map(buildRuntimeUnit);

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
    units: [...allyTeam, ...enemyTeam],
    logs,
    drops: null
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
      let logs = appendLog(next.logs, next.elapsedMs, "system", winner === "ally" ? "战斗胜利" : "战斗失败");
      let drops = next.drops;
      if (winner === "ally") {
        drops = generateDrops(next);
        drops.items.forEach((item) => {
          logs = appendLog(logs, next.elapsedMs, "drop", `掉落：${item.templateName} (${item.quality}/${item.rank})`);
        });
      }

      return {
        ...next,
        status: "finished",
        winner,
        logs,
        drops
      };
    }

    processed += 1;
  }

  return next;
}
