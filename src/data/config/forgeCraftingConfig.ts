import recipeConfigJson from "./forgeCraftingRecipes.json";
import { getMaterialDropCatalog } from "../battleDrops";
import { getBuildingMaterialCatalog } from "../buildingMaterials";
import { equipmentTemplates } from "../equipmentTemplates";
import type { EquipmentQuality } from "../../types/game";

interface ForgeCraftRecipeRaw {
  id?: string;
  name?: string;
  templateId?: string;
  targetQuality?: EquipmentQuality;
  level?: number;
  materials?: Array<{ materialId?: string; count?: number }>;
  goldCost?: number;
}

interface ForgeCraftRecipeFileRaw {
  recipes?: ForgeCraftRecipeRaw[];
}

export interface ForgeCraftRecipeConfig {
  id: string;
  name: string;
  templateId: string;
  targetQuality: EquipmentQuality;
  qualityLabel: "普通" | "精良" | "稀有" | "史诗" | "圣铸" | "神话";
  level: number;
  materials: Array<{ materialId: string; materialName: string; count: number }>;
  goldCost: number;
}

const QUALITY_LABEL_BY_ID: Record<EquipmentQuality, ForgeCraftRecipeConfig["qualityLabel"]> = {
  common: "普通",
  uncommon: "精良",
  rare: "稀有",
  epic: "史诗",
  legendary: "圣铸",
  mythic: "神话"
};

const VALID_QUALITY_IDS: EquipmentQuality[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic"];
const VALID_TEMPLATE_ID_SET = new Set(equipmentTemplates.map((item) => item.id));
const MATERIAL_NAME_BY_ID = new Map(
  [...getMaterialDropCatalog(), ...getBuildingMaterialCatalog()].map((item) => [item.id, item.name])
);

function sanitizeRecipe(raw: ForgeCraftRecipeRaw, index: number): ForgeCraftRecipeConfig | null {
  const id = typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : `recipe_${index + 1}`;
  const name = typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name.trim() : `未命名图纸-${index + 1}`;
  const templateId = typeof raw.templateId === "string" ? raw.templateId.trim() : "";
  const targetQuality = VALID_QUALITY_IDS.includes(raw.targetQuality as EquipmentQuality)
    ? (raw.targetQuality as EquipmentQuality)
    : "common";
  const level = Number.isFinite(raw.level) ? Math.max(1, Math.floor(raw.level as number)) : 1;
  const goldCost = Number.isFinite(raw.goldCost) ? Math.max(0, Math.floor(raw.goldCost as number)) : 0;

  if (templateId.length <= 0 || !VALID_TEMPLATE_ID_SET.has(templateId)) {
    return null;
  }

  const materials = (raw.materials ?? [])
    .map((entry) => {
      const materialId = typeof entry.materialId === "string" ? entry.materialId.trim() : "";
      const count = Number.isFinite(entry.count) ? Math.max(0, Math.floor(entry.count as number)) : 0;
      if (materialId.length <= 0 || count <= 0) {
        return null;
      }
      const materialName = MATERIAL_NAME_BY_ID.get(materialId);
      if (!materialName) {
        return null;
      }
      return {
        materialId,
        materialName,
        count
      };
    })
    .filter((entry): entry is { materialId: string; materialName: string; count: number } => Boolean(entry));

  if (materials.length <= 0 || goldCost <= 0) {
    return null;
  }

  return {
    id,
    name,
    templateId,
    targetQuality,
    qualityLabel: QUALITY_LABEL_BY_ID[targetQuality],
    level,
    materials,
    goldCost
  };
}

const RAW_CONFIG = recipeConfigJson as ForgeCraftRecipeFileRaw;
const SANITIZED_FORGE_CRAFT_RECIPES = (RAW_CONFIG.recipes ?? [])
  .map((recipe, index) => sanitizeRecipe(recipe, index))
  .filter((entry): entry is ForgeCraftRecipeConfig => Boolean(entry));

export function getForgeCraftRecipeConfigList(): ForgeCraftRecipeConfig[] {
  return SANITIZED_FORGE_CRAFT_RECIPES.map((recipe) => ({
    ...recipe,
    materials: recipe.materials.map((material) => ({ ...material }))
  }));
}
