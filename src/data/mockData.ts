import { buildRegionTopology } from "../lib/topology";
import type { ContinentId, Hero, RegionTopology } from "../types/game";

export const initialLogs: string[] = [
  "侦察队已完成北侧荒野测绘，新增 3 条可达路线。",
  "边境岗哨补给完成，地图压制效率提升。",
  "冒险家协会发布委派：清理荆棘丛林外围。",
  "迷雾区节点出现开发迹象，建议持续投入秩序场。"
];

export const heroes: Hero[] = [
  {
    id: "arthur",
    name: "阿瑟·列维坦",
    title: "圣壁守望者",
    heroClass: "paladin",
    image:
      "https://images.unsplash.com/photo-1614726310457-53ba02aa64c5?auto=format&fit=crop&q=80&w=900",
    stats: { hp: "12,500", mp: "800", str: "245", int: "85", agi: "112", def: "450" }
  },
  {
    id: "selene",
    name: "塞琳娜·逐星",
    title: "星环织法者",
    heroClass: "mage",
    image:
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=900",
    stats: { hp: "4,200", mp: "4,500", str: "42", int: "380", agi: "156", def: "120" }
  }
];

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
      dominionName: entry.dominion,
      regionName: entry.region,
      seed: entry.seed,
      basePointCount: 30,
      minDistance: 10.2,
      complexity: 0.45,
      maxRadius: 5
    })
  );
}
