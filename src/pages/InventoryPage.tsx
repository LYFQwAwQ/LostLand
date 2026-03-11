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
  GeneratedEquipment,
  InventoryConsumableStack,
  InventoryMaterialStack,
  InventoryMemoryStack,
  InventoryResourceRarity
} from "../types/game";

type InventoryTab = "equipment" | "consumable" | "material" | "memory";
type SortBy = "scoreDesc" | "qualityDesc" | "rankDesc" | "affixDesc" | "nameAsc" | "nameDesc";
type ResourceSortBy = "quantityDesc" | "rarityDesc" | "nameAsc" | "nameDesc";
type MemorySortBy = "equippedFirst" | "nameAsc" | "nameDesc";
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

const resourceRarityOrder: Record<InventoryResourceRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3
};

const resourceRarityLabels: Record<InventoryResourceRarity, string> = {
  common: "普通",
  uncommon: "优秀",
  rare: "稀有",
  epic: "史诗"
};

const heroClassLabels: Record<InventoryMemoryStack["heroClass"], string> = {
  paladin: "圣骑士",
  mage: "法师",
  ranger: "游侠",
  priest: "祭司"
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

function formatMaterialSources(sourceEnemyPrototypeIds: string[]): string {
  if (sourceEnemyPrototypeIds.length <= 0) {
    return "未知";
  }
  return sourceEnemyPrototypeIds
    .map((id) => {
      if (id === "default") {
        return "通用掉落";
      }
      if (id === "unknown") {
        return "未知来源";
      }
      return id;
    })
    .join(" / ");
}

function sortResourceEntries<T extends { name: string; rarity: InventoryResourceRarity; quantity: number }>(
  entries: T[],
  sortBy: ResourceSortBy
): T[] {
  return [...entries].sort((left, right) => {
    if (sortBy === "quantityDesc") {
      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    }
    if (sortBy === "rarityDesc") {
      if (resourceRarityOrder[right.rarity] !== resourceRarityOrder[left.rarity]) {
        return resourceRarityOrder[right.rarity] - resourceRarityOrder[left.rarity];
      }
      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }
      return left.name.localeCompare(right.name, "zh-CN");
    }
    if (sortBy === "nameAsc") {
      return left.name.localeCompare(right.name, "zh-CN");
    }
    return right.name.localeCompare(left.name, "zh-CN");
  });
}

function buildRaritySummary(items: Array<{ rarity: InventoryResourceRarity }>): Record<InventoryResourceRarity, number> {
  const summary: Record<InventoryResourceRarity, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0
  };
  items.forEach((item) => {
    summary[item.rarity] += 1;
  });
  return summary;
}

export function InventoryPage() {
  const { items, refreshItems, getItemOwner, materialItems, consumableItems, memoryItems, getMemoryOwner } = useEquipmentInventory();
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

  const [resourceKeyword, setResourceKeyword] = useState("");
  const [resourceRarityFilters, setResourceRarityFilters] = useState<InventoryResourceRarity[]>([]);
  const [resourceSortBy, setResourceSortBy] = useState<ResourceSortBy>("quantityDesc");
  const [memoryKeyword, setMemoryKeyword] = useState("");
  const [memoryClassFilters, setMemoryClassFilters] = useState<Array<InventoryMemoryStack["heroClass"]>>([]);
  const [memorySortBy, setMemorySortBy] = useState<MemorySortBy>("equippedFirst");

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

  const visibleMaterialItems = useMemo(() => {
    const key = resourceKeyword.trim().toLowerCase();
    const filtered = materialItems.filter((item) => {
      if (item.quantity <= 0) {
        return false;
      }
      if (resourceRarityFilters.length > 0 && !resourceRarityFilters.includes(item.rarity)) {
        return false;
      }
      if (key.length <= 0) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(key) ||
        formatMaterialSources(item.sourceEnemyPrototypeIds).toLowerCase().includes(key) ||
        item.id.toLowerCase().includes(key)
      );
    });
    return sortResourceEntries(filtered, resourceSortBy);
  }, [materialItems, resourceKeyword, resourceRarityFilters, resourceSortBy]);

  const visibleConsumableItems = useMemo(() => {
    const key = resourceKeyword.trim().toLowerCase();
    const filtered = consumableItems.filter((item) => {
      if (resourceRarityFilters.length > 0 && !resourceRarityFilters.includes(item.rarity)) {
        return false;
      }
      if (key.length <= 0) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(key) ||
        item.effectSummary.toLowerCase().includes(key) ||
        item.source.toLowerCase().includes(key) ||
        item.id.toLowerCase().includes(key)
      );
    });
    return sortResourceEntries(filtered, resourceSortBy);
  }, [consumableItems, resourceKeyword, resourceRarityFilters, resourceSortBy]);

  const visibleMemoryEntries = useMemo(() => {
    const keyword = memoryKeyword.trim().toLowerCase();
    const filtered = memoryItems
      .map((item) => ({
        item,
        ownerHeroId: getMemoryOwner(item.id)
      }))
      .filter(({ item }) => {
        if (memoryClassFilters.length > 0 && !memoryClassFilters.includes(item.heroClass)) {
          return false;
        }
        if (keyword.length <= 0) {
          return true;
        }
        return (
          item.title.toLowerCase().includes(keyword) ||
          item.quote.toLowerCase().includes(keyword) ||
          item.effect.toLowerCase().includes(keyword) ||
          item.id.toLowerCase().includes(keyword)
        );
      });

    return [...filtered].sort((left, right) => {
      if (memorySortBy === "equippedFirst") {
        const leftEquipped = left.ownerHeroId ? 1 : 0;
        const rightEquipped = right.ownerHeroId ? 1 : 0;
        if (rightEquipped !== leftEquipped) {
          return rightEquipped - leftEquipped;
        }
        return left.item.title.localeCompare(right.item.title, "zh-CN");
      }
      if (memorySortBy === "nameAsc") {
        return left.item.title.localeCompare(right.item.title, "zh-CN");
      }
      return right.item.title.localeCompare(left.item.title, "zh-CN");
    });
  }, [getMemoryOwner, memoryClassFilters, memoryItems, memoryKeyword, memorySortBy]);

  const activeResourceItems = tab === "material" ? visibleMaterialItems : tab === "consumable" ? visibleConsumableItems : [];

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

  const activeResourceSummary = useMemo(() => {
    return buildRaritySummary(activeResourceItems);
  }, [activeResourceItems]);

  const activeResourceQuantity = useMemo(() => {
    return activeResourceItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [activeResourceItems]);

  const memorySummary = useMemo(() => {
    const byClass: Record<InventoryMemoryStack["heroClass"], number> = {
      paladin: 0,
      mage: 0,
      ranger: 0,
      priest: 0
    };
    let equippedCount = 0;
    visibleMemoryEntries.forEach((entry) => {
      byClass[entry.item.heroClass] += 1;
      if (entry.ownerHeroId) {
        equippedCount += 1;
      }
    });
    return {
      total: visibleMemoryEntries.length,
      equippedCount,
      byClass
    };
  }, [visibleMemoryEntries]);

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

  useEffect(() => {
    if (tab !== "equipment" && selected) {
      setSelected(null);
    }
  }, [selected, tab]);

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

  const toggleResourceRarity = (rarity: InventoryResourceRarity) => {
    setResourceRarityFilters((prev) => (prev.includes(rarity) ? prev.filter((item) => item !== rarity) : [...prev, rarity]));
  };

  const clearResourceFilters = () => {
    setResourceKeyword("");
    setResourceRarityFilters([]);
    setResourceSortBy("quantityDesc");
  };

  const toggleMemoryClass = (heroClass: InventoryMemoryStack["heroClass"]) => {
    setMemoryClassFilters((prev) => (prev.includes(heroClass) ? prev.filter((item) => item !== heroClass) : [...prev, heroClass]));
  };

  const clearMemoryFilters = () => {
    setMemoryKeyword("");
    setMemoryClassFilters([]);
    setMemorySortBy("equippedFirst");
  };

  const selectedOwner = selected ? getItemOwner(selected.uid) : null;

  return (
    <section className="page inventory-page">
      <header className="page-header">
        <h1>背包</h1>
        <p>装备、材料、消耗品与记忆统一使用全局背包状态，支持分类筛选与排序。</p>
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
          <button type="button" className={tab === "memory" ? "active" : ""} onClick={() => setTab("memory")}>
            记忆
          </button>
          <button type="button" className="ghost-btn" onClick={refreshItems} disabled={tab !== "equipment"}>
            刷新装备样本
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
        ) : tab === "memory" ? (
          <div className="inventory-content">
            <aside className="inventory-summary-card">
              <h3>记忆概览</h3>
              <p>
                条目：{memorySummary.total} · 已装备：{memorySummary.equippedCount}
              </p>
              <div className="inventory-quality-grid">
                {(Object.keys(memorySummary.byClass) as Array<keyof typeof memorySummary.byClass>).map((heroClass) => (
                  <div key={heroClass}>
                    <span className="rank-badge">{heroClassLabels[heroClass]}</span>
                    <strong>{memorySummary.byClass[heroClass]}</strong>
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
                    value={memoryKeyword}
                    onChange={(event) => setMemoryKeyword(event.target.value)}
                    placeholder="标题 / 描述 / 效果"
                  />
                </label>
                <label>
                  排序
                  <select value={memorySortBy} onChange={(event) => setMemorySortBy(event.target.value as MemorySortBy)}>
                    <option value="equippedFirst">已装备优先</option>
                    <option value="nameAsc">名称 A-Z</option>
                    <option value="nameDesc">名称 Z-A</option>
                  </select>
                </label>
              </div>

              <div className="inventory-tag-groups">
                <section className="inventory-tag-group">
                  <button type="button" className="inventory-tag-group-toggle">
                    <span>职业</span>
                    <small>{memoryClassFilters.length} 已选</small>
                  </button>
                  <div className="inventory-tag-row">
                    {(Object.keys(heroClassLabels) as InventoryMemoryStack["heroClass"][]).map((heroClass) => (
                      <button
                        key={heroClass}
                        type="button"
                        className={`inventory-tag-chip ${memoryClassFilters.includes(heroClass) ? "active" : ""}`}
                        onClick={() => toggleMemoryClass(heroClass)}
                      >
                        {heroClassLabels[heroClass]}
                      </button>
                    ))}
                  </div>
                </section>
                <div className="inventory-tag-actions">
                  <button type="button" className="ghost-btn" onClick={clearMemoryFilters}>
                    一键清空
                  </button>
                </div>
              </div>

              {visibleMemoryEntries.length > 0 ? (
                <div className="inventory-memory-grid">
                  {visibleMemoryEntries.map(({ item, ownerHeroId }) => (
                    <article key={item.id} className={`inventory-memory-card ${ownerHeroId ? "equipped" : ""}`}>
                      <header>
                        <h4>{item.title}</h4>
                        <span className="rank-badge">{heroClassLabels[item.heroClass]}</span>
                      </header>
                      <p className="inventory-resource-effect">“{item.quote}”</p>
                      <p className="inventory-resource-meta">{item.effect}</p>
                      <p className="inventory-memory-owner">
                        {ownerHeroId ? `已装备：${heroNameMap[ownerHeroId] ?? ownerHeroId}` : "未装备"}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="inventory-placeholder">
                  <h3>记忆结果为空</h3>
                  <p>当前筛选条件下没有可显示条目。</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="inventory-content">
            <aside className="inventory-summary-card">
              <h3>{tab === "consumable" ? "消耗品概览" : "材料概览"}</h3>
              <p>
                条目：{activeResourceItems.length} · 总库存：{activeResourceQuantity}
              </p>
              <div className="inventory-quality-grid">
                {(Object.keys(activeResourceSummary) as InventoryResourceRarity[]).map((rarity) => (
                  <div key={rarity}>
                    <span className={`quality-badge quality-${rarity}`}>{resourceRarityLabels[rarity]}</span>
                    <strong>{activeResourceSummary[rarity]}</strong>
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
                    value={resourceKeyword}
                    onChange={(event) => setResourceKeyword(event.target.value)}
                    placeholder={tab === "material" ? "材料名 / 来源怪物" : "名称 / 效果 / 来源"}
                  />
                </label>
                <label>
                  排序
                  <select value={resourceSortBy} onChange={(event) => setResourceSortBy(event.target.value as ResourceSortBy)}>
                    <option value="quantityDesc">库存优先</option>
                    <option value="rarityDesc">稀有度优先</option>
                    <option value="nameAsc">名称 A-Z</option>
                    <option value="nameDesc">名称 Z-A</option>
                  </select>
                </label>
              </div>

              <div className="inventory-tag-groups">
                <section className="inventory-tag-group">
                  <button type="button" className="inventory-tag-group-toggle">
                    <span>稀有度</span>
                    <small>{resourceRarityFilters.length} 已选</small>
                  </button>
                  <div className="inventory-tag-row">
                    {(Object.keys(resourceRarityLabels) as InventoryResourceRarity[]).map((rarity) => (
                      <button
                        key={rarity}
                        type="button"
                        className={`inventory-tag-chip ${resourceRarityFilters.includes(rarity) ? "active" : ""}`}
                        onClick={() => toggleResourceRarity(rarity)}
                      >
                        {resourceRarityLabels[rarity]}
                      </button>
                    ))}
                  </div>
                </section>
                <div className="inventory-tag-actions">
                  <button type="button" className="ghost-btn" onClick={clearResourceFilters}>
                    一键清空
                  </button>
                </div>
              </div>

              {tab === "consumable" ? (
                <div className="inventory-todo-note">TODO：消耗品当前为示例库存，待接入正式产出与消耗逻辑。</div>
              ) : null}

              {activeResourceItems.length > 0 ? (
                <div className="inventory-resource-grid">
                  {tab === "material"
                    ? (activeResourceItems as InventoryMaterialStack[]).map((item) => (
                        <article key={item.id} className="inventory-resource-card">
                          <h4>{item.name}</h4>
                          <p className="inventory-resource-quantity">库存 x{item.quantity}</p>
                          <p className="inventory-resource-meta">来源怪物：{formatMaterialSources(item.sourceEnemyPrototypeIds)}</p>
                          <div className="inventory-badges">
                            <span className={`quality-badge quality-${item.rarity}`}>{resourceRarityLabels[item.rarity]}</span>
                            <span className="rank-badge">ID: {item.id}</span>
                          </div>
                        </article>
                      ))
                    : (activeResourceItems as InventoryConsumableStack[]).map((item) => (
                        <article key={item.id} className="inventory-resource-card">
                          <h4>{item.name}</h4>
                          <p className="inventory-resource-effect">{item.effectSummary}</p>
                          <p className="inventory-resource-quantity">
                            库存 x{item.quantity} / 上限 {item.maxStack}
                          </p>
                          <p className="inventory-resource-meta">来源：{item.source}</p>
                          <div className="inventory-badges">
                            <span className={`quality-badge quality-${item.rarity}`}>{resourceRarityLabels[item.rarity]}</span>
                            <span className="rank-badge">ID: {item.id}</span>
                          </div>
                        </article>
                      ))}
                </div>
              ) : (
                <div className="inventory-placeholder">
                  <h3>{tab === "consumable" ? "消耗品" : "材料"}结果为空</h3>
                  <p>当前筛选条件下没有可显示条目。</p>
                </div>
              )}
            </div>
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
