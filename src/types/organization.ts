export type OrganizationBuildingCategory = "functional" | "buff";

export interface OrganizationGridCell {
  x: number;
  y: number;
}

export interface OrganizationBuildingDefinition {
  id: string;
  name: string;
  category: OrganizationBuildingCategory;
  shape: OrganizationGridCell[];
  color: string;
  description: string;
  effect: string;
  unique: boolean;
  clickable: boolean;
}

export interface OrganizationBuildingUpgradeMaterialCost {
  materialId: string;
  materialName: string;
  quantity: number;
}

export interface OrganizationBuildingUpgradeStep {
  fromLevel: number;
  toLevel: number;
  effect: string;
  goldCost: number;
  materials: OrganizationBuildingUpgradeMaterialCost[];
}

export interface OrganizationBuildingPlacement {
  instanceId: string;
  definitionId: string;
  origin: OrganizationGridCell;
  level: number;
}

export interface OrganizationRankState {
  rank: number;
  currentExp: number;
  nextRankExp: number;
}

export interface OrganizationPlacementCheckResult {
  ok: boolean;
  reason: string | null;
  cells: OrganizationGridCell[];
}

export interface OrganizationTerritoryExpandResult {
  ok: boolean;
  message: string;
  revealedCount: number;
}

export interface OrganizationTerritoryExpandCheckResult {
  ok: boolean;
  reason: string | null;
  cells: OrganizationGridCell[];
}

export type OrganizationMainQuestStatus = "locked" | "available" | "in_progress" | "completed";

export type OrganizationMainQuestConditionType =
  | "build_material_purchase"
  | "battle_win"
  | "core_upgrade_submit"
  | "building_constructed"
  | "suppression_reached";

export interface OrganizationMainQuestDefinition {
  id: string;
  title: string;
  summary: string;
  objective: string;
  conditionType: OrganizationMainQuestConditionType;
  targetValue: number;
  progressLabel: string;
}

export interface OrganizationMainQuestProgress {
  currentValue: number;
  targetValue: number;
  progressText: string;
  isReached: boolean;
}

export interface OrganizationMainQuestState extends OrganizationMainQuestDefinition {
  status: OrganizationMainQuestStatus;
  progress: OrganizationMainQuestProgress;
}

export interface OrganizationChapterMainlineCounters {
  buildMaterialPurchased: number;
  battleWins: number;
  coreUpgradeSubmitted: number;
  buildingsConstructed: number;
  targetRegionSuppression: number;
}

export interface OrganizationChapterCompletionSummary {
  completedAtWorldMonth: number;
  elapsedMonths: number;
  buildMaterialPurchased: number;
  coreUpgradeSubmitted: number;
  battleWins: number;
  buildingsConstructed: number;
  targetRegionSuppression: number;
}

export type OrganizationChapterFeatureKey =
  | "chapter_map_switch"
  | "node_forge"
  | "organization_build"
  | "organization_advanced";
