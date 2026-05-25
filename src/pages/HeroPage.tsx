import { useEffect, useMemo, useState } from "react";
import { User, X, Zap } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MageGearBoard } from "../components/hero/MageGearBoard";
import { PaladinGearBoard } from "../components/hero/PaladinGearBoard";
import { PriestGearBoard } from "../components/hero/PriestGearBoard";
import { RangerGearBoard } from "../components/hero/RangerGearBoard";
import { battleActiveSkills, battlePassiveSkills, battleTalents } from "../data/battleSkills";
import { HERO_PROGRESSION_CONFIG, getHeroNextLevelExp } from "../data/config/heroProgressionConfig";
import { legendaryEquipmentIdByUid } from "../data/legendaryEquipments";
import {
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SUBTYPE_LABELS,
  HERO_EQUIP_TYPE_SUMMARY,
  getPairedPaladinHandSlot,
  getHeroEquipSlots,
  isPaladinHandSlot
} from "../lib/equipmentCatalog";
import { EQUIPMENT_RANK_LABELS, getEquipmentQualityLabel } from "../lib/equipmentSystem";
import {
  getHeroSkillOptions,
  normalizeHeroLoadout,
  parseHeroLoadoutImport,
  serializeHeroLoadout
} from "../lib/battleLoadoutRules";
import { buildAllyTeamTemplates } from "../lib/battleAdapters";
import { useBattleSetup } from "../state/BattleSetupProvider";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { useHeroRoster } from "../state/HeroRosterProvider";
import type { BattleElement, BattleLoadout, BattleStatBlock, BattleStatModifier, BattleStatFlatKey, BattleTalentRarity } from "../types/battle";
import type {
  EquipmentSlot,
  EquipmentStatKey,
  GeneratedEquipment,
  Hero,
  HeroSkillRarity,
  HeroTab,
  InventoryMemoryStack
} from "../types/game";

interface ElementRow {
  id: BattleElement;
  label: string;
  color: string;
}

const elements: ElementRow[] = [
  { id: "fire", label: "火焰", color: "#ef4444" },
  { id: "water", label: "流水", color: "#3b82f6" },
  { id: "ice", label: "寒冰", color: "#60a5fa" },
  { id: "wind", label: "疾风", color: "#10b981" },
  { id: "life", label: "生命", color: "#22c55e" },
  { id: "light", label: "光明", color: "#fbbf24" },
  { id: "undead", label: "亡灵", color: "#a855f7" },
  { id: "dark", label: "暗影", color: "#6b7280" }
];

type StatsViewMode = "origin" | "battle";

const BATTLE_ELEMENTS: BattleElement[] = ["fire", "water", "ice", "wind", "life", "light", "undead", "dark"];
const EVA_CAP = 0.5;
const MULTIPLICATIVE_MODIFIER_KEYS = new Set<BattleStatFlatKey>([
  "maxHp",
  "maxMp",
  "str",
  "int",
  "agi",
  "physicalDefense",
  "magicDefense"
]);

const qualityOrder = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5
} as const;

const rankOrder = {
  crude: 0,
  fine: 1,
  superior: 2,
  perfect: 3
} as const;

const TALENT_RARITY_LABELS: Record<BattleTalentRarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
  unique: "独特"
};

const HERO_SKILL_RARITY_LABELS: Record<HeroSkillRarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说"
};


function formatModifierValue(value: number): string {
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
  }
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

function summarizeModifier(modifiers: BattleStatModifier): string[] {
  const lines: string[] = [];
  if (modifiers.flat) {
    Object.entries(modifiers.flat).forEach(([key, value]) => {
      if (typeof value === "number") {
        lines.push(`${key} ${formatModifierValue(value)}`);
      }
    });
  }
  if (modifiers.ratio) {
    Object.entries(modifiers.ratio).forEach(([key, value]) => {
      if (typeof value === "number") {
        lines.push(`${key} ${formatModifierValue(value)}`);
      }
    });
  }
  if (modifiers.elementBoost) {
    Object.entries(modifiers.elementBoost).forEach(([key, value]) => {
      if (typeof value === "number") {
        lines.push(`${key}Boost ${formatModifierValue(value)}`);
      }
    });
  }
  if (modifiers.elementRes) {
    Object.entries(modifiers.elementRes).forEach(([key, value]) => {
      if (typeof value === "number") {
        lines.push(`${key}Res ${formatModifierValue(value)}`);
      }
    });
  }
  return lines;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createElementRecord(initial = 0): Record<BattleElement, number> {
  return {
    fire: initial,
    water: initial,
    ice: initial,
    wind: initial,
    life: initial,
    light: initial,
    undead: initial,
    dark: initial
  };
}

type BattleStatPreviewInput = Omit<Partial<BattleStatBlock>, "elementBoost" | "elementRes"> & {
  elementBoost?: Partial<Record<BattleElement, number>>;
  elementRes?: Partial<Record<BattleElement, number>>;
};

function buildBattleStatBlock(baseStats: BattleStatPreviewInput | null | undefined): BattleStatBlock {
  return {
    maxHp: Math.max(1, Math.round(baseStats?.maxHp ?? 1)),
    maxMp: Math.max(0, Math.round(baseStats?.maxMp ?? 0)),
    str: Math.max(0, Math.round(baseStats?.str ?? 0)),
    int: Math.max(0, Math.round(baseStats?.int ?? 0)),
    agi: Math.max(1, Math.round(baseStats?.agi ?? 1)),
    physicalDefense: Math.max(0, Math.round(baseStats?.physicalDefense ?? 0)),
    magicDefense: Math.max(0, Math.round(baseStats?.magicDefense ?? 0)),
    physicalPenetration: Math.max(0, Math.round(baseStats?.physicalPenetration ?? 0)),
    magicPenetration: Math.max(0, Math.round(baseStats?.magicPenetration ?? 0)),
    physicalPenPct: clamp(baseStats?.physicalPenPct ?? 0, 0, 0.95),
    magicPenPct: clamp(baseStats?.magicPenPct ?? 0, 0, 0.95),
    critRate: clamp(baseStats?.critRate ?? 0.05, 0, 0.95),
    critDamage: Math.max(1.2, baseStats?.critDamage ?? 1.5),
    evasion: clamp(baseStats?.evasion ?? 0.02, 0, EVA_CAP),
    aggro: Math.max(1, Math.round(baseStats?.aggro ?? 50)),
    lifeSteal: clamp(baseStats?.lifeSteal ?? 0, 0, 0.95),
    thorns: clamp(baseStats?.thorns ?? 0, 0, 0.95),
    physicalDamageBoost: baseStats?.physicalDamageBoost ?? 0,
    magicDamageBoost: baseStats?.magicDamageBoost ?? 0,
    elementalDamageBoost: baseStats?.elementalDamageBoost ?? baseStats?.allBoost ?? 0,
    damageBoost: baseStats?.damageBoost ?? 0,
    damageReduction: baseStats?.damageReduction ?? 0,
    elementalPierce: baseStats?.elementalPierce ?? 0,
    allRes: baseStats?.allRes ?? 0,
    allBoost: baseStats?.allBoost ?? 0,
    elementBoost: {
      ...createElementRecord(0),
      ...(baseStats?.elementBoost ?? {})
    },
    elementRes: {
      ...createElementRecord(0),
      ...(baseStats?.elementRes ?? {})
    }
  };
}

function applyStatModifier(stats: BattleStatBlock, modifier: BattleStatModifier): BattleStatBlock {
  const next: BattleStatBlock = {
    ...stats,
    elementBoost: { ...stats.elementBoost },
    elementRes: { ...stats.elementRes }
  };

  if (modifier.flat) {
    (Object.keys(modifier.flat) as BattleStatFlatKey[]).forEach((key) => {
      const value = modifier.flat?.[key];
      if (typeof value === "number") {
        next[key] += value;
      }
    });
  }

  if (modifier.ratio) {
    (Object.keys(modifier.ratio) as BattleStatFlatKey[]).forEach((key) => {
      const ratio = modifier.ratio?.[key];
      if (typeof ratio !== "number") {
        return;
      }
      const prevValue = next[key];
      next[key] = MULTIPLICATIVE_MODIFIER_KEYS.has(key) ? prevValue * (1 + ratio) : prevValue + ratio;
    });
  }

  if (modifier.elementBoost) {
    BATTLE_ELEMENTS.forEach((element) => {
      const value = modifier.elementBoost?.[element];
      if (typeof value === "number") {
        next.elementBoost[element] += value;
      }
    });
  }

  if (modifier.elementRes) {
    BATTLE_ELEMENTS.forEach((element) => {
      const value = modifier.elementRes?.[element];
      if (typeof value === "number") {
        next.elementRes[element] += value;
      }
    });
  }

  next.maxHp = Math.max(1, Math.round(next.maxHp));
  next.maxMp = Math.max(0, Math.round(next.maxMp));
  next.str = Math.max(0, Math.round(next.str));
  next.int = Math.max(0, Math.round(next.int));
  next.agi = Math.max(1, Math.round(next.agi));
  next.physicalDefense = Math.max(0, Math.round(next.physicalDefense));
  next.magicDefense = Math.max(0, Math.round(next.magicDefense));
  next.physicalPenetration = Math.max(0, Math.round(next.physicalPenetration));
  next.magicPenetration = Math.max(0, Math.round(next.magicPenetration));
  next.physicalPenPct = clamp(next.physicalPenPct, 0, 0.95);
  next.magicPenPct = clamp(next.magicPenPct, 0, 0.95);
  next.critRate = clamp(next.critRate, 0, 0.95);
  next.critDamage = Math.max(1, next.critDamage);
  next.evasion = clamp(next.evasion, 0, EVA_CAP);
  next.aggro = Math.max(1, next.aggro);
  next.lifeSteal = clamp(next.lifeSteal, 0, 0.95);
  next.thorns = clamp(next.thorns, 0, 0.95);
  next.physicalDamageBoost = clamp(next.physicalDamageBoost, -0.8, 2);
  next.magicDamageBoost = clamp(next.magicDamageBoost, -0.8, 2);
  next.elementalDamageBoost = clamp(next.elementalDamageBoost, -0.8, 2);
  next.damageReduction = clamp(next.damageReduction, -0.5, 0.9);
  next.damageBoost = clamp(next.damageBoost, -0.8, 2);
  next.elementalPierce = clamp(next.elementalPierce, 0, 0.95);
  next.allRes = clamp(next.allRes, -0.5, 0.95);
  next.allBoost = clamp(next.allBoost, -0.5, 2);
  BATTLE_ELEMENTS.forEach((element) => {
    next.elementBoost[element] = clamp(next.elementBoost[element], -0.5, 2);
    next.elementRes[element] = clamp(next.elementRes[element], -0.8, 0.95);
  });
  return next;
}

function formatPercent(value: number, digits = 1, showSign = false): string {
  const amount = value * 100;
  const prefix = showSign ? (amount >= 0 ? "+" : "") : "";
  return `${prefix}${amount.toFixed(digits)}%`;
}

function formatInteger(value: number): string {
  return `${Math.round(value)}`;
}

function formatGrowthValue(value: number): string {
  const rounded = Number(value.toFixed(2));
  if (Number.isInteger(rounded)) {
    return `+${rounded}`;
  }
  return `+${rounded.toFixed(2)}`;
}

function nextTab(tab: HeroTab): HeroTab {
  if (tab === "stats") {
    return "gear";
  }
  if (tab === "gear") {
    return "skills";
  }
  if (tab === "skills") {
    return "memory";
  }
  return "stats";
}

function formatSignedNumber(value: number): string {
  const normalized = Number(value.toFixed(2));
  if (Number.isInteger(normalized)) {
    return `${normalized >= 0 ? "+" : ""}${normalized}`;
  }
  return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(2)}`;
}

function formatStatValue(value: number): string {
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  if (Number.isInteger(value)) {
    return `${value}`;
  }
  return value.toFixed(2);
}

function buildHoverPanelStyle(
  position: { x: number; y: number } | null,
  panelWidth = 360,
  panelHeight = 430
): { left: string; top: string } | undefined {
  if (!position) {
    return undefined;
  }

  let left = position.x + 18;
  let top = position.y + 18;

  if (typeof window !== "undefined") {
    left = Math.min(left, window.innerWidth - panelWidth - 12);
    top = Math.min(top, window.innerHeight - panelHeight - 12);
  }

  return {
    left: `${Math.max(12, left)}px`,
    top: `${Math.max(12, top)}px`
  };
}

function sumEquipmentStat(items: GeneratedEquipment[], key: EquipmentStatKey): number {
  return items.reduce((sum, item) => {
    const t1 = item.t1Stats.reduce((inner, stat) => (stat.key === key ? inner + stat.finalValue : inner), 0);
    const affix = item.affixes.reduce((inner, stat) => (stat.key === key ? inner + stat.finalValue : inner), 0);
    return sum + t1 + affix;
  }, 0);
}

function resolveSelectableSlots(heroClass: Hero["heroClass"], slotId: string, baseSlot: EquipmentSlot): EquipmentSlot[] {
  if (heroClass === "paladin" && isPaladinHandSlot(slotId) && baseSlot === "oneHand") {
    return ["oneHand", "twoHand"];
  }
  return [baseSlot];
}

function HeroTabButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="hero-section-title">{title}</h3>;
}

function StatRow({
  label,
  value,
  color
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="hero-stat-row">
      <span>{label}</span>
      <strong style={{ color: color ?? "#d7c6b2" }}>{value}</strong>
    </div>
  );
}

function StatTiny({ label, value }: { label: string; value: string }) {
  return (
    <div className="hero-stat-tiny">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HeroStatsContent({
  hero,
  heroLevel,
  heroExp,
  nextLevelExp,
  mode,
  onToggleMode,
  originStats,
  battleStats
}: {
  hero: Hero;
  heroLevel: number;
  heroExp: number;
  nextLevelExp: number;
  mode: StatsViewMode;
  onToggleMode: () => void;
  originStats: BattleStatBlock;
  battleStats: BattleStatBlock;
}) {
  const visibleStats = mode === "origin" ? originStats : battleStats;
  const modeLabel = mode === "origin" ? "原始数值" : "战斗数值";
  const expText = nextLevelExp > 0 ? `${heroExp}/${nextLevelExp}` : "MAX";
  const modeDescription =
    mode === "origin"
      ? "仅显示英雄基础值（不含装备、被动、天赋、记忆）。"
      : "显示进入战斗时结算后的面板值（含装备、被动、天赋；记忆暂未接入数值）。";
  const growthRows = [
    { label: "HP成长", value: formatGrowthValue(hero.statGrowth.hp) },
    { label: "MP成长", value: formatGrowthValue(hero.statGrowth.mp) },
    { label: "STR成长", value: formatGrowthValue(hero.statGrowth.str) },
    { label: "INT成长", value: formatGrowthValue(hero.statGrowth.int) },
    { label: "AGI成长", value: formatGrowthValue(hero.statGrowth.agi) },
    { label: "物防成长", value: formatGrowthValue(hero.statGrowth.def) }
  ];

  const combatRows = [
    { label: "物理防御", value: formatInteger(visibleStats.physicalDefense) },
    { label: "魔法防御", value: formatInteger(visibleStats.magicDefense) },
    { label: "物理穿透", value: formatInteger(visibleStats.physicalPenetration) },
    { label: "魔法穿透", value: formatInteger(visibleStats.magicPenetration) },
    { label: "暴击率", value: formatPercent(visibleStats.critRate) },
    { label: "暴击伤害", value: formatPercent(visibleStats.critDamage) },
    { label: "闪避率", value: formatPercent(visibleStats.evasion) },
    { label: "吸血", value: formatPercent(visibleStats.lifeSteal) },
    { label: "反伤", value: formatPercent(visibleStats.thorns) }
  ];

  const advancedRows = [
    { label: "物理伤害增加", value: formatPercent(visibleStats.physicalDamageBoost) },
    { label: "魔法伤害增加", value: formatPercent(visibleStats.magicDamageBoost) },
    { label: "元素伤害增加", value: formatPercent(visibleStats.elementalDamageBoost) },
    { label: "最终伤害增加", value: formatPercent(visibleStats.damageBoost) },
    { label: "最终伤害减免", value: formatPercent(visibleStats.damageReduction) },
    { label: "元素穿透", value: formatPercent(visibleStats.elementalPierce) },
    { label: "全元素抗性", value: formatPercent(visibleStats.allRes) },
    { label: "物理百分比穿透", value: formatPercent(visibleStats.physicalPenPct) },
    { label: "魔法百分比穿透", value: formatPercent(visibleStats.magicPenPct) }
  ];

  return (
    <div className="hero-stats-view">
      <div className="hero-portrait-card">
        <img src={hero.image} alt={hero.name} />
        <div className="hero-portrait-mask" />
        <div className="hero-portrait-text">
          <h2>{hero.name}</h2>
          <p>{hero.title}</p>
          <small>
            Lv.{heroLevel} · EXP {expText}
          </small>
        </div>
      </div>

      <div className="hero-stats-panel custom-scrollbar">
        <div className="hero-stats-mode-bar">
          <button type="button" className="ghost-btn hero-stats-toggle-btn" onClick={onToggleMode}>
            {mode === "origin" ? "切换为战斗数值" : "切换为原始数值"}
          </button>
          <div className="hero-stats-mode-text">
            <strong>{modeLabel}</strong>
            <span>{modeDescription}</span>
          </div>
          <div className="hero-level-summary">
            <strong>等级 {heroLevel}/{HERO_PROGRESSION_CONFIG.maxLevel}</strong>
            <span>经验 {expText}</span>
          </div>
        </div>

        <div className="hero-stats-grid">
          <section>
            <SectionTitle title="1. 核心属性" />
            <div className="hero-stat-list">
              <StatRow label="生命值 (HP)" value={formatInteger(visibleStats.maxHp)} color="#ef4444" />
              <StatRow label="法力值 (MP)" value={formatInteger(visibleStats.maxMp)} color="#3b82f6" />
              <StatRow label="力量 (STR)" value={formatInteger(visibleStats.str)} />
              <StatRow label="智力 (INT)" value={formatInteger(visibleStats.int)} />
              <StatRow label="敏捷 (AGI)" value={formatInteger(visibleStats.agi)} />
            </div>
          </section>

          <section>
            <SectionTitle title="1.5 每级成长" />
            <div className="hero-combat-grid">
              {growthRows.map((item) => (
                <StatTiny key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </section>

          <section>
            <SectionTitle title="2. 战斗辅助指标" />
            <div className="hero-combat-grid">
              {combatRows.map((item) => (
                <StatTiny key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </section>

          <section className="full-width">
            <SectionTitle title="3. 八大元素体系" />
            <div className="hero-element-grid">
              {elements.map((item) => (
                <article key={item.id} className="hero-element-card">
                  <header style={{ color: item.color }}>
                    <Zap size={13} />
                    <strong>{item.label}</strong>
                  </header>
                  <p>
                    <span>加成</span>
                    <strong>{formatPercent(visibleStats.elementBoost[item.id], 1, true)}</strong>
                  </p>
                  <p>
                    <span>抗性</span>
                    <strong>{formatPercent(visibleStats.elementRes[item.id], 1, true)}</strong>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="full-width">
            <SectionTitle title="4. 高级属性" />
            <div className="hero-advanced-grid">
              {advancedRows.map((item) => (
                <StatTiny key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function HeroSkillLoadoutEditor({
  hero,
  loadout,
  onApplyLoadout,
  onReset
}: {
  hero: Hero;
  loadout: BattleLoadout;
  onApplyLoadout: (nextLoadout: BattleLoadout) => string[];
  onReset: () => void;
}) {
  const skillOptions = useMemo(() => getHeroSkillOptions(hero.heroClass, hero.learnedSkills), [hero.heroClass, hero.learnedSkills]);
  const [hoveredSkill, setHoveredSkill] = useState<{ id: string; x: number; y: number } | null>(null);
  const [importText, setImportText] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "warn" | "error"; text: string } | null>(null);

  useEffect(() => {
    setHoveredSkill(null);
    setImportText("");
    setNotice(null);
  }, [hero.id]);

  const hoveredTalent = hoveredSkill ? battleTalents[hoveredSkill.id] : null;
  const hoveredActive = hoveredSkill ? battleActiveSkills[hoveredSkill.id] : null;
  const hoveredPassive = hoveredSkill ? battlePassiveSkills[hoveredSkill.id] : null;
  const hoveredType = hoveredTalent ? "talent" : hoveredActive ? "active" : hoveredPassive ? "passive" : null;
  const hoveredDesc = hoveredTalent?.description ?? hoveredActive?.description ?? hoveredPassive?.description ?? "";
  const hoveredName = hoveredTalent?.name ?? hoveredActive?.name ?? hoveredPassive?.name ?? "";
  const hoveredSkillRarity = hoveredSkill ? hero.learnedSkills?.rarityBySkillId?.[hoveredSkill.id] ?? null : null;
  const hoveredStyle = useMemo(() => {
    if (!hoveredSkill) {
      return undefined;
    }
    const panelWidth = 350;
    const panelHeight = 320;
    let left = hoveredSkill.x + 16;
    let top = hoveredSkill.y + 16;
    if (typeof window !== "undefined") {
      left = Math.min(left, window.innerWidth - panelWidth - 12);
      top = Math.min(top, window.innerHeight - panelHeight - 12);
    }
    return { left: `${Math.max(10, left)}px`, top: `${Math.max(10, top)}px` };
  }, [hoveredSkill]);

  const hoveredModifierLines = hoveredTalent
    ? summarizeModifier(hoveredTalent.modifiers)
    : hoveredPassive
    ? summarizeModifier(hoveredPassive.modifiers)
    : [];

  const handleSkillHover = (skillId: string | null, x: number, y: number) => {
    if (!skillId) {
      return;
    }
    setHoveredSkill({ id: skillId, x, y });
  };

  const applyAndNotify = (nextLoadout: BattleLoadout, successText?: string) => {
    const issues = onApplyLoadout(nextLoadout);
    if (issues.length > 0) {
      setNotice({ tone: "warn", text: issues[issues.length - 1] });
      return;
    }
    if (successText) {
      setNotice({ tone: "success", text: successText });
    }
  };

  const handleCopyLoadout = async () => {
    const payload = serializeHeroLoadout(hero.id, hero.name, hero.heroClass, loadout);
    try {
      await navigator.clipboard.writeText(payload);
      setNotice({ tone: "success", text: "已复制技能配置，可直接粘贴到导入框或外部文档。" });
    } catch {
      setImportText(payload);
      setNotice({ tone: "warn", text: "复制到剪贴板失败，已把配置文本填入导入框，可手动复制。" });
    }
  };

  const handleImportLoadout = () => {
    try {
      const parsed = parseHeroLoadoutImport(importText);
      const issues = onApplyLoadout(parsed.loadout);
      const metaHint =
        parsed.meta.sourceHeroName && parsed.meta.sourceHeroClass
          ? `来源：${parsed.meta.sourceHeroName}（${parsed.meta.sourceHeroClass}）`
          : null;
      if (issues.length > 0) {
        setNotice({ tone: "warn", text: metaHint ? `${issues[issues.length - 1]} ${metaHint}` : issues[issues.length - 1] });
      } else {
        setNotice({
          tone: "success",
          text: metaHint ? `导入成功，${metaHint}。` : "导入成功，技能配置已生效。"
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败：未知错误。";
      setNotice({ tone: "error", text: message });
    }
  };

  const selectedActiveSkillIds = useMemo(
    () => new Set(loadout.activeSlots.filter((id): id is string => typeof id === "string" && id.length > 0)),
    [loadout.activeSlots]
  );
  const selectedPassiveSkillIds = useMemo(
    () => new Set(loadout.passiveSlots.filter((id): id is string => typeof id === "string" && id.length > 0)),
    [loadout.passiveSlots]
  );
  const currentTalent = loadout.talentSlot ? battleTalents[loadout.talentSlot] ?? null : null;

  return (
    <section className="hero-skill-editor">
      <header className="hero-skill-editor-head">
        <h3>战斗技能配置</h3>
        <p>{hero.name} · 1 天赋 / 10 主动 / 10 被动（仅显示已学技能，重复技能视为冲突）</p>
      </header>

      {notice ? <p className={`hero-skill-editor-notice ${notice.tone}`}>{notice.text}</p> : null}

      <div className="hero-skill-editor-grid">
        <div className="hero-skill-column">
          <h4>天赋槽位</h4>
          {currentTalent ? (
            <article
              className="hero-talent-display-card"
              onMouseEnter={(event) => handleSkillHover(currentTalent.id, event.clientX, event.clientY)}
              onMouseMove={(event) => handleSkillHover(currentTalent.id, event.clientX, event.clientY)}
              onMouseLeave={() => setHoveredSkill(null)}
            >
              <header>
                <strong>{currentTalent.name}</strong>
                <span className={`talent-rarity-badge ${currentTalent.rarity}`}>
                  {TALENT_RARITY_LABELS[currentTalent.rarity]}
                </span>
              </header>
              <p>{currentTalent.description}</p>
              <small>天赋为固定槽位，不可修改。</small>
            </article>
          ) : (
            <p className="hero-skill-talent-lock-tip">当前英雄未配置天赋。</p>
          )}
        </div>

        <div className="hero-skill-column">
          <h4>主动槽位</h4>
          <div className="hero-skill-slot-list custom-scrollbar">
            {loadout.activeSlots.map((skillId, index) => (
              <label key={`active-${index}`} className="hero-skill-select-row">
                <span>A{index + 1}</span>
                <select
                  value={skillId ?? ""}
                  onChange={(event) => {
                    const activeSlots = [...loadout.activeSlots];
                    activeSlots[index] = event.target.value || null;
                    applyAndNotify({ ...loadout, activeSlots }, "已更新主动技能槽位。");
                  }}
                  onMouseEnter={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseMove={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseLeave={() => setHoveredSkill(null)}
                >
                  <option value="">空槽</option>
                  {skillOptions.activeSkills
                    .filter((skill) => skill.id === skillId || !selectedActiveSkillIds.has(skill.id))
                    .map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                    ))}
                </select>
                <small className="hero-skill-weight-tag">
                  W {skillId ? (battleActiveSkills[skillId]?.baseWeight ?? "-") : "-"}
                </small>
              </label>
            ))}
          </div>
        </div>

        <div className="hero-skill-column">
          <h4>被动槽位</h4>
          <div className="hero-skill-slot-list custom-scrollbar">
            {loadout.passiveSlots.map((skillId, index) => (
              <label key={`passive-${index}`} className="hero-skill-select-row">
                <span>P{index + 1}</span>
                <select
                  value={skillId ?? ""}
                  onChange={(event) => {
                    const passiveSlots = [...loadout.passiveSlots];
                    passiveSlots[index] = event.target.value || null;
                    applyAndNotify({ ...loadout, passiveSlots }, "已更新被动技能槽位。");
                  }}
                  onMouseEnter={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseMove={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseLeave={() => setHoveredSkill(null)}
                >
                  <option value="">空槽</option>
                  {skillOptions.passiveSkills
                    .filter((skill) => skill.id === skillId || !selectedPassiveSkillIds.has(skill.id))
                    .map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-skill-editor-actions">
        <button type="button" className="ghost-btn" onClick={handleCopyLoadout}>
          复制配置
        </button>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            onReset();
            setNotice({ tone: "success", text: "已恢复默认技能模板。" });
          }}
        >
          恢复默认技能模板
        </button>
      </div>

      <section className="hero-skill-import-block">
        <h4>导入配置</h4>
        <p>粘贴“复制配置”生成的 JSON 文本，系统会按职业规则自动校验并落盘。</p>
        <textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          placeholder='{"sourceHeroName":"阿瑟","sourceHeroClass":"paladin","loadout":{...}}'
        />
        <div className="hero-skill-import-actions">
          <button type="button" className="ghost-btn" onClick={handleImportLoadout}>
            导入并校验
          </button>
          <button type="button" className="ghost-btn" onClick={() => setImportText("")}>
            清空文本
          </button>
        </div>
      </section>

      {hoveredSkill && hoveredStyle && hoveredType ? (
        <aside className="hero-skill-hover-detail custom-scrollbar" style={hoveredStyle}>
          <header>
            <h4>{hoveredName}</h4>
            <span>{hoveredType.toUpperCase()}</span>
          </header>
          <p>{hoveredDesc}</p>
          {hoveredSkillRarity ? <p>稀有度：{HERO_SKILL_RARITY_LABELS[hoveredSkillRarity]}</p> : null}

          {hoveredActive ? (
            <div className="hero-skill-hover-meta">
              <p>分类：{hoveredActive.category}</p>
              <p>
                MP {hoveredActive.mpCost} · CD {hoveredActive.cooldown} · 权重 {hoveredActive.baseWeight}
              </p>
              <p>基础威力：{hoveredActive.basePower}</p>
            </div>
          ) : null}

          {hoveredModifierLines.length > 0 ? (
            <div className="hero-skill-hover-mods">
              {hoveredModifierLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}

interface HeroGearContentProps {
  hero: Hero;
  heroNameMap: Record<string, string>;
  backpackItems: GeneratedEquipment[];
  backpackMap: Map<string, GeneratedEquipment>;
  selectedSlotByHero: Record<string, string>;
  onSelectSlot: (heroId: string, slotId: string) => void;
  equippedByHero: Record<string, Record<string, string>>;
  getItemOwners: (itemUid: string) => Array<{ heroId: string; slotId: string }>;
  onEquipToSlot: (heroId: string, slotId: string, itemUid: string, options?: { forceReplaceHand?: boolean }) => void;
  onUnequipSlot: (heroId: string, slotId: string) => void;
  onRefreshBackpack: () => void;
}

function HeroGearContent({
  hero,
  heroNameMap,
  backpackItems,
  backpackMap,
  selectedSlotByHero,
  onSelectSlot,
  equippedByHero,
  getItemOwners,
  onEquipToSlot,
  onUnequipSlot,
  onRefreshBackpack
}: HeroGearContentProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [hoveredPreview, setHoveredPreview] = useState<{ uid: string; x: number; y: number } | null>(null);
  const [hoveredEquippedSlot, setHoveredEquippedSlot] = useState<{ slotId: string; x: number; y: number } | null>(null);
  const [pendingTwoHandConfirm, setPendingTwoHandConfirm] = useState<{
    itemUid: string;
    itemName: string;
    otherSlotId: string;
    otherItemName: string;
  } | null>(null);
  const heroSlots = getHeroEquipSlots(hero.heroClass);
  const fallbackSlotId = heroSlots[0]?.id ?? "";
  const selectedSlotId = heroSlots.some((slot) => slot.id === selectedSlotByHero[hero.id])
    ? selectedSlotByHero[hero.id]
    : fallbackSlotId;
  const selectedSlot = heroSlots.find((slot) => slot.id === selectedSlotId) ?? heroSlots[0];
  const heroEquipped = equippedByHero[hero.id] ?? {};
  const heroLegendaryUidSet = useMemo(
    () => new Set(Object.values(heroEquipped).filter((uid) => Boolean(legendaryEquipmentIdByUid[uid]))),
    [heroEquipped]
  );
  const heroLegendaryCount = heroLegendaryUidSet.size;
  const getDisplayedQualityLabel = (item: Pick<GeneratedEquipment, "uid" | "quality">): string => {
    return getEquipmentQualityLabel(item.quality, Boolean(legendaryEquipmentIdByUid[item.uid]));
  };

  const getDisplayedQualityClass = (item: Pick<GeneratedEquipment, "uid" | "quality">): string => {
    return Boolean(legendaryEquipmentIdByUid[item.uid]) ? "quality-legendary-exclusive" : "quality-" + item.quality;
  };

  const equippedBySlot = Object.fromEntries(
    heroSlots.map((slot) => [slot.id, heroEquipped[slot.id] ? backpackMap.get(heroEquipped[slot.id]) : undefined])
  ) as Record<string, GeneratedEquipment | undefined>;
  const currentSelectedUid = selectedSlot ? heroEquipped[selectedSlot.id] : undefined;
  const selectableSlots = resolveSelectableSlots(hero.heroClass, selectedSlotId, selectedSlot?.slot ?? "head");

  const slotItems = useMemo(() => {
    if (!selectedSlot) {
      return [] as GeneratedEquipment[];
    }
    return backpackItems
      .filter((item) => selectableSlots.includes(item.slot))
      .sort((a, b) => {
        if (qualityOrder[b.quality] !== qualityOrder[a.quality]) {
          return qualityOrder[b.quality] - qualityOrder[a.quality];
        }
        if (rankOrder[b.rank] !== rankOrder[a.rank]) {
          return rankOrder[b.rank] - rankOrder[a.rank];
        }
        return b.affixCount - a.affixCount;
      });
  }, [backpackItems, selectableSlots, selectedSlot]);

  const slotEntries = useMemo(() => {
    return slotItems.map((item) => {
      const owners = getItemOwners(item.uid);
      const isOwnedByOtherHero = owners.some((owner) => owner.heroId !== hero.id);
      const isCurrent = owners.some((owner) => owner.heroId === hero.id && owner.slotId === selectedSlot?.id);
      const isLegendaryItem = Boolean(legendaryEquipmentIdByUid[item.uid]);
      const heroAlreadyOwnsThisLegendary = heroLegendaryUidSet.has(item.uid);
      const exceedsLegendaryLimit = isLegendaryItem && !heroAlreadyOwnsThisLegendary && heroLegendaryCount >= 2;
      const canEquip = !isOwnedByOtherHero && !exceedsLegendaryLimit;
      let ownerText = "可装备";

      if (isOwnedByOtherHero) {
        const owner = owners.find((entry) => entry.heroId !== hero.id)!;
        ownerText = `已装备：${heroNameMap[owner.heroId] ?? owner.heroId}`;
      } else if (exceedsLegendaryLimit) {
        ownerText = "已达每英雄传说装备上限（2件）";
      } else if (owners.length > 0 && !isCurrent) {
        const ownerSlotLabels = owners
          .filter((owner) => owner.heroId === hero.id)
          .map((owner) => heroSlots.find((slot) => slot.id === owner.slotId)?.label ?? owner.slotId)
          .join("、");
        ownerText = `当前装备于：${ownerSlotLabels}（点击可移动）`;
      } else if (isCurrent) {
        ownerText = "当前槽位已装备";
      }

      return {
        item,
        owners,
        isCurrent,
        canEquip,
        ownerText
      };
    });
  }, [getItemOwners, hero.id, heroLegendaryCount, heroLegendaryUidSet, heroNameMap, heroSlots, selectedSlot?.id, slotItems]);

  const totalSlotCount = slotItems.length;
  const availableSlotCount = slotEntries.filter((entry) => entry.canEquip).length;
  const hoveredEntry = hoveredPreview ? slotEntries.find((entry) => entry.item.uid === hoveredPreview.uid) ?? null : null;
  const hoveredEquippedItem = hoveredEquippedSlot ? equippedBySlot[hoveredEquippedSlot.slotId] ?? null : null;
  const hoveredEquippedOwnerText = useMemo(() => {
    if (!hoveredEquippedItem) {
      return "";
    }
    const owners = getItemOwners(hoveredEquippedItem.uid).filter((owner) => owner.heroId === hero.id);
    const labels = owners
      .map((owner) => heroSlots.find((slot) => slot.id === owner.slotId)?.label ?? owner.slotId)
      .join("、");
    if (labels.length > 0) {
      return `当前装备于：${labels}`;
    }
    return "当前已装备";
  }, [getItemOwners, hero.id, heroSlots, hoveredEquippedItem]);
  const hoveredStyle = useMemo(() => {
    return buildHoverPanelStyle(hoveredPreview);
  }, [hoveredPreview]);
  const hoveredEquippedStyle = useMemo(() => {
    return buildHoverPanelStyle(
      hoveredEquippedSlot
        ? {
            x: hoveredEquippedSlot.x,
            y: hoveredEquippedSlot.y
          }
        : null
    );
  }, [hoveredEquippedSlot]);

  const equippedItems = heroSlots
    .map((slot) => equippedBySlot[slot.id])
    .filter((item): item is GeneratedEquipment => Boolean(item));

  const hpBonus = sumEquipmentStat(equippedItems, "hp");
  const coreBonusKey: EquipmentStatKey =
    hero.heroClass === "paladin"
      ? "def"
      : hero.heroClass === "mage" || hero.heroClass === "priest"
      ? "int"
      : "agi";
  const coreBonus = sumEquipmentStat(equippedItems, coreBonusKey);
  const coreBonusLabel =
    hero.heroClass === "paladin"
      ? "装备总防御"
      : hero.heroClass === "mage" || hero.heroClass === "priest"
      ? "装备总智力"
      : "装备总敏捷";
  const affixTotal = equippedItems.reduce((sum, item) => sum + item.affixCount, 0);
  const typeList = HERO_EQUIP_TYPE_SUMMARY[hero.heroClass];

  const handleEquipClick = (item: GeneratedEquipment) => {
    if (!selectedSlot) {
      return;
    }

    if (item.slot === "twoHand" && hero.heroClass === "paladin" && isPaladinHandSlot(selectedSlot.id)) {
      const otherSlotId = getPairedPaladinHandSlot(selectedSlot.id);
      if (otherSlotId) {
        const otherUid = heroEquipped[otherSlotId];
        if (otherUid && otherUid !== item.uid) {
          const otherItemName = backpackMap.get(otherUid)?.templateName ?? "未知装备";
          setPendingTwoHandConfirm({
            itemUid: item.uid,
            itemName: item.templateName,
            otherSlotId,
            otherItemName
          });
          return;
        }
      }
    }

    onEquipToSlot(hero.id, selectedSlot.id, item.uid);
    setHoveredPreview(null);
    setIsPickerOpen(false);
  };

  return (
    <div className="hero-gear-stack">
      <div className="hero-gear-view">
        <aside className="gear-left-panel">
          <section className="gear-summary-card">
            <SectionTitle title="属性汇总" />
            <div className="hero-stat-list">
              <StatRow label="装备总生命" value={formatSignedNumber(hpBonus)} />
              <StatRow label={coreBonusLabel} value={formatSignedNumber(coreBonus)} />
              <StatRow label="词条总数" value={formatSignedNumber(affixTotal)} />
            </div>
          </section>

          <section className="gear-set-card">
            <SectionTitle title="职业装备类型" />
            <ul className="gear-type-list">
              {typeList.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="gear-set-card">
            <SectionTitle title="穿戴进度" />
            <p>
              已装备 {equippedItems.length}/{heroSlots.length}。点击右侧槽位后会弹出装备选择窗口。
            </p>
            <button type="button" className="ghost-btn" onClick={onRefreshBackpack}>
              刷新背包
            </button>
          </section>
        </aside>

        <div className="gear-right-stage">
          {hero.heroClass === "mage" ? (
            <MageGearBoard
              equippedBySlot={equippedBySlot}
              selectedSlotId={selectedSlotId}
              onHoverSlot={(slotId, x, y) => {
                if (!slotId || typeof x !== "number" || typeof y !== "number") {
                  setHoveredEquippedSlot(null);
                  return;
                }
                setHoveredEquippedSlot({ slotId, x, y });
              }}
              onSelectSlot={(slotId) => {
                onSelectSlot(hero.id, slotId);
                setHoveredPreview(null);
                setHoveredEquippedSlot(null);
                setIsPickerOpen(true);
              }}
            />
          ) : hero.heroClass === "ranger" ? (
            <RangerGearBoard
              equippedBySlot={equippedBySlot}
              selectedSlotId={selectedSlotId}
              onHoverSlot={(slotId, x, y) => {
                if (!slotId || typeof x !== "number" || typeof y !== "number") {
                  setHoveredEquippedSlot(null);
                  return;
                }
                setHoveredEquippedSlot({ slotId, x, y });
              }}
              onSelectSlot={(slotId) => {
                onSelectSlot(hero.id, slotId);
                setHoveredPreview(null);
                setHoveredEquippedSlot(null);
                setIsPickerOpen(true);
              }}
            />
          ) : hero.heroClass === "priest" ? (
            <PriestGearBoard
              equippedBySlot={equippedBySlot}
              selectedSlotId={selectedSlotId}
              onHoverSlot={(slotId, x, y) => {
                if (!slotId || typeof x !== "number" || typeof y !== "number") {
                  setHoveredEquippedSlot(null);
                  return;
                }
                setHoveredEquippedSlot({ slotId, x, y });
              }}
              onSelectSlot={(slotId) => {
                onSelectSlot(hero.id, slotId);
                setHoveredPreview(null);
                setHoveredEquippedSlot(null);
                setIsPickerOpen(true);
              }}
            />
          ) : (
            <PaladinGearBoard
              equippedBySlot={equippedBySlot}
              selectedSlotId={selectedSlotId}
              onHoverSlot={(slotId, x, y) => {
                if (!slotId || typeof x !== "number" || typeof y !== "number") {
                  setHoveredEquippedSlot(null);
                  return;
                }
                setHoveredEquippedSlot({ slotId, x, y });
              }}
              onSelectSlot={(slotId) => {
                onSelectSlot(hero.id, slotId);
                setHoveredPreview(null);
                setHoveredEquippedSlot(null);
                setIsPickerOpen(true);
              }}
            />
          )}
        </div>
      </div>
      {!isPickerOpen && hoveredEquippedItem && hoveredEquippedStyle ? (
        <aside className="hero-equip-hover-detail custom-scrollbar" style={hoveredEquippedStyle}>
          <header className="hero-equip-hover-head">
            <h4>{hoveredEquippedItem.templateName}</h4>
            <div className="hero-equip-hover-badges">
              <span className={`quality-badge ${getDisplayedQualityClass(hoveredEquippedItem)}`}>
                {getDisplayedQualityLabel(hoveredEquippedItem)}
              </span>
              <span className={`rank-badge rank-${hoveredEquippedItem.rank}`}>
                {EQUIPMENT_RANK_LABELS[hoveredEquippedItem.rank]}
              </span>
            </div>
          </header>

          <p className="hero-equip-hover-subtype">
            {EQUIPMENT_SUBTYPE_LABELS[hoveredEquippedItem.subtype]} · {EQUIPMENT_SLOT_LABELS[hoveredEquippedItem.slot]} ·
            Lv.{hoveredEquippedItem.level}
          </p>
          <p className="hero-equip-hover-owner">{hoveredEquippedOwnerText}</p>
          <p className="hero-equip-hover-meta">
            Rank 增幅 {(hoveredEquippedItem.rankPercent * 100).toFixed(2)}% · 词条 {hoveredEquippedItem.affixCount} · 插槽{" "}
            {hoveredEquippedItem.sockets}
          </p>

          <section className="hero-equip-hover-block">
            <h5>T1 基础属性</h5>
            <div className="hero-equip-hover-list">
              {hoveredEquippedItem.t1Stats.map((stat) => (
                <p key={`hover-equipped-t1-${hoveredEquippedItem.uid}-${stat.key}-${stat.label}`}>
                  <span>{stat.label}</span>
                  <strong>
                    {formatStatValue(stat.baseValue)}
                    {" -> "}
                    {formatStatValue(stat.finalValue)}
                  </strong>
                </p>
              ))}
            </div>
          </section>

          <section className="hero-equip-hover-block">
            <h5>T2 附加词条</h5>
            {hoveredEquippedItem.affixes.length > 0 ? (
              <div className="hero-equip-hover-list">
                {hoveredEquippedItem.affixes.map((affix, idx) => (
                  <p key={`hover-equipped-affix-${hoveredEquippedItem.uid}-${idx}-${affix.key}`}>
                    <span>{affix.label}</span>
                    <strong>{formatStatValue(affix.finalValue)}</strong>
                  </p>
                ))}
              </div>
            ) : (
              <p className="hero-equip-hover-empty">当前品质无附加词条。</p>
            )}
          </section>
        </aside>
      ) : null}
      {isPickerOpen && selectedSlot ? (
        <div
          className="hero-equip-picker-backdrop"
          role="presentation"
          onClick={() => {
            setHoveredPreview(null);
            setIsPickerOpen(false);
          }}
        >
          <article
            className="hero-equip-picker-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="hero-equip-picker-head">
              <div>
                <h3>
                  选择装备：{selectedSlot.label}（{EQUIPMENT_SLOT_LABELS[selectedSlot.slot]}）
                </h3>
                <p>
                  背包同类型总数 {totalSlotCount}，当前可装备 {availableSlotCount}
                </p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => {
                  setHoveredPreview(null);
                  setIsPickerOpen(false);
                }}
              >
                <X size={16} />
              </button>
            </header>

            <div className="hero-equip-picker-actions">
              <button type="button" className="ghost-btn" onClick={onRefreshBackpack}>
                刷新背包
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={!currentSelectedUid}
                onClick={() => {
                  onUnequipSlot(hero.id, selectedSlot.id);
                }}
              >
                卸下当前槽位
              </button>
            </div>

            <div className="hero-equip-picker-list custom-scrollbar">
              {slotEntries.length > 0 ? (
                slotEntries.map((entry) => (
                  <button
                    key={entry.item.uid}
                    type="button"
                    className={`hero-equip-picker-item ${entry.isCurrent ? "active" : ""} ${!entry.canEquip ? "disabled" : ""}`}
                    disabled={!entry.canEquip}
                    onClick={() => handleEquipClick(entry.item)}
                    onMouseEnter={(event) =>
                      setHoveredPreview({ uid: entry.item.uid, x: event.clientX, y: event.clientY })
                    }
                    onMouseMove={(event) =>
                      setHoveredPreview({ uid: entry.item.uid, x: event.clientX, y: event.clientY })
                    }
                    onMouseLeave={() => setHoveredPreview(null)}
                  >
                    <div className="hero-equip-picker-title-row">
                      <h4>{entry.item.templateName}</h4>
                      <span className={`quality-badge ${getDisplayedQualityClass(entry.item)}`}>
                        {getDisplayedQualityLabel(entry.item)}
                      </span>
                    </div>
                    <p>{EQUIPMENT_SUBTYPE_LABELS[entry.item.subtype]}</p>
                    <div className="hero-equip-picker-meta-row">
                      <span className={`rank-badge rank-${entry.item.rank}`}>{EQUIPMENT_RANK_LABELS[entry.item.rank]}</span>
                      <span>词条 {entry.item.affixCount}</span>
                    </div>
                    <div className="hero-equip-picker-owner">{entry.ownerText}</div>
                  </button>
                ))
              ) : (
                <div className="hero-backpack-empty">当前槽位没有对应类型装备，请刷新背包样本。</div>
              )}
            </div>

            {hoveredEntry && hoveredStyle ? (
              <aside className="hero-equip-hover-detail custom-scrollbar" style={hoveredStyle}>
                <header className="hero-equip-hover-head">
                  <h4>{hoveredEntry.item.templateName}</h4>
                  <div className="hero-equip-hover-badges">
                    <span className={`quality-badge ${getDisplayedQualityClass(hoveredEntry.item)}`}>
                      {getDisplayedQualityLabel(hoveredEntry.item)}
                    </span>
                    <span className={`rank-badge rank-${hoveredEntry.item.rank}`}>
                      {EQUIPMENT_RANK_LABELS[hoveredEntry.item.rank]}
                    </span>
                  </div>
                </header>

                <p className="hero-equip-hover-subtype">
                  {EQUIPMENT_SUBTYPE_LABELS[hoveredEntry.item.subtype]} · {EQUIPMENT_SLOT_LABELS[hoveredEntry.item.slot]} · Lv.
                  {hoveredEntry.item.level}
                </p>
                <p className="hero-equip-hover-owner">{hoveredEntry.ownerText}</p>
                <p className="hero-equip-hover-meta">
                  Rank 增幅 {(hoveredEntry.item.rankPercent * 100).toFixed(2)}% · 词条 {hoveredEntry.item.affixCount} · 插槽{" "}
                  {hoveredEntry.item.sockets}
                </p>

                <section className="hero-equip-hover-block">
                  <h5>T1 基础属性</h5>
                  <div className="hero-equip-hover-list">
                    {hoveredEntry.item.t1Stats.map((stat) => (
                      <p key={`hover-t1-${hoveredEntry.item.uid}-${stat.key}-${stat.label}`}>
                        <span>{stat.label}</span>
                        <strong>
                          {formatStatValue(stat.baseValue)}
                          {" -> "}
                          {formatStatValue(stat.finalValue)}
                        </strong>
                      </p>
                    ))}
                  </div>
                </section>

                <section className="hero-equip-hover-block">
                  <h5>T2 附加词条</h5>
                  {hoveredEntry.item.affixes.length > 0 ? (
                    <div className="hero-equip-hover-list">
                      {hoveredEntry.item.affixes.map((affix, idx) => (
                        <p key={`hover-affix-${hoveredEntry.item.uid}-${idx}-${affix.key}`}>
                          <span>{affix.label}</span>
                          <strong>{formatStatValue(affix.finalValue)}</strong>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="hero-equip-hover-empty">当前品质无附加词条。</p>
                  )}
                </section>
              </aside>
            ) : null}
          </article>
        </div>
      ) : null}

      {pendingTwoHandConfirm && selectedSlot ? (
        <div className="hero-equip-confirm-backdrop" role="presentation" onClick={() => setPendingTwoHandConfirm(null)}>
          <article
            className="hero-equip-confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h4>双手武器确认</h4>
            <p>
              {pendingTwoHandConfirm.itemName} 需要占用两个手部槽位。
              <br />
              当前 {heroSlots.find((slot) => slot.id === pendingTwoHandConfirm.otherSlotId)?.label ?? pendingTwoHandConfirm.otherSlotId}
              已装备 {pendingTwoHandConfirm.otherItemName}。
              <br />
              是否继续装备并移除另一手装备？
            </p>
            <div className="hero-equip-confirm-actions">
              <button type="button" className="ghost-btn" onClick={() => setPendingTwoHandConfirm(null)}>
                取消
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  onEquipToSlot(hero.id, selectedSlot.id, pendingTwoHandConfirm.itemUid, { forceReplaceHand: true });
                  setHoveredPreview(null);
                  setPendingTwoHandConfirm(null);
                  setIsPickerOpen(false);
                }}
              >
                确认装备
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

function HeroSkillsContent({
  hero,
  loadout,
  onSetHeroLoadout,
  onResetHeroLoadout
}: {
  hero: Hero;
  loadout: BattleLoadout;
  onSetHeroLoadout: (heroId: string, loadout: BattleLoadout) => void;
  onResetHeroLoadout: (heroId: string) => void;
}) {
  const applyLoadout = (nextLoadout: BattleLoadout): string[] => {
    const normalized = normalizeHeroLoadout(
      hero.heroClass,
      {
        ...nextLoadout,
        talentSlot: loadout.talentSlot
      },
      loadout.talentSlot,
      hero.learnedSkills
    );
    onSetHeroLoadout(hero.id, normalized.loadout);
    return normalized.issues;
  };

  return (
    <div className="hero-skills-view">
      <HeroSkillLoadoutEditor
        hero={hero}
        loadout={loadout}
        onApplyLoadout={applyLoadout}
        onReset={() => onResetHeroLoadout(hero.id)}
      />
    </div>
  );
}

function HeroMemoryContent({
  hero,
  memoryId,
  options,
  getOwnerName,
  onChangeMemory
}: {
  hero: Hero;
  memoryId: string | null;
  options: InventoryMemoryStack[];
  getOwnerName: (memoryId: string) => string | null;
  onChangeMemory: (nextMemoryId: string | null) => boolean;
}) {
  const selected = options.find((item) => item.id === memoryId) ?? null;
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setNotice("");
  }, [hero.id]);

  const equipMemory = (nextMemoryId: string | null) => {
    const ok = onChangeMemory(nextMemoryId);
    if (ok) {
      if (nextMemoryId) {
        const nextMemory = options.find((item) => item.id === nextMemoryId);
        setNotice(`已装备：${nextMemory?.title ?? nextMemoryId}`);
      } else {
        setNotice("已卸下记忆。");
      }
      setIsPickerOpen(false);
      return;
    }
    setNotice("装备失败：该记忆可能未拥有，或已被其他英雄装备。");
  };

  return (
    <div className="hero-memory-view">
      <aside className="memory-info-card">
        <SectionTitle title="记忆碎片效果" />
        <h4>{selected?.title ?? "未穿戴记忆"}</h4>
        <p className="memory-quote">“{selected?.quote ?? "当前未激活记忆效果"}”</p>
        <div className="memory-effect">{selected?.effect ?? "请从背包中的记忆里选择后穿戴。"}</div>
        <div className="memory-actions">
          <button type="button" className="ghost-btn" onClick={() => setIsPickerOpen(true)}>
            查看记忆库存
          </button>
          <button type="button" className="ghost-btn" onClick={() => equipMemory(null)} disabled={!memoryId}>
            卸下记忆
          </button>
          <small>每个记忆全局唯一，不可重复装备。</small>
        </div>
        {notice ? <p className="memory-notice">{notice}</p> : null}
      </aside>

      <div className="memory-stage">
        <img src={hero.image} alt={`${hero.name} 记忆`} />
        <div className="memory-stage-mask" />
        <div className="memory-stage-frame" />
        <div className="memory-stage-title">
          <span>FRAGILE MEMORIES</span>
        </div>
        <div className="memory-stage-subtitle">{selected?.title ?? "未穿戴记忆"}</div>
      </div>

      {isPickerOpen ? (
        <div className="hero-memory-picker-backdrop" role="presentation" onClick={() => setIsPickerOpen(false)}>
          <article className="hero-memory-picker-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="hero-memory-picker-head">
              <div>
                <h3>记忆库存</h3>
                <p>{hero.name} · 当前职业 {hero.heroClass}</p>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setIsPickerOpen(false)}>
                <X size={16} />
              </button>
            </header>

            {options.length > 0 ? (
              <div className="hero-memory-picker-list custom-scrollbar">
                {options.map((option) => {
                  const ownerName = getOwnerName(option.id);
                  const isCurrent = option.id === memoryId;
                  const canEquip = !ownerName || isCurrent;
                  return (
                    <article key={option.id} className={`hero-memory-picker-item ${isCurrent ? "active" : ""} ${canEquip ? "" : "disabled"}`}>
                      <h4>{option.title}</h4>
                      <p className="memory-quote">“{option.quote}”</p>
                      <p className="memory-effect">{option.effect}</p>
                      <div className="memory-owned-meta">
                        <small>{ownerName && !isCurrent ? `已装备：${ownerName}` : isCurrent ? "当前已装备" : "可装备"}</small>
                        <button type="button" className="ghost-btn small-btn" disabled={!canEquip} onClick={() => equipMemory(option.id)}>
                          {isCurrent ? "已装备" : "装备"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="memory-empty-panel">该职业当前没有可用记忆。请先获取对应记忆后再装备。</div>
            )}
          </article>
        </div>
      ) : null}
    </div>
  );
}

export function HeroPage() {
  const { heroes } = useHeroRoster();
  const { heroId } = useParams<{ heroId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as HeroTab) || "stats";
  const hero = heroes.find((item) => item.id === heroId) ?? heroes[0];
  const {
    items,
    itemMap,
    equippedByHero,
    refreshItems,
    equipItem,
    unequipItem,
    getItemOwners,
    getEquipmentEnhanceBonus,
    memoryItems,
    getMemoryOwner,
    getHeroMemory,
    setHeroMemory,
    heroProgressById
  } = useEquipmentInventory();
  const { getHeroLoadout, setHeroLoadout, resetHeroLoadout } = useBattleSetup();
  const heroLoadout = getHeroLoadout(hero.id);
  const selectedMemoryId = getHeroMemory(hero.id);
  const [statsMode, setStatsMode] = useState<StatsViewMode>("origin");

  useEffect(() => {
    setStatsMode("origin");
  }, [hero.id]);

  const singleHeroFormation = useMemo(
    () => [{ id: `hero-preview-${hero.id}`, line: "front" as const, index: 0 as const, heroId: hero.id }],
    [hero.id]
  );
  const heroLoadoutMap = useMemo(() => ({ [hero.id]: heroLoadout }), [hero.id, heroLoadout]);
  const emptyItemMap = useMemo(() => new Map<string, GeneratedEquipment>(), []);
  const zeroEnhanceBonus = useMemo(() => () => 0, []);
  const originTemplate = useMemo(
    () =>
      buildAllyTeamTemplates(
        [hero],
        singleHeroFormation,
        heroLoadoutMap,
        heroProgressById,
        {},
        emptyItemMap,
        zeroEnhanceBonus
      )[0] ?? null,
    [emptyItemMap, hero, heroLoadoutMap, heroProgressById, singleHeroFormation, zeroEnhanceBonus]
  );
  const equippedTemplate = useMemo(
    () =>
      buildAllyTeamTemplates(
        [hero],
        singleHeroFormation,
        heroLoadoutMap,
        heroProgressById,
        equippedByHero,
        itemMap,
        getEquipmentEnhanceBonus
      )[0] ?? null,
    [equippedByHero, getEquipmentEnhanceBonus, hero, heroLoadoutMap, heroProgressById, itemMap, singleHeroFormation]
  );
  const originBattleStats = useMemo(() => {
    return buildBattleStatBlock(originTemplate?.baseStats);
  }, [originTemplate]);
  const settledBattleStats = useMemo(() => {
    let next = buildBattleStatBlock(equippedTemplate?.baseStats);
    heroLoadout.passiveSlots
      .filter((skillId): skillId is string => typeof skillId === "string" && skillId.length > 0)
      .forEach((passiveId) => {
        const passive = battlePassiveSkills[passiveId];
        if (passive) {
          next = applyStatModifier(next, passive.modifiers);
        }
      });
    if (heroLoadout.talentSlot) {
      const talent = battleTalents[heroLoadout.talentSlot];
      if (talent) {
        next = applyStatModifier(next, talent.modifiers);
      }
    }
    return next;
  }, [equippedTemplate, heroLoadout.passiveSlots, heroLoadout.talentSlot]);
  const heroProgress = heroProgressById[hero.id] ?? { level: HERO_PROGRESSION_CONFIG.initialLevel, exp: 0 };
  const heroNextLevelExp = getHeroNextLevelExp(heroProgress.level);

  const heroMemoryOptions = useMemo(
    () => memoryItems.filter((item) => item.heroClass === hero.heroClass),
    [hero.heroClass, memoryItems]
  );

  const [selectedSlotByHero, setSelectedSlotByHero] = useState<Record<string, string>>({});
  const heroNameMap = useMemo(
    () =>
      heroes.reduce<Record<string, string>>((map, item) => {
        map[item.id] = item.name;
        return map;
      }, {}),
    [heroes]
  );

  const setTab = (tab: HeroTab) => setSearchParams({ tab });

  const handleSelectSlot = (targetHeroId: string, slotId: string) => {
    setSelectedSlotByHero((prev) => ({ ...prev, [targetHeroId]: slotId }));
  };

  const handleEquipToSlot = (
    targetHeroId: string,
    slotId: string,
    itemUid: string,
    options: { forceReplaceHand?: boolean } = {}
  ) => {
    equipItem(targetHeroId, slotId, itemUid, options);
  };

  const handleUnequipSlot = (targetHeroId: string, slotId: string) => {
    unequipItem(targetHeroId, slotId);
  };

  return (
    <section className="page hero-page">
      <header className="page-header">
        <h1>英雄殿堂</h1>
        <p>装备与技能均可独立配置：装备影响面板，技能槽位直接驱动战斗释放逻辑。</p>
      </header>

      <div className="hero-layout">
        <aside className="hero-list">
          {heroes.map((item) => (
            <Link
              key={item.id}
              to={`/hero/${item.id}?tab=${currentTab}`}
              className={item.id === hero.id ? "hero-avatar active" : "hero-avatar"}
            >
              <img src={item.image} alt={item.name} />
            </Link>
          ))}
          <button className="hero-avatar hero-avatar-add" type="button" aria-label="添加英雄">
            <User size={16} />
          </button>
        </aside>

        <div className="hero-main">
          <div className="hero-tabs">
            <HeroTabButton active={currentTab === "stats"} label="基础属性" onClick={() => setTab("stats")} />
            <HeroTabButton active={currentTab === "gear"} label="装备体系" onClick={() => setTab("gear")} />
            <HeroTabButton active={currentTab === "skills"} label="技能配置" onClick={() => setTab("skills")} />
            <HeroTabButton active={currentTab === "memory"} label="记忆共鸣" onClick={() => setTab("memory")} />
          </div>

          <article className="hero-card">
            <div className="hero-content">
              {currentTab === "stats" && (
                <HeroStatsContent
                  hero={hero}
                  heroLevel={heroProgress.level}
                  heroExp={heroProgress.exp}
                  nextLevelExp={heroNextLevelExp}
                  mode={statsMode}
                  onToggleMode={() => setStatsMode((prev) => (prev === "origin" ? "battle" : "origin"))}
                  originStats={originBattleStats}
                  battleStats={settledBattleStats}
                />
              )}
              {currentTab === "gear" && (
                <HeroGearContent
                  hero={hero}
                  heroNameMap={heroNameMap}
                  backpackItems={items}
                  backpackMap={itemMap}
                  selectedSlotByHero={selectedSlotByHero}
                  onSelectSlot={handleSelectSlot}
                  equippedByHero={equippedByHero}
                  getItemOwners={getItemOwners}
                  onEquipToSlot={handleEquipToSlot}
                  onUnequipSlot={handleUnequipSlot}
                  onRefreshBackpack={refreshItems}
                />
              )}
              {currentTab === "skills" && (
                <HeroSkillsContent
                  hero={hero}
                  loadout={heroLoadout}
                  onSetHeroLoadout={setHeroLoadout}
                  onResetHeroLoadout={resetHeroLoadout}
                />
              )}
              {currentTab === "memory" && (
                <HeroMemoryContent
                  hero={hero}
                  memoryId={selectedMemoryId}
                  options={heroMemoryOptions}
                  getOwnerName={(memoryId) => {
                    const ownerHeroId = getMemoryOwner(memoryId);
                    if (!ownerHeroId || ownerHeroId === hero.id) {
                      return null;
                    }
                    return heroNameMap[ownerHeroId] ?? ownerHeroId;
                  }}
                  onChangeMemory={(nextMemoryId) => {
                    return setHeroMemory(hero.id, nextMemoryId);
                  }}
                />
              )}
            </div>

            <button className="hero-next-tab" type="button" onClick={() => setTab(nextTab(currentTab))}>
              切换到下一个标签
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
