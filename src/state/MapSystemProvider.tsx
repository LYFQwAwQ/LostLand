import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createInitialRegions, initialLogs } from "../data/mockData";
import { settleRegionOneMonth } from "../lib/monthlySimulation";
import type { RegionNode, RegionTopology } from "../types/game";

interface MapSystemContextValue {
  regions: RegionTopology[];
  worldMonth: number;
  worldLogs: string[];
  advanceOneMonth: () => void;
  getRegionById: (regionId?: string | null) => RegionTopology;
  findNodeById: (nodeId?: string) => { region: RegionTopology; node: RegionNode } | null;
}

const MapSystemContext = createContext<MapSystemContextValue | null>(null);

export function MapSystemProvider({ children }: { children: ReactNode }) {
  const [regions, setRegions] = useState<RegionTopology[]>(() => createInitialRegions());
  const [worldMonth, setWorldMonth] = useState(1);
  const [worldLogs, setWorldLogs] = useState<string[]>(initialLogs);

  const advanceOneMonth = () => {
    const targetMonth = worldMonth + 1;

    setRegions((prev) => {
      const settled = prev.map((region) => settleRegionOneMonth(region));

      const monthLogs = settled
        .flatMap((item) => item.report.events.map((event) => `${item.region.regionName}：${event}`))
        .slice(-18);

      setWorldLogs((old) => {
        const base = old.slice(0, 6);
        if (monthLogs.length === 0) {
          return [`第 ${targetMonth} 月结算完成，无重大事件。`, ...base].slice(0, 18);
        }
        return [...monthLogs.reverse(), ...base].slice(0, 18);
      });

      return settled.map((item) => item.region);
    });

    setWorldMonth(targetMonth);
  };

  const value = useMemo<MapSystemContextValue>(
    () => ({
      regions,
      worldMonth,
      worldLogs,
      advanceOneMonth,
      getRegionById(regionId) {
        if (!regionId) {
          return regions[0];
        }
        return regions.find((region) => region.id === regionId) ?? regions[0];
      },
      findNodeById(nodeId) {
        if (!nodeId) {
          return null;
        }

        for (const region of regions) {
          const node = region.nodes.find((item) => item.id === nodeId);
          if (node) {
            return { region, node };
          }
        }

        return null;
      }
    }),
    [regions, worldLogs, worldMonth]
  );

  return <MapSystemContext.Provider value={value}>{children}</MapSystemContext.Provider>;
}

export function useMapSystem(): MapSystemContextValue {
  const context = useContext(MapSystemContext);
  if (!context) {
    throw new Error("useMapSystem must be used within MapSystemProvider");
  }
  return context;
}
