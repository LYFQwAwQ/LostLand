import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getDefaultHeroLoadout } from "../data/battleUnits";
import { heroes } from "../data/mockData";
import { ensureBattleLoadoutShape, normalizeHeroLoadout } from "../lib/battleLoadoutRules";
import type { Hero } from "../types/game";
import type { BattleLine, BattleLoadout } from "../types/battle";

export interface TeamFormationSlotState {
  id: string;
  line: BattleLine;
  index: 0 | 1 | 2;
  heroId: string | null;
}

export interface BattleSetupSnapshot {
  formation: TeamFormationSlotState[];
  heroLoadouts: Record<string, BattleLoadout>;
}

interface BattleSetupContextValue {
  formation: TeamFormationSlotState[];
  heroLoadouts: Record<string, BattleLoadout>;
  setFormationSlots: (formation: TeamFormationSlotState[]) => void;
  setSlotHero: (slotId: string, heroId: string | null) => void;
  clearSlot: (slotId: string) => void;
  clearFormation: () => void;
  resetFormationDefault: () => void;
  getHeroLoadout: (heroId: string) => BattleLoadout;
  setHeroLoadout: (heroId: string, loadout: BattleLoadout) => void;
  setHeroTalent: (heroId: string, talentId: string | null) => void;
  setHeroActiveSkill: (heroId: string, slotIndex: number, skillId: string | null) => void;
  setHeroPassiveSkill: (heroId: string, slotIndex: number, skillId: string | null) => void;
  resetHeroLoadout: (heroId: string) => void;
  exportSnapshot: () => BattleSetupSnapshot;
  importSnapshot: (snapshot: BattleSetupSnapshot) => void;
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
    const defaultLoadout = getDefaultHeroLoadout(hero);
    const normalized = normalizeHeroLoadout(hero.heroClass, defaultLoadout, defaultLoadout.talentSlot, hero.learnedSkills);
    acc[hero.id] = cloneLoadout(normalized.loadout);
    return acc;
  }, {});
}

function cloneFormation(formation: TeamFormationSlotState[]): TeamFormationSlotState[] {
  return formation.map((slot) => ({ ...slot }));
}

const HERO_MAP = new Map(heroes.map((hero) => [hero.id, hero]));

function normalizeForHero(hero: Hero, loadout: BattleLoadout): BattleLoadout {
  const defaultLoadout = getDefaultHeroLoadout(hero);
  return normalizeHeroLoadout(hero.heroClass, loadout, defaultLoadout.talentSlot, hero.learnedSkills).loadout;
}

function resolveLoadoutFromStore(store: Record<string, BattleLoadout>, heroId: string): BattleLoadout {
  const hero = HERO_MAP.get(heroId);
  if (!hero) {
    return ensureBattleLoadoutShape({ talentSlot: null, activeSlots: [], passiveSlots: [] });
  }
  const existing = store[heroId] ?? getDefaultHeroLoadout(hero);
  return normalizeForHero(hero, existing);
}

function normalizeFormationSnapshot(formation: TeamFormationSlotState[]): TeamFormationSlotState[] {
  const incomingById = new Map(formation.map((slot) => [slot.id, slot]));
  return DEFAULT_FORMATION.map((defaultSlot) => {
    const incoming = incomingById.get(defaultSlot.id);
    const heroId =
      incoming?.heroId && typeof incoming.heroId === "string" && HERO_MAP.has(incoming.heroId) ? incoming.heroId : null;
    return {
      ...defaultSlot,
      heroId
    };
  });
}

function normalizeLoadoutsSnapshot(loadouts: Record<string, BattleLoadout>): Record<string, BattleLoadout> {
  return heroes.reduce<Record<string, BattleLoadout>>((acc, hero) => {
    const existing = loadouts[hero.id] ?? getDefaultHeroLoadout(hero);
    acc[hero.id] = cloneLoadout(normalizeForHero(hero, existing));
    return acc;
  }, {});
}

const BattleSetupContext = createContext<BattleSetupContextValue | null>(null);

export function BattleSetupProvider({ children }: { children: ReactNode }) {
  const [formation, setFormation] = useState<TeamFormationSlotState[]>(() => cloneFormation(DEFAULT_FORMATION));
  const [heroLoadouts, setHeroLoadouts] = useState<Record<string, BattleLoadout>>(() => buildDefaultHeroLoadouts(heroes));

  const setFormationSlots = (nextFormation: TeamFormationSlotState[]) => {
    setFormation(normalizeFormationSnapshot(nextFormation));
  };

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
    setFormation(cloneFormation(DEFAULT_FORMATION));
  };

  const getHeroLoadout = (heroId: string): BattleLoadout => {
    return resolveLoadoutFromStore(heroLoadouts, heroId);
  };

  const setHeroLoadout = (heroId: string, loadout: BattleLoadout) => {
    const hero = HERO_MAP.get(heroId);
    if (!hero) {
      return;
    }
    const normalized = normalizeForHero(hero, loadout);
    setHeroLoadouts((prev) => ({
      ...prev,
      [heroId]: cloneLoadout(normalized)
    }));
  };

  const setHeroTalent = (heroId: string, talentId: string | null) => {
    setHeroLoadouts((prev) => {
      const hero = HERO_MAP.get(heroId);
      if (!hero) {
        return prev;
      }
      const current = resolveLoadoutFromStore(prev, heroId);
      const nextTalent = typeof talentId === "string" && talentId.length > 0 ? talentId : null;
      const normalized = normalizeForHero(hero, { ...current, talentSlot: nextTalent });
      return {
        ...prev,
        [heroId]: cloneLoadout(normalized)
      };
    });
  };

  const setHeroActiveSkill = (heroId: string, slotIndex: number, skillId: string | null) => {
    if (slotIndex < 0 || slotIndex >= 10) {
      return;
    }
    setHeroLoadouts((prev) => {
      const hero = HERO_MAP.get(heroId);
      if (!hero) {
        return prev;
      }
      const current = resolveLoadoutFromStore(prev, heroId);
      const activeSlots = [...current.activeSlots];
      activeSlots[slotIndex] = typeof skillId === "string" && skillId.length > 0 ? skillId : null;
      const normalized = normalizeForHero(hero, { ...current, activeSlots });
      return {
        ...prev,
        [heroId]: cloneLoadout(normalized)
      };
    });
  };

  const setHeroPassiveSkill = (heroId: string, slotIndex: number, skillId: string | null) => {
    if (slotIndex < 0 || slotIndex >= 10) {
      return;
    }
    setHeroLoadouts((prev) => {
      const hero = HERO_MAP.get(heroId);
      if (!hero) {
        return prev;
      }
      const current = resolveLoadoutFromStore(prev, heroId);
      const passiveSlots = [...current.passiveSlots];
      passiveSlots[slotIndex] = typeof skillId === "string" && skillId.length > 0 ? skillId : null;
      const normalized = normalizeForHero(hero, { ...current, passiveSlots });
      return {
        ...prev,
        [heroId]: cloneLoadout(normalized)
      };
    });
  };

  const resetHeroLoadout = (heroId: string) => {
    const hero = HERO_MAP.get(heroId);
    if (!hero) {
      return;
    }
    const defaultLoadout = normalizeForHero(hero, getDefaultHeroLoadout(hero));
    setHeroLoadouts((prev) => ({
      ...prev,
      [heroId]: cloneLoadout(defaultLoadout)
    }));
  };

  const exportSnapshot = (): BattleSetupSnapshot => {
    return {
      formation: cloneFormation(formation),
      heroLoadouts: heroes.reduce<Record<string, BattleLoadout>>((acc, hero) => {
        acc[hero.id] = cloneLoadout(resolveLoadoutFromStore(heroLoadouts, hero.id));
        return acc;
      }, {})
    };
  };

  const importSnapshot = (snapshot: BattleSetupSnapshot) => {
    setFormation(normalizeFormationSnapshot(snapshot.formation ?? []));
    setHeroLoadouts(normalizeLoadoutsSnapshot(snapshot.heroLoadouts ?? {}));
  };

  const value = useMemo<BattleSetupContextValue>(
    () => ({
      formation,
      heroLoadouts,
      setFormationSlots,
      setSlotHero,
      clearSlot,
      clearFormation,
      resetFormationDefault,
      getHeroLoadout,
      setHeroLoadout,
      setHeroTalent,
      setHeroActiveSkill,
      setHeroPassiveSkill,
      resetHeroLoadout,
      exportSnapshot,
      importSnapshot
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
