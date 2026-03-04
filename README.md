# LostLand Web

基于 UI 示例重建的网页游戏前端框架，当前阶段只实现大框架、页面 UI 和跳转，业务逻辑模块暂不接入。

## 技术栈

- React + TypeScript
- Vite
- React Router

## 已实现

- 左侧固定信息栏：日志、资源、主导航
- 右侧主视图路由：
  - 世界地图 `/`
  - 地点页 `/location/:locationId`
  - 队伍配置 `/team`
  - 英雄殿堂 `/hero/:heroId?tab=stats|gear|memory`
- 英雄页法师装备布局修正：
  - 使用五边形顶点坐标算法定位符文槽
  - 五角结构与槽位对齐，避免示例中的错位

## 启动与部署

```bash
npm install
npm run dev
```

生产构建:

```bash
npm run build
npm run preview
```

构建产物在 `dist/`，可直接部署到 Nginx、Vercel、Netlify 或任意静态托管服务。
