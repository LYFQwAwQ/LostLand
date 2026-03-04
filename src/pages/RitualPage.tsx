import { Navigate, Link, useParams } from "react-router-dom";
import { canAccessAction, mapNodeTypeLabel } from "../lib/mapRules";
import { useMapSystem } from "../state/MapSystemProvider";

export function RitualPage() {
  const { findNodeById } = useMapSystem();
  const { nodeId } = useParams<{ nodeId: string }>();
  const context = findNodeById(nodeId);

  if (!context) {
    return (
      <section className="page">
        <header className="page-header">
          <h1>未知节点</h1>
          <p>未找到该节点。</p>
        </header>
        <Link className="back-link" to="/">
          返回世界地图
        </Link>
      </section>
    );
  }

  const { node, region } = context;

  if (!canAccessAction(node, "ritual")) {
    return <Navigate to={`/node/${node.id}?region=${region.id}&warn=blocked`} replace />;
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1>挑战 / 开启仪式</h1>
        <p>
          {node.name} · {mapNodeTypeLabel(node)}
        </p>
      </header>

      <Link className="back-link" to={`/node/${node.id}?region=${region.id}`}>
        返回地点主界面
      </Link>

      <div className="placeholder-grid">
        <article className="placeholder-card">
          <h2>仪式准备</h2>
          <p>确认阵容、消耗品与记忆配置后可触发仪式流程。</p>
          <button type="button" className="primary-btn">
            开始仪式（占位）
          </button>
        </article>
        <article className="placeholder-card">
          <h2>风险预览</h2>
          <p>推荐压制值：{Math.max(region.mapSuppression, 55)}%</p>
          <p>环境词缀：混沌侵蚀 / 压制干扰。</p>
        </article>
      </div>
    </section>
  );
}
