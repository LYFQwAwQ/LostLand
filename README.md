# LostLand

LostLand 是一个基于 React + TypeScript + Vite 的前端项目。

## 技术栈

- React 18
- TypeScript 5
- Vite 5
- React Router 6

## 环境要求

- Node.js 18+（建议 LTS）
- npm 9+

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 启动开发环境

```bash
npm run dev
```

默认会输出本地地址（通常为 `http://localhost:5173`）。

## 常用命令

```bash
# 启动开发服务器
npm run dev

# 生产构建（先执行 TypeScript 构建，再执行 Vite 打包）
npm run build

# 本地预览生产包
npm run preview
```

## 部署说明

### 通用静态部署（Nginx / CDN / 对象存储）

1. 构建产物

```bash
npm run build
```

2. 上传 `dist/` 目录到静态服务根目录。

3. 配置单页应用路由回退：所有非静态资源请求回退到 `index.html`。

Nginx 示例：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Vercel 部署

1. 导入仓库
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Framework Preset: `Vite`（可自动识别）

### Netlify 部署

1. 导入仓库
2. Build command: `npm run build`
3. Publish directory: `dist`
4. 配置 SPA 路由重写到 `index.html`

## 目录结构

```text
src/
  components/   复用组件
  config/       世界配置
  data/         静态数据与配置
  lib/          规则与算法逻辑
  pages/        页面组件
  state/        全局状态 Provider
  types/        TypeScript 类型定义
```

## 文档入口

- 开发总索引：`docs/开发文档/README.md`
- 开发主指导：`docs/开发文档/00-开发主指导.md`

## 常见问题

### `npm run dev` 启动失败

1. 检查 Node.js 版本是否为 18+
2. 删除 `node_modules` 后重新安装依赖

### 页面刷新后出现 404

原因通常是服务端未配置 SPA 路由回退。  
按上方 Nginx 示例配置 `try_files` 回退到 `index.html`。

### 如何验证生产包

```bash
npm run build
npm run preview
```

通过 `preview` 输出地址访问并验证页面与路由。
