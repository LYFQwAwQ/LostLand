export type HeroClass = "paladin" | "mage" | "ranger" | "priest";

export type HeroTab = "stats" | "gear" | "skills" | "memory";

export type HeroSkillRarity = "common" | "rare" | "epic" | "legendary";

export interface Hero {
  id: string;
  name: string;
  title: string;
  heroClass: HeroClass;
  image: string;
  rarity?: "standard" | "legendary";
  origin?: "fixed" | "generated";
  learnedSkills?: {
    talentIds: string[];
    activeSkillIds: string[];
    passiveSkillIds: string[];
    rarityBySkillId?: Record<string, HeroSkillRarity>;
  };
  loadoutPreset?: {
    talentId: string | null;
    activeSkillIds: string[];
    passiveSkillIds: string[];
  };
  stats: {
    hp: string;
    mp: string;
    str: string;
    int: string;
    agi: string;
    def: string;
  };
}

export type ContinentId = "central" | "north" | "south" | "west" | "east";

export type NodeState = "active" | "inactive" | "ghost";

export type NodeArchetype = "ST1" | "ST2" | "ST3" | "BL1" | "BL2" | "BL3" | "NOD";

export type Faction = "Human" | "Beast" | "Neutral";

export interface FactionWeight {
  faction: Faction;
  weight: number;
}

export type NodeAction =
  | "detail"
  | "shop"
  | "market"
  | "tavern"
  | "forge"
  | "bulletin"
  | "battle"
  | "ritual";

export interface FieldVisualState {
  orderAura: number;
  expansionAura: number;
  pulse: number;
}

export interface FogProgress {
  accumulatedDelta: number;
  current: number;
  target: number;
}

export interface InfluenceBreakdown {
  Human: number;
  Beast: number;
  Neutral: number;
}

export interface NodeSimulationState {
  initialStrength: number;
  baseStrength: number;
  aggression: number;
  prosperity: number;
  stability: number;
  chaos: number;
  totalOrder: number;
  totalExpansion: number;
  delta: number;
  negativeMonths: number;
  positiveMonths: number;
  highProsperityMonths: number;
  developmentMonths: number;
  orderByFaction: InfluenceBreakdown;
  expansionByFaction: InfluenceBreakdown;
  lastChange: string | null;
}

export interface NodeEnemyPoolEntry {
  prototypeId: string;
  weight: number;
}

export interface NodeEnemyCountDistribution {
  min: number;
  max: number;
  mean: number;
  sigma: number;
}

export interface NodeBattleConfig {
  enemyPool: NodeEnemyPoolEntry[];
  countDistribution?: NodeEnemyCountDistribution;
}

export interface RegionNode {
  id: string;
  regionId: string;
  name: string;
  entityType?: string;
  x: number;
  y: number;
  state: NodeState;
  archetype: NodeArchetype;
  faction: Faction;
  environment: string;
  stayBuff: string;
  difficulty: "低" | "中" | "高" | "极高";
  field: FieldVisualState;
  fog: FogProgress;
  sim: NodeSimulationState;
  battleConfig?: NodeBattleConfig;
}

export interface RegionEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  fieldFlux: {
    order: number;
    expansion: number;
  };
}

export type PlaybackStepKey = "gathering" | "delta" | "threshold" | "snapshot";

export interface RegionPlaybackFrame {
  key: PlaybackStepKey;
  title: string;
  description: string;
  highlightNodeIds: string[];
  unstableNodeIds: string[];
  changedNodeIds: string[];
}

export interface RegionMonthReport {
  month: number;
  events: string[];
  suppression: number;
  activeNodes: number;
  inactiveNodes: number;
  ghostNodes: number;
  playback: RegionPlaybackFrame[];
}

export interface DominionStaticConfig {
  environmentTraits: string[];
  factionWeights: FactionWeight[];
  baseRegionScale: number;
  scaleRange: [number, number];
  complexityBase: number;
  complexitySwing: number;
  initialStrongFieldCount: number;
  initEvolutionMonthCap: number;
  weightSwing: number;
  maxRadius: number;
  fullFactionChance: number;
  pathWeightRange: [number, number];
}

export interface RegionTopology {
  id: string;
  continentId: ContinentId;
  continentName: string;
  dominionId: string;
  dominionName: string;
  regionName: string;
  neighborRegionIds: string[];
  dominionConfig: DominionStaticConfig;
  mapSuppression: number;
  nodes: RegionNode[];
  edges: RegionEdge[];
  currentMonth: number;
  maxRadius: number;
  lastMonthReport?: RegionMonthReport;
}

export interface NodeActionMeta {
  key: NodeAction;
  label: string;
  description: string;
}

export type EquipmentSlot =
  | "head"
  | "armor"
  | "oneHand"
  | "twoHand"
  | "bracer"
  | "legs"
  | "shoes"
  | "accessory"
  | "castingMedium"
  | "castingCore";

export type EquipmentSubtype =
  | "heavyHelm"
  | "lightHelm"
  | "lightArmor"
  | "heavyArmor"
  | "robe"
  | "shield"
  | "longSword"
  | "staff"
  | "greatSword"
  | "spear"
  | "plateBracer"
  | "clothBracer"
  | "lightLegGuard"
  | "heavyLegGuard"
  | "clothShoes"
  | "plateBoots"
  | "fireMedium"
  | "frostMedium"
  | "stormMedium"
  | "fireCore"
  | "rangerBoots"
  | "ring"
  | "necklace"
  | "bracelet";

export type EquipmentRank = "crude" | "fine" | "superior" | "perfect";

export type EquipmentQuality = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";

export type EquipmentStatKey =
  | "hp"
  | "mp"
  | "str"
  | "int"
  | "agi"
  | "def"
  | "penetration"
  | "critRate"
  | "critDamage"
  | "evasion"
  | "aggro"
  | "lifeSteal"
  | "thorns"
  | "elementalPierce"
  | "allRes"
  | "allBoost"
  | "armorPiercePct";

export interface EquipmentStatTemplate {
  key: EquipmentStatKey;
  label: string;
  lvl1Base: number;
  growthRate: number;
}

export interface EquipmentAffixTemplate {
  key: EquipmentStatKey;
  label: string;
  min: number;
  max: number;
  weight: number;
}

export interface EquipmentTemplate {
  id: string;
  name: string;
  slot: EquipmentSlot;
  subtype: EquipmentSubtype;
  baseWeight: number;
  t1Stats: EquipmentStatTemplate[];
  rankWeights: Record<EquipmentRank, number>;
  qualityWeights: Record<EquipmentQuality, number>;
  affixPool: EquipmentAffixTemplate[];
}

export interface EquipmentGenerationEnvironment {
  id: string;
  label: string;
  rankWeightMultipliers?: Partial<Record<EquipmentRank, number>>;
  qualityWeightMultipliers?: Partial<Record<EquipmentQuality, number>>;
}

export interface EquipmentGenerationRequest {
  level?: number;
  seed?: number | string;
  source?: string;
  environment?: EquipmentGenerationEnvironment;
}

export interface GeneratedEquipmentStat {
  key: EquipmentStatKey;
  label: string;
  baseValue: number;
  finalValue: number;
}

export interface GeneratedEquipmentAffix {
  key: EquipmentStatKey;
  label: string;
  rolledValue: number;
  finalValue: number;
}

export interface GeneratedEquipment {
  uid: string;
  templateId: string;
  templateName: string;
  slot: EquipmentSlot;
  subtype: EquipmentSubtype;
  level: number;
  rank: EquipmentRank;
  quality: EquipmentQuality;
  rankPercent: number;
  affixCount: number;
  sockets: number;
  t1Stats: GeneratedEquipmentStat[];
  affixes: GeneratedEquipmentAffix[];
  source: string;
  environmentId: string;
}

export interface LegendaryEquipmentSkillDefinition {
  id: string;
  name: string;
  description: string;
}

export interface LegendaryEquipmentFixedStat {
  key: EquipmentStatKey;
  value: number;
}

export interface LegendaryEquipmentDefinition {
  id: string;
  name: string;
  title: string;
  lore: string;
  slot: EquipmentSlot;
  subtype: EquipmentSubtype;
  level: number;
  rank: EquipmentRank;
  quality: EquipmentQuality;
  t1Stats: LegendaryEquipmentFixedStat[];
  affixes: LegendaryEquipmentFixedStat[];
  runeSlotCount: number;
  passiveSkillId: string;
}

export type InventoryResourceRarity = "common" | "uncommon" | "rare" | "epic";

export interface InventoryConsumableStack {
  id: string;
  name: string;
  rarity: InventoryResourceRarity;
  effectSummary: string;
  maxStack: number;
  quantity: number;
  source: string;
}

export interface InventoryMaterialStack {
  id: string;
  name: string;
  rarity: InventoryResourceRarity;
  quantity: number;
  sourceEnemyPrototypeIds: string[];
}

export interface InventoryMemoryStack {
  id: string;
  heroClass: HeroClass;
  title: string;
  quote: string;
  effect: string;
}

export type BulletinMissionType = "collect" | "hunt";

export type BulletinMissionStatus = "available" | "in_progress" | "ready_to_submit" | "completed";

export interface BulletinMissionCollectTarget {
  materialId: string;
  materialName: string;
  rarity: InventoryResourceRarity;
  requiredQuantity: number;
}

export interface BulletinMissionHuntTarget {
  enemyPrototypeId: string;
  enemyName: string;
  requiredCount: number;
}

export interface BulletinMissionRewardMaterial {
  materialId: string;
  materialName: string;
  rarity: InventoryResourceRarity;
  quantity: number;
}

export interface BulletinMissionRewardConsumable {
  consumableId: string;
  consumableName: string;
  rarity: InventoryResourceRarity;
  quantity: number;
}

export interface BulletinMissionReward {
  materials: BulletinMissionRewardMaterial[];
  consumables: BulletinMissionRewardConsumable[];
  bounty: number;
  reputation: number;
}

export interface BulletinMissionProgress {
  materialCounts: Record<string, number>;
  enemyKillCounts: Record<string, number>;
}

export interface BulletinMissionDefinition {
  id: string;
  regionId: string;
  title: string;
  type: BulletinMissionType;
  description: string;
  collectTargets: BulletinMissionCollectTarget[];
  huntTargets: BulletinMissionHuntTarget[];
  sourceNodeIds: string[];
  reward: BulletinMissionReward;
}

export interface BulletinMissionState extends BulletinMissionDefinition {
  status: BulletinMissionStatus;
  progress: BulletinMissionProgress;
  acceptedAtWorldMonth: number | null;
  completedAtWorldMonth: number | null;
}

export interface MissionBattleOutcome {
  regionId: string;
  materialGainCounts: Record<string, number>;
  defeatedEnemyCounts: Record<string, number>;
}
