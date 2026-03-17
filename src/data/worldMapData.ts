import worldHierarchyJson from "../config/world/worldHierarchy.json";
import { buildRegionTopology } from "../lib/topology";
import { createFixedRegionTopology, hasFixedRegionTopology } from "./fixedRegionTopologies";
import type { ContinentId, DominionStaticConfig, Faction, RegionTopology } from "../types/game";

interface RawFactionWeight {
  faction: Faction;
  weight: number;
}

interface RawContinent {
  id: ContinentId;
  name: string;
  feature: string;
  topDropPoolKey: string;
  dominionIds: string[];
}

interface RawDominion {
  id: string;
  continentId: ContinentId;
  name: string;
  environmentTraits: string[];
  factionWeights: RawFactionWeight[];
  baseRegionScale: number;
  scaleRange: [number, number];
  complexityBase: number;
  complexitySwing: number;
  initialStrongFieldCount: number;
  initEvolutionMonthCap: number;
  weightSwing: number;
  maxRadius: number;
  fullFactionChance: number;
  pathWeightRange: [number, number];
  regionIds: string[];
}

interface RawRegion {
  id: string;
  dominionId: string;
  name: string;
  seed: number;
  neighbors: string[];
  pickerPosition?: [number, number];
}

interface WorldHierarchyRaw {
  continents: RawContinent[];
  dominions: RawDominion[];
  regions: RawRegion[];
}

export interface WorldSelection {
  continentId: ContinentId;
  dominionId: string;
  regionId: string;
}

export interface ContinentMeta extends RawContinent {}

export interface DominionMeta extends RawDominion {}

export interface RegionMeta extends RawRegion {
  continentId: ContinentId;
  continentName: string;
  dominionName: string;
}

export interface RegionLink {
  from: string;
  to: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function lerp(min: number, max: number, ratio: number): number {
  return min + (max - min) * ratio;
}

function normalizeFactionWeights(weights: RawFactionWeight[]): RawFactionWeight[] {
  const sum = weights.reduce((acc, item) => acc + Math.max(0, item.weight), 0);
  if (sum <= 0) {
    return [
      { faction: "Human", weight: 34 },
      { faction: "Beast", weight: 33 },
      { faction: "Neutral", weight: 33 }
    ];
  }

  return weights.map((item) => ({
    faction: item.faction,
    weight: Number(((Math.max(0, item.weight) / sum) * 100).toFixed(3))
  }));
}

function withWeightSwing(weights: RawFactionWeight[], swing: number, random: () => number): RawFactionWeight[] {
  if (swing <= 0) {
    return normalizeFactionWeights(weights);
  }

  const swung = weights.map((item) => {
    const ratio = 1 + (random() * 2 - 1) * swing;
    return { faction: item.faction, weight: Math.max(0.01, item.weight * ratio) };
  });

  return normalizeFactionWeights(swung);
}

const raw = worldHierarchyJson as WorldHierarchyRaw;

const continents: ContinentMeta[] = raw.continents.map((item) => ({ ...item }));
const dominions: DominionMeta[] = raw.dominions.map((item) => ({ ...item }));

const continentById = new Map<ContinentId, ContinentMeta>(continents.map((item) => [item.id, item]));
const dominionById = new Map<string, DominionMeta>(dominions.map((item) => [item.id, item]));

const regions: RegionMeta[] = raw.regions.map((item) => {
  const dominion = dominionById.get(item.dominionId);
  if (!dominion) {
    throw new Error(`世界配置错误：Region ${item.id} 找不到 Dominion ${item.dominionId}`);
  }

  const continent = continentById.get(dominion.continentId);
  if (!continent) {
    throw new Error(`世界配置错误：Dominion ${dominion.id} 找不到 Continent ${dominion.continentId}`);
  }

  return {
    ...item,
    continentId: dominion.continentId,
    continentName: continent.name,
    dominionName: dominion.name
  };
});

const regionById = new Map<string, RegionMeta>(regions.map((item) => [item.id, item]));

continents.forEach((continent) => {
  continent.dominionIds.forEach((dominionId) => {
    const dominion = dominionById.get(dominionId);
    if (!dominion) {
      throw new Error(`世界配置错误：Continent ${continent.id} 引用了不存在的 Dominion ${dominionId}`);
    }
    if (dominion.continentId !== continent.id) {
      throw new Error(`世界配置错误：Dominion ${dominionId} 不属于 Continent ${continent.id}`);
    }
  });
});

dominions.forEach((dominion) => {
  dominion.regionIds.forEach((regionId) => {
    const region = regionById.get(regionId);
    if (!region) {
      throw new Error(`世界配置错误：Dominion ${dominion.id} 引用了不存在的 Region ${regionId}`);
    }
    if (region.dominionId !== dominion.id) {
      throw new Error(`世界配置错误：Region ${regionId} 不属于 Dominion ${dominion.id}`);
    }
  });
});

regions.forEach((region) => {
  region.neighbors.forEach((neighborId) => {
    if (!regionById.has(neighborId)) {
      throw new Error(`世界配置错误：Region ${region.id} 的邻接地区 ${neighborId} 不存在`);
    }
  });
});

const defaultContinent = continents[0];
const defaultDominion = dominionById.get(defaultContinent.dominionIds[0]);
if (!defaultDominion) {
  throw new Error("世界配置错误：找不到默认疆域");
}
const defaultRegion = regionById.get(defaultDominion.regionIds[0]);
if (!defaultRegion) {
  throw new Error("世界配置错误：找不到默认地区");
}

export const WORLD_CONTINENTS = continents;
export const DEFAULT_WORLD_SELECTION: WorldSelection = {
  continentId: defaultRegion.continentId,
  dominionId: defaultRegion.dominionId,
  regionId: defaultRegion.id
};

export const DEFAULT_REGION_ID = DEFAULT_WORLD_SELECTION.regionId;

export function getContinentMeta(continentId: ContinentId): ContinentMeta | undefined {
  return continentById.get(continentId);
}

export function getDominionMeta(dominionId: string): DominionMeta | undefined {
  return dominionById.get(dominionId);
}

export function getRegionMeta(regionId: string): RegionMeta | undefined {
  return regionById.get(regionId);
}

export function getDominionsByContinent(continentId: ContinentId): DominionMeta[] {
  return dominions.filter((item) => item.continentId === continentId);
}

export function getRegionsByDominion(dominionId: string): RegionMeta[] {
  return regions.filter((item) => item.dominionId === dominionId);
}

export function getNeighborRegions(regionId: string): RegionMeta[] {
  const region = regionById.get(regionId);
  if (!region) {
    return [];
  }

  return region.neighbors
    .map((neighborId) => regionById.get(neighborId))
    .filter((item): item is RegionMeta => !!item);
}

export function getIntraDominionNeighborRegions(regionId: string): RegionMeta[] {
  const region = regionById.get(regionId);
  if (!region) {
    return [];
  }
  const links = getDominionRegionLinks(region.dominionId);
  const connectedIds = links
    .filter((link) => link.from === region.id || link.to === region.id)
    .map((link) => (link.from === region.id ? link.to : link.from));

  return connectedIds
    .map((neighborId) => regionById.get(neighborId))
    .filter((item): item is RegionMeta => !!item);
}

export function getDominionRegionLinks(dominionId: string): RegionLink[] {
  const dominionRegions = getRegionsByDominion(dominionId);
  const allowed = new Set(dominionRegions.map((item) => item.id));
  const seen = new Set<string>();
  const links: RegionLink[] = [];

  dominionRegions.forEach((region) => {
    region.neighbors.forEach((neighborId) => {
      if (!allowed.has(neighborId)) {
        return;
      }
      const pair = [region.id, neighborId].sort();
      const key = `${pair[0]}::${pair[1]}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      links.push({ from: pair[0], to: pair[1] });
    });
  });

  return links;
}

export function parseWorldSelection(
  continentId?: string | null,
  dominionId?: string | null,
  regionId?: string | null
): WorldSelection | null {
  if (!regionId) {
    return null;
  }

  const region = regionById.get(regionId);
  if (!region) {
    return null;
  }

  if (continentId && continentId !== region.continentId) {
    return null;
  }
  if (dominionId && dominionId !== region.dominionId) {
    return null;
  }

  return {
    continentId: region.continentId,
    dominionId: region.dominionId,
    regionId: region.id
  };
}

export function resolveSelectionFromLegacyRegion(regionId?: string | null): WorldSelection | null {
  if (!regionId) {
    return null;
  }
  const region = regionById.get(regionId);
  if (!region) {
    return null;
  }
  return {
    continentId: region.continentId,
    dominionId: region.dominionId,
    regionId: region.id
  };
}

export function selectionFromRegion(region: Pick<RegionTopology, "continentId" | "dominionId" | "id">): WorldSelection {
  return {
    continentId: region.continentId,
    dominionId: region.dominionId,
    regionId: region.id
  };
}

export function buildWorldMapSearchParams(selection: WorldSelection): URLSearchParams {
  return new URLSearchParams({
    continent: selection.continentId,
    dominion: selection.dominionId,
    region: selection.regionId
  });
}

function buildDominionStaticConfig(meta: DominionMeta): DominionStaticConfig {
  return {
    environmentTraits: [...meta.environmentTraits],
    factionWeights: normalizeFactionWeights(meta.factionWeights),
    baseRegionScale: meta.baseRegionScale,
    scaleRange: [...meta.scaleRange] as [number, number],
    complexityBase: meta.complexityBase,
    complexitySwing: meta.complexitySwing,
    initialStrongFieldCount: meta.initialStrongFieldCount,
    initEvolutionMonthCap: meta.initEvolutionMonthCap,
    weightSwing: meta.weightSwing,
    maxRadius: meta.maxRadius,
    fullFactionChance: meta.fullFactionChance,
    pathWeightRange: [...meta.pathWeightRange] as [number, number]
  };
}

function rollPreGrowthMonths(cap: number, random: () => number): number {
  const safeCap = Math.max(1, Math.round(cap));
  const lower = Math.max(1, Math.floor(safeCap / 2));
  const span = safeCap - lower + 1;
  return lower + Math.floor(random() * span);
}

export function createRegionTopologyById(regionId: string): RegionTopology {
  const regionMeta = regionById.get(regionId);
  if (!regionMeta) {
    throw new Error(`未知地区: ${regionId}`);
  }

  const dominionMeta = dominionById.get(regionMeta.dominionId);
  if (!dominionMeta) {
    throw new Error(`地区 ${regionId} 缺失疆域配置`);
  }

  const dominionConfig = buildDominionStaticConfig(dominionMeta);

  if (hasFixedRegionTopology(regionMeta.id)) {
    return createFixedRegionTopology({
      regionId: regionMeta.id,
      continentId: regionMeta.continentId,
      continentName: regionMeta.continentName,
      dominionId: regionMeta.dominionId,
      dominionName: regionMeta.dominionName,
      regionName: regionMeta.name,
      neighborRegionIds: [...regionMeta.neighbors],
      dominionConfig
    });
  }

  const random = mulberry32(hashSeed(`${regionMeta.id}-${regionMeta.seed}-${dominionMeta.id}`));
  const scaleFactor = lerp(dominionMeta.scaleRange[0], dominionMeta.scaleRange[1], random());
  const basePointCount = Math.round(clamp(dominionMeta.baseRegionScale * scaleFactor, 18, 68));
  const minDistance = Number(clamp(104 / Math.sqrt(basePointCount), 7.2, 13.2).toFixed(2));

  const complexityNoise = (random() * 2 - 1) * dominionMeta.complexitySwing;
  const complexity = Number(clamp(dominionMeta.complexityBase * (1 + complexityNoise), 0.1, 0.92).toFixed(3));

  const factionWeights = withWeightSwing(dominionMeta.factionWeights, dominionMeta.weightSwing, random);
  const preGrowthMonths = rollPreGrowthMonths(dominionMeta.initEvolutionMonthCap, random);

  return buildRegionTopology({
    regionId: regionMeta.id,
    continentId: regionMeta.continentId,
    continentName: regionMeta.continentName,
    dominionId: regionMeta.dominionId,
    dominionName: regionMeta.dominionName,
    regionName: regionMeta.name,
    neighborRegionIds: [...regionMeta.neighbors],
    seed: regionMeta.seed,
    basePointCount,
    minDistance,
    complexity,
    maxRadius: dominionMeta.maxRadius,
    factionWeights,
    initialStrongFieldCount: dominionMeta.initialStrongFieldCount,
    fullFactionChance: dominionMeta.fullFactionChance,
    preGrowthMonths,
    pathWeightRange: [...dominionMeta.pathWeightRange] as [number, number],
    dominionConfig
  });
}

