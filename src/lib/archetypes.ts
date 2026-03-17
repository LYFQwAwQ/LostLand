import type { NodeArchetype, RegionNode } from "../types/game";

export interface ArchetypeProfile {
  code: NodeArchetype;
  label: string;
  isStable: boolean;
  isChaos: boolean;
  isResource: boolean;
  stableTier: 0 | 1 | 2 | 3;
  chaosTier: 0 | 1 | 2 | 3;
  initialStrength: number;
  orderScale: number;
  expansionScale: number;
  aggressionScale: number;
  defaultDifficulty: RegionNode["difficulty"];
}

export const ARCHETYPE_PROFILES: Record<NodeArchetype, ArchetypeProfile> = {
  ST1: {
    code: "ST1",
    label: "定居中心",
    isStable: true,
    isChaos: false,
    isResource: false,
    stableTier: 3,
    chaosTier: 0,
    initialStrength: 520,
    orderScale: 0.36,
    expansionScale: 0,
    aggressionScale: 0.1,
    defaultDifficulty: "高"
  },
  ST2: {
    code: "ST2",
    label: "职能枢纽",
    isStable: true,
    isChaos: false,
    isResource: false,
    stableTier: 2,
    chaosTier: 0,
    initialStrength: 320,
    orderScale: 0.32,
    expansionScale: 0,
    aggressionScale: 0.08,
    defaultDifficulty: "中"
  },
  ST3: {
    code: "ST3",
    label: "前哨",
    isStable: true,
    isChaos: false,
    isResource: false,
    stableTier: 1,
    chaosTier: 0,
    initialStrength: 190,
    orderScale: 0.28,
    expansionScale: 0,
    aggressionScale: 0.06,
    defaultDifficulty: "低"
  },
  BL1: {
    code: "BL1",
    label: "灾厄源头",
    isStable: false,
    isChaos: true,
    isResource: false,
    stableTier: 0,
    chaosTier: 3,
    initialStrength: 560,
    orderScale: 0,
    expansionScale: 0.33,
    aggressionScale: 0.42,
    defaultDifficulty: "极高"
  },
  BL2: {
    code: "BL2",
    label: "混沌区",
    isStable: false,
    isChaos: true,
    isResource: false,
    stableTier: 0,
    chaosTier: 2,
    initialStrength: 340,
    orderScale: 0,
    expansionScale: 0.31,
    aggressionScale: 0.32,
    defaultDifficulty: "高"
  },
  BL3: {
    code: "BL3",
    label: "无序区",
    isStable: false,
    isChaos: true,
    isResource: false,
    stableTier: 0,
    chaosTier: 1,
    initialStrength: 220,
    orderScale: 0,
    expansionScale: 0.28,
    aggressionScale: 0.24,
    defaultDifficulty: "中"
  },
  NOD: {
    code: "NOD",
    label: "资源点",
    isStable: false,
    isChaos: false,
    isResource: true,
    stableTier: 0,
    chaosTier: 0,
    initialStrength: 120,
    orderScale: 0,
    expansionScale: 0,
    aggressionScale: 0,
    defaultDifficulty: "低"
  }
};

const entityTypeByArchetype: Record<NodeArchetype, string> = {
  ST1: "主城",
  ST2: "职能枢纽",
  ST3: "前哨",
  BL1: "灾厄源头",
  BL2: "混沌区",
  BL3: "无序区",
  NOD: "资源点"
};

const namesByArchetype: Record<NodeArchetype, string[]> = {
  ST1: ["圣域国都", "中央行省", "誓约之城"],
  ST2: ["冒险家协会", "圣教修道院", "铁誓营地"],
  ST3: ["边境岗哨", "征粮站", "巡逻哨塔"],
  BL1: ["万兽祖地", "污染灵泉", "腐败王座"],
  BL2: ["嗜血聚落", "荆棘丛林", "裂隙兽巢"],
  BL3: ["食尸鬼墓地", "野兽嗅探点", "灰烬荒野"],
  NOD: ["伐木场", "矿脉点", "旧桥补给站"]
};

const envByArchetype: Record<NodeArchetype, string[]> = {
  ST1: ["高城墙与稳定补给线形成强秩序辐射。"],
  ST2: ["人口集中，功能区协同推动地区稳态。"],
  ST3: ["边境驻防，秩序影响较弱但覆盖关键路口。"],
  BL1: ["核心污染源持续外溢，扩张场强度极高。"],
  BL2: ["中等混沌区，区域冲突频发。"],
  BL3: ["无序地带，可能触发事件或仪式。"],
  NOD: ["资源采集点，不主动产生场强。"]
};

const buffByArchetype: Record<NodeArchetype, string[]> = {
  ST1: ["驻留加成：全队挂机收益 +8%"],
  ST2: ["驻留加成：MP 回复速度 +10%"],
  ST3: ["驻留加成：移动恢复 +5%"],
  BL1: ["驻留加成：战斗掉落稀有素材概率 +6%"],
  BL2: ["驻留加成：侦察情报完整度 +12%"],
  BL3: ["驻留加成：仪式触发几率 +15%"],
  NOD: ["驻留加成：基础材料采集效率 +10%"]
};

export function pickRandom<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

export function randomNameByArchetype(archetype: NodeArchetype, random: () => number): string {
  return pickRandom(namesByArchetype[archetype], random);
}

export function randomEnvironmentByArchetype(archetype: NodeArchetype, random: () => number): string {
  return pickRandom(envByArchetype[archetype], random);
}

export function randomBuffByArchetype(archetype: NodeArchetype, random: () => number): string {
  return pickRandom(buffByArchetype[archetype], random);
}

export function mapArchetypeDifficulty(archetype: NodeArchetype): RegionNode["difficulty"] {
  return ARCHETYPE_PROFILES[archetype].defaultDifficulty;
}

export function mapArchetypeEntityType(archetype: NodeArchetype): string {
  return entityTypeByArchetype[archetype];
}

export function isStableArchetype(archetype: NodeArchetype): boolean {
  return ARCHETYPE_PROFILES[archetype].isStable;
}

export function isChaosArchetype(archetype: NodeArchetype): boolean {
  return ARCHETYPE_PROFILES[archetype].isChaos;
}

export function toStableArchetype(tier: 1 | 2 | 3): NodeArchetype {
  if (tier === 3) {
    return "ST1";
  }
  if (tier === 2) {
    return "ST2";
  }
  return "ST3";
}

export function toChaosArchetype(tier: 1 | 2 | 3): NodeArchetype {
  if (tier === 3) {
    return "BL1";
  }
  if (tier === 2) {
    return "BL2";
  }
  return "BL3";
}
