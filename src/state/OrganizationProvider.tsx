import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ORGANIZATION_CONFIG, getOrganizationBuildingDefinition, getRankExpRequirement, organizationBuildingDefinitions } from "../data/organizationData";
import type {
  OrganizationBuildingDefinition,
  OrganizationBuildingPlacement,
  OrganizationGridCell,
  OrganizationPlacementCheckResult,
  OrganizationRankState
} from "../types/organization";

interface OrganizationContextValue {
  gridSize: number;
  buildings: OrganizationBuildingDefinition[];
  buildingById: Record<string, OrganizationBuildingDefinition>;
  placements: OrganizationBuildingPlacement[];
  occupancy: Record<string, string>;
  rankState: OrganizationRankState;
  checkPlacement: (definitionId: string, origin: OrganizationGridCell) => OrganizationPlacementCheckResult;
  placeBuilding: (definitionId: string, origin: OrganizationGridCell) => { ok: boolean; message: string; instanceId: string | null };
  removeBuilding: (instanceId: string) => void;
  upgradeBuilding: (instanceId: string) => void;
  addMockOrganizationExp: (amount: number) => void;
}

function keyOfCell(x: number, y: number): string {
  return `${x},${y}`;
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
  const [placements, setPlacements] = useState<OrganizationBuildingPlacement[]>([]);
  const [rankState, setRankState] = useState<OrganizationRankState>({
    rank: 1,
    currentExp: 0,
    nextRankExp: getRankExpRequirement(1)
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
      if (occupancy[keyOfCell(cell.x, cell.y)]) {
        return { ok: false, reason: "目标地块已被占用。", cells };
      }
    }

    return { ok: true, reason: null, cells };
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

  const upgradeBuilding = (instanceId: string) => {
    setPlacements((prev) =>
      prev.map((placement) =>
        placement.instanceId === instanceId
          ? {
              ...placement,
              level: Math.min(99, placement.level + 1)
            }
          : placement
      )
    );
  };

  const addMockOrganizationExp = (amount: number) => {
    const gain = Math.max(0, Math.round(amount));
    if (gain <= 0) {
      return;
    }
    setRankState((prev) => {
      let rank = prev.rank;
      let exp = prev.currentExp + gain;
      let next = prev.nextRankExp;

      while (rank < ORGANIZATION_CONFIG.maxRank && exp >= next) {
        exp -= next;
        rank += 1;
        next = rank >= ORGANIZATION_CONFIG.maxRank ? 0 : getRankExpRequirement(rank);
      }

      if (rank >= ORGANIZATION_CONFIG.maxRank) {
        return {
          rank: ORGANIZATION_CONFIG.maxRank,
          currentExp: 0,
          nextRankExp: 0
        };
      }

      return {
        rank,
        currentExp: exp,
        nextRankExp: next
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
      rankState,
      checkPlacement,
      placeBuilding,
      removeBuilding,
      upgradeBuilding,
      addMockOrganizationExp
    }),
    [buildingById, occupancy, placements, rankState]
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
