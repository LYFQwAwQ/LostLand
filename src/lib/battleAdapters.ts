import { buildEnemyTeam, getDefaultHeroLoadout } from "../data/battleUnits";
import type { Hero, NodeArchetype } from "../types/game";
import type { GeneratedEquipment } from "../types/game";
import type { BattleElement, BattleLoadout, BattleUnitTemplate } from "../types/battle";
import type { TeamFormationSlotState } from "../state/BattleSetupProvider";

const ELEMENT_KEYS: BattleElement[] = ["fire", "water", "ice", "wind", "life", "light", "undead", "dark"];

function parseStatNumber(input: string): number {
  const normalized = input.replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getUniqueEquippedItems(
  heroId: string,
  equippedByHero: Record<string, Record<string, string>>,
  itemMap: Map<string, GeneratedEquipment>
): GeneratedEquipment[] {
  const slotMap = equippedByHero[heroId] ?? {};
  const unique = new Set(Object.values(slotMap));
  const list: GeneratedEquipment[] = [];
  unique.forEach((uid) => {
    const item = itemMap.get(uid);
    if (item) {
      list.push(item);
    }
  });
  return list;
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

function mapEquipmentStats(items: GeneratedEquipment[], getEnhanceBonusByUid: (itemUid: string) => number) {
  const bonus = {
    maxHp: 0,
    maxMp: 0,
    str: 0,
    int: 0,
    agi: 0,
    def: 0,
    penetration: 0,
    armorPenPct: 0,
    critRate: 0,
    critDamage: 0,
    evasion: 0,
    aggro: 0,
    lifeSteal: 0,
    thorns: 0,
    elementalPierce: 0,
    allRes: 0,
    allBoost: 0,
    damageBoost: 0,
    damageReduction: 0,
    elementBoost: createElementRecord(0),
    elementRes: createElementRecord(0)
  };

  items.forEach((item) => {
    const t1EnhanceMultiplier = 1 + Math.max(0, getEnhanceBonusByUid(item.uid));
    const applyStat = (key: string, value: number) => {
      switch (key) {
        case "hp":
          bonus.maxHp += value;
          break;
        case "mp":
          bonus.maxMp += value;
          break;
        case "str":
          bonus.str += value;
          break;
        case "int":
          bonus.int += value;
          break;
        case "agi":
          bonus.agi += value;
          break;
        case "def":
          bonus.def += value;
          break;
        case "penetration":
          bonus.penetration += value;
          break;
        case "critRate":
          bonus.critRate += value / 100;
          break;
        case "critDamage":
          bonus.critDamage += value / 100;
          break;
        case "evasion":
          bonus.evasion += value / 100;
          break;
        case "aggro":
          bonus.aggro += value;
          break;
        case "lifeSteal":
          bonus.lifeSteal += value / 100;
          break;
        case "thorns":
          bonus.thorns += value / 100;
          break;
        case "elementalPierce":
          bonus.elementalPierce += value / 100;
          break;
        case "allRes":
          bonus.allRes += value / 100;
          break;
        case "allBoost":
          bonus.allBoost += value / 100;
          break;
        case "armorPiercePct":
          bonus.armorPenPct += value / 100;
          break;
        default:
          break;
      }
    };

    item.t1Stats.forEach((stat) => {
      applyStat(stat.key, stat.finalValue * t1EnhanceMultiplier);
    });
    item.affixes.forEach((affix) => {
      applyStat(affix.key, affix.finalValue);
    });
  });

  return bonus;
}

function heroElementPreset(hero: Hero): { boost: Record<BattleElement, number>; res: Record<BattleElement, number> } {
  const boost = createElementRecord(0);
  const res = createElementRecord(0);

  if (hero.heroClass === "paladin") {
    boost.light = 0.12;
    boost.life = 0.08;
    res.dark = 0.06;
    res.light = 0.08;
  } else if (hero.heroClass === "mage") {
    boost.fire = 0.1;
    boost.ice = 0.1;
    res.fire = 0.04;
    res.ice = 0.06;
  } else if (hero.heroClass === "priest") {
    boost.life = 0.16;
    boost.light = 0.08;
    res.life = 0.1;
    res.dark = 0.08;
  } else {
    boost.wind = 0.14;
    boost.dark = 0.06;
    res.wind = 0.08;
    res.ice = 0.04;
  }

  return { boost, res };
}

export function buildAllyTeamTemplates(
  heroes: Hero[],
  formation: TeamFormationSlotState[],
  heroLoadouts: Record<string, BattleLoadout>,
  equippedByHero: Record<string, Record<string, string>>,
  itemMap: Map<string, GeneratedEquipment>,
  getEnhanceBonusByUid: (itemUid: string) => number
): BattleUnitTemplate[] {
  const heroMap = new Map(heroes.map((hero) => [hero.id, hero]));
  const orderedSlots = [...formation].sort((left, right) => {
    if (left.line === right.line) {
      return left.index - right.index;
    }
    return left.line === "front" ? -1 : 1;
  });
  const candidates = orderedSlots
    .map((slot) => {
      if (!slot.heroId) {
        return null;
      }
      const hero = heroMap.get(slot.heroId);
      return hero ? { hero, slot } : null;
    })
    .filter((entry): entry is { hero: Hero; slot: TeamFormationSlotState } => Boolean(entry))
    .slice(0, 6);
  const finalCandidates =
    candidates.length > 0
      ? candidates
      : heroes[0]
      ? [
          {
            hero: heroes[0],
            slot: { id: "front-0", line: "front" as const, index: 0 as const, heroId: heroes[0].id }
          }
        ]
      : [];

  return finalCandidates.map(({ hero, slot }) => {
    const line = slot.line;
    const slotIndex = slot.index;
    const baseMaxHp = parseStatNumber(hero.stats.hp);
    const baseMaxMp = parseStatNumber(hero.stats.mp);
    const baseStr = parseStatNumber(hero.stats.str);
    const baseInt = parseStatNumber(hero.stats.int);
    const baseAgi = parseStatNumber(hero.stats.agi);
    const baseDef = parseStatNumber(hero.stats.def);
    const equippedItems = getUniqueEquippedItems(hero.id, equippedByHero, itemMap);
    const equipBonus = mapEquipmentStats(equippedItems, getEnhanceBonusByUid);
    const elementPreset = heroElementPreset(hero);
    const isPaladin = hero.heroClass === "paladin";
    const isMage = hero.heroClass === "mage";
    const isRanger = hero.heroClass === "ranger";
    const isPriest = hero.heroClass === "priest";

    const loadout = heroLoadouts[hero.id] ?? getDefaultHeroLoadout(hero);

    return {
      id: hero.id,
      name: hero.name,
      side: "ally",
      level: 1,
      slot: { line, index: slotIndex },
      avatar: hero.image,
      tags: [hero.heroClass],
      baseStats: {
        maxHp: Math.round(baseMaxHp + equipBonus.maxHp),
        maxMp: Math.round(baseMaxMp + equipBonus.maxMp),
        str: Math.round(baseStr + equipBonus.str),
        int: Math.round(baseInt + equipBonus.int),
        agi: Math.round(baseAgi + equipBonus.agi),
        def: Math.round(baseDef + equipBonus.def),
        penetration: equipBonus.penetration + (isPaladin ? 18 : isRanger ? 20 : isPriest ? 10 : 12),
        armorPenPct: equipBonus.armorPenPct + (isPaladin ? 0.05 : isRanger ? 0.04 : 0.02),
        critRate: equipBonus.critRate + (isPaladin ? 0.1 : isRanger ? 0.18 : isPriest ? 0.12 : 0.15),
        critDamage: 1.55 + equipBonus.critDamage + (isMage ? 0.2 : isRanger ? 0.1 : isPriest ? 0.06 : 0),
        evasion: equipBonus.evasion + (isMage ? 0.08 : isRanger ? 0.12 : isPriest ? 0.06 : 0.04),
        aggro: equipBonus.aggro + (isPaladin ? 120 : isRanger ? 78 : isPriest ? 70 : 65),
        lifeSteal: equipBonus.lifeSteal + (isPaladin ? 0.02 : isRanger ? 0.01 : 0),
        thorns: equipBonus.thorns + (isPaladin ? 0.03 : 0),
        damageBoost: equipBonus.damageBoost + (isMage ? 0.05 : isRanger ? 0.06 : isPriest ? 0.04 : 0.02),
        damageReduction: equipBonus.damageReduction + (isPaladin ? 0.08 : isRanger ? 0.04 : isPriest ? 0.05 : 0.03),
        elementalPierce: equipBonus.elementalPierce + (isMage ? 0.08 : isRanger ? 0.04 : isPriest ? 0.06 : 0.03),
        allRes: equipBonus.allRes,
        allBoost: equipBonus.allBoost,
        elementBoost: ELEMENT_KEYS.reduce<Record<BattleElement, number>>((acc, key) => {
          acc[key] = elementPreset.boost[key] + equipBonus.elementBoost[key];
          return acc;
        }, createElementRecord(0)),
        elementRes: ELEMENT_KEYS.reduce<Record<BattleElement, number>>((acc, key) => {
          acc[key] = elementPreset.res[key] + equipBonus.elementRes[key];
          return acc;
        }, createElementRecord(0))
      },
      loadout: {
        talentSlot: loadout.talentSlot,
        activeSlots: [...loadout.activeSlots],
        passiveSlots: [...loadout.passiveSlots]
      }
    };
  });
}

export function buildEnemyTeamTemplates(
  seedId: string,
  archetype: NodeArchetype,
  suppression: number,
  sourceNodeId?: string
): BattleUnitTemplate[] {
  return buildEnemyTeam(seedId, archetype, suppression, sourceNodeId ?? seedId);
}
