import { FastForward, Gauge, Pause, Play, RotateCcw, Shield, Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { heroes } from "../data/mockData";
import { buildAllyTeamTemplates, buildEnemyTeamTemplates } from "../lib/battleAdapters";
import { createBattleRuntime, setBattleRunning, setBattleSpeed, stepBattle } from "../lib/battleEngine";
import { useBattleSetup } from "../state/BattleSetupProvider";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { useMapSystem } from "../state/MapSystemProvider";
import type { BattleLine, BattleRuntimeState, BattleRuntimeUnit, BattleSide } from "../types/battle";

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
  }, [chainRound, runtime]);

  useEffect(() => {
    if (!runtime || runtime.status !== "running") {
      return;
    }
    const timer = window.setInterval(() => {
      setRuntime((prev) => (prev ? stepBattle(prev, 16) : prev));
    }, 16);
    return () => window.clearInterval(timer);
  }, [runtime?.status]);

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
  const allyAlive = runtime.units.filter((unit) => unit.side === "ally" && unit.alive).length;
  const enemyAlive = runtime.units.filter((unit) => unit.side === "enemy" && unit.alive).length;
  const logList = runtime.logs.slice(-26).reverse();

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
          <button type="button" className="primary-btn" onClick={() => setRuntime((prev) => (prev ? setBattleRunning(prev, !isRunning) : prev))}>
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
            {isRunning ? "暂停战斗" : "开始战斗"}
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
            <p>连战规则：胜利自动进入下一场，HP/MP 继承且不回复</p>
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

          <article className="battle-side-card battle-drop-card">
            <h3>战利品</h3>
            {runtime.drops && runtime.drops.items.length > 0 ? (
              <div className="battle-drop-list">
                {runtime.drops.items.map((item) => (
                  <p key={item.uid}>
                    {item.templateName} · {item.quality} / {item.rank}
                  </p>
                ))}
              </div>
            ) : (
              <p>战斗胜利后显示掉落列表。</p>
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}
