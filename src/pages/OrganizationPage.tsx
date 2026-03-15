import { Building2, Compass, Hand, Plus, Search, ScrollText, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, WheelEvent } from "react";
import { ORGANIZATION_CONFIG } from "../data/organizationData";
import { getRegionMeta } from "../data/worldMapData";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { useMapSystem } from "../state/MapSystemProvider";
import { useOrganization } from "../state/OrganizationProvider";
import type { OrganizationBuildingPlacement, OrganizationGridCell } from "../types/organization";
import type { BulletinMissionState } from "../types/game";

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function placementBounds(placement: OrganizationBuildingPlacement, shape: OrganizationGridCell[]) {
  const cells = shape.map((cell) => ({ x: placement.origin.x + cell.x, y: placement.origin.y + cell.y }));
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  return {
    cells,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

export function OrganizationPage() {
  const { getAcceptedBulletinMissions, acceptedMissionCount, acceptedMissionLimit } = useMapSystem();
  const { materialItems } = useEquipmentInventory();
  const {
    gridSize,
    buildings,
    buildingById,
    placements,
    occupancy,
    revealedCells,
    revealedCellCount,
    rankState,
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
  } = useOrganization();
  const initialTerritorySize = Math.min(ORGANIZATION_CONFIG.initialTerritorySize, gridSize);
  const initialTerritoryStart = Math.floor((gridSize - initialTerritorySize) / 2);
  const defaultOffset = 20 - initialTerritoryStart * ORGANIZATION_CONFIG.boardCellSize;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const autoCenteredRef = useRef(false);

  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>(buildings[0]?.id ?? "");
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<OrganizationGridCell | null>(null);
  const [hoverCard, setHoverCard] = useState<{ instanceId: string; x: number; y: number } | null>(null);
  const [feedback, setFeedback] = useState<string>("请选择建筑后在已扩展领地内点击建造。");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: defaultOffset, y: defaultOffset });
  const [interactionMode, setInteractionMode] = useState<"build" | "expand" | "pan">("build");
  const [drag, setDrag] = useState<DragState>({ active: false, startX: 0, startY: 0, originX: 20, originY: 20 });
  const [activeFunctionalPlacementId, setActiveFunctionalPlacementId] = useState<string | null>(null);
  const [activeCoreTab, setActiveCoreTab] = useState<"status" | "mainQuest">("status");
  const [functionalFeedback, setFunctionalFeedback] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const selectedDefinition = selectedDefinitionId ? buildingById[selectedDefinitionId] : null;
  const placementById = useMemo(
    () =>
      placements.reduce<Record<string, OrganizationBuildingPlacement>>((acc, placement) => {
        acc[placement.instanceId] = placement;
        return acc;
      }, {}),
    [placements]
  );

  const uniqueBuiltSet = useMemo(() => new Set(placements.map((placement) => placement.definitionId)), [placements]);

  const preview = useMemo(() => {
    if (!selectedDefinition || !hoveredCell || interactionMode !== "build") {
      return null;
    }
    return checkPlacement(selectedDefinition.id, hoveredCell);
  }, [checkPlacement, hoveredCell, interactionMode, selectedDefinition]);

  const previewCellSet = useMemo(() => {
    const set = new Set<string>();
    if (!preview) {
      return set;
    }
    preview.cells.forEach((cell) => set.add(cellKey(cell.x, cell.y)));
    return set;
  }, [preview]);

  const expansionPreview = useMemo(() => {
    if (interactionMode !== "expand" || !hoveredCell) {
      return null;
    }
    if (revealedCells[cellKey(hoveredCell.x, hoveredCell.y)]) {
      return null;
    }
    return checkTerritoryExpansion(hoveredCell);
  }, [checkTerritoryExpansion, hoveredCell, interactionMode, revealedCells]);

  const expansionPreviewCellSet = useMemo(() => {
    const set = new Set<string>();
    if (!expansionPreview) {
      return set;
    }
    expansionPreview.cells.forEach((cell) => set.add(cellKey(cell.x, cell.y)));
    return set;
  }, [expansionPreview]);

  const selectedPlacementCellSet = useMemo(() => {
    const set = new Set<string>();
    if (!selectedPlacementId) {
      return set;
    }
    const selectedPlacement = placementById[selectedPlacementId];
    if (!selectedPlacement) {
      return set;
    }
    const definition = buildingById[selectedPlacement.definitionId];
    if (!definition) {
      return set;
    }
    definition.shape.forEach((cell) => {
      set.add(cellKey(selectedPlacement.origin.x + cell.x, selectedPlacement.origin.y + cell.y));
    });
    return set;
  }, [buildingById, placementById, selectedPlacementId]);

  const visibleHoverPlacement = hoverCard ? placementById[hoverCard.instanceId] ?? null : null;
  const visibleHoverDefinition = visibleHoverPlacement ? buildingById[visibleHoverPlacement.definitionId] ?? null : null;
  const selectedPlacement = selectedPlacementId ? placementById[selectedPlacementId] ?? null : null;
  const selectedPlacementDefinition = selectedPlacement ? buildingById[selectedPlacement.definitionId] ?? null : null;
  const rankProgress =
    rankState.nextRankExp > 0 ? Math.min(1, rankState.currentExp / rankState.nextRankExp) : 1;
  const expansionPatchLabel = `${ORGANIZATION_CONFIG.expansionPatchSize}x${ORGANIZATION_CONFIG.expansionPatchSize}`;
  const cellSize = ORGANIZATION_CONFIG.boardCellSize;
  const acceptedMissions = getAcceptedBulletinMissions();
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
  const sortedMainQuests = useMemo(() => {
    const notCompleted = mainQuests.filter((quest) => quest.status !== "completed");
    const completed = mainQuests.filter((quest) => quest.status === "completed");
    return [...notCompleted, ...completed];
  }, [mainQuests]);
  const activeFunctionalDefinition = activeFunctionalPlacementId
    ? buildingById[placementById[activeFunctionalPlacementId]?.definitionId ?? ""]
    : null;

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return;
    }

    const updateSize = () => {
      setViewportSize({
        width: viewportElement.clientWidth,
        height: viewportElement.clientHeight
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeFunctionalPlacementId) {
      return;
    }
    setActiveCoreTab("status");
    setFunctionalFeedback(null);
  }, [activeFunctionalPlacementId]);

  const visibleCellRange = useMemo(() => {
    const scaledCellSize = cellSize * zoom;
    if (scaledCellSize <= 0 || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return { minX: 0, maxX: gridSize - 1, minY: 0, maxY: gridSize - 1 };
    }

    const margin = 2;
    const minX = clamp(Math.floor(-offset.x / scaledCellSize) - margin, 0, gridSize - 1);
    const maxX = clamp(Math.ceil((viewportSize.width - offset.x) / scaledCellSize) + margin, 0, gridSize - 1);
    const minY = clamp(Math.floor(-offset.y / scaledCellSize) - margin, 0, gridSize - 1);
    const maxY = clamp(Math.ceil((viewportSize.height - offset.y) / scaledCellSize) + margin, 0, gridSize - 1);

    return { minX, maxX, minY, maxY };
  }, [cellSize, gridSize, offset.x, offset.y, viewportSize.height, viewportSize.width, zoom]);

  const renderedCells = useMemo(() => {
    const cells: Array<{ x: number; y: number; key: string; isRevealed: boolean }> = [];
    const showFogGrid = interactionMode === "expand";
    for (let y = visibleCellRange.minY; y <= visibleCellRange.maxY; y += 1) {
      for (let x = visibleCellRange.minX; x <= visibleCellRange.maxX; x += 1) {
        const key = cellKey(x, y);
        const isRevealed = Boolean(revealedCells[key]);
        if (!isRevealed && !showFogGrid) {
          continue;
        }
        cells.push({ x, y, key, isRevealed });
      }
    }
    return cells;
  }, [interactionMode, revealedCells, visibleCellRange.maxX, visibleCellRange.maxY, visibleCellRange.minX, visibleCellRange.minY]);

  const territoryBounds = useMemo(() => {
    const keys = Object.keys(revealedCells);
    if (keys.length <= 0) {
      return null;
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    keys.forEach((key) => {
      const [xText, yText] = key.split(",");
      const x = Number(xText);
      const y = Number(yText);
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return;
      }
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }
    return { minX, minY, maxX, maxY };
  }, [revealedCells]);

  const applyZoom = (requestedZoom: number, anchor?: { x: number; y: number }) => {
    const nextZoom = Math.max(ORGANIZATION_CONFIG.minZoom, Math.min(ORGANIZATION_CONFIG.maxZoom, Number(requestedZoom.toFixed(2))));
    if (Math.abs(nextZoom - zoom) < 0.0001) {
      return;
    }
    const anchorX = anchor?.x ?? viewportSize.width / 2;
    const anchorY = anchor?.y ?? viewportSize.height / 2;
    setOffset((prev) => {
      const worldX = (anchorX - prev.x) / zoom;
      const worldY = (anchorY - prev.y) / zoom;
      return {
        x: anchorX - worldX * nextZoom,
        y: anchorY - worldY * nextZoom
      };
    });
    setZoom(nextZoom);
  };

  const centerOnOwnedTerritory = (targetZoom: number) => {
    if (!territoryBounds || viewportSize.width <= 0 || viewportSize.height <= 0) {
      setOffset({ x: defaultOffset, y: defaultOffset });
      return;
    }
    const centerX = ((territoryBounds.minX + territoryBounds.maxX + 1) / 2) * cellSize;
    const centerY = ((territoryBounds.minY + territoryBounds.maxY + 1) / 2) * cellSize;
    setOffset({
      x: viewportSize.width / 2 - centerX * targetZoom,
      y: viewportSize.height / 2 - centerY * targetZoom
    });
  };

  useEffect(() => {
    if (autoCenteredRef.current) {
      return;
    }
    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }
    centerOnOwnedTerritory(zoom);
    autoCenteredRef.current = true;
  }, [viewportSize.height, viewportSize.width, zoom]);

  const placeAt = (cell: OrganizationGridCell) => {
    if (interactionMode === "pan") {
      return;
    }

    const key = cellKey(cell.x, cell.y);

    if (interactionMode === "expand") {
      const result = expandTerritory(cell);
      setFeedback(result.message);
      if (result.ok && pendingExpansionCount <= 1) {
        setInteractionMode("build");
      }
      return;
    }

    const occupantId = occupancy[key];
    if (occupantId) {
      setSelectedPlacementId(occupantId);
      const placement = placementById[occupantId];
      const definition = placement ? buildingById[placement.definitionId] : null;
      if (definition?.clickable) {
        setActiveFunctionalPlacementId(occupantId);
      }
      return;
    }

    if (!revealedCells[key]) {
      setFeedback("该区域不在当前领地范围内，请先扩展到该方向。");
      return;
    }

    if (!selectedDefinition) {
      setFeedback("请先在左侧选择一个建筑。");
      return;
    }

    const result = placeBuilding(selectedDefinition.id, cell);
    setFeedback(result.message);
    if (result.ok && result.instanceId) {
      setSelectedPlacementId(result.instanceId);
    }
  };

  const resolveCellFromClient = (clientX: number, clientY: number): OrganizationGridCell | null => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - offset.x) / zoom;
    const worldY = (localY - offset.y) / zoom;
    const x = Math.floor(worldX / cellSize);
    const y = Math.floor(worldY / cellSize);
    if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) {
      return null;
    }
    return { x, y };
  };

  const onViewportMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (interactionMode !== "pan") {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    setDrag({
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    });
  };

  const onViewportMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (drag.active) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      setOffset({
        x: drag.originX + dx,
        y: drag.originY + dy
      });
      return;
    }

    if (interactionMode === "pan") {
      return;
    }

    const cell = resolveCellFromClient(event.clientX, event.clientY);
    setHoveredCell((prev) => {
      if (!cell) {
        return prev ? null : prev;
      }
      if (prev?.x === cell.x && prev?.y === cell.y) {
        return prev;
      }
      return cell;
    });

    if (!cell) {
      setHoverCard(null);
      return;
    }

    const occupantId = occupancy[cellKey(cell.x, cell.y)];
    if (!occupantId) {
      setHoverCard(null);
      return;
    }
    setHoverCard((prev) => {
      if (
        prev &&
        prev.instanceId === occupantId &&
        Math.abs(prev.x - event.clientX) < 2 &&
        Math.abs(prev.y - event.clientY) < 2
      ) {
        return prev;
      }
      return { instanceId: occupantId, x: event.clientX, y: event.clientY };
    });
  };

  const stopDrag = () => {
    if (!drag.active) {
      return;
    }
    setDrag((prev) => ({ ...prev, active: false }));
  };

  const onWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = viewportRef.current?.getBoundingClientRect();
    const anchorX = rect ? event.clientX - rect.left : viewportSize.width / 2;
    const anchorY = rect ? event.clientY - rect.top : viewportSize.height / 2;
    const next = zoom - Math.sign(event.deltaY) * ORGANIZATION_CONFIG.zoomStep;
    applyZoom(next, { x: anchorX, y: anchorY });
  };

  const onViewportContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (interactionMode !== "pan") {
      setInteractionMode("pan");
      setFeedback("已切换为拖拽平移模式（右键快捷）。");
    }
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

  return (
    <section className="page organization-page">
      <header className="organization-page-header">
        <article className="organization-rank-inline">
          <h3>
            <Compass size={14} />
            组织评级
          </h3>
          <div className="organization-rank-inline-main">
            <p>
              Rank {rankState.rank} / {ORGANIZATION_CONFIG.maxRank}
            </p>
            <div className="organization-rank-progress">
              <span style={{ width: `${rankProgress * 100}%` }} />
            </div>
            <p>
              经验：{rankState.currentExp} / {rankState.nextRankExp || "MAX"}
            </p>
            <p>
              当前领地：{revealedCellCount} 格 · 可扩展次数：{pendingExpansionCount}
            </p>
          </div>
          <button type="button" className="ghost-btn" onClick={() => addMockOrganizationExp(120)}>
            <Plus size={13} /> 模拟获取组织经验
          </button>
        </article>
      </header>

      <div className="organization-layout">
        <aside className="organization-left-rail">
          <article className="organization-card">
            <h3>
              <Search size={14} />
              选中建筑
            </h3>
            {selectedPlacement && selectedPlacementDefinition ? (
              <div className="organization-selected-meta">
                <p>
                  <strong>{selectedPlacementDefinition.name}</strong> · Lv.{selectedPlacement.level}
                </p>
                <p>
                  坐标：({selectedPlacement.origin.x}, {selectedPlacement.origin.y})
                </p>
                <div className="organization-row-actions">
                  <button type="button" className="ghost-btn" onClick={() => upgradeBuilding(selectedPlacement.instanceId)}>
                    <Plus size={12} /> 升级（占位）
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      removeBuilding(selectedPlacement.instanceId);
                      setSelectedPlacementId(null);
                    }}
                  >
                    <Trash2 size={12} /> 拆除
                  </button>
                </div>
              </div>
            ) : (
              <p className="organization-empty">点击地图上的建筑查看详情。</p>
            )}
          </article>
        </aside>

        <div className="organization-stage-card">
          <header className="organization-stage-tools">
            <h3>组织地图</h3>
            <div className="organization-stage-actions">
              <button
                type="button"
                className="ghost-btn"
                onClick={() => applyZoom(zoom - ORGANIZATION_CONFIG.zoomStep)}
              >
                <ZoomOut size={13} />
              </button>
              <small>{Math.round(zoom * 100)}%</small>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => applyZoom(zoom + ORGANIZATION_CONFIG.zoomStep)}
              >
                <ZoomIn size={13} />
              </button>
              <button type="button" className="ghost-btn" onClick={() => centerOnOwnedTerritory(zoom)}>
                复位视角
              </button>
              <small>地块 {revealedCellCount} / {gridSize * gridSize}</small>
            </div>
          </header>

          <div
            ref={viewportRef}
            className="organization-viewport"
            onMouseDown={onViewportMouseDown}
            onMouseMove={onViewportMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={() => {
              stopDrag();
              setHoveredCell(null);
              setHoverCard(null);
            }}
            onWheel={onWheelZoom}
            onContextMenu={onViewportContextMenu}
          >
            <div
              className="organization-canvas"
              style={{
                width: `${gridSize * cellSize}px`,
                height: `${gridSize * cellSize}px`,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
              }}
            >
              <div
                className={`organization-grid ${interactionMode === "pan" ? "pan-pass-through" : ""}`}
                style={{ ["--org-cell-size" as string]: `${cellSize}px` } as CSSProperties}
              >
                {renderedCells.map((cell) => {
                  const occupantId = occupancy[cell.key];
                  const occupant = occupantId ? placementById[occupantId] : null;
                  const occupantDefinition = occupant ? buildingById[occupant.definitionId] : null;
                  const isBuildPreviewCell = previewCellSet.has(cell.key);
                  const isExpansionPreviewCell = expansionPreviewCellSet.has(cell.key);
                  const previewClass =
                    interactionMode === "expand" && isExpansionPreviewCell
                      ? expansionPreview?.ok
                        ? "preview-ok"
                        : "preview-bad"
                      : isBuildPreviewCell
                        ? preview?.ok
                          ? "preview-ok"
                          : "preview-bad"
                        : "";
                  const isSelectedCell = selectedPlacementCellSet.has(cell.key);
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={`organization-cell ${occupant ? "occupied" : ""} ${
                        previewClass
                      } ${isSelectedCell ? "selected" : ""} ${cell.isRevealed ? "revealed" : "fogged"} ${
                        interactionMode === "pan" ? "pan-disabled" : ""
                      } ${interactionMode === "expand" ? "expand-mode" : ""}`}
                      style={
                        ({
                          left: `${cell.x * cellSize}px`,
                          top: `${cell.y * cellSize}px`,
                          width: `${cellSize}px`,
                          height: `${cellSize}px`,
                          ...(occupantDefinition ? { ["--org-building-color" as string]: occupantDefinition.color } : {})
                        } as CSSProperties)
                      }
                      onMouseEnter={(event) => {
                        setHoveredCell((prev) => (prev?.x === cell.x && prev?.y === cell.y ? prev : { x: cell.x, y: cell.y }));
                        if (occupantId) {
                          setHoverCard({ instanceId: occupantId, x: event.clientX, y: event.clientY });
                        }
                      }}
                      onMouseMove={(event) => {
                        if (occupantId) {
                          setHoverCard((prev) => {
                            if (
                              prev &&
                              prev.instanceId === occupantId &&
                              Math.abs(prev.x - event.clientX) < 2 &&
                              Math.abs(prev.y - event.clientY) < 2
                            ) {
                              return prev;
                            }
                            return { instanceId: occupantId, x: event.clientX, y: event.clientY };
                          });
                        }
                      }}
                      onMouseLeave={() => setHoverCard(null)}
                      onClick={() => placeAt({ x: cell.x, y: cell.y })}
                      disabled={interactionMode === "pan"}
                    />
                  );
                })}
              </div>

              {placements.map((placement) => {
                const definition = buildingById[placement.definitionId];
                if (!definition) {
                  return null;
                }
                const bounds = placementBounds(placement, definition.shape);
                const centerX = ((bounds.minX + bounds.maxX + 1) / 2) * cellSize;
                const centerY = ((bounds.minY + bounds.maxY + 1) / 2) * cellSize;
                return (
                  <button
                    key={`label-${placement.instanceId}`}
                    type="button"
                    className={`organization-building-label ${placement.instanceId === selectedPlacementId ? "active" : ""}`}
                    style={{ left: `${centerX}px`, top: `${centerY}px` }}
                    onClick={() => {
                      setSelectedPlacementId(placement.instanceId);
                      if (definition.clickable) {
                        setActiveFunctionalPlacementId(placement.instanceId);
                      }
                    }}
                  >
                    <strong>{definition.name}</strong>
                    <span>Lv.{placement.level}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="organization-right-rail">
          <article className="organization-card">
            <h3>
              <Building2 size={14} />
              建筑面板
            </h3>
            <div className="organization-building-list">
              {buildings.map((definition) => {
                const isSelected = definition.id === selectedDefinitionId;
                const isBuiltUnique = definition.unique && uniqueBuiltSet.has(definition.id);
                return (
                  <button
                    key={definition.id}
                    type="button"
                    className={`organization-building-item ${isSelected ? "active" : ""}`}
                    onClick={() => setSelectedDefinitionId(definition.id)}
                  >
                    <header>
                      <strong>{definition.name}</strong>
                      <span>{definition.category === "functional" ? "功能" : "增幅"}</span>
                    </header>
                    <p>{definition.effect}</p>
                    {isBuiltUnique ? <small>唯一建筑：已建造</small> : <small>{definition.shape.length} 格占地</small>}
                  </button>
                );
              })}
            </div>
          </article>

          <article className="organization-card">
            <h3>
              <Hand size={14} />
              编辑控制
            </h3>
            <div className="organization-mode-row">
              <button
                type="button"
                className={`ghost-btn ${interactionMode === "build" ? "active" : ""}`}
                onClick={() => setInteractionMode("build")}
              >
                建造/查看模式
              </button>
              <button
                type="button"
                className={`ghost-btn ${interactionMode === "expand" ? "active" : ""}`}
                onClick={() => {
                  if (pendingExpansionCount <= 0) {
                    setFeedback("当前没有可用扩张次数。组织升级后可获得扩张次数。");
                    return;
                  }
                  setInteractionMode("expand");
                }}
              >
                扩展领地模式
              </button>
              <button
                type="button"
                className={`ghost-btn ${interactionMode === "pan" ? "active" : ""}`}
                onClick={() => setInteractionMode("pan")}
              >
                拖拽平移模式
              </button>
            </div>
            {selectedDefinition ? (
              <div className="organization-selected-meta">
                <p>
                  当前建筑：<strong>{selectedDefinition.name}</strong>
                </p>
                <p>{selectedDefinition.description}</p>
                {pendingExpansionCount > 0 ? (
                  <p className="warn">当前有 {pendingExpansionCount} 次可用扩展（每次 {expansionPatchLabel}）。</p>
                ) : null}
                {interactionMode === "expand" ? <p className="warn">扩展模式：点击一个与现有领地相邻的位置进行扩展。</p> : null}
                {interactionMode === "expand" && expansionPreview && !expansionPreview.ok && expansionPreview.reason ? (
                  <p className="warn">{expansionPreview.reason}</p>
                ) : null}
                {preview && !preview.ok ? <p className="warn">{preview.reason}</p> : null}
              </div>
            ) : null}
            <p className="organization-feedback">{feedback}</p>
          </article>
        </aside>
      </div>

      {hoverCard && visibleHoverPlacement && visibleHoverDefinition ? (
        <aside
          className="organization-hover-card"
          style={{ left: `${hoverCard.x + 14}px`, top: `${hoverCard.y + 14}px` }}
        >
          <header>
            <strong>{visibleHoverDefinition.name}</strong>
            <span>Lv.{visibleHoverPlacement.level}</span>
          </header>
          <p>{visibleHoverDefinition.description}</p>
          <small>{visibleHoverDefinition.effect}</small>
        </aside>
      ) : null}

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
                    <ScrollText size={13} />
                    主线任务
                  </button>
                </div>
                {activeCoreTab === "status" ? (
                  <>
                    <p>当前组织已建造建筑总数：{placements.length}</p>
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
                    <p className="organization-mission-note">更多基地状态信息将在后续版本补充。</p>
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
                          <div className="organization-row-actions">
                            {quest.status === "available" ? (
                              <button type="button" className="ghost-btn small-btn" onClick={() => handleAcceptMainQuest(quest.id)}>
                                接取任务
                              </button>
                            ) : null}
                            {quest.status === "in_progress" ? (
                              <button type="button" className="ghost-btn small-btn" onClick={() => handleCompleteMainQuest(quest.id)}>
                                标记完成（测试）
                              </button>
                            ) : null}
                          </div>
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
            ) : (
              <>
                <p>{activeFunctionalDefinition?.name ?? "当前建筑"} 的功能界面将在后续阶段接入。</p>
                <p>当前版本已实现建筑点击入口与地图交互框架。</p>
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
