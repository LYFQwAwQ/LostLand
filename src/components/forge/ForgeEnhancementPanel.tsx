import { Hammer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { resolveEnhancementMaxLevel } from "../../data/config/equipmentEnhancementConfig";
import { useEquipmentInventory } from "../../state/EquipmentInventoryProvider";
import { useOrganization } from "../../state/OrganizationProvider";
import type { InventoryResourceRarity } from "../../types/game";

interface ForgeEnhancementPanelProps {
  context?: "node" | "organization";
}

const rarityLabel: Record<InventoryResourceRarity, string> = {
  common: "普通",
  uncommon: "精良",
  rare: "稀有",
  epic: "史诗"
};

function formatCurrency(value: number): string {
  return `${Math.max(0, Math.floor(value)).toLocaleString("zh-CN")}`;
}

export function ForgeEnhancementPanel({ context = "node" }: ForgeEnhancementPanelProps) {
  const {
    items,
    enhancementAidItems,
    getEquipmentEnhanceLevel,
    getEquipmentEnhancementPreview,
    enhanceEquipment
  } = useEquipmentInventory();
  const { forgeEnhancementBonusRate } = useOrganization();
  const [selectedForgeItemUid, setSelectedForgeItemUid] = useState("");
  const [selectedAidId, setSelectedAidId] = useState<string>("");
  const [forgeFeedback, setForgeFeedback] = useState<string | null>(null);

  const forgeCandidates = useMemo(() => {
    return items
      .map((item) => ({
        item,
        enhanceLevel: getEquipmentEnhanceLevel(item.uid),
        preview: getEquipmentEnhancementPreview(item.uid)
      }))
      .sort((left, right) => {
        if ((right.preview?.targetLevel ?? 0) !== (left.preview?.targetLevel ?? 0)) {
          return (right.preview?.targetLevel ?? 0) - (left.preview?.targetLevel ?? 0);
        }
        return left.item.templateName.localeCompare(right.item.templateName, "zh-CN");
      });
  }, [getEquipmentEnhanceLevel, getEquipmentEnhancementPreview, items]);

  const selectedForgePreview = useMemo(() => {
    if (!selectedForgeItemUid) {
      return null;
    }
    return getEquipmentEnhancementPreview(selectedForgeItemUid, {
      aidId: selectedAidId || null
    });
  }, [getEquipmentEnhancementPreview, selectedAidId, selectedForgeItemUid]);

  useEffect(() => {
    if (forgeCandidates.length <= 0) {
      if (selectedForgeItemUid) {
        setSelectedForgeItemUid("");
      }
      return;
    }
    if (!selectedForgeItemUid || !forgeCandidates.some((entry) => entry.item.uid === selectedForgeItemUid)) {
      setSelectedForgeItemUid(forgeCandidates[0].item.uid);
    }
  }, [forgeCandidates, selectedForgeItemUid]);

  useEffect(() => {
    if (!selectedAidId) {
      return;
    }
    if (!enhancementAidItems.some((item) => item.id === selectedAidId)) {
      setSelectedAidId("");
    }
  }, [enhancementAidItems, selectedAidId]);

  const handleForgeEnhance = () => {
    if (!selectedForgeItemUid) {
      setForgeFeedback("请先选择一件装备。");
      return;
    }
    const result = enhanceEquipment(selectedForgeItemUid, {
      aidId: selectedAidId || null
    });
    if (!result.ok) {
      setForgeFeedback(result.reason ?? "强化失败。");
      return;
    }
    const aidSummary = result.aidConsumed && result.usedAidName ? `（消耗辅助材料：${result.usedAidName}）` : "";
    if (result.success) {
      setForgeFeedback(
        `强化成功：+${result.previousLevel} -> +${result.currentLevel}，消耗 ${formatCurrency(result.goldCost)} 金币${aidSummary}。`
      );
      return;
    }
    if (result.materialPreservedByAid) {
      setForgeFeedback(`强化失败：维持 +${result.currentLevel}，已消耗 ${formatCurrency(result.goldCost)} 金币，保护生效未扣主材料${aidSummary}。`);
      return;
    }
    setForgeFeedback(`强化失败：维持 +${result.currentLevel}，已消耗 ${formatCurrency(result.goldCost)} 金币与材料${aidSummary}。`);
  };

  return (
    <div className={`module-forge-panel module-forge-panel-${context}`}>
      <p>
        规则：普通装备最高 +{resolveEnhancementMaxLevel(false)}；传说装备最高 +{resolveEnhancementMaxLevel(true)}；失败不掉级。
      </p>
      <p>当前铁匠铺成功率加成：+{Math.round(Math.max(0, forgeEnhancementBonusRate) * 100)}%</p>
      {forgeFeedback ? <p className="module-trade-feedback">{forgeFeedback}</p> : null}
      {forgeCandidates.length > 0 ? (
        <>
          <label className="module-forge-select">
            选择装备
            <select value={selectedForgeItemUid} onChange={(event) => setSelectedForgeItemUid(event.target.value)}>
              {forgeCandidates.map((entry) => (
                <option key={entry.item.uid} value={entry.item.uid}>
                  {entry.item.templateName} · +{entry.enhanceLevel} · Lv.{entry.item.level}
                </option>
              ))}
            </select>
          </label>

          <label className="module-forge-select">
            辅助材料
            <select value={selectedAidId} onChange={(event) => setSelectedAidId(event.target.value)}>
              <option value="">不使用辅助材料</option>
              {enhancementAidItems.map((aid) => (
                <option key={aid.id} value={aid.id}>
                  {aid.name}（拥有 {aid.owned}）
                </option>
              ))}
            </select>
          </label>

          {selectedForgePreview ? (
            <div className="module-forge-preview">
              <p>
                强化等级：+{selectedForgePreview.currentLevel} / +{selectedForgePreview.maxLevel}，下一次目标 +
                {selectedForgePreview.targetLevel}
              </p>
              <p className="module-forge-rate-breakdown">
                成功率：基础 {Math.round(selectedForgePreview.baseSuccessRate * 100)}% + 铁匠铺{" "}
                {Math.round(selectedForgePreview.forgeBonusRate * 100)}% + 辅助{" "}
                {Math.round(selectedForgePreview.aidSuccessRateBonus * 100)}%
                （上限 {Math.round(selectedForgePreview.successRateCap * 100)}%） = 最终{" "}
                {Math.round(selectedForgePreview.successRate * 100)}%
              </p>
              <p>
                基础属性加成：{Math.round(selectedForgePreview.currentBonus * 100)}% -&gt;{" "}
                {Math.round(selectedForgePreview.targetBonus * 100)}%
              </p>
              <p>金币消耗：{formatCurrency(selectedForgePreview.goldCost)}</p>
              {selectedForgePreview.selectedAid ? (
                <p className="module-forge-aid-note">
                  辅助材料：{selectedForgePreview.selectedAid.name} x{selectedForgePreview.aidCost}（拥有{" "}
                  {selectedForgePreview.selectedAid.owned}） · {selectedForgePreview.selectedAid.description}
                </p>
              ) : null}
              <div className="module-forge-material-list">
                {selectedForgePreview.materialCost.map((entry) => {
                  const enough = entry.owned >= entry.quantity;
                  return (
                    <p key={`${selectedForgePreview.itemUid}-${entry.materialId}`} className={enough ? "" : "insufficient"}>
                      {entry.materialName}（{rarityLabel[entry.rarity]}） x{entry.quantity}（拥有 {entry.owned}）
                    </p>
                  );
                })}
              </div>
              <p>
                失败处理：
                {selectedForgePreview.materialConsumedOnFailure ? "会消耗主材料与金币。" : "仅消耗金币，主材料受保护。"}
              </p>
              {selectedForgePreview.reason ? <p>{selectedForgePreview.reason}</p> : null}
              <button type="button" className="primary-btn" onClick={handleForgeEnhance} disabled={!selectedForgePreview.canEnhance}>
                <Hammer size={14} /> 强化
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p>当前没有可强化装备。</p>
      )}
    </div>
  );
}

