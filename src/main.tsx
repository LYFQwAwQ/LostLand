import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { EquipmentInventoryProvider } from "./state/EquipmentInventoryProvider";
import { MapSystemProvider } from "./state/MapSystemProvider";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MapSystemProvider>
      <EquipmentInventoryProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </EquipmentInventoryProvider>
    </MapSystemProvider>
  </React.StrictMode>
);
