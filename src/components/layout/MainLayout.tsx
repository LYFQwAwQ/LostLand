import { Building2, Compass, Map, Package, ShieldCheck, User } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useEquipmentInventory } from "../../state/EquipmentInventoryProvider";
import { useMapSystem } from "../../state/MapSystemProvider";

function SideNavLink({
  to,
  label,
  icon
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `side-nav-link ${isActive ? "active" : ""}`}
      end={to === "/"}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export function MainLayout() {
  const { worldLogs, worldMonth } = useMapSystem();
  const { gold, reputation } = useEquipmentInventory();

  return (
    <div className="app-shell">
      <aside className="left-panel">
        <section className="panel card logs-panel">
          <header className="card-title">
            <Compass size={16} />
            <span>冒险日志 · 第 {worldMonth} 月</span>
          </header>
          <div className="logs-list">
            {worldLogs.map((item, idx) => (
              <p key={idx}>
                <span>
                  [{new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}]
                </span>
                {item}
              </p>
            ))}
          </div>
        </section>

        <section className="panel card resource-panel">
          <header className="card-title">
            <span>资源概览</span>
          </header>
          <div className="resource-grid">
            <div>
              <span>金币</span>
              <strong>{gold.toLocaleString("zh-CN")}</strong>
            </div>
            <div>
              <span>声望</span>
              <strong>{reputation.toLocaleString("zh-CN")}</strong>
            </div>
          </div>
        </section>

        <nav className="panel nav-panel">
          <SideNavLink to="/" label="世界地图" icon={<Map size={18} />} />
          <SideNavLink to="/team" label="队伍配置" icon={<ShieldCheck size={18} />} />
          <SideNavLink to="/organization" label="组织基地" icon={<Building2 size={18} />} />
          <SideNavLink to="/inventory" label="背包" icon={<Package size={18} />} />
          <SideNavLink to="/hero/arthur" label="英雄殿堂" icon={<User size={18} />} />
        </nav>
      </aside>

      <main className="main-panel">
        <Outlet />
      </main>
    </div>
  );
}

