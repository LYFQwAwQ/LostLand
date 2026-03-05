import { useMemo, useState } from "react";
import { User, X, Zap } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MageGearBoard } from "../components/hero/MageGearBoard";
import { PaladinGearBoard } from "../components/hero/PaladinGearBoard";
import { battleActiveSkills, battlePassiveSkills, battleTalents } from "../data/battleSkills";
import {
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SUBTYPE_LABELS,
  HERO_EQUIP_TYPE_SUMMARY,
  getPairedPaladinHandSlot,
  getHeroEquipSlots,
  isPaladinHandSlot
} from "../lib/equipmentCatalog";
import { EQUIPMENT_QUALITY_LABELS, EQUIPMENT_RANK_LABELS } from "../lib/equipmentSystem";
import { useBattleSetup } from "../state/BattleSetupProvider";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { heroes } from "../data/mockData";
import type { BattleLoadout, BattleStatModifier } from "../types/battle";
import type { EquipmentSlot, EquipmentStatKey, GeneratedEquipment, Hero, HeroTab } from "../types/game";

interface ElementRow {
  id: string;
  label: string;
  color: string;
  bonus: string;
  resist: string;
}

const elements: ElementRow[] = [
  { id: "fire", label: "火焰", color: "#ef4444", bonus: "+15%", resist: "+24%" },
  { id: "water", label: "流水", color: "#3b82f6", bonus: "+12%", resist: "+20%" },
  { id: "ice", label: "寒冰", color: "#60a5fa", bonus: "+10%", resist: "+30%" },
  { id: "wind", label: "疾风", color: "#10b981", bonus: "+8%", resist: "+18%" },
  { id: "life", label: "生命", color: "#22c55e", bonus: "+7%", resist: "+16%" },
  { id: "light", label: "光明", color: "#fbbf24", bonus: "+11%", resist: "+12%" },
  { id: "undead", label: "亡灵", color: "#a855f7", bonus: "+9%", resist: "+14%" },
  { id: "dark", label: "暗影", color: "#6b7280", bonus: "+13%", resist: "+19%" }
];

const combatStats = [
  { label: "物理防御", value: "450" },
  { label: "物理穿透", value: "12%" },
  { label: "暴击率", value: "15.2%" },
  { label: "暴击伤害", value: "210%" },
  { label: "闪避率", value: "5.8%" },
  { label: "韧性", value: "80" },
  { label: "吸血", value: "2.5%" },
  { label: "反伤", value: "10%" }
];

const advancedStats = [
  { label: "元素穿透", value: "18%" },
  { label: "全元素抗性", value: "10%" },
  { label: "全元素增伤", value: "5%" },
  { label: "护甲百分比穿透", value: "25%" }
];

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

const HERO_NAME_MAP = heroes.reduce<Record<string, string>>((map, hero) => {
  map[hero.id] = hero.name;
  return map;
}, {});
const talentOptions = Object.values(battleTalents);
const activeSkillOptions = Object.values(battleActiveSkills);
const passiveSkillOptions = Object.values(battlePassiveSkills);

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

function HeroStatsContent({ hero }: { hero: Hero }) {
  return (
    <div className="hero-stats-view">
      <div className="hero-portrait-card">
        <img src={hero.image} alt={hero.name} />
        <div className="hero-portrait-mask" />
        <div className="hero-portrait-text">
          <h2>{hero.name}</h2>
          <p>{hero.title}</p>
        </div>
      </div>

      <div className="hero-stats-panel custom-scrollbar">
        <div className="hero-stats-grid">
          <section>
            <SectionTitle title="1. 核心属性" />
            <div className="hero-stat-list">
              <StatRow label="生命值 (HP)" value={hero.stats.hp} color="#ef4444" />
              <StatRow label="法力值 (MP)" value={hero.stats.mp} color="#3b82f6" />
              <StatRow label="力量 (STR)" value={hero.stats.str} />
              <StatRow label="智力 (INT)" value={hero.stats.int} />
              <StatRow label="敏捷 (AGI)" value={hero.stats.agi} />
            </div>
          </section>

          <section>
            <SectionTitle title="2. 战斗辅助指标" />
            <div className="hero-combat-grid">
              {combatStats.map((item) => (
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
                    <strong>{item.bonus}</strong>
                  </p>
                  <p>
                    <span>抗性</span>
                    <strong>{item.resist}</strong>
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="full-width">
            <SectionTitle title="4. 高级属性" />
            <div className="hero-advanced-grid">
              {advancedStats.map((item) => (
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
  onChangeTalent,
  onChangeActive,
  onChangePassive,
  onReset
}: {
  hero: Hero;
  loadout: BattleLoadout;
  onChangeTalent: (talentId: string | null) => void;
  onChangeActive: (slotIndex: number, skillId: string | null) => void;
  onChangePassive: (slotIndex: number, skillId: string | null) => void;
  onReset: () => void;
}) {
  const [hoveredSkill, setHoveredSkill] = useState<{ id: string; x: number; y: number } | null>(null);
  const hoveredTalent = hoveredSkill ? battleTalents[hoveredSkill.id] : null;
  const hoveredActive = hoveredSkill ? battleActiveSkills[hoveredSkill.id] : null;
  const hoveredPassive = hoveredSkill ? battlePassiveSkills[hoveredSkill.id] : null;
  const hoveredType = hoveredTalent ? "talent" : hoveredActive ? "active" : hoveredPassive ? "passive" : null;
  const hoveredDesc = hoveredTalent?.description ?? hoveredActive?.description ?? hoveredPassive?.description ?? "";
  const hoveredName = hoveredTalent?.name ?? hoveredActive?.name ?? hoveredPassive?.name ?? "";
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

  return (
    <section className="hero-skill-editor">
      <header className="hero-skill-editor-head">
        <h3>战斗技能配置</h3>
        <p>
          {hero.name} · 1 天赋 / 10 主动 / 10 被动（仅展示可配置逻辑，未做职业限制）
        </p>
      </header>

      <div className="hero-skill-editor-grid">
        <div className="hero-skill-column">
          <h4>天赋槽位</h4>
          <label className="hero-skill-select-row">
            <span>Talent</span>
            <select
              value={loadout.talentSlot ?? ""}
              onChange={(event) => onChangeTalent(event.target.value || null)}
              onMouseEnter={(event) => handleSkillHover(loadout.talentSlot, event.clientX, event.clientY)}
              onMouseMove={(event) => handleSkillHover(loadout.talentSlot, event.clientX, event.clientY)}
              onMouseLeave={() => setHoveredSkill(null)}
            >
              <option value="">空槽</option>
              {talentOptions.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="hero-skill-column">
          <h4>主动槽位</h4>
          <div className="hero-skill-slot-list custom-scrollbar">
            {loadout.activeSlots.map((skillId, index) => (
              <label key={`active-${index}`} className="hero-skill-select-row">
                <span>A{index + 1}</span>
                <select
                  value={skillId ?? ""}
                  onChange={(event) => onChangeActive(index, event.target.value || null)}
                  onMouseEnter={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseMove={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseLeave={() => setHoveredSkill(null)}
                >
                  <option value="">空槽</option>
                  {activeSkillOptions.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
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
                  onChange={(event) => onChangePassive(index, event.target.value || null)}
                  onMouseEnter={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseMove={(event) => handleSkillHover(skillId, event.clientX, event.clientY)}
                  onMouseLeave={() => setHoveredSkill(null)}
                >
                  <option value="">空槽</option>
                  {passiveSkillOptions.map((skill) => (
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
        <button type="button" className="ghost-btn" onClick={onReset}>
          恢复默认技能模板
        </button>
      </div>

      {hoveredSkill && hoveredStyle && hoveredType ? (
        <aside className="hero-skill-hover-detail custom-scrollbar" style={hoveredStyle}>
          <header>
            <h4>{hoveredName}</h4>
            <span>{hoveredType.toUpperCase()}</span>
          </header>
          <p>{hoveredDesc}</p>

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
      const canEquip = !isOwnedByOtherHero;
      let ownerText = "可装备";

      if (isOwnedByOtherHero) {
        const owner = owners.find((entry) => entry.heroId !== hero.id)!;
        ownerText = `已装备：${HERO_NAME_MAP[owner.heroId] ?? owner.heroId}`;
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
  }, [getItemOwners, hero.id, heroSlots, selectedSlot?.id, slotItems]);

  const totalSlotCount = slotItems.length;
  const availableSlotCount = slotEntries.filter((entry) => entry.canEquip).length;
  const hoveredEntry = hoveredPreview ? slotEntries.find((entry) => entry.item.uid === hoveredPreview.uid) ?? null : null;
  const hoveredStyle = useMemo(() => {
    if (!hoveredPreview) {
      return undefined;
    }

    const panelWidth = 360;
    const panelHeight = 430;
    let left = hoveredPreview.x + 18;
    let top = hoveredPreview.y + 18;

    if (typeof window !== "undefined") {
      left = Math.min(left, window.innerWidth - panelWidth - 12);
      top = Math.min(top, window.innerHeight - panelHeight - 12);
    }

    left = Math.max(12, left);
    top = Math.max(12, top);

    return {
      left: `${left}px`,
      top: `${top}px`
    };
  }, [hoveredPreview]);

  const equippedItems = heroSlots
    .map((slot) => equippedBySlot[slot.id])
    .filter((item): item is GeneratedEquipment => Boolean(item));

  const hpBonus = sumEquipmentStat(equippedItems, "hp");
  const coreBonus = hero.heroClass === "paladin" ? sumEquipmentStat(equippedItems, "def") : sumEquipmentStat(equippedItems, "int");
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
              <StatRow label={hero.heroClass === "paladin" ? "装备总防御" : "装备总智力"} value={formatSignedNumber(coreBonus)} />
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
              onSelectSlot={(slotId) => {
                onSelectSlot(hero.id, slotId);
                setHoveredPreview(null);
                setIsPickerOpen(true);
              }}
            />
          ) : (
            <PaladinGearBoard
              equippedBySlot={equippedBySlot}
              selectedSlotId={selectedSlotId}
              onSelectSlot={(slotId) => {
                onSelectSlot(hero.id, slotId);
                setHoveredPreview(null);
                setIsPickerOpen(true);
              }}
            />
          )}
        </div>
      </div>

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
                      <span className={`quality-badge quality-${entry.item.quality}`}>
                        {EQUIPMENT_QUALITY_LABELS[entry.item.quality]}
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
                    <span className={`quality-badge quality-${hoveredEntry.item.quality}`}>
                      {EQUIPMENT_QUALITY_LABELS[hoveredEntry.item.quality]}
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
  onSetTalent,
  onSetActiveSkill,
  onSetPassiveSkill,
  onResetHeroLoadout
}: {
  hero: Hero;
  loadout: BattleLoadout;
  onSetTalent: (heroId: string, talentId: string | null) => void;
  onSetActiveSkill: (heroId: string, slotIndex: number, skillId: string | null) => void;
  onSetPassiveSkill: (heroId: string, slotIndex: number, skillId: string | null) => void;
  onResetHeroLoadout: (heroId: string) => void;
}) {
  return (
    <div className="hero-skills-view">
      <HeroSkillLoadoutEditor
        hero={hero}
        loadout={loadout}
        onChangeTalent={(talentId) => onSetTalent(hero.id, talentId)}
        onChangeActive={(slotIndex, skillId) => onSetActiveSkill(hero.id, slotIndex, skillId)}
        onChangePassive={(slotIndex, skillId) => onSetPassiveSkill(hero.id, slotIndex, skillId)}
        onReset={() => onResetHeroLoadout(hero.id)}
      />
    </div>
  );
}

function HeroMemoryContent({ hero }: { hero: Hero }) {
  const title = hero.heroClass === "paladin" ? "破碎的王座" : "凛冬的群星";
  const quote =
    hero.heroClass === "paladin"
      ? "那是连光都被吞噬的黎明前夜。"
      : "她在群星坠落前，记住了每一道法则裂痕。";
  const effect =
    hero.heroClass === "paladin"
      ? "获得 [孤傲]：孤军奋战时伤害 +50%"
      : "获得 [法涌]：法力值越高，法术穿透越高";

  return (
    <div className="hero-memory-view">
      <aside className="memory-info-card">
        <SectionTitle title="记忆碎片效果" />
        <h4>{title}</h4>
        <p className="memory-quote">“{quote}”</p>
        <div className="memory-effect">{effect}</div>
      </aside>

      <div className="memory-stage">
        <img src={hero.image} alt={`${hero.name} 记忆`} />
        <div className="memory-stage-mask" />
        <div className="memory-stage-frame" />
        <div className="memory-stage-title">
          <span>FRAGILE MEMORIES</span>
        </div>
      </div>
    </div>
  );
}

export function HeroPage() {
  const { heroId } = useParams<{ heroId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as HeroTab) || "stats";
  const hero = heroes.find((item) => item.id === heroId) ?? heroes[0];
  const { items, itemMap, equippedByHero, refreshItems, equipItem, unequipItem, getItemOwners } = useEquipmentInventory();
  const { getHeroLoadout, setHeroTalent, setHeroActiveSkill, setHeroPassiveSkill, resetHeroLoadout } = useBattleSetup();
  const heroLoadout = getHeroLoadout(hero.id);

  const [selectedSlotByHero, setSelectedSlotByHero] = useState<Record<string, string>>({});

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
              {currentTab === "stats" && <HeroStatsContent hero={hero} />}
              {currentTab === "gear" && (
                <HeroGearContent
                  hero={hero}
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
                  onSetTalent={setHeroTalent}
                  onSetActiveSkill={setHeroActiveSkill}
                  onSetPassiveSkill={setHeroPassiveSkill}
                  onResetHeroLoadout={resetHeroLoadout}
                />
              )}
              {currentTab === "memory" && <HeroMemoryContent hero={hero} />}
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
