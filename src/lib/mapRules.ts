import type { NodeAction, NodeActionMeta, NodeArchetype, RegionNode } from "../types/game";

export const ACTION_META: Record<NodeAction, NodeActionMeta> = {
  detail: {
    key: "detail",
    label: "详细信息",
    description: "查看环境背景、驻留加成与节点档案。"
  },
  shop: {
    key: "shop",
    label: "商店",
    description: "成品道具交易与回购入口（占位 UI）。"
  },
  market: {
    key: "market",
    label: "商铺",
    description: "原材料交易与大宗贸易入口（占位 UI）。"
  },
  tavern: {
    key: "tavern",
    label: "酒馆",
    description: "英雄招募与情报搜集入口（占位 UI）。"
  },
  forge: {
    key: "forge",
    label: "铁匠铺",
    description: "强化与打造入口（占位 UI）。"
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
  ST1: ["detail", "shop", "tavern", "forge", "bulletin"],
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
  const mapping: Record<NodeArchetype, string> = {
    ST1: "定居中心 (ST1)",
    ST2: "职能枢纽 (ST2)",
    ST3: "前哨 (ST3)",
    BL1: "灾厄源头 (BL1)",
    BL2: "混沌区 (BL2)",
    BL3: "无序区 (BL3)",
    NOD: "资源点 (NOD)"
  };
  return mapping[node.archetype];
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
