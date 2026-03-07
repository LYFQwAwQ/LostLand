import type { Hero, NodeArchetype } from "../types/game";
import type { BattleFormationSlot, BattleLoadout, BattleUnitTemplate } from "../types/battle";

export const BATTLE_MAX_TEAM_SIZE = 6;
export const BATTLE_LINE_SIZE = 3;

function createSkillSlots(skillIds: Array<string | null>): Array<string | null> {
  const result = skillIds.slice(0, 10);
  while (result.length < 10) {
    result.push(null);
  }
  return result;
}

export function createBattleLoadout(
  talentSlot: string | null,
  activeSlots: Array<string | null>,
  passiveSlots: Array<string | null>
): BattleLoadout {
  return {
    talentSlot,
    activeSlots: createSkillSlots(activeSlots),
    passiveSlots: createSkillSlots(passiveSlots)
  };
}

export function getDefaultHeroLoadout(hero: Hero): BattleLoadout {
  if (hero.heroClass === "paladin") {
    return createBattleLoadout(
      "talent_oathbound_guard",
      [
        "paladin_holy_blade",
        "paladin_shield_slam",
        "paladin_war_provoke",
        "paladin_bulwark_vow",
        "paladin_prayer",
        "paladin_command",
        "basic_attack"
      ],
      ["passive_plate_mastery", "passive_resolute_heart"]
    );
  }

  return createBattleLoadout(
    "talent_starweaver",
    [
      "mage_flame_wave",
      "mage_arcane_bolt",
      "mage_frost_nova",
      "mage_null_field",
      "mage_clear_mind",
      "mage_mana_current",
      "mage_emergency_barrier"
    ],
    ["passive_arcane_flow", "passive_frost_focus"]
  );
}

interface EnemyPrototype {
  id: string;
  name: string;
  baseLevel: number;
  slotHint: BattleFormationSlot["line"];
  stats: {
    maxHp: number;
    maxMp: number;
    str: number;
    int: number;
    agi: number;
    def: number;
    critRate: number;
    critDamage: number;
    evasion: number;
    aggro: number;
    lifeSteal: number;
    thorns: number;
    damageBoost: number;
    damageReduction: number;
    elementalPierce: number;
    allRes: number;
    allBoost: number;
  };
  elementBoost?: Partial<Record<"fire" | "water" | "ice" | "wind" | "life" | "light" | "undead" | "dark", number>>;
  elementRes?: Partial<Record<"fire" | "water" | "ice" | "wind" | "life" | "light" | "undead" | "dark", number>>;
  loadout: BattleLoadout;
}

function hashNumber(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    value = (value << 5) - value + text.charCodeAt(index);
    value |= 0;
  }
  return Math.abs(value);
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967295;
  };
}

const ENEMY_POOL: EnemyPrototype[] = [
  {
    id: "beast-hound",
    name: "裂齿猎犬",
    baseLevel: 6,
    slotHint: "front",
    stats: {
      maxHp: 1200,
      maxMp: 220,
      str: 96,
      int: 46,
      agi: 136,
      def: 88,
      critRate: 0.08,
      critDamage: 1.55,
      evasion: 0.06,
      aggro: 90,
      lifeSteal: 0.02,
      thorns: 0,
      damageBoost: 0.04,
      damageReduction: 0.02,
      elementalPierce: 0.02,
      allRes: 0.02,
      allBoost: 0.03
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "beast-spewer",
    name: "腐沼喷吐者",
    baseLevel: 7,
    slotHint: "back",
    stats: {
      maxHp: 980,
      maxMp: 320,
      str: 68,
      int: 104,
      agi: 118,
      def: 74,
      critRate: 0.06,
      critDamage: 1.5,
      evasion: 0.04,
      aggro: 72,
      lifeSteal: 0,
      thorns: 0,
      damageBoost: 0.05,
      damageReduction: 0.01,
      elementalPierce: 0.05,
      allRes: 0.02,
      allBoost: 0.04
    },
    elementBoost: { dark: 0.1 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "beast-brute",
    name: "荆棘蛮兽",
    baseLevel: 8,
    slotHint: "front",
    stats: {
      maxHp: 1680,
      maxMp: 180,
      str: 124,
      int: 38,
      agi: 102,
      def: 126,
      critRate: 0.05,
      critDamage: 1.45,
      evasion: 0.03,
      aggro: 116,
      lifeSteal: 0,
      thorns: 0.08,
      damageBoost: 0.03,
      damageReduction: 0.05,
      elementalPierce: 0.01,
      allRes: 0.04,
      allBoost: 0.03
    },
    elementRes: { wind: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "beast-priest",
    name: "荒原祭师",
    baseLevel: 9,
    slotHint: "back",
    stats: {
      maxHp: 1080,
      maxMp: 420,
      str: 62,
      int: 126,
      agi: 96,
      def: 82,
      critRate: 0.07,
      critDamage: 1.55,
      evasion: 0.05,
      aggro: 68,
      lifeSteal: 0,
      thorns: 0,
      damageBoost: 0.06,
      damageReduction: 0.02,
      elementalPierce: 0.06,
      allRes: 0.03,
      allBoost: 0.06
    },
    elementBoost: { dark: 0.12, water: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  }
];

function resolveEnemyCount(archetype: NodeArchetype, random: () => number): number {
  if (archetype === "BL1") {
    return 2 + Math.floor(random() * 2);
  }
  if (archetype === "BL2") {
    return 3 + Math.floor(random() * 2);
  }
  return 4 + Math.floor(random() * 3);
}

function levelBonusByArchetype(archetype: NodeArchetype): number {
  if (archetype === "BL1") {
    return 0;
  }
  if (archetype === "BL2") {
    return 2;
  }
  return 4;
}

export function buildEnemyTeam(nodeId: string, archetype: NodeArchetype, suppression: number): BattleUnitTemplate[] {
  const random = createRandom(hashNumber(`${nodeId}-${archetype}-${suppression}`));
  const count = resolveEnemyCount(archetype, random);
  const templates: BattleUnitTemplate[] = [];
  const frontIndices: Array<0 | 1 | 2> = [0, 1, 2];
  const backIndices: Array<0 | 1 | 2> = [0, 1, 2];
  const suppressionLevel = Math.max(0, Math.floor(suppression / 20));

  for (let unitIndex = 0; unitIndex < count; unitIndex += 1) {
    const prototype = ENEMY_POOL[Math.floor(random() * ENEMY_POOL.length)];
    const preferFront = prototype.slotHint === "front";
    const canFront = frontIndices.length > 0;
    const canBack = backIndices.length > 0;
    const line = preferFront
      ? canFront
        ? "front"
        : "back"
      : canBack
      ? "back"
      : "front";
    const indexPool = line === "front" ? frontIndices : backIndices;
    const index = indexPool.shift() ?? 0;
    const level = prototype.baseLevel + levelBonusByArchetype(archetype) + suppressionLevel;
    const hpScale = 1 + level * 0.075;
    const statScale = 1 + level * 0.052;

    templates.push({
      id: `${prototype.id}-${unitIndex + 1}`,
      name: `${prototype.name} Lv.${level}`,
      side: "enemy",
      level,
      slot: { line, index },
      tags: [archetype, `enemy:${prototype.id}`],
      baseStats: {
        maxHp: Math.round(prototype.stats.maxHp * hpScale),
        maxMp: Math.round(prototype.stats.maxMp * (1 + level * 0.03)),
        str: Math.round(prototype.stats.str * statScale),
        int: Math.round(prototype.stats.int * statScale),
        agi: Math.round(prototype.stats.agi * statScale),
        def: Math.round(prototype.stats.def * statScale),
        critRate: prototype.stats.critRate,
        critDamage: prototype.stats.critDamage,
        evasion: prototype.stats.evasion,
        aggro: prototype.stats.aggro,
        lifeSteal: prototype.stats.lifeSteal,
        thorns: prototype.stats.thorns,
        damageBoost: prototype.stats.damageBoost,
        damageReduction: prototype.stats.damageReduction,
        elementalPierce: prototype.stats.elementalPierce,
        allRes: prototype.stats.allRes,
        allBoost: prototype.stats.allBoost,
        elementBoost: prototype.elementBoost,
        elementRes: prototype.elementRes
      },
      loadout: prototype.loadout
    });
  }

  return templates;
}

