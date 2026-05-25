import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { buildWorldMapSearchParams, selectionFromRegion } from "../data/worldMapData";
import { canAccessAction, mapNodeTypeLabel } from "../lib/mapRules";
import { useEquipmentInventory } from "../state/EquipmentInventoryProvider";
import { useMapSystem } from "../state/MapSystemProvider";
import { useOrganization } from "../state/OrganizationProvider";

export function RitualPage() {
  const navigate = useNavigate();
  const { nodeId } = useParams<{ nodeId: string }>();
  const { findNodeById, getNodeRitual, getRitualState, recordRitualAttempt } = useMapSystem();
  const { gold, materialItems } = useEquipmentInventory();
  const { mainQuests } = useOrganization();
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
  const ritual = getNodeRitual(node.id);
  const mapQuery = buildWorldMapSearchParams(selectionFromRegion(region)).toString();

  if (!canAccessAction(node, "ritual")) {
    return <Navigate to={`/node/${node.id}?${mapQuery}&warn=blocked`} replace />;
  }

  if (!ritual) {
    return (
      <section className="page">
        <header className="page-header">
          <h1>挑战 / 开启仪式</h1>
          <p>
            {node.name} · {mapNodeTypeLabel(node)}
          </p>
        </header>
        <Link className="back-link" to={`/node/${node.id}?${mapQuery}`}>
          返回地点主界面
        </Link>
        <article className="placeholder-card">
          <h2>仪式锁定</h2>
          <p>当前节点未配置可执行仪式。</p>
        </article>
      </section>
    );
  }

  const ritualState = getRitualState(ritual.id);
  const mainlineQuest = mainQuests.find((item) => item.id === ritual.unlock.requiredQuestId);
  const mainlineDone = mainlineQuest?.status === "completed";
  const suppressionReached = region.mapSuppression >= ritual.unlock.requiredSuppression;
  const materialCountMap = materialItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = item.quantity;
    return acc;
  }, {});
  const hasEnoughGold = gold >= ritual.cost.gold;
  const hasEnoughMaterials = ritual.cost.materials.every(
    (item) => (materialCountMap[item.materialId] ?? 0) >= item.quantity
  );
  const canStart = mainlineDone && suppressionReached && hasEnoughGold && hasEnoughMaterials;
  const isCompleted = ritualState?.status === "completed";

  const unlockMessages: string[] = [];
  if (!mainlineDone) {
    unlockMessages.push("封印阵列尚未稳定：需先完成主线「扩建基地」。");
  }
  if (!suppressionReached) {
    unlockMessages.push(`目标地区压制需达到 ${ritual.unlock.requiredSuppression}%（当前 ${region.mapSuppression}%）。`);
  }
  if (mainlineDone && suppressionReached && !hasEnoughGold) {
    unlockMessages.push("金币不足，无法完成仪式准备。");
  }
  if (mainlineDone && suppressionReached && !hasEnoughMaterials) {
    unlockMessages.push("关键材料不足，请补齐后再开启仪式。");
  }

  const handleStartRitual = () => {
    if (!canStart || isCompleted) {
      return;
    }
    recordRitualAttempt(ritual.id);
    navigate(`/battle/${node.id}?ritualId=${ritual.id}`);
  };

  return (
    <section className="page">
      <header className="page-header">
        <h1>{ritual.name}</h1>
        <p>
          {node.name} · {mapNodeTypeLabel(node)}
        </p>
      </header>

      <Link className="back-link" to={`/node/${node.id}?${mapQuery}`}>
        返回地点主界面
      </Link>

      <div className="placeholder-grid">
        <article className="placeholder-card">
          <h2>仪式状态</h2>
          <p>{isCompleted ? "已完成" : canStart ? "可准备" : "未解锁"}</p>
          <p>{ritual.description}</p>
          {unlockMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
          <p>消耗金币：{ritual.cost.gold}</p>
          {ritual.cost.materials.map((item) => (
            <p key={item.materialId}>
              消耗材料：{item.materialId} {materialCountMap[item.materialId] ?? 0}/{item.quantity}
            </p>
          ))}
          <button type="button" className="primary-btn" disabled={!canStart || isCompleted} onClick={handleStartRitual}>
            {isCompleted ? "仪式已完成" : "进入仪式战"}
          </button>
        </article>

        <article className="placeholder-card">
          <h2>风险预览</h2>
          <p>推荐压制值：{ritual.boss.recommendedSuppression}%</p>
          <p>敌方阵容：{ritual.boss.enemyIds.join(" / ")}</p>
          <p>战场标签：{ritual.boss.riskTags.join(" / ")}</p>
          <p>
            成功奖励：金币 {ritual.reward.gold} / 声望 +{ritual.reward.reputation}
          </p>
          {ritual.reward.legendaryEquipmentIds && ritual.reward.legendaryEquipmentIds.length > 0 ? <p>首通奖励：传说装备解锁</p> : null}
        </article>
      </div>
    </section>
  );
}
