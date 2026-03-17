import { ARCHETYPE_PROFILES, mapArchetypeDifficulty, mapArchetypeEntityType } from "../lib/archetypes";
import type {
  DominionStaticConfig,
  Faction,
  NodeArchetype,
  NodeBattleConfig,
  NodeEnemyCountDistribution,
  RegionEdge,
  RegionNode,
  RegionTopology
} from "../types/game";

interface BuildFixedRegionOptions {
  regionId: string;
  continentId: RegionTopology["continentId"];
  continentName: string;
  dominionId: string;
  dominionName: string;
  regionName: string;
  neighborRegionIds: string[];
  dominionConfig: DominionStaticConfig;
}

interface FixedNodeDefinition {
  id: string;
  name: string;
  entityType: string;
  x: number;
  y: number;
  archetype: NodeArchetype;
  state?: RegionNode["state"];
  faction?: Faction;
  environment: string;
  stayBuff: string;
  prosperity?: number;
  strengthMultiplier?: number;
  battleConfig?: NodeBattleConfig;
}

interface FixedEdgeDefinition {
  from: string;
  to: string;
  weight?: number;
}

interface FixedRegionDefinition {
  id: string;
  mapSuppression: number;
  maxRadius?: number;
  nodes: FixedNodeDefinition[];
  edges: FixedEdgeDefinition[];
}

const DEFAULT_COUNT_DISTRIBUTION: NodeEnemyCountDistribution = {
  min: 2,
  max: 6,
  mean: 4,
  sigma: 1
};

const FRONTIER_COUNT_DISTRIBUTION: NodeEnemyCountDistribution = {
  min: 2,
  max: 6,
  mean: 3.6,
  sigma: 1.05
};

const CONTESTED_COUNT_DISTRIBUTION: NodeEnemyCountDistribution = {
  min: 2,
  max: 6,
  mean: 4.1,
  sigma: 0.95
};

const CORE_COUNT_DISTRIBUTION: NodeEnemyCountDistribution = {
  min: 2,
  max: 6,
  mean: 4.75,
  sigma: 0.8
};

function battleConfig(
  entries: Array<{ prototypeId: string; weight: number }>,
  countDistribution: NodeEnemyCountDistribution = DEFAULT_COUNT_DISTRIBUTION
): NodeBattleConfig {
  return {
    enemyPool: entries.map((entry) => ({ ...entry })),
    countDistribution: { ...countDistribution }
  };
}

const fixedRegions: Record<string, FixedRegionDefinition> = {
  "radiant-coastline": {
    id: "radiant-coastline",
    mapSuppression: 62,
    maxRadius: 5,
    nodes: [
      {
        id: "rc-lumen-city",
        name: "流明城",
        entityType: "主城",
        x: 18,
        y: 44,
        archetype: "ST1",
        faction: "Human",
        environment: "断崖高城与圣辉路网构成了稳固的秩序核心。",
        stayBuff: "驻留加成：全队生命上限 +6%",
        prosperity: 230,
        strengthMultiplier: 1.18
      },
      {
        id: "rc-dawnlight-port",
        name: "曦光港",
        entityType: "贸易港",
        x: 24,
        y: 74,
        archetype: "ST1",
        faction: "Human",
        environment: "远洋航线与关税仓栈带来稳定物资流。",
        stayBuff: "驻留加成：交易价格波动 -5%",
        prosperity: 188,
        strengthMultiplier: 1.14
      },
      {
        id: "rc-grand-cathedral",
        name: "圣教大圣堂",
        entityType: "圣堂",
        x: 10,
        y: 28,
        archetype: "ST2",
        faction: "Human",
        environment: "圣歌与巡礼仪式持续压制外围混乱。",
        stayBuff: "驻留加成：治疗效果 +8%",
        prosperity: 148,
        strengthMultiplier: 1.08
      },
      {
        id: "rc-royal-order-command",
        name: "皇家骑士团总部",
        entityType: "军事枢纽",
        x: 31,
        y: 37,
        archetype: "ST2",
        faction: "Human",
        environment: "常备军与边防调度确保主干道可控。",
        stayBuff: "驻留加成：前排减伤 +4%",
        prosperity: 132,
        strengthMultiplier: 1.06
      },
      {
        id: "rc-sage-council",
        name: "贤者议事会",
        entityType: "学术议院",
        x: 44,
        y: 50,
        archetype: "ST2",
        faction: "Human",
        environment: "决策中枢维持城市群补给与法令同步。",
        stayBuff: "驻留加成：法力回复 +10%",
        prosperity: 116,
        strengthMultiplier: 1.03
      },
      {
        id: "rc-baptism-sanctum",
        name: "圣光洗礼池",
        entityType: "圣泉",
        x: 33,
        y: 63,
        archetype: "ST2",
        faction: "Human",
        environment: "净化水渠覆盖了港城与内陆交接带。",
        stayBuff: "驻留加成：异常抗性 +6%",
        prosperity: 108,
        strengthMultiplier: 1.02
      },
      {
        id: "rc-white-stone-mine",
        name: "白石矿区",
        entityType: "矿区",
        x: 49,
        y: 73,
        archetype: "ST2",
        faction: "Human",
        environment: "矿脉开采与护矿卫队保障了前线物资。",
        stayBuff: "驻留加成：基础材料获取 +12%",
        prosperity: 94,
        strengthMultiplier: 1.01
      },
      {
        id: "rc-east-cliff-watch",
        name: "东崖烽台",
        entityType: "边境哨塔",
        x: 58,
        y: 41,
        archetype: "ST3",
        faction: "Human",
        environment: "烽火台覆盖的视野是沿岸防线最后一道预警。",
        stayBuff: "驻留加成：侦察速度 +8%",
        prosperity: 54,
        strengthMultiplier: 0.96
      },
      {
        id: "rc-coast-post",
        name: "海风驿站",
        entityType: "驿站",
        x: 58,
        y: 62,
        archetype: "ST3",
        faction: "Human",
        environment: "沿海驿路连接矿区、港口与前线哨点。",
        stayBuff: "驻留加成：队伍恢复 +5%",
        prosperity: 48,
        strengthMultiplier: 0.94
      },
      {
        id: "rc-echo-forest",
        name: "回响森林",
        entityType: "林地",
        x: 77,
        y: 48,
        archetype: "BL2",
        faction: "Beast",
        environment: "古树空腔持续回荡低语，污染向林缘扩散。",
        stayBuff: "驻留加成：战斗掉落材料 +8%",
        prosperity: -108,
        battleConfig: battleConfig([
          { prototypeId: "beast-razorwolf", weight: 26 },
          { prototypeId: "beast-bristlemaw", weight: 20 },
          { prototypeId: "beast-ironboar", weight: 14 },
          { prototypeId: "beast-rift-stalker", weight: 10 },
          { prototypeId: "human-road-rogue", weight: 8 },
          { prototypeId: "aberrant-spore-drone", weight: 9 },
          { prototypeId: "aberrant-venom-howler", weight: 6 },
          { prototypeId: "beast-thunder-antler", weight: 4 },
          { prototypeId: "aberrant-mire-screamer", weight: 3 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "rc-dark-drain-corridor",
        name: "暗渠走廊",
        entityType: "地下暗渠",
        x: 83,
        y: 69,
        archetype: "BL3",
        faction: "Beast",
        environment: "地下排水网被污染团块占据，异化生物频繁迁入。",
        stayBuff: "驻留加成：异兽遭遇率 +10%",
        prosperity: -84,
        battleConfig: battleConfig([
          { prototypeId: "human-road-rogue", weight: 20 },
          { prototypeId: "human-crossbow-hunter", weight: 14 },
          { prototypeId: "human-gloom-inquisitor", weight: 9 },
          { prototypeId: "beast-rift-stalker", weight: 8 },
          { prototypeId: "aberrant-spore-drone", weight: 12 },
          { prototypeId: "aberrant-venom-howler", weight: 8 },
          { prototypeId: "aberrant-carrion-seer", weight: 4 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "rc-smuggler-cove",
        name: "盐雾巡防湾",
        entityType: "海岸巡防站",
        x: 72,
        y: 79,
        archetype: "ST3",
        faction: "Human",
        environment: "沿岸巡防队接管旧私掠湾后，补给线安全性显著提升。",
        stayBuff: "驻留加成：战后情报收益 +5%",
        prosperity: 34,
        strengthMultiplier: 0.95
      },
      {
        id: "rc-blacktide-sanctum",
        name: "黑潮巢宫",
        entityType: "潮蚀巢宫",
        x: 90,
        y: 54,
        archetype: "BL2",
        faction: "Beast",
        environment: "海崖下残存的污染孵化腔仍在活动，但规模已被压制。",
        stayBuff: "驻留加成：异兽遭遇率 +10%",
        prosperity: -124,
        strengthMultiplier: 1.02,
        battleConfig: battleConfig([
          { prototypeId: "aberrant-venom-howler", weight: 8 },
          { prototypeId: "aberrant-chitin-guardian", weight: 6 },
          { prototypeId: "aberrant-mire-screamer", weight: 6 },
          { prototypeId: "aberrant-carrion-seer", weight: 5 },
          { prototypeId: "beast-tidefang-lord", weight: 4 },
          { prototypeId: "beast-thunder-antler", weight: 7 },
          { prototypeId: "beast-ironboar", weight: 8 },
          { prototypeId: "human-border-lancer", weight: 4 },
          { prototypeId: "aberrant-mutant-behemoth", weight: 2 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "rc-brine-reed-bog",
        name: "盐苇防潮堤",
        entityType: "防潮据点",
        x: 78,
        y: 90,
        archetype: "ST3",
        faction: "Human",
        environment: "沿海防潮工事重新启用后，巡防队可在涨潮期稳定驻守。",
        stayBuff: "驻留加成：异常抗性 +4%",
        prosperity: 22,
        strengthMultiplier: 0.93
      },
      {
        id: "rc-fog-salt-flat",
        name: "潮雾盐滩",
        entityType: "滩涂",
        x: 66,
        y: 90,
        archetype: "NOD",
        state: "inactive",
        faction: "Neutral",
        environment: "受潮汐影响的裸露盐滩尚未形成稳定据点。",
        stayBuff: "驻留加成：无",
        prosperity: 0
      }
    ],
    edges: [
      { from: "rc-lumen-city", to: "rc-grand-cathedral" },
      { from: "rc-lumen-city", to: "rc-royal-order-command" },
      { from: "rc-lumen-city", to: "rc-east-cliff-watch" },
      { from: "rc-dawnlight-port", to: "rc-sage-council" },
      { from: "rc-dawnlight-port", to: "rc-baptism-sanctum" },
      { from: "rc-dawnlight-port", to: "rc-smuggler-cove" },
      { from: "rc-grand-cathedral", to: "rc-royal-order-command" },
      { from: "rc-royal-order-command", to: "rc-sage-council" },
      { from: "rc-sage-council", to: "rc-baptism-sanctum" },
      { from: "rc-baptism-sanctum", to: "rc-white-stone-mine" },
      { from: "rc-white-stone-mine", to: "rc-coast-post" },
      { from: "rc-east-cliff-watch", to: "rc-coast-post" },
      { from: "rc-east-cliff-watch", to: "rc-echo-forest" },
      { from: "rc-coast-post", to: "rc-dark-drain-corridor" },
      { from: "rc-coast-post", to: "rc-smuggler-cove" },
      { from: "rc-echo-forest", to: "rc-dark-drain-corridor" },
      { from: "rc-echo-forest", to: "rc-smuggler-cove" },
      { from: "rc-echo-forest", to: "rc-blacktide-sanctum" },
      { from: "rc-dark-drain-corridor", to: "rc-smuggler-cove" },
      { from: "rc-dark-drain-corridor", to: "rc-blacktide-sanctum" },
      { from: "rc-dark-drain-corridor", to: "rc-brine-reed-bog" },
      { from: "rc-smuggler-cove", to: "rc-brine-reed-bog" },
      { from: "rc-blacktide-sanctum", to: "rc-brine-reed-bog" },
      { from: "rc-coast-post", to: "rc-fog-salt-flat" },
      { from: "rc-dark-drain-corridor", to: "rc-fog-salt-flat" },
      { from: "rc-smuggler-cove", to: "rc-fog-salt-flat" },
      { from: "rc-brine-reed-bog", to: "rc-fog-salt-flat" }
    ]
  },
  "iron-curtain-highlands": {
    id: "iron-curtain-highlands",
    mapSuppression: 53,
    maxRadius: 5,
    nodes: [
      {
        id: "ih-frosthold-citadel",
        name: "寒铁要塞",
        entityType: "要塞主城",
        x: 18,
        y: 42,
        archetype: "ST1",
        faction: "Human",
        environment: "北境主防线的核心堡垒，承担全域调兵。",
        stayBuff: "驻留加成：全队物理减伤 +5%",
        prosperity: 176,
        strengthMultiplier: 1.16
      },
      {
        id: "ih-hammerfell",
        name: "巨锤镇",
        entityType: "工业城镇",
        x: 24,
        y: 71,
        archetype: "ST1",
        faction: "Human",
        environment: "深层矿脉与重锻工坊提供持续战争产能。",
        stayBuff: "驻留加成：强化消耗金币 -6%",
        prosperity: 154,
        strengthMultiplier: 1.12
      },
      {
        id: "ih-deep-gold-pit",
        name: "深洞掘金场",
        entityType: "矿场",
        x: 35,
        y: 58,
        archetype: "ST2",
        faction: "Human",
        environment: "竖井式开采点维持着北境后勤命脉。",
        stayBuff: "驻留加成：矿类材料掉率 +12%",
        prosperity: 104,
        strengthMultiplier: 1.05
      },
      {
        id: "ih-frost-warning-post",
        name: "严寒预警哨所",
        entityType: "预警哨所",
        x: 39,
        y: 34,
        archetype: "ST2",
        faction: "Human",
        environment: "极寒风带监测站持续回传裂谷异动。",
        stayBuff: "驻留加成：侦察成功率 +10%",
        prosperity: 90,
        strengthMultiplier: 1.01
      },
      {
        id: "ih-north-forge-union",
        name: "北境铁匠工会",
        entityType: "工会",
        x: 31,
        y: 49,
        archetype: "ST2",
        faction: "Human",
        environment: "统一锻造标准与维修流程，稳定前线装备供给。",
        stayBuff: "驻留加成：装备耐久损耗 -10%",
        prosperity: 95,
        strengthMultiplier: 1.02
      },
      {
        id: "ih-veteran-sanatorium",
        name: "老兵疗养院",
        entityType: "疗养院",
        x: 36,
        y: 76,
        archetype: "ST2",
        faction: "Human",
        environment: "退役战团驻守于此，兼任地方防务。",
        stayBuff: "驻留加成：生命回复 +8%",
        prosperity: 82,
        strengthMultiplier: 1
      },
      {
        id: "ih-runic-smelter",
        name: "符文熔炉",
        entityType: "熔炉",
        x: 47,
        y: 57,
        archetype: "ST2",
        faction: "Human",
        environment: "熔炉阵列维持着符文钢锭的稳定产出。",
        stayBuff: "驻留加成：法术穿透 +4%",
        prosperity: 88,
        strengthMultiplier: 1.01
      },
      {
        id: "ih-ice-plank-route",
        name: "坚冰栈道",
        entityType: "高地栈道",
        x: 48,
        y: 73,
        archetype: "ST2",
        faction: "Human",
        environment: "连接多处冰脊点位的高风险运输线。",
        stayBuff: "驻留加成：移动速度 +5%",
        prosperity: 74,
        strengthMultiplier: 0.99
      },
      {
        id: "ih-winter-stable",
        name: "凛冬马厩",
        entityType: "补给驿站",
        x: 55,
        y: 82,
        archetype: "ST2",
        faction: "Human",
        environment: "雪地骑乘驿站保障了山地补给连续性。",
        stayBuff: "驻留加成：远征补给消耗 -8%",
        prosperity: 62,
        strengthMultiplier: 0.97
      },
      {
        id: "ih-rime-gate",
        name: "霜门关卡",
        entityType: "边境关卡",
        x: 58,
        y: 45,
        archetype: "ST3",
        faction: "Human",
        environment: "霜门是稳定阵营与污染带接触最频繁的节点。",
        stayBuff: "驻留加成：前排格挡 +4%",
        prosperity: 28,
        strengthMultiplier: 0.95
      },
      {
        id: "ih-snowline-scout",
        name: "雪线侦察营",
        entityType: "侦察营地",
        x: 60,
        y: 66,
        archetype: "ST3",
        faction: "Human",
        environment: "雪线营地常年被混沌区包围，局势反复。",
        stayBuff: "驻留加成：战后情报收益 +6%",
        prosperity: 16,
        strengthMultiplier: 0.92
      },
      {
        id: "ih-wailing-tumulus",
        name: "哀鸣荒冢",
        entityType: "古战场荒冢",
        x: 82,
        y: 30,
        archetype: "BL2",
        faction: "Beast",
        environment: "亡灵潮从古战场裂口持续渗入高地。",
        stayBuff: "驻留加成：亡灵素材掉率 +12%",
        prosperity: -128,
        strengthMultiplier: 1.02,
        battleConfig: battleConfig(
          [
            { prototypeId: "undead-grave-scout", weight: 14 },
            { prototypeId: "undead-bone-guard", weight: 15 },
            { prototypeId: "undead-ritual-adept", weight: 10 },
            { prototypeId: "undead-grave-warden", weight: 8 },
            { prototypeId: "undead-abyss-liturgist", weight: 4 },
            { prototypeId: "aberrant-carrion-seer", weight: 7 },
            { prototypeId: "aberrant-plague-harbinger", weight: 3 },
            { prototypeId: "aberrant-venom-howler", weight: 6 },
            { prototypeId: "undead-throne-revenant", weight: 1 }
          ],
          CONTESTED_COUNT_DISTRIBUTION
        )
      },
      {
        id: "ih-boneshard-canyon",
        name: "碎骨峡谷",
        entityType: "峡谷",
        x: 74,
        y: 51,
        archetype: "BL2",
        faction: "Beast",
        environment: "骨堆峡谷内猛兽与亡灵交替盘踞。",
        stayBuff: "驻留加成：近战伤害 +6%",
        prosperity: -112,
        battleConfig: battleConfig([
          { prototypeId: "beast-ironboar", weight: 14 },
          { prototypeId: "beast-thunder-antler", weight: 7 },
          { prototypeId: "beast-razorwolf", weight: 12 },
          { prototypeId: "undead-crypt-howler", weight: 10 },
          { prototypeId: "undead-plague-hound", weight: 8 },
          { prototypeId: "aberrant-venom-howler", weight: 7 },
          { prototypeId: "aberrant-chitin-guardian", weight: 4 },
          { prototypeId: "beast-ashen-behemoth", weight: 1 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "ih-rimebat-abyss",
        name: "霜翼蝠窟",
        entityType: "洞窟",
        x: 83,
        y: 63,
        archetype: "BL3",
        faction: "Beast",
        environment: "寒雾洞窟中栖居着高机动掠食群。",
        stayBuff: "驻留加成：暴击率 +4%",
        prosperity: -86,
        battleConfig: battleConfig([
          { prototypeId: "beast-mire-vulture", weight: 12 },
          { prototypeId: "beast-rift-stalker", weight: 10 },
          { prototypeId: "beast-razorwolf", weight: 10 },
          { prototypeId: "beast-bristlemaw", weight: 8 },
          { prototypeId: "aberrant-spore-drone", weight: 9 },
          { prototypeId: "aberrant-mire-screamer", weight: 4 },
          { prototypeId: "undead-ritual-adept", weight: 4 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "ih-frozen-rift",
        name: "冻痕裂隙",
        entityType: "裂隙带",
        x: 73,
        y: 74,
        archetype: "BL2",
        faction: "Beast",
        environment: "地表裂隙不断涌出污染孢雾与低温死气。",
        stayBuff: "驻留加成：异常效果命中 +5%",
        prosperity: -96,
        battleConfig: battleConfig([
          { prototypeId: "aberrant-spore-drone", weight: 10 },
          { prototypeId: "aberrant-venom-howler", weight: 9 },
          { prototypeId: "aberrant-chitin-guardian", weight: 8 },
          { prototypeId: "aberrant-carrion-seer", weight: 5 },
          { prototypeId: "undead-bone-guard", weight: 8 },
          { prototypeId: "undead-plague-hound", weight: 6 },
          { prototypeId: "undead-abyss-liturgist", weight: 3 },
          { prototypeId: "aberrant-mutant-behemoth", weight: 2 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "ih-hoarfang-warren",
        name: "寒牙巢道",
        entityType: "冻土兽径",
        x: 87,
        y: 81,
        archetype: "BL3",
        faction: "Beast",
        environment: "裂隙余脉形成的地洞群，主要出没中低阶掠食兽。",
        stayBuff: "驻留加成：战后恢复效率 -5%",
        prosperity: -74,
        battleConfig: battleConfig([
          { prototypeId: "beast-razorwolf", weight: 14 },
          { prototypeId: "beast-bristlemaw", weight: 12 },
          { prototypeId: "beast-rift-stalker", weight: 10 },
          { prototypeId: "human-road-rogue", weight: 7 },
          { prototypeId: "undead-crypt-howler", weight: 6 },
          { prototypeId: "aberrant-spore-drone", weight: 8 },
          { prototypeId: "aberrant-venom-howler", weight: 5 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "ih-abandoned-cache",
        name: "废弃军需点",
        entityType: "旧补给站",
        x: 63,
        y: 88,
        archetype: "NOD",
        state: "inactive",
        faction: "Neutral",
        environment: "被冰层掩埋的旧据点尚未恢复驻防。",
        stayBuff: "驻留加成：无",
        prosperity: 0
      }
    ],
    edges: [
      { from: "ih-frosthold-citadel", to: "ih-frost-warning-post" },
      { from: "ih-frosthold-citadel", to: "ih-north-forge-union" },
      { from: "ih-frosthold-citadel", to: "ih-rime-gate" },
      { from: "ih-hammerfell", to: "ih-deep-gold-pit" },
      { from: "ih-hammerfell", to: "ih-north-forge-union" },
      { from: "ih-hammerfell", to: "ih-veteran-sanatorium" },
      { from: "ih-hammerfell", to: "ih-ice-plank-route" },
      { from: "ih-deep-gold-pit", to: "ih-north-forge-union" },
      { from: "ih-deep-gold-pit", to: "ih-runic-smelter" },
      { from: "ih-frost-warning-post", to: "ih-runic-smelter" },
      { from: "ih-frost-warning-post", to: "ih-rime-gate" },
      { from: "ih-north-forge-union", to: "ih-runic-smelter" },
      { from: "ih-north-forge-union", to: "ih-ice-plank-route" },
      { from: "ih-north-forge-union", to: "ih-rime-gate" },
      { from: "ih-veteran-sanatorium", to: "ih-ice-plank-route" },
      { from: "ih-veteran-sanatorium", to: "ih-winter-stable" },
      { from: "ih-runic-smelter", to: "ih-rime-gate" },
      { from: "ih-runic-smelter", to: "ih-snowline-scout" },
      { from: "ih-ice-plank-route", to: "ih-snowline-scout" },
      { from: "ih-rime-gate", to: "ih-wailing-tumulus" },
      { from: "ih-rime-gate", to: "ih-boneshard-canyon" },
      { from: "ih-snowline-scout", to: "ih-boneshard-canyon" },
      { from: "ih-snowline-scout", to: "ih-frozen-rift" },
      { from: "ih-wailing-tumulus", to: "ih-boneshard-canyon" },
      { from: "ih-wailing-tumulus", to: "ih-frozen-rift" },
      { from: "ih-boneshard-canyon", to: "ih-rimebat-abyss" },
      { from: "ih-boneshard-canyon", to: "ih-frozen-rift" },
      { from: "ih-rimebat-abyss", to: "ih-frozen-rift" },
      { from: "ih-rimebat-abyss", to: "ih-hoarfang-warren" },
      { from: "ih-frozen-rift", to: "ih-hoarfang-warren" },
      { from: "ih-winter-stable", to: "ih-abandoned-cache" },
      { from: "ih-snowline-scout", to: "ih-abandoned-cache" },
      { from: "ih-rimebat-abyss", to: "ih-abandoned-cache" },
      { from: "ih-hoarfang-warren", to: "ih-abandoned-cache" }
    ]
  },
  "amber-expanse": {
    id: "amber-expanse",
    mapSuppression: 51,
    maxRadius: 5,
    nodes: [
      {
        id: "ae-amber-town",
        name: "琥珀镇",
        entityType: "商贸主城",
        x: 19,
        y: 46,
        archetype: "ST1",
        faction: "Human",
        environment: "陆路与酒馆网络让贸易与佣兵持续涌入。",
        stayBuff: "驻留加成：金币获取 +10%",
        prosperity: 184,
        strengthMultiplier: 1.15
      },
      {
        id: "ae-goldwheat-city",
        name: "金麦城",
        entityType: "农业主城",
        x: 23,
        y: 73,
        archetype: "ST1",
        faction: "Human",
        environment: "粮仓与河网灌溉保证了后方供给稳定。",
        stayBuff: "驻留加成：消耗品掉率 +8%",
        prosperity: 166,
        strengthMultiplier: 1.13
      },
      {
        id: "ae-grand-merchant-hall",
        name: "万物商会总部",
        entityType: "商会总部",
        x: 33,
        y: 38,
        archetype: "ST2",
        faction: "Human",
        environment: "价格中枢覆盖荒原大部分贸易节点。",
        stayBuff: "驻留加成：买入价格 -5%",
        prosperity: 112,
        strengthMultiplier: 1.04
      },
      {
        id: "ae-harvest-altar",
        name: "丰收祭坛",
        entityType: "祭坛",
        x: 35,
        y: 58,
        archetype: "ST2",
        faction: "Human",
        environment: "祭祀仪式带来季节性秩序增益。",
        stayBuff: "驻留加成：生命恢复 +6%",
        prosperity: 102,
        strengthMultiplier: 1.02
      },
      {
        id: "ae-wildtrail-station",
        name: "野径驿站",
        entityType: "驿站",
        x: 46,
        y: 35,
        archetype: "ST2",
        faction: "Human",
        environment: "野径补给线连接了多条风险商路。",
        stayBuff: "驻留加成：移动恢复 +6%",
        prosperity: 92,
        strengthMultiplier: 1
      },
      {
        id: "ae-merc-camp",
        name: "佣兵驻扎地",
        entityType: "营地",
        x: 46,
        y: 52,
        archetype: "ST2",
        faction: "Human",
        environment: "雇佣兵轮值驻守，维持关键节点治安。",
        stayBuff: "驻留加成：暴击伤害 +5%",
        prosperity: 90,
        strengthMultiplier: 1.01
      },
      {
        id: "ae-river-ferry",
        name: "大河渡口",
        entityType: "渡口",
        x: 45,
        y: 67,
        archetype: "ST2",
        faction: "Human",
        environment: "河道交通保障了粮仓与商镇的往返效率。",
        stayBuff: "驻留加成：队伍行军时间 -8%",
        prosperity: 86,
        strengthMultiplier: 1
      },
      {
        id: "ae-windmill-belt",
        name: "荒野磨坊群",
        entityType: "磨坊群",
        x: 54,
        y: 76,
        archetype: "ST2",
        faction: "Human",
        environment: "磨坊带稳定处理大宗谷物与草药原料。",
        stayBuff: "驻留加成：材料转化效率 +8%",
        prosperity: 72,
        strengthMultiplier: 0.98
      },
      {
        id: "ae-wind-watch-tower",
        name: "风向观测塔",
        entityType: "观测塔",
        x: 56,
        y: 58,
        archetype: "ST2",
        faction: "Human",
        environment: "风向塔预警沙暴与污染扩散方向。",
        stayBuff: "驻留加成：侦察精度 +7%",
        prosperity: 78,
        strengthMultiplier: 0.99
      },
      {
        id: "ae-frontier-barn",
        name: "边荒粮垛",
        entityType: "前线仓站",
        x: 62,
        y: 44,
        archetype: "ST3",
        faction: "Human",
        environment: "粮垛据点是稳定与无序阵营碰撞最频繁的边线。",
        stayBuff: "驻留加成：队伍体力消耗 -5%",
        prosperity: 34,
        strengthMultiplier: 0.94
      },
      {
        id: "ae-dune-outpost",
        name: "沙丘前哨",
        entityType: "前哨",
        x: 63,
        y: 68,
        archetype: "ST3",
        faction: "Human",
        environment: "沙丘前哨在反复争夺中维持最低秩序。",
        stayBuff: "驻留加成：命中率 +4%",
        prosperity: 22,
        strengthMultiplier: 0.91
      },
      {
        id: "ae-bandit-camp",
        name: "响马营地",
        entityType: "盗匪营地",
        x: 80,
        y: 45,
        archetype: "BL2",
        faction: "Beast",
        environment: "流窜武装在此盘踞，常袭击商道护卫。",
        stayBuff: "驻留加成：掉落金币 +6%",
        prosperity: -98,
        battleConfig: battleConfig([
          { prototypeId: "human-road-rogue", weight: 18 },
          { prototypeId: "human-border-lancer", weight: 13 },
          { prototypeId: "human-crossbow-hunter", weight: 9 },
          { prototypeId: "human-blacksmith-merc", weight: 8 },
          { prototypeId: "human-gloom-inquisitor", weight: 6 },
          { prototypeId: "beast-razorwolf", weight: 7 },
          { prototypeId: "aberrant-spore-drone", weight: 5 },
          { prototypeId: "human-iron-banner-captain", weight: 2 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "ae-withered-farm",
        name: "枯萎农庄",
        entityType: "污染农庄",
        x: 77,
        y: 62,
        archetype: "BL2",
        faction: "Beast",
        environment: "受污染耕地持续产出异化孢群。",
        stayBuff: "驻留加成：异常伤害 +7%",
        prosperity: -114,
        battleConfig: battleConfig([
          { prototypeId: "beast-razorwolf", weight: 14 },
          { prototypeId: "beast-bristlemaw", weight: 12 },
          { prototypeId: "beast-ironboar", weight: 10 },
          { prototypeId: "beast-mire-vulture", weight: 7 },
          { prototypeId: "aberrant-spore-drone", weight: 9 },
          { prototypeId: "aberrant-venom-howler", weight: 7 },
          { prototypeId: "aberrant-mire-screamer", weight: 4 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "ae-dustmaw-ravine",
        name: "尘喉裂谷",
        entityType: "深渊裂谷",
        x: 86,
        y: 75,
        archetype: "BL2",
        faction: "Beast",
        environment: "裂谷深处污染源翻涌，异兽族群不断繁殖。",
        stayBuff: "驻留加成：异兽素材掉率 +12%",
        prosperity: -124,
        strengthMultiplier: 1.02,
        battleConfig: battleConfig(
          [
            { prototypeId: "aberrant-venom-howler", weight: 9 },
            { prototypeId: "aberrant-chitin-guardian", weight: 8 },
            { prototypeId: "aberrant-mire-screamer", weight: 8 },
            { prototypeId: "aberrant-carrion-seer", weight: 6 },
            { prototypeId: "aberrant-mutant-behemoth", weight: 2 },
            { prototypeId: "aberrant-plague-harbinger", weight: 2 },
            { prototypeId: "beast-thunder-antler", weight: 8 },
            { prototypeId: "beast-tidefang-lord", weight: 4 },
            { prototypeId: "beast-ashen-behemoth", weight: 1 }
          ],
          CONTESTED_COUNT_DISTRIBUTION
        )
      },
      {
        id: "ae-broken-shrine",
        name: "断祀神龛",
        entityType: "废弃神龛",
        x: 85,
        y: 57,
        archetype: "BL3",
        faction: "Beast",
        environment: "神龛残片吸引了流亡术士与亡灵徘徊者。",
        stayBuff: "驻留加成：法术伤害 +5%",
        prosperity: -72,
        battleConfig: battleConfig([
          { prototypeId: "human-gloom-inquisitor", weight: 10 },
          { prototypeId: "human-sanctum-arcanist", weight: 6 },
          { prototypeId: "undead-ritual-adept", weight: 7 },
          { prototypeId: "undead-crypt-howler", weight: 8 },
          { prototypeId: "aberrant-carrion-seer", weight: 6 },
          { prototypeId: "aberrant-spore-drone", weight: 8 },
          { prototypeId: "human-crowned-executor", weight: 1 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "ae-sandvice-burrow",
        name: "沙蝎巢沟",
        entityType: "流沙巢沟",
        x: 90,
        y: 68,
        archetype: "BL3",
        faction: "Beast",
        environment: "流沙下密布虫道，常见中低阶猎食群伏击过路队伍。",
        stayBuff: "驻留加成：闪避 -4%",
        prosperity: -78,
        battleConfig: battleConfig([
          { prototypeId: "beast-razorwolf", weight: 14 },
          { prototypeId: "beast-bristlemaw", weight: 12 },
          { prototypeId: "human-road-rogue", weight: 9 },
          { prototypeId: "human-crossbow-hunter", weight: 7 },
          { prototypeId: "aberrant-spore-drone", weight: 8 },
          { prototypeId: "aberrant-venom-howler", weight: 5 },
          { prototypeId: "undead-crypt-howler", weight: 6 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "ae-abandoned-well",
        name: "荒井遗址",
        entityType: "荒井",
        x: 68,
        y: 86,
        archetype: "NOD",
        state: "inactive",
        faction: "Neutral",
        environment: "荒井仍有开发潜力，但尚未形成秩序场支撑。",
        stayBuff: "驻留加成：无",
        prosperity: 0
      }
    ],
    edges: [
      { from: "ae-amber-town", to: "ae-grand-merchant-hall" },
      { from: "ae-amber-town", to: "ae-harvest-altar" },
      { from: "ae-amber-town", to: "ae-wildtrail-station" },
      { from: "ae-amber-town", to: "ae-frontier-barn" },
      { from: "ae-goldwheat-city", to: "ae-harvest-altar" },
      { from: "ae-goldwheat-city", to: "ae-merc-camp" },
      { from: "ae-goldwheat-city", to: "ae-river-ferry" },
      { from: "ae-goldwheat-city", to: "ae-windmill-belt" },
      { from: "ae-grand-merchant-hall", to: "ae-wildtrail-station" },
      { from: "ae-grand-merchant-hall", to: "ae-merc-camp" },
      { from: "ae-harvest-altar", to: "ae-river-ferry" },
      { from: "ae-harvest-altar", to: "ae-windmill-belt" },
      { from: "ae-harvest-altar", to: "ae-wind-watch-tower" },
      { from: "ae-wildtrail-station", to: "ae-merc-camp" },
      { from: "ae-wildtrail-station", to: "ae-frontier-barn" },
      { from: "ae-wildtrail-station", to: "ae-dune-outpost" },
      { from: "ae-merc-camp", to: "ae-river-ferry" },
      { from: "ae-merc-camp", to: "ae-dune-outpost" },
      { from: "ae-river-ferry", to: "ae-windmill-belt" },
      { from: "ae-river-ferry", to: "ae-wind-watch-tower" },
      { from: "ae-windmill-belt", to: "ae-wind-watch-tower" },
      { from: "ae-frontier-barn", to: "ae-bandit-camp" },
      { from: "ae-frontier-barn", to: "ae-withered-farm" },
      { from: "ae-dune-outpost", to: "ae-bandit-camp" },
      { from: "ae-dune-outpost", to: "ae-dustmaw-ravine" },
      { from: "ae-bandit-camp", to: "ae-withered-farm" },
      { from: "ae-bandit-camp", to: "ae-broken-shrine" },
      { from: "ae-withered-farm", to: "ae-dustmaw-ravine" },
      { from: "ae-withered-farm", to: "ae-broken-shrine" },
      { from: "ae-withered-farm", to: "ae-sandvice-burrow" },
      { from: "ae-dustmaw-ravine", to: "ae-broken-shrine" },
      { from: "ae-dustmaw-ravine", to: "ae-sandvice-burrow" },
      { from: "ae-broken-shrine", to: "ae-sandvice-burrow" },
      { from: "ae-dune-outpost", to: "ae-abandoned-well" },
      { from: "ae-wind-watch-tower", to: "ae-abandoned-well" },
      { from: "ae-broken-shrine", to: "ae-abandoned-well" },
      { from: "ae-sandvice-burrow", to: "ae-abandoned-well" }
    ]
  },
  "misty-waterlands": {
    id: "misty-waterlands",
    mapSuppression: 42,
    maxRadius: 5,
    nodes: [
      {
        id: "mw-emerald-heart",
        name: "翠心城",
        entityType: "水上主城",
        x: 19,
        y: 41,
        archetype: "ST1",
        faction: "Human",
        environment: "古树与浮岛构成了南境最稳固的秩序核心。",
        stayBuff: "驻留加成：全队法术抗性 +6%",
        prosperity: 164,
        strengthMultiplier: 1.14
      },
      {
        id: "mw-pearl-haven",
        name: "珠蚌湾",
        entityType: "采贸港",
        x: 24,
        y: 72,
        archetype: "ST1",
        faction: "Human",
        environment: "珍珠与药材转运维系着水泽经济。",
        stayBuff: "驻留加成：消耗品收益 +8%",
        prosperity: 146,
        strengthMultiplier: 1.12
      },
      {
        id: "mw-alchemist-vault",
        name: "药剂师密室",
        entityType: "药剂工坊",
        x: 34,
        y: 35,
        archetype: "ST2",
        faction: "Human",
        environment: "封闭药坊持续输出净化药剂与沼泽试剂。",
        stayBuff: "驻留加成：中毒抗性 +10%",
        prosperity: 102,
        strengthMultiplier: 1.04
      },
      {
        id: "mw-marsh-lighthouse",
        name: "沼泽引路灯塔",
        entityType: "灯塔",
        x: 37,
        y: 49,
        archetype: "ST2",
        faction: "Human",
        environment: "灯塔信标为高湿雾域提供航路引导。",
        stayBuff: "驻留加成：命中率 +5%",
        prosperity: 96,
        strengthMultiplier: 1.02
      },
      {
        id: "mw-sunken-shipyard",
        name: "沉木造船厂",
        entityType: "船厂",
        x: 43,
        y: 66,
        archetype: "ST2",
        faction: "Human",
        environment: "浮木船坞连接了各水道聚落。",
        stayBuff: "驻留加成：队伍远征耐久 +6%",
        prosperity: 88,
        strengthMultiplier: 1
      },
      {
        id: "mw-serpentine-altar",
        name: "蛇纹石祭坛",
        entityType: "祭坛",
        x: 47,
        y: 40,
        archetype: "ST2",
        faction: "Human",
        environment: "祭坛压制着周边污染潮汐的峰值。",
        stayBuff: "驻留加成：异常持续时间 -8%",
        prosperity: 92,
        strengthMultiplier: 1.01
      },
      {
        id: "mw-herbal-bazaar",
        name: "百草集市",
        entityType: "集市",
        x: 50,
        y: 57,
        archetype: "ST2",
        faction: "Human",
        environment: "草药交易维持了南境治疗物资循环。",
        stayBuff: "驻留加成：治疗量 +6%",
        prosperity: 84,
        strengthMultiplier: 1
      },
      {
        id: "mw-rainwatch-tower",
        name: "雨林哨塔",
        entityType: "雨林哨塔",
        x: 56,
        y: 46,
        archetype: "ST2",
        faction: "Human",
        environment: "雨林监视塔用于追踪异兽群迁徙。",
        stayBuff: "驻留加成：暴击抵抗 +5%",
        prosperity: 80,
        strengthMultiplier: 0.99
      },
      {
        id: "mw-mudway-station",
        name: "泥潭驿站",
        entityType: "驿站",
        x: 56,
        y: 69,
        archetype: "ST2",
        faction: "Human",
        environment: "泥潭驿路是跨水泽补给线的关键节点。",
        stayBuff: "驻留加成：移动恢复 +6%",
        prosperity: 68,
        strengthMultiplier: 0.98
      },
      {
        id: "mw-reedwatch-post",
        name: "芦荡前哨",
        entityType: "前哨",
        x: 62,
        y: 43,
        archetype: "ST3",
        faction: "Human",
        environment: "芦荡前哨长期与污染边界贴身接触。",
        stayBuff: "驻留加成：闪避 +4%",
        prosperity: 20,
        strengthMultiplier: 0.92
      },
      {
        id: "mw-fog-lantern-post",
        name: "雾灯陷落哨",
        entityType: "陷落前哨",
        x: 63,
        y: 64,
        archetype: "BL3",
        faction: "Beast",
        environment: "前哨失守后沦为异化群夜间迁徙的中转点。",
        stayBuff: "驻留加成：受治疗效果 -4%",
        prosperity: -88,
        battleConfig: battleConfig([
          { prototypeId: "beast-rift-stalker", weight: 12 },
          { prototypeId: "beast-mire-vulture", weight: 11 },
          { prototypeId: "beast-bristlemaw", weight: 9 },
          { prototypeId: "human-road-rogue", weight: 8 },
          { prototypeId: "aberrant-spore-drone", weight: 8 },
          { prototypeId: "aberrant-venom-howler", weight: 5 },
          { prototypeId: "aberrant-carrion-seer", weight: 3 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "mw-toxic-abyss-nest",
        name: "毒渊巢穴",
        entityType: "巨型巢穴",
        x: 84,
        y: 33,
        archetype: "BL1",
        faction: "Beast",
        environment: "毒渊持续孵化高危异兽，是南境污染源核心。",
        stayBuff: "驻留加成：异兽遭遇率 +14%",
        prosperity: -166,
        strengthMultiplier: 1.08,
        battleConfig: battleConfig(
          [
            { prototypeId: "aberrant-spore-drone", weight: 8 },
            { prototypeId: "aberrant-venom-howler", weight: 10 },
            { prototypeId: "aberrant-chitin-guardian", weight: 9 },
            { prototypeId: "aberrant-mire-screamer", weight: 8 },
            { prototypeId: "aberrant-carrion-seer", weight: 6 },
            { prototypeId: "aberrant-mutant-behemoth", weight: 4 },
            { prototypeId: "aberrant-plague-harbinger", weight: 3 },
            { prototypeId: "aberrant-void-hydra", weight: 1 },
            { prototypeId: "beast-mire-vulture", weight: 6 },
            { prototypeId: "beast-tidefang-lord", weight: 2 }
          ],
          CORE_COUNT_DISTRIBUTION
        )
      },
      {
        id: "mw-lost-temple",
        name: "失落神庙",
        entityType: "古代遗迹",
        x: 76,
        y: 50,
        archetype: "BL2",
        faction: "Beast",
        environment: "古庙结界破碎后，亡灵与异兽共同盘踞。",
        stayBuff: "驻留加成：法术穿透 +5%",
        prosperity: -114,
        battleConfig: battleConfig([
          { prototypeId: "undead-ritual-adept", weight: 10 },
          { prototypeId: "undead-bone-guard", weight: 9 },
          { prototypeId: "undead-grave-warden", weight: 5 },
          { prototypeId: "undead-abyss-liturgist", weight: 3 },
          { prototypeId: "aberrant-carrion-seer", weight: 7 },
          { prototypeId: "aberrant-chitin-guardian", weight: 6 },
          { prototypeId: "aberrant-spore-drone", weight: 7 },
          { prototypeId: "human-gloom-inquisitor", weight: 3 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "mw-mirefang-brood",
        name: "雾鳞孵化池",
        entityType: "孵化池",
        x: 84,
        y: 63,
        archetype: "BL3",
        faction: "Beast",
        environment: "孵化池边缘常见高速游猎群巡游。",
        stayBuff: "驻留加成：速度 +6%",
        prosperity: -84,
        battleConfig: battleConfig([
          { prototypeId: "beast-mire-vulture", weight: 12 },
          { prototypeId: "beast-rift-stalker", weight: 10 },
          { prototypeId: "beast-bristlemaw", weight: 8 },
          { prototypeId: "aberrant-spore-drone", weight: 9 },
          { prototypeId: "aberrant-venom-howler", weight: 6 },
          { prototypeId: "aberrant-mire-screamer", weight: 4 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "mw-whispering-pool",
        name: "低语泥潭",
        entityType: "泥潭",
        x: 74,
        y: 72,
        archetype: "BL2",
        faction: "Beast",
        environment: "低语声会诱发混乱与幻觉，秩序场衰减明显。",
        stayBuff: "驻留加成：持续伤害 +7%",
        prosperity: -102,
        battleConfig: battleConfig([
          { prototypeId: "aberrant-spore-drone", weight: 9 },
          { prototypeId: "aberrant-venom-howler", weight: 8 },
          { prototypeId: "aberrant-carrion-seer", weight: 5 },
          { prototypeId: "human-road-rogue", weight: 8 },
          { prototypeId: "human-gloom-inquisitor", weight: 6 },
          { prototypeId: "human-sanctum-arcanist", weight: 4 },
          { prototypeId: "undead-plague-hound", weight: 5 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "mw-rotroot-mangrove",
        name: "腐根红树林",
        entityType: "腐根湿林",
        x: 89,
        y: 77,
        archetype: "BL3",
        faction: "Beast",
        environment: "红树根系吸附污染泥浆，形成多族混居的伏击带。",
        stayBuff: "驻留加成：受治疗效果 -5%",
        prosperity: -80,
        battleConfig: battleConfig([
          { prototypeId: "beast-rift-stalker", weight: 11 },
          { prototypeId: "beast-mire-vulture", weight: 10 },
          { prototypeId: "human-road-rogue", weight: 8 },
          { prototypeId: "undead-plague-hound", weight: 6 },
          { prototypeId: "aberrant-spore-drone", weight: 8 },
          { prototypeId: "aberrant-venom-howler", weight: 6 },
          { prototypeId: "aberrant-carrion-seer", weight: 4 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "mw-sunken-islet",
        name: "沉木孤岛",
        entityType: "孤岛",
        x: 67,
        y: 86,
        archetype: "NOD",
        state: "inactive",
        faction: "Neutral",
        environment: "孤岛设施已废弃，尚未具备稳定开发条件。",
        stayBuff: "驻留加成：无",
        prosperity: 0
      }
    ],
    edges: [
      { from: "mw-emerald-heart", to: "mw-alchemist-vault" },
      { from: "mw-emerald-heart", to: "mw-marsh-lighthouse" },
      { from: "mw-emerald-heart", to: "mw-reedwatch-post" },
      { from: "mw-pearl-haven", to: "mw-sunken-shipyard" },
      { from: "mw-pearl-haven", to: "mw-herbal-bazaar" },
      { from: "mw-pearl-haven", to: "mw-mudway-station" },
      { from: "mw-alchemist-vault", to: "mw-marsh-lighthouse" },
      { from: "mw-alchemist-vault", to: "mw-serpentine-altar" },
      { from: "mw-alchemist-vault", to: "mw-herbal-bazaar" },
      { from: "mw-marsh-lighthouse", to: "mw-rainwatch-tower" },
      { from: "mw-marsh-lighthouse", to: "mw-reedwatch-post" },
      { from: "mw-sunken-shipyard", to: "mw-herbal-bazaar" },
      { from: "mw-sunken-shipyard", to: "mw-mudway-station" },
      { from: "mw-sunken-shipyard", to: "mw-fog-lantern-post" },
      { from: "mw-serpentine-altar", to: "mw-rainwatch-tower" },
      { from: "mw-serpentine-altar", to: "mw-reedwatch-post" },
      { from: "mw-herbal-bazaar", to: "mw-rainwatch-tower" },
      { from: "mw-herbal-bazaar", to: "mw-mudway-station" },
      { from: "mw-rainwatch-tower", to: "mw-reedwatch-post" },
      { from: "mw-rainwatch-tower", to: "mw-fog-lantern-post" },
      { from: "mw-mudway-station", to: "mw-fog-lantern-post" },
      { from: "mw-reedwatch-post", to: "mw-toxic-abyss-nest" },
      { from: "mw-reedwatch-post", to: "mw-lost-temple" },
      { from: "mw-fog-lantern-post", to: "mw-lost-temple" },
      { from: "mw-fog-lantern-post", to: "mw-whispering-pool" },
      { from: "mw-toxic-abyss-nest", to: "mw-lost-temple" },
      { from: "mw-toxic-abyss-nest", to: "mw-whispering-pool" },
      { from: "mw-lost-temple", to: "mw-mirefang-brood" },
      { from: "mw-lost-temple", to: "mw-whispering-pool" },
      { from: "mw-mirefang-brood", to: "mw-whispering-pool" },
      { from: "mw-mirefang-brood", to: "mw-rotroot-mangrove" },
      { from: "mw-whispering-pool", to: "mw-rotroot-mangrove" },
      { from: "mw-mudway-station", to: "mw-sunken-islet" },
      { from: "mw-fog-lantern-post", to: "mw-sunken-islet" },
      { from: "mw-mirefang-brood", to: "mw-sunken-islet" },
      { from: "mw-rotroot-mangrove", to: "mw-sunken-islet" }
    ]
  },
  "silvergrain-meadows": {
    id: "silvergrain-meadows",
    mapSuppression: 58,
    maxRadius: 5,
    nodes: [
      {
        id: "sg-sunward-keep",
        name: "向阳城堡",
        entityType: "主城",
        x: 18,
        y: 42,
        archetype: "ST1",
        faction: "Human",
        environment: "粮道与驻防骑士团维系了西部平原的秩序轴心。",
        stayBuff: "驻留加成：全队生命上限 +5%",
        prosperity: 182,
        strengthMultiplier: 1.14
      },
      {
        id: "sg-silvergrain-town",
        name: "银穗镇",
        entityType: "产粮重镇",
        x: 24,
        y: 68,
        archetype: "ST1",
        faction: "Human",
        environment: "稳定粮仓和农具工坊保障了前线补给。",
        stayBuff: "驻留加成：消耗品收益 +7%",
        prosperity: 154,
        strengthMultiplier: 1.1
      },
      {
        id: "sg-granary-ring",
        name: "环谷粮仓群",
        entityType: "粮仓区",
        x: 35,
        y: 33,
        archetype: "ST2",
        faction: "Human",
        environment: "环形粮仓带可在灾季维持三个月军粮储备。",
        stayBuff: "驻留加成：战后恢复 +5%",
        prosperity: 112,
        strengthMultiplier: 1.03
      },
      {
        id: "sg-river-toll",
        name: "河税关",
        entityType: "关税驿站",
        x: 36,
        y: 52,
        archetype: "ST2",
        faction: "Human",
        environment: "河道税关维持商路秩序并筛查走私团。",
        stayBuff: "驻留加成：金币收益 +6%",
        prosperity: 98,
        strengthMultiplier: 1.01
      },
      {
        id: "sg-order-shrine",
        name: "秩序小圣堂",
        entityType: "圣堂",
        x: 45,
        y: 43,
        archetype: "ST2",
        faction: "Human",
        environment: "祷告巡礼与净化仪式压低了周边污染浓度。",
        stayBuff: "驻留加成：异常抗性 +6%",
        prosperity: 104,
        strengthMultiplier: 1.02
      },
      {
        id: "sg-windmill-step",
        name: "风车阶田",
        entityType: "农作区",
        x: 46,
        y: 63,
        archetype: "ST2",
        faction: "Human",
        environment: "阶田风车带稳定产出谷物与饲草。",
        stayBuff: "驻留加成：基础材料获取 +10%",
        prosperity: 92,
        strengthMultiplier: 1
      },
      {
        id: "sg-courier-yard",
        name: "信使总驿",
        entityType: "驿站",
        x: 55,
        y: 55,
        archetype: "ST2",
        faction: "Human",
        environment: "跨区信使与补给车队在此汇流中转。",
        stayBuff: "驻留加成：侦察速度 +6%",
        prosperity: 84,
        strengthMultiplier: 0.99
      },
      {
        id: "sg-east-farmwatch",
        name: "东垄望台",
        entityType: "农垄前哨",
        x: 61,
        y: 74,
        archetype: "ST3",
        faction: "Human",
        environment: "前哨负责监控田垄边界与难民转运通道。",
        stayBuff: "驻留加成：战后情报收益 +4%",
        prosperity: 30,
        strengthMultiplier: 0.94
      },
      {
        id: "sg-thornreed-gully",
        name: "刺苇沟地",
        entityType: "沟谷",
        x: 78,
        y: 44,
        archetype: "BL3",
        faction: "Beast",
        environment: "刺苇沟谷常有小型兽群与流亡盗匪伏击。",
        stayBuff: "驻留加成：暴击率 +4%",
        prosperity: -78,
        battleConfig: battleConfig([
          { prototypeId: "beast-razorwolf", weight: 16 },
          { prototypeId: "beast-bristlemaw", weight: 12 },
          { prototypeId: "beast-rift-stalker", weight: 10 },
          { prototypeId: "human-road-rogue", weight: 10 },
          { prototypeId: "human-crossbow-hunter", weight: 7 },
          { prototypeId: "aberrant-spore-drone", weight: 6 },
          { prototypeId: "aberrant-venom-howler", weight: 3 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "sg-nightjack-scrub",
        name: "夜豺灌丛",
        entityType: "灌丛",
        x: 82,
        y: 68,
        archetype: "BL3",
        faction: "Beast",
        environment: "夜行豺群在灌丛带游猎，常与边境巡队短兵相接。",
        stayBuff: "驻留加成：闪避 +4%",
        prosperity: -86,
        battleConfig: battleConfig([
          { prototypeId: "beast-razorwolf", weight: 15 },
          { prototypeId: "beast-ironboar", weight: 11 },
          { prototypeId: "beast-mire-vulture", weight: 9 },
          { prototypeId: "human-road-rogue", weight: 8 },
          { prototypeId: "aberrant-spore-drone", weight: 7 },
          { prototypeId: "aberrant-venom-howler", weight: 4 },
          { prototypeId: "undead-plague-hound", weight: 4 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "sg-ashtrail-encampment",
        name: "灰径营地",
        entityType: "污染营地",
        x: 88,
        y: 55,
        archetype: "BL2",
        faction: "Beast",
        environment: "污染迁徙者与异兽混居，区域秩序频繁波动。",
        stayBuff: "驻留加成：持续伤害 +6%",
        prosperity: -116,
        battleConfig: battleConfig([
          { prototypeId: "beast-rift-stalker", weight: 12 },
          { prototypeId: "beast-thunder-antler", weight: 8 },
          { prototypeId: "human-border-lancer", weight: 9 },
          { prototypeId: "human-gloom-inquisitor", weight: 6 },
          { prototypeId: "aberrant-venom-howler", weight: 7 },
          { prototypeId: "aberrant-chitin-guardian", weight: 5 },
          { prototypeId: "aberrant-mire-screamer", weight: 4 },
          { prototypeId: "beast-tidefang-lord", weight: 2 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "sg-old-irrigation-works",
        name: "旧灌渠机栈",
        entityType: "资源点",
        x: 69,
        y: 86,
        archetype: "NOD",
        state: "inactive",
        faction: "Neutral",
        environment: "废弃机栈可改造为农水资源点，但当前仍受泥疫影响。",
        stayBuff: "驻留加成：无",
        prosperity: 0
      }
    ],
    edges: [
      { from: "sg-sunward-keep", to: "sg-granary-ring" },
      { from: "sg-sunward-keep", to: "sg-river-toll" },
      { from: "sg-sunward-keep", to: "sg-order-shrine" },
      { from: "sg-silvergrain-town", to: "sg-river-toll" },
      { from: "sg-silvergrain-town", to: "sg-windmill-step" },
      { from: "sg-silvergrain-town", to: "sg-courier-yard" },
      { from: "sg-granary-ring", to: "sg-river-toll" },
      { from: "sg-granary-ring", to: "sg-order-shrine" },
      { from: "sg-river-toll", to: "sg-order-shrine" },
      { from: "sg-river-toll", to: "sg-courier-yard" },
      { from: "sg-river-toll", to: "sg-windmill-step" },
      { from: "sg-order-shrine", to: "sg-courier-yard" },
      { from: "sg-order-shrine", to: "sg-thornreed-gully" },
      { from: "sg-windmill-step", to: "sg-courier-yard" },
      { from: "sg-windmill-step", to: "sg-east-farmwatch" },
      { from: "sg-courier-yard", to: "sg-east-farmwatch" },
      { from: "sg-courier-yard", to: "sg-thornreed-gully" },
      { from: "sg-courier-yard", to: "sg-nightjack-scrub" },
      { from: "sg-east-farmwatch", to: "sg-nightjack-scrub" },
      { from: "sg-east-farmwatch", to: "sg-old-irrigation-works" },
      { from: "sg-thornreed-gully", to: "sg-nightjack-scrub" },
      { from: "sg-thornreed-gully", to: "sg-ashtrail-encampment" },
      { from: "sg-nightjack-scrub", to: "sg-ashtrail-encampment" },
      { from: "sg-nightjack-scrub", to: "sg-old-irrigation-works" },
      { from: "sg-ashtrail-encampment", to: "sg-old-irrigation-works" }
    ]
  },
  "blightfang-outerreach": {
    id: "blightfang-outerreach",
    mapSuppression: 34,
    maxRadius: 5,
    nodes: [
      {
        id: "bo-lastlight-bastion",
        name: "余烬堡垒",
        entityType: "要塞主城",
        x: 15,
        y: 40,
        archetype: "ST1",
        faction: "Human",
        environment: "边境最后的大型堡垒，维系着零散据点的补给线。",
        stayBuff: "驻留加成：前排减伤 +5%",
        prosperity: 138,
        strengthMultiplier: 1.1
      },
      {
        id: "bo-refuge-wharf",
        name: "避难船坞",
        entityType: "难民船坞",
        x: 23,
        y: 68,
        archetype: "ST2",
        faction: "Human",
        environment: "难民转运与水路补给在此汇集，治安压力极高。",
        stayBuff: "驻留加成：队伍恢复 +4%",
        prosperity: 78,
        strengthMultiplier: 0.98
      },
      {
        id: "bo-iron-ration-mill",
        name: "铁粮磨坊",
        entityType: "军需工坊",
        x: 33,
        y: 52,
        archetype: "ST2",
        faction: "Human",
        environment: "磨坊仍可维持基础军粮加工，但外圈已长期受袭扰。",
        stayBuff: "驻留加成：消耗品收益 +6%",
        prosperity: 72,
        strengthMultiplier: 0.97
      },
      {
        id: "bo-prayer-redoubt",
        name: "祷誓棱堡",
        entityType: "棱堡",
        x: 42,
        y: 36,
        archetype: "ST2",
        faction: "Human",
        environment: "棱堡结界仍在运行，但净化覆盖范围持续收缩。",
        stayBuff: "驻留加成：异常抗性 +5%",
        prosperity: 68,
        strengthMultiplier: 0.96
      },
      {
        id: "bo-cracked-watch",
        name: "裂垣瞭望塔",
        entityType: "瞭望塔",
        x: 52,
        y: 30,
        archetype: "ST3",
        faction: "Human",
        environment: "破损瞭望塔是最前沿预警点，守军轮换频繁。",
        stayBuff: "驻留加成：侦察速度 +5%",
        prosperity: 18,
        strengthMultiplier: 0.91
      },
      {
        id: "bo-dust-gate-camp",
        name: "尘门营地",
        entityType: "边境营地",
        x: 55,
        y: 58,
        archetype: "ST3",
        faction: "Human",
        environment: "尘门营地负责截断污染迁徙通道，战损率长期偏高。",
        stayBuff: "驻留加成：暴击抵抗 +4%",
        prosperity: 12,
        strengthMultiplier: 0.9
      },
      {
        id: "bo-mire-scout-post",
        name: "泥沼侦巡点",
        entityType: "侦巡前哨",
        x: 60,
        y: 77,
        archetype: "ST3",
        faction: "Human",
        environment: "侦巡点仅能维持最低限度巡逻，补给常被切断。",
        stayBuff: "驻留加成：移动恢复 +4%",
        prosperity: 8,
        strengthMultiplier: 0.88
      },
      {
        id: "bo-scatterhive-cut",
        name: "散巢裂口",
        entityType: "裂口带",
        x: 70,
        y: 26,
        archetype: "BL3",
        faction: "Beast",
        environment: "裂口带不断孵化低中阶异兽，夜间活性显著增强。",
        stayBuff: "驻留加成：速度 +5%",
        prosperity: -84,
        battleConfig: battleConfig([
          { prototypeId: "beast-rift-stalker", weight: 12 },
          { prototypeId: "beast-razorwolf", weight: 12 },
          { prototypeId: "beast-bristlemaw", weight: 9 },
          { prototypeId: "aberrant-spore-drone", weight: 9 },
          { prototypeId: "aberrant-venom-howler", weight: 6 },
          { prototypeId: "undead-crypt-howler", weight: 5 },
          { prototypeId: "human-road-rogue", weight: 6 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "bo-sablefang-trench",
        name: "玄牙壕沟",
        entityType: "壕沟",
        x: 74,
        y: 42,
        archetype: "BL2",
        faction: "Beast",
        environment: "壕沟交错地带聚集大量混编猎群，战斗持续不断。",
        stayBuff: "驻留加成：近战伤害 +6%",
        prosperity: -118,
        battleConfig: battleConfig([
          { prototypeId: "beast-thunder-antler", weight: 8 },
          { prototypeId: "beast-ironboar", weight: 10 },
          { prototypeId: "undead-plague-hound", weight: 9 },
          { prototypeId: "undead-grave-warden", weight: 6 },
          { prototypeId: "aberrant-venom-howler", weight: 8 },
          { prototypeId: "aberrant-chitin-guardian", weight: 6 },
          { prototypeId: "human-gloom-inquisitor", weight: 6 },
          { prototypeId: "aberrant-mire-screamer", weight: 4 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "bo-gravehail-pit",
        name: "葬霜坑穴",
        entityType: "坑穴",
        x: 78,
        y: 57,
        archetype: "BL2",
        faction: "Beast",
        environment: "低温死气与污染孢雾叠加，亡灵与异兽密集混居。",
        stayBuff: "驻留加成：异常命中 +6%",
        prosperity: -124,
        battleConfig: battleConfig([
          { prototypeId: "undead-bone-guard", weight: 11 },
          { prototypeId: "undead-ritual-adept", weight: 9 },
          { prototypeId: "undead-abyss-liturgist", weight: 4 },
          { prototypeId: "aberrant-carrion-seer", weight: 8 },
          { prototypeId: "aberrant-chitin-guardian", weight: 6 },
          { prototypeId: "aberrant-venom-howler", weight: 7 },
          { prototypeId: "beast-rift-stalker", weight: 7 },
          { prototypeId: "human-crowned-executor", weight: 1 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "bo-dreadsalt-marsh",
        name: "惧盐沼滩",
        entityType: "沼滩",
        x: 71,
        y: 72,
        archetype: "BL3",
        faction: "Beast",
        environment: "盐沼滩反复涨落，游猎群会在浅滩伏击落单队伍。",
        stayBuff: "驻留加成：受治疗效果 -4%",
        prosperity: -92,
        battleConfig: battleConfig([
          { prototypeId: "beast-mire-vulture", weight: 13 },
          { prototypeId: "beast-rift-stalker", weight: 10 },
          { prototypeId: "undead-plague-hound", weight: 7 },
          { prototypeId: "aberrant-spore-drone", weight: 9 },
          { prototypeId: "aberrant-venom-howler", weight: 6 },
          { prototypeId: "human-road-rogue", weight: 6 },
          { prototypeId: "aberrant-carrion-seer", weight: 3 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "bo-plaguebone-yard",
        name: "疫骨弃场",
        entityType: "弃场",
        x: 83,
        y: 81,
        archetype: "BL2",
        faction: "Beast",
        environment: "弃场中堆积的疫骨会吸引高侵略性异化群。",
        stayBuff: "驻留加成：持续伤害 +7%",
        prosperity: -132,
        battleConfig: battleConfig([
          { prototypeId: "undead-plague-hound", weight: 11 },
          { prototypeId: "undead-grave-warden", weight: 7 },
          { prototypeId: "aberrant-mire-screamer", weight: 8 },
          { prototypeId: "aberrant-carrion-seer", weight: 7 },
          { prototypeId: "aberrant-mutant-behemoth", weight: 3 },
          { prototypeId: "beast-ashen-behemoth", weight: 3 },
          { prototypeId: "human-blacksmith-merc", weight: 4 },
          { prototypeId: "aberrant-plague-harbinger", weight: 2 }
        ], CONTESTED_COUNT_DISTRIBUTION)
      },
      {
        id: "bo-howling-cairn",
        name: "嚎风石冢",
        entityType: "石冢群",
        x: 88,
        y: 46,
        archetype: "BL3",
        faction: "Beast",
        environment: "石冢缝隙中的啸风会诱导污染群快速聚集。",
        stayBuff: "驻留加成：暴击率 +5%",
        prosperity: -98,
        battleConfig: battleConfig([
          { prototypeId: "beast-razorwolf", weight: 11 },
          { prototypeId: "beast-thunder-antler", weight: 8 },
          { prototypeId: "undead-crypt-howler", weight: 8 },
          { prototypeId: "aberrant-venom-howler", weight: 8 },
          { prototypeId: "aberrant-mire-screamer", weight: 6 },
          { prototypeId: "human-border-lancer", weight: 5 },
          { prototypeId: "aberrant-carrion-seer", weight: 4 }
        ], FRONTIER_COUNT_DISTRIBUTION)
      },
      {
        id: "bo-voidmaw-throne",
        name: "虚喉王座",
        entityType: "灾厄源巢",
        x: 87,
        y: 28,
        archetype: "BL1",
        faction: "Beast",
        environment: "虚喉源巢持续喷发污染团块，是外域北线核心灾源。",
        stayBuff: "驻留加成：高阶异兽遭遇率 +14%",
        prosperity: -188,
        strengthMultiplier: 1.1,
        battleConfig: battleConfig(
          [
            { prototypeId: "aberrant-chitin-guardian", weight: 8 },
            { prototypeId: "aberrant-mire-screamer", weight: 8 },
            { prototypeId: "aberrant-carrion-seer", weight: 7 },
            { prototypeId: "aberrant-mutant-behemoth", weight: 5 },
            { prototypeId: "aberrant-plague-harbinger", weight: 4 },
            { prototypeId: "aberrant-void-hydra", weight: 2 },
            { prototypeId: "undead-throne-revenant", weight: 2 },
            { prototypeId: "human-crowned-executor", weight: 1 },
            { prototypeId: "beast-ashen-behemoth", weight: 4 }
          ],
          CORE_COUNT_DISTRIBUTION
        )
      },
      {
        id: "bo-rotking-basin",
        name: "腐王凹盆",
        entityType: "腐化盆地",
        x: 90,
        y: 66,
        archetype: "BL1",
        faction: "Beast",
        environment: "盆地深处汇聚的腐化泥浆不断孕育高阶异兽。",
        stayBuff: "驻留加成：稀有材料掉率 +10%",
        prosperity: -176,
        strengthMultiplier: 1.08,
        battleConfig: battleConfig(
          [
            { prototypeId: "aberrant-venom-howler", weight: 8 },
            { prototypeId: "aberrant-chitin-guardian", weight: 8 },
            { prototypeId: "aberrant-carrion-seer", weight: 7 },
            { prototypeId: "aberrant-mutant-behemoth", weight: 5 },
            { prototypeId: "aberrant-plague-harbinger", weight: 4 },
            { prototypeId: "aberrant-void-hydra", weight: 2 },
            { prototypeId: "beast-tidefang-lord", weight: 4 },
            { prototypeId: "beast-ashen-behemoth", weight: 3 },
            { prototypeId: "undead-throne-revenant", weight: 1 }
          ],
          CORE_COUNT_DISTRIBUTION
        )
      },
      {
        id: "bo-collapsed-aqueduct",
        name: "坍塌引水渠",
        entityType: "资源点",
        x: 66,
        y: 90,
        archetype: "NOD",
        state: "inactive",
        faction: "Neutral",
        environment: "旧引水渠失修严重，尚无法形成稳定开发点。",
        stayBuff: "驻留加成：无",
        prosperity: 0
      }
    ],
    edges: [
      { from: "bo-lastlight-bastion", to: "bo-iron-ration-mill" },
      { from: "bo-lastlight-bastion", to: "bo-prayer-redoubt" },
      { from: "bo-lastlight-bastion", to: "bo-cracked-watch" },
      { from: "bo-refuge-wharf", to: "bo-iron-ration-mill" },
      { from: "bo-refuge-wharf", to: "bo-dust-gate-camp" },
      { from: "bo-refuge-wharf", to: "bo-mire-scout-post" },
      { from: "bo-iron-ration-mill", to: "bo-prayer-redoubt" },
      { from: "bo-iron-ration-mill", to: "bo-dust-gate-camp" },
      { from: "bo-iron-ration-mill", to: "bo-sablefang-trench" },
      { from: "bo-prayer-redoubt", to: "bo-cracked-watch" },
      { from: "bo-prayer-redoubt", to: "bo-scatterhive-cut" },
      { from: "bo-prayer-redoubt", to: "bo-sablefang-trench" },
      { from: "bo-cracked-watch", to: "bo-scatterhive-cut" },
      { from: "bo-cracked-watch", to: "bo-sablefang-trench" },
      { from: "bo-cracked-watch", to: "bo-voidmaw-throne" },
      { from: "bo-dust-gate-camp", to: "bo-sablefang-trench" },
      { from: "bo-dust-gate-camp", to: "bo-gravehail-pit" },
      { from: "bo-dust-gate-camp", to: "bo-dreadsalt-marsh" },
      { from: "bo-dust-gate-camp", to: "bo-mire-scout-post" },
      { from: "bo-dust-gate-camp", to: "bo-collapsed-aqueduct" },
      { from: "bo-mire-scout-post", to: "bo-dreadsalt-marsh" },
      { from: "bo-mire-scout-post", to: "bo-plaguebone-yard" },
      { from: "bo-mire-scout-post", to: "bo-collapsed-aqueduct" },
      { from: "bo-sablefang-trench", to: "bo-gravehail-pit" },
      { from: "bo-sablefang-trench", to: "bo-howling-cairn" },
      { from: "bo-sablefang-trench", to: "bo-voidmaw-throne" },
      { from: "bo-gravehail-pit", to: "bo-howling-cairn" },
      { from: "bo-gravehail-pit", to: "bo-rotking-basin" },
      { from: "bo-gravehail-pit", to: "bo-dreadsalt-marsh" },
      { from: "bo-howling-cairn", to: "bo-voidmaw-throne" },
      { from: "bo-howling-cairn", to: "bo-rotking-basin" },
      { from: "bo-howling-cairn", to: "bo-plaguebone-yard" },
      { from: "bo-dreadsalt-marsh", to: "bo-plaguebone-yard" },
      { from: "bo-dreadsalt-marsh", to: "bo-rotking-basin" },
      { from: "bo-plaguebone-yard", to: "bo-rotking-basin" },
      { from: "bo-plaguebone-yard", to: "bo-collapsed-aqueduct" }
    ]
  }
};

const fixedRegionIds = new Set(Object.keys(fixedRegions));

const fixedNodeBattleConfigByNodeId = new Map<string, NodeBattleConfig>();
Object.values(fixedRegions).forEach((region) => {
  region.nodes.forEach((node) => {
    if (!node.battleConfig) {
      return;
    }
    fixedNodeBattleConfigByNodeId.set(node.id, {
      enemyPool: node.battleConfig.enemyPool.map((entry) => ({ ...entry })),
      countDistribution: node.battleConfig.countDistribution ? { ...node.battleConfig.countDistribution } : undefined
    });
  });
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

function createEmptyInfluence() {
  return { Human: 0, Beast: 0, Neutral: 0 };
}

function normalizeCountDistribution(distribution?: NodeEnemyCountDistribution): NodeEnemyCountDistribution {
  const source = distribution ?? DEFAULT_COUNT_DISTRIBUTION;
  const min = Math.max(1, Math.floor(Math.min(source.min, source.max)));
  const max = Math.max(min, Math.floor(Math.max(source.min, source.max)));
  const mean = clamp(source.mean, min, max);
  const sigma = Math.max(0.1, source.sigma);
  return { min, max, mean, sigma };
}

function buildNode(regionId: string, definition: FixedNodeDefinition): RegionNode {
  const archetype = definition.archetype;
  const profile = ARCHETYPE_PROFILES[archetype];
  const strengthMultiplier = definition.strengthMultiplier ?? 1;
  const initialStrength = Math.round(profile.initialStrength * strengthMultiplier);
  const baseStrength = initialStrength;
  const state = definition.state ?? "active";

  const node: RegionNode = {
    id: definition.id,
    regionId,
    name: definition.name,
    entityType: definition.entityType || mapArchetypeEntityType(archetype),
    x: Number(definition.x.toFixed(3)),
    y: Number(definition.y.toFixed(3)),
    state,
    archetype,
    faction: definition.faction ?? (archetype.startsWith("BL") ? "Beast" : archetype.startsWith("ST") ? "Human" : "Neutral"),
    environment: definition.environment,
    stayBuff: definition.stayBuff,
    difficulty: mapArchetypeDifficulty(archetype),
    field: {
      orderAura: clamp(0.15 + profile.orderScale, 0.05, 1),
      expansionAura: clamp(0.15 + profile.expansionScale, 0.05, 1),
      pulse: state === "active" ? 0.68 : state === "ghost" ? 0.4 : 0.3
    },
    fog: {
      accumulatedDelta: 0,
      current: state === "inactive" ? 32 : state === "ghost" ? 48 : 140,
      target: 240
    },
    sim: {
      initialStrength,
      baseStrength,
      aggression: Math.round(baseStrength * profile.aggressionScale),
      prosperity: definition.prosperity ?? 0,
      stability: 0,
      chaos: 0,
      totalOrder: 0,
      totalExpansion: 0,
      delta: 0,
      negativeMonths: 0,
      positiveMonths: 0,
      highProsperityMonths: 0,
      developmentMonths: 0,
      orderByFaction: createEmptyInfluence(),
      expansionByFaction: createEmptyInfluence(),
      lastChange: null
    },
    battleConfig: definition.battleConfig
      ? {
          enemyPool: definition.battleConfig.enemyPool.map((entry) => ({ ...entry })),
          countDistribution: normalizeCountDistribution(definition.battleConfig.countDistribution)
        }
      : undefined
  };

  return node;
}

function buildEdge(regionId: string, index: number, edge: FixedEdgeDefinition, nodeById: Record<string, RegionNode>): RegionEdge {
  const fromNode = nodeById[edge.from];
  const toNode = nodeById[edge.to];
  const weight =
    typeof edge.weight === "number" && Number.isFinite(edge.weight)
      ? Math.max(0.01, edge.weight)
      : Number((dist(fromNode.x, fromNode.y, toNode.x, toNode.y) * 1.05).toFixed(3));

  return {
    id: `${regionId}-e${String(index + 1).padStart(2, "0")}`,
    from: edge.from,
    to: edge.to,
    weight,
    fieldFlux: {
      order: Number(((fromNode.field.orderAura + toNode.field.orderAura) / 2).toFixed(3)),
      expansion: Number(((fromNode.field.expansionAura + toNode.field.expansionAura) / 2).toFixed(3))
    }
  };
}

function estimateMapSuppression(nodes: RegionNode[]): number {
  const activeNodes = nodes.filter((node) => node.state === "active");
  const stableCount = activeNodes.filter((node) => node.archetype.startsWith("ST")).length;
  const chaosCount = activeNodes.filter((node) => node.archetype.startsWith("BL")).length;
  const avgProsperity =
    activeNodes.length > 0 ? activeNodes.reduce((sum, node) => sum + node.sim.prosperity, 0) / activeNodes.length : 0;

  const score =
    (stableCount / Math.max(stableCount + chaosCount, 1)) * 72 + clamp(avgProsperity / 16, -18, 18) - chaosCount * 0.7 + 26;

  return Math.round(clamp(score, 0, 100));
}

export function hasFixedRegionTopology(regionId: string): boolean {
  return fixedRegionIds.has(regionId);
}

export function getFixedNodeBattleConfig(nodeId: string): NodeBattleConfig | undefined {
  const config = fixedNodeBattleConfigByNodeId.get(nodeId);
  if (!config) {
    return undefined;
  }

  return {
    enemyPool: config.enemyPool.map((entry) => ({ ...entry })),
    countDistribution: config.countDistribution ? { ...config.countDistribution } : undefined
  };
}

export function createFixedRegionTopology(options: BuildFixedRegionOptions): RegionTopology {
  const definition = fixedRegions[options.regionId];
  if (!definition) {
    throw new Error(`固定地区配置不存在：${options.regionId}`);
  }

  const nodes = definition.nodes.map((node) => buildNode(options.regionId, node));
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const edges = definition.edges.map((edge, index) => buildEdge(options.regionId, index, edge, nodeById));

  const mapSuppression = Number.isFinite(definition.mapSuppression)
    ? Math.round(clamp(definition.mapSuppression, 0, 100))
    : estimateMapSuppression(nodes);

  return {
    id: options.regionId,
    continentId: options.continentId,
    continentName: options.continentName,
    dominionId: options.dominionId,
    dominionName: options.dominionName,
    regionName: options.regionName,
    neighborRegionIds: [...options.neighborRegionIds],
    dominionConfig: {
      ...options.dominionConfig,
      environmentTraits: [...options.dominionConfig.environmentTraits],
      factionWeights: options.dominionConfig.factionWeights.map((item) => ({ ...item })),
      scaleRange: [...options.dominionConfig.scaleRange] as [number, number],
      pathWeightRange: [...options.dominionConfig.pathWeightRange] as [number, number]
    },
    mapSuppression,
    nodes,
    edges,
    currentMonth: 1,
    maxRadius: definition.maxRadius ?? options.dominionConfig.maxRadius,
    lastMonthReport: undefined
  };
}
