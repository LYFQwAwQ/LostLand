import { Navigate } from "react-router-dom";

// 兼容旧路由文件：当前地图系统已统一迁移到 node/:nodeId。
export function LocationPage() {
  return <Navigate to="/" replace />;
}
