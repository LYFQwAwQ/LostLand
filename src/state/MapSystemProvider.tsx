import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { initialLogs } from "../data/mockData";
import { createRegionTopologyById } from "../data/worldMapData";
import {
  acceptMission,
  applyMissionBattleOutcome,
  generateRegionBulletinMissions,
  submitMission
} from "../lib/bulletinMissionSystem";
import { settleRegionOneMonth } from "../lib/monthlySimulation";
import type {
  BulletinMissionReward,
  BulletinMissionState,
  MissionBattleOutcome,
  RegionNode,
  RegionTopology
} from "../types/game";

interface MapSystemContextValue {
  regions: RegionTopology[];
  worldMonth: number;
  worldLogs: string[];
  ensureRegionLoaded: (regionId: string) => RegionTopology;
  advanceOneMonth: (regionId: string) => void;
  getRegionById: (regionId?: string | null) => RegionTopology | undefined;
  findNodeById: (nodeId?: string) => { region: RegionTopology; node: RegionNode } | null;
  getRegionBulletinMissions: (regionId?: string | null) => BulletinMissionState[];
  getRegionMissionWarning: (regionId?: string | null) => string | null;
  acceptBulletinMission: (regionId: string, missionId: string) => boolean;
  submitBulletinMission: (regionId: string, missionId: string) => BulletinMissionReward | null;
  reportMissionBattleOutcome: (outcome: MissionBattleOutcome) => void;
}

const MapSystemContext = createContext<MapSystemContextValue | null>(null);

function cloneMissionReward(reward: BulletinMissionReward): BulletinMissionReward {
  return {
    bounty: reward.bounty,
    reputation: reward.reputation,
    materials: reward.materials.map((item) => ({ ...item })),
    consumables: reward.consumables.map((item) => ({ ...item }))
  };
}

export function MapSystemProvider({ children }: { children: ReactNode }) {
  const [regionsById, setRegionsById] = useState<Record<string, RegionTopology>>({});
  const [worldMonth, setWorldMonth] = useState(1);
  const [worldLogs, setWorldLogs] = useState<string[]>(initialLogs);
  const [missionsByRegionId, setMissionsByRegionId] = useState<Record<string, BulletinMissionState[]>>({});
  const [missionWarningByRegionId, setMissionWarningByRegionId] = useState<Record<string, string>>({});

  const regions = useMemo(() => Object.values(regionsById), [regionsById]);

  const ensureRegionLoaded = useCallback(
    (regionId: string): RegionTopology => {
      const existing = regionsById[regionId];
      if (existing) {
        return existing;
      }

      const created = createRegionTopologyById(regionId);
      const generated = generateRegionBulletinMissions(created);
      setRegionsById((prev) => {
        if (prev[regionId]) {
          return prev;
        }
        return { ...prev, [regionId]: created };
      });
      setMissionsByRegionId((prev) => {
        if (prev[regionId]) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: generated.missions
        };
      });
      setMissionWarningByRegionId((prev) => {
        if (!generated.warning) {
          if (!prev[regionId]) {
            return prev;
          }
          const { [regionId]: _, ...rest } = prev;
          return rest;
        }
        if (prev[regionId] === generated.warning) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: generated.warning
        };
      });
      return created;
    },
    [regionsById]
  );

  const advanceOneMonth = useCallback((regionId: string) => {
    setWorldMonth((prevWorldMonth) => {
      const targetMonth = prevWorldMonth + 1;

      setRegionsById((prev) => {
        const existing = prev[regionId];
        const baseRegion = existing ?? createRegionTopologyById(regionId);

        if (!existing) {
          const generated = generateRegionBulletinMissions(baseRegion);
          setMissionsByRegionId((old) =>
            old[regionId]
              ? old
              : {
                  ...old,
                  [regionId]: generated.missions
                }
          );
          setMissionWarningByRegionId((old) => {
            if (!generated.warning) {
              return old;
            }
            return {
              ...old,
              [regionId]: generated.warning
            };
          });
        }

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
  }, []);

  const acceptBulletinMission = useCallback(
    (regionId: string, missionId: string): boolean => {
      let accepted = false;
      setMissionsByRegionId((prev) => {
        const regionMissions = prev[regionId];
        if (!regionMissions || regionMissions.length <= 0) {
          return prev;
        }

        let changed = false;
        const next = regionMissions.map((mission) => {
          if (mission.id !== missionId) {
            return mission;
          }
          const updated = acceptMission(mission, worldMonth);
          if (!updated) {
            return mission;
          }
          accepted = true;
          changed = true;
          return updated;
        });

        if (!changed) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: next
        };
      });
      return accepted;
    },
    [worldMonth]
  );

  const submitBulletinMission = useCallback(
    (regionId: string, missionId: string): BulletinMissionReward | null => {
      let reward: BulletinMissionReward | null = null;
      setMissionsByRegionId((prev) => {
        const regionMissions = prev[regionId];
        if (!regionMissions || regionMissions.length <= 0) {
          return prev;
        }

        let changed = false;
        const next = regionMissions.map((mission) => {
          if (mission.id !== missionId) {
            return mission;
          }
          const updated = submitMission(mission, worldMonth);
          if (!updated) {
            return mission;
          }
          reward = cloneMissionReward(mission.reward);
          changed = true;
          return updated;
        });

        if (!changed) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: next
        };
      });
      return reward;
    },
    [worldMonth]
  );

  const reportMissionBattleOutcome = useCallback((outcome: MissionBattleOutcome) => {
    if (!outcome.regionId) {
      return;
    }
    setMissionsByRegionId((prev) => {
      const regionMissions = prev[outcome.regionId];
      if (!regionMissions || regionMissions.length <= 0) {
        return prev;
      }

      let changed = false;
      const next = regionMissions.map((mission) => {
        const updated = applyMissionBattleOutcome(mission, outcome);
        if (updated !== mission) {
          changed = true;
        }
        return updated;
      });

      if (!changed) {
        return prev;
      }
      return {
        ...prev,
        [outcome.regionId]: next
      };
    });
  }, []);

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
      },
      getRegionBulletinMissions(regionId) {
        if (!regionId) {
          return [];
        }
        const list = missionsByRegionId[regionId] ?? [];
        return list.filter(
          (mission) =>
            mission &&
            typeof mission.id === "string" &&
            typeof mission.type === "string" &&
            Array.isArray(mission.collectTargets) &&
            Array.isArray(mission.huntTargets) &&
            mission.reward &&
            Array.isArray(mission.reward.materials) &&
            Array.isArray(mission.reward.consumables)
        );
      },
      getRegionMissionWarning(regionId) {
        if (!regionId) {
          return null;
        }
        return missionWarningByRegionId[regionId] ?? null;
      },
      acceptBulletinMission,
      submitBulletinMission,
      reportMissionBattleOutcome
    }),
    [
      acceptBulletinMission,
      advanceOneMonth,
      ensureRegionLoaded,
      missionWarningByRegionId,
      missionsByRegionId,
      regions,
      regionsById,
      reportMissionBattleOutcome,
      submitBulletinMission,
      worldLogs,
      worldMonth
    ]
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
