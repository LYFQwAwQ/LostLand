import { buildingMaterialById } from "./buildingMaterials";
import { initialConsumableStacks } from "./consumables";
import { getMaterialDropCatalog } from "./battleDrops";
import type { InventoryConsumableStack, MarketNodeDefinition } from "../types/game";

const materialCatalog = getMaterialDropCatalog();
const materialById = materialCatalog.reduce<Record<string, { id: string; name: string; rarity: "common" | "uncommon" | "rare" | "epic" }>>((acc, item) => {
  acc[item.id] = {
    id: item.id,
    name: item.name,
    rarity: item.rarity
  };
  return acc;
}, {});

const consumableById = initialConsumableStacks.reduce<Record<string, InventoryConsumableStack>>((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

export const marketNodeDefinitions: MarketNodeDefinition[] = [
  {
    nodeId: "rc-grand-cathedral",
    label: "圣堂补给",
    flavor: "圣职仓储优先供应治疗药剂、净化媒介与基础抚恤材料。",
    nodeRoleMultiplier: 1.02,
    sellRate: 0.5,
    featuredItemIds: ["healing_potion_small", "human_ceremonial_chalice", "human_caravan_salt"],
    stockItems: [
      { itemId: "healing_potion_small", category: "consumable", basePrice: 240, baseStock: 12 },
      { itemId: "mana_potion_small", category: "consumable", basePrice: 260, baseStock: 8 },
      { itemId: "human_caravan_salt", category: "material", basePrice: 68, baseStock: 20 },
      { itemId: "human_ceremonial_chalice", category: "material", basePrice: 180, baseStock: 6 }
    ]
  },
  {
    nodeId: "rc-royal-order-command",
    label: "军需调拨",
    flavor: "重装部队和城防体系会优先压住硬质材料与续战补给的价格。",
    nodeRoleMultiplier: 0.97,
    sellRate: 0.54,
    featuredItemIds: ["human_refined_steel", "human_reinforced_plate", "mana_potion_small"],
    stockItems: [
      { itemId: "mana_potion_small", category: "consumable", basePrice: 255, baseStock: 10 },
      { itemId: "human_refined_steel", category: "material", basePrice: 110, baseStock: 18 },
      { itemId: "human_reinforced_plate", category: "material", basePrice: 132, baseStock: 12 },
      { itemId: "human_command_seal", category: "material", basePrice: 210, baseStock: 5 }
    ]
  },
  {
    nodeId: "rc-sage-council",
    label: "学术采购",
    flavor: "贤者议会稳定收购法术媒材与精细提纯材料，价格波动略高。",
    nodeRoleMultiplier: 1.06,
    sellRate: 0.48,
    featuredItemIds: ["human_rune_ink", "undead_wraith_ink", "mana_potion_small"],
    stockItems: [
      { itemId: "mana_potion_small", category: "consumable", basePrice: 250, baseStock: 10 },
      { itemId: "human_rune_ink", category: "material", basePrice: 128, baseStock: 16 },
      { itemId: "undead_wraith_ink", category: "material", basePrice: 146, baseStock: 10 },
      { itemId: "undead_grim_amber", category: "material", basePrice: 220, baseStock: 4 }
    ]
  },
  {
    nodeId: "rc-baptism-sanctum",
    label: "净化补给",
    flavor: "圣池守备将净化药剂和抗污染材料列为优先出货对象。",
    nodeRoleMultiplier: 1.01,
    sellRate: 0.52,
    featuredItemIds: ["healing_potion_small", "revive_scroll", "undead_lantern_wax"],
    stockItems: [
      { itemId: "healing_potion_small", category: "consumable", basePrice: 235, baseStock: 10 },
      { itemId: "revive_scroll", category: "consumable", basePrice: 980, baseStock: 2 },
      { itemId: "undead_lantern_wax", category: "material", basePrice: 138, baseStock: 8 },
      { itemId: "human_ceremonial_chalice", category: "material", basePrice: 176, baseStock: 6 }
    ]
  },
  {
    nodeId: "rc-white-stone-mine",
    label: "建材产地",
    flavor: "矿区直接出清石材和矿物材料，适合为基地扩建补仓。",
    nodeRoleMultiplier: 0.91,
    sellRate: 0.6,
    featuredItemIds: ["building_gray_stone_brick", "building_raw_wood_beam", "undead_crypt_iron"],
    stockItems: [
      { itemId: "building_gray_stone_brick", category: "material", basePrice: buildingMaterialById.building_gray_stone_brick.basePrice, baseStock: 12 },
      { itemId: "building_raw_wood_beam", category: "material", basePrice: buildingMaterialById.building_raw_wood_beam.basePrice, baseStock: 10 },
      { itemId: "undead_crypt_iron", category: "material", basePrice: 122, baseStock: 14 },
      { itemId: "human_refined_steel", category: "material", basePrice: 105, baseStock: 12 }
    ]
  }
];

export const marketNodeDefinitionByNodeId = marketNodeDefinitions.reduce<Record<string, MarketNodeDefinition>>((acc, market) => {
  acc[market.nodeId] = market;
  return acc;
}, {});

export function getMarketItemName(itemId: string, category: "material" | "consumable"): string {
  if (category === "consumable") {
    return consumableById[itemId]?.name ?? itemId;
  }
  return materialById[itemId]?.name ?? buildingMaterialById[itemId]?.name ?? itemId;
}

export function getMarketItemRarity(itemId: string, category: "material" | "consumable") {
  if (category === "consumable") {
    return consumableById[itemId]?.rarity ?? "common";
  }
  return materialById[itemId]?.rarity ?? buildingMaterialById[itemId]?.rarity ?? "common";
}
