import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { heroes } from "../data/mockData";
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SUBTYPE_LABELS } from "../lib/equipmentCatalog";
import { EQUIPMENT_QUALITY_LABELS, EQUIPMENT_RANK_LABELS } from "../lib/equipmentSystem";
import { computeEquipmentInternalScore, resolveEquipmentScoreTier } from "../lib/equipmentScoring";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import type {
  EquipmentQuality,
  EquipmentRank,
  EquipmentSlot,
  EquipmentSubtype,
  GeneratedEquipment
} from "../types/game";

type InventoryTab = "equipment" | "consumable" | "material";
type SortBy = "scoreDesc" | "qualityDesc" | "rankDesc" | "affixDesc" | "nameAsc" | "nameDesc";
type TagGroupKey = "quality" | "rank" | "slot";

const qualityOrder: Record<EquipmentQuality, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5
};

const rankOrder: Record<EquipmentRank, number> = {
  crude: 0,
  fine: 1,
  superior: 2,
  perfect: 3
};

function formatStatValue(value: number): string {
  if (Math.abs(value) > 0 && Math.abs(value) < 1) {
    return `${(value * 100).toFixed(2)}%`;
  }
  if (Number.isInteger(value)) {
    return `${value}`;
  }
  return value.toFixed(2);
}

function initialsBySubtype(subtype: EquipmentSubtype): string {
  const text = EQUIPMENT_SUBTYPE_LABELS[subtype];
  return text.length >= 2 ? text.slice(0, 2) : text;
}

export function InventoryPage() {
  const { items, refreshItems, getItemOwner } = useEquipmentInventory();
  const [tab, setTab] = useState<InventoryTab>("equipment");
  const [selected, setSelected] = useState<GeneratedEquipment | null>(null);

  const [keyword, setKeyword] = useState("");
  const [qualityFilters, setQualityFilters] = useState<EquipmentQuality[]>([]);
  const [rankFilters, setRankFilters] = useState<EquipmentRank[]>([]);
  const [slotFilters, setSlotFilters] = useState<EquipmentSlot[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("scoreDesc");
  const [expandedGroups, setExpandedGroups] = useState<Record<TagGroupKey, boolean>>({
    quality: true,
    rank: true,
    slot: false
  });

  const heroNameMap = useMemo(
    () =>
      heroes.reduce<Record<string, string>>((map, hero) => {
        map[hero.id] = hero.name;
        return map;
      }, {}),
    []
  );

  const entries = useMemo(
    () =>
      items.map((item) => {
        const score = computeEquipmentInternalScore(item);
        const owner = getItemOwner(item.uid);
        return {
          item,
          score,
          tier: resolveEquipmentScoreTier(score),
          owner
        };
      }),
    [getItemOwner, items]
  );

  const visibleEntries = useMemo(() => {
    const key = keyword.trim().toLowerCase();

    const filtered = entries.filter(({ item }) => {
      if (qualityFilters.length > 0 && !qualityFilters.includes(item.quality)) {
        return false;
      }
      if (rankFilters.length > 0 && !rankFilters.includes(item.rank)) {
        return false;
      }
      if (slotFilters.length > 0 && !slotFilters.includes(item.slot)) {
        return false;
      }
      if (key.length === 0) {
        return true;
      }
      return (
        item.templateName.toLowerCase().includes(key) ||
        EQUIPMENT_SUBTYPE_LABELS[item.subtype].toLowerCase().includes(key) ||
        EQUIPMENT_SLOT_LABELS[item.slot].toLowerCase().includes(key)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "scoreDesc") {
        return b.score - a.score;
      }
      if (sortBy === "qualityDesc") {
        if (qualityOrder[b.item.quality] !== qualityOrder[a.item.quality]) {
          return qualityOrder[b.item.quality] - qualityOrder[a.item.quality];
        }
        return b.score - a.score;
      }
      if (sortBy === "rankDesc") {
        if (rankOrder[b.item.rank] !== rankOrder[a.item.rank]) {
          return rankOrder[b.item.rank] - rankOrder[a.item.rank];
        }
        return b.score - a.score;
      }
      if (sortBy === "affixDesc") {
        if (b.item.affixCount !== a.item.affixCount) {
          return b.item.affixCount - a.item.affixCount;
        }
        return b.score - a.score;
      }
      if (sortBy === "nameAsc") {
        return a.item.templateName.localeCompare(b.item.templateName, "zh-CN");
      }
      return b.item.templateName.localeCompare(a.item.templateName, "zh-CN");
    });
  }, [entries, keyword, qualityFilters, rankFilters, slotFilters, sortBy]);

  const qualitySummary = useMemo(() => {
    const map = {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      mythic: 0
    };
    visibleEntries.forEach(({ item }) => {
      map[item.quality] += 1;
    });
    return map;
  }, [visibleEntries]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      return;
    }
    if (!items.some((item) => item.uid === selected.uid)) {
      setSelected(null);
    }
  }, [items, selected]);

  const toggleQuality = (quality: EquipmentQuality) => {
    setQualityFilters((prev) => (prev.includes(quality) ? prev.filter((item) => item !== quality) : [...prev, quality]));
  };

  const toggleRank = (rank: EquipmentRank) => {
    setRankFilters((prev) => (prev.includes(rank) ? prev.filter((item) => item !== rank) : [...prev, rank]));
  };

  const toggleSlot = (slot: EquipmentSlot) => {
    setSlotFilters((prev) => (prev.includes(slot) ? prev.filter((item) => item !== slot) : [...prev, slot]));
  };

  const clearFilters = () => {
    setKeyword("");
    setQualityFilters([]);
    setRankFilters([]);
    setSlotFilters([]);
    setSortBy("scoreDesc");
  };

  const toggleGroup = (group: TagGroupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  const selectedOwner = selected ? getItemOwner(selected.uid) : null;

  return (
    <section className="page inventory-page">
      <header className="page-header">
        <h1>背包</h1>
        <p>装备页已支持筛选、排序与详情分模块展示。</p>
      </header>

      <section className="inventory-shell">
        <div className="inventory-tabs">
          <button type="button" className={tab === "equipment" ? "active" : ""} onClick={() => setTab("equipment")}>
            装备
          </button>
          <button type="button" className={tab === "consumable" ? "active" : ""} onClick={() => setTab("consumable")}>
            消耗品
          </button>
          <button type="button" className={tab === "material" ? "active" : ""} onClick={() => setTab("material")}>
            材料
          </button>
          <button type="button" className="ghost-btn" onClick={refreshItems}>
            刷新样本
          </button>
        </div>

        {tab === "equipment" ? (
          <div className="inventory-content">
            <aside className="inventory-summary-card">
              <h3>装备概览</h3>
              <p>
                结果：{visibleEntries.length} / 总数：{items.length}
              </p>
              <div className="inventory-quality-grid">
                {(Object.keys(qualitySummary) as Array<keyof typeof qualitySummary>).map((quality) => (
                  <div key={quality}>
                    <span className={`quality-badge quality-${quality}`}>{EQUIPMENT_QUALITY_LABELS[quality]}</span>
                    <strong>{qualitySummary[quality]}</strong>
                  </div>
                ))}
              </div>
            </aside>

            <div className="inventory-main">
              <div className="inventory-toolbar">
                <label>
                  关键词
                  <input
                    type="text"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="名称 / 子类型 / 部位"
                  />
                </label>
                <label>
                  排序
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                    <option value="scoreDesc">综合分档</option>
                    <option value="qualityDesc">品质优先</option>
                    <option value="rankDesc">品阶优先</option>
                    <option value="affixDesc">词条数量</option>
                    <option value="nameAsc">名称 A-Z</option>
                    <option value="nameDesc">名称 Z-A</option>
                  </select>
                </label>
              </div>

              <div className="inventory-tag-groups">
                <section className="inventory-tag-group">
                  <button type="button" className="inventory-tag-group-toggle" onClick={() => toggleGroup("quality")}>
                    <span>品质</span>
                    <small>{qualityFilters.length} 已选</small>
                  </button>
                  {expandedGroups.quality ? (
                    <div className="inventory-tag-row">
                      {(Object.keys(EQUIPMENT_QUALITY_LABELS) as EquipmentQuality[]).map((quality) => (
                        <button
                          key={quality}
                          type="button"
                          className={`inventory-tag-chip ${qualityFilters.includes(quality) ? "active" : ""}`}
                          onClick={() => toggleQuality(quality)}
                        >
                          {EQUIPMENT_QUALITY_LABELS[quality]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="inventory-tag-group">
                  <button type="button" className="inventory-tag-group-toggle" onClick={() => toggleGroup("rank")}>
                    <span>品阶</span>
                    <small>{rankFilters.length} 已选</small>
                  </button>
                  {expandedGroups.rank ? (
                    <div className="inventory-tag-row">
                      {(Object.keys(EQUIPMENT_RANK_LABELS) as EquipmentRank[]).map((rank) => (
                        <button
                          key={rank}
                          type="button"
                          className={`inventory-tag-chip ${rankFilters.includes(rank) ? "active" : ""}`}
                          onClick={() => toggleRank(rank)}
                        >
                          {EQUIPMENT_RANK_LABELS[rank]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="inventory-tag-group">
                  <button type="button" className="inventory-tag-group-toggle" onClick={() => toggleGroup("slot")}>
                    <span>部位</span>
                    <small>{slotFilters.length} 已选</small>
                  </button>
                  {expandedGroups.slot ? (
                    <div className="inventory-tag-row">
                      {(Object.keys(EQUIPMENT_SLOT_LABELS) as EquipmentSlot[]).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`inventory-tag-chip ${slotFilters.includes(slot) ? "active" : ""}`}
                          onClick={() => toggleSlot(slot)}
                        >
                          {EQUIPMENT_SLOT_LABELS[slot]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>

                <div className="inventory-tag-actions">
                  <button type="button" className="ghost-btn" onClick={clearFilters}>
                    一键清空
                  </button>
                </div>
              </div>

              <div className="inventory-grid">
                {visibleEntries.map(({ item, tier, owner }) => (
                  <button key={item.uid} type="button" className={`inventory-item-card tier-${tier}`} onClick={() => setSelected(item)}>
                    <div className="inventory-thumb">{initialsBySubtype(item.subtype)}</div>
                    <div className="inventory-item-meta">
                      <h4>{item.templateName}</h4>
                      <p>{EQUIPMENT_SUBTYPE_LABELS[item.subtype]}</p>
                      {owner ? (
                        <div className="inventory-owner-badge">
                          已装备：{heroNameMap[owner.heroId] ?? owner.heroId}
                        </div>
                      ) : null}
                      <div className="inventory-badges">
                        <span className={`quality-badge quality-${item.quality}`}>{EQUIPMENT_QUALITY_LABELS[item.quality]}</span>
                        <span className={`rank-badge rank-${item.rank}`}>{EQUIPMENT_RANK_LABELS[item.rank]}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="inventory-placeholder">
            <h3>{tab === "consumable" ? "消耗品" : "材料"}子界面</h3>
            <p>该子界面当前为占位，后续可接入实际背包分类与筛选逻辑。</p>
          </div>
        )}
      </section>

      {selected ? (
        <div className="inventory-modal-backdrop" role="presentation" onClick={() => setSelected(null)}>
          <article
            className="inventory-detail-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <h2>
                  {selected.templateName}
                  <span className="inventory-name-level">Lv.{selected.level}</span>
                  <span className="inventory-name-slot">{EQUIPMENT_SLOT_LABELS[selected.slot]}</span>
                </h2>
                <p className="inventory-subtype-line">
                  <span>{EQUIPMENT_SUBTYPE_LABELS[selected.subtype]}</span>
                  <strong className={`quality-${selected.quality}`}>{EQUIPMENT_QUALITY_LABELS[selected.quality]}</strong>
                </p>
                <div className="inventory-header-meta">
                  <span className={`rank-${selected.rank}`}>品阶：{EQUIPMENT_RANK_LABELS[selected.rank]}</span>
                  <span className="meta-socket">插槽：{selected.sockets}</span>
                  {selectedOwner ? (
                    <span className="meta-equipped-owner">
                      已装备：{heroNameMap[selectedOwner.heroId] ?? selectedOwner.heroId}
                    </span>
                  ) : (
                    <span className="meta-equipped-owner">未装备</span>
                  )}
                </div>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setSelected(null)}>
                <X size={16} />
              </button>
            </header>

            <section className="inventory-detail-block">
              <h3>T1 基础属性（受 Rank 增幅）</h3>
              <div className="inventory-detail-list">
                {selected.t1Stats.map((stat) => (
                  <p key={`t1-${stat.key}-${stat.label}`}>
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

            <section className="inventory-detail-block">
              <h3>T2 附加词条（不去重随机）</h3>
              {selected.affixes.length > 0 ? (
                <div className="inventory-detail-list">
                  {selected.affixes.map((affix, idx) => (
                    <p key={`affix-${idx}-${affix.key}`}>
                      <span>{affix.label}</span>
                      <strong>{formatStatValue(affix.finalValue)}</strong>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="empty-affix">当前品质无附加词条。</p>
              )}
            </section>
          </article>
        </div>
      ) : null}
    </section>
  );
}
