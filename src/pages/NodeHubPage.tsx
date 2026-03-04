import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ACTION_META, getNodeActions, mapFactionLabel, mapNodeTypeLabel, mapStateLabel } from "../lib/mapRules";
import { useMapSystem } from "../state/MapSystemProvider";

export function NodeHubPage() {
  const { findNodeById } = useMapSystem();
  const { nodeId } = useParams<{ nodeId: string }>();
  const [searchParams] = useSearchParams();
  const context = findNodeById(nodeId);

  if (!context) {
    return (
      <section className="page">
        <header className="page-header">
          <h1>未知节点</h1>
          <p>未找到该地点，请返回地图重新选择。</p>
        </header>
        <Link className="back-link" to="/">
          返回世界地图
        </Link>
      </section>
    );
  }

  const { node, region } = context;
  const warn = searchParams.get("warn");
  const actions = getNodeActions(node);
  const backToMap = `/?region=${region.id}`;

  return (
    <section className="page node-hub-page">
      <header className="page-header">
        <h1>{node.name}</h1>
        <p>
          {region.continentName} / {region.dominionName} / {region.regionName}
        </p>
      </header>

      <Link className="back-link" to={backToMap}>
        返回世界地图
      </Link>

      {warn === "blocked" ? (
        <div className="warn-banner">
          <AlertTriangle size={16} />
          <span>当前节点不支持该入口，已返回地点主界面。</span>
        </div>
      ) : null}

      <div className="node-hub-grid">
        <section className="placeholder-card">
          <h2>地点档案</h2>
          <div className="node-meta-list">
            <p>
              <strong>状态：</strong>
              {mapStateLabel(node.state)}
            </p>
            <p>
              <strong>类型：</strong>
              {mapNodeTypeLabel(node)}
            </p>
            <p>
              <strong>势力：</strong>
              {mapFactionLabel(node.faction)}
            </p>
            <p>
              <strong>推荐难度：</strong>
              {node.difficulty}
            </p>
            <p>
              <strong>本月 O / E：</strong>
              {node.sim.totalOrder.toFixed(1)} / {node.sim.totalExpansion.toFixed(1)}
            </p>
            <p>
              <strong>繁荣度：</strong>
              {node.sim.prosperity.toFixed(1)}
            </p>
            <p>
              <strong>基础强度：</strong>
              {node.sim.baseStrength.toFixed(1)}
            </p>
          </div>
          <div className="info-line">
            <Info size={15} />
            <span>{node.environment}</span>
          </div>
          <div className="buff-line">
            <Sparkles size={15} />
            <span>{node.stayBuff}</span>
          </div>
        </section>

        <section className="placeholder-card">
          <h2>交互入口</h2>
          {node.state === "inactive" ? (
            <div className="fog-card">
              <h3>迷雾区域</h3>
              <p>该节点尚未激活，无法进入功能页。</p>
              <p>
                开发进度：{node.fog.current}/{node.fog.target}
              </p>
              <p>累计 (O - E)：{node.fog.accumulatedDelta.toFixed(2)}</p>
            </div>
          ) : (
            <div className="action-grid">
              {actions.map((action) => {
                const meta = ACTION_META[action];
                const to = action === "ritual" ? `/node/${node.id}/ritual` : `/node/${node.id}/${action}`;
                return (
                  <Link key={action} to={`${to}?region=${region.id}`} className="action-card-link">
                    <article className="action-card">
                      <h3>{meta.label}</h3>
                      <p>{meta.description}</p>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
