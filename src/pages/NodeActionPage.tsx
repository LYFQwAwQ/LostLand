import { Coins, Hammer, ScrollText, Shield, ShoppingBag, Sparkles, Sword, Users } from "lucide-react";
import { Navigate, Link, useParams } from "react-router-dom";
import { buildWorldMapSearchParams, selectionFromRegion } from "../data/worldMapData";
import { bulletinNotice,
  getBulletinMissions,
  getForgeRecipes,
  getMarketInventory,
  getShopInventory,
  getTavernOffers,
  marketSellRules
} from "../data/nodeModules";
import { ACTION_META, canAccessAction, mapNodeTypeLabel } from "../lib/mapRules";
import { useMapSystem } from "../state/MapSystemProvider";
import type { NodeAction } from "../types/game";

const validActions: NodeAction[] = ["detail", "shop", "market", "tavern", "forge", "bulletin", "battle", "ritual"];

function isNodeAction(value: string | undefined): value is NodeAction {
  return !!value && validActions.includes(value as NodeAction);
}

function HeaderInfo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="module-card">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

export function NodeActionPage() {
  const { findNodeById } = useMapSystem();
  const { nodeId, action } = useParams<{ nodeId: string; action: string }>();
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
  const mapQuery = buildWorldMapSearchParams(selectionFromRegion(region)).toString();

  if (!isNodeAction(action) || action === "ritual") {
    return <Navigate to={`/node/${node.id}?${mapQuery}&warn=blocked`} replace />;
  }

  if (!canAccessAction(node, action)) {
    return <Navigate to={`/node/${node.id}?${mapQuery}&warn=blocked`} replace />;
  }

  const meta = ACTION_META[action];

  return (
    <section className="page">
      <header className="page-header">
        <h1>{meta.label}</h1>
        <p>
          {node.name} · {mapNodeTypeLabel(node)}
        </p>
      </header>

      <Link className="back-link" to={`/node/${node.id}?${mapQuery}`}>
        返回地点主界面
      </Link>

      {action === "detail" ? (
        <div className="module-grid">
          <HeaderInfo title="环境概览">
            <p>{node.environment}</p>
            <p>当前繁荣度：{node.sim.prosperity.toFixed(1)}</p>
            <p>基础强度：{node.sim.baseStrength.toFixed(1)}</p>
          </HeaderInfo>
          <HeaderInfo title="驻留加成">
            <p>{node.stayBuff}</p>
            <p>
              本月场强：O {node.sim.totalOrder.toFixed(1)} / E {node.sim.totalExpansion.toFixed(1)}
            </p>
          </HeaderInfo>
        </div>
      ) : null}

      {action === "battle" ? (
        <div className="module-grid">
          <HeaderInfo title="讨伐准备">
            <p>战斗系统已接入实时模拟，可直接作为后续正式战斗模板。</p>
            <p>队伍规则：双方 1-6 人，前后排各最多 3 人。</p>
            <Link to={`/battle/${node.id}?${mapQuery}`} className="secondary-btn-link">
              <Shield size={14} />
              进入实时战斗
            </Link>
          </HeaderInfo>
          <HeaderInfo title="侦察情报">
            <p>敌方规模：依据 BL 等级自动生成（1-6 人，含前后排分布）。</p>
            <p>当前地图压制：{region.mapSuppression}%（影响掉落强度与数量）。</p>
            <p>推荐压制值：{Math.max(45, region.mapSuppression)}%</p>
            {node.archetype === "BL3" ? (
              <Link to={`/node/${node.id}/ritual?${mapQuery}`} className="secondary-btn-link">
                挑战 / 开启仪式
              </Link>
            ) : null}
          </HeaderInfo>
        </div>
      ) : null}

      {action === "shop" ? (
        <div className="module-grid">
          <HeaderInfo title="商店库存（买入 / 卖出 / 回购）">
            <div className="module-table-wrap">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>类型</th>
                    <th>单价</th>
                    <th>库存</th>
                    <th>权重</th>
                  </tr>
                </thead>
                <tbody>
                  {getShopInventory(node).map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.category}</td>
                      <td>{item.price}</td>
                      <td>{item.stock}</td>
                      <td>{item.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="module-actions-row">
              <button type="button" className="primary-btn">
                <ShoppingBag size={14} /> 买入
              </button>
              <button type="button" className="ghost-btn">卖出</button>
              <button type="button" className="ghost-btn">回购</button>
            </div>
          </HeaderInfo>
        </div>
      ) : null}

      {action === "market" ? (
        <div className="module-grid">
          <HeaderInfo title="商铺（原材料与大宗贸易）">
            <div className="module-table-wrap">
              <table className="module-table">
                <thead>
                  <tr>
                    <th>材料</th>
                    <th>单价</th>
                    <th>库存</th>
                    <th>出现权重</th>
                  </tr>
                </thead>
                <tbody>
                  {getMarketInventory(node).map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.price}</td>
                      <td>{item.stock}</td>
                      <td>{item.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="module-actions-row">
              <button type="button" className="primary-btn">
                <Coins size={14} /> 买入
              </button>
              <button type="button" className="ghost-btn">大宗贸易</button>
              <button type="button" className="ghost-btn">回购</button>
            </div>
          </HeaderInfo>

          <HeaderInfo title="回收规则（配置占位）">
            {marketSellRules.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </HeaderInfo>
        </div>
      ) : null}

      {action === "tavern" ? (
        <div className="module-grid">
          <HeaderInfo title="酒馆招募池">
            <div className="offer-grid">
              {getTavernOffers(node).map((offer) => (
                <article key={offer.id} className="offer-card">
                  <h4>{offer.name}</h4>
                  <p>
                    {offer.profession} · {offer.rarity}
                  </p>
                  <p>签约费用：{offer.signingCost}</p>
                  <p>{offer.traits.join(" / ")}</p>
                  <button type="button" className="ghost-btn small-btn">
                    <Users size={13} /> 招募
                  </button>
                </article>
              ))}
            </div>
          </HeaderInfo>
        </div>
      ) : null}

      {action === "forge" ? (
        <div className="module-grid">
          <HeaderInfo title="铁匠铺 - 强化">
            <p>当前装备强化等级上限：+10（示例）</p>
            <p>强化消耗：金币 + 强化石，成功率随等级降低。</p>
            <button type="button" className="primary-btn">
              <Hammer size={14} /> 强化
            </button>
          </HeaderInfo>

          <HeaderInfo title="铁匠铺 - 打造">
            {getForgeRecipes(node).map((recipe) => (
              <article key={recipe.id} className="recipe-row">
                <div>
                  <h4>{recipe.name}</h4>
                  <p>
                    品质：{recipe.quality} · 金币：{recipe.goldCost}
                  </p>
                  <p>{recipe.materials.map((item) => `${item.name} x${item.count}`).join("，")}</p>
                </div>
                <button type="button" className="ghost-btn small-btn">
                  <Sword size={13} /> 打造
                </button>
              </article>
            ))}
          </HeaderInfo>
        </div>
      ) : null}

      {action === "bulletin" ? (
        <div className="module-grid">
          <HeaderInfo title="布告栏（接口占位）">
            <p>{bulletinNotice}</p>
            <div className="mission-list">
              {getBulletinMissions(node).map((mission) => (
                <article key={mission.id} className="mission-card">
                  <h4>{mission.title}</h4>
                  <p>
                    类型：{mission.kind} · 状态：{mission.status}
                  </p>
                  <p>目标：{mission.target}</p>
                  <p>奖励：{mission.reward}</p>
                  <div className="module-actions-row">
                    <button type="button" className="ghost-btn small-btn">
                      <ScrollText size={13} /> 领取委派
                    </button>
                    <button type="button" className="ghost-btn small-btn">
                      <Sparkles size={13} /> 交付悬赏
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </HeaderInfo>
        </div>
      ) : null}
    </section>
  );
}


