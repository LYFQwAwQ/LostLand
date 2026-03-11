import { RotateCcw, Shield, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { heroes } from "../data/mockData";
import { useBattleSetup } from "../state/BattleSetupProvider";
import type { BattleSetupSnapshot } from "../state/BattleSetupProvider";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import type { EquipmentInventorySnapshot } from "../state/EquipmentInventoryProvider";

interface TeamPresetSnapshot {
  battle: BattleSetupSnapshot;
  equipment: EquipmentInventorySnapshot;
}

interface TeamPresetSlot {
  id: number;
  name: string;
  savedAt: number | null;
  snapshot: TeamPresetSnapshot | null;
}

const TEAM_PRESET_STORAGE_KEY = "lostland.team.presets.v2";

function createDefaultPresetSlots(): TeamPresetSlot[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    name: `预设 ${index + 1}`,
    savedAt: null,
    snapshot: null
  }));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadPresetSlots(): TeamPresetSlot[] {
  if (typeof window === "undefined") {
    return createDefaultPresetSlots();
  }
  const base = createDefaultPresetSlots();
  try {
    const raw = window.localStorage.getItem(TEAM_PRESET_STORAGE_KEY);
    if (!raw) {
      return base;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return base;
    }
    const byId = new Map<number, TeamPresetSlot>();
    parsed.forEach((item) => {
      if (!isObject(item)) {
        return;
      }
      const id = typeof item.id === "number" ? Math.round(item.id) : NaN;
      if (!Number.isFinite(id) || id < 1 || id > 10) {
        return;
      }
      const name = typeof item.name === "string" && item.name.length > 0 ? item.name : `预设 ${id}`;
      const savedAt = typeof item.savedAt === "number" && Number.isFinite(item.savedAt) ? item.savedAt : null;
      const snapshot = isObject(item.snapshot) ? (item.snapshot as unknown as TeamPresetSnapshot) : null;
      byId.set(id, { id, name, savedAt, snapshot });
    });
    return base.map((slot) => byId.get(slot.id) ?? slot);
  } catch {
    return base;
  }
}

export function TeamPage() {
  const {
    formation,
    setSlotHero,
    clearSlot,
    clearFormation,
    resetFormationDefault,
    exportSnapshot: exportBattleSnapshot,
    importSnapshot: importBattleSnapshot
  } = useBattleSetup();
  const {
    exportSnapshot: exportEquipmentSnapshot,
    importSnapshot: importEquipmentSnapshot
  } = useEquipmentInventory();

  const [selectedSlotId, setSelectedSlotId] = useState<string>(formation[0]?.id ?? "");
  const [draggingHeroId, setDraggingHeroId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [presetSlots, setPresetSlots] = useState<TeamPresetSlot[]>(() => loadPresetSlots());
  const [presetNotice, setPresetNotice] = useState<string>("");

  useEffect(() => {
    if (!formation.some((slot) => slot.id === selectedSlotId)) {
      setSelectedSlotId(formation[0]?.id ?? "");
    }
  }, [formation, selectedSlotId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(TEAM_PRESET_STORAGE_KEY, JSON.stringify(presetSlots));
  }, [presetSlots]);

  const slotById = useMemo(() => new Map(formation.map((slot) => [slot.id, slot])), [formation]);
  const selectedSlot = slotById.get(selectedSlotId) ?? formation[0] ?? null;
  const assignedHeroIds = new Set(formation.map((slot) => slot.heroId).filter((item): item is string => Boolean(item)));
  const frontSlots = formation.filter((slot) => slot.line === "front").sort((left, right) => left.index - right.index);
  const backSlots = formation.filter((slot) => slot.line === "back").sort((left, right) => left.index - right.index);

  const handleAssignHero = (heroId: string) => {
    if (!selectedSlot) {
      return;
    }
    setSlotHero(selectedSlot.id, heroId);
  };

  const savePreset = (presetId: number) => {
    const snapshot: TeamPresetSnapshot = {
      battle: exportBattleSnapshot(),
      equipment: exportEquipmentSnapshot()
    };
    setPresetSlots((prev) =>
      prev.map((slot) => (slot.id === presetId ? { ...slot, snapshot, savedAt: Date.now() } : slot))
    );
    setPresetNotice(`已保存到预设 ${presetId}。`);
  };

  const loadPreset = (presetId: number) => {
    const slot = presetSlots.find((item) => item.id === presetId);
    if (!slot?.snapshot || !isObject(slot.snapshot.battle) || !isObject(slot.snapshot.equipment)) {
      setPresetNotice(`预设 ${presetId} 为空或损坏。`);
      return;
    }
    importEquipmentSnapshot(slot.snapshot.equipment);
    importBattleSnapshot(slot.snapshot.battle);
    setPresetNotice(`已载入预设 ${presetId}：${slot.name}`);
  };

  const clearPreset = (presetId: number) => {
    setPresetSlots((prev) =>
      prev.map((slot) => (slot.id === presetId ? { ...slot, snapshot: null, savedAt: null } : slot))
    );
  };

  const updatePresetName = (presetId: number, nextName: string) => {
    const name = nextName.trim().length > 0 ? nextName : `预设 ${presetId}`;
    setPresetSlots((prev) => prev.map((slot) => (slot.id === presetId ? { ...slot, name } : slot)));
  };

  const onSlotDrop = (slotId: string) => {
    if (!draggingHeroId) {
      return;
    }
    setSlotHero(slotId, draggingHeroId);
    setDragOverSlotId(null);
    setDraggingHeroId(null);
  };

  return (
    <section className="page">
      <header className="page-header">
        <h1>队伍配置</h1>
        <p>支持拖拽编队与 10 套全量预设（站位/技能槽位/装备/记忆穿戴）。</p>
      </header>

      <div className="team-layout">
        <div className="team-grid-wrap">
          <div className="team-grid-block">
            <h2>前排</h2>
            <div className="team-grid">
              {frontSlots.map((slot) => {
                const hero = heroes.find((item) => item.id === slot.heroId);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    draggable={Boolean(slot.heroId)}
                    className={`team-slot ${selectedSlot?.id === slot.id ? "active" : ""} ${dragOverSlotId === slot.id ? "drag-over" : ""}`}
                    onClick={() => setSelectedSlotId(slot.id)}
                    onDragStart={() => {
                      if (slot.heroId) {
                        setDraggingHeroId(slot.heroId);
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverSlotId(slot.id);
                    }}
                    onDragLeave={() => setDragOverSlotId((prev) => (prev === slot.id ? null : prev))}
                    onDrop={(event) => {
                      event.preventDefault();
                      onSlotDrop(slot.id);
                    }}
                    onDragEnd={() => {
                      setDragOverSlotId(null);
                      setDraggingHeroId(null);
                    }}
                  >
                    {hero ? (
                      <>
                        <img src={hero.image} alt={hero.name} />
                        <span>{hero.name}</span>
                      </>
                    ) : (
                      <>
                        <Shield size={24} />
                        <span>空位</span>
                      </>
                    )}
                    <small>前排 {slot.index + 1}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="team-grid-block">
            <h2>后排</h2>
            <div className="team-grid">
              {backSlots.map((slot) => {
                const hero = heroes.find((item) => item.id === slot.heroId);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    draggable={Boolean(slot.heroId)}
                    className={`team-slot ${selectedSlot?.id === slot.id ? "active" : ""} ${dragOverSlotId === slot.id ? "drag-over" : ""}`}
                    onClick={() => setSelectedSlotId(slot.id)}
                    onDragStart={() => {
                      if (slot.heroId) {
                        setDraggingHeroId(slot.heroId);
                      }
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverSlotId(slot.id);
                    }}
                    onDragLeave={() => setDragOverSlotId((prev) => (prev === slot.id ? null : prev))}
                    onDrop={(event) => {
                      event.preventDefault();
                      onSlotDrop(slot.id);
                    }}
                    onDragEnd={() => {
                      setDragOverSlotId(null);
                      setDraggingHeroId(null);
                    }}
                  >
                    {hero ? (
                      <>
                        <img src={hero.image} alt={hero.name} />
                        <span>{hero.name}</span>
                      </>
                    ) : (
                      <>
                        <Shield size={24} />
                        <span>空位</span>
                      </>
                    )}
                    <small>后排 {slot.index + 1}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="team-side-card">
          <h2>编队编辑</h2>
          {selectedSlot ? (
            <p>
              当前选中：{selectedSlot.line === "front" ? "前排" : "后排"} {selectedSlot.index + 1}
            </p>
          ) : (
            <p>请选择一个槽位后分配英雄。</p>
          )}

          <div className="team-side-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                if (selectedSlot) {
                  clearSlot(selectedSlot.id);
                }
              }}
              disabled={!selectedSlot}
            >
              <Trash2 size={13} />
              清空选中槽位
            </button>
            <button type="button" className="ghost-btn" onClick={clearFormation}>
              <Trash2 size={13} />
              清空全部槽位
            </button>
            <button type="button" className="ghost-btn" onClick={resetFormationDefault}>
              <RotateCcw size={13} />
              恢复默认编队
            </button>
          </div>

          <h3>预设管理（10 套）</h3>
          {presetNotice ? <p className="team-preset-notice">{presetNotice}</p> : null}
          <div className="team-preset-list custom-scrollbar">
            {presetSlots.map((slot) => (
              <article key={slot.id} className="team-preset-card">
                <header>
                  <strong>#{slot.id}</strong>
                  <input
                    type="text"
                    value={slot.name}
                    onChange={(event) => updatePresetName(slot.id, event.target.value)}
                    onBlur={(event) => updatePresetName(slot.id, event.target.value)}
                  />
                </header>
                <div className="team-preset-actions">
                  <button type="button" className="ghost-btn small-btn" onClick={() => loadPreset(slot.id)} disabled={!slot.snapshot}>
                    载入
                  </button>
                  <button type="button" className="ghost-btn small-btn" onClick={() => savePreset(slot.id)}>
                    保存
                  </button>
                  <button
                    type="button"
                    className="ghost-btn small-btn"
                    onClick={() => clearPreset(slot.id)}
                    disabled={!slot.snapshot}
                  >
                    清空
                  </button>
                </div>
                <small>
                  {slot.savedAt
                    ? `最近保存：${new Date(slot.savedAt).toLocaleString("zh-CN", { hour12: false })}`
                    : "尚未保存"}
                </small>
              </article>
            ))}
          </div>

          <h3>英雄分配（支持拖拽）</h3>
          <div className="team-hero-pool">
            {heroes.map((hero) => {
              const isAssigned = assignedHeroIds.has(hero.id);
              const ownerSlot = formation.find((slot) => slot.heroId === hero.id);
              const ownerText = ownerSlot
                ? `${ownerSlot.line === "front" ? "前排" : "后排"} ${ownerSlot.index + 1}`
                : "未上阵";

              return (
                <article
                  key={hero.id}
                  className="team-hero-card"
                  draggable
                  onDragStart={() => setDraggingHeroId(hero.id)}
                  onDragEnd={() => {
                    setDragOverSlotId(null);
                    setDraggingHeroId(null);
                  }}
                >
                  <img src={hero.image} alt={hero.name} />
                  <div>
                    <strong>{hero.name}</strong>
                    <p>{ownerText}</p>
                  </div>
                  <button type="button" className="ghost-btn small-btn" onClick={() => handleAssignHero(hero.id)} disabled={!selectedSlot}>
                    <UserPlus size={12} />
                    {isAssigned ? "交换到此位" : "放入选中槽位"}
                  </button>
                </article>
              );
            })}
          </div>

          <h3>阵型光环</h3>
          <p>前排每有 1 名英雄：物理防御 +2%</p>
          <p>后排每有 1 名英雄：技能急速 +2%</p>
        </aside>
      </div>
    </section>
  );
}
