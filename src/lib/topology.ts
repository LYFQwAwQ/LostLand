import {
  ARCHETYPE_PROFILES,
  mapArchetypeDifficulty,
  mapArchetypeEntityType,
  pickRandom,
  randomBuffByArchetype,
  randomEnvironmentByArchetype,
  randomNameByArchetype
} from "./archetypes";
import { settleRegionOneMonth } from "./monthlySimulation";
import type {
  DominionStaticConfig,
  Faction,
  FactionWeight,
  InfluenceBreakdown,
  NodeArchetype,
  RegionEdge,
  RegionNode,
  RegionTopology
} from "../types/game";

interface Point {
  x: number;
  y: number;
}

interface BuildRegionOptions {
  regionId: string;
  continentId: RegionTopology["continentId"];
  continentName: string;
  dominionId: string;
  dominionName: string;
  regionName: string;
  neighborRegionIds: string[];
  dominionConfig: DominionStaticConfig;
  seed: number;
  basePointCount?: number;
  minDistance?: number;
  complexity?: number;
  maxRadius?: number;
  factionWeights?: FactionWeight[];
  initialStrongFieldCount?: number;
  fullFactionChance?: number;
  preGrowthMonths?: number;
  pathWeightRange?: [number, number];
}

interface Triangle {
  a: number;
  b: number;
  c: number;
}

interface EdgeIndex {
  from: number;
  to: number;
}

class UnionFind {
  private parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(x: number): number {
    if (this.parent[x] !== x) {
      this.parent[x] = this.find(this.parent[x]);
    }
    return this.parent[x];
  }

  union(a: number, b: number): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) {
      return false;
    }
    this.parent[rootB] = rootA;
    return true;
  }
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shuffleInPlace<T>(list: T[], random: () => number): void {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

function pointToCell(p: Point, cellSize: number): [number, number] {
  return [Math.floor(p.x / cellSize), Math.floor(p.y / cellSize)];
}

function isFarEnough(
  point: Point,
  grid: Array<Array<number | null>>,
  points: Point[],
  cellSize: number,
  minDistance: number,
  width: number,
  height: number
): boolean {
  if (point.x <= 4 || point.x >= width - 4 || point.y <= 4 || point.y >= height - 4) {
    return false;
  }

  const [gx, gy] = pointToCell(point, cellSize);
  for (let y = Math.max(0, gy - 2); y <= Math.min(grid.length - 1, gy + 2); y += 1) {
    for (let x = Math.max(0, gx - 2); x <= Math.min(grid[0].length - 1, gx + 2); x += 1) {
      const idx = grid[y][x];
      if (idx === null) {
        continue;
      }
      if (dist(point, points[idx]) < minDistance) {
        return false;
      }
    }
  }

  return true;
}

function generatePoissonPoints(
  width: number,
  height: number,
  minDistance: number,
  maxAttempts: number,
  targetCount: number,
  random: () => number
): Point[] {
  const cellSize = minDistance / Math.SQRT2;
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid: Array<Array<number | null>> = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );

  const points: Point[] = [];
  const active: Point[] = [];

  const first: Point = {
    x: 6 + random() * (width - 12),
    y: 6 + random() * (height - 12)
  };
  points.push(first);
  active.push(first);
  const [sx, sy] = pointToCell(first, cellSize);
  grid[sy][sx] = 0;

  while (active.length > 0 && points.length < targetCount) {
    const index = Math.floor(random() * active.length);
    const center = active[index];
    let found = false;

    for (let i = 0; i < maxAttempts; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = minDistance * (1 + random());
      const candidate: Point = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      };

      if (!isFarEnough(candidate, grid, points, cellSize, minDistance, width, height)) {
        continue;
      }

      points.push(candidate);
      active.push(candidate);
      const [cx, cy] = pointToCell(candidate, cellSize);
      grid[cy][cx] = points.length - 1;
      found = true;
      break;
    }

    if (!found) {
      active.splice(index, 1);
    }
  }

  return points;
}

function circumcenter(a: Point, b: Point, c: Point): { x: number; y: number; r2: number } | null {
  const d =
    2 *
    (a.x * (b.y - c.y) +
      b.x * (c.y - a.y) +
      c.x * (a.y - b.y));

  if (Math.abs(d) < 1e-9) {
    return null;
  }

  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;

  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  const r2 = (ux - a.x) * (ux - a.x) + (uy - a.y) * (uy - a.y);

  return { x: ux, y: uy, r2 };
}

function inCircumcircle(point: Point, triangle: Triangle, points: Point[]): boolean {
  const circle = circumcenter(points[triangle.a], points[triangle.b], points[triangle.c]);
  if (!circle) {
    return false;
  }

  const d2 = (point.x - circle.x) * (point.x - circle.x) + (point.y - circle.y) * (point.y - circle.y);
  return d2 <= circle.r2 + 1e-6;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function edgePairsOfTriangle(t: Triangle): EdgeIndex[] {
  return [
    { from: t.a, to: t.b },
    { from: t.b, to: t.c },
    { from: t.c, to: t.a }
  ];
}

function bowyerWatson(points: Point[]): Triangle[] {
  if (points.length < 3) {
    return [];
  }

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const dx = maxX - minX;
  const dy = maxY - minY;
  const deltaMax = Math.max(dx, dy);
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const superA: Point = { x: midX - 20 * deltaMax, y: midY - deltaMax };
  const superB: Point = { x: midX, y: midY + 20 * deltaMax };
  const superC: Point = { x: midX + 20 * deltaMax, y: midY - deltaMax };

  const allPoints = [...points, superA, superB, superC];
  const superAIndex = allPoints.length - 3;
  const superBIndex = allPoints.length - 2;
  const superCIndex = allPoints.length - 1;

  let triangles: Triangle[] = [{ a: superAIndex, b: superBIndex, c: superCIndex }];

  for (let pIndex = 0; pIndex < points.length; pIndex += 1) {
    const point = allPoints[pIndex];
    const badTriangles = triangles.filter((tri) => inCircumcircle(point, tri, allPoints));

    const boundary = new Map<string, EdgeIndex>();
    for (const tri of badTriangles) {
      for (const edge of edgePairsOfTriangle(tri)) {
        const key = edgeKey(edge.from, edge.to);
        if (boundary.has(key)) {
          boundary.delete(key);
        } else {
          boundary.set(key, edge);
        }
      }
    }

    const badSet = new Set(badTriangles);
    triangles = triangles.filter((tri) => !badSet.has(tri));

    for (const edge of boundary.values()) {
      triangles.push({ a: edge.from, b: edge.to, c: pIndex });
    }
  }

  return triangles.filter(
    (tri) => tri.a < points.length && tri.b < points.length && tri.c < points.length
  );
}

function extractEdgesFromTriangles(triangles: Triangle[]): EdgeIndex[] {
  const set = new Map<string, EdgeIndex>();
  for (const tri of triangles) {
    for (const edge of edgePairsOfTriangle(tri)) {
      const key = edgeKey(edge.from, edge.to);
      if (!set.has(key)) {
        set.set(key, edge.from < edge.to ? edge : { from: edge.to, to: edge.from });
      }
    }
  }
  return [...set.values()];
}

function pruneEdges(
  points: Point[],
  edges: EdgeIndex[],
  complexity: number,
  random: () => number
): EdgeIndex[] {
  if (edges.length === 0) {
    return [];
  }

  const weighted = edges.map((edge) => ({
    ...edge,
    length: dist(points[edge.from], points[edge.to])
  }));

  weighted.sort((a, b) => a.length - b.length);

  const uf = new UnionFind(points.length);
  const mst: typeof weighted = [];

  for (const edge of weighted) {
    if (uf.union(edge.from, edge.to)) {
      mst.push(edge);
    }
  }

  const keepKeys = new Set(mst.map((edge) => edgeKey(edge.from, edge.to)));
  const remain = weighted.filter((edge) => !keepKeys.has(edgeKey(edge.from, edge.to)));

  const keepRatio = clamp(0.88 - complexity * 0.48, 0.35, 0.9);
  const target = Math.max(mst.length, Math.round(weighted.length * keepRatio));

  shuffleInPlace(remain, random);
  remain.sort((a, b) => a.length - b.length + (random() - 0.5) * 2);

  for (const edge of remain) {
    if (keepKeys.size >= target) {
      break;
    }
    keepKeys.add(edgeKey(edge.from, edge.to));
  }

  const kept = weighted.filter((edge) => keepKeys.has(edgeKey(edge.from, edge.to)));
  const degree = Array.from({ length: points.length }, () => 0);
  for (const edge of kept) {
    degree[edge.from] += 1;
    degree[edge.to] += 1;
  }

  for (let i = 0; i < points.length; i += 1) {
    if (degree[i] >= 2) {
      continue;
    }

    for (const edge of weighted) {
      if (edge.from !== i && edge.to !== i) {
        continue;
      }
      const key = edgeKey(edge.from, edge.to);
      if (keepKeys.has(key)) {
        continue;
      }
      keepKeys.add(key);
      degree[edge.from] += 1;
      degree[edge.to] += 1;
      if (degree[i] >= 2) {
        break;
      }
    }
  }

  return weighted
    .filter((edge) => keepKeys.has(edgeKey(edge.from, edge.to)))
    .map((edge) => ({ from: edge.from, to: edge.to }));
}

function inferFaction(archetype: NodeArchetype, random: () => number): Faction {
  if (archetype.startsWith("ST")) {
    return "Human";
  }
  if (archetype.startsWith("BL")) {
    return "Beast";
  }
  const roll = random();
  if (roll < 0.45) {
    return "Human";
  }
  if (roll < 0.78) {
    return "Beast";
  }
  return "Neutral";
}

const stablePool: NodeArchetype[] = ["ST1", "ST2", "ST2", "ST3", "ST3", "NOD"];
const chaosPool: NodeArchetype[] = ["BL1", "BL2", "BL2", "BL3", "BL3", "NOD"];

function generateNodeArchetype(state: RegionNode["state"], random: () => number): NodeArchetype {
  if (state !== "active") {
    return "NOD";
  }

  if (random() < 0.52) {
    return pickRandom(stablePool, random);
  }

  return pickRandom(chaosPool, random);
}

function createEmptyInfluence(): InfluenceBreakdown {
  return { Human: 0, Beast: 0, Neutral: 0 };
}

function createInitialNodeState(archetype: NodeArchetype, random: () => number): RegionNode["sim"] {
  const profile = ARCHETYPE_PROFILES[archetype];

  return {
    initialStrength: profile.initialStrength,
    baseStrength: profile.initialStrength,
    aggression: Math.round(profile.initialStrength * profile.aggressionScale),
    prosperity: Math.round((random() * 2 - 1) * 80),
    stability: 0,
    chaos: 0,
    totalOrder: 0,
    totalExpansion: 0,
    delta: 0,
    negativeMonths: 0,
    positiveMonths: 0,
    highProsperityMonths: 0,
    developmentMonths: 0,
    orderByFaction: createEmptyInfluence(),
    expansionByFaction: createEmptyInfluence(),
    lastChange: null
  };
}

interface WeightedEdgeIndex extends EdgeIndex {
  weight: number;
}

function applyArchetypePreset(node: RegionNode, archetype: NodeArchetype, faction: Faction, random: () => number): void {
  const profile = ARCHETYPE_PROFILES[archetype];
  node.state = "active";
  node.archetype = archetype;
  node.faction = faction;
  node.entityType = mapArchetypeEntityType(archetype);
  node.name = randomNameByArchetype(archetype, random);
  node.environment = randomEnvironmentByArchetype(archetype, random);
  node.stayBuff = randomBuffByArchetype(archetype, random);
  node.difficulty = mapArchetypeDifficulty(archetype);
  node.sim = createInitialNodeState(archetype, random);
  node.field.orderAura = clamp(0.15 + profile.orderScale + random() * 0.1, 0.05, 1);
  node.field.expansionAura = clamp(0.15 + profile.expansionScale + random() * 0.1, 0.05, 1);
  node.field.pulse = clamp(0.35 + random() * 0.6, 0.2, 1);
}

function buildDistanceMatrix(nodeCount: number, edges: WeightedEdgeIndex[]): number[][] {
  const matrix = Array.from({ length: nodeCount }, (_, i) =>
    Array.from({ length: nodeCount }, (_, j) => (i === j ? 0 : Number.POSITIVE_INFINITY))
  );

  edges.forEach((edge) => {
    if (edge.weight < matrix[edge.from][edge.to]) {
      matrix[edge.from][edge.to] = edge.weight;
      matrix[edge.to][edge.from] = edge.weight;
    }
  });

  for (let k = 0; k < nodeCount; k += 1) {
    for (let i = 0; i < nodeCount; i += 1) {
      for (let j = 0; j < nodeCount; j += 1) {
        const candidate = matrix[i][k] + matrix[k][j];
        if (candidate < matrix[i][j]) {
          matrix[i][j] = candidate;
        }
      }
    }
  }

  return matrix;
}

function assignFactionsByWeight(weights: FactionWeight[], seedCount: number): Faction[] {
  if (seedCount <= 0) {
    return [];
  }

  const normalized = [...weights]
    .sort((left, right) => right.weight - left.weight)
    .map((item) => ({ faction: item.faction, quota: (item.weight / 100) * seedCount, assigned: 0 }));

  if (normalized.length === 0) {
    return Array.from({ length: seedCount }, () => "Neutral");
  }

  const result: Faction[] = [];
  for (let i = 0; i < seedCount; i += 1) {
    normalized.sort((left, right) => {
      const leftGap = left.quota - left.assigned;
      const rightGap = right.quota - right.assigned;
      if (rightGap === leftGap) {
        return right.quota - left.quota;
      }
      return rightGap - leftGap;
    });
    normalized[0].assigned += 1;
    result.push(normalized[0].faction);
  }

  return result;
}

function pickCradleSeedIndices(
  points: Point[],
  distances: number[][],
  seedCount: number,
  random: () => number
): number[] {
  if (points.length === 0 || seedCount <= 0) {
    return [];
  }

  const center = { x: 50, y: 50 };
  const centralCandidates = points
    .map((point, index) => ({ index, d: dist(point, center) }))
    .sort((left, right) => left.d - right.d);

  const firstPoolSize = Math.max(1, Math.floor(centralCandidates.length * 0.35));
  const firstSeed = centralCandidates[Math.floor(random() * firstPoolSize)].index;
  const selected = [firstSeed];

  while (selected.length < Math.min(seedCount, points.length)) {
    let bestIndex = -1;
    let bestDistance = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < points.length; i += 1) {
      if (selected.includes(i)) {
        continue;
      }

      const nearest = selected.reduce((min, selectedIndex) => Math.min(min, distances[i][selectedIndex]), Number.POSITIVE_INFINITY);
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) {
      break;
    }
    selected.push(bestIndex);
  }

  return selected;
}

function applyStaticSeeding(
  nodes: RegionNode[],
  points: Point[],
  weightedEdges: WeightedEdgeIndex[],
  options: BuildRegionOptions,
  random: () => number
): void {
  const factionWeights = options.factionWeights ?? options.dominionConfig.factionWeights;
  const desiredSeeds = Math.max(1, Math.min(options.initialStrongFieldCount ?? options.dominionConfig.initialStrongFieldCount, nodes.length));
  const distances = buildDistanceMatrix(points.length, weightedEdges);
  const cradleIndices = pickCradleSeedIndices(points, distances, desiredSeeds, random);
  const seedFactions = assignFactionsByWeight(factionWeights, cradleIndices.length);

  cradleIndices.forEach((nodeIndex, idx) => {
    const faction = seedFactions[idx] ?? factionWeights[0]?.faction ?? "Neutral";
    applyArchetypePreset(nodes[nodeIndex], "ST1", faction, random);
  });

  if (cradleIndices.length === 0) {
    return;
  }

  const shouldForceFullFaction = random() < (options.fullFactionChance ?? options.dominionConfig.fullFactionChance);
  if (!shouldForceFullFaction) {
    return;
  }

  const occupied = new Set<number>(cradleIndices);
  const seededFactions = new Set(seedFactions);
  const sovereignFaction =
    [...factionWeights].sort((left, right) => right.weight - left.weight)[0]?.faction ?? "Human";
  const sovereignSeeds = cradleIndices.filter((index) => nodes[index].faction === sovereignFaction);
  const anchorSeeds = sovereignSeeds.length > 0 ? sovereignSeeds : cradleIndices;

  factionWeights.forEach((item) => {
    if (seededFactions.has(item.faction)) {
      return;
    }

    let chosenIndex = -1;
    let chosenDistance = Number.NEGATIVE_INFINITY;

    for (let i = 0; i < nodes.length; i += 1) {
      if (occupied.has(i)) {
        continue;
      }

      const nearest = anchorSeeds.reduce((min, seedIndex) => Math.min(min, distances[i][seedIndex]), Number.POSITIVE_INFINITY);
      const passRadius = nearest > (options.maxRadius ?? options.dominionConfig.maxRadius);
      if (!passRadius) {
        continue;
      }
      if (nearest > chosenDistance) {
        chosenDistance = nearest;
        chosenIndex = i;
      }
    }

    if (chosenIndex < 0) {
      for (let i = 0; i < nodes.length; i += 1) {
        if (occupied.has(i)) {
          continue;
        }
        chosenIndex = i;
        break;
      }
    }

    if (chosenIndex < 0) {
      return;
    }

    occupied.add(chosenIndex);
    applyArchetypePreset(nodes[chosenIndex], "ST2", item.faction, random);
  });
}

function preGrowRegion(region: RegionTopology, rounds: number): RegionTopology {
  if (rounds <= 0) {
    return region;
  }

  let working: RegionTopology = {
    ...region,
    id: `${region.id}__pregrowth`,
    currentMonth: 1,
    lastMonthReport: undefined
  };

  for (let i = 0; i < rounds; i += 1) {
    working = settleRegionOneMonth(working).region;
  }

  return {
    ...working,
    id: region.id,
    currentMonth: 1,
    lastMonthReport: undefined
  };
}

function applyHistoryShake(nodes: RegionNode[], random: () => number): RegionNode[] {
  return nodes.map((node) => {
    const shake = 1 + (random() * 2 - 1) * 0.1;
    const profile = ARCHETYPE_PROFILES[node.archetype];
    return {
      ...node,
      sim: {
        ...node.sim,
        prosperity: Number(clamp(node.sim.prosperity * shake, -1800, profile.initialStrength * 20).toFixed(2))
      }
    };
  });
}

function estimateMapSuppression(nodes: RegionNode[]): number {
  const active = nodes.filter((node) => node.state === "active");
  const stableCount = active.filter((node) => node.archetype.startsWith("ST")).length;
  const chaosCount = active.filter((node) => node.archetype.startsWith("BL")).length;
  const avgProsperity = active.length > 0 ? active.reduce((sum, node) => sum + node.sim.prosperity, 0) / active.length : 0;

  const score =
    (stableCount / Math.max(stableCount + chaosCount, 1)) * 72 +
    clamp(avgProsperity / 16, -18, 18) -
    chaosCount * 0.7 +
    26;

  return Math.round(clamp(score, 0, 100));
}

export function buildRegionTopology(options: BuildRegionOptions): RegionTopology {
  const random = mulberry32(options.seed);
  const baseCount = options.basePointCount ?? 30;
  const minDistance = options.minDistance ?? 11;
  const complexity = clamp(options.complexity ?? 0.45, 0.05, 0.95);
  const maxRadius = options.maxRadius ?? options.dominionConfig.maxRadius;
  const pathWeightRange = options.pathWeightRange ?? options.dominionConfig.pathWeightRange;

  const points = generatePoissonPoints(100, 100, minDistance, 28, baseCount, random);
  const triangles = bowyerWatson(points);
  const allEdges = extractEdgesFromTriangles(triangles);
  const edges = pruneEdges(points, allEdges, complexity, random);
  const weightedEdges: WeightedEdgeIndex[] = edges.map((edge) => ({
    ...edge,
    weight: Number((dist(points[edge.from], points[edge.to]) * (pathWeightRange[0] + random() * (pathWeightRange[1] - pathWeightRange[0]))).toFixed(3))
  }));

  const nodeIds = points.map((_, i) => `${options.regionId}-n${String(i + 1).padStart(2, "0")}`);
  const stateSlots = points.map((_, index) => index);
  shuffleInPlace(stateSlots, random);

  const activeCount = Math.max(10, Math.floor(points.length * 0.68));
  const ghostCount = Math.max(2, Math.floor(points.length * 0.1));

  const stateMap = new Map<number, RegionNode["state"]>();
  for (let i = 0; i < points.length; i += 1) {
    if (i < activeCount) {
      stateMap.set(stateSlots[i], "active");
    } else if (i < activeCount + ghostCount) {
      stateMap.set(stateSlots[i], "ghost");
    } else {
      stateMap.set(stateSlots[i], "inactive");
    }
  }

  const nodes: RegionNode[] = points.map((point, index) => {
    const state = stateMap.get(index) ?? "inactive";
    const archetype = generateNodeArchetype(state, random);
    const profile = ARCHETYPE_PROFILES[archetype];
    const fogCurrent = Math.round(random() * 160);
    const fogTarget = 240;
    const trait = options.dominionConfig.environmentTraits.length > 0 ? pickRandom(options.dominionConfig.environmentTraits, random) : null;
    const baseEnvironment = randomEnvironmentByArchetype(archetype, random);

    return {
      id: nodeIds[index],
      regionId: options.regionId,
      name: randomNameByArchetype(archetype, random),
      entityType: mapArchetypeEntityType(archetype),
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3)),
      state,
      archetype,
      faction: inferFaction(archetype, random),
      environment: trait ? `${baseEnvironment} · ${trait}` : baseEnvironment,
      stayBuff: randomBuffByArchetype(archetype, random),
      difficulty: mapArchetypeDifficulty(archetype),
      field: {
        orderAura: clamp(0.15 + profile.orderScale + random() * 0.1, 0.05, 1),
        expansionAura: clamp(0.15 + profile.expansionScale + random() * 0.1, 0.05, 1),
        pulse: clamp(0.35 + random() * 0.6, 0.2, 1)
      },
      fog: {
        accumulatedDelta: Number((Math.round((random() * 2 - 0.5) * 100) / 100).toFixed(2)),
        current: fogCurrent,
        target: fogTarget
      },
      sim: createInitialNodeState(archetype, random)
    };
  });

  applyStaticSeeding(nodes, points, weightedEdges, options, random);

  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));

  const regionEdges: RegionEdge[] = weightedEdges.map((edge, index) => {
    const fromId = nodeIds[edge.from];
    const toId = nodeIds[edge.to];
    const fromNode = nodeById[fromId];
    const toNode = nodeById[toId];

    return {
      id: `${options.regionId}-e${index + 1}`,
      from: fromId,
      to: toId,
      weight: edge.weight,
      fieldFlux: {
        order: Number(((fromNode.field.orderAura + toNode.field.orderAura) / 2).toFixed(3)),
        expansion: Number(((fromNode.field.expansionAura + toNode.field.expansionAura) / 2).toFixed(3))
      }
    };
  });

  const baseRegion: RegionTopology = {
    id: options.regionId,
    continentId: options.continentId,
    continentName: options.continentName,
    dominionId: options.dominionId,
    dominionName: options.dominionName,
    regionName: options.regionName,
    neighborRegionIds: [...options.neighborRegionIds],
    dominionConfig: {
      ...options.dominionConfig,
      environmentTraits: [...options.dominionConfig.environmentTraits],
      factionWeights: options.dominionConfig.factionWeights.map((item) => ({ ...item })),
      scaleRange: [...options.dominionConfig.scaleRange] as [number, number],
      pathWeightRange: [...options.dominionConfig.pathWeightRange] as [number, number]
    },
    mapSuppression: Math.round(30 + random() * 45),
    nodes,
    edges: regionEdges,
    currentMonth: 1,
    maxRadius
  };

  const preGrowthRounds = Math.max(0, options.preGrowthMonths ?? 0);
  const preGrownRegion = preGrowRegion(baseRegion, preGrowthRounds);
  const shakenNodes = applyHistoryShake(preGrownRegion.nodes, random);

  return {
    ...preGrownRegion,
    nodes: shakenNodes,
    mapSuppression: estimateMapSuppression(shakenNodes),
    currentMonth: 1,
    lastMonthReport: undefined
  };
}



