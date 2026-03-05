import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { BattleSetupProvider } from "./state/BattleSetupProvider";
import { EquipmentInventoryProvider } from "./state/EquipmentInventoryProvider";
import { MapSystemProvider } from "./state/MapSystemProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MapSystemProvider>
      <BattleSetupProvider>
        <EquipmentInventoryProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </EquipmentInventoryProvider>
      </BattleSetupProvider>
    </MapSystemProvider>
  </React.StrictMode>
);
