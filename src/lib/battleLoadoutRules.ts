import { battleActiveSkills, battlePassiveSkills, battleTalents } from "../data/battleSkills";
import type {
  BattleActiveSkillDefinition,
  BattleLoadout,
  BattlePassiveSkillDefinition,
  BattleSkillPool,
  BattleTalentDefinition
} from "../types/battle";
import type { HeroClass } from "../types/game";

const HERO_SKILL_SLOT_COUNT = 10;
const HERO_CLASSES: HeroClass[] = ["paladin", "mage", "ranger"];

type HeroSelectableSkill = {
  id: string;
  name: string;
  conflictSkillIds?: string[];
};

type HeroSkillKind = "talent" | "active" | "passive";

interface HeroSelectedSkillRef {
  kind: HeroSkillKind;
  index: number;
  id: string;
  name: string;
}

export interface HeroSkillOptionSet {
  talents: BattleTalentDefinition[];
  activeSkills: BattleActiveSkillDefinition[];
  passiveSkills: BattlePassiveSkillDefinition[];
}

export interface HeroLearnedSkillSet {
  talentIds?: string[] | null;
  activeSkillIds?: string[] | null;
  passiveSkillIds?: string[] | null;
}

export interface NormalizeHeroLoadoutResult {
  loadout: BattleLoadout;
  issues: string[];
}

export interface BattleLoadoutImportMeta {
  sourceHeroId: string | null;
  sourceHeroName: string | null;
  sourceHeroClass: HeroClass | null;
}

export interface BattleLoadoutImportResult {
  loadout: BattleLoadout;
  meta: BattleLoadoutImportMeta;
}

interface BattleLoadoutPayload {
  version: 1;
  sourceHeroId: string;
  sourceHeroName: string;
  sourceHeroClass: HeroClass;
  loadout: BattleLoadout;
}

function normalizePool(pool: BattleSkillPool | undefined): BattleSkillPool {
  return pool ?? "common";
}

function isSelectableForHeroClass(
  definition: { skillPool?: BattleSkillPool; allowedHeroClasses?: HeroClass[] },
  heroClass: HeroClass
): boolean {
  if (normalizePool(definition.skillPool) === "enemy") {
    return false;
  }
  if (!definition.allowedHeroClasses) {
    return true;
  }
  return definition.allowedHeroClasses.includes(heroClass);
}

function normalizeSlotSkillId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function ensureSkillSlots(slots: Array<string | null>): Array<string | null> {
  const next: Array<string | null> = slots.slice(0, HERO_SKILL_SLOT_COUNT).map((item) => normalizeSlotSkillId(item));
  while (next.length < HERO_SKILL_SLOT_COUNT) {
    next.push(null);
  }
  return next;
}

function ensureObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("导入失败：配置内容不是有效对象。");
  }
  return value as Record<string, unknown>;
}

function findSkillConflict(
  left: HeroSelectableSkill | undefined,
  right: HeroSelectableSkill | undefined,
  rightId: string
): boolean {
  if (!left || !right) {
    return false;
  }
  return (left.conflictSkillIds ?? []).includes(rightId) || (right.conflictSkillIds ?? []).includes(left.id);
}

function refLabel(ref: HeroSelectedSkillRef): string {
  if (ref.kind === "talent") {
    return "天赋槽位";
  }
  return ref.kind === "active" ? `主动槽 A${ref.index + 1}` : `被动槽 P${ref.index + 1}`;
}

export function ensureBattleLoadoutShape(loadout: BattleLoadout): BattleLoadout {
  return {
    talentSlot: normalizeSlotSkillId(loadout.talentSlot),
    activeSlots: ensureSkillSlots(loadout.activeSlots),
    passiveSlots: ensureSkillSlots(loadout.passiveSlots)
  };
}

function normalizeLearnedSkillSet(learnedSkills?: HeroLearnedSkillSet): {
  talentIds: Set<string> | null;
  activeSkillIds: Set<string> | null;
  passiveSkillIds: Set<string> | null;
} {
  const toSet = (input?: string[] | null): Set<string> | null => {
    if (!Array.isArray(input)) {
      return null;
    }
    return new Set(input.filter((item): item is string => typeof item === "string" && item.length > 0));
  };
  return {
    talentIds: toSet(learnedSkills?.talentIds),
    activeSkillIds: toSet(learnedSkills?.activeSkillIds),
    passiveSkillIds: toSet(learnedSkills?.passiveSkillIds)
  };
}

export function getHeroSkillOptions(heroClass: HeroClass, learnedSkills?: HeroLearnedSkillSet): HeroSkillOptionSet {
  const learned = normalizeLearnedSkillSet(learnedSkills);
  return {
    talents: Object.values(battleTalents).filter(
      (skill) => isSelectableForHeroClass(skill, heroClass) && (!learned.talentIds || learned.talentIds.has(skill.id))
    ),
    activeSkills: Object.values(battleActiveSkills).filter(
      (skill) => isSelectableForHeroClass(skill, heroClass) && (!learned.activeSkillIds || learned.activeSkillIds.has(skill.id))
    ),
    passiveSkills: Object.values(battlePassiveSkills).filter(
      (skill) => isSelectableForHeroClass(skill, heroClass) && (!learned.passiveSkillIds || learned.passiveSkillIds.has(skill.id))
    )
  };
}

export function normalizeHeroLoadout(
  heroClass: HeroClass,
  loadout: BattleLoadout,
  fallbackTalentId: string | null,
  learnedSkills?: HeroLearnedSkillSet
): NormalizeHeroLoadoutResult {
  const issues: string[] = [];
  const shaped = ensureBattleLoadoutShape(loadout);
  const options = getHeroSkillOptions(heroClass, learnedSkills);
  const talentMap = new Map(options.talents.map((skill) => [skill.id, skill]));
  const activeMap = new Map(options.activeSkills.map((skill) => [skill.id, skill]));
  const passiveMap = new Map(options.passiveSkills.map((skill) => [skill.id, skill]));

  let talentSlot = shaped.talentSlot;
  if (talentSlot && !talentMap.has(talentSlot)) {
    const originName = battleTalents[talentSlot]?.name ?? talentSlot;
    issues.push(`天赋 ${originName} 不在当前可用列表（职业/已学限制），已移除。`);
    talentSlot = null;
  }

  if (!talentSlot) {
    const fallback = fallbackTalentId && talentMap.has(fallbackTalentId) ? fallbackTalentId : options.talents[0]?.id ?? null;
    if (fallback) {
      talentSlot = fallback;
      const fallbackName = battleTalents[fallback]?.name ?? fallback;
      issues.push(`天赋槽位不可为空，已自动回填为 ${fallbackName}。`);
    }
  }

  const activeSeen = new Set<string>();
  const activeSlots = shaped.activeSlots.map((skillId, index) => {
    if (!skillId) {
      return null;
    }
    const found = activeMap.get(skillId);
    if (!found) {
      const originName = battleActiveSkills[skillId]?.name ?? skillId;
      issues.push(`主动槽 A${index + 1} 的技能 ${originName} 不在当前可用列表（职业/已学限制），已移除。`);
      return null;
    }
    if (activeSeen.has(skillId)) {
      issues.push(`主动技能 ${found.name} 重复配置，已清空主动槽 A${index + 1}。`);
      return null;
    }
    activeSeen.add(skillId);
    return skillId;
  });

  const passiveSeen = new Set<string>();
  const passiveSlots = shaped.passiveSlots.map((skillId, index) => {
    if (!skillId) {
      return null;
    }
    const found = passiveMap.get(skillId);
    if (!found) {
      const originName = battlePassiveSkills[skillId]?.name ?? skillId;
      issues.push(`被动槽 P${index + 1} 的技能 ${originName} 不在当前可用列表（职业/已学限制），已移除。`);
      return null;
    }
    if (passiveSeen.has(skillId)) {
      issues.push(`被动技能 ${found.name} 重复配置，已清空被动槽 P${index + 1}。`);
      return null;
    }
    passiveSeen.add(skillId);
    return skillId;
  });

  const skillMap = new Map<string, HeroSelectableSkill>();
  options.talents.forEach((skill) => skillMap.set(skill.id, skill));
  options.activeSkills.forEach((skill) => skillMap.set(skill.id, skill));
  options.passiveSkills.forEach((skill) => skillMap.set(skill.id, skill));

  const selectedRefs: HeroSelectedSkillRef[] = [];
  if (talentSlot) {
    const found = skillMap.get(talentSlot);
    if (found) {
      selectedRefs.push({ kind: "talent", index: 0, id: found.id, name: found.name });
    }
  }
  activeSlots.forEach((skillId, index) => {
    if (!skillId) {
      return;
    }
    const found = skillMap.get(skillId);
    if (found) {
      selectedRefs.push({ kind: "active", index, id: found.id, name: found.name });
    }
  });
  passiveSlots.forEach((skillId, index) => {
    if (!skillId) {
      return;
    }
    const found = skillMap.get(skillId);
    if (found) {
      selectedRefs.push({ kind: "passive", index, id: found.id, name: found.name });
    }
  });

  const accepted: HeroSelectedSkillRef[] = [];
  selectedRefs.forEach((current) => {
    const conflict = accepted.find((previous) =>
      findSkillConflict(skillMap.get(previous.id), skillMap.get(current.id), current.id)
    );
    if (!conflict) {
      accepted.push(current);
      return;
    }

    if (current.kind === "talent") {
      talentSlot = null;
    } else if (current.kind === "active") {
      activeSlots[current.index] = null;
    } else {
      passiveSlots[current.index] = null;
    }

    issues.push(`技能冲突：${current.name} 与 ${conflict.name} 不能同时配置，已清空${refLabel(current)}。`);
  });

  if (!talentSlot) {
    const fallback = fallbackTalentId && talentMap.has(fallbackTalentId) ? fallbackTalentId : options.talents[0]?.id ?? null;
    if (fallback) {
      talentSlot = fallback;
      const fallbackName = battleTalents[fallback]?.name ?? fallback;
      issues.push(`天赋槽位不可为空，已自动回填为 ${fallbackName}。`);
    }
  }

  return {
    loadout: {
      talentSlot,
      activeSlots,
      passiveSlots
    },
    issues
  };
}

export function serializeHeroLoadout(
  heroId: string,
  heroName: string,
  heroClass: HeroClass,
  loadout: BattleLoadout
): string {
  const payload: BattleLoadoutPayload = {
    version: 1,
    sourceHeroId: heroId,
    sourceHeroName: heroName,
    sourceHeroClass: heroClass,
    loadout: ensureBattleLoadoutShape(loadout)
  };
  return JSON.stringify(payload, null, 2);
}

export function parseHeroLoadoutImport(input: string): BattleLoadoutImportResult {
  const text = input.trim();
  if (!text) {
    throw new Error("导入失败：请输入配置文本。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("导入失败：配置不是合法 JSON。");
  }

  const root = ensureObject(parsed);
  const nestedLoadout = root.loadout;
  const loadoutSource =
    nestedLoadout && typeof nestedLoadout === "object" && !Array.isArray(nestedLoadout)
      ? (nestedLoadout as Record<string, unknown>)
      : root;

  const talentSlot = normalizeSlotSkillId(loadoutSource.talentSlot);
  const activeInput = Array.isArray(loadoutSource.activeSlots) ? loadoutSource.activeSlots : [];
  const passiveInput = Array.isArray(loadoutSource.passiveSlots) ? loadoutSource.passiveSlots : [];

  const loadout = ensureBattleLoadoutShape({
    talentSlot,
    activeSlots: activeInput.map((value) => normalizeSlotSkillId(value)),
    passiveSlots: passiveInput.map((value) => normalizeSlotSkillId(value))
  });

  const sourceClassRaw = root.sourceHeroClass;
  const sourceHeroClass =
    typeof sourceClassRaw === "string" && HERO_CLASSES.includes(sourceClassRaw as HeroClass)
      ? (sourceClassRaw as HeroClass)
      : null;

  return {
    loadout,
    meta: {
      sourceHeroId: typeof root.sourceHeroId === "string" ? root.sourceHeroId : null,
      sourceHeroName: typeof root.sourceHeroName === "string" ? root.sourceHeroName : null,
      sourceHeroClass
    }
  };
}
