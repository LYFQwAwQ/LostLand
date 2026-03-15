import type { OrganizationBuildingDefinition, OrganizationGridCell, OrganizationMainQuestDefinition } from "../types/organization";

export const ORGANIZATION_CONFIG = {
  gridSize: 96,
  initialTerritorySize: 40,
  maxRank: 10,
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
    id: "foundry",
    name: "铁匠铺",
    category: "functional",
    shape: createRect(3, 3),
    color: "#d86c2e",
    description: "装备打造与品质突破核心设施，后续接入打造/宝石子系统。",
    effect: "可点击进入铁匠铺功能界面（当前为占位）。",
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
    description: "可重复建造的增益建筑。",
    effect: "提升全体英雄经验收益（当前仅展示增益说明）。",
    unique: false,
    clickable: false
  }
];

export const organizationMainQuestDefinitions: OrganizationMainQuestDefinition[] = [
  {
    id: "mainline_rebuild_signal",
    title: "重启信标",
    summary: "基地核心重启后，先恢复主信标通讯链路。",
    objective: "接取后完成一次“信标重启”主线步骤。"
  },
  {
    id: "mainline_secure_store",
    title: "稳固储备线",
    summary: "建立稳定的基础储备，为后续远征提供支持。",
    objective: "完成资源储备相关主线步骤。"
  },
  {
    id: "mainline_frontier_plan",
    title: "边境部署",
    summary: "完成前线部署规划，打通组织对外行动路径。",
    objective: "完成边境部署主线步骤。"
  }
];

export function getOrganizationBuildingDefinition(definitionId: string): OrganizationBuildingDefinition | null {
  return organizationBuildingDefinitions.find((item) => item.id === definitionId) ?? null;
}

export function getRankExpRequirement(rank: number): number {
  return ORGANIZATION_CONFIG.rankExpBase + Math.max(0, rank - 1) * ORGANIZATION_CONFIG.rankExpGrowth;
}
