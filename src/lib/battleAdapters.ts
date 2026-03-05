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

function mapEquipmentStats(items: GeneratedEquipment[]) {
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
    const stats = [...item.t1Stats, ...item.affixes];
    stats.forEach((stat) => {
      const value = stat.finalValue;
      switch (stat.key) {
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
  } else {
    boost.fire = 0.1;
    boost.ice = 0.1;
    res.fire = 0.04;
    res.ice = 0.06;
  }

  return { boost, res };
}

export function buildAllyTeamTemplates(
  heroes: Hero[],
  formation: TeamFormationSlotState[],
  heroLoadouts: Record<string, BattleLoadout>,
  equippedByHero: Record<string, Record<string, string>>,
  itemMap: Map<string, GeneratedEquipment>
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
    const equipBonus = mapEquipmentStats(equippedItems);
    const elementPreset = heroElementPreset(hero);

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
        penetration: equipBonus.penetration + (hero.heroClass === "paladin" ? 18 : 12),
        armorPenPct: equipBonus.armorPenPct + (hero.heroClass === "paladin" ? 0.05 : 0.02),
        critRate: equipBonus.critRate + (hero.heroClass === "paladin" ? 0.1 : 0.15),
        critDamage: 1.55 + equipBonus.critDamage + (hero.heroClass === "mage" ? 0.2 : 0),
        evasion: equipBonus.evasion + (hero.heroClass === "mage" ? 0.08 : 0.04),
        aggro: equipBonus.aggro + (hero.heroClass === "paladin" ? 120 : 65),
        lifeSteal: equipBonus.lifeSteal + (hero.heroClass === "paladin" ? 0.02 : 0),
        thorns: equipBonus.thorns + (hero.heroClass === "paladin" ? 0.03 : 0),
        damageBoost: equipBonus.damageBoost + (hero.heroClass === "mage" ? 0.05 : 0.02),
        damageReduction: equipBonus.damageReduction + (hero.heroClass === "paladin" ? 0.08 : 0.03),
        elementalPierce: equipBonus.elementalPierce + (hero.heroClass === "mage" ? 0.08 : 0.03),
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

export function buildEnemyTeamTemplates(nodeId: string, archetype: NodeArchetype, suppression: number): BattleUnitTemplate[] {
  return buildEnemyTeam(nodeId, archetype, suppression);
}
