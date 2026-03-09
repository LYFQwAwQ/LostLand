import { CalendarClock, Compass, Info, Play, Ruler, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  buildWorldMapSearchParams,
  getContinentMeta,
  getDominionMeta,
  getDominionsByContinent,
  getNeighborRegions,
  getRegionMeta,
  getRegionsByDominion,
  parseWorldSelection,
  resolveSelectionFromLegacyRegion,
  selectionFromRegion,
  WORLD_CONTINENTS
} from "../data/worldMapData";
import { defaultFieldHooks } from "../lib/fieldVisual";
import { useMapSystem } from "../state/MapSystemProvider";
import type { ContinentId, RegionEdge, RegionNode } from "../types/game";

interface LabelOffset {
  x: number;
  y: number;
}

interface ShortestRoute {
  distance: number;
  edgeIds: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nodeClassName(node: RegionNode): string {
  if (node.state === "inactive") {
    return "map-node is-inactive";
  }
  if (node.state === "ghost") {
    return "map-node is-ghost";
  }
  if (node.archetype.startsWith("BL")) {
    return "map-node is-chaos";
  }
  if (node.archetype.startsWith("ST")) {
    return "map-node is-order";
  }
  return "map-node is-resource";
}

function nodeBadge(node: RegionNode): string {
  return `${node.name} ${node.archetype}`;
}

function computeLabelOffsets(nodes: RegionNode[]): Record<string, LabelOffset> {
  const offsets: Record<string, LabelOffset> = {};
  const placed: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  const sorted = [...nodes].sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
  const scaleX = 10;
  const scaleY = 6.2;

  sorted.forEach((node) => {
    const horizontal = node.x >= 76 ? -1 : node.x <= 24 ? 1 : node.x >= 50 ? -1 : 1;
    const vertical = node.y <= 24 ? 1 : node.y >= 76 ? -1 : node.y <= 52 ? 1 : -1;
    const baseX = 40 * horizontal;
    const baseY = 24 * vertical;
    const width = clamp(node.name.length * 13 + 44, 108, 188);
    const height = 24;
    const candidates: LabelOffset[] = [
      { x: baseX, y: baseY },
      { x: baseX + 14 * horizontal, y: baseY },
      { x: baseX, y: baseY + 12 * vertical },
      { x: baseX + 14 * horizontal, y: baseY + 12 * vertical },
      { x: baseX - 10 * horizontal, y: baseY + 16 * vertical },
      { x: baseX + 18 * horizontal, y: baseY + 18 * vertical }
    ];

    let chosen: LabelOffset = candidates[0];

    for (let attempt = 0; attempt < candidates.length; attempt += 1) {
      const candidate = candidates[attempt];
      const centerX = node.x * scaleX + candidate.x;
      const centerY = node.y * scaleY + candidate.y;
      const box = {
        left: centerX - width / 2,
        right: centerX + width / 2,
        top: centerY - height / 2,
        bottom: centerY + height / 2
      };

      const overlap = placed.some(
        (item) =>
          box.left <= item.right &&
          box.right >= item.left &&
          box.top <= item.bottom &&
          box.bottom >= item.top
      );

      if (!overlap || attempt === candidates.length - 1) {
        chosen = candidate;
        placed.push(box);
        break;
      }
    }

    offsets[node.id] = chosen;
  });

  return offsets;
}

function buildShortestRoute(edges: RegionEdge[], fromId: string, toId: string): ShortestRoute | null {
  const adjacency = new Map<string, Array<{ to: string; edgeId: string; weight: number }>>();

  edges.forEach((edge) => {
    const weight = Math.max(edge.weight, 0.01);

    const fromList = adjacency.get(edge.from) ?? [];
    fromList.push({ to: edge.to, edgeId: edge.id, weight });
    adjacency.set(edge.from, fromList);

    const toList = adjacency.get(edge.to) ?? [];
    toList.push({ to: edge.from, edgeId: edge.id, weight });
    adjacency.set(edge.to, toList);
  });

  const nodeIds = [...adjacency.keys()];
  if (!nodeIds.includes(fromId) || !nodeIds.includes(toId)) {
    return null;
  }

  const unvisited = new Set<string>(nodeIds);
  const dist = new Map<string, number>();
  const prev = new Map<string, { from: string; edgeId: string }>();

  nodeIds.forEach((id) => dist.set(id, Number.POSITIVE_INFINITY));
  dist.set(fromId, 0);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let best = Number.POSITIVE_INFINITY;

    unvisited.forEach((id) => {
      const value = dist.get(id) ?? Number.POSITIVE_INFINITY;
      if (value < best) {
        best = value;
        current = id;
      }
    });

    if (current === null || !Number.isFinite(best)) {
      break;
    }

    if (current === toId) {
      break;
    }

    unvisited.delete(current);

    (adjacency.get(current) ?? []).forEach((neighbor) => {
      if (!unvisited.has(neighbor.to)) {
        return;
      }

      const candidate = best + neighbor.weight;
      const currentValue = dist.get(neighbor.to) ?? Number.POSITIVE_INFINITY;
      if (candidate < currentValue) {
        dist.set(neighbor.to, candidate);
        prev.set(neighbor.to, { from: current as string, edgeId: neighbor.edgeId });
      }
    });
  }

  const totalDistance = dist.get(toId) ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(totalDistance)) {
    return null;
  }

  const edgeIds: string[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const step = prev.get(cursor);
    if (!step) {
      return null;
    }
    edgeIds.push(step.edgeId);
    cursor = step.from;
  }

  edgeIds.reverse();
  return { distance: totalDistance, edgeIds };
}

export function WorldMapPage() {
  const { getRegionById, ensureRegionLoaded, advanceOneMonth, worldMonth } = useMapSystem();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const explicitSelection = useMemo(
    () =>
      parseWorldSelection(
        searchParams.get("continent"),
        searchParams.get("dominion"),
        searchParams.get("region")
      ),
    [searchParams]
  );

  const legacySelection = useMemo(() => {
    if (explicitSelection) {
      return null;
    }
    return resolveSelectionFromLegacyRegion(searchParams.get("region"));
  }, [explicitSelection, searchParams]);

  const selection = explicitSelection ?? legacySelection;

  const [pickerContinentId, setPickerContinentId] = useState<ContinentId | null>(null);
  const [pickerDominionId, setPickerDominionId] = useState<string | null>(null);
  const [showDominionPicker, setShowDominionPicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  const [fogNodeId, setFogNodeId] = useState<string | null>(null);
  const [showFieldLayer, setShowFieldLayer] = useState(true);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureFromId, setMeasureFromId] = useState<string | null>(null);
  const [measureToId, setMeasureToId] = useState<string | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  const activeContinentId = pickerContinentId ?? selection?.continentId ?? WORLD_CONTINENTS[0].id;
  const activeDominionOptions = useMemo(() => getDominionsByContinent(activeContinentId), [activeContinentId]);
  const activeRegionOptions = useMemo(
    () => (pickerDominionId ? getRegionsByDominion(pickerDominionId) : []),
    [pickerDominionId]
  );

  useEffect(() => {
    if (!selection || explicitSelection) {
      return;
    }
    setSearchParams(buildWorldMapSearchParams(selection), { replace: true });
  }, [explicitSelection, selection, setSearchParams]);

  useEffect(() => {
    if (!selection) {
      return;
    }
    ensureRegionLoaded(selection.regionId);
  }, [ensureRegionLoaded, selection]);

  const region = useMemo(
    () => (selection ? getRegionById(selection.regionId) : undefined),
    [getRegionById, selection]
  );

  const neighborRegions = useMemo(() => {
    if (!region) {
      return [];
    }
    return getNeighborRegions(region.id);
  }, [region]);

  const nodeById = useMemo(
    () => (region ? Object.fromEntries(region.nodes.map((node) => [node.id, node])) : {}),
    [region]
  );

  const labelOffsets = useMemo(() => (region ? computeLabelOffsets(region.nodes) : {}), [region]);

  const prosperityScale = useMemo(() => {
    if (!region) {
      return 120;
    }
    return Math.max(120, ...region.nodes.map((node) => Math.abs(node.sim.prosperity)));
  }, [region]);

  const measureFromNode = measureFromId && region ? nodeById[measureFromId] : null;
  const measureToNode = measureToId && region ? nodeById[measureToId] : null;

  const measureRoute = useMemo(() => {
    if (!region || !measureFromId || !measureToId) {
      return null;
    }
    return buildShortestRoute(region.edges, measureFromId, measureToId);
  }, [measureFromId, measureToId, region]);

  const measureEdgeSet = useMemo(() => new Set(measureRoute?.edgeIds ?? []), [measureRoute]);
  const directDistance = useMemo(() => {
    if (!measureFromNode || !measureToNode) {
      return null;
    }
    const dx = measureFromNode.x - measureToNode.x;
    const dy = measureFromNode.y - measureToNode.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, [measureFromNode, measureToNode]);

  const fogNode = fogNodeId && region ? nodeById[fogNodeId] : null;

  const report = region?.lastMonthReport;
  const playback = report?.playback ?? [];
  const activeFrame = playback[playbackIndex];

  const highlightSet = useMemo(() => new Set(activeFrame?.highlightNodeIds ?? []), [activeFrame]);
  const unstableSet = useMemo(() => new Set(activeFrame?.unstableNodeIds ?? []), [activeFrame]);
  const changedSet = useMemo(() => new Set(activeFrame?.changedNodeIds ?? []), [activeFrame]);

  useEffect(() => {
    setPlaybackIndex(0);
    setAutoPlay(false);
    setFogNodeId(null);
    setMeasureFromId(null);
    setMeasureToId(null);
    setMeasureMode(false);
  }, [selection?.regionId]);

  useEffect(() => {
    if (!autoPlay || !report || playback.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setPlaybackIndex((prev) => {
        if (prev >= playback.length - 1) {
          setAutoPlay(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1300);

    return () => clearInterval(timer);
  }, [autoPlay, playback.length, report]);

  const openDominionPicker = (continentId: ContinentId) => {
    setPickerContinentId(continentId);
    setPickerDominionId(null);
    setShowRegionPicker(false);
    setShowDominionPicker(true);
  };

  const closePickers = () => {
    setShowDominionPicker(false);
    setShowRegionPicker(false);
  };

  const chooseDominion = (dominionId: string) => {
    setPickerDominionId(dominionId);
    setShowDominionPicker(false);
    setShowRegionPicker(true);
  };

  const applySelection = (nextContinentId: ContinentId, nextDominionId: string, nextRegionId: string) => {
    setSearchParams(
      buildWorldMapSearchParams({
        continentId: nextContinentId,
        dominionId: nextDominionId,
        regionId: nextRegionId
      })
    );
    closePickers();
  };

  const chooseRegion = (nextRegionId: string) => {
    const meta = getRegionMeta(nextRegionId);
    if (!meta) {
      return;
    }
    applySelection(meta.continentId, meta.dominionId, meta.id);
  };

  const handleNodeClick = (node: RegionNode) => {
    if (!region) {
      return;
    }

    if (measureMode) {
      if (!measureFromId || (measureFromId && measureToId)) {
        setMeasureFromId(node.id);
        setMeasureToId(null);
        return;
      }

      if (measureFromId === node.id) {
        setMeasureFromId(null);
        setMeasureToId(null);
        return;
      }

      setMeasureToId(node.id);
      return;
    }

    if (node.state === "inactive") {
      setFogNodeId(node.id);
      return;
    }

    const query = buildWorldMapSearchParams(selectionFromRegion(region));
    navigate(`/node/${node.id}?${query.toString()}`);
  };

  const activeContinentMeta = getContinentMeta(activeContinentId);

  return (
    <section className="page map-page">
      <header className="page-header">
        <h1>世界地图</h1>
        <p>大陆 → 疆域 → 地区多层地图。地区拓扑为泊松盘采样 + 德劳内三角化，并支持月度演化回放。</p>
      </header>

      <div className="region-tabs continent-tabs">
        {WORLD_CONTINENTS.map((item) => (
          <button
            key={item.id}
            className={selection?.continentId === item.id ? "active" : ""}
            onClick={() => openDominionPicker(item.id)}
            type="button"
          >
            {item.name}
          </button>
        ))}
      </div>

      {!selection ? (
        <section className="map-empty-selection">
          <h2>请选择大陆并进入疆域</h2>
          <p>点击上方大陆按钮，依次选择疆域与地区后进入地图。</p>
        </section>
      ) : null}

      {selection && !region ? (
        <section className="map-empty-selection">
          <h2>正在生成地区地图</h2>
          <p>地区初始化会进行种子锚点分配与预生长模拟，请稍候。</p>
        </section>
      ) : null}

      {region ? (
        <>
          <div className="map-info-row">
            <div className="map-summary-card">
              <p>
                <strong>世界月份：</strong>
                第 {worldMonth} 月
              </p>
              <p>
                <strong>大陆：</strong>
                {region.continentName}
              </p>
              <p>
                <strong>疆域：</strong>
                {region.dominionName}
              </p>
              <p>
                <strong>地区：</strong>
                {region.regionName}
              </p>
              <p>
                <strong>节点数：</strong>
                {region.nodes.length} · <strong>边数：</strong>
                {region.edges.length}
              </p>
            </div>

            <div className="suppression-card">
              <div className="suppression-title">地图压制</div>
              <div className="suppression-track" role="progressbar" aria-valuenow={region.mapSuppression}>
                <span style={{ width: `${region.mapSuppression}%` }} />
              </div>
              <p>压制值 {region.mapSuppression}%：压制越高，稀有掉落率越高。</p>
              <button type="button" className="month-btn" onClick={() => advanceOneMonth(region.id)}>
                <CalendarClock size={14} />
                结算当前地区下一个游戏月
              </button>
            </div>

            <div className="map-toggle-stack">
              <label className="field-layer-toggle">
                <input
                  type="checkbox"
                  checked={showFieldLayer}
                  onChange={(event) => setShowFieldLayer(event.target.checked)}
                />
                显示场强扩散层（Order / Expansion）
              </label>

              <button
                type="button"
                className={`measure-toggle ${measureMode ? "active" : ""}`}
                onClick={() => {
                  setMeasureMode((prev) => {
                    if (prev) {
                      setMeasureFromId(null);
                      setMeasureToId(null);
                    }
                    return !prev;
                  });
                }}
              >
                <Ruler size={13} />
                测距模式 {measureMode ? "开启" : "关闭"}
              </button>
            </div>
          </div>

          <section className="neighbor-switch-card">
            <header>
              <h3>邻接地区快捷切换</h3>
              <small>当前地区：{region.regionName}</small>
            </header>
            <div className="neighbor-switch-list">
              {neighborRegions.length === 0 ? <p>当前地区暂无可切换的邻接地区。</p> : null}
              {neighborRegions.map((item) => (
                <button key={item.id} type="button" onClick={() => chooseRegion(item.id)}>
                  {item.name}
                </button>
              ))}
            </div>
          </section>

          {report ? (
            <section className="month-report-card">
              <header>
                <h2>第 {report.month} 月结算</h2>
                <p>
                  激活 {report.activeNodes} · 迷雾 {report.inactiveNodes} · 幽灵 {report.ghostNodes}
                </p>
              </header>

              <div className="playback-toolbar">
                <button
                  type="button"
                  className={`play-btn ${autoPlay ? "active" : ""}`}
                  onClick={() => {
                    if (playbackIndex >= playback.length - 1) {
                      setPlaybackIndex(0);
                    }
                    setAutoPlay((prev) => !prev);
                  }}
                >
                  <Play size={13} />
                  {autoPlay ? "停止回放" : "播放回放"}
                </button>

                <div className="playback-steps">
                  {playback.map((step, index) => (
                    <button
                      type="button"
                      key={step.key}
                      className={index === playbackIndex ? "active" : ""}
                      onClick={() => {
                        setAutoPlay(false);
                        setPlaybackIndex(index);
                      }}
                    >
                      {index + 1}. {step.title.replace("Step", "")}
                    </button>
                  ))}
                </div>
              </div>

              {activeFrame ? (
                <div className="playback-description">
                  <p>
                    <strong>{activeFrame.title}</strong>
                  </p>
                  <p>{activeFrame.description}</p>
                </div>
              ) : null}

              <div className="month-report-events">
                {report.events.length === 0 ? <p>本月无重大演化事件。</p> : null}
                {report.events.slice(0, 6).map((event, index) => (
                  <p key={`${event}-${index}`}>{event}</p>
                ))}
              </div>
            </section>
          ) : null}

          <div className="map-main-grid">
            <div className="map-stage">
              <div className="map-stage-atmosphere" />

              {measureMode ? (
                <div className="measure-hint">
                  <Ruler size={14} />
                  依次点击两个地点，显示最短路径与距离。
                </div>
              ) : null}

              <div className="map-compass" aria-hidden="true">
                <Compass size={18} />
                <span>N</span>
              </div>

              <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {region.edges.map((edge) => {
                  const from = nodeById[edge.from];
                  const to = nodeById[edge.to];
                  if (!from || !to) {
                    return null;
                  }

                  const edgeVisual = defaultFieldHooks.resolveEdgeVisual(edge);
                  const emphasize = highlightSet.has(from.id) || highlightSet.has(to.id);
                  const isMeasurePath = measureEdgeSet.has(edge.id);

                  return (
                    <line
                      key={edge.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={isMeasurePath ? "#f1d085" : showFieldLayer ? edgeVisual.color : "#5c3d32"}
                      strokeWidth={
                        isMeasurePath
                          ? 2.8
                          : showFieldLayer
                          ? edgeVisual.width + (emphasize ? 0.7 : 0)
                          : 1.2
                      }
                      strokeOpacity={isMeasurePath ? 1 : emphasize ? 1 : 0.72}
                      strokeDasharray=""
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>

              {region.nodes.map((node) => {
                const visual = defaultFieldHooks.resolveNodeVisual(node);
                const prosperityRatio = clamp(Math.abs(node.sim.prosperity) / prosperityScale, 0, 1);
                const labelOffset = labelOffsets[node.id] ?? { x: 40, y: 24 };
                const linkLength = Math.max(12, Math.hypot(labelOffset.x, labelOffset.y) - 14);
                const linkAngle = Math.atan2(labelOffset.y, labelOffset.x);

                const style = {
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  "--order-opacity": visual.orderOpacity,
                  "--expansion-opacity": visual.expansionOpacity,
                  "--ring-scale": visual.ringScale,
                  "--prosperity-angle": `${Math.round(prosperityRatio * 360)}deg`,
                  "--prosperity-color": node.sim.prosperity >= 0 ? "#efd08c" : "#db7c6d",
                  "--tag-offset-x": `${labelOffset.x}px`,
                  "--tag-offset-y": `${labelOffset.y}px`,
                  "--tag-link-length": `${linkLength}px`,
                  "--tag-link-angle": `${linkAngle}rad`
                } as CSSProperties;

                return (
                  <button
                    key={node.id}
                    className={`${nodeClassName(node)} ${
                      highlightSet.has(node.id) ? "is-highlight" : ""
                    } ${unstableSet.has(node.id) ? "is-unstable" : ""} ${changedSet.has(node.id) ? "is-changed" : ""} ${
                      measureFromId === node.id ? "is-measure-from" : ""
                    } ${measureToId === node.id ? "is-measure-to" : ""}`}
                    style={style}
                    title={`${node.name} ${node.archetype} | 繁荣度 ${node.sim.prosperity.toFixed(1)}`}
                    onClick={() => handleNodeClick(node)}
                    type="button"
                  >
                    {showFieldLayer ? <span className="node-halo" aria-hidden="true" /> : null}
                    <span className="prosperity-ring" aria-hidden="true" />
                    <span className="map-node-point" aria-hidden="true" />
                    <span className="map-node-link" aria-hidden="true" />
                    <span className="map-node-tag">{nodeBadge(node)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="map-bottom-panels">
            <div className="field-legend map-legend-card">
              <h3>场强与繁荣说明</h3>
              <p>
                <Sparkles size={14} />
                蓝色偏向秩序场（Order），红色偏向扩张场（Expansion）。
              </p>
              <p>
                <Info size={14} />
                节点圆环为繁荣度：金色越满代表繁荣越高，赤色越满代表衰退越高。
              </p>
              <p>
                <Info size={14} />
                回放高亮：黄色焦点，红框不稳定，蓝框为本月发生演化。
              </p>
            </div>

            <div className="distance-card">
              <header>
                <h3>两地距离</h3>
                {measureMode ? (
                  <button
                    type="button"
                    className="ghost-btn small-btn"
                    onClick={() => {
                      setMeasureFromId(null);
                      setMeasureToId(null);
                    }}
                  >
                    清空
                  </button>
                ) : null}
              </header>

              {measureMode ? (
                <div className="distance-content">
                  <div className="distance-node-row">
                    <span className="distance-badge from">{measureFromNode ? "起点" : "起点待选"}</span>
                    <strong>{measureFromNode ? `${measureFromNode.name} ${measureFromNode.archetype}` : "点击任意地点"}</strong>
                  </div>

                  <div className="distance-node-row">
                    <span className="distance-badge to">{measureToNode ? "终点" : "终点待选"}</span>
                    <strong>{measureToNode ? `${measureToNode.name} ${measureToNode.archetype}` : "再点击一个地点"}</strong>
                  </div>

                  {measureFromNode && measureToNode ? (
                    measureRoute ? (
                      <div className="distance-result">
                        <p>
                          最短路径距离：<strong>{measureRoute.distance.toFixed(2)}</strong>（路网单位）
                        </p>
                        <p>
                          直线距离：<strong>{(directDistance ?? 0).toFixed(2)}</strong>（地图比例单位）
                        </p>
                        <p>地图中高亮线路即最短路径。</p>
                      </div>
                    ) : (
                      <p className="distance-empty">这两个地点当前无连通路径。</p>
                    )
                  ) : (
                    <p className="distance-empty">开启测距模式后，依次点击两个地点即可显示距离。</p>
                  )}
                </div>
              ) : (
                <p className="distance-empty">测距模式已关闭。可在上方开关开启。</p>
              )}
            </div>
          </section>

          {fogNode ? (
            <div className="fog-modal-backdrop" onClick={() => setFogNodeId(null)}>
              <div className="fog-modal" onClick={(event) => event.stopPropagation()}>
                <h2>迷雾节点：{fogNode.name}</h2>
                <p>{fogNode.environment}</p>
                <div className="fog-progress">
                  <div>
                    <span>开发进度槽</span>
                    <strong>
                      {fogNode.fog.current}/{fogNode.fog.target}
                    </strong>
                  </div>
                  <div className="suppression-track">
                    <span style={{ width: `${Math.min((fogNode.fog.current / fogNode.fog.target) * 100, 100)}%` }} />
                  </div>
                </div>
                <p>累计 (O - E) 差值：{fogNode.fog.accumulatedDelta.toFixed(2)}</p>
                <p>连续 4 个月开发进度为正，且附近存在中秩序场以上据点时，可诞生资源点。</p>
                <button type="button" className="primary-btn" onClick={() => setFogNodeId(null)}>
                  关闭
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showDominionPicker && pickerContinentId ? (
        <div className="world-picker-backdrop" onClick={closePickers}>
          <div className="world-picker-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>{activeContinentMeta?.name ?? "大陆"} · 选择疆域</h2>
              <button type="button" onClick={closePickers}>
                关闭
              </button>
            </header>
            <p>先选择一个疆域，再进入地区选择。</p>
            <div className="world-picker-list">
              {activeDominionOptions.map((dominion) => (
                <button key={dominion.id} type="button" onClick={() => chooseDominion(dominion.id)}>
                  <strong>{dominion.name}</strong>
                  <span>{dominion.environmentTraits.join(" / ")}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showRegionPicker && pickerDominionId ? (
        <div className="world-picker-backdrop" onClick={closePickers}>
          <div className="world-picker-modal" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>{getDominionMeta(pickerDominionId)?.name ?? "疆域"} · 选择地区</h2>
              <button type="button" onClick={closePickers}>
                关闭
              </button>
            </header>
            <p>选择地区后将进入对应拓扑地图。</p>
            <div className="world-picker-list">
              {activeRegionOptions.map((item) => (
                <button key={item.id} type="button" onClick={() => chooseRegion(item.id)}>
                  <strong>{item.name}</strong>
                  <span>种子 {item.seed}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

