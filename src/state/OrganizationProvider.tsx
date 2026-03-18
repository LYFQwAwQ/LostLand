import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ORGANIZATION_CONFIG,
  getFoundryEnhancementBonusRate,
  getMissionHallAcceptedLimitBonus,
  getOrganizationBuildingMaxLevel,
  getOrganizationBuildingDefinition,
  getOrganizationRankCapByBaseCoreLevel,
  getRankExpRequirement,
  organizationBuildingDefinitions,
  organizationMainQuestDefinitions
} from "../data/organizationData";
import { useMapSystem } from "./MapSystemProvider";
import type {
  OrganizationBuildingDefinition,
  OrganizationBuildingPlacement,
  OrganizationGridCell,
  OrganizationMainQuestState,
  OrganizationMainQuestStatus,
  OrganizationPlacementCheckResult,
  OrganizationRankState,
  OrganizationTerritoryExpandCheckResult,
  OrganizationTerritoryExpandResult
} from "../types/organization";

interface OrganizationContextValue {
  gridSize: number;
  buildings: OrganizationBuildingDefinition[];
  buildingById: Record<string, OrganizationBuildingDefinition>;
  placements: OrganizationBuildingPlacement[];
  occupancy: Record<string, string>;
  revealedCells: Record<string, true>;
  revealedCellCount: number;
  rankState: OrganizationRankState;
  organizationRankCap: number;
  missionAcceptedLimitBonus: number;
  forgeEnhancementBonusRate: number;
  getBuildingLevel: (definitionId: string) => number;
  pendingExpansionCount: number;
  checkPlacement: (definitionId: string, origin: OrganizationGridCell) => OrganizationPlacementCheckResult;
  checkTerritoryExpansion: (center: OrganizationGridCell) => OrganizationTerritoryExpandCheckResult;
  expandTerritory: (center: OrganizationGridCell) => OrganizationTerritoryExpandResult;
  placeBuilding: (definitionId: string, origin: OrganizationGridCell) => { ok: boolean; message: string; instanceId: string | null };
  removeBuilding: (instanceId: string) => void;
  upgradeBuilding: (instanceId: string) => { ok: boolean; message: string };
  mainQuests: OrganizationMainQuestState[];
  acceptMainQuest: (questId: string) => { ok: boolean; message: string };
  completeMainQuest: (questId: string) => { ok: boolean; message: string };
  addMockOrganizationExp: (amount: number) => void;
}

interface OrganizationProgressState {
  rankState: OrganizationRankState;
  pendingExpansionCount: number;
}

function keyOfCell(x: number, y: number): string {
  return `${x},${y}`;
}

function getPatchRange(patchSize: number): { start: number; end: number } {
  const normalized = Math.max(1, Math.round(patchSize));
  const start = -Math.floor((normalized - 1) / 2);
  const end = start + normalized - 1;
  return { start, end };
}

function collectPatchCells(center: OrganizationGridCell, patchSize: number): OrganizationGridCell[] {
  const { start, end } = getPatchRange(patchSize);
  const cells: OrganizationGridCell[] = [];
  for (let y = center.y + start; y <= center.y + end; y += 1) {
    for (let x = center.x + start; x <= center.x + end; x += 1) {
      if (x < 0 || y < 0 || x >= ORGANIZATION_CONFIG.gridSize || y >= ORGANIZATION_CONFIG.gridSize) {
        continue;
      }
      cells.push({ x, y });
    }
  }
  return cells;
}

function hasAdjacentRevealed(cell: OrganizationGridCell, revealedCells: Record<string, true>): boolean {
  return (
    Boolean(revealedCells[keyOfCell(cell.x + 1, cell.y)]) ||
    Boolean(revealedCells[keyOfCell(cell.x - 1, cell.y)]) ||
    Boolean(revealedCells[keyOfCell(cell.x, cell.y + 1)]) ||
    Boolean(revealedCells[keyOfCell(cell.x, cell.y - 1)])
  );
}

function createInitialRevealedCells(): Record<string, true> {
  const revealedCells: Record<string, true> = {};
  const initialSize = Math.min(ORGANIZATION_CONFIG.initialTerritorySize, ORGANIZATION_CONFIG.gridSize);
  const start = Math.floor((ORGANIZATION_CONFIG.gridSize - initialSize) / 2);
  for (let y = start; y < start + initialSize; y += 1) {
    for (let x = start; x < start + initialSize; x += 1) {
      revealedCells[keyOfCell(x, y)] = true;
    }
  }
  return revealedCells;
}

function createInitialMainQuestStatusById(): Record<string, OrganizationMainQuestStatus> {
  return organizationMainQuestDefinitions.reduce<Record<string, OrganizationMainQuestStatus>>((acc, quest, index) => {
    acc[quest.id] = index === 0 ? "available" : "locked";
    return acc;
  }, {});
}

function placementCells(placement: OrganizationBuildingPlacement, definitions: Record<string, OrganizationBuildingDefinition>): OrganizationGridCell[] {
  const definition = definitions[placement.definitionId];
  if (!definition) {
    return [];
  }
  return definition.shape.map((cell) => ({
    x: placement.origin.x + cell.x,
    y: placement.origin.y + cell.y
  }));
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { setAcceptedMissionExtraCapacity } = useMapSystem();
  const [placements, setPlacements] = useState<OrganizationBuildingPlacement[]>([]);
  const [revealedCells, setRevealedCells] = useState<Record<string, true>>(() => createInitialRevealedCells());
  const [mainQuestStatusById, setMainQuestStatusById] = useState<Record<string, OrganizationMainQuestStatus>>(
    () => createInitialMainQuestStatusById()
  );
  const [progressState, setProgressState] = useState<OrganizationProgressState>({
    rankState: {
      rank: 1,
      currentExp: 0,
      nextRankExp: getRankExpRequirement(1)
    },
    pendingExpansionCount: 0
  });
  const placementSeqRef = useRef(1);

  const buildingById = useMemo<Record<string, OrganizationBuildingDefinition>>(
    () =>
      organizationBuildingDefinitions.reduce<Record<string, OrganizationBuildingDefinition>>((acc, definition) => {
        acc[definition.id] = definition;
        return acc;
      }, {}),
    []
  );

  const occupancy = useMemo<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    placements.forEach((placement) => {
      placementCells(placement, buildingById).forEach((cell) => {
        next[keyOfCell(cell.x, cell.y)] = placement.instanceId;
      });
    });
    return next;
  }, [buildingById, placements]);

  const buildingLevelByDefinition = useMemo<Record<string, number>>(() => {
    return placements.reduce<Record<string, number>>((acc, placement) => {
      const nextLevel = Math.max(1, Math.floor(placement.level));
      const currentLevel = acc[placement.definitionId] ?? 0;
      acc[placement.definitionId] = Math.max(currentLevel, nextLevel);
      return acc;
    }, {});
  }, [placements]);

  const getBuildingLevel = (definitionId: string): number => {
    return buildingLevelByDefinition[definitionId] ?? 0;
  };

  const baseCoreLevel = Math.max(1, getBuildingLevel("base_core"));
  const organizationRankCap = getOrganizationRankCapByBaseCoreLevel(baseCoreLevel);
  const missionAcceptedLimitBonus = getMissionHallAcceptedLimitBonus(getBuildingLevel("mission_hall"));
  const forgeEnhancementBonusRate = getFoundryEnhancementBonusRate(getBuildingLevel("foundry"));

  const revealedCellCount = useMemo(() => Object.keys(revealedCells).length, [revealedCells]);
  const rankState = progressState.rankState;
  const pendingExpansionCount = progressState.pendingExpansionCount;
  const mainQuests = useMemo<OrganizationMainQuestState[]>(
    () =>
      organizationMainQuestDefinitions.map((quest) => ({
        ...quest,
        status: mainQuestStatusById[quest.id] ?? "locked"
      })),
    [mainQuestStatusById]
  );

  useEffect(() => {
    setAcceptedMissionExtraCapacity(missionAcceptedLimitBonus);
  }, [missionAcceptedLimitBonus, setAcceptedMissionExtraCapacity]);

  useEffect(() => {
    setProgressState((prev) => {
      const currentRank = Math.max(1, Math.floor(prev.rankState.rank));
      const clampedRank = Math.min(currentRank, organizationRankCap);
      const nextRankExp = clampedRank >= organizationRankCap ? 0 : getRankExpRequirement(clampedRank);
      const currentExp =
        nextRankExp > 0 ? Math.min(Math.max(0, Math.floor(prev.rankState.currentExp)), nextRankExp) : 0;

      if (
        clampedRank === prev.rankState.rank &&
        currentExp === prev.rankState.currentExp &&
        nextRankExp === prev.rankState.nextRankExp
      ) {
        return prev;
      }

      return {
        ...prev,
        rankState: {
          rank: clampedRank,
          currentExp,
          nextRankExp
        }
      };
    });
  }, [organizationRankCap]);

  const checkPlacement = (definitionId: string, origin: OrganizationGridCell): OrganizationPlacementCheckResult => {
    const definition = buildingById[definitionId];
    if (!definition) {
      return { ok: false, reason: "建筑定义不存在。", cells: [] };
    }

    if (definition.unique && placements.some((placement) => placement.definitionId === definitionId)) {
      return { ok: false, reason: `${definition.name} 为唯一功能建筑，已建造。`, cells: [] };
    }

    const cells = definition.shape.map((cell) => ({
      x: origin.x + cell.x,
      y: origin.y + cell.y
    }));

    for (const cell of cells) {
      if (cell.x < 0 || cell.y < 0 || cell.x >= ORGANIZATION_CONFIG.gridSize || cell.y >= ORGANIZATION_CONFIG.gridSize) {
        return { ok: false, reason: "建筑超出组织地图边界。", cells };
      }
      if (!revealedCells[keyOfCell(cell.x, cell.y)]) {
        return { ok: false, reason: "该区域尚未并入领地，请先扩展地块。", cells };
      }
      if (occupancy[keyOfCell(cell.x, cell.y)]) {
        return { ok: false, reason: "目标地块已被占用。", cells };
      }
    }

    return { ok: true, reason: null, cells };
  };

  const checkTerritoryExpansion = (center: OrganizationGridCell): OrganizationTerritoryExpandCheckResult => {
    const patchCells = collectPatchCells(center, ORGANIZATION_CONFIG.expansionPatchSize);
    if (patchCells.length < ORGANIZATION_CONFIG.expansionPatchSize * ORGANIZATION_CONFIG.expansionPatchSize) {
      return { ok: false, reason: "扩展区域超出地图边界，请换一个位置。", cells: patchCells };
    }

    const hasIntersection = patchCells.some((cell) => Boolean(revealedCells[keyOfCell(cell.x, cell.y)]));
    if (hasIntersection) {
      return { ok: false, reason: "扩展区域不能与现有地块相交。", cells: patchCells };
    }

    const isAdjacentToTerritory = patchCells.some((cell) => hasAdjacentRevealed(cell, revealedCells));
    if (!isAdjacentToTerritory) {
      return { ok: false, reason: "只能扩展与现有领地相邻的区域。", cells: patchCells };
    }

    return { ok: true, reason: null, cells: patchCells };
  };

  const expandTerritory = (center: OrganizationGridCell): OrganizationTerritoryExpandResult => {
    if (pendingExpansionCount <= 0) {
      return { ok: false, message: "当前没有可用的地块扩张次数。", revealedCount: 0 };
    }

    const checked = checkTerritoryExpansion(center);
    if (!checked.ok) {
      return { ok: false, message: checked.reason ?? "该区域无法扩展。", revealedCount: 0 };
    }
    const patchCells = checked.cells;

    setRevealedCells((prev) => {
      const next = { ...prev };
      patchCells.forEach((cell) => {
        next[keyOfCell(cell.x, cell.y)] = true;
      });
      return next;
    });
    setProgressState((prev) => ({
      ...prev,
      pendingExpansionCount: Math.max(0, prev.pendingExpansionCount - 1)
    }));

    return {
      ok: true,
      message: `领地扩展完成，新增 ${patchCells.length} 格地块。`,
      revealedCount: patchCells.length
    };
  };

  const placeBuilding = (definitionId: string, origin: OrganizationGridCell) => {
    const definition = buildingById[definitionId];
    if (!definition) {
      return { ok: false, message: "建筑不存在。", instanceId: null };
    }
    const checked = checkPlacement(definitionId, origin);
    if (!checked.ok) {
      return { ok: false, message: checked.reason ?? "无法建造。", instanceId: null };
    }

    const instanceId = `org-building-${placementSeqRef.current}`;
    placementSeqRef.current += 1;

    setPlacements((prev) => [
      ...prev,
      {
        instanceId,
        definitionId,
        origin,
        level: 1
      }
    ]);

    return { ok: true, message: `${definition.name} 建造完成。`, instanceId };
  };

  const removeBuilding = (instanceId: string) => {
    setPlacements((prev) => prev.filter((placement) => placement.instanceId !== instanceId));
  };

  const upgradeBuilding = (instanceId: string): { ok: boolean; message: string } => {
    const placement = placements.find((item) => item.instanceId === instanceId);
    if (!placement) {
      return { ok: false, message: "建筑实例不存在。" };
    }
    const definition = buildingById[placement.definitionId];
    if (!definition) {
      return { ok: false, message: "建筑定义不存在。" };
    }

    const maxLevel = getOrganizationBuildingMaxLevel(placement.definitionId);
    const safeCurrentLevel = Math.max(1, Math.floor(placement.level));
    if (safeCurrentLevel >= maxLevel) {
      return { ok: false, message: `${definition.name} 已达到当前开放等级上限（Lv.${maxLevel}）。` };
    }

    const nextLevel = safeCurrentLevel + 1;
    setPlacements((prev) =>
      prev.map((item) =>
        item.instanceId === instanceId
          ? {
              ...item,
              level: nextLevel
            }
          : item
      )
    );
    return { ok: true, message: `${definition.name} 已升级至 Lv.${nextLevel}。` };
  };

  const acceptMainQuest = (questId: string): { ok: boolean; message: string } => {
    const questIndex = organizationMainQuestDefinitions.findIndex((quest) => quest.id === questId);
    if (questIndex < 0) {
      return { ok: false, message: "主线任务不存在。" };
    }
    const quest = organizationMainQuestDefinitions[questIndex];
    const status = mainQuestStatusById[questId] ?? "locked";

    if (status === "locked") {
      return { ok: false, message: "该任务尚未解锁，请先完成前置主线。" };
    }
    if (status === "in_progress") {
      return { ok: false, message: "该任务已在进行中。" };
    }
    if (status === "completed") {
      return { ok: false, message: "该任务已完成。" };
    }

    const hasInProgressQuest = organizationMainQuestDefinitions.some(
      (item) => (mainQuestStatusById[item.id] ?? "locked") === "in_progress"
    );
    if (hasInProgressQuest) {
      return { ok: false, message: "当前已有进行中的主线任务，请先完成后再接取下一条。" };
    }

    setMainQuestStatusById((prev) => ({
      ...prev,
      [questId]: "in_progress"
    }));
    return { ok: true, message: `主线任务已接取：${quest.title}` };
  };

  const completeMainQuest = (questId: string): { ok: boolean; message: string } => {
    const questIndex = organizationMainQuestDefinitions.findIndex((quest) => quest.id === questId);
    if (questIndex < 0) {
      return { ok: false, message: "主线任务不存在。" };
    }
    const quest = organizationMainQuestDefinitions[questIndex];
    const status = mainQuestStatusById[questId] ?? "locked";
    if (status !== "in_progress") {
      return { ok: false, message: "仅进行中的主线任务可以完成。" };
    }

    const nextQuest = organizationMainQuestDefinitions[questIndex + 1];
    setMainQuestStatusById((prev) => {
      const next: Record<string, OrganizationMainQuestStatus> = {
        ...prev,
        [questId]: "completed"
      };
      if (nextQuest && (next[nextQuest.id] ?? "locked") === "locked") {
        next[nextQuest.id] = "available";
      }
      return next;
    });

    if (nextQuest) {
      return { ok: true, message: `主线任务已完成：${quest.title}。已解锁下一条主线。` };
    }
    return { ok: true, message: `主线任务已完成：${quest.title}。当前主线序列已全部完成。` };
  };

  const addMockOrganizationExp = (amount: number) => {
    const gain = Math.max(0, Math.round(amount));
    if (gain <= 0) {
      return;
    }
    setProgressState((prev) => {
      let rank = prev.rankState.rank;
      let exp = prev.rankState.currentExp + gain;
      let next =
        prev.rankState.nextRankExp > 0
          ? prev.rankState.nextRankExp
          : rank >= organizationRankCap
            ? 0
            : getRankExpRequirement(rank);
      let rankUpCount = 0;

      while (rank < organizationRankCap && next > 0 && exp >= next) {
        exp -= next;
        rank += 1;
        rankUpCount += 1;
        next = rank >= organizationRankCap ? 0 : getRankExpRequirement(rank);
      }

      if (rank >= organizationRankCap) {
        return {
          rankState: {
            rank: organizationRankCap,
            currentExp: 0,
            nextRankExp: 0
          },
          pendingExpansionCount: prev.pendingExpansionCount + rankUpCount
        };
      }

      return {
        rankState: {
          rank,
          currentExp: exp,
          nextRankExp: next
        },
        pendingExpansionCount: prev.pendingExpansionCount + rankUpCount
      };
    });
  };

  const value = useMemo<OrganizationContextValue>(
    () => ({
      gridSize: ORGANIZATION_CONFIG.gridSize,
      buildings: organizationBuildingDefinitions,
      buildingById,
      placements,
      occupancy,
      revealedCells,
      revealedCellCount,
      rankState,
      organizationRankCap,
      missionAcceptedLimitBonus,
      forgeEnhancementBonusRate,
      getBuildingLevel,
      pendingExpansionCount,
      checkPlacement,
      checkTerritoryExpansion,
      expandTerritory,
      placeBuilding,
      removeBuilding,
      upgradeBuilding,
      mainQuests,
      acceptMainQuest,
      completeMainQuest,
      addMockOrganizationExp
    }),
    [
      buildingById,
      forgeEnhancementBonusRate,
      mainQuests,
      missionAcceptedLimitBonus,
      occupancy,
      organizationRankCap,
      pendingExpansionCount,
      placements,
      rankState,
      revealedCellCount,
      revealedCells
    ]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}

export function getPlacementDefinition(placement: OrganizationBuildingPlacement): OrganizationBuildingDefinition | null {
  return getOrganizationBuildingDefinition(placement.definitionId);
}
