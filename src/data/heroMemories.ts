import type { HeroClass } from "../types/game";

export interface HeroMemoryOption {
  id: string;
  title: string;
  quote: string;
  effect: string;
}

export const heroMemoryOptionsByClass: Record<HeroClass, HeroMemoryOption[]> = {
  paladin: [
    {
      id: "paladin_fractured_throne",
      title: "破碎的王座",
      quote: "那是连光都被吞噬的黎明前夜。",
      effect: "获得 [孤傲]：孤军奋战时伤害 +50%"
    },
    {
      id: "paladin_last_vigil",
      title: "最后守望",
      quote: "誓言会先于血液抵达战场。",
      effect: "获得 [誓卫]：生命低于 50% 时减伤 +12%"
    }
  ],
  mage: [
    {
      id: "mage_winter_stars",
      title: "凛冬的群星",
      quote: "她在群星坠落前，记住了每一道法则裂痕。",
      effect: "获得 [法涌]：法力值越高，法术穿透越高"
    },
    {
      id: "mage_tide_archive",
      title: "潮汐档案",
      quote: "每一次潮涨都在替她重写咒式。",
      effect: "获得 [潮律]：治疗技能额外附带 5% 护盾"
    }
  ]
};

export const defaultHeroMemoryByClass: Record<HeroClass, string> = {
  paladin: heroMemoryOptionsByClass.paladin[0].id,
  mage: heroMemoryOptionsByClass.mage[0].id
};
