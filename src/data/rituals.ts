import type { RitualDefinition } from "../types/game";

export const ritualDefinitions: RitualDefinition[] = [
  {
    id: "ritual_dark_drain_seal",
    nodeId: "rc-dark-drain-corridor",
    regionId: "radiant-coastline",
    name: "暗渠封印仪式",
    description:
      "暗渠底部的污染封印已经濒临崩裂。组织必须在封印彻底反噬前击溃渗月尸骸主教，重新固定阵列。",
    unlock: {
      requiredQuestId: "ch1_mq_04_expand_base",
      requiredSuppression: 90
    },
    cost: {
      gold: 2400,
      materials: [
        { materialId: "building_gray_stone_brick", quantity: 6 },
        { materialId: "human_rune_ink", quantity: 4 },
        { materialId: "undead_soul_resin", quantity: 3 }
      ]
    },
    reward: {
      gold: 3200,
      reputation: 180,
      materials: [
        {
          materialId: "undead_lord_phylactery",
          materialName: "魂匣碎核",
          rarity: "epic",
          quantity: 2
        },
        {
          materialId: "undead_catacomb_heart",
          materialName: "古陵心核",
          rarity: "epic",
          quantity: 1
        }
      ],
      consumables: [
        {
          consumableId: "healing_potion_small",
          consumableName: "初级治疗药剂",
          rarity: "common",
          quantity: 4
        },
        {
          consumableId: "revive_scroll",
          consumableName: "复苏卷轴",
          rarity: "rare",
          quantity: 1
        }
      ],
      legendaryEquipmentIds: ["legendary_equip_drainseal_charm", "legendary_equip_cistern_oathring"]
    },
    boss: {
      enemyIds: ["ritual_boss_putrid_moon_bishop", "ritual_add_seal_echo", "ritual_add_channel_guard"],
      recommendedSuppression: 90,
      riskTags: ["群体虚弱", "阶段护盾", "暗属性压制"]
    }
  }
];

export const ritualDefinitionById = ritualDefinitions.reduce<Record<string, RitualDefinition>>((acc, ritual) => {
  acc[ritual.id] = ritual;
  return acc;
}, {});

export const ritualDefinitionByNodeId = ritualDefinitions.reduce<Record<string, RitualDefinition>>((acc, ritual) => {
  acc[ritual.nodeId] = ritual;
  return acc;
}, {});
