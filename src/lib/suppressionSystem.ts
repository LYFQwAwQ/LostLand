import { SUPPRESSION_PROGRESS_CONFIG } from "../data/config/suppressionProgressionConfig";
import type { BulletinMissionType, RegionNode, RegionTopology } from "../types/game";

export interface RegionSuppressionState {
  purge: number;
  governance: number;
  supply: number;
  chaos: number;
  fatigue: number;
  momentum: number;
}

export type SuppressionEventSource = "battle" | "mission" | "month";

export interface SuppressionUpdateContext {
  region: RegionTopology;
  source: SuppressionEventSource;
  nodeArchetype?: RegionNode["archetype"];
  missionType?: BulletinMissionType;
  victory?: boolean;
}

interface RegionNodeCounts {
  stable: number;
  chaos: number;
  BL1: number;
  BL2: number;
  BL3: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitize(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function normalizeState(state: RegionSuppressionState): RegionSuppressionState {
  const reserveCap = SUPPRESSION_PROGRESS_CONFIG.state.reserveCap;
  const momentumCap = SUPPRESSION_PROGRESS_CONFIG.state.momentumCap;
  return {
    purge: clamp(sanitize(state.purge), 0, reserveCap),
    governance: clamp(sanitize(state.governance), 0, reserveCap),
    supply: clamp(sanitize(state.supply), 0, reserveCap),
    chaos: clamp(sanitize(state.chaos), 0, reserveCap),
    fatigue: clamp(sanitize(state.fatigue), 0, reserveCap),
    momentum: clamp(sanitize(state.momentum), 0, momentumCap)
  };
}

export function createInitialSuppressionState(): RegionSuppressionState {
  return normalizeState({
    purge: 0,
    governance: 0,
    supply: 0,
    chaos: 0,
    fatigue: 0,
    momentum: 0
  });
}

export function cloneSuppressionState(state: RegionSuppressionState): RegionSuppressionState {
  return normalizeState({ ...state });
}

export function getRegionNodeCounts(region: RegionTopology): RegionNodeCounts {
  return region.nodes.reduce<RegionNodeCounts>(
    (acc, node) => {
      if (node.state !== "active") {
        return acc;
      }

      if (node.archetype === "BL1") {
        acc.BL1 += 1;
      } else if (node.archetype === "BL2") {
        acc.BL2 += 1;
      } else if (node.archetype === "BL3") {
        acc.BL3 += 1;
      } else if (node.archetype.startsWith("BL")) {
        acc.chaos += 1;
      } else if (node.archetype.startsWith("ST")) {
        acc.stable += 1;
      }
      return acc;
    },
    {
      stable: 0,
      chaos: 0,
      BL1: 0,
      BL2: 0,
      BL3: 0
    }
  );
}

function getRegionDrag(region: RegionTopology): number {
  const counts = getRegionNodeCounts(region);
  const dragMap = SUPPRESSION_PROGRESS_CONFIG.region.dragByArchetype;
  return (
    counts.BL1 * dragMap.BL1 +
    counts.BL2 * dragMap.BL2 +
    counts.BL3 * dragMap.BL3 +
    counts.stable * (dragMap.ST1 + dragMap.ST2 + dragMap.ST3) * 0.15 +
    counts.chaos * 0.9
  );
}

function getRegionSupport(region: RegionTopology): number {
  const counts = getRegionNodeCounts(region);
  return counts.stable * SUPPRESSION_PROGRESS_CONFIG.region.stableSupportPerNode;
}

function getRegionChaosRegen(region: RegionTopology): number {
  const counts = getRegionNodeCounts(region);
  const regenMap = SUPPRESSION_PROGRESS_CONFIG.region.chaosRegenByArchetype;
  return (
    counts.BL1 * regenMap.BL1 +
    counts.BL2 * regenMap.BL2 +
    counts.BL3 * regenMap.BL3 +
    counts.stable * (regenMap.ST1 + regenMap.ST2 + regenMap.ST3) * 0.2
  );
}

function computeSuppressionScore(state: RegionSuppressionState, region: RegionTopology): number {
  const scoring = SUPPRESSION_PROGRESS_CONFIG.scoring;
  const counts = getRegionNodeCounts(region);

  const purgeCore = Math.pow(state.purge, scoring.purgePower) * scoring.purgeWeight;
  const governanceCore = Math.pow(state.governance, scoring.governancePower) * scoring.governanceWeight;
  const supplyCore = Math.pow(state.supply, scoring.supplyPower) * scoring.supplyWeight;
  const chaosPressure = Math.pow(state.chaos, scoring.chaosPower) * scoring.chaosWeight;
  const fatiguePressure = Math.pow(state.fatigue, scoring.fatiguePower) * scoring.fatigueWeight;
  const momentumLift = Math.log1p(state.momentum) * scoring.momentumWeight;
  const structuralSupport = getRegionSupport(region);
  const structuralDrag = getRegionDrag(region);
  const chaosFloor = counts.BL1 * 0.6 + counts.BL2 * 0.32 + counts.BL3 * 0.14;

  return purgeCore + governanceCore + supplyCore + momentumLift + structuralSupport - chaosPressure - fatiguePressure - structuralDrag - chaosFloor;
}

function projectBonus(score: number): number {
  const bands = SUPPRESSION_PROGRESS_CONFIG.projector.bands;
  if (bands.length <= 0) {
    return 0;
  }

  if (score <= bands[0].threshold) {
    return 0;
  }

  for (let index = 1; index < bands.length; index += 1) {
    const previous = bands[index - 1];
    const current = bands[index];
    if (score <= current.threshold) {
      const span = Math.max(0.001, current.threshold - previous.threshold);
      const ratio = clamp((score - previous.threshold) / span, 0, 1);
      const eased = Math.pow(ratio, 1.35);
      return previous.bonus + (current.bonus - previous.bonus) * eased;
    }
  }

  return SUPPRESSION_PROGRESS_CONFIG.projector.maxBonus;
}

function profileStateDelta(state: RegionSuppressionState, delta: Partial<RegionSuppressionState>): RegionSuppressionState {
  return normalizeState({
    purge: state.purge + (delta.purge ?? 0),
    governance: state.governance + (delta.governance ?? 0),
    supply: state.supply + (delta.supply ?? 0),
    chaos: state.chaos + (delta.chaos ?? 0),
    fatigue: state.fatigue + (delta.fatigue ?? 0),
    momentum: state.momentum + (delta.momentum ?? 0)
  });
}

export function advanceSuppressionStateByMonth(state: RegionSuppressionState, region: RegionTopology): RegionSuppressionState {
  const config = SUPPRESSION_PROGRESS_CONFIG.state;
  return normalizeState({
    purge: state.purge * config.purgeDecay,
    governance: state.governance * config.governanceDecay,
    supply: state.supply * config.supplyDecay,
    chaos: state.chaos * config.chaosDecay + getRegionChaosRegen(region),
    fatigue: state.fatigue * config.fatigueDecay,
    momentum: state.momentum * config.momentumDecay
  });
}

export function applyBattleSuppressionState(
  state: RegionSuppressionState,
  region: RegionTopology,
  nodeArchetype: RegionNode["archetype"],
  victory: boolean
): RegionSuppressionState {
  const profile = victory
    ? SUPPRESSION_PROGRESS_CONFIG.battle.victoryByArchetype[nodeArchetype]
    : SUPPRESSION_PROGRESS_CONFIG.battle.defeatByArchetype[nodeArchetype];

  if (!profile) {
    return state;
  }

  const victoryBonus = victory ? 1 : 0.42;
  return profileStateDelta(state, {
    purge: profile.purge * victoryBonus,
    governance: profile.governance * victoryBonus,
    supply: profile.supply * victoryBonus,
    chaos: profile.chaos * victoryBonus,
    fatigue: profile.fatigue * victoryBonus,
    momentum: profile.momentum + (victory ? 0.6 : -0.2) - getRegionNodeCounts(region).BL1 * 0.02
  });
}

export function applyMissionSuppressionState(
  state: RegionSuppressionState,
  missionType: BulletinMissionType
): RegionSuppressionState {
  const profile = SUPPRESSION_PROGRESS_CONFIG.mission.byType[missionType];
  if (!profile) {
    return state;
  }

  return profileStateDelta(state, profile);
}

export function calculateSuppressionBonus(state: RegionSuppressionState, region: RegionTopology): number {
  return Math.max(0, Math.round(projectBonus(computeSuppressionScore(state, region))));
}

export function calculateVisibleSuppression(
  baseSuppression: number,
  state: RegionSuppressionState,
  region: RegionTopology
): number {
  return clamp(Math.round(baseSuppression + calculateSuppressionBonus(state, region)), 0, 100);
}

export function getSuppressionBonusDetail(state: RegionSuppressionState, region: RegionTopology): {
  score: number;
  bonus: number;
} {
  const score = computeSuppressionScore(state, region);
  return {
    score: Number(score.toFixed(3)),
    bonus: calculateSuppressionBonus(state, region)
  };
}
