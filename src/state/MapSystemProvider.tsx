import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getBulletinMissionAcceptedLimit } from "../data/config/bulletinMissionConfig";
import { getMarketItemName, getMarketItemRarity, marketNodeDefinitionByNodeId } from "../data/markets";
import { initialLogs } from "../data/mockData";
import { ritualDefinitionById, ritualDefinitionByNodeId } from "../data/rituals";
import { createRegionTopologyById, getRegionMeta } from "../data/worldMapData";
import {
  acceptMission,
  applyMissionBattleOutcome,
  generateRegionBulletinMissions,
  submitMission
} from "../lib/bulletinMissionSystem";
import {
  advanceSuppressionStateByMonth,
  applyBattleSuppressionState,
  applyMissionSuppressionState,
  calculateVisibleSuppression,
  createInitialSuppressionState,
  getSuppressionBonusDetail,
  type RegionSuppressionState
} from "../lib/suppressionSystem";
import { settleRegionOneMonth } from "../lib/monthlySimulation";
import type {
  BulletinMissionReward,
  BulletinMissionState,
  MarketMonthState,
  MarketPricedItem,
  MissionBattleOutcome,
  RegionNode,
  RegionTopology,
  RitualDefinition,
  RitualState
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
  getRegionSuppression: (regionId?: string | null) => number;
  findNodeById: (nodeId?: string) => { region: RegionTopology; node: RegionNode } | null;
  getNodeMarket: (nodeId?: string | null) => MarketMonthState | null;
  consumeNodeMarketStock: (nodeId: string, itemId: string, quantity: number) => boolean;
  getNodeRitual: (nodeId?: string | null) => RitualDefinition | null;
  getRitualState: (ritualId?: string | null) => RitualState | null;
  recordRitualAttempt: (ritualId: string) => void;
  completeRitual: (ritualId: string) => void;
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

function hashNumber(source: string): number {
  let value = 0;
  for (let index = 0; index < source.length; index += 1) {
    value = (value << 5) - value + source.charCodeAt(index);
    value |= 0;
  }
  return Math.abs(value);
}

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

function applySuppressionStateToRegion(
  region: RegionTopology,
  state: RegionSuppressionState,
  baseSuppression: number
): { region: RegionTopology; convertedNodeNames: string[]; bonusDetail: ReturnType<typeof getSuppressionBonusDetail> } {
  const bonusDetail = getSuppressionBonusDetail(state, region);
  const visibleSuppression = calculateVisibleSuppression(baseSuppression, state, region);

  let nextRegion: RegionTopology =
    visibleSuppression === region.mapSuppression
      ? region
      : {
          ...region,
          mapSuppression: visibleSuppression
        };
  let convertedNodeNames: string[] = [];

  if (visibleSuppression >= FULL_LIBERATION_SUPPRESSION_THRESHOLD) {
    const purged = purgeBl1NodesForLiberation(nextRegion);
    nextRegion = {
      ...purged.region,
      mapSuppression: FULL_LIBERATION_SUPPRESSION_THRESHOLD
    };
    convertedNodeNames = purged.convertedNodeNames;
  }

  return {
    region: nextRegion,
    convertedNodeNames,
    bonusDetail
  };
}

function isAcceptedBulletinMission(mission: BulletinMissionState): boolean {
  return mission.status === "in_progress" || mission.status === "ready_to_submit";
}

function createInitialRitualState(ritualId: string): RitualState {
  return {
    ritualId,
    status: "locked",
    completedAtWorldMonth: null,
    lastAttemptAtWorldMonth: null
  };
}

function buildMarketMonthState(nodeId: string, targetWorldMonth: number): MarketMonthState | null {
  const definition = marketNodeDefinitionByNodeId[nodeId];
  if (!definition) {
    return null;
  }

  const monthlyFloat = 0.85 + (hashNumber(`${nodeId}-month-${targetWorldMonth}`) % 31) / 100;
  const buyItems: MarketPricedItem[] = definition.stockItems.map((item, index) => {
    const stockOffset = (hashNumber(`${nodeId}-${targetWorldMonth}-${item.itemId}`) % 7) - 3;
    const stock = Math.max(1, item.baseStock + stockOffset - Math.floor(index / 2));
    const unitPrice = Math.max(1, Math.round(item.basePrice * definition.nodeRoleMultiplier * monthlyFloat));
    return {
      itemId: item.itemId,
      category: item.category,
      name: getMarketItemName(item.itemId, item.category),
      rarity: getMarketItemRarity(item.itemId, item.category),
      unitPrice,
      stock,
      monthlyFloat,
      basePrice: item.basePrice
    };
  });

  return {
    nodeId,
    worldMonth: targetWorldMonth,
    buyItems,
    sellRate: definition.sellRate,
    monthlyFloat
  };
}

function buildRegionMarketState(region: RegionTopology, targetWorldMonth: number): Record<string, MarketMonthState> {
  return region.nodes.reduce<Record<string, MarketMonthState>>((acc, node) => {
    const marketState = buildMarketMonthState(node.id, targetWorldMonth);
    if (marketState) {
      acc[node.id] = marketState;
    }
    return acc;
  }, {});
}

function ensureRegionRitualStates(region: RegionTopology, previous: Record<string, RitualState>): Record<string, RitualState> {
  return region.nodes.reduce<Record<string, RitualState>>((acc, node) => {
    const ritual = ritualDefinitionByNodeId[node.id];
    if (!ritual) {
      return acc;
    }
    acc[ritual.id] = previous[ritual.id] ?? createInitialRitualState(ritual.id);
    return acc;
  }, {});
}

export function MapSystemProvider({ children }: { children: ReactNode }) {
  const [regionsById, setRegionsById] = useState<Record<string, RegionTopology>>({});
  const [baseSuppressionByRegionId, setBaseSuppressionByRegionId] = useState<Record<string, number>>({});
  const [suppressionStateByRegionId, setSuppressionStateByRegionId] = useState<Record<string, RegionSuppressionState>>({});
  const [worldMonth, setWorldMonth] = useState(1);
  const [worldLogs, setWorldLogs] = useState<string[]>(initialLogs);
  const [missionsByRegionId, setMissionsByRegionId] = useState<Record<string, BulletinMissionState[]>>({});
  const [missionWarningByRegionId, setMissionWarningByRegionId] = useState<Record<string, string>>({});
  const [marketStatesByNodeId, setMarketStatesByNodeId] = useState<Record<string, MarketMonthState>>({});
  const [ritualStatesById, setRitualStatesById] = useState<Record<string, RitualState>>({});
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

  const ensureRegionState = useCallback(
    (regionId: string): RegionSuppressionState => {
      const existing = suppressionStateByRegionId[regionId];
      if (existing) {
        return existing;
      }
      const initialState = createInitialSuppressionState();
      setSuppressionStateByRegionId((prev) => {
        if (prev[regionId]) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: initialState
        };
      });
      return initialState;
    },
    [suppressionStateByRegionId]
  );

  const updateSuppressionState = useCallback(
    (regionId: string, updater: (state: RegionSuppressionState) => RegionSuppressionState, reason: string) => {
      const currentState = ensureRegionState(regionId);
      const nextState = updater(currentState);
      if (
        nextState.purge === currentState.purge &&
        nextState.governance === currentState.governance &&
        nextState.supply === currentState.supply &&
        nextState.chaos === currentState.chaos &&
        nextState.fatigue === currentState.fatigue &&
        nextState.momentum === currentState.momentum
      ) {
        return;
      }

      setSuppressionStateByRegionId((prev) => ({
        ...prev,
        [regionId]: nextState
      }));

      setWorldLogs((old) => {
        const regionName = getRegionMeta(regionId)?.name ?? "地区";
        const detail = `P${Math.round(nextState.purge)}/G${Math.round(nextState.governance)}/S${Math.round(nextState.supply)}`;
        return [`${regionName}：${reason}，压制体系已更新（${detail}）。`, ...old].slice(0, 18);
      });

      setRegionsById((prev) => {
        const currentRegion = prev[regionId];
        if (!currentRegion) {
          return prev;
        }
        const baseSuppression = baseSuppressionByRegionId[regionId] ?? currentRegion.mapSuppression;
        const applied = applySuppressionStateToRegion(currentRegion, nextState, baseSuppression);
        if (applied.region === currentRegion) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: applied.region
        };
      });
    },
    [baseSuppressionByRegionId, ensureRegionState]
  );

  const ensureRegionLoaded = useCallback(
    (regionId: string): RegionTopology => {
      const existing = regionsById[regionId];
      if (existing) {
        return existing;
      }

      const created = createRegionTopologyById(regionId);
      const regionState = ensureRegionState(regionId);
      const baseSuppression = created.mapSuppression;
      const appliedCreated = applySuppressionStateToRegion(created, regionState, baseSuppression).region;
      const generated = generateRegionBulletinMissions(appliedCreated, (targetRegionId) =>
        targetRegionId === regionId ? appliedCreated : regionsById[targetRegionId]
      );

      setBaseSuppressionByRegionId((prev) => {
        if (prev[regionId] === baseSuppression) {
          return prev;
        }
        return {
          ...prev,
          [regionId]: baseSuppression
        };
      });
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
      setMarketStatesByNodeId((prev) => ({
        ...prev,
        ...buildRegionMarketState(appliedCreated, worldMonth)
      }));
      setRitualStatesById((prev) => ({
        ...prev,
        ...ensureRegionRitualStates(appliedCreated, prev)
      }));

      return appliedCreated;
    },
    [ensureRegionState, regionsById, worldMonth]
  );

  const advanceOneMonth = useCallback(
    (regionId: string) => {
      setWorldMonth((prevWorldMonth) => {
        const targetMonth = prevWorldMonth + 1;
        const existingRegion = regionsById[regionId];
        const baseRegion = existingRegion ?? createRegionTopologyById(regionId);
        const currentState = ensureRegionState(regionId);
        const currentBaseSuppression = baseSuppressionByRegionId[regionId] ?? baseRegion.mapSuppression;

        if (!existingRegion) {
          const generated = generateRegionBulletinMissions(baseRegion, (targetRegionId) =>
            targetRegionId === regionId ? baseRegion : regionsById[targetRegionId]
          );
          setRegionsById((prev) => {
            if (prev[regionId]) {
              return prev;
            }
            return { ...prev, [regionId]: baseRegion };
          });
          setBaseSuppressionByRegionId((prev) => {
            if (prev[regionId] === currentBaseSuppression) {
              return prev;
            }
            return {
              ...prev,
              [regionId]: currentBaseSuppression
            };
          });
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
          setMarketStatesByNodeId((prev) => ({
            ...prev,
            ...buildRegionMarketState(baseRegion, targetMonth)
          }));
          setRitualStatesById((prev) => ({
            ...prev,
            ...ensureRegionRitualStates(baseRegion, prev)
          }));
        }

        const settled = settleRegionOneMonth(baseRegion);
        const nextBaseSuppression = settled.region.mapSuppression;
        const nextState = advanceSuppressionStateByMonth(currentState, settled.region);
        const progressedSettled = applySuppressionStateToRegion(settled.region, nextState, nextBaseSuppression);

        setBaseSuppressionByRegionId((prev) => {
          if (prev[regionId] === nextBaseSuppression) {
            return prev;
          }
          return {
            ...prev,
            [regionId]: nextBaseSuppression
          };
        });
        setSuppressionStateByRegionId((prev) => {
          if (prev[regionId] === nextState) {
            return prev;
          }
          return {
            ...prev,
            [regionId]: nextState
          };
        });
        setRegionsById((prev) => {
          const current = prev[regionId];
          if (!current || current === progressedSettled.region) {
            return prev;
          }
          return {
            ...prev,
            [regionId]: progressedSettled.region
          };
        });
        setMarketStatesByNodeId((prev) => ({
          ...prev,
          ...buildRegionMarketState(progressedSettled.region, targetMonth)
        }));
        setRitualStatesById((prev) => ({
          ...prev,
          ...ensureRegionRitualStates(progressedSettled.region, prev)
        }));

        setWorldLogs((old) => {
          const regionName = progressedSettled.region.regionName;
          const monthLogs = settled.report.events.slice(0, 6).map((event) => `${regionName}：${event}`);
          const extraLogs: string[] = [];
          if (progressedSettled.bonusDetail.bonus > 0) {
            extraLogs.push(
              `${regionName}：治理体系投影生效，评分 ${progressedSettled.bonusDetail.score}，压制加成 +${progressedSettled.bonusDetail.bonus}。`
            );
          }
          if (progressedSettled.convertedNodeNames.length > 0) {
            extraLogs.push(`${regionName}：完全解放达成，已清除 BL1（${progressedSettled.convertedNodeNames.join("、")}）。`);
          }

          if (monthLogs.length === 0) {
            return [...extraLogs, `第 ${targetMonth} 月结算完成（${regionName}），无重大事件。`, ...old].slice(0, 18);
          }

          return [...extraLogs, ...monthLogs.reverse(), ...old].slice(0, 18);
        });

        return targetMonth;
      });
    },
    [baseSuppressionByRegionId, ensureRegionState, regionsById]
  );

  const consumeNodeMarketStock = useCallback((nodeId: string, itemId: string, quantity: number): boolean => {
    const normalizedQuantity = Math.max(0, Math.floor(quantity));
    if (!nodeId || !itemId || normalizedQuantity <= 0) {
      return false;
    }

    let changed = false;
    setMarketStatesByNodeId((prev) => {
      const current = prev[nodeId]?.worldMonth === worldMonth ? prev[nodeId] : buildMarketMonthState(nodeId, worldMonth);
      if (!current) {
        return prev;
      }
      const nextItems = current.buyItems.map((item) => {
        if (item.itemId !== itemId) {
          return item;
        }
        if (item.stock < normalizedQuantity) {
          return item;
        }
        changed = true;
        return {
          ...item,
          stock: item.stock - normalizedQuantity
        };
      });

      if (!changed) {
        return prev;
      }
      return {
        ...prev,
        [nodeId]: {
          ...current,
          buyItems: nextItems
        }
      };
    });
    return changed;
  }, [worldMonth]);

  const recordRitualAttempt = useCallback((ritualId: string) => {
    if (!ritualDefinitionById[ritualId]) {
      return;
    }
    setRitualStatesById((prev) => ({
      ...prev,
      [ritualId]: {
        ...(prev[ritualId] ?? createInitialRitualState(ritualId)),
        lastAttemptAtWorldMonth: worldMonth
      }
    }));
  }, [worldMonth]);

  const completeRitual = useCallback((ritualId: string) => {
    const ritual = ritualDefinitionById[ritualId];
    if (!ritual) {
      return;
    }

    const regionId = ritual.regionId;
    const currentState = ensureRegionState(regionId);
    const forcedState = {
      ...currentState,
      purge: Math.max(currentState.purge, 82),
      governance: Math.max(currentState.governance, 90),
      supply: Math.max(currentState.supply, 84),
      chaos: Math.min(currentState.chaos, 5),
      fatigue: Math.min(currentState.fatigue, 10),
      momentum: Math.max(currentState.momentum, 60)
    };

    setBaseSuppressionByRegionId((prev) => ({
      ...prev,
      [regionId]: FULL_LIBERATION_SUPPRESSION_THRESHOLD
    }));
    setSuppressionStateByRegionId((prev) => ({
      ...prev,
      [regionId]: forcedState
    }));
    setRegionsById((prev) => {
      const currentRegion = prev[regionId];
      if (!currentRegion) {
        return prev;
      }
      const applied = applySuppressionStateToRegion(
        {
          ...currentRegion,
          mapSuppression: FULL_LIBERATION_SUPPRESSION_THRESHOLD
        },
        forcedState,
        FULL_LIBERATION_SUPPRESSION_THRESHOLD
      );
      return {
        ...prev,
        [regionId]: applied.region
      };
    });
    setRitualStatesById((prev) => ({
      ...prev,
      [ritualId]: {
        ritualId,
        status: "completed",
        completedAtWorldMonth: worldMonth,
        lastAttemptAtWorldMonth: worldMonth
      }
    }));
    setWorldLogs((prev) => [`${ritual.name}完成：${ritual.regionId} 的封印重新稳定，目标地区已完全解放。`, ...prev].slice(0, 18));
  }, [ensureRegionState, worldMonth]);

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
            reason: "当前最多可同时接取 " + acceptedMissionLimit + " 个任务，请先提交或完成已有任务。"
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

      const mission = regionsById[regionId] ? (missionsByRegionId[regionId] ?? []).find((item) => item.id === missionId) : undefined;
      if (mission) {
        updateSuppressionState(
          regionId,
          (state) => applyMissionSuppressionState(state, mission.type),
          "完成地区委派"
        );
      }
      return reward;
    },
    [missionsByRegionId, regionsById, updateSuppressionState, worldMonth]
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

      updateSuppressionState(
        outcome.regionId,
        (state) => applyBattleSuppressionState(state, regionsById[outcome.regionId] ?? createRegionTopologyById(outcome.regionId), outcome.nodeArchetype!, true),
        "讨伐胜利"
      );
    },
    [regionsById, updateSuppressionState]
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
      getRegionSuppression(regionId) {
        if (!regionId) {
          return 0;
        }
        return sanitizeSuppression(regionsById[regionId]?.mapSuppression ?? 0);
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
      getNodeMarket(nodeId) {
        if (!nodeId) {
          return null;
        }
        const current = marketStatesByNodeId[nodeId];
        if (current && current.worldMonth === worldMonth) {
          return current;
        }
        return buildMarketMonthState(nodeId, worldMonth);
      },
      consumeNodeMarketStock,
      getNodeRitual(nodeId) {
        if (!nodeId) {
          return null;
        }
        return ritualDefinitionByNodeId[nodeId] ?? null;
      },
      getRitualState(ritualId) {
        if (!ritualId) {
          return null;
        }
        return ritualStatesById[ritualId] ?? null;
      },
      recordRitualAttempt,
      completeRitual,
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
      completeRitual,
      consumeNodeMarketStock,
      missionWarningByRegionId,
      marketStatesByNodeId,
      missionsByRegionId,
      recordRitualAttempt,
      regions,
      regionsById,
      reportMissionBattleOutcome,
      ritualStatesById,
      setAcceptedMissionExtraCapacity,
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
