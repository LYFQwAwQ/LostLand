import { Building2, Compass, Hand, Plus, Search, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import type { CSSProperties, MouseEvent, WheelEvent } from "react";
import { ORGANIZATION_CONFIG } from "../data/organizationData";
import { useOrganization } from "../state/OrganizationProvider";
import type { OrganizationBuildingPlacement, OrganizationGridCell } from "../types/organization";

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

export function OrganizationPage() {
  const {
    gridSize,
    buildings,
    buildingById,
    placements,
    occupancy,
    rankState,
    checkPlacement,
    placeBuilding,
    removeBuilding,
    upgradeBuilding,
    addMockOrganizationExp
  } = useOrganization();

  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>(buildings[0]?.id ?? "");
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<OrganizationGridCell | null>(null);
  const [hoverCard, setHoverCard] = useState<{ instanceId: string; x: number; y: number } | null>(null);
  const [feedback, setFeedback] = useState<string>("请选择建筑后在地图地块点击建造。");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 20, y: 20 });
  const [interactionMode, setInteractionMode] = useState<"build" | "pan">("build");
  const [drag, setDrag] = useState<DragState>({ active: false, startX: 0, startY: 0, originX: 20, originY: 20 });
  const [activeFunctionalPlacementId, setActiveFunctionalPlacementId] = useState<string | null>(null);

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

  const gridCells = useMemo(() => {
    const cells: OrganizationGridCell[] = [];
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        cells.push({ x, y });
      }
    }
    return cells;
  }, [gridSize]);

  const placeAt = (cell: OrganizationGridCell) => {
    if (interactionMode !== "build") {
      return;
    }

    const occupantId = occupancy[cellKey(cell.x, cell.y)];
    if (occupantId) {
      setSelectedPlacementId(occupantId);
      const placement = placementById[occupantId];
      const definition = placement ? buildingById[placement.definitionId] : null;
      if (definition?.clickable) {
        setActiveFunctionalPlacementId(occupantId);
      }
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
    if (!drag.active) {
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setOffset({
      x: drag.originX + dx,
      y: drag.originY + dy
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
    const next = zoom - Math.sign(event.deltaY) * ORGANIZATION_CONFIG.zoomStep;
    setZoom(Math.max(ORGANIZATION_CONFIG.minZoom, Math.min(ORGANIZATION_CONFIG.maxZoom, Number(next.toFixed(2)))));
  };

  const onViewportContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (interactionMode === "build") {
      setInteractionMode("pan");
      setFeedback("已切换为拖拽平移模式（右键快捷）。");
    }
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
                onClick={() => setZoom((prev) => Math.max(ORGANIZATION_CONFIG.minZoom, Number((prev - ORGANIZATION_CONFIG.zoomStep).toFixed(2))))}
              >
                <ZoomOut size={13} />
              </button>
              <small>{Math.round(zoom * 100)}%</small>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setZoom((prev) => Math.min(ORGANIZATION_CONFIG.maxZoom, Number((prev + ORGANIZATION_CONFIG.zoomStep).toFixed(2))))}
              >
                <ZoomIn size={13} />
              </button>
              <button type="button" className="ghost-btn" onClick={() => setOffset({ x: 20, y: 20 })}>
                复位视角
              </button>
            </div>
          </header>

          <div
            className="organization-viewport"
            onMouseDown={onViewportMouseDown}
            onMouseMove={onViewportMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
            onWheel={onWheelZoom}
            onContextMenu={onViewportContextMenu}
          >
            <div
              className="organization-canvas"
              style={{
                width: `${gridSize * ORGANIZATION_CONFIG.boardCellSize}px`,
                height: `${gridSize * ORGANIZATION_CONFIG.boardCellSize}px`,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
              }}
            >
              <div className="organization-grid" style={{ ["--org-cell-size" as string]: `${ORGANIZATION_CONFIG.boardCellSize}px` } as CSSProperties}>
                {gridCells.map((cell) => {
                  const key = cellKey(cell.x, cell.y);
                  const occupantId = occupancy[key];
                  const occupant = occupantId ? placementById[occupantId] : null;
                  const occupantDefinition = occupant ? buildingById[occupant.definitionId] : null;
                  const isPreviewCell = previewCellSet.has(key);
                  const isSelectedCell = selectedPlacementCellSet.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`organization-cell ${occupant ? "occupied" : ""} ${
                        isPreviewCell ? (preview?.ok ? "preview-ok" : "preview-bad") : ""
                      } ${isSelectedCell ? "selected" : ""} ${interactionMode === "pan" ? "pan-disabled" : ""}`}
                      style={
                        occupantDefinition
                          ? ({ ["--org-building-color" as string]: occupantDefinition.color } as CSSProperties)
                          : undefined
                      }
                      onMouseEnter={(event) => {
                        setHoveredCell(cell);
                        if (occupantId) {
                          setHoverCard({ instanceId: occupantId, x: event.clientX, y: event.clientY });
                        }
                      }}
                      onMouseMove={(event) => {
                        if (occupantId) {
                          setHoverCard({ instanceId: occupantId, x: event.clientX, y: event.clientY });
                        }
                      }}
                      onMouseLeave={() => setHoverCard(null)}
                      onClick={() => placeAt(cell)}
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
                const centerX = ((bounds.minX + bounds.maxX + 1) / 2) * ORGANIZATION_CONFIG.boardCellSize;
                const centerY = ((bounds.minY + bounds.maxY + 1) / 2) * ORGANIZATION_CONFIG.boardCellSize;
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
        <div className="organization-modal-backdrop" role="presentation" onClick={() => setActiveFunctionalPlacementId(null)}>
          <article className="organization-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h3>功能建筑界面占位</h3>
            <p>
              {buildingById[placementById[activeFunctionalPlacementId]?.definitionId ?? ""]?.name ?? "当前建筑"} 的功能界面将在后续阶段接入。
            </p>
            <p>当前版本已实现建筑点击入口与地图交互框架。</p>
            <div className="organization-row-actions">
              <button type="button" className="ghost-btn" onClick={() => setActiveFunctionalPlacementId(null)}>
                关闭
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
