import type { InventoryConsumableStack } from "../types/game";

// TODO: 接入正式消耗品产出/消耗链路（商店、任务、战斗结算）后，替换示例库存初始化。
export const initialConsumableStacks: InventoryConsumableStack[] = [
  {
    id: "healing_potion_small",
    name: "初级治疗药剂",
    rarity: "common",
    effectSummary: "战斗中使用：恢复单体生命值 120。",
    maxStack: 99,
    quantity: 18,
    source: "示例库存"
  },
  {
    id: "mana_potion_small",
    name: "初级法力药剂",
    rarity: "common",
    effectSummary: "战斗中使用：恢复单体法力值 80。",
    maxStack: 99,
    quantity: 11,
    source: "示例库存"
  },
  {
    id: "revive_scroll",
    name: "复苏卷轴",
    rarity: "rare",
    effectSummary: "战斗中使用：复活 1 名倒地友军并恢复 15% 生命。",
    maxStack: 20,
    quantity: 2,
    source: "示例库存"
  }
];
