import {
  ARCHETYPE_PROFILES,
  isChaosArchetype,
  isStableArchetype,
  mapArchetypeDifficulty,
  randomBuffByArchetype,
  randomEnvironmentByArchetype,
  randomNameByArchetype
} from "./archetypes";
import type {
  Faction,
  InfluenceBreakdown,
  NodeArchetype,
  NodeSimulationState,
  RegionEdge,
  RegionMonthReport,
  RegionNode,
  RegionPlaybackFrame,
  RegionTopology
} from "../types/game";

const ORDER_SAME_FACTOR = 1.2;
const ORDER_DIFF_FACTOR = 0.7;
const EXPANSION_DIFF_FACTOR = 1.5;
const EXPANSION_SAME_FACTOR = 0.7;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createEmptyInfluence(): InfluenceBreakdown {
  return { Human: 0, Beast: 0, Neutral: 0 };
}

function resetInfluence(sim: NodeSimulationState): void {
  sim.orderByFaction = createEmptyInfluence();
  sim.expansionByFaction = createEmptyInfluence();
}

function topFaction(map: InfluenceBreakdown, fallback: Faction): Faction {
  let current: Faction = fallback;
  let value = map[current] ?? Number.NEGATIVE_INFINITY;

  (Object.keys(map) as Faction[]).forEach((key) => {
    if (map[key] > value) {
      value = map[key];
      current = key;
    }
  });

  return current;
}

function factionRank(faction: Faction): number {
  if (faction === "Human") {
    return 1;
  }
  if (faction === "Beast") {
    return 2;
  }
  return 3;
}

function seededRandom(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildDistanceMatrix(region: RegionTopology): number[][] {
  const nodeCount = region.nodes.length;
  const indexById = new Map<string, number>();
  region.nodes.forEach((node, index) => indexById.set(node.id, index));

  const dist = Array.from({ length: nodeCount }, (_, i) =>
    Array.from({ length: nodeCount }, (_, j) => (i === j ? 0 : Number.POSITIVE_INFINITY))
  );

  region.edges.forEach((edge) => {
    const from = indexById.get(edge.from);
    const to = indexById.get(edge.to);
    if (from === undefined || to === undefined) {
      return;
    }
    const w = edge.weight;
    if (w < dist[from][to]) {
      dist[from][to] = w;
      dist[to][from] = w;
    }
  });

  for (let k = 0; k < nodeCount; k += 1) {
    for (let i = 0; i < nodeCount; i += 1) {
      for (let j = 0; j < nodeCount; j += 1) {
        const candidate = dist[i][k] + dist[k][j];
        if (candidate < dist[i][j]) {
          dist[i][j] = candidate;
        }
      }
    }
  }

  return dist;
}

function cloneNode(node: RegionNode): RegionNode {
  return {
    ...node,
    field: { ...node.field },
    fog: { ...node.fog },
    sim: {
      ...node.sim,
      orderByFaction: { ...node.sim.orderByFaction },
      expansionByFaction: { ...node.sim.expansionByFaction }
    }
  };
}

function isMediumPlusChaos(node: RegionNode): boolean {
  return node.archetype === "BL1" || node.archetype === "BL2";
}

function hasNearNode(
  nodes: RegionNode[],
  distances: number[][],
  nodeIndex: number,
  maxRadius: number,
  predicate: (node: RegionNode) => boolean
): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    if (i === nodeIndex) {
      continue;
    }
    if (distances[nodeIndex][i] > maxRadius) {
      continue;
    }
    if (predicate(nodes[i])) {
      return true;
    }
  }
  return false;
}

function getNearestIndices(
  nodes: RegionNode[],
  distances: number[][],
  nodeIndex: number,
  maxRadius: number,
  predicate: (node: RegionNode) => boolean
): number[] {
  const list: Array<{ index: number; d: number }> = [];
  for (let i = 0; i < nodes.length; i += 1) {
    if (i === nodeIndex) {
      continue;
    }
    const d = distances[nodeIndex][i];
    if (d > maxRadius) {
      continue;
    }
    if (!predicate(nodes[i])) {
      continue;
    }
    list.push({ index: i, d });
  }

  return list.sort((a, b) => a.d - b.d).map((item) => item.index);
}

function applyArchetype(node: RegionNode, archetype: NodeArchetype, random: () => number): void {
  const profile = ARCHETYPE_PROFILES[archetype];
  node.archetype = archetype;
  node.name = randomNameByArchetype(archetype, random);
  node.environment = randomEnvironmentByArchetype(archetype, random);
  node.stayBuff = randomBuffByArchetype(archetype, random);
  node.difficulty = mapArchetypeDifficulty(archetype);
  node.sim.initialStrength = profile.initialStrength;
  node.sim.baseStrength = Math.max(node.sim.baseStrength * 0.75, profile.initialStrength);
  node.sim.aggression = Math.round(node.sim.baseStrength * profile.aggressionScale);
}

function toGhost(node: RegionNode): void {
  node.state = "ghost";
  node.archetype = "NOD";
  node.fog.current = Math.max(30, Math.round(node.fog.target * 0.18));
  node.sim.positiveMonths = 0;
  node.sim.negativeMonths = 0;
}

function toActiveNode(node: RegionNode, archetype: NodeArchetype, random: () => number): void {
  node.state = "active";
  applyArchetype(node, archetype, random);
  node.sim.positiveMonths = 0;
  node.sim.negativeMonths = 0;
}

function updateFieldVisual(node: RegionNode): void {
  const profile = ARCHETYPE_PROFILES[node.archetype];
  node.field.orderAura = clamp(profile.orderScale + node.sim.totalOrder / 420, 0.06, 1);
  node.field.expansionAura = clamp(profile.expansionScale + node.sim.totalExpansion / 420, 0.06, 1);
  node.field.pulse = clamp(0.35 + Math.abs(node.sim.delta) / 260, 0.2, 1);
}

function recomputeEdgeFlux(edges: RegionEdge[], nodes: RegionNode[]): RegionEdge[] {
  const map = Object.fromEntries(nodes.map((node) => [node.id, node]));
  return edges.map((edge) => {
    const from = map[edge.from];
    const to = map[edge.to];
    return {
      ...edge,
      fieldFlux: {
        order: Number(((from.field.orderAura + to.field.orderAura) / 2).toFixed(3)),
        expansion: Number(((from.field.expansionAura + to.field.expansionAura) / 2).toFixed(3))
      }
    };
  });
}

function mapSuppression(nodes: RegionNode[]): number {
  const active = nodes.filter((node) => node.state === "active");
  const stableCount = active.filter((node) => isStableArchetype(node.archetype)).length;
  const chaosCount = active.filter((node) => isChaosArchetype(node.archetype)).length;
  const avgProsperity = active.length > 0 ? active.reduce((sum, node) => sum + node.sim.prosperity, 0) / active.length : 0;

  const score =
    (stableCount / Math.max(stableCount + chaosCount, 1)) * 72 +
    clamp(avgProsperity / 16, -18, 18) -
    chaosCount * 0.7 +
    26;

  return Math.round(clamp(score, 0, 100));
}

function applyOwnershipFromExpansion(node: RegionNode): void {
  node.faction = topFaction(node.sim.expansionByFaction, node.faction);
}

function applyOwnershipFromOrder(node: RegionNode): void {
  node.faction = topFaction(node.sim.orderByFaction, node.faction);
}

function rollTierDecay(node: RegionNode, random: () => number): void {
  const profile = ARCHETYPE_PROFILES[node.archetype];
  const nextStrength = profile.initialStrength + Math.abs(node.sim.prosperity) * 0.1;
  node.sim.baseStrength = Number(
    clamp(nextStrength, profile.initialStrength * 0.75, profile.initialStrength * 4.5).toFixed(2)
  );

  if (node.archetype === "BL1") {
    node.sim.baseStrength = Number((node.sim.baseStrength * (1.015 + random() * 0.015)).toFixed(2));
  }

  node.sim.aggression = Math.round(node.sim.baseStrength * profile.aggressionScale);
}

function bumpInfluence(map: InfluenceBreakdown, faction: Faction, value: number): void {
  map[faction] += value;
}

function contributionOrder(source: RegionNode, target: RegionNode, distance: number): number {
  const sourceProfile = ARCHETYPE_PROFILES[source.archetype];
  if (!sourceProfile.orderScale || source.state !== "active") {
    return 0;
  }

  const base = source.sim.baseStrength * sourceProfile.orderScale;
  const sync = source.faction === target.faction ? ORDER_SAME_FACTOR : ORDER_DIFF_FACTOR;
  return (base * sync) / Math.pow(distance + 1, 2);
}

function contributionExpansion(source: RegionNode, target: RegionNode, distance: number): number {
  const sourceProfile = ARCHETYPE_PROFILES[source.archetype];
  if (!sourceProfile.expansionScale || source.state !== "active") {
    return 0;
  }

  const base = source.sim.baseStrength * sourceProfile.expansionScale + source.sim.aggression * 0.35;
  const conflict = source.faction === target.faction ? EXPANSION_SAME_FACTOR : EXPANSION_DIFF_FACTOR;
  return (base * conflict) / (distance + 1);
}

function safeRound(value: number): number {
  return Number(value.toFixed(3));
}

function hasNearbyStableHub(nodes: RegionNode[], distances: number[][], index: number, radius: number): boolean {
  return hasNearNode(
    nodes,
    distances,
    index,
    radius,
    (node) => node.state === "active" && (node.archetype === "ST1" || node.archetype === "ST2")
  );
}

function reportStateCounts(nodes: RegionNode[]): { activeNodes: number; inactiveNodes: number; ghostNodes: number } {
  return {
    activeNodes: nodes.filter((node) => node.state === "active").length,
    inactiveNodes: nodes.filter((node) => node.state === "inactive").length,
    ghostNodes: nodes.filter((node) => node.state === "ghost").length
  };
}

function topNodeIds(nodes: RegionNode[], scorer: (node: RegionNode) => number, count: number): string[] {
  return [...nodes]
    .sort((a, b) => scorer(b) - scorer(a))
    .slice(0, count)
    .map((node) => node.id);
}

function toPlaybackFrames(params: {
  gatheringHighlight: string[];
  unstableNodes: string[];
  changedNodes: string[];
  snapshotHighlights: string[];
  events: string[];
}): RegionPlaybackFrame[] {
  return [
    {
      key: "gathering",
      title: "Step 1 - 影响力收集",
      description: "激活节点向 MaxRadius 范围广播秩序场与扩张场。",
      highlightNodeIds: params.gatheringHighlight,
      unstableNodeIds: [],
      changedNodeIds: []
    },
    {
      key: "delta",
      title: "Step 2 - 状态差值",
      description: "计算每个节点的 O-E 差值并写入稳定/混乱。",
      highlightNodeIds: params.gatheringHighlight,
      unstableNodeIds: params.unstableNodes,
      changedNodeIds: []
    },
    {
      key: "threshold",
      title: "Step 3 - 阈值判定",
      description: params.events.length > 0 ? `触发演化 ${params.events.length} 项。` : "本月未触发演化。",
      highlightNodeIds: params.changedNodes,
      unstableNodeIds: params.unstableNodes,
      changedNodeIds: params.changedNodes
    },
    {
      key: "snapshot",
      title: "Step 4 - 快照更新",
      description: "重置阶段性值并输出月度快照。",
      highlightNodeIds: params.snapshotHighlights,
      unstableNodeIds: [],
      changedNodeIds: params.changedNodes
    }
  ];
}

export function settleRegionOneMonth(region: RegionTopology): { region: RegionTopology; report: RegionMonthReport } {
  const targetMonth = region.currentMonth + 1;
  const random = seededRandom(hashSeed(`${region.id}-${targetMonth}`));
  const nodes = region.nodes.map(cloneNode);
  const distances = buildDistanceMatrix({ ...region, nodes });
  const events: string[] = [];
  const changedNodeIdSet = new Set<string>();

  nodes.forEach((node) => {
    node.sim.lastChange = null;
    node.sim.totalOrder = 0;
    node.sim.totalExpansion = 0;
    node.sim.stability = 0;
    node.sim.chaos = 0;
    node.sim.delta = 0;
    resetInfluence(node.sim);
  });

  for (let sourceIndex = 0; sourceIndex < nodes.length; sourceIndex += 1) {
    const source = nodes[sourceIndex];
    if (source.state !== "active") {
      continue;
    }

    for (let targetIndex = 0; targetIndex < nodes.length; targetIndex += 1) {
      const target = nodes[targetIndex];
      const d = distances[sourceIndex][targetIndex];
      if (!Number.isFinite(d) || d > region.maxRadius) {
        continue;
      }

      const order = contributionOrder(source, target, d);
      const expansion = contributionExpansion(source, target, d);

      if (order > 0) {
        target.sim.totalOrder += order;
        bumpInfluence(target.sim.orderByFaction, source.faction, order);
      }
      if (expansion > 0) {
        target.sim.totalExpansion += expansion;
        bumpInfluence(target.sim.expansionByFaction, source.faction, expansion);
      }
    }
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    node.sim.totalOrder = safeRound(node.sim.totalOrder);
    node.sim.totalExpansion = safeRound(node.sim.totalExpansion);
    node.sim.stability = node.sim.totalOrder;
    node.sim.chaos = node.sim.totalExpansion;
    node.sim.delta = safeRound(node.sim.stability - node.sim.chaos);

    node.fog.accumulatedDelta = safeRound(node.fog.accumulatedDelta + node.sim.delta);

    if (node.state === "inactive") {
      if (node.sim.delta > 0) {
        node.sim.developmentMonths += 1;
        node.fog.current = Math.round(clamp(node.fog.current + node.sim.delta * 0.45, 0, node.fog.target));
      } else {
        node.sim.developmentMonths = 0;
        node.fog.current = Math.round(clamp(node.fog.current + node.sim.delta * 0.25, 0, node.fog.target));
      }

      if (node.sim.developmentMonths >= 4 && hasNearbyStableHub(nodes, distances, index, region.maxRadius)) {
        toActiveNode(node, "NOD", random);
        applyOwnershipFromExpansion(node);
        node.sim.prosperity = 0;
        node.sim.lastChange = "开发诞生资源点";
        events.push(`${node.name} 被开发为资源点，归属 ${node.faction}。`);
        changedNodeIdSet.add(node.id);
      }

      updateFieldVisual(node);
      continue;
    }

    node.sim.prosperity = safeRound(node.sim.prosperity + node.sim.delta);

    if (node.sim.totalOrder > 200 && node.sim.totalExpansion > 200) {
      const penalty = (node.sim.totalOrder + node.sim.totalExpansion) * 0.1;
      if (node.archetype === "BL1") {
        node.sim.prosperity = safeRound(node.sim.prosperity + penalty);
      } else {
        node.sim.prosperity = safeRound(node.sim.prosperity - penalty);
      }
    }

    if (node.sim.delta > 0) {
      node.sim.positiveMonths += 1;
      node.sim.negativeMonths = 0;
    } else if (node.sim.delta < 0) {
      node.sim.negativeMonths += 1;
      node.sim.positiveMonths = 0;
    }

    node.sim.highProsperityMonths = node.sim.prosperity > 200 ? node.sim.highProsperityMonths + 1 : 0;

    if (node.state === "ghost") {
      if (node.sim.prosperity > 0 && node.sim.positiveMonths >= 2) {
        toActiveNode(node, "NOD", random);
        applyOwnershipFromOrder(node);
        node.sim.prosperity = 30;
        node.sim.lastChange = "幽灵位重建";
        events.push(`${node.name} 完成重建，重新成为资源点。`);
        changedNodeIdSet.add(node.id);
      }
      updateFieldVisual(node);
      continue;
    }

    if (node.archetype === "NOD" && node.sim.negativeMonths >= 2) {
      toGhost(node);
      node.sim.lastChange = "资源点坍塌为幽灵位";
      events.push(`${node.name} 因混乱蔓延坍塌为幽灵位。`);
      changedNodeIdSet.add(node.id);
      updateFieldVisual(node);
      continue;
    }

    if (node.archetype === "ST1" && node.sim.negativeMonths >= 6) {
      applyArchetype(node, "BL2", random);
      applyOwnershipFromExpansion(node);
      node.sim.prosperity = 0;
      node.sim.lastChange = "主城完全混沌化";
      events.push(`${node.name} 发生完全混沌化，转化为混沌区。`);
      changedNodeIdSet.add(node.id);

      const linked = getNearestIndices(
        nodes,
        distances,
        index,
        region.maxRadius,
        (other) => other.state === "active" && isStableArchetype(other.archetype) && other.faction === node.faction
      ).slice(0, 3);

      linked.forEach((idx) => {
        const target = nodes[idx];
        if (target.archetype === "ST2") {
          applyArchetype(target, "ST3", random);
          target.sim.prosperity = 0;
          target.sim.lastChange = "受主城失守波及，降级为前哨";
          changedNodeIdSet.add(target.id);
        } else if (target.archetype === "ST3") {
          applyArchetype(target, "BL3", random);
          target.sim.prosperity = 0;
          target.sim.lastChange = "受主城失守波及，混沌化";
          applyOwnershipFromExpansion(target);
          changedNodeIdSet.add(target.id);
        }
      });
    } else if (isStableArchetype(node.archetype) && node.archetype !== "ST1" && node.sim.negativeMonths >= 2) {
      if (node.archetype === "ST2") {
        applyArchetype(node, "ST3", random);
        node.sim.lastChange = "稳定节点降级";
        events.push(`${node.name} 降级为前哨。`);
        changedNodeIdSet.add(node.id);
      } else if (node.archetype === "ST3") {
        const shouldChaosize = hasNearNode(
          nodes,
          distances,
          index,
          region.maxRadius,
          (other) => other.state === "active" && isMediumPlusChaos(other)
        );
        if (shouldChaosize) {
          applyArchetype(node, "BL3", random);
          applyOwnershipFromExpansion(node);
          node.sim.lastChange = "前哨混沌化";
          events.push(`${node.name} 由前哨混沌化为无序区。`);
          changedNodeIdSet.add(node.id);
        }
      }
      node.sim.prosperity = 0;
    }

    if (node.archetype === "BL1" && node.sim.negativeMonths >= 2) {
      const nearestInactive = getNearestIndices(
        nodes,
        distances,
        index,
        region.maxRadius,
        (other) => other.state === "inactive"
      )[0];

      if (nearestInactive !== undefined) {
        const target = nodes[nearestInactive];
        toActiveNode(target, "BL3", random);
        target.faction = node.faction;
        target.sim.prosperity = -40;
        target.sim.lastChange = "灾厄扩散激活无序区";
        events.push(`${node.name} 向 ${target.name} 扩散，生成无序区。`);
        changedNodeIdSet.add(target.id);
      }
    } else if (isChaosArchetype(node.archetype) && node.archetype !== "BL1" && node.sim.negativeMonths >= 3) {
      if (node.archetype === "BL3") {
        applyArchetype(node, "BL2", random);
        applyOwnershipFromExpansion(node);
        node.sim.lastChange = "无序区升级为混沌区";
        events.push(`${node.name} 混沌化升级为中扩张场。`);
        changedNodeIdSet.add(node.id);
      }
    }

    if (node.sim.highProsperityMonths >= 2) {
      if (node.archetype === "ST3") {
        applyArchetype(node, "ST2", random);
        applyOwnershipFromExpansion(node);
        node.sim.lastChange = "繁荣化升级为枢纽";
        events.push(`${node.name} 繁荣化升级为职能枢纽。`);
        changedNodeIdSet.add(node.id);
      } else if (node.archetype === "NOD") {
        applyArchetype(node, "ST3", random);
        applyOwnershipFromExpansion(node);
        node.sim.lastChange = "资源点职能化为前哨";
        events.push(`${node.name} 职能化为前哨。`);
        changedNodeIdSet.add(node.id);
      }
    }

    if (node.sim.highProsperityMonths >= 4) {
      if (node.archetype === "BL2") {
        applyArchetype(node, "BL3", random);
        node.sim.lastChange = "混沌区被净化为无序区";
        events.push(`${node.name} 被净化，扩张等级下降。`);
        changedNodeIdSet.add(node.id);
      } else if (node.archetype === "BL3") {
        toGhost(node);
        node.sim.lastChange = "无序区净化为幽灵位";
        events.push(`${node.name} 被净化为幽灵位。`);
        changedNodeIdSet.add(node.id);
      }
    }

    if (node.sim.highProsperityMonths >= 8 && node.archetype === "BL1") {
      toGhost(node);
      node.sim.lastChange = "灾厄源头被完全净化";
      events.push(`${node.name} 完成完全净化，暂时熄灭。`);
      changedNodeIdSet.add(node.id);
    }

    const profile = ARCHETYPE_PROFILES[node.archetype];
    node.sim.prosperity = safeRound(clamp(node.sim.prosperity, -1800, profile.initialStrength * 20));
    rollTierDecay(node, random);
    updateFieldVisual(node);
  }

  const gatheringHighlight = topNodeIds(nodes, (node) => node.sim.totalOrder + node.sim.totalExpansion, 8);
  const unstableNodes = nodes.filter((node) => node.sim.delta < 0).map((node) => node.id);
  const changedNodes = [...changedNodeIdSet];
  const snapshotHighlights = topNodeIds(nodes, (node) => node.sim.prosperity, 8);

  const edges = recomputeEdgeFlux(region.edges, nodes);
  const suppression = mapSuppression(nodes);
  const counts = reportStateCounts(nodes);

  const report: RegionMonthReport = {
    month: targetMonth,
    events: events.slice(0, 24),
    suppression,
    activeNodes: counts.activeNodes,
    inactiveNodes: counts.inactiveNodes,
    ghostNodes: counts.ghostNodes,
    playback: toPlaybackFrames({
      gatheringHighlight,
      unstableNodes,
      changedNodes,
      snapshotHighlights,
      events
    })
  };

  return {
    region: {
      ...region,
      nodes,
      edges,
      mapSuppression: suppression,
      currentMonth: targetMonth,
      lastMonthReport: report
    },
    report
  };
}

export function sortFactionInfluence(map: InfluenceBreakdown): Array<{ faction: Faction; value: number }> {
  return (Object.keys(map) as Faction[])
    .map((faction) => ({ faction, value: map[faction] }))
    .sort((a, b) => {
      if (b.value === a.value) {
        return factionRank(a.faction) - factionRank(b.faction);
      }
      return b.value - a.value;
    });
}
