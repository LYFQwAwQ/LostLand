import { Hammer } from "lucide-react";
import { useMemo, useState } from "react";
import { equipmentTemplates } from "../../data/equipmentTemplates";
import type { ForgeRecipe } from "../../data/nodeModules";
import { getEquipmentQualityLabel } from "../../lib/equipmentSystem";
import { useEquipmentInventory } from "../../state/EquipmentInventoryProvider";

interface ForgeCraftPanelProps {
  recipes: ForgeRecipe[];
  context?: "node" | "organization";
}

function formatCurrency(value: number): string {
  return `${Math.max(0, Math.floor(value)).toLocaleString("zh-CN")}`;
}

const templateNameById = new Map(equipmentTemplates.map((template) => [template.id, template.name]));

export function ForgeCraftPanel({ recipes, context = "node" }: ForgeCraftPanelProps) {
  const {
    gold,
    materialItems,
    normalEquipmentCount,
    normalEquipmentCapacity,
    isBackpackEquipmentFull,
    craftEquipment
  } = useEquipmentInventory();
  const [forgeCraftFeedback, setForgeCraftFeedback] = useState<string | null>(null);

  const materialCountMap = useMemo(() => {
    return materialItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.id] = item.quantity;
      return acc;
    }, {});
  }, [materialItems]);

  const handleCraft = (recipe: ForgeRecipe) => {
    const result = craftEquipment({
      recipeId: recipe.id,
      recipeName: recipe.name,
      templateId: recipe.templateId,
      targetQuality: recipe.targetQuality,
      level: recipe.level,
      goldCost: recipe.goldCost,
      materials: recipe.materials.map((entry) => ({
        materialId: entry.materialId,
        quantity: entry.count
      })),
      sourceTag: context
    });
    if (!result.ok) {
      setForgeCraftFeedback(result.reason ?? "打造失败。");
      return;
    }

    const item = result.craftedItem;
    const qualityLabel = item ? getEquipmentQualityLabel(item.quality, false) : "未知";
    setForgeCraftFeedback(
      `打造成功：${item?.templateName ?? recipe.name}（${qualityLabel}）已入包，消耗 ${formatCurrency(result.goldCost)} 金币。`
    );
  };

  return (
    <div className={`module-forge-craft-panel module-forge-craft-panel-${context}`}>
      <p>
        当前金币：{formatCurrency(gold)}；装备容量：{normalEquipmentCount}/{normalEquipmentCapacity}
        {isBackpackEquipmentFull ? "（已满）" : ""}。
      </p>
      {forgeCraftFeedback ? <p className="module-trade-feedback">{forgeCraftFeedback}</p> : null}
      {recipes.length > 0 ? (
        recipes.map((recipe) => {
          const templateName = templateNameById.get(recipe.templateId) ?? recipe.templateId;
          const lackMaterial = recipe.materials.some((entry) => (materialCountMap[entry.materialId] ?? 0) < entry.count);
          const canCraft = !isBackpackEquipmentFull && gold >= recipe.goldCost && !lackMaterial;

          return (
            <article key={recipe.id} className="recipe-row">
              <div>
                <h4>{recipe.name}</h4>
                <p>
                  产出：{templateName} · Lv.{recipe.level} · 品质 {recipe.qualityLabel}
                </p>
                <p>金币：{formatCurrency(recipe.goldCost)}</p>
                {recipe.materials.map((entry) => {
                  const owned = materialCountMap[entry.materialId] ?? 0;
                  const enough = owned >= entry.count;
                  return (
                    <p key={`${recipe.id}-${entry.materialId}`} className={enough ? "" : "insufficient"}>
                      {entry.materialName} x{entry.count}（拥有 {owned}）
                    </p>
                  );
                })}
              </div>
              <button type="button" className="ghost-btn small-btn" disabled={!canCraft} onClick={() => handleCraft(recipe)}>
                <Hammer size={13} /> 打造
              </button>
            </article>
          );
        })
      ) : (
        <p>当前暂无可用打造配方。</p>
      )}
    </div>
  );
}
