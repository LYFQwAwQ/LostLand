import type { BulletinMissionType, RegionNode } from "../../types/game";

export interface SuppressionEventProfile {
  purge: number;
  governance: number;
  supply: number;
  chaos: number;
  fatigue: number;
  momentum: number;
}

export interface SuppressionProgressionConfig {
  state: {
    reserveCap: number;
    momentumCap: number;
    purgeDecay: number;
    governanceDecay: number;
    supplyDecay: number;
    chaosDecay: number;
    fatigueDecay: number;
    momentumDecay: number;
    momentumCarry: number;
  };
  scoring: {
    purgeWeight: number;
    governanceWeight: number;
    supplyWeight: number;
    chaosWeight: number;
    fatigueWeight: number;
    momentumWeight: number;
    purgePower: number;
    governancePower: number;
    supplyPower: number;
    chaosPower: number;
    fatiguePower: number;
  };
  region: {
    stableSupportPerNode: number;
    dragByArchetype: Record<RegionNode["archetype"], number>;
    chaosRegenByArchetype: Record<RegionNode["archetype"], number>;
  };
  battle: {
    victoryByArchetype: Record<RegionNode["archetype"], SuppressionEventProfile>;
    defeatByArchetype: Record<RegionNode["archetype"], SuppressionEventProfile>;
  };
  mission: {
    byType: Record<BulletinMissionType, SuppressionEventProfile>;
  };
  projector: {
    bands: Array<{
      threshold: number;
      bonus: number;
    }>;
    maxBonus: number;
  };
}

export const SUPPRESSION_PROGRESS_CONFIG: SuppressionProgressionConfig = {
  state: {
    reserveCap: 240,
    momentumCap: 48,
    purgeDecay: 0.9,
    governanceDecay: 0.94,
    supplyDecay: 0.95,
    chaosDecay: 0.84,
    fatigueDecay: 0.7,
    momentumDecay: 0.76,
    momentumCarry: 0.88
  },
  scoring: {
    purgeWeight: 1.28,
    governanceWeight: 1.1,
    supplyWeight: 0.96,
    chaosWeight: 1.45,
    fatigueWeight: 1.22,
    momentumWeight: 1.5,
    purgePower: 0.78,
    governancePower: 0.84,
    supplyPower: 0.72,
    chaosPower: 1.06,
    fatiguePower: 1.12
  },
  region: {
    stableSupportPerNode: 1.55,
    dragByArchetype: {
      BL1: 10.5,
      BL2: 6.9,
      BL3: 4.1,
      ST1: 0.35,
      ST2: 0.25,
      ST3: 0.15,
      NOD: 0
    },
    chaosRegenByArchetype: {
      BL1: 3.2,
      BL2: 2,
      BL3: 1.1,
      ST1: 0.12,
      ST2: 0.08,
      ST3: 0.04,
      NOD: 0
    }
  },
  battle: {
    victoryByArchetype: {
      BL1: { purge: 1.6, governance: 0.08, supply: 0.12, chaos: 0.9, fatigue: 0.85, momentum: 0.95 },
      BL2: { purge: 1.15, governance: 0.12, supply: 0.16, chaos: 0.68, fatigue: 0.68, momentum: 0.8 },
      BL3: { purge: 0.78, governance: 0.16, supply: 0.2, chaos: 0.46, fatigue: 0.5, momentum: 0.68 },
      ST1: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 },
      ST2: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 },
      ST3: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 },
      NOD: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 }
    },
    defeatByArchetype: {
      BL1: { purge: 0, governance: 0, supply: 0, chaos: 1.15, fatigue: 1.2, momentum: -0.5 },
      BL2: { purge: 0, governance: 0, supply: 0, chaos: 0.95, fatigue: 1, momentum: -0.42 },
      BL3: { purge: 0, governance: 0, supply: 0, chaos: 0.75, fatigue: 0.88, momentum: -0.34 },
      ST1: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 },
      ST2: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 },
      ST3: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 },
      NOD: { purge: 0, governance: 0, supply: 0, chaos: 0, fatigue: 0, momentum: 0 }
    }
  },
  mission: {
    byType: {
      collect: { purge: 0.18, governance: 1.1, supply: 1.45, chaos: -0.38, fatigue: -0.26, momentum: 0.7 },
      hunt: { purge: 0.72, governance: 0.42, supply: 0.55, chaos: -0.62, fatigue: -0.1, momentum: 0.88 }
    }
  },
  projector: {
    bands: [
      { threshold: 0, bonus: 0 },
      { threshold: 4.5, bonus: 1 },
      { threshold: 9, bonus: 3 },
      { threshold: 15, bonus: 6 },
      { threshold: 22, bonus: 10 },
      { threshold: 31, bonus: 15 },
      { threshold: 42, bonus: 22 },
      { threshold: 56, bonus: 31 },
      { threshold: 72, bonus: 42 },
      { threshold: 92, bonus: 54 },
      { threshold: 116, bonus: 68 }
    ],
    maxBonus: 68
  }
};
