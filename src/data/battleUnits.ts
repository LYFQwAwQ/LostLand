import { getFixedNodeBattleConfig } from "./fixedRegionTopologies";
import type { EquipmentQuality, Hero, NodeArchetype, NodeBattleConfig, NodeEnemyCountDistribution } from "../types/game";
import type { BattleElement, BattleFormationSlot, BattleLoadout, BattleUnitTemplate } from "../types/battle";

export const BATTLE_MAX_TEAM_SIZE = 6;
export const BATTLE_LINE_SIZE = 3;

export type EnemyRace = "beast" | "undead" | "human" | "aberrant";
export type EnemyRarityTier = "common" | "elite" | "champion" | "lord" | "calamity";

interface EnemyPrototype {
  id: string;
  name: string;
  race: EnemyRace;
  rarityTier: EnemyRarityTier;
  lootQualityTier?: EquipmentQuality;
  encounterWeight?: number;
  difficultyMultiplier?: number;
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
  elementBoost?: Partial<Record<BattleElement, number>>;
  elementRes?: Partial<Record<BattleElement, number>>;
  loadout: BattleLoadout;
}

export interface EnemyPrototypeCatalogEntry {
  id: string;
  name: string;
  race: EnemyRace;
  rarityTier: EnemyRarityTier;
  lootQualityTier: EquipmentQuality;
  encounterWeight: number;
  difficultyMultiplier: number;
  baseLevel: number;
  slotHint: BattleFormationSlot["line"];
}

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
  if (hero.loadoutPreset) {
    return createBattleLoadout(
      hero.loadoutPreset.talentId,
      hero.loadoutPreset.activeSkillIds,
      hero.loadoutPreset.passiveSkillIds
    );
  }

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

  if (hero.heroClass === "mage") {
    return createBattleLoadout(
      "talent_starweaver",
      [
        "mage_flame_wave",
        "mage_arcane_bolt",
        "mage_frost_nova",
        "mage_null_field",
        "mage_clear_mind",
        "mage_mana_current",
        "mage_emergency_barrier",
        "basic_attack"
      ],
      ["passive_arcane_flow", "passive_frost_focus"]
    );
  }

  if (hero.heroClass === "priest") {
    return createBattleLoadout(
      "talent_priest_life_choir",
      [
        "priest_spirit_lance",
        "priest_emerald_tide",
        "priest_ward_prayer",
        "priest_seed_of_wither",
        "priest_blessing_hymn",
        "priest_healing_rite",
        "basic_attack"
      ],
      ["passive_bloom_focus", "passive_sacred_vessel"]
    );
  }

  return createBattleLoadout(
    "talent_wind_trace_hunter",
    [
      "ranger_quick_shot",
      "ranger_split_arrow",
      "ranger_crippling_trap",
      "ranger_hawk_signal",
      "ranger_smoke_step",
      "ranger_field_mend",
      "basic_attack"
    ],
    ["passive_keen_eye", "passive_fleet_foot"]
  );
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

const CORE_ENEMY_POOL: EnemyPrototype[] = [
  {
    id: "undead-grave-scout",
    name: "墓穴侦猎者",
    race: "undead",
    rarityTier: "common",
    baseLevel: 6,
    slotHint: "front",
    stats: {
      maxHp: 1180,
      maxMp: 260,
      str: 94,
      int: 52,
      agi: 132,
      def: 82,
      critRate: 0.08,
      critDamage: 1.5,
      evasion: 0.07,
      aggro: 88,
      lifeSteal: 0.01,
      thorns: 0,
      damageBoost: 0.04,
      damageReduction: 0.01,
      elementalPierce: 0.03,
      allRes: 0.02,
      allBoost: 0.03
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "undead-bone-guard",
    name: "白骨守御者",
    race: "undead",
    rarityTier: "elite",
    baseLevel: 8,
    slotHint: "front",
    stats: {
      maxHp: 1680,
      maxMp: 220,
      str: 116,
      int: 62,
      agi: 92,
      def: 128,
      critRate: 0.05,
      critDamage: 1.42,
      evasion: 0.03,
      aggro: 126,
      lifeSteal: 0,
      thorns: 0.06,
      damageBoost: 0.03,
      damageReduction: 0.05,
      elementalPierce: 0.02,
      allRes: 0.05,
      allBoost: 0.03
    },
    elementRes: { undead: 0.1, dark: 0.06 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "undead-ritual-adept",
    name: "遗灰祭司",
    race: "undead",
    rarityTier: "champion",
    baseLevel: 9,
    slotHint: "back",
    stats: {
      maxHp: 1060,
      maxMp: 460,
      str: 58,
      int: 132,
      agi: 98,
      def: 78,
      critRate: 0.07,
      critDamage: 1.58,
      evasion: 0.05,
      aggro: 70,
      lifeSteal: 0,
      thorns: 0,
      damageBoost: 0.06,
      damageReduction: 0.02,
      elementalPierce: 0.07,
      allRes: 0.03,
      allBoost: 0.06
    },
    elementBoost: { dark: 0.14, undead: 0.1 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "undead-crypt-howler",
    name: "地窖啸魂犬",
    race: "undead",
    rarityTier: "common",
    baseLevel: 7,
    slotHint: "front",
    stats: {
      maxHp: 1240,
      maxMp: 210,
      str: 102,
      int: 46,
      agi: 138,
      def: 84,
      critRate: 0.09,
      critDamage: 1.54,
      evasion: 0.08,
      aggro: 90,
      lifeSteal: 0.01,
      thorns: 0,
      damageBoost: 0.05,
      damageReduction: 0.01,
      elementalPierce: 0.04,
      allRes: 0.02,
      allBoost: 0.03
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_rush", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "undead-plague-hound",
    name: "疫痕骸狼",
    race: "undead",
    rarityTier: "elite",
    baseLevel: 8,
    slotHint: "front",
    stats: {
      maxHp: 1460,
      maxMp: 240,
      str: 114,
      int: 66,
      agi: 124,
      def: 102,
      critRate: 0.08,
      critDamage: 1.55,
      evasion: 0.06,
      aggro: 104,
      lifeSteal: 0.02,
      thorns: 0.01,
      damageBoost: 0.05,
      damageReduction: 0.03,
      elementalPierce: 0.05,
      allRes: 0.03,
      allBoost: 0.04
    },
    elementBoost: { dark: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "undead-grave-warden",
    name: "古墓监守",
    race: "undead",
    rarityTier: "champion",
    baseLevel: 10,
    slotHint: "front",
    stats: {
      maxHp: 1860,
      maxMp: 260,
      str: 126,
      int: 72,
      agi: 96,
      def: 146,
      critRate: 0.05,
      critDamage: 1.45,
      evasion: 0.03,
      aggro: 136,
      lifeSteal: 0,
      thorns: 0.08,
      damageBoost: 0.04,
      damageReduction: 0.07,
      elementalPierce: 0.03,
      allRes: 0.06,
      allBoost: 0.03
    },
    elementRes: { undead: 0.12, dark: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "undead-abyss-liturgist",
    name: "深渊咏祭者",
    race: "undead",
    rarityTier: "lord",
    baseLevel: 11,
    slotHint: "back",
    stats: {
      maxHp: 1380,
      maxMp: 560,
      str: 74,
      int: 164,
      agi: 118,
      def: 96,
      critRate: 0.09,
      critDamage: 1.66,
      evasion: 0.07,
      aggro: 82,
      lifeSteal: 0,
      thorns: 0.01,
      damageBoost: 0.09,
      damageReduction: 0.03,
      elementalPierce: 0.1,
      allRes: 0.05,
      allBoost: 0.08
    },
    elementBoost: { dark: 0.16, undead: 0.12 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "undead-throne-revenant",
    name: "王座复生者",
    race: "undead",
    rarityTier: "calamity",
    baseLevel: 13,
    slotHint: "front",
    stats: {
      maxHp: 2260,
      maxMp: 420,
      str: 158,
      int: 112,
      agi: 108,
      def: 174,
      critRate: 0.08,
      critDamage: 1.68,
      evasion: 0.04,
      aggro: 154,
      lifeSteal: 0.02,
      thorns: 0.12,
      damageBoost: 0.1,
      damageReduction: 0.1,
      elementalPierce: 0.08,
      allRes: 0.09,
      allBoost: 0.07
    },
    elementBoost: { dark: 0.14, undead: 0.14 },
    elementRes: { dark: 0.12, undead: 0.14, light: 0.06 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "beast-razorwolf",
    name: "裂刃狼",
    race: "beast",
    rarityTier: "common",
    baseLevel: 6,
    slotHint: "front",
    stats: {
      maxHp: 1220,
      maxMp: 200,
      str: 98,
      int: 44,
      agi: 140,
      def: 86,
      critRate: 0.09,
      critDamage: 1.56,
      evasion: 0.08,
      aggro: 92,
      lifeSteal: 0.02,
      thorns: 0,
      damageBoost: 0.04,
      damageReduction: 0.02,
      elementalPierce: 0.03,
      allRes: 0.02,
      allBoost: 0.03
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "beast-ironboar",
    name: "铁鬃獠牙兽",
    race: "beast",
    rarityTier: "elite",
    baseLevel: 8,
    slotHint: "front",
    stats: {
      maxHp: 1740,
      maxMp: 160,
      str: 126,
      int: 34,
      agi: 96,
      def: 132,
      critRate: 0.05,
      critDamage: 1.44,
      evasion: 0.02,
      aggro: 130,
      lifeSteal: 0,
      thorns: 0.08,
      damageBoost: 0.03,
      damageReduction: 0.06,
      elementalPierce: 0.01,
      allRes: 0.05,
      allBoost: 0.03
    },
    elementRes: { wind: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_rush", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "beast-mire-vulture",
    name: "腐沼秃鹫",
    race: "beast",
    rarityTier: "champion",
    baseLevel: 7,
    slotHint: "back",
    stats: {
      maxHp: 980,
      maxMp: 340,
      str: 72,
      int: 104,
      agi: 126,
      def: 72,
      critRate: 0.07,
      critDamage: 1.52,
      evasion: 0.06,
      aggro: 74,
      lifeSteal: 0,
      thorns: 0,
      damageBoost: 0.05,
      damageReduction: 0.01,
      elementalPierce: 0.05,
      allRes: 0.02,
      allBoost: 0.04
    },
    elementBoost: { dark: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "beast-bristlemaw",
    name: "鬃棘裂颚",
    race: "beast",
    rarityTier: "common",
    baseLevel: 7,
    slotHint: "front",
    stats: {
      maxHp: 1320,
      maxMp: 180,
      str: 106,
      int: 38,
      agi: 122,
      def: 94,
      critRate: 0.08,
      critDamage: 1.52,
      evasion: 0.05,
      aggro: 96,
      lifeSteal: 0.01,
      thorns: 0,
      damageBoost: 0.05,
      damageReduction: 0.02,
      elementalPierce: 0.03,
      allRes: 0.02,
      allBoost: 0.03
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_rush", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "beast-rift-stalker",
    name: "裂隙潜猎者",
    race: "beast",
    rarityTier: "elite",
    baseLevel: 9,
    slotHint: "back",
    stats: {
      maxHp: 1210,
      maxMp: 300,
      str: 92,
      int: 92,
      agi: 146,
      def: 84,
      critRate: 0.1,
      critDamage: 1.62,
      evasion: 0.08,
      aggro: 76,
      lifeSteal: 0.01,
      thorns: 0,
      damageBoost: 0.08,
      damageReduction: 0.02,
      elementalPierce: 0.07,
      allRes: 0.03,
      allBoost: 0.05
    },
    elementBoost: { wind: 0.09 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "beast-thunder-antler",
    name: "雷角魁兽",
    race: "beast",
    rarityTier: "champion",
    baseLevel: 10,
    slotHint: "front",
    stats: {
      maxHp: 1880,
      maxMp: 220,
      str: 136,
      int: 54,
      agi: 108,
      def: 146,
      critRate: 0.06,
      critDamage: 1.5,
      evasion: 0.03,
      aggro: 138,
      lifeSteal: 0,
      thorns: 0.08,
      damageBoost: 0.05,
      damageReduction: 0.07,
      elementalPierce: 0.03,
      allRes: 0.06,
      allBoost: 0.04
    },
    elementRes: { wind: 0.12 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_rush", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "beast-tidefang-lord",
    name: "潮牙领主",
    race: "beast",
    rarityTier: "lord",
    baseLevel: 12,
    slotHint: "front",
    stats: {
      maxHp: 2140,
      maxMp: 260,
      str: 148,
      int: 72,
      agi: 114,
      def: 158,
      critRate: 0.07,
      critDamage: 1.62,
      evasion: 0.04,
      aggro: 146,
      lifeSteal: 0.02,
      thorns: 0.1,
      damageBoost: 0.08,
      damageReduction: 0.09,
      elementalPierce: 0.05,
      allRes: 0.07,
      allBoost: 0.06
    },
    elementBoost: { water: 0.1 },
    elementRes: { water: 0.1, wind: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_rush", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "beast-ashen-behemoth",
    name: "烬骨巨魇",
    race: "beast",
    rarityTier: "calamity",
    baseLevel: 13,
    slotHint: "front",
    stats: {
      maxHp: 2480,
      maxMp: 220,
      str: 170,
      int: 66,
      agi: 98,
      def: 182,
      critRate: 0.06,
      critDamage: 1.7,
      evasion: 0.03,
      aggro: 164,
      lifeSteal: 0.02,
      thorns: 0.13,
      damageBoost: 0.1,
      damageReduction: 0.11,
      elementalPierce: 0.06,
      allRes: 0.09,
      allBoost: 0.07
    },
    elementBoost: { fire: 0.12 },
    elementRes: { fire: 0.12, wind: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "human-road-rogue",
    name: "荒路劫掠者",
    race: "human",
    rarityTier: "common",
    baseLevel: 6,
    slotHint: "front",
    stats: {
      maxHp: 1260,
      maxMp: 220,
      str: 102,
      int: 48,
      agi: 128,
      def: 90,
      critRate: 0.08,
      critDamage: 1.5,
      evasion: 0.05,
      aggro: 96,
      lifeSteal: 0.01,
      thorns: 0,
      damageBoost: 0.04,
      damageReduction: 0.02,
      elementalPierce: 0.03,
      allRes: 0.02,
      allBoost: 0.03
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_rush", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "human-blacksmith-merc",
    name: "锻铁佣兵",
    race: "human",
    rarityTier: "elite",
    baseLevel: 8,
    slotHint: "front",
    stats: {
      maxHp: 1620,
      maxMp: 260,
      str: 118,
      int: 66,
      agi: 102,
      def: 118,
      critRate: 0.06,
      critDamage: 1.46,
      evasion: 0.04,
      aggro: 116,
      lifeSteal: 0,
      thorns: 0.03,
      damageBoost: 0.04,
      damageReduction: 0.04,
      elementalPierce: 0.03,
      allRes: 0.04,
      allBoost: 0.04
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "human-crossbow-hunter",
    name: "游击弩手",
    race: "human",
    rarityTier: "champion",
    baseLevel: 7,
    slotHint: "back",
    stats: {
      maxHp: 990,
      maxMp: 300,
      str: 78,
      int: 94,
      agi: 136,
      def: 74,
      critRate: 0.08,
      critDamage: 1.6,
      evasion: 0.07,
      aggro: 68,
      lifeSteal: 0,
      thorns: 0,
      damageBoost: 0.06,
      damageReduction: 0.01,
      elementalPierce: 0.05,
      allRes: 0.02,
      allBoost: 0.04
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "human-templar-warden",
    name: "誓卫骑士",
    race: "human",
    rarityTier: "lord",
    baseLevel: 9,
    slotHint: "front",
    stats: {
      maxHp: 1780,
      maxMp: 280,
      str: 124,
      int: 72,
      agi: 92,
      def: 136,
      critRate: 0.05,
      critDamage: 1.48,
      evasion: 0.03,
      aggro: 136,
      lifeSteal: 0,
      thorns: 0.06,
      damageBoost: 0.04,
      damageReduction: 0.06,
      elementalPierce: 0.02,
      allRes: 0.05,
      allBoost: 0.04
    },
    elementRes: { light: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "human-border-lancer",
    name: "边陲枪骑",
    race: "human",
    rarityTier: "common",
    baseLevel: 7,
    slotHint: "front",
    stats: {
      maxHp: 1340,
      maxMp: 220,
      str: 108,
      int: 50,
      agi: 122,
      def: 98,
      critRate: 0.08,
      critDamage: 1.52,
      evasion: 0.05,
      aggro: 100,
      lifeSteal: 0.01,
      thorns: 0,
      damageBoost: 0.05,
      damageReduction: 0.03,
      elementalPierce: 0.04,
      allRes: 0.03,
      allBoost: 0.03
    },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_rush", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "human-sanctum-arcanist",
    name: "圣殿奥术师",
    race: "human",
    rarityTier: "champion",
    baseLevel: 10,
    slotHint: "back",
    stats: {
      maxHp: 1260,
      maxMp: 520,
      str: 70,
      int: 158,
      agi: 112,
      def: 92,
      critRate: 0.09,
      critDamage: 1.64,
      evasion: 0.06,
      aggro: 80,
      lifeSteal: 0,
      thorns: 0,
      damageBoost: 0.09,
      damageReduction: 0.03,
      elementalPierce: 0.1,
      allRes: 0.05,
      allBoost: 0.08
    },
    elementBoost: { light: 0.12, fire: 0.06 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "human-iron-banner-captain",
    name: "铁旗统领",
    race: "human",
    rarityTier: "lord",
    baseLevel: 11,
    slotHint: "front",
    stats: {
      maxHp: 2060,
      maxMp: 300,
      str: 146,
      int: 86,
      agi: 106,
      def: 164,
      critRate: 0.06,
      critDamage: 1.56,
      evasion: 0.04,
      aggro: 150,
      lifeSteal: 0.01,
      thorns: 0.08,
      damageBoost: 0.07,
      damageReduction: 0.09,
      elementalPierce: 0.05,
      allRes: 0.08,
      allBoost: 0.06
    },
    elementRes: { light: 0.1 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "human-gloom-inquisitor",
    name: "幽律审判官",
    race: "human",
    rarityTier: "elite",
    baseLevel: 9,
    slotHint: "back",
    stats: {
      maxHp: 1320,
      maxMp: 380,
      str: 88,
      int: 126,
      agi: 118,
      def: 98,
      critRate: 0.08,
      critDamage: 1.58,
      evasion: 0.05,
      aggro: 90,
      lifeSteal: 0,
      thorns: 0.01,
      damageBoost: 0.07,
      damageReduction: 0.03,
      elementalPierce: 0.08,
      allRes: 0.04,
      allBoost: 0.06
    },
    elementBoost: { dark: 0.1, light: 0.06 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "human-crowned-executor",
    name: "冠冕行刑官",
    race: "human",
    rarityTier: "calamity",
    baseLevel: 13,
    slotHint: "front",
    stats: {
      maxHp: 2380,
      maxMp: 360,
      str: 166,
      int: 102,
      agi: 114,
      def: 178,
      critRate: 0.08,
      critDamage: 1.72,
      evasion: 0.04,
      aggro: 160,
      lifeSteal: 0.02,
      thorns: 0.1,
      damageBoost: 0.1,
      damageReduction: 0.1,
      elementalPierce: 0.08,
      allRes: 0.09,
      allBoost: 0.08
    },
    elementBoost: { light: 0.1, dark: 0.08 },
    elementRes: { light: 0.12, dark: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  }
];

const ABERRANT_ENEMY_POOL: EnemyPrototype[] = [
  {
    id: "aberrant-spore-drone",
    name: "孢刺异蜂",
    race: "aberrant",
    rarityTier: "common",
    baseLevel: 7,
    slotHint: "back",
    stats: {
      maxHp: 1360,
      maxMp: 260,
      str: 108,
      int: 76,
      agi: 146,
      def: 94,
      critRate: 0.09,
      critDamage: 1.56,
      evasion: 0.08,
      aggro: 86,
      lifeSteal: 0.01,
      thorns: 0,
      damageBoost: 0.06,
      damageReduction: 0.02,
      elementalPierce: 0.06,
      allRes: 0.03,
      allBoost: 0.05
    },
    elementBoost: { dark: 0.08, wind: 0.05 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "aberrant-venom-howler",
    name: "毒针嚎狼",
    race: "aberrant",
    rarityTier: "elite",
    baseLevel: 8,
    slotHint: "front",
    stats: {
      maxHp: 1620,
      maxMp: 250,
      str: 124,
      int: 84,
      agi: 132,
      def: 108,
      critRate: 0.09,
      critDamage: 1.6,
      evasion: 0.07,
      aggro: 112,
      lifeSteal: 0.02,
      thorns: 0.01,
      damageBoost: 0.07,
      damageReduction: 0.04,
      elementalPierce: 0.06,
      allRes: 0.04,
      allBoost: 0.05
    },
    elementBoost: { dark: 0.1 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "aberrant-chitin-guardian",
    name: "甲壳守巢兽",
    race: "aberrant",
    rarityTier: "champion",
    baseLevel: 9,
    slotHint: "front",
    stats: {
      maxHp: 1940,
      maxMp: 220,
      str: 132,
      int: 70,
      agi: 108,
      def: 154,
      critRate: 0.06,
      critDamage: 1.5,
      evasion: 0.04,
      aggro: 138,
      lifeSteal: 0,
      thorns: 0.1,
      damageBoost: 0.05,
      damageReduction: 0.08,
      elementalPierce: 0.04,
      allRes: 0.07,
      allBoost: 0.05
    },
    elementRes: { dark: 0.08, wind: 0.06 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "aberrant-mire-screamer",
    name: "泥沼尖啸体",
    race: "aberrant",
    rarityTier: "champion",
    baseLevel: 10,
    slotHint: "back",
    stats: {
      maxHp: 1480,
      maxMp: 500,
      str: 82,
      int: 154,
      agi: 126,
      def: 92,
      critRate: 0.09,
      critDamage: 1.64,
      evasion: 0.07,
      aggro: 88,
      lifeSteal: 0,
      thorns: 0,
      damageBoost: 0.1,
      damageReduction: 0.03,
      elementalPierce: 0.1,
      allRes: 0.05,
      allBoost: 0.08
    },
    elementBoost: { dark: 0.14, water: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "aberrant-carrion-seer",
    name: "食腐观测者",
    race: "aberrant",
    rarityTier: "elite",
    baseLevel: 9,
    slotHint: "back",
    stats: {
      maxHp: 1420,
      maxMp: 420,
      str: 90,
      int: 136,
      agi: 120,
      def: 102,
      critRate: 0.08,
      critDamage: 1.58,
      evasion: 0.06,
      aggro: 92,
      lifeSteal: 0,
      thorns: 0.01,
      damageBoost: 0.08,
      damageReduction: 0.04,
      elementalPierce: 0.08,
      allRes: 0.05,
      allBoost: 0.07
    },
    elementBoost: { dark: 0.12 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "aberrant-mutant-behemoth",
    name: "突变巨躯",
    race: "aberrant",
    rarityTier: "lord",
    baseLevel: 11,
    slotHint: "front",
    stats: {
      maxHp: 2260,
      maxMp: 260,
      str: 154,
      int: 82,
      agi: 102,
      def: 172,
      critRate: 0.07,
      critDamage: 1.64,
      evasion: 0.04,
      aggro: 156,
      lifeSteal: 0.02,
      thorns: 0.11,
      damageBoost: 0.08,
      damageReduction: 0.1,
      elementalPierce: 0.06,
      allRes: 0.08,
      allBoost: 0.07
    },
    elementBoost: { dark: 0.1, fire: 0.06 },
    elementRes: { dark: 0.1 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_claw", "enemy_rush"], ["passive_enemy_feral"])
  },
  {
    id: "aberrant-plague-harbinger",
    name: "疫潮先驱",
    race: "aberrant",
    rarityTier: "lord",
    baseLevel: 12,
    slotHint: "back",
    stats: {
      maxHp: 1660,
      maxMp: 620,
      str: 96,
      int: 176,
      agi: 124,
      def: 110,
      critRate: 0.1,
      critDamage: 1.68,
      evasion: 0.08,
      aggro: 94,
      lifeSteal: 0.01,
      thorns: 0.02,
      damageBoost: 0.12,
      damageReduction: 0.04,
      elementalPierce: 0.12,
      allRes: 0.06,
      allBoost: 0.1
    },
    elementBoost: { dark: 0.16, undead: 0.08 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_claw"], ["passive_enemy_feral"])
  },
  {
    id: "aberrant-void-hydra",
    name: "虚空九首蜥",
    race: "aberrant",
    rarityTier: "calamity",
    baseLevel: 13,
    slotHint: "front",
    stats: {
      maxHp: 2520,
      maxMp: 420,
      str: 174,
      int: 122,
      agi: 112,
      def: 188,
      critRate: 0.09,
      critDamage: 1.74,
      evasion: 0.05,
      aggro: 164,
      lifeSteal: 0.03,
      thorns: 0.13,
      damageBoost: 0.12,
      damageReduction: 0.12,
      elementalPierce: 0.1,
      allRes: 0.1,
      allBoost: 0.09
    },
    elementBoost: { dark: 0.18, water: 0.1 },
    elementRes: { dark: 0.14, water: 0.08, light: 0.04 },
    loadout: createBattleLoadout("talent_enemy_predator", ["enemy_poison_spit", "enemy_rush"], ["passive_enemy_feral"])
  }
];

const ENEMY_POOL: EnemyPrototype[] = [...CORE_ENEMY_POOL, ...ABERRANT_ENEMY_POOL];

const ENEMY_PROTOTYPE_BY_ID: Record<string, EnemyPrototype> = ENEMY_POOL.reduce<Record<string, EnemyPrototype>>((acc, prototype) => {
  acc[prototype.id] = prototype;
  return acc;
}, {});

export const ENEMY_RARITY_META: Record<
  EnemyRarityTier,
  { label: string; encounterWeight: number; difficultyMultiplier: number; lootQualityTier: EquipmentQuality }
> = {
  common: { label: "常见", encounterWeight: 100, difficultyMultiplier: 0, lootQualityTier: "common" },
  elite: { label: "精英", encounterWeight: 58, difficultyMultiplier: 0.08, lootQualityTier: "uncommon" },
  champion: { label: "强敌", encounterWeight: 28, difficultyMultiplier: 0.16, lootQualityTier: "rare" },
  lord: { label: "领主", encounterWeight: 10, difficultyMultiplier: 0.28, lootQualityTier: "epic" },
  calamity: { label: "灾厄", encounterWeight: 3, difficultyMultiplier: 0.42, lootQualityTier: "legendary" }
};

function resolveEncounterWeight(prototype: EnemyPrototype): number {
  return prototype.encounterWeight ?? ENEMY_RARITY_META[prototype.rarityTier].encounterWeight;
}

function resolveDifficultyMultiplier(prototype: EnemyPrototype): number {
  return prototype.difficultyMultiplier ?? ENEMY_RARITY_META[prototype.rarityTier].difficultyMultiplier;
}

function resolveLootQualityTier(prototype: EnemyPrototype): EquipmentQuality {
  return prototype.lootQualityTier ?? ENEMY_RARITY_META[prototype.rarityTier].lootQualityTier;
}

export const enemyPrototypeCatalog: EnemyPrototypeCatalogEntry[] = ENEMY_POOL.map((prototype) => ({
  id: prototype.id,
  name: prototype.name,
  race: prototype.race,
  rarityTier: prototype.rarityTier,
  lootQualityTier: resolveLootQualityTier(prototype),
  encounterWeight: resolveEncounterWeight(prototype),
  difficultyMultiplier: resolveDifficultyMultiplier(prototype),
  baseLevel: prototype.baseLevel,
  slotHint: prototype.slotHint
}));

export const enemyPrototypeById: Record<string, EnemyPrototypeCatalogEntry> = enemyPrototypeCatalog.reduce<
  Record<string, EnemyPrototypeCatalogEntry>
>((acc, entry) => {
  acc[entry.id] = entry;
  return acc;
}, {});

const NODE_RARITY_WEIGHT_FACTOR: Record<EnemyRarityTier, number> = {
  common: 1,
  elite: 0.62,
  champion: 0.34,
  lord: 0.17,
  calamity: 0.08
};

function sampleGaussian(random: () => number): number {
  let u = 0;
  let v = 0;
  while (u <= Number.EPSILON) {
    u = random();
  }
  while (v <= Number.EPSILON) {
    v = random();
  }
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function resolveEnemyCountByArchetype(archetype: NodeArchetype, random: () => number): number {
  if (archetype === "BL1") {
    return 2 + Math.floor(random() * 2);
  }
  if (archetype === "BL2") {
    return 3 + Math.floor(random() * 2);
  }
  return 4 + Math.floor(random() * 3);
}

function resolveEnemyCountByDistribution(distribution: NodeEnemyCountDistribution, random: () => number): number {
  const min = Math.max(1, Math.floor(Math.min(distribution.min, distribution.max)));
  const max = Math.max(min, Math.floor(Math.max(distribution.min, distribution.max)));
  const mean = Math.max(min, Math.min(max, distribution.mean));
  const sigma = Math.max(0.1, distribution.sigma);
  const sampled = Math.round(mean + sampleGaussian(random) * sigma);
  return Math.max(min, Math.min(max, sampled));
}

function resolveEnemyCount(archetype: NodeArchetype, random: () => number, nodeBattleConfig?: NodeBattleConfig): number {
  if (nodeBattleConfig?.countDistribution) {
    return resolveEnemyCountByDistribution(nodeBattleConfig.countDistribution, random);
  }
  return resolveEnemyCountByArchetype(archetype, random);
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

function resolveEncounterWeightScale(rarityTier: EnemyRarityTier, suppression: number, archetype: NodeArchetype): number {
  const suppressionTier = Math.max(0, Math.floor(suppression / 20));
  const archetypeTier = archetype === "BL1" ? 0 : archetype === "BL2" ? 1 : 2;
  const progression = suppressionTier + archetypeTier;

  if (rarityTier === "common") {
    return Math.max(0.45, 1 - progression * 0.07);
  }
  if (rarityTier === "elite") {
    return 1 + progression * 0.02;
  }
  if (rarityTier === "champion") {
    return 1 + progression * 0.05;
  }
  if (rarityTier === "lord") {
    return 1 + progression * 0.08;
  }
  return 1 + progression * 0.12;
}

function pickEnemyPrototype(random: () => number, archetype: NodeArchetype, suppression: number): EnemyPrototype {
  const weightedPool = ENEMY_POOL.map((prototype) => ({
    prototype,
    weight: Math.max(0.01, resolveEncounterWeight(prototype) * resolveEncounterWeightScale(prototype.rarityTier, suppression, archetype))
  }));

  const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
  const threshold = random() * totalWeight;
  let cursor = 0;
  for (const entry of weightedPool) {
    cursor += entry.weight;
    if (threshold <= cursor) {
      return entry.prototype;
    }
  }
  return weightedPool[weightedPool.length - 1].prototype;
}

function pickEnemyPrototypeByNodeConfig(
  random: () => number,
  archetype: NodeArchetype,
  suppression: number,
  nodeBattleConfig: NodeBattleConfig
): EnemyPrototype {
  const weightedPool = nodeBattleConfig.enemyPool
    .map((entry) => {
      const prototype = ENEMY_PROTOTYPE_BY_ID[entry.prototypeId];
      if (!prototype) {
        return null;
      }
      const suppressionBonus = prototype.rarityTier === "common" ? 1 : 1 + Math.max(0, suppression - 40) / 240;
      const weight =
        Math.max(0.01, entry.weight) *
        NODE_RARITY_WEIGHT_FACTOR[prototype.rarityTier] *
        resolveEncounterWeightScale(prototype.rarityTier, suppression, archetype) *
        suppressionBonus;
      return {
        prototype,
        weight: Math.max(0.01, weight)
      };
    })
    .filter((entry): entry is { prototype: EnemyPrototype; weight: number } => Boolean(entry));

  if (weightedPool.length <= 0) {
    return pickEnemyPrototype(random, archetype, suppression);
  }

  const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
  const threshold = random() * totalWeight;
  let cursor = 0;
  for (const entry of weightedPool) {
    cursor += entry.weight;
    if (threshold <= cursor) {
      return entry.prototype;
    }
  }

  return weightedPool[weightedPool.length - 1].prototype;
}

export function buildEnemyTeam(
  seedId: string,
  archetype: NodeArchetype,
  suppression: number,
  sourceNodeId: string = seedId
): BattleUnitTemplate[] {
  const nodeBattleConfig = getFixedNodeBattleConfig(sourceNodeId);
  const random = createRandom(hashNumber(`${seedId}-${archetype}-${suppression}`));
  const count = resolveEnemyCount(archetype, random, nodeBattleConfig);
  const templates: BattleUnitTemplate[] = [];
  const frontIndices: Array<0 | 1 | 2> = [0, 1, 2];
  const backIndices: Array<0 | 1 | 2> = [0, 1, 2];
  const suppressionLevel = Math.max(0, Math.floor(suppression / 20));

  for (let unitIndex = 0; unitIndex < count; unitIndex += 1) {
    const prototype = nodeBattleConfig
      ? pickEnemyPrototypeByNodeConfig(random, archetype, suppression, nodeBattleConfig)
      : pickEnemyPrototype(random, archetype, suppression);
    const preferFront = prototype.slotHint === "front";
    const canFront = frontIndices.length > 0;
    const canBack = backIndices.length > 0;
    const line = preferFront ? (canFront ? "front" : "back") : canBack ? "back" : "front";
    const indexPool = line === "front" ? frontIndices : backIndices;
    const index = indexPool.shift() ?? 0;
    const level = prototype.baseLevel + levelBonusByArchetype(archetype) + suppressionLevel;
    const difficultyMultiplier = resolveDifficultyMultiplier(prototype);
    const hpScale = (1 + level * 0.075) * (1 + difficultyMultiplier);
    const statScale = (1 + level * 0.052) * (1 + difficultyMultiplier * 0.8);
    const rarityMeta = ENEMY_RARITY_META[prototype.rarityTier];
    const lootQualityTier = resolveLootQualityTier(prototype);

    templates.push({
      id: `${prototype.id}-${unitIndex + 1}`,
      name: `${prototype.name}·${rarityMeta.label} Lv.${level}`,
      side: "enemy",
      level,
      slot: { line, index },
      tags: [archetype, `enemy:${prototype.id}`, `rarity:${prototype.rarityTier}`, `race:${prototype.race}`, `loot-quality:${lootQualityTier}`, prototype.race],
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

