import { Shield } from "lucide-react";
import { heroes } from "../data/mockData";

export function TeamPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h1>队伍配置</h1>
        <p>编队、阵型加成与预设方案占位。当前仅实现基础 UI。</p>
      </header>

      <div className="team-layout">
        <div className="team-grid">
          {Array.from({ length: 6 }).map((_, idx) => {
            const hero = heroes[idx];
            return (
              <div key={idx} className="team-slot">
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
              </div>
            );
          })}
        </div>
        <aside className="team-side-card">
          <h2>阵型光环</h2>
          <p>法术伤害 +10%</p>
          <p>物理防御 +5%</p>
          <button type="button">保存当前配置</button>
        </aside>
      </div>
    </section>
  );
}
