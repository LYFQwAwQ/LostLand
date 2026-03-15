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

export interface OrganizationMainQuestDefinition {
  id: string;
  title: string;
  summary: string;
  objective: string;
}

export interface OrganizationMainQuestState extends OrganizationMainQuestDefinition {
  status: OrganizationMainQuestStatus;
}
