import { Coins, Lock, ScrollText, Shield, ShoppingBag, Sparkles, Sword, Unlock, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ForgeEnhancementPanel } from "../components/forge/ForgeEnhancementPanel";
import {
  ECONOMY_CONFIG,
  getEquipmentBuyPrice,
  getEquipmentSellPrice,
  type EquipmentQuickSellFilter
} from "../data/config/economyConfig";
import { getBuildingMaterialMarketConfig, resolveBuildingMaterialPriceQuote } from "../data/config/buildingMaterialMarketConfig";
import { equipmentTemplates } from "../data/equipmentTemplates";
import { legendaryEquipmentIdByUid } from "../data/legendaryEquipments";
import { heroes } from "../data/mockData";
import { buildWorldMapSearchParams, selectionFromRegion } from "../data/worldMapData";
import { buildingMaterialDefinitions, type BuildingMaterialTier } from "../data/buildingMaterials";
import { getForgeRecipes, getMarketInventory, getShopInventory, getTavernOffers, marketSellRules } from "../data/nodeModules";
import { EQUIPMENT_SUBTYPE_LABELS } from "../lib/equipmentCatalog";
import { computeEquipmentInternalScore } from "../lib/equipmentScoring";
import { generateEquipmentBatch } from "../lib/equipmentSystem";
import { ACTION_META, canAccessAction, mapNodeTypeLabel } from "../lib/mapRules";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { useMapSystem } from "../state/MapSystemProvider";
import type { BulletinMissionState, GeneratedEquipment, InventoryResourceRarity, NodeAction } from "../types/game";

const validActions: NodeAction[] = [
  "detail",
  "shop",
  "build_materials",
  "market",
  "tavern",
  "forge",
  "bulletin",
  "battle",
  "ritual"
];

const missionTypeLabel: Record<BulletinMissionState["type"], string> = {
  collect: "收集",
  hunt: "讨伐"
};

const missionStatusLabel: Record<BulletinMissionState["status"], string> = {
  available: "可领取",
  in_progress: "进行中",
  ready_to_submit: "可提交",
  completed: "已完成"
};

const rarityLabel: Record<InventoryResourceRarity, string> = {
  common: "普通",
  uncommon: "精良",
  rare: "稀有",
  epic: "史诗"
};

const buildingMaterialTierLabel: Record<BuildingMaterialTier, string> = {
  basic: "普通材料",
  composite: "复合材料",
  refined: "精致材料"
};

const QUICK_SELL_QUALITY_OPTIONS: GeneratedEquipment["quality"][] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic"
];
const QUICK_SELL_RANK_OPTIONS: GeneratedEquipment["rank"][] = ["crude", "fine", "superior", "perfect"];

function isNodeAction(value: string | undefined): value is NodeAction {
  return !!value && validActions.includes(value as NodeAction);
}

function HeaderInfo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="module-card">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function formatCurrency(value: number): string {
  return `${Math.max(0, Math.floor(value)).toLocaleString("zh-CN")}`;
}

function parseOptionalInt(value: string): number | "" {
  if (value.trim().length <= 0) {
    return "";
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return Math.max(0, Math.floor(parsed));
}

export function NodeActionPage() {
  const {
    findNodeById,
    getRegionBulletinMissions,
    getRegionMissionWarning,
    acceptedMissionCount,
    acceptedMissionLimit,
    acceptBulletinMission,
    submitBulletinMission
  } = useMapSystem();
  const {
    items,
    gold,
    grantMissionRewards,
    buyEquipment,
    buyMaterials,
    sellEquipment,
    sellEquipmentBulk,
    consumeMaterials,
    materialItems,
    getItemOwners,
    isEquipmentLocked,
    setEquipmentLocked,
    getEquipmentEnhanceLevel,
    normalEquipmentCapacity,
    normalEquipmentCount,
    isBackpackEquipmentFull
  } = useEquipmentInventory();

  const { nodeId, action } = useParams<{ nodeId: string; action: string }>();

  const [missionFeedback, setMissionFeedback] = useState<string | null>(null);
  const [tradeFeedback, setTradeFeedback] = useState<string | null>(null);
  const [tradeRefreshToken, setTradeRefreshToken] = useState(0);
  const [buildingMaterialRefreshToken, setBuildingMaterialRefreshToken] = useState(0);
  const [buildingMaterialBuyQuantityById, setBuildingMaterialBuyQuantityById] = useState<Record<string, number>>({});
  const defaultQuickSellFilter: Partial<EquipmentQuickSellFilter> = ECONOMY_CONFIG.equipmentTrade.quickSell.defaultFilter;

  const [quickSellMinLevel, setQuickSellMinLevel] = useState<number | "">(
    defaultQuickSellFilter.minLevel ?? ""
  );
  const [quickSellMaxLevel, setQuickSellMaxLevel] = useState<number | "">(
    defaultQuickSellFilter.maxLevel ?? ""
  );
  const [quickSellMinEnhanceLevel, setQuickSellMinEnhanceLevel] = useState<number | "">(
    defaultQuickSellFilter.minEnhanceLevel ?? ""
  );
  const [quickSellMaxEnhanceLevel, setQuickSellMaxEnhanceLevel] = useState<number | "">(
    defaultQuickSellFilter.maxEnhanceLevel ?? ""
  );
  const [quickSellMinScore, setQuickSellMinScore] = useState<number | "">(
    defaultQuickSellFilter.minScore ?? ""
  );
  const [quickSellExcludeEnhanced, setQuickSellExcludeEnhanced] = useState<boolean>(
    Boolean(defaultQuickSellFilter.excludeEnhanced)
  );
  const [quickSellQualityFilters, setQuickSellQualityFilters] = useState<GeneratedEquipment["quality"][]>(
    defaultQuickSellFilter.qualities ?? []
  );
  const [quickSellRankFilters, setQuickSellRankFilters] = useState<GeneratedEquipment["rank"][]>(
    defaultQuickSellFilter.ranks ?? []
  );

  const context = findNodeById(nodeId);

  useEffect(() => {
    setMissionFeedback(null);
    setTradeFeedback(null);
    setTradeRefreshToken(0);
    setBuildingMaterialRefreshToken(0);
    setBuildingMaterialBuyQuantityById({});
  }, [nodeId, action]);

  if (!context) {
    return (
      <section className="page">
        <header className="page-header">
          <h1>未知节点</h1>
          <p>未找到该节点。</p>
        </header>
        <Link className="back-link" to="/">
          返回世界地图
        </Link>
      </section>
    );
  }

  const { node, region } = context;
  const mapQuery = buildWorldMapSearchParams(selectionFromRegion(region)).toString();
  const bulletinMissions = getRegionBulletinMissions(region.id);
  const missionWarning = getRegionMissionWarning(region.id);
  const materialCountMap = (materialItems ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = item.quantity;
    return acc;
  }, {});
  const heroNameMap = useMemo(
    () =>
      heroes.reduce<Record<string, string>>((acc, hero) => {
        acc[hero.id] = hero.name;
        return acc;
      }, {}),
    []
  );

  const isShopAction = action === "shop";
  const tradeOfferCount = ECONOMY_CONFIG.equipmentTrade.offerCountByAction.shop;
  const tradeOfferLevel = Math.max(1, Math.round((region.mapSuppression + 20) / 25));

  const ownedItemUidSet = useMemo(() => new Set(items.map((item) => item.uid)), [items]);

  const tradeOffers = useMemo(() => {
    if (!isShopAction) {
      return [] as Array<{ item: GeneratedEquipment; buyPrice: number }>;
    }
    const seed = `${region.id}-${node.id}-${action}-trade-${tradeRefreshToken}`;
    return generateEquipmentBatch(equipmentTemplates, tradeOfferCount, {
      seed,
      level: tradeOfferLevel,
      source: `node-${action}-equipment-trade`
    }).map((item) => ({
      item,
      buyPrice: getEquipmentBuyPrice(item)
    }));
  }, [action, isShopAction, node.id, region.id, tradeOfferCount, tradeOfferLevel, tradeRefreshToken]);

  const buildingMaterialMarketConfig = useMemo(() => getBuildingMaterialMarketConfig(node.id), [node.id]);
  const buildingMaterialOffers = useMemo(() => {
    if (action !== "build_materials") {
      return [] as Array<{
        id: string;
        name: string;
        tier: BuildingMaterialTier;
        rarity: InventoryResourceRarity;
        basePrice: number;
        unitPrice: number;
        floatPct: number;
      }>;
    }
    return buildingMaterialDefinitions.map((material) => {
      const quote = resolveBuildingMaterialPriceQuote(
        material.basePrice,
        node.id,
        `${material.id}-${buildingMaterialRefreshToken}`
      );
      return {
        ...material,
        unitPrice: quote.unitPrice,
        floatPct: quote.floatPct
      };
    });
  }, [action, buildingMaterialRefreshToken, node.id]);

  const sellableEquipmentEntries = useMemo(() => {
    return items
      .map((item) => {
        const ownerList = getItemOwners(item.uid);
        const enhanceLevel = getEquipmentEnhanceLevel(item.uid);
        const isLocked = isEquipmentLocked(item.uid);
        return {
          item,
          score: computeEquipmentInternalScore(item),
          enhanceLevel,
          isLocked,
          isLegendary: Boolean(legendaryEquipmentIdByUid[item.uid]),
          isEquipped: ownerList.length > 0,
          ownerText:
            ownerList.length > 0
              ? ownerList
                  .map((owner) => {
                    const heroName = heroNameMap[owner.heroId] ?? owner.heroId;
                    return `${heroName}(${owner.slotId})`;
                  })
                  .join(" / ")
              : "",
          sellPrice: getEquipmentSellPrice(item, enhanceLevel)
        };
      })
      .filter((entry) => !entry.isLegendary)
      .sort((left, right) => {
        if (left.isLocked !== right.isLocked) {
          return left.isLocked ? 1 : -1;
        }
        if (left.isEquipped !== right.isEquipped) {
          return left.isEquipped ? 1 : -1;
        }
        if (right.sellPrice !== left.sellPrice) {
          return right.sellPrice - left.sellPrice;
        }
        return left.item.templateName.localeCompare(right.item.templateName, "zh-CN");
      });
  }, [getEquipmentEnhanceLevel, getItemOwners, heroNameMap, isEquipmentLocked, items]);

  const quickSellFilteredEntries = useMemo(() => {
    const qualitySet = new Set(quickSellQualityFilters);
    const rankSet = new Set(quickSellRankFilters);
    return sellableEquipmentEntries.filter((entry) => {
      if (entry.isEquipped || entry.isLocked) {
        return false;
      }
      if (qualitySet.size > 0 && !qualitySet.has(entry.item.quality)) {
        return false;
      }
      if (rankSet.size > 0 && !rankSet.has(entry.item.rank)) {
        return false;
      }
      if (quickSellMinLevel !== "" && entry.item.level < quickSellMinLevel) {
        return false;
      }
      if (quickSellMaxLevel !== "" && entry.item.level > quickSellMaxLevel) {
        return false;
      }
      if (quickSellMinEnhanceLevel !== "" && entry.enhanceLevel < quickSellMinEnhanceLevel) {
        return false;
      }
      if (quickSellMaxEnhanceLevel !== "" && entry.enhanceLevel > quickSellMaxEnhanceLevel) {
        return false;
      }
      if (quickSellMinScore !== "" && entry.score < quickSellMinScore) {
        return false;
      }
      if (quickSellExcludeEnhanced && entry.enhanceLevel > 0) {
        return false;
      }
      return entry.sellPrice > 0;
    });
  }, [
    quickSellExcludeEnhanced,
    quickSellMaxEnhanceLevel,
    quickSellMaxLevel,
    quickSellMinEnhanceLevel,
    quickSellMinLevel,
    quickSellMinScore,
    quickSellQualityFilters,
    quickSellRankFilters,
    sellableEquipmentEntries
  ]);

  const quickSellEstimate = useMemo(
    () => quickSellFilteredEntries.reduce((sum, entry) => sum + entry.sellPrice, 0),
    [quickSellFilteredEntries]
  );

  const handleAcceptMission = (missionId: string) => {
    const mission = bulletinMissions.find((item) => item.id === missionId);
    const accepted = acceptBulletinMission(region.id, missionId);
    if (!accepted.ok) {
      setMissionFeedback(accepted.reason ?? "任务领取失败：请确认任务仍为可领取状态。");
      return;
    }
    setMissionFeedback(
      mission?.type === "collect" ? "任务已领取，可随时上交材料提交。" : "任务已领取，后续战斗击杀会自动累计进度。"
    );
  };

  const handleSubmitMission = (missionId: string) => {
    const mission = bulletinMissions.find((item) => item.id === missionId);
    if (!mission) {
      setMissionFeedback("任务提交失败：未找到任务。");
      return;
    }

    let consumedForCollect = false;
    if (mission.type === "collect") {
      const requirements = mission.collectTargets.map((target) => ({
        materialId: target.materialId,
        quantity: target.requiredQuantity
      }));
      const hasEnough = requirements.every((item) => (materialCountMap[item.materialId] ?? 0) >= item.quantity);
      if (!hasEnough) {
        setMissionFeedback("材料不足，无法提交。请先补齐收集目标后再上交。");
        return;
      }
      consumedForCollect = consumeMaterials(requirements);
      if (!consumedForCollect) {
        setMissionFeedback("材料扣除失败，提交已取消。");
        return;
      }
    }

    const reward = submitBulletinMission(region.id, missionId);
    if (!reward) {
      if (consumedForCollect) {
        grantMissionRewards({
          materials: mission.collectTargets.map((target) => ({
            materialId: target.materialId,
            materialName: target.materialName,
            rarity: target.rarity,
            quantity: target.requiredQuantity
          })),
          consumables: [],
          bounty: 0,
          reputation: 0
        });
      }
      setMissionFeedback("任务提交失败：当前尚未满足提交条件。");
      return;
    }
    grantMissionRewards(reward);
    const materialSummary = reward.materials.map((item) => `${item.materialName} x${item.quantity}`).join("，");
    const consumableSummary = reward.consumables.map((item) => `${item.consumableName} x${item.quantity}`).join("，");
    const summary = [materialSummary, consumableSummary, `赏金 ${reward.bounty}`, `声望 +${reward.reputation}`]
      .filter((item) => item && item.trim().length > 0)
      .join(" / ");
    setMissionFeedback(`任务已结算：${summary}`);
  };

  const handleRefreshTradeOffers = () => {
    setTradeRefreshToken((prev) => prev + 1);
    setTradeFeedback(null);
  };

  const handleRefreshBuildingMaterialOffers = () => {
    setBuildingMaterialRefreshToken((prev) => prev + 1);
    setTradeFeedback(null);
  };

  const handleChangeBuildingMaterialQuantity = (materialId: string, rawValue: string) => {
    const parsed = Number(rawValue);
    const quantity = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
    setBuildingMaterialBuyQuantityById((prev) => ({
      ...prev,
      [materialId]: quantity
    }));
  };

  const handleBuyBuildingMaterial = (materialId: string) => {
    const offer = buildingMaterialOffers.find((entry) => entry.id === materialId);
    if (!offer) {
      setTradeFeedback("当前建材报价不存在。");
      return;
    }
    const quantity = Math.max(1, Math.floor(buildingMaterialBuyQuantityById[materialId] ?? 1));
    const result = buyMaterials([{ materialId, quantity, unitPrice: offer.unitPrice }]);
    if (!result.ok) {
      setTradeFeedback(result.reason ?? "建材购买失败。");
      return;
    }
    setTradeFeedback(`买入成功：${offer.name} x${quantity}，消耗 ${formatCurrency(result.totalCost)} 金币。`);
  };

  const handleBuyOffer = (offer: GeneratedEquipment) => {
    const result = buyEquipment(offer);
    if (!result.ok) {
      setTradeFeedback(result.reason ?? "买入失败。");
      return;
    }
    setTradeFeedback(`买入成功：${offer.templateName}，${formatCurrency(result.price)} 金币。`);
  };

  const handleSellEquipment = (item: GeneratedEquipment) => {
    const result = sellEquipment(item.uid);
    if (!result.ok) {
      setTradeFeedback(result.reason ?? "卖出失败。");
      return;
    }
    setTradeFeedback(`卖出成功：${item.templateName}，${formatCurrency(result.price)} 金币。`);
  };

  const toggleQuickSellQuality = (quality: GeneratedEquipment["quality"]) => {
    setQuickSellQualityFilters((prev) =>
      prev.includes(quality) ? prev.filter((entry) => entry !== quality) : [...prev, quality]
    );
  };

  const toggleQuickSellRank = (rank: GeneratedEquipment["rank"]) => {
    setQuickSellRankFilters((prev) => (prev.includes(rank) ? prev.filter((entry) => entry !== rank) : [...prev, rank]));
  };

  const handleToggleEquipmentLock = (itemUid: string, locked: boolean) => {
    const ok = setEquipmentLocked(itemUid, locked);
    if (!ok) {
      setTradeFeedback("锁定状态更新失败：装备不存在。");
      return;
    }
    setTradeFeedback(locked ? "已锁定装备。" : "已解除锁定。");
  };

  const handleQuickSell = () => {
    if (!isShopAction) {
      return;
    }
    const result = sellEquipmentBulk({
      minLevel: quickSellMinLevel === "" ? null : quickSellMinLevel,
      maxLevel: quickSellMaxLevel === "" ? null : quickSellMaxLevel,
      minEnhanceLevel: quickSellMinEnhanceLevel === "" ? null : quickSellMinEnhanceLevel,
      maxEnhanceLevel: quickSellMaxEnhanceLevel === "" ? null : quickSellMaxEnhanceLevel,
      minScore: quickSellMinScore === "" ? null : quickSellMinScore,
      qualities: quickSellQualityFilters,
      ranks: quickSellRankFilters,
      excludeEnhanced: quickSellExcludeEnhanced
    });
    if (result.soldCount <= 0) {
      setTradeFeedback("未找到满足筛选条件的可出售装备。");
      return;
    }
    setTradeFeedback(`一键卖出完成：${result.soldCount} 件，获得 ${formatCurrency(result.totalPrice)} 金币。`);
  };

  const canSubmitMission = (mission: BulletinMissionState): boolean => {
    if (mission.type === "collect") {
      if (mission.status !== "in_progress") {
        return false;
      }
      return mission.collectTargets.every((target) => (materialCountMap[target.materialId] ?? 0) >= target.requiredQuantity);
    }
    return mission.status === "ready_to_submit";
  };

  const getMissionStatusLabel = (mission: BulletinMissionState): string => {
    if (mission.type === "collect" && mission.status === "in_progress" && canSubmitMission(mission)) {
      return "可提交";
    }
    return missionStatusLabel[mission.status];
  };

  const getMissionObjectiveText = (mission: BulletinMissionState): string => {
    if (mission.type === "collect") {
      const summary = mission.collectTargets.map((target) => `${target.materialName} x${target.requiredQuantity}`).join("，");
      return summary.length > 0 ? `在${region.dominionName}收集并交付：${summary}` : `在${region.dominionName}收集并交付指定材料。`;
    }
    const summary = mission.huntTargets.map((target) => `${target.enemyName} x${target.requiredCount}`).join("，");
    return summary.length > 0 ? `在${region.dominionName}击败：${summary}` : `在${region.dominionName}完成讨伐委派。`;
  };

  if (!isNodeAction(action) || action === "ritual") {
    return <Navigate to={`/node/${node.id}?${mapQuery}&warn=blocked`} replace />;
  }

  if (!canAccessAction(node, action)) {
    return <Navigate to={`/node/${node.id}?${mapQuery}&warn=blocked`} replace />;
  }

  const meta = ACTION_META[action];

  return (
    <section className="page">
      <header className="page-header">
        <h1>{meta.label}</h1>
        <p>
          {node.name} · {mapNodeTypeLabel(node)}
        </p>
      </header>

      <Link className="back-link" to={`/node/${node.id}?${mapQuery}`}>
        返回地点主界面
      </Link>

      {action === "detail" ? (
        <div className="module-grid">
          <HeaderInfo title="环境概览">
            <p>{node.environment}</p>
            <p>当前繁荣度：{node.sim.prosperity.toFixed(1)}</p>
            <p>基础强度：{node.sim.baseStrength.toFixed(1)}</p>
          </HeaderInfo>
          <HeaderInfo title="驻留加成">
            <p>{node.stayBuff}</p>
            <p>
              本月场强：O {node.sim.totalOrder.toFixed(1)} / E {node.sim.totalExpansion.toFixed(1)}
            </p>
          </HeaderInfo>
        </div>
      ) : null}

      {action === "battle" ? (
        <div className="module-grid">
          <HeaderInfo title="讨伐准备">
            <p>战斗系统已接入实时模拟，可直接作为后续正式战斗模板。</p>
            <p>队伍规则：双方 1-6 人，前后排各最多 3 人。</p>
            <Link to={`/battle/${node.id}?${mapQuery}`} className="secondary-btn-link">
              <Shield size={14} />
              进入实时战斗
            </Link>
          </HeaderInfo>
          <HeaderInfo title="侦察情报">
            <p>敌方规模：依据 BL 等级自动生成（1-6 人，含前后排分布）。</p>
            <p>当前地图压制：{region.mapSuppression}%（影响掉落强度与数量）。</p>
            <p>推荐压制值：{Math.max(45, region.mapSuppression)}%</p>
            {node.archetype === "BL3" ? (
              <Link to={`/node/${node.id}/ritual?${mapQuery}`} className="secondary-btn-link">
                挑战 / 开启仪式
              </Link>
            ) : null}
          </HeaderInfo>
        </div>
      ) : null}

      {action === "shop" ? (
        <div className="module-grid">
          <HeaderInfo title="商店基础装备交易（ST1）">
            <p>
              当前金币：{formatCurrency(gold)}。装备容量：{normalEquipmentCount}/{normalEquipmentCapacity}
              {isBackpackEquipmentFull ? "（已满）" : ""}。
            </p>
            <p>规则：已穿戴、已锁定与传说装备不可卖出。传说装备可强化但固定禁止出售。</p>
            {tradeFeedback ? <p className="module-trade-feedback">{tradeFeedback}</p> : null}

            <div className="module-actions-row">
              <button type="button" className="ghost-btn" onClick={handleRefreshTradeOffers}>
                刷新报价
              </button>
            </div>

            <section className="module-quick-sell-panel">
              <h4>一键卖出筛选</h4>
              <div className="module-quick-sell-grid">
                <label>
                  最低等级
                  <input type="number" min={1} value={quickSellMinLevel} onChange={(event) => setQuickSellMinLevel(parseOptionalInt(event.target.value))} />
                </label>
                <label>
                  最高等级
                  <input type="number" min={1} value={quickSellMaxLevel} onChange={(event) => setQuickSellMaxLevel(parseOptionalInt(event.target.value))} />
                </label>
                <label>
                  最低强化
                  <input type="number" min={0} value={quickSellMinEnhanceLevel} onChange={(event) => setQuickSellMinEnhanceLevel(parseOptionalInt(event.target.value))} />
                </label>
                <label>
                  最高强化
                  <input type="number" min={0} value={quickSellMaxEnhanceLevel} onChange={(event) => setQuickSellMaxEnhanceLevel(parseOptionalInt(event.target.value))} />
                </label>
                <label>
                  最低评分
                  <input type="number" min={0} value={quickSellMinScore} onChange={(event) => setQuickSellMinScore(parseOptionalInt(event.target.value))} />
                </label>
                <label className="module-quick-sell-check">
                  <input type="checkbox" checked={quickSellExcludeEnhanced} onChange={(event) => setQuickSellExcludeEnhanced(event.target.checked)} />
                  排除强化装备
                </label>
              </div>

              <div className="module-quick-sell-chip-row">
                {QUICK_SELL_QUALITY_OPTIONS.map((quality) => (
                  <button
                    key={quality}
                    type="button"
                    className={`inventory-tag-chip ${quickSellQualityFilters.includes(quality) ? "active" : ""}`}
                    onClick={() => toggleQuickSellQuality(quality)}
                  >
                    品质：{quality}
                  </button>
                ))}
              </div>

              <div className="module-quick-sell-chip-row">
                {QUICK_SELL_RANK_OPTIONS.map((rank) => (
                  <button
                    key={rank}
                    type="button"
                    className={`inventory-tag-chip ${quickSellRankFilters.includes(rank) ? "active" : ""}`}
                    onClick={() => toggleQuickSellRank(rank)}
                  >
                    品阶：{rank}
                  </button>
                ))}
              </div>

              <div className="module-actions-row module-quick-sell-actions">
                <small>
                  可卖出 {quickSellFilteredEntries.length} 件，预计获得 {formatCurrency(quickSellEstimate)} 金币
                </small>
                <button type="button" className="primary-btn" onClick={handleQuickSell} disabled={quickSellFilteredEntries.length <= 0}>
                  <Coins size={14} />
                  一键卖出
                </button>
              </div>
            </section>

            <div className="module-trade-columns">
              <section className="module-trade-column">
                <h4>买入清单</h4>
                <div className="module-trade-list custom-scrollbar">
                  {tradeOffers.length > 0 ? (
                    tradeOffers.map((entry) => {
                      const alreadyOwned = ownedItemUidSet.has(entry.item.uid);
                      const blockedByCapacity = !legendaryEquipmentIdByUid[entry.item.uid] && isBackpackEquipmentFull;
                      const disabled = alreadyOwned || gold < entry.buyPrice || blockedByCapacity;
                      return (
                        <article key={entry.item.uid} className="module-trade-item">
                          <div className="module-trade-item-main">
                            <strong>{entry.item.templateName}</strong>
                            <small>
                              {EQUIPMENT_SUBTYPE_LABELS[entry.item.subtype]} · Lv.{entry.item.level} · 词条 {entry.item.affixCount}
                            </small>
                          </div>
                          <div className="module-trade-item-actions">
                            <span className="module-trade-item-price">买入 {formatCurrency(entry.buyPrice)}</span>
                            <button type="button" className="ghost-btn small-btn" disabled={disabled} onClick={() => handleBuyOffer(entry.item)}>
                              <ShoppingBag size={13} />
                              {alreadyOwned ? "已拥有" : blockedByCapacity ? "背包已满" : "买入"}
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p>当前无可买入装备。</p>
                  )}
                </div>
              </section>

              <section className="module-trade-column">
                <h4>卖出清单</h4>
                <div className="module-trade-list custom-scrollbar">
                  {sellableEquipmentEntries.length > 0 ? (
                    sellableEquipmentEntries.map((entry) => (
                      <article key={entry.item.uid} className="module-trade-item">
                        <div className="module-trade-item-main">
                          <strong>{entry.item.templateName}</strong>
                          <small>
                            {EQUIPMENT_SUBTYPE_LABELS[entry.item.subtype]} · Lv.{entry.item.level} · 词条 {entry.item.affixCount}
                          </small>
                          <small>评分 {entry.score.toFixed(1)} · 强化 +{entry.enhanceLevel}</small>
                          {entry.isEquipped ? <small>已穿戴：{entry.ownerText || "当前英雄装备中"}</small> : null}
                          {entry.isLocked ? <small>状态：已锁定（不会被一键卖出）</small> : null}
                        </div>
                        <div className="module-trade-item-actions">
                          <span className="module-trade-item-price">卖出 {formatCurrency(entry.sellPrice)}</span>
                          <button type="button" className="ghost-btn small-btn" onClick={() => handleToggleEquipmentLock(entry.item.uid, !entry.isLocked)}>
                            {entry.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                            {entry.isLocked ? "解锁" : "锁定"}
                          </button>
                          <button
                            type="button"
                            className="ghost-btn small-btn"
                            disabled={entry.isEquipped || entry.isLocked || entry.sellPrice <= 0}
                            onClick={() => handleSellEquipment(entry.item)}
                          >
                            <Coins size={13} />
                            卖出
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>当前无可卖出装备。</p>
                  )}
                </div>
              </section>
            </div>
          </HeaderInfo>

          <HeaderInfo title="静态库存（配置预览）">
            <div className="module-table-wrap">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>类型</th>
                    <th>单价</th>
                    <th>库存</th>
                    <th>权重</th>
                  </tr>
                </thead>
                <tbody>
                  {getShopInventory(node).map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.price}</td>
                      <td>{item.stock}</td>
                      <td>{item.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HeaderInfo>
        </div>
      ) : null}

      {action === "build_materials" ? (
        <div className="module-grid">
          <HeaderInfo title="建材交易（ST1）">
            <p>建筑材料仅可在 ST1 主城购买，价格按“基础价 + 主城浮动百分比”实时生成。</p>
            <p>
              当前主城浮动区间：{(buildingMaterialMarketConfig.priceFloatPctRange[0] * 100).toFixed(1)}% ~{" "}
              {(buildingMaterialMarketConfig.priceFloatPctRange[1] * 100).toFixed(1)}%
            </p>
            <p>当前金币：{formatCurrency(gold)}</p>
            {tradeFeedback ? <p className="module-trade-feedback">{tradeFeedback}</p> : null}
            <div className="module-actions-row">
              <button type="button" className="ghost-btn" onClick={handleRefreshBuildingMaterialOffers}>
                刷新建材报价
              </button>
            </div>
            <div className="module-table-wrap">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>材料</th>
                    <th>档次</th>
                    <th>基础价</th>
                    <th>浮动</th>
                    <th>当前单价</th>
                    <th>持有</th>
                    <th>购买</th>
                  </tr>
                </thead>
                <tbody>
                  {buildingMaterialOffers.map((entry) => {
                    const quantity = Math.max(1, Math.floor(buildingMaterialBuyQuantityById[entry.id] ?? 1));
                    const totalCost = entry.unitPrice * quantity;
                    const canBuy = gold >= totalCost;
                    const floatText = `${entry.floatPct >= 0 ? "+" : ""}${(entry.floatPct * 100).toFixed(1)}%`;
                    return (
                      <tr key={entry.id}>
                        <td>{entry.name}</td>
                        <td>{buildingMaterialTierLabel[entry.tier]}</td>
                        <td>{formatCurrency(entry.basePrice)}</td>
                        <td>{floatText}</td>
                        <td>{formatCurrency(entry.unitPrice)}</td>
                        <td>{materialCountMap[entry.id] ?? 0}</td>
                        <td>
                          <div className="module-actions-row">
                            <input
                              type="number"
                              min={1}
                              value={quantity}
                              onChange={(event) => handleChangeBuildingMaterialQuantity(entry.id, event.target.value)}
                            />
                            <button
                              type="button"
                              className="ghost-btn small-btn"
                              disabled={!canBuy}
                              onClick={() => handleBuyBuildingMaterial(entry.id)}
                            >
                              买入 x{quantity}（{formatCurrency(totalCost)}）
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </HeaderInfo>

          <HeaderInfo title="规则说明">
            <p>建筑材料与战斗材料共用同一背包，可在背包材料页筛选“建筑材料”。</p>
            <p>当前版本不限制建筑材料堆叠上限，后续会补齐容量上限与库存规则。</p>
          </HeaderInfo>
        </div>
      ) : null}

      {action === "market" ? (
        <div className="module-grid">
          <HeaderInfo title="商铺（原材料与大宗贸易）">
            <p>当前版本只在 ST1 商店开放装备买卖；ST2 商铺暂为静态配置预览。</p>
            <div className="module-table-wrap">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>材料</th>
                    <th>单价</th>
                    <th>库存</th>
                    <th>出现权重</th>
                  </tr>
                </thead>
                <tbody>
                  {getMarketInventory(node).map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.price}</td>
                      <td>{item.stock}</td>
                      <td>{item.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HeaderInfo>

          <HeaderInfo title="回收规则（配置占位）">
            {marketSellRules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </HeaderInfo>
        </div>
      ) : null}

      {action === "tavern" ? (
        <div className="module-grid">
          <HeaderInfo title="酒馆招募池">
            <div className="offer-grid">
              {getTavernOffers(node).map((offer) => (
                <article key={offer.id} className="offer-card">
                  <h4>{offer.name}</h4>
                  <p>
                    {offer.profession} · {offer.rarity}
                  </p>
                  <p>签约费用：{offer.signingCost}</p>
                  <p>{offer.traits.join(" / ")}</p>
                  <button type="button" className="ghost-btn small-btn">
                    <Users size={13} /> 招募
                  </button>
                </article>
              ))}
            </div>
          </HeaderInfo>
        </div>
      ) : null}

      {action === "forge" ? (
        <div className="module-grid">
          <HeaderInfo title="铁匠铺 - 强化">
            <ForgeEnhancementPanel context="node" />
          </HeaderInfo>

          <HeaderInfo title="铁匠铺 - 打造（占位）">
            <p>打造系统暂未接入正式经济闭环，当前仅保留配方预览。</p>
            {getForgeRecipes(node).map((recipe) => (
              <article key={recipe.id} className="recipe-row">
                <div>
                  <h4>{recipe.name}</h4>
                  <p>
                    品质：{recipe.quality} · 金币：{recipe.goldCost}
                  </p>
                  <p>{recipe.materials.map((item) => `${item.name} x${item.count}`).join(" / ")}</p>
                </div>
                <button type="button" className="ghost-btn small-btn" disabled>
                  <Sword size={13} /> 打造
                </button>
              </article>
            ))}
          </HeaderInfo>
        </div>
      ) : null}

      {action === "bulletin" ? (
        <div className="module-grid">
          <HeaderInfo title="布告栏（地区任务）">
            <p>任务已接入可领取、进度累计与奖励结算闭环。</p>
            <p>赏金与声望都会写入正式状态；声望目前仅做数值展示，暂不提供额外玩法效果。</p>
            <p>
              当前已接取任务：{acceptedMissionCount} / {acceptedMissionLimit}
            </p>
            {missionWarning ? <p>{missionWarning}</p> : null}
            {missionFeedback ? <p>{missionFeedback}</p> : null}
            <div className="mission-list">
              {bulletinMissions.map((mission) => (
                <article key={mission.id} className="mission-card">
                  <h4>{mission.title}</h4>
                  <p>
                    类型：{missionTypeLabel[mission.type]} · 状态：{getMissionStatusLabel(mission)}
                  </p>
                  <p>{getMissionObjectiveText(mission)}</p>
                  {mission.collectTargets.length > 0 ? (
                    <p>
                      收集目标：
                      {mission.collectTargets
                        .map(
                          (target) => `${target.materialName} ${materialCountMap[target.materialId] ?? 0}/${target.requiredQuantity}（${rarityLabel[target.rarity]}）`
                        )
                        .join("，")}
                    </p>
                  ) : null}
                  {mission.huntTargets.length > 0 ? (
                    <p>
                      讨伐目标：
                      {mission.huntTargets
                        .map(
                          (target) => `${target.enemyName} ${mission.progress.enemyKillCounts[target.enemyPrototypeId] ?? 0}/${target.requiredCount}`
                        )
                        .join("，")}
                    </p>
                  ) : null}
                  <p>
                    奖励：
                    {mission.reward.materials.map((item) => `${item.materialName} x${item.quantity}`).join("，") || "无材料奖励"} /{" "}
                    {mission.reward.consumables.map((item) => `${item.consumableName} x${item.quantity}`).join("，") || "无消耗品奖励"} / 赏金 {mission.reward.bounty} / 声望 +{mission.reward.reputation}
                  </p>
                  <div className="module-actions-row">
                    <button
                      type="button"
                      className="ghost-btn small-btn"
                      disabled={mission.status !== "available" || acceptedMissionCount >= acceptedMissionLimit}
                      onClick={() => handleAcceptMission(mission.id)}
                    >
                      <ScrollText size={13} /> 领取委派
                    </button>
                    <button type="button" className="ghost-btn small-btn" disabled={!canSubmitMission(mission)} onClick={() => handleSubmitMission(mission.id)}>
                      <Sparkles size={13} /> 交付悬赏
                    </button>
                  </div>
                </article>
              ))}
              {bulletinMissions.length <= 0 ? <p>当前疆域暂无可用任务。</p> : null}
            </div>
          </HeaderInfo>
        </div>
      ) : null}
    </section>
  );
}
