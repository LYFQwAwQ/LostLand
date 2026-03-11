import type { RegionNode } from "../types/game";

export interface ShopItem {
  id: string;
  name: string;
  category: "成品" | "材料" | "图纸" | "消耗";
  price: number;
  stock: number;
  weight: number;
}

export interface TavernHeroOffer {
  id: string;
  name: string;
  profession: string;
  rarity: "普通" | "稀有" | "史诗";
  signingCost: number;
  traits: string[];
}

export interface ForgeRecipe {
  id: string;
  name: string;
  quality: "普通" | "精良" | "稀有";
  materials: Array<{ name: string; count: number }>;
  goldCost: number;
}

const baseShopPool: ShopItem[] = [
  { id: "potion", name: "高浓度生命药剂", category: "消耗", price: 280, stock: 20, weight: 85 },
  { id: "ether", name: "法力精萃", category: "消耗", price: 360, stock: 16, weight: 70 },
  { id: "blade", name: "精钢短刃", category: "成品", price: 980, stock: 6, weight: 42 },
  { id: "mail", name: "轻型锁甲", category: "成品", price: 1240, stock: 4, weight: 30 },
  { id: "gem", name: "辉光宝石", category: "材料", price: 520, stock: 11, weight: 57 },
  { id: "scroll", name: "破甲战术卷轴", category: "图纸", price: 1680, stock: 2, weight: 18 }
];

const marketPool: ShopItem[] = [
  { id: "bone", name: "骨质残片", category: "材料", price: 35, stock: 90, weight: 88 },
  { id: "wood", name: "硬木原胚", category: "材料", price: 45, stock: 85, weight: 84 },
  { id: "ore", name: "黑铁矿石", category: "材料", price: 60, stock: 65, weight: 76 },
  { id: "salt", name: "净化盐晶", category: "材料", price: 72, stock: 48, weight: 61 },
  { id: "fiber", name: "荆棘纤维", category: "材料", price: 95, stock: 32, weight: 45 },
  { id: "amber", name: "琥珀凝脂", category: "材料", price: 150, stock: 21, weight: 32 }
];

const tavernPool: TavernHeroOffer[] = [
  {
    id: "h1",
    name: "米拉",
    profession: "游侠",
    rarity: "普通",
    signingCost: 880,
    traits: ["侦察+", "敏捷成长"]
  },
  {
    id: "h2",
    name: "托林",
    profession: "战士",
    rarity: "稀有",
    signingCost: 1480,
    traits: ["格挡", "高体质"]
  },
  {
    id: "h3",
    name: "薇奥拉",
    profession: "术士",
    rarity: "史诗",
    signingCost: 3380,
    traits: ["元素穿透", "群体增益"]
  },
  {
    id: "h4",
    name: "赛门",
    profession: "牧师",
    rarity: "稀有",
    signingCost: 1820,
    traits: ["持续治疗", "净化"]
  }
];

const recipePool: ForgeRecipe[] = [
  {
    id: "r1",
    name: "灰烬长剑",
    quality: "精良",
    materials: [
      { name: "黑铁矿石", count: 8 },
      { name: "硬木原胚", count: 3 }
    ],
    goldCost: 980
  },
  {
    id: "r2",
    name: "圣辉胸甲",
    quality: "稀有",
    materials: [
      { name: "黑铁矿石", count: 16 },
      { name: "净化盐晶", count: 5 },
      { name: "辉光宝石", count: 2 }
    ],
    goldCost: 2280
  },
  {
    id: "r3",
    name: "风语法杖",
    quality: "精良",
    materials: [
      { name: "硬木原胚", count: 10 },
      { name: "琥珀凝脂", count: 4 }
    ],
    goldCost: 1420
  }
];


function hashNumber(source: string): number {
  let h = 0;
  for (let i = 0; i < source.length; i += 1) {
    h = (h << 5) - h + source.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function rotate<T>(list: T[], offset: number): T[] {
  if (list.length === 0) {
    return list;
  }
  const n = offset % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}

export function getShopInventory(node: RegionNode): ShopItem[] {
  const offset = hashNumber(`${node.id}-shop`) % baseShopPool.length;
  return rotate(baseShopPool, offset).map((item, index) => ({
    ...item,
    stock: Math.max(1, item.stock - index * 2),
    price: Math.round(item.price * (1 + index * 0.04))
  }));
}

export function getMarketInventory(node: RegionNode): ShopItem[] {
  const offset = hashNumber(`${node.id}-market`) % marketPool.length;
  return rotate(marketPool, offset).map((item, index) => ({
    ...item,
    stock: item.stock + (node.sim.positiveMonths > 0 ? 8 : 0) - index * 3,
    price: Math.round(item.price * (1 + (index % 3) * 0.03))
  }));
}

export function getTavernOffers(node: RegionNode): TavernHeroOffer[] {
  const offset = hashNumber(`${node.id}-tavern`) % tavernPool.length;
  return rotate(tavernPool, offset).slice(0, 3).map((offer) => ({
    ...offer,
    signingCost: Math.round(offer.signingCost * (1 + Math.max(node.sim.prosperity, 0) / 3000))
  }));
}

export function getForgeRecipes(node: RegionNode): ForgeRecipe[] {
  const offset = hashNumber(`${node.id}-forge`) % recipePool.length;
  return rotate(recipePool, offset).map((recipe, index) => ({
    ...recipe,
    goldCost: Math.round(recipe.goldCost * (1 + index * 0.08))
  }));
}

export const marketSellRules = [
  "单次出售 1-20 件：基础回收价",
  "单次出售 21-60 件：回收价 +8%",
  "单次出售 61 件以上：回收价 +15%"
];
