import { getMaterialDropCatalog } from "../data/battleDrops";
import { buildEnemyTeam } from "../data/battleUnits";
import {
  getBulletinMissionConfigByDominion,
  type BulletinMissionDominionConfig
} from "../data/config/bulletinMissionConfig";
import { initialConsumableStacks } from "../data/consumables";
import type { BattleUnitTemplate } from "../types/battle";
import type {
  BulletinMissionCollectTarget,
  BulletinMissionDefinition,
  BulletinMissionHuntTarget,
  BulletinMissionProgress,
  BulletinMissionReward,
  BulletinMissionRewardConsumable,
  BulletinMissionRewardMaterial,
  BulletinMissionState,
  InventoryResourceRarity,
  MissionBattleOutcome,
  RegionNode,
  RegionTopology
} from "../types/game";

interface RegionEnemyAvailability {
  prototypeId: string;
  enemyName: string;
  sourceNodeIds: string[];
}

interface RegionMaterialAvailability {
  materialId: string;
  materialName: string;
  rarity: InventoryResourceRarity;
  sourceEnemyPrototypeIds: string[];
}

interface RegionMissionAvailability {
  battleNodeIds: string[];
  enemies: RegionEnemyAvailability[];
  materials: RegionMaterialAvailability[];
}

export interface RegionMissionGenerationResult {
  missions: BulletinMissionState[];
  warning: string | null;
}

const RARITY_WEIGHT: Record<InventoryResourceRarity, number> = {
  common: 1,
  uncommon: 1.5,
  rare: 2.2,
  epic: 3.2
};

const BATTLE_ARCHETYPES = new Set<RegionNode["archetype"]>(["BL1", "BL2", "BL3"]);

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function rollInt(min: number, max: number, random: () => number): number {
  const safeMin = Math.floor(Math.min(min, max));
  const safeMax = Math.floor(Math.max(min, max));
  if (safeMin === safeMax) {
    return safeMin;
  }
  return safeMin + Math.floor(random() * (safeMax - safeMin + 1));
}

function rollFloat(min: number, max: number, random: () => number): number {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  if (safeMin === safeMax) {
    return safeMin;
  }
  return safeMin + random() * (safeMax - safeMin);
}

function shuffleInPlace<T>(list: T[], random: () => number): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function pickUnique<T>(list: T[], count: number, random: () => number): T[] {
  if (list.length <= 0 || count <= 0) {
    return [];
  }
  const cloned = [...list];
  shuffleInPlace(cloned, random);
  return cloned.slice(0, Math.max(1, Math.min(count, cloned.length)));
}

function normalizeEnemyName(rawName: string): string {
  return rawName.replace(/\s*Lv\.\d+$/i, "").trim();
}

function parseEnemyPrototypeId(unit: BattleUnitTemplate): string {
  const tagged = (unit.tags ?? []).find((tag) => tag.startsWith("enemy:"));
  if (tagged) {
    return tagged.slice("enemy:".length);
  }
  return unit.id.replace(/-\d+$/, "");
}

function collectRegionMissionAvailability(region: RegionTopology): RegionMissionAvailability {
  const battleNodes = region.nodes.filter((node) => node.state === "active" && BATTLE_ARCHETYPES.has(node.archetype));
  const battleNodeIds = battleNodes.map((node) => node.id);
  const enemyMap = new Map<string, { prototypeId: string; enemyName: string; sourceNodeIdSet: Set<string> }>();

  battleNodes.forEach((node) => {
    // Sample multiple deterministic seeds for the same node to avoid under-sampling enemy candidates.
    for (let i = 0; i < 3; i += 1) {
      const preview = buildEnemyTeam(`${node.id}-mission-scan-${i}`, node.archetype, region.mapSuppression);
      preview.forEach((unit) => {
        const prototypeId = parseEnemyPrototypeId(unit);
        const existing = enemyMap.get(prototypeId);
        if (existing) {
          existing.sourceNodeIdSet.add(node.id);
          return;
        }
        enemyMap.set(prototypeId, {
          prototypeId,
          enemyName: normalizeEnemyName(unit.name),
          sourceNodeIdSet: new Set([node.id])
        });
      });
    }
  });

  const enemyIds = new Set(enemyMap.keys());
  const materials = getMaterialDropCatalog()
    .filter((material) => material.sourceEnemyPrototypeIds.some((enemyId) => enemyIds.has(enemyId)))
    .map<RegionMaterialAvailability>((material) => ({
      materialId: material.id,
      materialName: material.name,
      rarity: material.rarity,
      sourceEnemyPrototypeIds: [...material.sourceEnemyPrototypeIds]
    }))
    .sort((left, right) => {
      if (RARITY_WEIGHT[right.rarity] !== RARITY_WEIGHT[left.rarity]) {
        return RARITY_WEIGHT[right.rarity] - RARITY_WEIGHT[left.rarity];
      }
      return left.materialName.localeCompare(right.materialName, "zh-CN");
    });

  const enemies = [...enemyMap.values()]
    .map<RegionEnemyAvailability>((enemy) => ({
      prototypeId: enemy.prototypeId,
      enemyName: enemy.enemyName,
      sourceNodeIds: [...enemy.sourceNodeIdSet].sort((left, right) => left.localeCompare(right, "en-US"))
    }))
    .sort((left, right) => left.enemyName.localeCompare(right.enemyName, "zh-CN"));

  return {
    battleNodeIds,
    enemies,
    materials
  };
}

function buildCollectTargets(
  materials: RegionMaterialAvailability[],
  config: BulletinMissionDominionConfig,
  random: () => number
): BulletinMissionCollectTarget[] {
  const maxCount = Math.min(materials.length, config.collect.targetTypeCountRange[1]);
  const minCount = Math.min(maxCount, config.collect.targetTypeCountRange[0]);
  const count = rollInt(minCount, maxCount, random);
  const selected = pickUnique(materials, count, random);

  return selected.map((material) => {
    const range = config.collect.requiredByRarity[material.rarity];
    return {
      materialId: material.materialId,
      materialName: material.materialName,
      rarity: material.rarity,
      requiredQuantity: rollInt(range[0], range[1], random)
    };
  });
}

function buildHuntTargets(
  enemies: RegionEnemyAvailability[],
  config: BulletinMissionDominionConfig,
  random: () => number
): BulletinMissionHuntTarget[] {
  const maxCount = Math.min(enemies.length, config.hunt.targetTypeCountRange[1]);
  const minCount = Math.min(maxCount, config.hunt.targetTypeCountRange[0]);
  const count = rollInt(minCount, maxCount, random);
  const selected = pickUnique(enemies, count, random);

  return selected.map((enemy) => ({
    enemyPrototypeId: enemy.prototypeId,
    enemyName: enemy.enemyName,
    requiredCount: rollInt(config.hunt.requiredCountRange[0], config.hunt.requiredCountRange[1], random)
  }));
}

function buildRewardMaterialsFromCollectTargets(
  targets: BulletinMissionCollectTarget[],
  config: BulletinMissionDominionConfig,
  random: () => number
): BulletinMissionRewardMaterial[] {
  const allowedRarity = new Set(config.reward.allowedMaterialRarities);
  const candidateTargets = targets.filter((target) => allowedRarity.has(target.rarity));
  const rewardCount = rollInt(
    config.reward.materialRewardCountRange[0],
    config.reward.materialRewardCountRange[1],
    random
  );

  return pickUnique(candidateTargets, rewardCount, random)
    .map((target) => ({
      materialId: target.materialId,
      materialName: target.materialName,
      rarity: target.rarity,
      quantity: Math.max(1, Math.round(target.requiredQuantity * (0.35 + random() * 0.25)))
    }))
    .filter((item) => item.quantity > 0);
}

function buildRewardMaterialsFromHuntTargets(
  targets: BulletinMissionHuntTarget[],
  materialPool: RegionMaterialAvailability[],
  config: BulletinMissionDominionConfig,
  random: () => number
): BulletinMissionRewardMaterial[] {
  const enemySet = new Set(targets.map((target) => target.enemyPrototypeId));
  const allowedRarity = new Set(config.reward.allowedMaterialRarities);
  const candidates = materialPool.filter((material) =>
    material.sourceEnemyPrototypeIds.some((enemyId) => enemySet.has(enemyId)) && allowedRarity.has(material.rarity)
  );

  const rewardCount = rollInt(
    config.reward.materialRewardCountRange[0],
    config.reward.materialRewardCountRange[1],
    random
  );
  const selected = pickUnique(candidates, rewardCount, random);
  return selected.map((material) => ({
    materialId: material.materialId,
    materialName: material.materialName,
    rarity: material.rarity,
    quantity: Math.max(1, rollInt(1, 3, random))
  }));
}

function buildRewardConsumables(config: BulletinMissionDominionConfig, random: () => number): BulletinMissionRewardConsumable[] {
  const allowedRarity = new Set(config.reward.allowedConsumableRarities);
  const pool = initialConsumableStacks.filter((item) => allowedRarity.has(item.rarity));
  if (pool.length <= 0) {
    return [];
  }
  const rewardCount = rollInt(
    config.reward.consumableRewardCountRange[0],
    config.reward.consumableRewardCountRange[1],
    random
  );
  const selected = pickUnique(pool, rewardCount, random);
  return selected.map((item) => ({
    consumableId: item.id,
    consumableName: item.name,
    rarity: item.rarity,
    quantity: rollInt(1, 2, random)
  }));
}

function buildMissionReward(
  collectTargets: BulletinMissionCollectTarget[],
  huntTargets: BulletinMissionHuntTarget[],
  rewardMaterials: BulletinMissionRewardMaterial[],
  rewardConsumables: BulletinMissionRewardConsumable[],
  config: BulletinMissionDominionConfig,
  random: () => number
): BulletinMissionReward {
  const collectScore = collectTargets.reduce((sum, target) => sum + target.requiredQuantity * RARITY_WEIGHT[target.rarity], 0);
  const huntScore = huntTargets.reduce((sum, target) => sum + target.requiredCount * 1.35, 0);
  const baseScore = collectScore + huntScore;
  const bountySwing = rollFloat(config.reward.bounty.swingRange[0], config.reward.bounty.swingRange[1], random);
  const reputationSwing = rollFloat(
    config.reward.reputation.swingRange[0],
    config.reward.reputation.swingRange[1],
    random
  );

  return {
    materials: rewardMaterials,
    consumables: rewardConsumables,
    bounty: Math.max(
      config.reward.bounty.min,
      Math.round((config.reward.bounty.base + baseScore * config.reward.bounty.perScore) * bountySwing)
    ),
    reputation: Math.max(
      config.reward.reputation.min,
      Math.round((config.reward.reputation.base + baseScore * config.reward.reputation.perScore) * reputationSwing)
    )
  };
}

function formatCollectTargetSummary(targets: BulletinMissionCollectTarget[]): string {
  return targets.map((target) => `${target.materialName} x${target.requiredQuantity}`).join("，");
}

function formatHuntTargetSummary(targets: BulletinMissionHuntTarget[]): string {
  return targets.map((target) => `${target.enemyName} x${target.requiredCount}`).join("，");
}

function createEmptyProgress(definition: BulletinMissionDefinition): BulletinMissionProgress {
  const materialCounts = definition.collectTargets.reduce<Record<string, number>>((acc, target) => {
    acc[target.materialId] = 0;
    return acc;
  }, {});
  const enemyKillCounts = definition.huntTargets.reduce<Record<string, number>>((acc, target) => {
    acc[target.enemyPrototypeId] = 0;
    return acc;
  }, {});
  return { materialCounts, enemyKillCounts };
}

export function isMissionReadyToSubmit(mission: BulletinMissionState): boolean {
  if (mission.type === "collect") {
    return true;
  }
  return (
    mission.huntTargets.length > 0 &&
    mission.huntTargets.every((target) => (mission.progress.enemyKillCounts[target.enemyPrototypeId] ?? 0) >= target.requiredCount)
  );
}

export function createMissionState(definition: BulletinMissionDefinition): BulletinMissionState {
  return {
    ...definition,
    status: "available",
    progress: createEmptyProgress(definition),
    acceptedAtWorldMonth: null,
    completedAtWorldMonth: null
  };
}

export function acceptMission(mission: BulletinMissionState, worldMonth: number): BulletinMissionState | null {
  if (mission.status !== "available") {
    return null;
  }
  return {
    ...mission,
    status: "in_progress",
    acceptedAtWorldMonth: worldMonth
  };
}

export function submitMission(mission: BulletinMissionState, worldMonth: number): BulletinMissionState | null {
  if (mission.type === "collect") {
    if (mission.status !== "in_progress") {
      return null;
    }
  } else if (mission.status !== "ready_to_submit") {
    return null;
  }
  return {
    ...mission,
    status: "completed",
    completedAtWorldMonth: worldMonth
  };
}

export function applyMissionBattleOutcome(mission: BulletinMissionState, outcome: MissionBattleOutcome): BulletinMissionState {
  if (mission.status !== "in_progress" && mission.status !== "ready_to_submit") {
    return mission;
  }
  if (mission.type !== "hunt") {
    return mission;
  }

  let changed = false;
  const nextProgress: BulletinMissionProgress = {
    materialCounts: { ...mission.progress.materialCounts },
    enemyKillCounts: { ...mission.progress.enemyKillCounts }
  };

  mission.huntTargets.forEach((target) => {
    const gained = Math.max(0, Math.floor(outcome.defeatedEnemyCounts[target.enemyPrototypeId] ?? 0));
    if (gained <= 0) {
      return;
    }
    nextProgress.enemyKillCounts[target.enemyPrototypeId] = (nextProgress.enemyKillCounts[target.enemyPrototypeId] ?? 0) + gained;
    changed = true;
  });

  if (!changed) {
    return mission;
  }

  const next: BulletinMissionState = {
    ...mission,
    progress: nextProgress
  };
  if (next.status === "in_progress" && isMissionReadyToSubmit(next)) {
    next.status = "ready_to_submit";
  }
  return next;
}

function buildCollectMissionDefinition(
  region: RegionTopology,
  missionIndex: number,
  availability: RegionMissionAvailability,
  missionConfig: BulletinMissionDominionConfig,
  random: () => number
): BulletinMissionDefinition {
  let collectTargets = buildCollectTargets(availability.materials, missionConfig, random);
  if (collectTargets.length <= 0 && availability.materials.length > 0) {
    const fallback = availability.materials[0];
    const range = missionConfig.collect.requiredByRarity[fallback.rarity];
    collectTargets = [
      {
        materialId: fallback.materialId,
        materialName: fallback.materialName,
        rarity: fallback.rarity,
        requiredQuantity: rollInt(range[0], range[1], random)
      }
    ];
  }
  const leadName = collectTargets[0]?.materialName ?? "区域材料";
  const rewardMaterials = buildRewardMaterialsFromCollectTargets(collectTargets, missionConfig, random);
  const rewardConsumables = buildRewardConsumables(missionConfig, random);

  return {
    id: `${region.id}-collect-${missionIndex + 1}`,
    regionId: region.id,
    title: `采集委派：${leadName}${collectTargets.length > 1 ? "等物资" : ""}`,
    type: "collect",
    description: `在${region.regionName}收集并交付：${formatCollectTargetSummary(collectTargets)}`,
    collectTargets,
    huntTargets: [],
    sourceNodeIds: [...availability.battleNodeIds],
    reward: buildMissionReward(collectTargets, [], rewardMaterials, rewardConsumables, missionConfig, random)
  };
}

function buildHuntMissionDefinition(
  region: RegionTopology,
  missionIndex: number,
  availability: RegionMissionAvailability,
  missionConfig: BulletinMissionDominionConfig,
  random: () => number
): BulletinMissionDefinition {
  let huntTargets = buildHuntTargets(availability.enemies, missionConfig, random);
  if (huntTargets.length <= 0 && availability.enemies.length > 0) {
    const fallback = availability.enemies[0];
    huntTargets = [
      {
        enemyPrototypeId: fallback.prototypeId,
        enemyName: fallback.enemyName,
        requiredCount: rollInt(
          missionConfig.hunt.requiredCountRange[0],
          missionConfig.hunt.requiredCountRange[1],
          random
        )
      }
    ];
  }
  const leadName = huntTargets[0]?.enemyName ?? "区域敌群";
  const rewardMaterials = buildRewardMaterialsFromHuntTargets(huntTargets, availability.materials, missionConfig, random);
  const rewardConsumables = buildRewardConsumables(missionConfig, random);

  return {
    id: `${region.id}-hunt-${missionIndex + 1}`,
    regionId: region.id,
    title: `讨伐委派：清剿${leadName}`,
    type: "hunt",
    description: `在${region.regionName}击败：${formatHuntTargetSummary(huntTargets)}`,
    collectTargets: [],
    huntTargets,
    sourceNodeIds: [...availability.battleNodeIds],
    reward: buildMissionReward([], huntTargets, rewardMaterials, rewardConsumables, missionConfig, random)
  };
}

export function generateRegionBulletinMissions(region: RegionTopology): RegionMissionGenerationResult {
  const availability = collectRegionMissionAvailability(region);
  const missionConfig = getBulletinMissionConfigByDominion(region.dominionId);

  if (availability.battleNodeIds.length <= 0) {
    return {
      missions: [],
      warning: "该地区当前没有可进入的讨伐节点，无法生成可完成任务。"
    };
  }

  if (availability.enemies.length <= 0) {
    return {
      missions: [],
      warning: "该地区未识别到有效敌人池，任务生成已暂停。"
    };
  }

  if (availability.materials.length <= 0) {
    return {
      missions: [],
      warning: "该地区未识别到可掉落材料，采集任务无法保证可完成。"
    };
  }

  const random = createRandom(hashSeed(`${region.id}:${region.mapSuppression}:${availability.battleNodeIds.join("|")}`));
  const definitions: BulletinMissionDefinition[] = [];

  for (let i = 0; i < missionConfig.missionCount.collect; i += 1) {
    definitions.push(buildCollectMissionDefinition(region, i, availability, missionConfig, random));
  }
  for (let i = 0; i < missionConfig.missionCount.hunt; i += 1) {
    definitions.push(buildHuntMissionDefinition(region, i, availability, missionConfig, random));
  }

  return {
    missions: definitions.map((definition) => createMissionState(definition)),
    warning: null
  };
}
