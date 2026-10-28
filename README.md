# vui · FabViewer 前端

FAB Viewer 的 Vue 3 前端。**模块化、可插拔交付**：每个模块自包含（manifest + 路由 + API + 视图 + 词典 + Mock），装卸一个模块 = 增删一个目录 + `src/modules/registry.ts` 里一行。

## 技术栈（全部当前稳定版）

Vue 3.5 · Vite 8 · TypeScript · Pinia · Vue Router · Vuetify 4 · Font Awesome 7 · vue-i18n · dayjs · exceljs（按需加载）· fflate

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173（默认 Mock 模式，无需后端）
```

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发服务器（`.env.development` 默认 `VITE_MOCK=true`） |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run type-check` | vue-tsc 类型检查 |
| `npm run lint` | oxlint + eslint |

## Mock 与真实后端

- **Mock 开**（默认开发态）：`shared/api/http.ts` 按 `VITE_MOCK` 分流到各模块在 `api/mock.ts` 里注册的本地处理器（120~380ms 模拟延迟），无需后端即可完整演示。
- **Mock 关**：`fetch` 直连 `/log-viewer/**`；dev 由 Vite proxy 转发到 `VITE_API_TARGET`（`.env.development`），生产由网关承接。
- 接口契约见 `FAB Viewer项目/docs/模块1-日志检索与分析/01-MES Rule信息检索.md` §五 与 `模块5-系统管理/01-Server Hang Reason Config.md` §4.4。

## 目录结构

```
src/
  app/                  应用壳：布局（侧栏 260/68px 底色随明暗主题 + 顶栏 64px 毛玻璃）、
                        主题（高级绿双模式）、i18n 装配、路由收集、全局 logo
  modules/
    registry.ts         ★ 唯一插拔点
    config/             模块 5 · Server Hang Reason Config（配置 CRUD）
    rule-searching/     模块 1 · MES Rule 信息检索（16 条件检索 + 结果表 +
                        Export / Rule Log / Full Log）
  shared/               HTTP 封装、Mock 注册核心、时间/下载工具、公共组件、设计令牌
  i18n/                 壳与通用词典（zh-CN / en-US）
  views/HomeView.vue    Home：已安装模块入口卡片（读注册表）
```

## 约定

- **视觉**：全部走 `shared/styles/tokens.css` 与 Vuetify 主题令牌（05-视觉与交互规范），禁止页面硬编码颜色；圆角阶梯 6/8/10/14。
- **文案**：模板零硬编码，一律 i18n 词典；新增文案必须同时补 zh-CN / en-US。
- **菜单**：多级结构。每个模块提供一个一级菜单（带图标，可含 `children` 分组）；二级/三级项不带图标、必有路由 path。当前结构：`Rule Searching → MES Rule Info Searching`、`Config → Server Hang Reason Config`。进入子路由时所属分组自动展开。
- **新模块**：复制任一现有模块目录结构，在 `registry.ts` 注册即可获得菜单、路由、词典与 Mock 的全套接线。
- **Server Hang**：数据未落库，模块 1 的 Hang 按钮本期恒置灰（`ResultTable.vue`），落库后移除 `disabled` 即启用（弹框组件已就位）。
