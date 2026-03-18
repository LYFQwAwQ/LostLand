import type { HeroProgressState } from "../../types/game";

export interface HeroProgressionConfig {
  maxLevel: number;
  initialLevel: number;
  initialExp: number;
  expCurve: {
    base: number;
    linear: number;
    quadratic: number;
  };
  battleExp: {
    enemyBase: number;
    enemyLevelFactor: number;
    levelDeltaBonusPerLevel: number;
    levelDeltaPenaltyPerLevel: number;
    minMultiplier: number;
    maxMultiplier: number;
  };
}

export const HERO_PROGRESSION_CONFIG: HeroProgressionConfig = {
  maxLevel: 100,
  initialLevel: 1,
  initialExp: 0,
  expCurve: {
    base: 120,
    linear: 35,
    quadratic: 8
  },
  battleExp: {
    enemyBase: 24,
    enemyLevelFactor: 18,
    levelDeltaBonusPerLevel: 0.08,
    levelDeltaPenaltyPerLevel: 0.12,
    minMultiplier: 0.35,
    maxMultiplier: 2.5
  }
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampHeroLevel(level: number): number {
  const normalized = Number.isFinite(level) ? Math.floor(level) : HERO_PROGRESSION_CONFIG.initialLevel;
  return clamp(normalized, HERO_PROGRESSION_CONFIG.initialLevel, HERO_PROGRESSION_CONFIG.maxLevel);
}

export function createInitialHeroProgressState(): HeroProgressState {
  return {
    level: HERO_PROGRESSION_CONFIG.initialLevel,
    exp: HERO_PROGRESSION_CONFIG.initialExp
  };
}

export function normalizeHeroProgressState(state: Partial<HeroProgressState> | null | undefined): HeroProgressState {
  const level = clampHeroLevel(state?.level ?? HERO_PROGRESSION_CONFIG.initialLevel);
  const nextLevelExp = getHeroNextLevelExp(level);
  const rawExp = Number.isFinite(state?.exp) ? Math.floor(state!.exp as number) : HERO_PROGRESSION_CONFIG.initialExp;
  const exp = nextLevelExp > 0 ? clamp(rawExp, 0, nextLevelExp - 1) : 0;
  return {
    level,
    exp
  };
}

export function getHeroNextLevelExp(level: number): number {
  const clampedLevel = clampHeroLevel(level);
  if (clampedLevel >= HERO_PROGRESSION_CONFIG.maxLevel) {
    return 0;
  }
  const progress = clampedLevel - HERO_PROGRESSION_CONFIG.initialLevel;
  const value =
    HERO_PROGRESSION_CONFIG.expCurve.base +
    HERO_PROGRESSION_CONFIG.expCurve.linear * progress +
    HERO_PROGRESSION_CONFIG.expCurve.quadratic * progress * progress;
  return Math.max(1, Math.floor(value));
}

export function resolveBattleBaseExpByEnemyLevels(enemyLevels: number[]): number {
  if (!Array.isArray(enemyLevels) || enemyLevels.length <= 0) {
    return 0;
  }
  return enemyLevels.reduce((sum, enemyLevel) => {
    const safeLevel = Math.max(1, Math.floor(enemyLevel));
    return sum + HERO_PROGRESSION_CONFIG.battleExp.enemyBase + HERO_PROGRESSION_CONFIG.battleExp.enemyLevelFactor * safeLevel;
  }, 0);
}

export function resolveBattleEnemyAverageLevel(enemyLevels: number[]): number {
  if (!Array.isArray(enemyLevels) || enemyLevels.length <= 0) {
    return HERO_PROGRESSION_CONFIG.initialLevel;
  }
  const total = enemyLevels.reduce((sum, enemyLevel) => sum + Math.max(1, Math.floor(enemyLevel)), 0);
  return total / enemyLevels.length;
}

export function resolveBattleLevelDeltaMultiplier(heroLevel: number, enemyAverageLevel: number): number {
  const safeHeroLevel = clampHeroLevel(heroLevel);
  const safeEnemyAverageLevel = Math.max(1, enemyAverageLevel);
  const delta = safeEnemyAverageLevel - safeHeroLevel;

  const raw =
    delta >= 0
      ? 1 + delta * HERO_PROGRESSION_CONFIG.battleExp.levelDeltaBonusPerLevel
      : 1 / (1 + Math.abs(delta) * HERO_PROGRESSION_CONFIG.battleExp.levelDeltaPenaltyPerLevel);

  return clamp(raw, HERO_PROGRESSION_CONFIG.battleExp.minMultiplier, HERO_PROGRESSION_CONFIG.battleExp.maxMultiplier);
}
