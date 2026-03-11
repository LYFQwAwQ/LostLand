import { buildRegionTopology } from "../lib/topology";
import { createStartupHeroes } from "./heroRoster";
import type { ContinentId, DominionStaticConfig, RegionTopology } from "../types/game";

export const initialLogs: string[] = [
  "侦察队已完成北侧荒野测绘，新增 3 条可达路线。",
  "边境岗哨补给完成，地图压制效率提升。",
  "冒险家协会发布委派：清理荆棘丛林外围。",
  "迷雾区节点出现开发迹象，建议持续投入秩序场。"
];

export const heroes = createStartupHeroes();

const DEFAULT_DOMINION_CONFIG: DominionStaticConfig = {
  environmentTraits: ["平原"],
  factionWeights: [
    { faction: "Human", weight: 1 },
    { faction: "Beast", weight: 1 },
    { faction: "Neutral", weight: 1 }
  ],
  baseRegionScale: 30,
  scaleRange: [0.9, 1.1],
  complexityBase: 0.45,
  complexitySwing: 0.2,
  initialStrongFieldCount: 2,
  initEvolutionMonthCap: 6,
  weightSwing: 0.25,
  maxRadius: 5,
  fullFactionChance: 0.2,
  pathWeightRange: [0.9, 1.3]
};

export const continents: Array<{ id: ContinentId; name: string; dominion: string; region: string; seed: number }> = [
  { id: "central", name: "中央大陆", dominion: "圣辉疆域", region: "晨星边境", seed: 101 },
  { id: "north", name: "北方大陆", dominion: "霜狼疆域", region: "白霜前线", seed: 202 },
  { id: "south", name: "南方大陆", dominion: "焰砂疆域", region: "熔砂峡谷", seed: 303 },
  { id: "west", name: "西方大陆", dominion: "风暴疆域", region: "断潮海岸", seed: 404 },
  { id: "east", name: "东方大陆", dominion: "古林疆域", region: "幽木密林", seed: 505 }
];

export const defaultRegionId = continents[0].id;

export function createInitialRegions(): RegionTopology[] {
  return continents.map((entry) =>
    buildRegionTopology({
      regionId: entry.id,
      continentId: entry.id,
      continentName: entry.name,
      dominionId: `${entry.id}-default`,
      dominionName: entry.dominion,
      regionName: entry.region,
      neighborRegionIds: [],
      dominionConfig: {
        ...DEFAULT_DOMINION_CONFIG,
        environmentTraits: [...DEFAULT_DOMINION_CONFIG.environmentTraits],
        factionWeights: DEFAULT_DOMINION_CONFIG.factionWeights.map((item) => ({ ...item })),
        scaleRange: [...DEFAULT_DOMINION_CONFIG.scaleRange] as [number, number],
        pathWeightRange: [...DEFAULT_DOMINION_CONFIG.pathWeightRange] as [number, number]
      },
      seed: entry.seed,
      basePointCount: 30,
      minDistance: 10.2,
      complexity: 0.45,
      maxRadius: 5
    })
  );
}
