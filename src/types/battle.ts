import type { GeneratedEquipment } from "./game";

export type BattleSide = "ally" | "enemy";
export type BattleLine = "front" | "back";
export type BattleDamageType = "physical" | "magic";
export type BattleSkillCategory = "assault" | "defend" | "inspire" | "afflict" | "succor";
export type BattleSkillKind = "active" | "passive" | "talent";
export type BattleLogTone = "system" | "damage" | "heal" | "buff" | "debuff" | "miss" | "drop";

export type BattleElement =
  | "fire"
  | "water"
  | "ice"
  | "wind"
  | "life"
  | "light"
  | "undead"
  | "dark";

export type BattleStatusKey = "frozen" | "stunned" | "poisoned" | "burning" | "guarded" | "weakened";

export type BattleTargetType =
  | "self"
  | "singleEnemy"
  | "allEnemies"
  | "singleAlly"
  | "allAllies"
  | "lowestHpAlly";

export interface BattleFormationSlot {
  line: BattleLine;
  index: 0 | 1 | 2;
}

export interface BattleStatBlock {
  maxHp: number;
  maxMp: number;
  str: number;
  int: number;
  agi: number;
  def: number;
  penetration: number;
  armorPenPct: number;
  critRate: number;
  critDamage: number;
  evasion: number;
  aggro: number;
  lifeSteal: number;
  thorns: number;
  damageBoost: number;
  damageReduction: number;
  elementalPierce: number;
  allRes: number;
  allBoost: number;
  elementBoost: Record<BattleElement, number>;
  elementRes: Record<BattleElement, number>;
}

export type BattleStatFlatKey =
  | "maxHp"
  | "maxMp"
  | "str"
  | "int"
  | "agi"
  | "def"
  | "penetration"
  | "armorPenPct"
  | "critRate"
  | "critDamage"
  | "evasion"
  | "aggro"
  | "lifeSteal"
  | "thorns"
  | "damageBoost"
  | "damageReduction"
  | "elementalPierce"
  | "allRes"
  | "allBoost";

export interface BattleStatModifier {
  flat?: Partial<Record<BattleStatFlatKey, number>>;
  ratio?: Partial<Record<BattleStatFlatKey, number>>;
  elementBoost?: Partial<Record<BattleElement, number>>;
  elementRes?: Partial<Record<BattleElement, number>>;
}

export interface BattleSkillWeightTuning {
  selfHpBelow?: { threshold: number; delta: number };
  allyHpBelow?: { threshold: number; delta: number };
  enemyHpBelow?: { threshold: number; delta: number };
  enemyCountAtLeast?: { count: number; delta: number };
}

export interface BattleStatusApplication {
  key: BattleStatusKey;
  chance: number;
  duration: number;
  potency?: number;
}

export interface BattleSkillScaling {
  str?: number;
  int?: number;
  def?: number;
  maxHp?: number;
  missingHp?: number;
}

export interface BattleActiveSkillDefinition {
  id: string;
  name: string;
  kind: "active";
  category: BattleSkillCategory;
  description: string;
  targetType: BattleTargetType;
  effect: "damage" | "heal";
  damageType?: BattleDamageType;
  element?: BattleElement;
  mpCost: number;
  cooldown: number;
  baseWeight: number;
  basePower: number;
  scaling: BattleSkillScaling;
  canCrit?: boolean;
  hitCount?: number;
  selfStatus?: BattleStatusApplication;
  targetStatus?: BattleStatusApplication;
  actionDeltaSelf?: number;
  actionDeltaTarget?: number;
  weightTuning?: BattleSkillWeightTuning;
}

export interface BattlePassiveSkillDefinition {
  id: string;
  name: string;
  kind: "passive";
  description: string;
  modifiers: BattleStatModifier;
}

export interface BattleTalentDefinition {
  id: string;
  name: string;
  kind: "talent";
  description: string;
  modifiers: BattleStatModifier;
}

export interface BattleLoadout {
  talentSlot: string | null;
  activeSlots: Array<string | null>;
  passiveSlots: Array<string | null>;
}

export interface BattleUnitBaseStats {
  maxHp: number;
  maxMp: number;
  str: number;
  int: number;
  agi: number;
  def: number;
  penetration?: number;
  armorPenPct?: number;
  critRate?: number;
  critDamage?: number;
  evasion?: number;
  aggro?: number;
  lifeSteal?: number;
  thorns?: number;
  damageBoost?: number;
  damageReduction?: number;
  elementalPierce?: number;
  allRes?: number;
  allBoost?: number;
  elementBoost?: Partial<Record<BattleElement, number>>;
  elementRes?: Partial<Record<BattleElement, number>>;
}

export interface BattleUnitTemplate {
  id: string;
  name: string;
  side: BattleSide;
  level: number;
  slot: BattleFormationSlot;
  avatar?: string;
  baseStats: BattleUnitBaseStats;
  loadout: BattleLoadout;
  tags?: string[];
}

export interface BattleStatusInstance {
  id: string;
  key: BattleStatusKey;
  remainingTurns: number;
  potency: number;
  sourceUnitId: string;
}

export interface BattleRuntimeUnit {
  id: string;
  name: string;
  side: BattleSide;
  level: number;
  slot: BattleFormationSlot;
  avatar?: string;
  tags: string[];
  alive: boolean;
  currentHp: number;
  currentMp: number;
  actionValue: number;
  stats: BattleStatBlock;
  loadout: BattleLoadout;
  activeSkillIds: string[];
  passiveSkillIds: string[];
  talentId: string | null;
  cooldowns: Record<string, number>;
  statuses: BattleStatusInstance[];
}

export interface BattleLogEntry {
  id: string;
  timeMs: number;
  tone: BattleLogTone;
  text: string;
}

export interface BattleDropSummary {
  generatedAt: number;
  items: GeneratedEquipment[];
}

export interface BattleRuntimeState {
  battleId: string;
  nodeId: string;
  suppression: number;
  archetype: string;
  status: "idle" | "running" | "finished";
  winner: BattleSide | null;
  elapsedMs: number;
  tickCount: number;
  speedMultiplier: number;
  units: BattleRuntimeUnit[];
  logs: BattleLogEntry[];
  drops: BattleDropSummary | null;
}
