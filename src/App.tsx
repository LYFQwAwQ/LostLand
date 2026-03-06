import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { HeroPage } from "./pages/HeroPage";
import { InventoryPage } from "./pages/InventoryPage";
import { BattlePage } from "./pages/BattlePage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { NodeActionPage } from "./pages/NodeActionPage";
import { NodeHubPage } from "./pages/NodeHubPage";
import { RitualPage } from "./pages/RitualPage";
import { TeamPage } from "./pages/TeamPage";
import { WorldMapPage } from "./pages/WorldMapPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<WorldMapPage />} />
        <Route path="node/:nodeId" element={<NodeHubPage />} />
        <Route path="node/:nodeId/ritual" element={<RitualPage />} />
        <Route path="node/:nodeId/:action" element={<NodeActionPage />} />
        <Route path="battle/:nodeId" element={<BattlePage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="hero/:heroId" element={<HeroPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
