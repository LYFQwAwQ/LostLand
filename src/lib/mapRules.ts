import type { NodeAction, NodeActionMeta, NodeArchetype, RegionNode } from "../types/game";
import { mapArchetypeEntityType } from "./archetypes";

export const ACTION_META: Record<NodeAction, NodeActionMeta> = {
  detail: {
    key: "detail",
    label: "详细信息",
    description: "查看环境背景、驻留加成与节点档案。"
  },
  shop: {
    key: "shop",
    label: "商店",
    description: "ST1 节点装备基础买卖入口。"
  },
  build_materials: {
    key: "build_materials",
    label: "建材交易",
    description: "ST1 节点建筑材料购买入口（基础价 + 主城浮动百分比）。"
  },
  market: {
    key: "market",
    label: "商铺",
    description: "ST2 节点原材料与大宗贸易入口（当前为静态预览）。"
  },
  tavern: {
    key: "tavern",
    label: "酒馆",
    description: "英雄招募与情报搜集入口（占位 UI）。"
  },
  forge: {
    key: "forge",
    label: "铁匠铺",
    description: "强化系统入口（打造仍为占位预览）。"
  },
  bulletin: {
    key: "bulletin",
    label: "布告栏",
    description: "地区任务委派：领取、战斗推进与提交结算。"
  },
  battle: {
    key: "battle",
    label: "进入讨伐",
    description: "战斗准备界面：侦察、阵容确认、进入实时战斗。"
  },
  ritual: {
    key: "ritual",
    label: "挑战/开启仪式",
    description: "BL3 专属入口，触发 Boss 或剧情转折。"
  }
};

const archetypeActionMap: Record<NodeArchetype, NodeAction[]> = {
  ST1: ["detail", "shop", "build_materials", "tavern", "forge", "bulletin"],
  ST2: ["detail", "market", "bulletin"],
  ST3: ["detail"],
  BL1: ["detail", "battle"],
  BL2: ["detail", "battle"],
  BL3: ["detail", "battle", "ritual"],
  NOD: ["detail"]
};

export function getNodeActions(node: RegionNode): NodeAction[] {
  if (node.state === "inactive") {
    return [];
  }
  if (node.state === "ghost") {
    return ["detail"];
  }
  return archetypeActionMap[node.archetype];
}

export function canAccessAction(node: RegionNode, action: NodeAction): boolean {
  return getNodeActions(node).includes(action);
}

export function mapNodeTypeLabel(node: RegionNode): string {
  if (node.entityType && node.entityType.trim().length > 0) {
    return node.entityType;
  }
  return mapArchetypeEntityType(node.archetype);
}

export function mapStateLabel(state: RegionNode["state"]): string {
  if (state === "active") {
    return "激活";
  }
  if (state === "ghost") {
    return "幽灵位";
  }
  return "未激活";
}

export function mapFactionLabel(faction: RegionNode["faction"]): string {
  if (faction === "Human") {
    return "人族";
  }
  if (faction === "Beast") {
    return "野兽";
  }
  return "中立";
}


