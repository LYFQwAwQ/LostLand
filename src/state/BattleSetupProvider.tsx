import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getDefaultHeroLoadout } from "../data/battleUnits";
import { battleActiveSkills, battlePassiveSkills, battleTalents } from "../data/battleSkills";
import { heroes } from "../data/mockData";
import type { Hero } from "../types/game";
import type { BattleLine, BattleLoadout } from "../types/battle";

export interface TeamFormationSlotState {
  id: string;
  line: BattleLine;
  index: 0 | 1 | 2;
  heroId: string | null;
}

interface BattleSetupContextValue {
  formation: TeamFormationSlotState[];
  heroLoadouts: Record<string, BattleLoadout>;
  setSlotHero: (slotId: string, heroId: string | null) => void;
  clearSlot: (slotId: string) => void;
  clearFormation: () => void;
  resetFormationDefault: () => void;
  getHeroLoadout: (heroId: string) => BattleLoadout;
  setHeroTalent: (heroId: string, talentId: string | null) => void;
  setHeroActiveSkill: (heroId: string, slotIndex: number, skillId: string | null) => void;
  setHeroPassiveSkill: (heroId: string, slotIndex: number, skillId: string | null) => void;
  resetHeroLoadout: (heroId: string) => void;
}

const DEFAULT_FORMATION: TeamFormationSlotState[] = [
  { id: "front-0", line: "front", index: 0, heroId: heroes[0]?.id ?? null },
  { id: "front-1", line: "front", index: 1, heroId: heroes[1]?.id ?? null },
  { id: "front-2", line: "front", index: 2, heroId: heroes[2]?.id ?? null },
  { id: "back-0", line: "back", index: 0, heroId: heroes[3]?.id ?? null },
  { id: "back-1", line: "back", index: 1, heroId: heroes[4]?.id ?? null },
  { id: "back-2", line: "back", index: 2, heroId: heroes[5]?.id ?? null }
];

function cloneLoadout(loadout: BattleLoadout): BattleLoadout {
  return {
    talentSlot: loadout.talentSlot,
    activeSlots: [...loadout.activeSlots],
    passiveSlots: [...loadout.passiveSlots]
  };
}

function buildDefaultHeroLoadouts(allHeroes: Hero[]): Record<string, BattleLoadout> {
  return allHeroes.reduce<Record<string, BattleLoadout>>((acc, hero) => {
    acc[hero.id] = cloneLoadout(getDefaultHeroLoadout(hero));
    return acc;
  }, {});
}

function ensureLoadoutShape(loadout: BattleLoadout): BattleLoadout {
  const activeSlots = loadout.activeSlots.slice(0, 10);
  const passiveSlots = loadout.passiveSlots.slice(0, 10);
  while (activeSlots.length < 10) {
    activeSlots.push(null);
  }
  while (passiveSlots.length < 10) {
    passiveSlots.push(null);
  }
  return {
    talentSlot: loadout.talentSlot,
    activeSlots,
    passiveSlots
  };
}

function resolveLoadoutFromStore(store: Record<string, BattleLoadout>, heroId: string): BattleLoadout {
  const existing = store[heroId];
  if (existing) {
    return ensureLoadoutShape(existing);
  }
  const hero = heroes.find((item) => item.id === heroId);
  return hero ? cloneLoadout(getDefaultHeroLoadout(hero)) : ensureLoadoutShape({ talentSlot: null, activeSlots: [], passiveSlots: [] });
}

const BattleSetupContext = createContext<BattleSetupContextValue | null>(null);

export function BattleSetupProvider({ children }: { children: ReactNode }) {
  const [formation, setFormation] = useState<TeamFormationSlotState[]>(() => DEFAULT_FORMATION.map((slot) => ({ ...slot })));
  const [heroLoadouts, setHeroLoadouts] = useState<Record<string, BattleLoadout>>(() => buildDefaultHeroLoadouts(heroes));

  const setSlotHero = (slotId: string, heroId: string | null) => {
    setFormation((prev) => {
      const next = prev.map((slot) => ({ ...slot }));
      const target = next.find((slot) => slot.id === slotId);
      if (!target) {
        return prev;
      }

      if (!heroId) {
        target.heroId = null;
        return next;
      }

      const existing = next.find((slot) => slot.heroId === heroId);
      if (existing && existing.id !== slotId) {
        existing.heroId = target.heroId;
      }
      target.heroId = heroId;
      return next;
    });
  };

  const clearSlot = (slotId: string) => {
    setSlotHero(slotId, null);
  };

  const clearFormation = () => {
    setFormation((prev) => prev.map((slot) => ({ ...slot, heroId: null })));
  };

  const resetFormationDefault = () => {
    setFormation(DEFAULT_FORMATION.map((slot) => ({ ...slot })));
  };

  const getHeroLoadout = (heroId: string): BattleLoadout => {
    return resolveLoadoutFromStore(heroLoadouts, heroId);
  };

  const setHeroTalent = (heroId: string, talentId: string | null) => {
    setHeroLoadouts((prev) => {
      const current = resolveLoadoutFromStore(prev, heroId);
      const nextTalent = talentId && battleTalents[talentId] ? talentId : null;
      return {
        ...prev,
        [heroId]: { ...current, talentSlot: nextTalent }
      };
    });
  };

  const setHeroActiveSkill = (heroId: string, slotIndex: number, skillId: string | null) => {
    if (slotIndex < 0 || slotIndex >= 10) {
      return;
    }
    setHeroLoadouts((prev) => {
      const current = resolveLoadoutFromStore(prev, heroId);
      const activeSlots = [...current.activeSlots];
      activeSlots[slotIndex] = skillId && battleActiveSkills[skillId] ? skillId : null;
      return {
        ...prev,
        [heroId]: { ...current, activeSlots }
      };
    });
  };

  const setHeroPassiveSkill = (heroId: string, slotIndex: number, skillId: string | null) => {
    if (slotIndex < 0 || slotIndex >= 10) {
      return;
    }
    setHeroLoadouts((prev) => {
      const current = resolveLoadoutFromStore(prev, heroId);
      const passiveSlots = [...current.passiveSlots];
      passiveSlots[slotIndex] = skillId && battlePassiveSkills[skillId] ? skillId : null;
      return {
        ...prev,
        [heroId]: { ...current, passiveSlots }
      };
    });
  };

  const resetHeroLoadout = (heroId: string) => {
    const hero = heroes.find((item) => item.id === heroId);
    if (!hero) {
      return;
    }
    setHeroLoadouts((prev) => ({
      ...prev,
      [heroId]: cloneLoadout(getDefaultHeroLoadout(hero))
    }));
  };

  const value = useMemo<BattleSetupContextValue>(
    () => ({
      formation,
      heroLoadouts,
      setSlotHero,
      clearSlot,
      clearFormation,
      resetFormationDefault,
      getHeroLoadout,
      setHeroTalent,
      setHeroActiveSkill,
      setHeroPassiveSkill,
      resetHeroLoadout
    }),
    [formation, heroLoadouts]
  );

  return <BattleSetupContext.Provider value={value}>{children}</BattleSetupContext.Provider>;
}

export function useBattleSetup(): BattleSetupContextValue {
  const context = useContext(BattleSetupContext);
  if (!context) {
    throw new Error("useBattleSetup must be used within BattleSetupProvider");
  }
  return context;
}
