import type { InventoryMaterialSourceType, InventoryResourceRarity } from "../types/game";

export type BuildingMaterialTier = "basic" | "composite" | "refined";

export interface BuildingMaterialDefinition {
  id: string;
  name: string;
  tier: BuildingMaterialTier;
  rarity: InventoryResourceRarity;
  basePrice: number;
}

export interface BuildingMaterialCatalogEntry {
  id: string;
  name: string;
  rarity: InventoryResourceRarity;
  sourceEnemyPrototypeIds: string[];
  sourceType: InventoryMaterialSourceType;
}

export const BUILDING_MATERIAL_SOURCE_LABEL = "建筑材料商店";

export const buildingMaterialDefinitions: BuildingMaterialDefinition[] = [
  { id: "building_gray_stone_brick", name: "灰岩方砖", tier: "basic", rarity: "common", basePrice: 720 },
  { id: "building_raw_wood_beam", name: "原木横梁", tier: "basic", rarity: "common", basePrice: 680 },
  { id: "building_rough_iron_nail", name: "粗制铁钉", tier: "basic", rarity: "common", basePrice: 600 },
  { id: "building_clay_compound", name: "黏土混料", tier: "basic", rarity: "common", basePrice: 640 },
  { id: "building_river_sand_gravel", name: "河沙石子", tier: "basic", rarity: "common", basePrice: 660 },
  { id: "building_steel_core_panel", name: "钢芯复合板", tier: "composite", rarity: "uncommon", basePrice: 6200 },
  { id: "building_reinforced_laminated_wood", name: "强化胶合木", tier: "composite", rarity: "uncommon", basePrice: 5600 },
  { id: "building_slag_cement", name: "炉渣水泥", tier: "composite", rarity: "uncommon", basePrice: 4800 },
  { id: "building_pig_iron_reinforcement", name: "生铁加固件", tier: "composite", rarity: "uncommon", basePrice: 5200 },
  { id: "building_asphalt_waterproof_coating", name: "沥青防水涂层", tier: "composite", rarity: "uncommon", basePrice: 4500 },
  { id: "building_polished_marble", name: "抛光大理石", tier: "refined", rarity: "rare", basePrice: 24000 },
  { id: "building_carved_redwood_beam", name: "雕花红木枋", tier: "refined", rarity: "rare", basePrice: 22000 },
  { id: "building_colored_inlay_glass", name: "彩色镶嵌玻璃", tier: "refined", rarity: "rare", basePrice: 21000 },
  { id: "building_brass_corner_wrap", name: "精铜包角", tier: "refined", rarity: "rare", basePrice: 19500 },
  { id: "building_velvet_sound_felt", name: "丝绒吸音毡", tier: "refined", rarity: "rare", basePrice: 18000 }
];

export const buildingMaterialById = buildingMaterialDefinitions.reduce<Record<string, BuildingMaterialDefinition>>(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {}
);

export function getBuildingMaterialCatalog(): BuildingMaterialCatalogEntry[] {
  return buildingMaterialDefinitions.map((item) => ({
    id: item.id,
    name: item.name,
    rarity: item.rarity,
    sourceEnemyPrototypeIds: [BUILDING_MATERIAL_SOURCE_LABEL],
    sourceType: "building"
  }));
}
