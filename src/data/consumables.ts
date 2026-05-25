import type { InventoryConsumableStack } from "../types/game";

export const initialConsumableStacks: InventoryConsumableStack[] = [
  {
    id: "healing_potion_small",
    name: "初级治疗药剂",
    rarity: "common",
    effectSummary: "战斗中使用：恢复单体生命值 120。",
    maxStack: 99,
    quantity: 0,
    source: "圣堂补给 / 布告栏 / 仪式"
  },
  {
    id: "mana_potion_small",
    name: "初级法力药剂",
    rarity: "common",
    effectSummary: "战斗中使用：恢复单体法力值 80。",
    maxStack: 99,
    quantity: 0,
    source: "军需调拨 / 学术采购 / 布告栏"
  },
  {
    id: "revive_scroll",
    name: "复苏卷轴",
    rarity: "rare",
    effectSummary: "战斗中使用：复活 1 名倒地友军并恢复 15% 生命。",
    maxStack: 20,
    quantity: 0,
    source: "净化补给 / 仪式"
  }
];
