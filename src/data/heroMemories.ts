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
  ],
  ranger: [
    {
      id: "ranger_wild_hunt",
      title: "荒野回响",
      quote: "风向会替箭矢选择归途。",
      effect: "获得 [猎意]：攻击生命低于 40% 的目标时伤害 +12%"
    },
    {
      id: "ranger_moon_trail",
      title: "月痕密语",
      quote: "她总能先于夜色一步。",
      effect: "获得 [夜行]：首个行动条额外推进 600 点"
    }
  ],
  priest: [
    {
      id: "priest_blessed_sap",
      title: "圣树流息",
      quote: "在根须与星潮之间，她听见万物呼吸。",
      effect: "获得 [树灵共振]：生命属性技能治疗效果 +8%"
    },
    {
      id: "priest_emerald_hymn",
      title: "翡翠圣咏",
      quote: "祷词落下时，创口会先一步闭合。",
      effect: "获得 [翠光祈愿]：对生命低于 35% 的友军治疗 +12%"
    }
  ]
};

export interface HeroMemoryCatalogEntry extends HeroMemoryOption {
  heroClass: HeroClass;
}

export const heroMemoryCatalog: HeroMemoryCatalogEntry[] = (Object.entries(heroMemoryOptionsByClass) as Array<
  [HeroClass, HeroMemoryOption[]]
>)
  .flatMap(([heroClass, options]) => options.map((option) => ({ ...option, heroClass })))
  .sort((left, right) => left.title.localeCompare(right.title, "zh-CN"));

export const heroMemoryMap = new Map(heroMemoryCatalog.map((item) => [item.id, item]));

export const initialOwnedHeroMemoryIds: string[] = (Object.entries(heroMemoryOptionsByClass) as Array<
  [HeroClass, HeroMemoryOption[]]
>)
  .map(([, options]) => options[0]?.id ?? null)
  .filter((id): id is string => typeof id === "string" && id.length > 0);
