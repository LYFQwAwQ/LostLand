import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { initialLogs } from "../data/mockData";
import { createRegionTopologyById } from "../data/worldMapData";
import { settleRegionOneMonth } from "../lib/monthlySimulation";
import type { RegionNode, RegionTopology } from "../types/game";

interface MapSystemContextValue {
  regions: RegionTopology[];
  worldMonth: number;
  worldLogs: string[];
  ensureRegionLoaded: (regionId: string) => RegionTopology;
  advanceOneMonth: (regionId: string) => void;
  getRegionById: (regionId?: string | null) => RegionTopology | undefined;
  findNodeById: (nodeId?: string) => { region: RegionTopology; node: RegionNode } | null;
}

const MapSystemContext = createContext<MapSystemContextValue | null>(null);

export function MapSystemProvider({ children }: { children: ReactNode }) {
  const [regionsById, setRegionsById] = useState<Record<string, RegionTopology>>({});
  const [worldMonth, setWorldMonth] = useState(1);
  const [worldLogs, setWorldLogs] = useState<string[]>(initialLogs);

  const regions = useMemo(() => Object.values(regionsById), [regionsById]);

  const ensureRegionLoaded = useCallback(
    (regionId: string): RegionTopology => {
      const existing = regionsById[regionId];
      if (existing) {
        return existing;
      }

      const created = createRegionTopologyById(regionId);
      setRegionsById((prev) => {
        if (prev[regionId]) {
          return prev;
        }
        return { ...prev, [regionId]: created };
      });
      return created;
    },
    [regionsById]
  );

  const advanceOneMonth = useCallback(
    (regionId: string) => {
      setWorldMonth((prevWorldMonth) => {
        const targetMonth = prevWorldMonth + 1;

        setRegionsById((prev) => {
          const baseRegion = prev[regionId] ?? createRegionTopologyById(regionId);
          const settled = settleRegionOneMonth(baseRegion);

          setWorldLogs((old) => {
            const regionName = settled.region.regionName;
            const monthLogs = settled.report.events.slice(0, 6).map((event) => `${regionName}：${event}`);

            if (monthLogs.length === 0) {
              return [`第 ${targetMonth} 月结算完成（${regionName}），无重大事件。`, ...old].slice(0, 18);
            }

            return [...monthLogs.reverse(), ...old].slice(0, 18);
          });

          return {
            ...prev,
            [regionId]: settled.region
          };
        });

        return targetMonth;
      });
    },
    []
  );

  const value = useMemo<MapSystemContextValue>(
    () => ({
      regions,
      worldMonth,
      worldLogs,
      ensureRegionLoaded,
      advanceOneMonth,
      getRegionById(regionId) {
        if (!regionId) {
          return undefined;
        }
        return regionsById[regionId];
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
    [advanceOneMonth, ensureRegionLoaded, regions, regionsById, worldLogs, worldMonth]
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
