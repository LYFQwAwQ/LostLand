import type {
  OrganizationBuildingDefinition,
  OrganizationBuildingUpgradeStep,
  OrganizationGridCell,
  OrganizationMainQuestDefinition
} from "../types/organization";

export const ORGANIZATION_CONFIG = {
  gridSize: 96,
  initialTerritorySize: 40,
  maxRank: 15,
  baseRankCap: 6,
  maxBuildingLevel: 6,
  rankExpBase: 220,
  rankExpGrowth: 150,
  boardCellSize: 40,
  expansionPatchSize: 7,
  minZoom: 0.45,
  maxZoom: 2.6,
  zoomStep: 0.12
} as const;

function createRect(width: number, height: number): OrganizationGridCell[] {
  const cells: OrganizationGridCell[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

export const organizationBuildingDefinitions: OrganizationBuildingDefinition[] = [
  {
    id: "base_core",
    name: "基地核心",
    category: "functional",
    shape: createRect(4, 3),
    color: "#7a65c8",
    description: "组织中枢，负责汇总基地状态与主线推进。当前可查看基础统计与固定主线任务。",
    effect: "可点击进入基地核心界面（基地状态 / 主线任务）。",
    unique: true,
    clickable: true
  },
  {
    id: "training_camp",
    name: "训练营",
    category: "functional",
    shape: createRect(3, 3),
    color: "#b08a35",
    description: "提供全局经验加成与训练槽位。当前版本可查看槽位并点击占位（暂未接入真实训练流程）。",
    effect: "可点击进入训练营界面（经验加成与训练槽位展示）。",
    unique: true,
    clickable: true
  },
  {
    id: "foundry",
    name: "铁匠铺",
    category: "functional",
    shape: createRect(3, 3),
    color: "#d86c2e",
    description: "装备打造与品质突破核心设施，后续接入打造/宝石子系统。",
    effect: "可点击进入铁匠铺界面（强化与打造）。",
    unique: true,
    clickable: true
  },
  {
    id: "mission_hall",
    name: "任务大厅",
    category: "functional",
    shape: createRect(3, 2),
    color: "#5a7f30",
    description: "集中管理当前委派任务，支持跨地区追踪任务进度与目标。当前版本可查看已接取任务。",
    effect: "可点击进入任务大厅，查看当前所有已接取任务。",
    unique: true,
    clickable: true
  },
  {
    id: "expedition_hub",
    name: "远征调度室",
    category: "functional",
    shape: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 }
    ],
    color: "#2b4f8d",
    description: "管理冗余英雄派遣与远征任务，后续接入任务派遣结算。",
    effect: "可点击进入远征调度功能界面（当前为占位）。",
    unique: true,
    clickable: true
  },
  {
    id: "arcane_library",
    name: "秘法图书馆",
    category: "functional",
    shape: createRect(2, 4),
    color: "#6a47a7",
    description: "技能书炼成与图鉴入口，后续接入技能书生产线。",
    effect: "可点击进入秘法图书馆功能界面（当前为占位）。",
    unique: true,
    clickable: true
  },
  {
    id: "mana_pylon",
    name: "魔力增幅塔",
    category: "buff",
    shape: createRect(1, 3),
    color: "#3e94d6",
    description: "可重复建造的增益建筑，可升级提供额外经验增益（当前仅展示说明）。",
    effect: "提升全体英雄经验收益（当前以展示为主，未接入战斗经验链路）。",
    unique: false,
    clickable: false
  }
];

export const organizationMainQuestDefinitions: OrganizationMainQuestDefinition[] = [
  {
    id: "ch1_mq_01_rebuild_core",
    title: "重建核心",
    summary: "工程队需要先采购建筑材料，对基地核心完成应急修复。",
    objective: "完成一次建筑材料采购（用于核心重建）。",
    conditionType: "build_material_purchase",
    targetValue: 1,
    progressLabel: "建材采购次数"
  },
  {
    id: "ch1_mq_02_clear_outskirts",
    title: "清理主城周边",
    summary: "核心重建后，必须先清理主城外围威胁，恢复补给线秩序。",
    objective: "累计获得 100 场战斗胜利。",
    conditionType: "battle_win",
    targetValue: 100,
    progressLabel: "战斗胜场"
  },
  {
    id: "ch1_mq_03_core_upgrade",
    title: "核心升级",
    summary: "提交建筑材料与怪物材料，完成基地核心正式升级。",
    objective: "完成一次核心升级提交。",
    conditionType: "core_upgrade_submit",
    targetValue: 1,
    progressLabel: "核心升级提交次数"
  },
  {
    id: "ch1_mq_04_expand_base",
    title: "扩建基地",
    summary: "核心升级后需恢复组织建造能力，建设更多基础建筑。",
    objective: "累计建造 3 座建筑（不含基地核心）。",
    conditionType: "building_constructed",
    targetValue: 3,
    progressLabel: "已建造建筑数"
  },
  {
    id: "ch1_mq_05_liberation",
    title: "完全解放",
    summary: "完成建设与清剿后，将第一章目标地区压制值推进到 100。",
    objective: "第一章目标地区压制值达到 100。",
    conditionType: "suppression_reached",
    targetValue: 100,
    progressLabel: "目标地区压制值"
  }
];

export interface OrganizationCoreUpgradeSubmitCost {
  gold: number;
  materials: Array<{ materialId: string; materialName: string; quantity: number }>;
}

const CHAPTER_CORE_UPGRADE_SUBMIT_COST: OrganizationCoreUpgradeSubmitCost = {
  gold: 12000,
  materials: [
    { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 6 },
    { materialId: "building_slag_cement", materialName: "炉渣水泥", quantity: 8 },
    { materialId: "human_refined_steel", materialName: "精炼钢锭", quantity: 6 },
    { materialId: "undead_grave_dust", materialName: "墓尘", quantity: 12 }
  ]
};

export function buildCoreUpgradeSubmitCost(): OrganizationCoreUpgradeSubmitCost {
  return {
    gold: CHAPTER_CORE_UPGRADE_SUBMIT_COST.gold,
    materials: CHAPTER_CORE_UPGRADE_SUBMIT_COST.materials.map((item) => ({ ...item }))
  };
}

function upgradeStep(
  fromLevel: number,
  toLevel: number,
  effect: string,
  goldCost: number,
  materials: OrganizationBuildingUpgradeStep["materials"]
): OrganizationBuildingUpgradeStep {
  return {
    fromLevel,
    toLevel,
    effect,
    goldCost,
    materials
  };
}

export const organizationBuildingUpgradePlansByDefinitionId: Record<string, OrganizationBuildingUpgradeStep[]> = {
  base_core: [
    upgradeStep(1, 2, "组织评级上限 +1", 10000, [
      { materialId: "building_gray_stone_brick", materialName: "灰岩方砖", quantity: 20 },
      { materialId: "building_raw_wood_beam", materialName: "原木横梁", quantity: 10 }
    ]),
    upgradeStep(2, 3, "组织评级上限 +1", 25000, [
      { materialId: "building_rough_iron_nail", materialName: "粗制铁钉", quantity: 30 },
      { materialId: "building_clay_compound", materialName: "黏土混料", quantity: 20 }
    ]),
    upgradeStep(3, 4, "组织评级上限 +1", 60000, [
      { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 15 },
      { materialId: "building_slag_cement", materialName: "炉渣水泥", quantity: 10 }
    ]),
    upgradeStep(4, 5, "组织评级上限 +1", 120000, [
      { materialId: "building_reinforced_laminated_wood", materialName: "强化胶合木", quantity: 20 },
      { materialId: "building_pig_iron_reinforcement", materialName: "生铁加固件", quantity: 15 }
    ]),
    upgradeStep(5, 6, "组织评级上限 +1", 300000, [
      { materialId: "building_polished_marble", materialName: "抛光大理石", quantity: 10 },
      { materialId: "building_brass_corner_wrap", materialName: "精铜包角", quantity: 5 }
    ])
  ],
  training_camp: [
    upgradeStep(1, 2, "全局经验收益 +2%", 8000, [
      { materialId: "building_raw_wood_beam", materialName: "原木横梁", quantity: 15 },
      { materialId: "building_rough_iron_nail", materialName: "粗制铁钉", quantity: 20 }
    ]),
    upgradeStep(2, 3, "全局经验收益 +2%（并解锁第 2 训练槽位）", 20000, [
      { materialId: "building_gray_stone_brick", materialName: "灰岩方砖", quantity: 25 },
      { materialId: "building_river_sand_gravel", materialName: "河沙石子", quantity: 30 }
    ]),
    upgradeStep(3, 4, "全局经验收益 +2%", 50000, [
      { materialId: "building_reinforced_laminated_wood", materialName: "强化胶合木", quantity: 12 },
      { materialId: "building_asphalt_waterproof_coating", materialName: "沥青防水涂层", quantity: 10 }
    ]),
    upgradeStep(4, 5, "全局经验收益 +2%", 100000, [
      { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 18 },
      { materialId: "building_slag_cement", materialName: "炉渣水泥", quantity: 15 }
    ]),
    upgradeStep(5, 6, "全局经验收益 +2%", 250000, [
      { materialId: "building_carved_redwood_beam", materialName: "雕花红木枋", quantity: 8 },
      { materialId: "building_velvet_sound_felt", materialName: "丝绒吸音毡", quantity: 10 }
    ])
  ],
  foundry: [
    upgradeStep(1, 2, "装备强化成功率 +1%", 12000, [
      { materialId: "building_gray_stone_brick", materialName: "灰岩方砖", quantity: 30 },
      { materialId: "building_clay_compound", materialName: "黏土混料", quantity: 15 }
    ]),
    upgradeStep(2, 3, "装备强化成功率 +1%", 30000, [
      { materialId: "building_rough_iron_nail", materialName: "粗制铁钉", quantity: 40 },
      { materialId: "building_river_sand_gravel", materialName: "河沙石子", quantity: 20 }
    ]),
    upgradeStep(3, 4, "装备强化成功率 +1%", 75000, [
      { materialId: "building_pig_iron_reinforcement", materialName: "生铁加固件", quantity: 20 },
      { materialId: "building_slag_cement", materialName: "炉渣水泥", quantity: 20 }
    ]),
    upgradeStep(4, 5, "装备强化成功率 +1%", 150000, [
      { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 25 },
      { materialId: "building_asphalt_waterproof_coating", materialName: "沥青防水涂层", quantity: 15 }
    ]),
    upgradeStep(5, 6, "装备强化成功率 +1%", 400000, [
      { materialId: "building_brass_corner_wrap", materialName: "精铜包角", quantity: 12 },
      { materialId: "building_polished_marble", materialName: "抛光大理石", quantity: 15 }
    ])
  ],
  mission_hall: [
    upgradeStep(1, 2, "任务栏上限 +1", 5000, [
      { materialId: "building_raw_wood_beam", materialName: "原木横梁", quantity: 10 },
      { materialId: "building_gray_stone_brick", materialName: "灰岩方砖", quantity: 10 }
    ]),
    upgradeStep(2, 3, "任务栏上限无变化", 15000, [
      { materialId: "building_rough_iron_nail", materialName: "粗制铁钉", quantity: 25 },
      { materialId: "building_clay_compound", materialName: "黏土混料", quantity: 20 }
    ]),
    upgradeStep(3, 4, "任务栏上限 +1", 40000, [
      { materialId: "building_reinforced_laminated_wood", materialName: "强化胶合木", quantity: 15 },
      { materialId: "building_asphalt_waterproof_coating", materialName: "沥青防水涂层", quantity: 10 }
    ]),
    upgradeStep(4, 5, "任务栏上限无变化", 90000, [
      { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 20 },
      { materialId: "building_pig_iron_reinforcement", materialName: "生铁加固件", quantity: 15 }
    ]),
    upgradeStep(5, 6, "任务栏上限 +1", 220000, [
      { materialId: "building_carved_redwood_beam", materialName: "雕花红木枋", quantity: 10 },
      { materialId: "building_velvet_sound_felt", materialName: "丝绒吸音毡", quantity: 8 }
    ])
  ],
  expedition_hub: [
    upgradeStep(1, 2, "远征收益预留（暂未接入）", 7000, [
      { materialId: "building_gray_stone_brick", materialName: "灰岩方砖", quantity: 15 },
      { materialId: "building_river_sand_gravel", materialName: "河沙石子", quantity: 20 }
    ]),
    upgradeStep(2, 3, "远征收益预留（暂未接入）", 18000, [
      { materialId: "building_raw_wood_beam", materialName: "原木横梁", quantity: 20 },
      { materialId: "building_rough_iron_nail", materialName: "粗制铁钉", quantity: 30 }
    ]),
    upgradeStep(3, 4, "远征收益预留（暂未接入）", 45000, [
      { materialId: "building_slag_cement", materialName: "炉渣水泥", quantity: 15 },
      { materialId: "building_reinforced_laminated_wood", materialName: "强化胶合木", quantity: 15 }
    ]),
    upgradeStep(4, 5, "远征收益预留（暂未接入）", 110000, [
      { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 20 },
      { materialId: "building_asphalt_waterproof_coating", materialName: "沥青防水涂层", quantity: 20 }
    ]),
    upgradeStep(5, 6, "远征收益预留（暂未接入）", 280000, [
      { materialId: "building_colored_inlay_glass", materialName: "彩色镶嵌玻璃", quantity: 6 },
      { materialId: "building_brass_corner_wrap", materialName: "精铜包角", quantity: 8 }
    ])
  ],
  arcane_library: [
    upgradeStep(1, 2, "技能书收益预留（暂未接入）", 15000, [
      { materialId: "building_raw_wood_beam", materialName: "原木横梁", quantity: 20 },
      { materialId: "building_clay_compound", materialName: "黏土混料", quantity: 20 }
    ]),
    upgradeStep(2, 3, "技能书收益预留（暂未接入）", 40000, [
      { materialId: "building_gray_stone_brick", materialName: "灰岩方砖", quantity: 40 },
      { materialId: "building_rough_iron_nail", materialName: "粗制铁钉", quantity: 40 }
    ]),
    upgradeStep(3, 4, "技能书收益预留（暂未接入）", 80000, [
      { materialId: "building_reinforced_laminated_wood", materialName: "强化胶合木", quantity: 20 },
      { materialId: "building_slag_cement", materialName: "炉渣水泥", quantity: 15 }
    ]),
    upgradeStep(4, 5, "技能书收益预留（暂未接入）", 180000, [
      { materialId: "building_pig_iron_reinforcement", materialName: "生铁加固件", quantity: 25 },
      { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 25 }
    ]),
    upgradeStep(5, 6, "技能书收益预留（暂未接入）", 500000, [
      { materialId: "building_colored_inlay_glass", materialName: "彩色镶嵌玻璃", quantity: 12 },
      { materialId: "building_velvet_sound_felt", materialName: "丝绒吸音毡", quantity: 15 }
    ])
  ],
  mana_pylon: [
    upgradeStep(1, 2, "全局经验收益 +1%（展示）", 6000, [
      { materialId: "building_gray_stone_brick", materialName: "灰岩方砖", quantity: 10 },
      { materialId: "building_river_sand_gravel", materialName: "河沙石子", quantity: 12 }
    ]),
    upgradeStep(2, 3, "全局经验收益 +1%（展示）", 16000, [
      { materialId: "building_raw_wood_beam", materialName: "原木横梁", quantity: 16 },
      { materialId: "building_rough_iron_nail", materialName: "粗制铁钉", quantity: 24 }
    ]),
    upgradeStep(3, 4, "全局经验收益 +1%（展示）", 38000, [
      { materialId: "building_slag_cement", materialName: "炉渣水泥", quantity: 12 },
      { materialId: "building_pig_iron_reinforcement", materialName: "生铁加固件", quantity: 10 }
    ]),
    upgradeStep(4, 5, "全局经验收益 +1%（展示）", 90000, [
      { materialId: "building_steel_core_panel", materialName: "钢芯复合板", quantity: 14 },
      { materialId: "building_asphalt_waterproof_coating", materialName: "沥青防水涂层", quantity: 12 }
    ]),
    upgradeStep(5, 6, "全局经验收益 +1%（展示）", 210000, [
      { materialId: "building_colored_inlay_glass", materialName: "彩色镶嵌玻璃", quantity: 5 },
      { materialId: "building_velvet_sound_felt", materialName: "丝绒吸音毡", quantity: 6 }
    ])
  ]
};

export function getOrganizationBuildingUpgradePlan(definitionId: string): OrganizationBuildingUpgradeStep[] {
  return organizationBuildingUpgradePlansByDefinitionId[definitionId] ?? [];
}

export function getOrganizationBuildingUpgradeStep(
  definitionId: string,
  currentLevel: number
): OrganizationBuildingUpgradeStep | null {
  const safeLevel = Math.max(1, Math.floor(currentLevel));
  const matched = getOrganizationBuildingUpgradePlan(definitionId).find((step) => step.fromLevel === safeLevel);
  return matched ?? null;
}

export function getOrganizationBuildingMaxLevel(definitionId: string): number {
  const plan = getOrganizationBuildingUpgradePlan(definitionId);
  if (plan.length <= 0) {
    return 1;
  }
  return Math.max(1, ...plan.map((step) => step.toLevel));
}

export function getBaseCoreRankCapBonus(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.max(0, safeLevel - 1);
}

export function getOrganizationRankCapByBaseCoreLevel(baseCoreLevel: number, extraBonus = 0): number {
  const baseCap = ORGANIZATION_CONFIG.baseRankCap + getBaseCoreRankCapBonus(baseCoreLevel);
  const bonus = Number.isFinite(extraBonus) ? Math.max(0, Math.floor(extraBonus)) : 0;
  return Math.min(ORGANIZATION_CONFIG.maxRank, Math.max(1, baseCap + bonus));
}

export function getMissionHallAcceptedLimitBonus(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.floor(safeLevel / 2);
}

export function getFoundryEnhancementBonusRate(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.max(0, safeLevel - 1) * 0.01;
}

export function getTrainingCampGlobalExpBonusRate(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.max(0, safeLevel - 1) * 0.02;
}

export function getTrainingCampSlotCount(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  let slots = 1;
  if (safeLevel >= 3) {
    slots += 1;
  }
  if (safeLevel >= 7) {
    slots += 1;
  }
  if (safeLevel >= 10) {
    slots += 2;
  }
  return slots;
}

export function getManaPylonGlobalExpBonusRate(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.max(0, safeLevel - 1) * 0.01;
}

export function getOrganizationBuildingDefinition(definitionId: string): OrganizationBuildingDefinition | null {
  return organizationBuildingDefinitions.find((item) => item.id === definitionId) ?? null;
}

export function getRankExpRequirement(rank: number): number {
  return ORGANIZATION_CONFIG.rankExpBase + Math.max(0, rank - 1) * ORGANIZATION_CONFIG.rankExpGrowth;
}
