import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getBulletinMissionAcceptedLimit } from "../data/config/bulletinMissionConfig";
import { initialLogs } from "../data/mockData";
import { createRegionTopologyById, getRegionMeta } from "../data/worldMapData";
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

interface BulletinMissionAcceptResult {
  ok: boolean;
  reason: string | null;
}

interface MapSystemContextValue {
  regions: RegionTopology[];
  worldMonth: number;
  worldLogs: string[];
  acceptedMissionLimit: number;
  acceptedMissionCount: number;
  setAcceptedMissionExtraCapacity: (extraCapacity: number) => void;
  ensureRegionLoaded: (regionId: string) => RegionTopology;
  advanceOneMonth: (regionId: string) => void;
  getRegionById: (regionId?: string | null) => RegionTopology | undefined;
  findNodeById: (nodeId?: string) => { region: RegionTopology; node: RegionNode } | null;
  getRegionBulletinMissions: (regionId?: string | null) => BulletinMissionState[];
  getAcceptedBulletinMissions: () => BulletinMissionState[];
  getRegionMissionWarning: (regionId?: string | null) => string | null;
  acceptBulletinMission: (regionId: string, missionId: string) => BulletinMissionAcceptResult;
  submitBulletinMission: (regionId: string, missionId: string) => BulletinMissionReward | null;
  reportMissionBattleOutcome: (outcome: MissionBattleOutcome) => void;
}

const MapSystemContext = createContext<MapSystemContextValue | null>(null);
const MAX_SUPPRESSION = 100;
const FULL_LIBERATION_SUPPRESSION_THRESHOLD = 100;
const MISSION_SUBMIT_SUPPRESSION_GAIN = 4;

const BATTLE_SUPPRESSION_GAIN_BY_ARCHETYPE: Record<RegionNode["archetype"], number> = {
  BL1: 8,
  BL2: 5,
  BL3: 3,
  ST1: 0,
  ST2: 0,
  ST3: 0,
  NOD: 0
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeSuppression(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(clamp(value, 0, MAX_SUPPRESSION));
}

function cloneMissionReward(reward: BulletinMissionReward): BulletinMissionReward {
  return {
    bounty: reward.bounty,
    reputation: reward.reputation,
    materials: reward.materials.map((item) => ({ ...item })),
    consumables: reward.consumables.map((item) => ({ ...item }))
  };
}

function boostMissionRewardBySuppression(reward: BulletinMissionReward, suppression: number): BulletinMissionReward {
  const ratio = clamp(suppression / 100, 0, 1);
  const quantityMultiplier = 1 + ratio * 0.55;
  const valueMultiplier = 1 + ratio * 0.5;

  return {
    materials: reward.materials.map((item) => ({
      ...item,
      quantity: Math.max(1, Math.round(item.quantity * quantityMultiplier))
    })),
    consumables: reward.consumables.map((item) => ({
      ...item,
      quantity: Math.max(1, Math.round(item.quantity * quantityMultiplier))
    })),
    bounty: Math.max(0, Math.round(reward.bounty * valueMultiplier)),
    reputation: Math.max(0, Math.round(reward.reputation * valueMultiplier))
  };
}

function purgeBl1NodesForLiberation(region: RegionTopology): { region: RegionTopology; convertedNodeNames: string[] } {
  const convertedNodeNames: string[] = [];
  const nextNodes = region.nodes.map((node) => {
    if (node.state !== "active" || node.archetype !== "BL1") {
      return node;
    }

    convertedNodeNames.push(node.name);
    return {
      ...node,
      archetype: "BL2" as const,
      entityType: "混沌区",
      difficulty: "高" as const,
      sim: {
        ...node.sim,
        negativeMonths: 0,
        highProsperityMonths: 0,
        prosperity: Math.max(-220, Math.min(-40, node.sim.prosperity))
      }
    };
  });

  if (convertedNodeNames.length <= 0) {
    return { region, convertedNodeNames };
  }

  return {
    region: {
      ...region,
      nodes: nextNodes
    },
    convertedNodeNames
  };
}

function applySuppressionProgressToRegion(
  region: RegionTopology,
  suppressionProgress: number
): { region: RegionTopology; convertedNodeNames: string[] } {
  const nextSuppression = sanitizeSuppression(region.mapSuppression + suppressionProgress);
  let nextRegion: RegionTopology =
    nextSuppression === region.mapSuppression
      ? region
      : {
          ...region,
          mapSuppression: nextSuppression
        };
  let convertedNodeNames: string[] = [];

  if (nextSuppression >= FULL_LIBERATION_SUPPRESSION_THRESHOLD) {
    const purged = purgeBl1NodesForLiberation(nextRegion);
    nextRegion = {
      ...purged.region,
      mapSuppression: FULL_LIBERATION_SUPPRESSION_THRESHOLD
    };
    convertedNodeNames = purged.convertedNodeNames;
  }

  return {
    region: nextRegion,
    convertedNodeNames
  };
}

function isAcceptedBulletinMission(mission: BulletinMissionState): boolean {
  return mission.status === "in_progress" || mission.status === "ready_to_submit";
}

export function MapSystemProvider({ children }: { children: ReactNode }) {
  const [regionsById, setRegionsById] = useState<Record<string, RegionTopology>>({});
  const [worldMonth, setWorldMonth] = useState(1);
  const [worldLogs, setWorldLogs] = useState<string[]>(initialLogs);
  const [missionsByRegionId, setMissionsByRegionId] = useState<Record<string, BulletinMissionState[]>>({});
  const [missionWarningByRegionId, setMissionWarningByRegionId] = useState<Record<string, string>>({});
  const [suppressionProgressByRegionId, setSuppressionProgressByRegionId] = useState<Record<string, number>>({});
  const [acceptedMissionExtraCapacity, setAcceptedMissionExtraCapacityState] = useState(0);
  const acceptedMissionLimit = getBulletinMissionAcceptedLimit(acceptedMissionExtraCapacity);

  const regions = useMemo(() => Object.values(regionsById), [regionsById]);
  const acceptedMissionCount = useMemo(
    () =>
      Object.values(missionsByRegionId).reduce(
        (acc, regionMissions) => acc + regionMissions.filter((mission) => isAcceptedBulletinMission(mission)).length,
        0
      ),
    [missionsByRegionId]
  );

  const setAcceptedMissionExtraCapacity = useCallback((extraCapacity: number) => {
    const normalized = Number.isFinite(extraCapacity) ? Math.max(0, Math.floor(extraCapacity)) : 0;
    setAcceptedMissionExtraCapacityState((prev) => (prev === normalized ? prev : normalized));
  }, []);

  const applySuppressionGain = useCallback(
    (regionId: string, gain: number, reason: string) => {
      const safeGain = sanitizeSuppression(gain);
      if (safeGain <= 0) {
        return;
      }

      setSuppressionProgressByRegionId((prev) => ({
          ...prev,
          [regionId]: sanitizeSuppression((prev[regionId] ?? 0) + safeGain)
        }));

      setRegionsById((prev) => {
        const currentRegion = prev[regionId];
        if (!currentRegion) {
          return prev;
        }
        const applied = applySuppressionProgressToRegion(currentRegion, safeGain);
        if (applied.region === currentRegion) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: applied.region
        };
      });

      setWorldLogs((old) => {
        const regionName = getRegionMeta(regionId)?.name ?? "地区";
        return [`${regionName}：${reason}，压制值 +${safeGain}。`, ...old].slice(0, 18);
      });
    },
    []
  );

  const ensureRegionLoaded = useCallback(
    (regionId: string): RegionTopology => {
      const existing = regionsById[regionId];
      if (existing) {
        return existing;
      }

      const created = createRegionTopologyById(regionId);
      const regionProgress = suppressionProgressByRegionId[regionId] ?? 0;
      const appliedCreated = applySuppressionProgressToRegion(created, regionProgress).region;
      const generated = generateRegionBulletinMissions(appliedCreated, (targetRegionId) =>
        targetRegionId === regionId ? appliedCreated : regionsById[targetRegionId]
      );

      setRegionsById((prev) => {
        if (prev[regionId]) {
          return prev;
        }
        return { ...prev, [regionId]: appliedCreated };
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

      return appliedCreated;
    },
    [regionsById, suppressionProgressByRegionId]
  );

  const advanceOneMonth = useCallback(
    (regionId: string) => {
      setWorldMonth((prevWorldMonth) => {
        const targetMonth = prevWorldMonth + 1;

      setRegionsById((prev) => {
        const existing = prev[regionId];
        const regionProgress = suppressionProgressByRegionId[regionId] ?? 0;
        const baseRegion = existing ?? applySuppressionProgressToRegion(createRegionTopologyById(regionId), regionProgress).region;

          if (!existing) {
            const generated = generateRegionBulletinMissions(baseRegion, (targetRegionId) =>
              targetRegionId === regionId ? baseRegion : prev[targetRegionId]
            );
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
          const progressedSettled = applySuppressionProgressToRegion(settled.region, regionProgress);
          const nextRegion = progressedSettled.region;

          setWorldLogs((old) => {
            const regionName = nextRegion.regionName;
            const monthLogs = settled.report.events.slice(0, 6).map((event) => `${regionName}：${event}`);
            const extraLogs: string[] = [];

            if (regionProgress > 0) {
              extraLogs.push(`${regionName}：玩家治理贡献生效，当前压制 ${nextRegion.mapSuppression}%。`);
            }
            if (progressedSettled.convertedNodeNames.length > 0) {
              extraLogs.push(`${regionName}：完全解放达成，已清除 BL1（${progressedSettled.convertedNodeNames.join("、")}）。`);
            }

            if (monthLogs.length === 0) {
              return [...extraLogs, `第 ${targetMonth} 月结算完成（${regionName}），无重大事件。`, ...old].slice(0, 18);
            }

            return [...extraLogs, ...monthLogs.reverse(), ...old].slice(0, 18);
          });

          return {
            ...prev,
            [regionId]: nextRegion
          };
        });

        return targetMonth;
      });
    },
    [suppressionProgressByRegionId]
  );

  const acceptBulletinMission = useCallback(
    (regionId: string, missionId: string): BulletinMissionAcceptResult => {
      let result: BulletinMissionAcceptResult = {
        ok: false,
        reason: "任务领取失败：请确认任务仍为可领取状态。"
      };
      setMissionsByRegionId((prev) => {
        const regionMissions = prev[regionId];
        if (!regionMissions || regionMissions.length <= 0) {
          result = {
            ok: false,
            reason: "任务领取失败：当前地区未生成可领取任务。"
          };
          return prev;
        }
        const acceptedCount = Object.values(prev).reduce(
          (acc, list) => acc + list.filter((mission) => isAcceptedBulletinMission(mission)).length,
          0
        );
        if (acceptedCount >= acceptedMissionLimit) {
          result = {
            ok: false,
            reason: `当前最多可同时接取 ${acceptedMissionLimit} 个任务，请先提交或完成已有任务。`
          };
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
          result = {
            ok: true,
            reason: null
          };
          changed = true;
          return updated;
        });

        if (!changed) {
          if (!result.ok) {
            result = {
              ok: false,
              reason: "任务领取失败：请确认任务仍为可领取状态。"
            };
          }
          return prev;
        }
        return {
          ...prev,
          [regionId]: next
        };
      });
      return result;
    },
    [acceptedMissionLimit, worldMonth]
  );

  const submitBulletinMission = useCallback(
    (regionId: string, missionId: string): BulletinMissionReward | null => {
      let reward: BulletinMissionReward | null = null;
      let shouldGainSuppression = false;
      const regionSuppression = sanitizeSuppression(regionsById[regionId]?.mapSuppression ?? 0);

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
          reward = boostMissionRewardBySuppression(cloneMissionReward(mission.reward), regionSuppression);
          changed = true;
          shouldGainSuppression = true;
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

      if (shouldGainSuppression) {
        applySuppressionGain(regionId, MISSION_SUBMIT_SUPPRESSION_GAIN, "完成地区委派");
      }

      return reward;
    },
    [applySuppressionGain, regionsById, worldMonth]
  );

  const reportMissionBattleOutcome = useCallback(
    (outcome: MissionBattleOutcome) => {
      if (!outcome.regionId) {
        return;
      }
      const outcomeDominionId = getRegionMeta(outcome.regionId)?.dominionId;
      if (!outcomeDominionId) {
        return;
      }
      setMissionsByRegionId((prev) => {
        let changed = false;
        const nextByRegionId: Record<string, BulletinMissionState[]> = { ...prev };
        Object.entries(prev).forEach(([missionRegionId, regionMissions]) => {
          if (!regionMissions || regionMissions.length <= 0) {
            return;
          }
          const missionDominionId = getRegionMeta(missionRegionId)?.dominionId;
          if (missionDominionId !== outcomeDominionId) {
            return;
          }
          let regionChanged = false;
          const next = regionMissions.map((mission) => {
            const updated = applyMissionBattleOutcome(mission, outcome);
            if (updated !== mission) {
              changed = true;
              regionChanged = true;
            }
            return updated;
          });
          if (regionChanged) {
            nextByRegionId[missionRegionId] = next;
          }
        });

        if (!changed) {
          return prev;
        }
        return nextByRegionId;
      });

      if (!outcome.victory || !outcome.nodeArchetype) {
        return;
      }
      const suppressionGain = BATTLE_SUPPRESSION_GAIN_BY_ARCHETYPE[outcome.nodeArchetype] ?? 0;
      if (suppressionGain <= 0) {
        return;
      }

      applySuppressionGain(outcome.regionId, suppressionGain, "讨伐胜利");
    },
    [applySuppressionGain]
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
      },
      getRegionBulletinMissions(regionId) {
        if (!regionId) {
          return [];
        }
        const list = missionsByRegionId[regionId] ?? [];
        const regionSuppression = regionsById[regionId]?.mapSuppression ?? 0;
        return list
          .filter(
            (mission) =>
              mission &&
              typeof mission.id === "string" &&
              typeof mission.type === "string" &&
              Array.isArray(mission.collectTargets) &&
              Array.isArray(mission.huntTargets) &&
              mission.reward &&
              Array.isArray(mission.reward.materials) &&
              Array.isArray(mission.reward.consumables)
          )
          .map((mission) => {
            if (mission.status === "completed") {
              return mission;
            }
            return {
              ...mission,
              reward: boostMissionRewardBySuppression(mission.reward, regionSuppression)
            };
          });
      },
      getAcceptedBulletinMissions() {
        return Object.values(missionsByRegionId)
          .flatMap((regionMissions) => regionMissions)
          .filter((mission) => isAcceptedBulletinMission(mission));
      },
      getRegionMissionWarning(regionId) {
        if (!regionId) {
          return null;
        }
        return missionWarningByRegionId[regionId] ?? null;
      },
      acceptedMissionLimit,
      acceptedMissionCount,
      setAcceptedMissionExtraCapacity,
      acceptBulletinMission,
      submitBulletinMission,
      reportMissionBattleOutcome
    }),
    [
      acceptedMissionCount,
      acceptedMissionLimit,
      acceptBulletinMission,
      advanceOneMonth,
      ensureRegionLoaded,
      setAcceptedMissionExtraCapacity,
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
