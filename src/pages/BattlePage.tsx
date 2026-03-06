import { FastForward, Gauge, Pause, Play, RotateCcw, Shield, Swords, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { heroes } from "../data/mockData";
import { buildAllyTeamTemplates, buildEnemyTeamTemplates } from "../lib/battleAdapters";
import { endBattle, createBattleRuntime, setBattleRunning, setBattleSpeed, stepBattle } from "../lib/battleEngine";
import { EQUIPMENT_SLOT_LABELS, EQUIPMENT_SUBTYPE_LABELS } from "../lib/equipmentCatalog";
import { EQUIPMENT_QUALITY_LABELS, EQUIPMENT_RANK_LABELS } from "../lib/equipmentSystem";
import { useBattleSetup } from "../state/BattleSetupProvider";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { useMapSystem } from "../state/MapSystemProvider";
import type {
  BattleDropCategory,
  BattleLine,
  BattleRuntimeState,
  BattleRuntimeUnit,
  BattleSide
} from "../types/battle";
import type { EquipmentQuality, EquipmentRank, EquipmentSlot } from "../types/game";

type DropEquipmentSortBy = "qualityDesc" | "rankDesc" | "nameAsc" | "nameDesc";

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getSideUnits(units: BattleRuntimeUnit[], side: BattleSide, line: BattleLine): Array<BattleRuntimeUnit | null> {
  const group = units.filter((unit) => unit.side === side && unit.slot.line === line);
  return [0, 1, 2].map((index) => group.find((unit) => unit.slot.index === index) ?? null);
}

function UnitSlot({ unit, side }: { unit: BattleRuntimeUnit | null; side: BattleSide }) {
  if (!unit) {
    return (
      <div className={`battle-unit-slot empty ${side}`}>
        <Shield size={18} />
        <span>空位</span>
      </div>
    );
  }

  const hpRatio = clamp(unit.currentHp / unit.stats.maxHp, 0, 1);
  const mpRatio = unit.stats.maxMp > 0 ? clamp(unit.currentMp / unit.stats.maxMp, 0, 1) : 0;
  const actionRatio = clamp(unit.actionValue / 10000, 0, 1);

  return (
    <div className={`battle-unit-slot ${side} ${unit.alive ? "" : "defeated"}`}>
      <header>
        <strong>{unit.name}</strong>
        <small>AGI {unit.stats.agi}</small>
      </header>
      <div className="battle-unit-bars">
        <div className="bar-row hp">
          <span style={{ width: `${hpRatio * 100}%` }} />
        </div>
        <div className="bar-row mp">
          <span style={{ width: `${mpRatio * 100}%` }} />
        </div>
        <div className="bar-row action">
          <span style={{ width: `${actionRatio * 100}%` }} />
        </div>
      </div>
      <p className="battle-unit-meta">
        HP {Math.round(unit.currentHp)}/{Math.round(unit.stats.maxHp)} · MP {Math.round(unit.currentMp)}/{Math.round(unit.stats.maxMp)}
      </p>
      <p className="battle-unit-status">
        {unit.statuses.length > 0
          ? unit.statuses.map((status) => `${status.key}(${status.remainingTurns})`).join(" / ")
          : "无异常状态"}
      </p>
    </div>
  );
}

function BattleFormation({
  title,
  side,
  units
}: {
  title: string;
  side: BattleSide;
  units: BattleRuntimeUnit[];
}) {
  const front = getSideUnits(units, side, "front");
  const back = getSideUnits(units, side, "back");

  return (
    <section className={`battle-side-panel ${side}`}>
      <header>
        <h3>{title}</h3>
        <p>前排最多 3 人 · 后排最多 3 人</p>
      </header>
      <div className="battle-line-block">
        <span className="battle-line-label">前排</span>
        <div className="battle-line-grid">
          {front.map((unit, index) => (
            <UnitSlot key={`front-${index}`} unit={unit} side={side} />
          ))}
        </div>
      </div>
      <div className="battle-line-block">
        <span className="battle-line-label">后排</span>
        <div className="battle-line-grid">
          {back.map((unit, index) => (
            <UnitSlot key={`back-${index}`} unit={unit} side={side} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BattleTimeline({ runtime }: { runtime: BattleRuntimeState }) {
  const queue = runtime.units
    .filter((unit) => unit.alive)
    .sort((left, right) => right.actionValue - left.actionValue)
    .slice(0, 8);

  return (
    <div className="battle-timeline-card">
      <h3>行动队列</h3>
      <div className="battle-timeline-list">
        {queue.map((unit) => (
          <div key={unit.id} className="battle-timeline-row">
            <span>{unit.name}</span>
            <small>{Math.round(unit.actionValue)}/10000</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BattlePage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const { findNodeById } = useMapSystem();
  const { formation, heroLoadouts } = useBattleSetup();
  const { equippedByHero, itemMap } = useEquipmentInventory();
  const [battleSeed, setBattleSeed] = useState(() => Date.now());
  const [chainRound, setChainRound] = useState(1);
  const [activeReplayView, setActiveReplayView] = useState("stats");
  const [isReplayModalOpen, setIsReplayModalOpen] = useState(false);

  const [dropCategoryFilter, setDropCategoryFilter] = useState<"all" | BattleDropCategory>("all");
  const [dropKeyword, setDropKeyword] = useState("");
  const [dropQualityFilters, setDropQualityFilters] = useState<EquipmentQuality[]>([]);
  const [dropRankFilters, setDropRankFilters] = useState<EquipmentRank[]>([]);
  const [dropSlotFilters, setDropSlotFilters] = useState<EquipmentSlot[]>([]);
  const [dropEquipmentSortBy, setDropEquipmentSortBy] = useState<DropEquipmentSortBy>("qualityDesc");

  const context = useMemo(() => findNodeById(nodeId), [findNodeById, nodeId]);

  const baseAllies = useMemo(() => {
    if (!context) {
      return null;
    }
    return buildAllyTeamTemplates(heroes, formation, heroLoadouts, equippedByHero, itemMap);
  }, [context, equippedByHero, formation, heroLoadouts, itemMap]);

  const buildRuntimeForRound = (round: number, previous?: BattleRuntimeState | null): BattleRuntimeState | null => {
    if (!context || !baseAllies) {
      return null;
    }

    const enemies = buildEnemyTeamTemplates(
      `${context.node.id}-round-${battleSeed}-${round}`,
      context.node.archetype,
      context.region.mapSuppression
    );
    const created = createBattleRuntime({
      battleId: `${context.node.id}-${battleSeed}-round-${round}`,
      nodeId: context.node.id,
      suppression: context.region.mapSuppression,
      archetype: context.node.archetype,
      allyTeam: baseAllies,
      enemyTeam: enemies
    });

    if (!previous) {
      return created;
    }

    const previousAllyMap = new Map(previous.units.filter((unit) => unit.side === "ally").map((unit) => [unit.id, unit]));
    created.units.forEach((unit) => {
      if (unit.side !== "ally") {
        return;
      }
      const prev = previousAllyMap.get(unit.id);
      if (!prev) {
        return;
      }
      unit.currentHp = Math.max(0, Math.min(unit.stats.maxHp, prev.currentHp));
      unit.currentMp = Math.max(0, Math.min(unit.stats.maxMp, prev.currentMp));
      unit.alive = unit.currentHp > 0;
      unit.statuses = [];
      unit.actionValue = 0;
      Object.keys(unit.cooldowns).forEach((key) => {
        unit.cooldowns[key] = 0;
      });
    });

    const hasAliveAlly = created.units.some((unit) => unit.side === "ally" && unit.alive);
    if (!hasAliveAlly) {
      return previous;
    }

    return setBattleRunning(setBattleSpeed(created, previous.speedMultiplier), true);
  };

  const initialRuntime = useMemo(() => {
    if (!context || !baseAllies) {
      return null;
    }
    return buildRuntimeForRound(1);
  }, [baseAllies, battleSeed, context]);

  const [runtime, setRuntime] = useState<BattleRuntimeState | null>(initialRuntime);

  useEffect(() => {
    setChainRound(1);
    setRuntime(initialRuntime);
  }, [initialRuntime]);

  useEffect(() => {
    if (!runtime || runtime.status !== "finished") {
      return;
    }
    if (runtime.winner !== "ally") {
      return;
    }
    const hasAliveAlly = runtime.units.some((unit) => unit.side === "ally" && unit.alive);
    if (!hasAliveAlly) {
      return;
    }
    if (isReplayModalOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextRound = chainRound + 1;
      const nextRuntime = buildRuntimeForRound(nextRound, runtime);
      if (!nextRuntime || nextRuntime === runtime) {
        return;
      }
      setChainRound(nextRound);
      setRuntime(nextRuntime);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [chainRound, isReplayModalOpen, runtime]);

  useEffect(() => {
    if (!runtime) {
      return;
    }
    const canChainToNextRound =
      runtime.status === "finished" &&
      runtime.winner === "ally" &&
      runtime.units.some((unit) => unit.side === "ally" && unit.alive);

    if (runtime.status === "finished" && !canChainToNextRound) {
      setIsReplayModalOpen(true);
      return;
    }
    setIsReplayModalOpen(false);
  }, [runtime]);

  useEffect(() => {
    if (!runtime || runtime.status !== "running") {
      return;
    }
    const timer = window.setInterval(() => {
      setRuntime((prev) => (prev ? stepBattle(prev, 16) : prev));
    }, 16);
    return () => window.clearInterval(timer);
  }, [runtime?.status]);

  useEffect(() => {
    if (!runtime) {
      return;
    }
    const views = runtime.replay.views.map((view) => view.key);
    if (views.length > 0 && !views.includes(activeReplayView)) {
      setActiveReplayView(views[0]);
    }
  }, [activeReplayView, runtime]);

  if (!context || !runtime) {
    return (
      <section className="page">
        <header className="page-header">
          <h1>战斗节点不存在</h1>
          <p>未找到对应节点，请返回地图重新选择。</p>
        </header>
        <Link className="back-link" to="/">
          返回世界地图
        </Link>
      </section>
    );
  }

  const backLink = `/node/${context.node.id}?region=${context.region.id}`;
  const isRunning = runtime.status === "running";
  const isFinished = runtime.status === "finished";
  const canChainToNextRound = isFinished && runtime.winner === "ally" && runtime.units.some((unit) => unit.side === "ally" && unit.alive);
  const shouldShowReplayUi = isFinished && !canChainToNextRound;
  const allyAlive = runtime.units.filter((unit) => unit.side === "ally" && unit.alive).length;
  const enemyAlive = runtime.units.filter((unit) => unit.side === "enemy" && unit.alive).length;
  const logList = runtime.logs.slice(-26).reverse();
  const allyStats = runtime.replay.unitStats
    .filter((stat) => stat.side === "ally")
    .sort((left, right) => right.damageDealt - left.damageDealt);
  const enemyStats = runtime.replay.unitStats
    .filter((stat) => stat.side === "enemy")
    .sort((left, right) => right.damageDealt - left.damageDealt);
  const actionSnapshots = runtime.replay.actionSnapshots.slice(-30).reverse();
  const statusChanges = runtime.replay.statusChanges.slice(-30).reverse();

  const dropEntries = runtime.drops?.entries ?? [];
  const materialDrops = runtime.replay.dropStats.materials;
  const equipmentDrops = dropEntries
    .filter((entry) => entry.category === "equipment" && entry.equipment)
    .map((entry) => entry.equipment!)
    .filter((item) => {
      if (dropCategoryFilter === "all") {
        return true;
      }
      return dropCategoryFilter === "equipment";
    });

  const visibleEquipmentDrops = useMemo(() => {
    const keyword = dropKeyword.trim().toLowerCase();
    const filtered = equipmentDrops.filter((item) => {
      if (dropQualityFilters.length > 0 && !dropQualityFilters.includes(item.quality)) {
        return false;
      }
      if (dropRankFilters.length > 0 && !dropRankFilters.includes(item.rank)) {
        return false;
      }
      if (dropSlotFilters.length > 0 && !dropSlotFilters.includes(item.slot)) {
        return false;
      }
      if (keyword.length === 0) {
        return true;
      }
      return (
        item.templateName.toLowerCase().includes(keyword) ||
        EQUIPMENT_SUBTYPE_LABELS[item.subtype].toLowerCase().includes(keyword) ||
        EQUIPMENT_SLOT_LABELS[item.slot].toLowerCase().includes(keyword)
      );
    });

    return [...filtered].sort((left, right) => {
      if (dropEquipmentSortBy === "qualityDesc") {
        if (qualityOrder[right.quality] !== qualityOrder[left.quality]) {
          return qualityOrder[right.quality] - qualityOrder[left.quality];
        }
      }
      if (dropEquipmentSortBy === "rankDesc") {
        if (rankOrder[right.rank] !== rankOrder[left.rank]) {
          return rankOrder[right.rank] - rankOrder[left.rank];
        }
      }
      if (dropEquipmentSortBy === "nameAsc") {
        return left.templateName.localeCompare(right.templateName, "zh-CN");
      }
      if (dropEquipmentSortBy === "nameDesc") {
        return right.templateName.localeCompare(left.templateName, "zh-CN");
      }
      return right.templateName.localeCompare(left.templateName, "zh-CN");
    });
  }, [dropEquipmentSortBy, dropKeyword, dropQualityFilters, dropRankFilters, dropSlotFilters, equipmentDrops]);

  const shouldShowMaterials = dropCategoryFilter === "all" || dropCategoryFilter === "material";
  const shouldShowEquipment = dropCategoryFilter === "all" || dropCategoryFilter === "equipment";

  const clearDropEquipmentFilters = () => {
    setDropKeyword("");
    setDropQualityFilters([]);
    setDropRankFilters([]);
    setDropSlotFilters([]);
    setDropEquipmentSortBy("qualityDesc");
  };

  const toggleDropQuality = (quality: EquipmentQuality) => {
    setDropQualityFilters((prev) => (prev.includes(quality) ? prev.filter((item) => item !== quality) : [...prev, quality]));
  };
  const toggleDropRank = (rank: EquipmentRank) => {
    setDropRankFilters((prev) => (prev.includes(rank) ? prev.filter((item) => item !== rank) : [...prev, rank]));
  };
  const toggleDropSlot = (slot: EquipmentSlot) => {
    setDropSlotFilters((prev) => (prev.includes(slot) ? prev.filter((item) => item !== slot) : [...prev, slot]));
  };

  return (
    <section className="page battle-page">
      <header className="page-header battle-page-header">
        <h1>实时讨伐：{context.node.name}</h1>
        <p>
          模板 {context.node.archetype} · 第 {chainRound} 场 · 地图压制 {context.region.mapSuppression}% · 我方 {allyAlive} / 敌方{" "}
          {enemyAlive}
        </p>
      </header>

      <div className="battle-top-actions">
        <Link className="back-link" to={backLink}>
          返回节点主界面
        </Link>
        <div className="battle-control-group">
          <button
            type="button"
            className="primary-btn"
            disabled={isFinished}
            onClick={() => setRuntime((prev) => (prev ? setBattleRunning(prev, !isRunning) : prev))}
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
            {isFinished ? "战斗已结束" : isRunning ? "暂停战斗" : "开始战斗"}
          </button>
          <button type="button" className="ghost-btn" disabled={isFinished} onClick={() => setRuntime((prev) => (prev ? endBattle(prev) : prev))}>
            <Swords size={13} />
            结束战斗
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setChainRound(1);
              setRuntime(initialRuntime);
            }}
          >
            <RotateCcw size={13} />
            重置本场
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setChainRound(1);
              setBattleSeed(Date.now());
            }}
          >
            <Swords size={13} />
            重新侦察
          </button>
        </div>
        <div className="battle-speed-group">
          {[1, 2, 3].map((speed) => (
            <button
              key={speed}
              type="button"
              className={`ghost-btn ${runtime.speedMultiplier === speed ? "active" : ""}`}
              onClick={() => setRuntime((prev) => (prev ? setBattleSpeed(prev, speed) : prev))}
            >
              <FastForward size={12} />
              x{speed}
            </button>
          ))}
        </div>
      </div>

      {runtime.status === "finished" ? (
        <div className={`battle-result-banner ${runtime.winner === "ally" ? "win" : "lose"}`}>
          {runtime.winner === "ally" ? "战斗胜利" : "战斗失败"}
        </div>
      ) : null}

      <div className="battle-layout">
        <div className="battle-main-board">
          <BattleFormation title="敌方阵型" side="enemy" units={runtime.units} />
          <BattleTimeline runtime={runtime} />
          <BattleFormation title="我方阵型" side="ally" units={runtime.units} />
        </div>

        <aside className="battle-sidebar">
          <article className="battle-side-card">
            <h3>
              <Gauge size={14} />
              对战信息
            </h3>
            <p>状态：{runtime.status === "running" ? "进行中" : runtime.status === "finished" ? "已结束" : "待开始"}</p>
            <p>战斗耗时：{(runtime.elapsedMs / 1000).toFixed(1)} 秒</p>
            <p>逻辑 Tick：{runtime.tickCount}</p>
            <p>速度倍率：x{runtime.speedMultiplier.toFixed(1)}</p>
            <p>连战规则：胜利后关闭复盘弹窗会继续下一场，HP/MP 继承且不回复</p>
          </article>

          <article className="battle-side-card battle-log-card">
            <h3>战斗日志</h3>
            <div className="battle-log-list">
              {logList.map((entry) => (
                <p key={entry.id} className={`tone-${entry.tone}`}>
                  {entry.text}
                </p>
              ))}
            </div>
          </article>
        </aside>
      </div>

      {shouldShowReplayUi ? (
        <div className="battle-replay-entry">
          <button type="button" className="ghost-btn" onClick={() => setIsReplayModalOpen(true)}>
            查看战斗复盘
          </button>
        </div>
      ) : null}

      {isReplayModalOpen && shouldShowReplayUi ? (
        <div className="battle-replay-modal-backdrop" role="presentation" onClick={() => setIsReplayModalOpen(false)}>
          <article
            className="battle-side-card battle-replay-card battle-replay-modal custom-scrollbar"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="battle-replay-modal-head">
              <h3>战斗复盘</h3>
              <button type="button" aria-label="关闭复盘" onClick={() => setIsReplayModalOpen(false)}>
                <X size={16} />
              </button>
            </header>
            <div className="battle-replay-tabs">
              {runtime.replay.views.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  className={`battle-replay-tab ${activeReplayView === view.key ? "active" : ""}`}
                  onClick={() => setActiveReplayView(view.key)}
                >
                  {view.title}
                </button>
              ))}
            </div>

            {activeReplayView === "stats" ? (
              <div className="battle-replay-panel">
                <h4>我方统计</h4>
                <div className="battle-replay-grid">
                  {allyStats.map((stat) => (
                    <div key={stat.unitId} className="battle-replay-stat-card">
                      <strong>{stat.unitName}</strong>
                      <p>造成伤害：{Math.round(stat.damageDealt)}</p>
                      <p>承受伤害：{Math.round(stat.damageTaken)}</p>
                      <p>治疗量：{Math.round(stat.healDone)}</p>
                      <p>击杀：{stat.kills}</p>
                    </div>
                  ))}
                </div>
                <h4>敌方统计</h4>
                <div className="battle-replay-grid">
                  {enemyStats.map((stat) => (
                    <div key={stat.unitId} className="battle-replay-stat-card">
                      <strong>{stat.unitName}</strong>
                      <p>造成伤害：{Math.round(stat.damageDealt)}</p>
                      <p>承受伤害：{Math.round(stat.damageTaken)}</p>
                      <p>治疗量：{Math.round(stat.healDone)}</p>
                      <p>击杀：{stat.kills}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeReplayView === "drops" ? (
              <div className="battle-replay-panel">
                <div className="battle-drop-summary-row">
                  <p>掉落条目：{runtime.replay.dropStats.totalEntries}</p>
                  <p>装备：{runtime.replay.dropStats.byCategory.equipment}</p>
                  <p>材料：{runtime.replay.dropStats.byCategory.material}</p>
                </div>

                <div className="battle-replay-category-tabs">
                  <button
                    type="button"
                    className={`battle-replay-tab ${dropCategoryFilter === "all" ? "active" : ""}`}
                    onClick={() => setDropCategoryFilter("all")}
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    className={`battle-replay-tab ${dropCategoryFilter === "equipment" ? "active" : ""}`}
                    onClick={() => setDropCategoryFilter("equipment")}
                  >
                    装备
                  </button>
                  <button
                    type="button"
                    className={`battle-replay-tab ${dropCategoryFilter === "material" ? "active" : ""}`}
                    onClick={() => setDropCategoryFilter("material")}
                  >
                    材料
                  </button>
                </div>

                {shouldShowMaterials ? (
                  <section className="battle-replay-block">
                    <h4>材料掉落</h4>
                    {materialDrops.length > 0 ? (
                      <div className="battle-drop-material-list">
                        {materialDrops.map((item) => (
                          <p key={item.materialId}>
                            {item.name} · {item.rarity} · x{item.quantity}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p>暂无材料掉落。</p>
                    )}
                  </section>
                ) : null}

                {shouldShowEquipment ? (
                  <section className="battle-replay-block">
                    <h4>装备掉落（筛选）</h4>
                    <div className="battle-drop-filter-grid">
                      <label>
                        关键词
                        <input
                          type="text"
                          value={dropKeyword}
                          onChange={(event) => setDropKeyword(event.target.value)}
                          placeholder="名称 / 子类型 / 部位"
                        />
                      </label>
                      <label>
                        排序
                        <select
                          value={dropEquipmentSortBy}
                          onChange={(event) => setDropEquipmentSortBy(event.target.value as DropEquipmentSortBy)}
                        >
                          <option value="qualityDesc">品质优先</option>
                          <option value="rankDesc">品阶优先</option>
                          <option value="nameAsc">名称 A-Z</option>
                          <option value="nameDesc">名称 Z-A</option>
                        </select>
                      </label>
                    </div>

                    <div className="battle-drop-chip-group">
                      {(Object.keys(EQUIPMENT_QUALITY_LABELS) as EquipmentQuality[]).map((quality) => (
                        <button
                          key={quality}
                          type="button"
                          className={`battle-drop-chip ${dropQualityFilters.includes(quality) ? "active" : ""}`}
                          onClick={() => toggleDropQuality(quality)}
                        >
                          品质: {EQUIPMENT_QUALITY_LABELS[quality]}
                        </button>
                      ))}
                    </div>

                    <div className="battle-drop-chip-group">
                      {(Object.keys(EQUIPMENT_RANK_LABELS) as EquipmentRank[]).map((rank) => (
                        <button
                          key={rank}
                          type="button"
                          className={`battle-drop-chip ${dropRankFilters.includes(rank) ? "active" : ""}`}
                          onClick={() => toggleDropRank(rank)}
                        >
                          品阶: {EQUIPMENT_RANK_LABELS[rank]}
                        </button>
                      ))}
                    </div>

                    <div className="battle-drop-chip-group">
                      {(Object.keys(EQUIPMENT_SLOT_LABELS) as EquipmentSlot[]).map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          className={`battle-drop-chip ${dropSlotFilters.includes(slot) ? "active" : ""}`}
                          onClick={() => toggleDropSlot(slot)}
                        >
                          部位: {EQUIPMENT_SLOT_LABELS[slot]}
                        </button>
                      ))}
                    </div>

                    <div className="battle-drop-actions">
                      <button type="button" className="ghost-btn" onClick={clearDropEquipmentFilters}>
                        一键清空筛选
                      </button>
                      <small>
                        结果 {visibleEquipmentDrops.length} / 总数 {equipmentDrops.length}
                      </small>
                    </div>

                    {visibleEquipmentDrops.length > 0 ? (
                      <div className="battle-drop-equipment-list">
                        {visibleEquipmentDrops.map((item) => (
                          <p key={item.uid}>
                            {item.templateName} · {EQUIPMENT_SUBTYPE_LABELS[item.subtype]} · {EQUIPMENT_QUALITY_LABELS[item.quality]} /{" "}
                            {EQUIPMENT_RANK_LABELS[item.rank]}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p>当前筛选条件下无装备掉落。</p>
                    )}
                  </section>
                ) : null}
              </div>
            ) : null}

            {activeReplayView === "actions" ? (
              <div className="battle-replay-panel">
                {actionSnapshots.length > 0 ? (
                  <div className="battle-replay-list">
                    {actionSnapshots.map((item) => (
                      <p key={item.id}>
                        [{(item.timeMs / 1000).toFixed(1)}s] {item.actorUnitName} · {item.skillName} · 伤害 {Math.round(item.damageDone)} · 治疗{" "}
                        {Math.round(item.healDone)}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p>暂无行动快照。</p>
                )}
              </div>
            ) : null}

            {activeReplayView === "status" ? (
              <div className="battle-replay-panel">
                {statusChanges.length > 0 ? (
                  <div className="battle-replay-list">
                    {statusChanges.map((item) => (
                      <p key={item.id}>
                        [{(item.timeMs / 1000).toFixed(1)}s] {item.unitName} · {item.statusKey} · {item.action} · 剩余 {item.remainingTurns}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p>暂无状态变化记录。</p>
                )}
              </div>
            ) : null}

            {!["stats", "drops", "actions", "status"].includes(activeReplayView) ? (
              <div className="battle-replay-panel">
                <p>该复盘子界面暂未实现，可在 `runtime.replay.views` 新增对应 key 后扩展渲染器。</p>
              </div>
            ) : null}

            <footer className="battle-replay-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setIsReplayModalOpen(false)}>
                关闭复盘
              </button>
            </footer>
          </article>
        </div>
      ) : null}
    </section>
  );
}
