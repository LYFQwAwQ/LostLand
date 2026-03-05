import { RotateCcw, Shield, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { heroes } from "../data/mockData";
import { useBattleSetup } from "../state/BattleSetupProvider";

export function TeamPage() {
  const { formation, setSlotHero, clearSlot, clearFormation, resetFormationDefault } = useBattleSetup();
  const [selectedSlotId, setSelectedSlotId] = useState<string>(formation[0]?.id ?? "");

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

  return (
    <section className="page">
      <header className="page-header">
        <h1>队伍配置</h1>
        <p>战斗编队已接入全局状态：双方 1-6 人，上阵位为前排 3 + 后排 3。</p>
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
                    className={`team-slot ${selectedSlot?.id === slot.id ? "active" : ""}`}
                    onClick={() => setSelectedSlotId(slot.id)}
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
                    className={`team-slot ${selectedSlot?.id === slot.id ? "active" : ""}`}
                    onClick={() => setSelectedSlotId(slot.id)}
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

          <h3>英雄分配</h3>
          <div className="team-hero-pool">
            {heroes.map((hero) => {
              const isAssigned = assignedHeroIds.has(hero.id);
              const ownerSlot = formation.find((slot) => slot.heroId === hero.id);
              const ownerText = ownerSlot
                ? `${ownerSlot.line === "front" ? "前排" : "后排"} ${ownerSlot.index + 1}`
                : "未上阵";

              return (
                <article key={hero.id} className="team-hero-card">
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
          <button type="button" className="team-save-btn">
            保存当前配置
          </button>
        </aside>
      </div>
    </section>
  );
}
