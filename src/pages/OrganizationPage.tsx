import { useMemo, useState } from "react";
import { ForgeCraftPanel } from "../components/forge/ForgeCraftPanel";
import { ForgeEnhancementPanel } from "../components/forge/ForgeEnhancementPanel";
import { getFoundryForgeRecipes } from "../data/nodeModules";
import {
  buildCoreUpgradeSubmitCost,
  getOrganizationBuildingMaxLevel,
  getOrganizationBuildingUpgradeStep,
  getTrainingCampGlobalExpBonusRate,
  getTrainingCampSlotCount
} from "../data/organizationData";
import { getRegionMeta } from "../data/worldMapData";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { useMapSystem } from "../state/MapSystemProvider";
import { useOrganization } from "../state/OrganizationProvider";
import type { OrganizationGridCell } from "../types/organization";
import type { BulletinMissionState } from "../types/game";

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

const mainQuestStatusLabel: Record<"locked" | "available" | "in_progress" | "completed", string> = {
  locked: "未解锁",
  available: "可接取",
  in_progress: "进行中",
  completed: "已完成"
};

function getMissionObjectiveText(mission: BulletinMissionState): string {
  if (mission.type === "collect") {
    const summary = mission.collectTargets.map((target) => `${target.materialName} x${target.requiredQuantity}`).join("，");
    return summary.length > 0 ? `收集并交付：${summary}` : "收集并交付指定材料。";
  }
  const summary = mission.huntTargets.map((target) => `${target.enemyName} x${target.requiredCount}`).join("，");
  return summary.length > 0 ? `击败目标：${summary}` : "完成指定讨伐目标。";
}

function getMissionProgressText(mission: BulletinMissionState, materialCountMap: Record<string, number>): string {
  if (mission.type === "collect") {
    const summary = mission.collectTargets
      .map((target) => `${target.materialName} ${materialCountMap[target.materialId] ?? 0}/${target.requiredQuantity}`)
      .join("，");
    return summary.length > 0 ? `当前记录：${summary}` : "当前记录：收集目标待追踪。";
  }
  const summary = mission.huntTargets
    .map((target) => `${target.enemyName} ${mission.progress.enemyKillCounts[target.enemyPrototypeId] ?? 0}/${target.requiredCount}`)
    .join("，");
  return summary.length > 0 ? `击杀进度：${summary}` : "击杀进度：暂无目标。";
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function OrganizationPage() {
  const { getAcceptedBulletinMissions, acceptedMissionCount, acceptedMissionLimit } = useMapSystem();
  const { materialItems, payCost } = useEquipmentInventory();
  const {
    gridSize,
    buildings,
    buildingById,
    placements,
    rankState,
    organizationRankCap,
    missionAcceptedLimitBonus,
    forgeEnhancementBonusRate,
    getBuildingLevel,
    checkPlacement,
    placeBuilding,
    removeBuilding,
    upgradeBuilding,
    mainQuests,
    acceptMainQuest,
    completeMainQuest,
    chapterTargetRegionId,
    chapterMainlineCounters,
    chapterCompletionSummary,
    submitChapterCoreUpgrade,
    canUseChapterFeature,
    getChapterFeatureLockMessage
  } = useOrganization();

  const [pageFeedback, setPageFeedback] = useState<string | null>(null);
  const [activeFunctionalPlacementId, setActiveFunctionalPlacementId] = useState<string | null>(null);
  const [activeCoreTab, setActiveCoreTab] = useState<"status" | "mainQuest">("status");
  const [functionalFeedback, setFunctionalFeedback] = useState<string | null>(null);

  const materialCountMap = useMemo(() => {
    const countMap: Record<string, number> = {};
    materialItems.forEach((item) => {
      countMap[item.id] = item.quantity;
    });
    return countMap;
  }, [materialItems]);

  const buildingCountByDefinition = useMemo(
    () =>
      placements.reduce<Record<string, number>>((acc, placement) => {
        acc[placement.definitionId] = (acc[placement.definitionId] ?? 0) + 1;
        return acc;
      }, {}),
    [placements]
  );

  const acceptedMissions = getAcceptedBulletinMissions();
  const sortedMainQuests = useMemo(() => {
    const notCompleted = mainQuests.filter((quest) => quest.status !== "completed");
    const completed = mainQuests.filter((quest) => quest.status === "completed");
    return [...notCompleted, ...completed];
  }, [mainQuests]);
  const rankProgress = rankState.nextRankExp > 0 ? Math.min(1, rankState.currentExp / rankState.nextRankExp) : 1;
  const chapterBuildLockMessage = getChapterFeatureLockMessage("organization_build");
  const chapterAdvancedLockedMessage = getChapterFeatureLockMessage("organization_advanced");
  const chapterMapSwitchLockedMessage = getChapterFeatureLockMessage("chapter_map_switch");
  const chapterTargetRegionMeta = getRegionMeta(chapterTargetRegionId);
  const chapterCoreUpgradeCost = useMemo(() => buildCoreUpgradeSubmitCost(), []);
  const foundryRecipes = useMemo(() => getFoundryForgeRecipes(), []);

  const activeFunctionalPlacement = activeFunctionalPlacementId
    ? placements.find((placement) => placement.instanceId === activeFunctionalPlacementId) ?? null
    : null;
  const activeFunctionalDefinition = activeFunctionalPlacement
    ? buildingById[activeFunctionalPlacement.definitionId] ?? null
    : null;
  const activeFunctionalLevel = Math.max(1, Math.floor(activeFunctionalPlacement?.level ?? 1));
  const activeTrainingCampExpBonusRate =
    activeFunctionalDefinition?.id === "training_camp" ? getTrainingCampGlobalExpBonusRate(activeFunctionalLevel) : 0;
  const activeTrainingCampSlotCount =
    activeFunctionalDefinition?.id === "training_camp" ? getTrainingCampSlotCount(activeFunctionalLevel) : 1;
  const builtBuildingCount = placements.length;
  const placementsByDefinition = useMemo(() => {
    return placements.reduce<Record<string, typeof placements>>((acc, placement) => {
      if (!acc[placement.definitionId]) {
        acc[placement.definitionId] = [];
      }
      acc[placement.definitionId].push(placement);
      return acc;
    }, {});
  }, [placements]);

  const findAutoPlacementOrigin = (definitionId: string): OrganizationGridCell | null => {
    const center = Math.floor(gridSize / 2);
    for (let radius = 0; radius < gridSize; radius += 1) {
      const minX = clampRange(center - radius, 0, gridSize - 1);
      const maxX = clampRange(center + radius, 0, gridSize - 1);
      const minY = clampRange(center - radius, 0, gridSize - 1);
      const maxY = clampRange(center + radius, 0, gridSize - 1);

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const checked = checkPlacement(definitionId, { x, y });
          if (checked.ok) {
            return { x, y };
          }
        }
      }
    }
    return null;
  };

  const handleBuild = (definitionId: string) => {
    const definition = buildingById[definitionId];
    if (!definition) {
      setPageFeedback("建筑定义不存在。");
      return;
    }

    if (!canUseChapterFeature("organization_build") && definition.id !== "base_core") {
      setPageFeedback(chapterBuildLockMessage ?? "建筑权限尚未解锁。");
      return;
    }

    const autoOrigin = findAutoPlacementOrigin(definitionId);
    if (!autoOrigin) {
      setPageFeedback(`无法为 ${definition.name} 自动分配位置，请先拆除部分建筑或扩展领地。`);
      return;
    }

    const result = placeBuilding(definitionId, autoOrigin);
    setPageFeedback(result.message);
    if (result.ok && result.instanceId && definition.clickable) {
      setActiveFunctionalPlacementId(result.instanceId);
      setActiveCoreTab("status");
      setFunctionalFeedback(null);
    }
  };

  const handleUpgrade = (instanceId: string) => {
    const placement = placements.find((item) => item.instanceId === instanceId);
    if (!placement) {
      setPageFeedback("建筑实例不存在。");
      return;
    }
    const definition = buildingById[placement.definitionId];
    if (!definition) {
      setPageFeedback("建筑定义不存在。");
      return;
    }
    const nextStep = getOrganizationBuildingUpgradeStep(placement.definitionId, placement.level);
    if (!nextStep) {
      const maxLevel = getOrganizationBuildingMaxLevel(placement.definitionId);
      setPageFeedback(`${definition.name} 已达到当前开放等级上限（Lv.${maxLevel}）。`);
      return;
    }

    const payResult = payCost({
      gold: nextStep.goldCost,
      materials: nextStep.materials.map((item) => ({
        materialId: item.materialId,
        quantity: item.quantity
      }))
    });
    if (!payResult.ok) {
      setPageFeedback(`${definition.name} 升级失败：${payResult.reason ?? "资源不足。"}。`);
      return;
    }
    const upgradeResult = upgradeBuilding(instanceId);
    setPageFeedback(upgradeResult.message);
  };

  const handleOpenBuilding = (instanceId: string) => {
    setActiveFunctionalPlacementId(instanceId);
    setActiveCoreTab("status");
    setFunctionalFeedback(null);
  };

  const closeFunctionalModal = () => {
    setActiveFunctionalPlacementId(null);
    setFunctionalFeedback(null);
    setActiveCoreTab("status");
  };

  const handleAcceptMainQuest = (questId: string) => {
    const result = acceptMainQuest(questId);
    setFunctionalFeedback(result.message);
  };

  const handleCompleteMainQuest = (questId: string) => {
    const result = completeMainQuest(questId);
    setFunctionalFeedback(result.message);
  };

  const handleSubmitCoreUpgrade = () => {
    if (chapterMainlineCounters.coreUpgradeSubmitted > 0) {
      setFunctionalFeedback("核心升级材料已提交完成，无需重复提交。");
      return;
    }
    const payResult = payCost({
      gold: chapterCoreUpgradeCost.gold,
      materials: chapterCoreUpgradeCost.materials
    });
    if (!payResult.ok) {
      setFunctionalFeedback(`核心升级提交失败：${payResult.reason ?? "资源不足。"}。`);
      return;
    }
    const submitResult = submitChapterCoreUpgrade(chapterCoreUpgradeCost);
    setFunctionalFeedback(submitResult.message);
  };

  return (
    <section className="page organization-page">
      <header className="organization-page-header">
        <article className="organization-summary-panel">
          <header>
            <h3>组织基地</h3>
            <p>{chapterTargetRegionMeta?.name ?? chapterTargetRegionId}</p>
          </header>
          <div className="organization-summary-grid">
            <div>
              <span>基地等级</span>
              <strong>Lv.{getBuildingLevel("base_core") || 1}</strong>
            </div>
            <div>
              <span>组织评级</span>
              <strong>Rank {rankState.rank} / {organizationRankCap}</strong>
            </div>
            <div>
              <span>评级经验</span>
              <strong>{rankState.currentExp} / {rankState.nextRankExp || "MAX"}</strong>
            </div>
            <div>
              <span>已建建筑</span>
              <strong>{builtBuildingCount}</strong>
            </div>
            <div>
              <span>任务栏加成</span>
              <strong>+{missionAcceptedLimitBonus}</strong>
            </div>
            <div>
              <span>铁匠加成</span>
              <strong>+{Math.round(forgeEnhancementBonusRate * 100)}%</strong>
            </div>
          </div>
          <div className="organization-rank-progress">
            <span style={{ width: `${rankProgress * 100}%` }} />
          </div>
        </article>
        {chapterMapSwitchLockedMessage ? <p className="organization-header-warning">{chapterMapSwitchLockedMessage}</p> : null}
      </header>

      <div className="organization-simple-stack">
        <section className="organization-panel organization-building-panel">
          <header className="organization-section-head">
            <div>
              <h3>建筑列表</h3>
              <p>每类建筑统一显示建造、升级、功能入口与拆除操作。</p>
            </div>
          </header>
          {!canUseChapterFeature("organization_build") ? <p className="organization-inline-warning">{chapterBuildLockMessage}</p> : null}
          <div className="organization-unified-list">
            {buildings.map((definition) => {
              const builtPlacements = placementsByDefinition[definition.id] ?? [];
              const primaryPlacement =
                builtPlacements.length > 0
                  ? [...builtPlacements].sort((left, right) => right.level - left.level)[0]
                  : null;
              const maxLevel = getOrganizationBuildingMaxLevel(definition.id);
              const nextStep = primaryPlacement ? getOrganizationBuildingUpgradeStep(definition.id, primaryPlacement.level) : null;
              const canBuildMore = !definition.unique || builtPlacements.length <= 0;
              const statusText = primaryPlacement
                ? definition.unique
                  ? `已建 Lv.${primaryPlacement.level} / ${maxLevel}`
                  : `已建 ${builtPlacements.length} 座 · 最高 Lv.${primaryPlacement.level} / ${maxLevel}`
                : "未建造";
              return (
                <article key={definition.id} className={`organization-unified-item ${primaryPlacement ? "is-built" : "is-empty"}`}>
                  <header>
                    <div>
                      <h4>{definition.name}</h4>
                      <p>{statusText}</p>
                    </div>
                    <span>{definition.category === "functional" ? "功能" : "增幅"}</span>
                  </header>
                  <p>{definition.effect}</p>
                  {primaryPlacement ? (
                    nextStep ? (
                      <div className="organization-upgrade-box">
                        <strong>{nextStep.effect}</strong>
                        <p>
                          金币 {nextStep.goldCost.toLocaleString("zh-CN")} /{" "}
                          {nextStep.materials
                            .map((item) => `${item.materialName} x${item.quantity}（${materialCountMap[item.materialId] ?? 0}）`)
                            .join("，")}
                        </p>
                      </div>
                    ) : (
                      <div className="organization-upgrade-box capped">
                        <strong>已达上限</strong>
                        <p>当前开放等级已满。</p>
                      </div>
                    )
                  ) : (
                    <div className="organization-upgrade-box capped">
                      <strong>待建造</strong>
                      <p>建造后可查看升级消耗与功能入口。</p>
                    </div>
                  )}
                  <div className="organization-row-actions">
                    {canBuildMore ? (
                      <button
                        type="button"
                        className="ghost-btn icon-text-btn small-btn"
                        onClick={() => handleBuild(definition.id)}
                      >
                        {primaryPlacement ? "继续建造" : "建造"}
                      </button>
                    ) : null}
                    {primaryPlacement ? (
                      <>
                        <button
                          type="button"
                          className="ghost-btn icon-text-btn small-btn"
                          onClick={() => handleUpgrade(primaryPlacement.instanceId)}
                          disabled={!nextStep}
                        >
                          升级
                        </button>
                        {definition.clickable ? (
                          <button
                            type="button"
                            className="ghost-btn icon-text-btn small-btn"
                            onClick={() => handleOpenBuilding(primaryPlacement.instanceId)}
                          >
                            功能
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="ghost-btn small-btn"
                          onClick={() => {
                            removeBuilding(primaryPlacement.instanceId);
                            setPageFeedback(`${definition.name} 已拆除。`);
                          }}
                          disabled={definition.id === "base_core"}
                        >
                          拆除
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          {pageFeedback ? <p className="organization-feedback">{pageFeedback}</p> : null}
        </section>
      </div>

      {activeFunctionalPlacementId ? (
        <div className="organization-modal-backdrop" role="presentation" onClick={closeFunctionalModal}>
          <article className="organization-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>{activeFunctionalDefinition?.name ?? "功能建筑"}</h3>
            {activeFunctionalDefinition?.id === "base_core" ? (
              <>
                <div className="organization-functional-tabs">
                  <button
                    type="button"
                    className={`ghost-btn ${activeCoreTab === "status" ? "active" : ""}`}
                    onClick={() => setActiveCoreTab("status")}
                  >
                    基地状态
                  </button>
                  <button
                    type="button"
                    className={`ghost-btn ${activeCoreTab === "mainQuest" ? "active" : ""}`}
                    onClick={() => setActiveCoreTab("mainQuest")}
                  >
                    主线任务
                  </button>
                </div>
                {activeCoreTab === "status" ? (
                  <>
                    <p>
                      当前评级上限：Rank {organizationRankCap}（基地核心 Lv.{getBuildingLevel("base_core") || 1}）
                    </p>
                    <p>当前组织已建造建筑总数：{placements.length}</p>
                    <p>第一章目标地区：{chapterTargetRegionMeta?.name ?? chapterTargetRegionId}</p>
                    <p>主线累计：建材采购 {chapterMainlineCounters.buildMaterialPurchased} / 战斗胜场 {chapterMainlineCounters.battleWins}</p>
                    <p>主线累计：核心升级提交 {chapterMainlineCounters.coreUpgradeSubmitted} / 建造 {chapterMainlineCounters.buildingsConstructed}</p>
                    <p>主线累计：目标地区压制 {chapterMainlineCounters.targetRegionSuppression}%</p>
                    <div className="organization-core-status-list">
                      {Object.entries(buildingCountByDefinition).length > 0 ? (
                        Object.entries(buildingCountByDefinition)
                          .sort((left, right) => right[1] - left[1])
                          .map(([definitionId, count]) => (
                            <p key={definitionId}>
                              {buildingById[definitionId]?.name ?? definitionId}：{count}
                            </p>
                          ))
                      ) : (
                        <p>当前尚未建造任何建筑。</p>
                      )}
                    </div>
                    {chapterCompletionSummary ? (
                      <div className="organization-chapter-summary">
                        <h4>第一章完成结算</h4>
                        <p>完成月份：第 {chapterCompletionSummary.completedAtWorldMonth} 月（总耗时 {chapterCompletionSummary.elapsedMonths} 月）</p>
                        <p>建材采购：{chapterCompletionSummary.buildMaterialPurchased}</p>
                        <p>战斗胜场：{chapterCompletionSummary.battleWins}</p>
                        <p>核心升级提交：{chapterCompletionSummary.coreUpgradeSubmitted}</p>
                        <p>建造数量：{chapterCompletionSummary.buildingsConstructed}</p>
                        <p>目标地区压制：{chapterCompletionSummary.targetRegionSuppression}%</p>
                      </div>
                    ) : null}
                    <p className="organization-mission-note">
                      {chapterCompletionSummary
                        ? "章节主线已完成，地图切换与高级功能限制已解除。"
                        : "完成主线后将显示章节结算面板并解除系统封锁。"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="organization-mission-note">主线任务为固定任务线，不参与随机生成。已完成任务会保留在列表底部。</p>
                    {functionalFeedback ? <p>{functionalFeedback}</p> : null}
                    <div className="organization-main-quest-list">
                      {sortedMainQuests.map((quest) => (
                        <article
                          key={quest.id}
                          className={`organization-main-quest-item ${quest.status === "completed" ? "completed" : ""} ${
                            quest.status === "locked" ? "locked" : ""
                          }`}
                        >
                          <h4>{quest.title}</h4>
                          <p>状态：{mainQuestStatusLabel[quest.status]}</p>
                          <p>{quest.summary}</p>
                          <p>目标：{quest.objective}</p>
                          <p>{quest.progress.progressText}</p>
                          <div className="organization-row-actions">
                            {quest.status === "available" ? (
                              <button type="button" className="ghost-btn small-btn" onClick={() => handleAcceptMainQuest(quest.id)}>
                                接取任务
                              </button>
                            ) : null}
                            {quest.status === "in_progress" ? (
                              <>
                                {quest.conditionType === "core_upgrade_submit" ? (
                                  <button
                                    type="button"
                                    className="ghost-btn small-btn"
                                    onClick={handleSubmitCoreUpgrade}
                                    disabled={quest.progress.isReached}
                                  >
                                    提交核心升级材料
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="ghost-btn small-btn"
                                  onClick={() => handleCompleteMainQuest(quest.id)}
                                  disabled={!quest.progress.isReached}
                                >
                                  完成任务
                                </button>
                              </>
                            ) : null}
                          </div>
                          {quest.status === "in_progress" && quest.conditionType === "core_upgrade_submit" ? (
                            <p className="organization-mission-note">
                              提交消耗：金币 {chapterCoreUpgradeCost.gold.toLocaleString("zh-CN")} /{" "}
                              {chapterCoreUpgradeCost.materials
                                .map((item: { materialId: string; materialName: string; quantity: number }) => `${item.materialName} x${item.quantity}（持有 ${materialCountMap[item.materialId] ?? 0}）`)
                                .join("，")}
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : activeFunctionalDefinition?.id === "mission_hall" ? (
              <>
                <p>
                  当前已接取任务：{acceptedMissionCount} / {acceptedMissionLimit}
                </p>
                <p>任务大厅等级加成：+{missionAcceptedLimitBonus} 任务栏上限。</p>
                <p className="organization-mission-note">收集任务的可交付判定以背包实时材料为准，此处展示任务目标与当前记录。</p>
                {acceptedMissions.length > 0 ? (
                  <div className="organization-mission-list">
                    {acceptedMissions.map((mission) => {
                      const regionMeta = getRegionMeta(mission.regionId);
                      return (
                        <article key={mission.id} className="organization-mission-item">
                          <h4>{mission.title}</h4>
                          <p>
                            {regionMeta?.dominionName ?? "未知疆域"} · {regionMeta?.name ?? mission.regionId}
                          </p>
                          <p>
                            类型：{missionTypeLabel[mission.type]} · 状态：{missionStatusLabel[mission.status]}
                          </p>
                          <p>{getMissionObjectiveText(mission)}</p>
                          <p>{getMissionProgressText(mission, materialCountMap)}</p>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p>当前没有已接取任务。可前往任意节点布告栏领取后再查看。</p>
                )}
              </>
            ) : activeFunctionalDefinition?.id === "foundry" ? (
              <>
                <p>铁匠铺等级：Lv.{activeFunctionalLevel}</p>
                {chapterAdvancedLockedMessage ? (
                  <p className="warn">{chapterAdvancedLockedMessage}</p>
                ) : (
                  <>
                    <ForgeEnhancementPanel context="organization" />
                    <ForgeCraftPanel recipes={foundryRecipes} context="organization" />
                    <p className="organization-mission-note">组织入口当前使用固定打造配方；节点入口会叠加地区化金币浮动。</p>
                  </>
                )}
              </>
            ) : activeFunctionalDefinition?.id === "training_camp" ? (
              <>
                <p>训练营等级：Lv.{activeFunctionalLevel}</p>
                <p>全局经验收益加成（展示）：+{Math.round(activeTrainingCampExpBonusRate * 100)}%</p>
                <p>训练槽位：{activeTrainingCampSlotCount}（当前点击仅占位，不触发训练流程）。</p>
                {functionalFeedback ? <p>{functionalFeedback}</p> : null}
                <div className="organization-row-actions">
                  {Array.from({ length: activeTrainingCampSlotCount }).map((_, index) => (
                    <button
                      key={`training-slot-${index + 1}`}
                      type="button"
                      className="ghost-btn small-btn"
                      onClick={() => setFunctionalFeedback(`训练槽位 ${index + 1} 已选中（训练流程暂未接入）。`)}
                    >
                      槽位 {index + 1}
                    </button>
                  ))}
                </div>
                <p className="organization-mission-note">后续将接入“驻训英雄持续获取经验”正式流程。</p>
              </>
            ) : (
              <>
                <p>{activeFunctionalDefinition?.name ?? "当前建筑"} 的功能界面将在后续阶段接入。</p>
                <p>当前版本已保留功能入口与升级链路。</p>
              </>
            )}
            <div className="organization-row-actions">
              <button type="button" className="ghost-btn" onClick={closeFunctionalModal}>
                关闭
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
