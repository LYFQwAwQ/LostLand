import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createStartupHeroes } from "../data/heroRoster";
import type { Hero } from "../types/game";

interface RecruitHeroInput {
  id: string;
  name: string;
  title: string;
  heroClass: Hero["heroClass"];
  image: string;
  rarity?: Hero["rarity"];
  origin?: Hero["origin"];
  learnedSkills?: Hero["learnedSkills"];
  loadoutPreset?: Hero["loadoutPreset"];
  stats: Hero["stats"];
  statGrowth: Hero["statGrowth"];
}

interface HeroRosterContextValue {
  heroes: Hero[];
  heroById: Map<string, Hero>;
  recruitHero: (input: RecruitHeroInput) => { ok: boolean; message: string; heroId: string | null };
}

const HeroRosterContext = createContext<HeroRosterContextValue | null>(null);

function cloneHero(hero: Hero): Hero {
  return {
    ...hero,
    learnedSkills: hero.learnedSkills
      ? {
          ...hero.learnedSkills,
          talentIds: [...hero.learnedSkills.talentIds],
          activeSkillIds: [...hero.learnedSkills.activeSkillIds],
          passiveSkillIds: [...hero.learnedSkills.passiveSkillIds],
          rarityBySkillId: hero.learnedSkills.rarityBySkillId ? { ...hero.learnedSkills.rarityBySkillId } : undefined
        }
      : undefined,
    loadoutPreset: hero.loadoutPreset
      ? {
          talentId: hero.loadoutPreset.talentId,
          activeSkillIds: [...hero.loadoutPreset.activeSkillIds],
          passiveSkillIds: [...hero.loadoutPreset.passiveSkillIds]
        }
      : undefined,
    stats: { ...hero.stats },
    statGrowth: { ...hero.statGrowth }
  };
}

export function HeroRosterProvider({ children }: { children: ReactNode }) {
  const [heroes, setHeroes] = useState<Hero[]>(() => createStartupHeroes().map(cloneHero));

  const heroById = useMemo(() => new Map(heroes.map((hero) => [hero.id, hero])), [heroes]);

  const recruitHero = (input: RecruitHeroInput): { ok: boolean; message: string; heroId: string | null } => {
    const baseId = String(input.id ?? "").trim();
    if (baseId.length <= 0) {
      return { ok: false, message: "招募失败：英雄ID无效。", heroId: null };
    }
    const baseName = String(input.name ?? "").trim();
    if (baseName.length <= 0) {
      return { ok: false, message: "招募失败：英雄名称无效。", heroId: null };
    }

    const existingIdSet = new Set(heroes.map((hero) => hero.id));
    let heroId = baseId;
    let suffix = 1;
    while (existingIdSet.has(heroId)) {
      suffix += 1;
      heroId = `${baseId}-${suffix}`;
    }

    const existingNameSet = new Set(heroes.map((hero) => hero.name));
    let heroName = baseName;
    let nameSuffix = 1;
    while (existingNameSet.has(heroName)) {
      nameSuffix += 1;
      heroName = `${baseName}-${nameSuffix}`;
    }

    const nextHero: Hero = {
      id: heroId,
      name: heroName,
      title: input.title,
      heroClass: input.heroClass,
      image: input.image,
      rarity: input.rarity ?? "standard",
      origin: input.origin ?? "generated",
      learnedSkills: input.learnedSkills
        ? {
            ...input.learnedSkills,
            talentIds: [...input.learnedSkills.talentIds],
            activeSkillIds: [...input.learnedSkills.activeSkillIds],
            passiveSkillIds: [...input.learnedSkills.passiveSkillIds],
            rarityBySkillId: input.learnedSkills.rarityBySkillId ? { ...input.learnedSkills.rarityBySkillId } : undefined
          }
        : undefined,
      loadoutPreset: input.loadoutPreset
        ? {
            talentId: input.loadoutPreset.talentId,
            activeSkillIds: [...input.loadoutPreset.activeSkillIds],
            passiveSkillIds: [...input.loadoutPreset.passiveSkillIds]
          }
        : undefined,
      stats: { ...input.stats },
      statGrowth: { ...input.statGrowth }
    };

    setHeroes((prev) => [...prev, nextHero]);
    return { ok: true, message: `招募成功：${nextHero.name}`, heroId };
  };

  const value = useMemo<HeroRosterContextValue>(
    () => ({
      heroes,
      heroById,
      recruitHero
    }),
    [heroById, heroes]
  );

  return <HeroRosterContext.Provider value={value}>{children}</HeroRosterContext.Provider>;
}

export function useHeroRoster(): HeroRosterContextValue {
  const context = useContext(HeroRosterContext);
  if (!context) {
    throw new Error("useHeroRoster must be used within HeroRosterProvider");
  }
  return context;
}
