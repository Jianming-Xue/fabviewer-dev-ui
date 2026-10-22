# vui 项目规则

项目背景、架构与交接状态见 `docs/HANDOVER.md`（事实状态以该文档为准）。

## Dialog 体系（2026-10-16 用户定稿）

层级三分：

```
FvBaseDialog（全局基座：三区布局/拖动/开合动画/尺寸上限）
  ├─ FvModalDialogHost   语义弹窗基类/宿主（成功/错误/警告/信息/确认，useModalDialog 消费）
  └─ FvInteractiveDialog 业务弹窗基类 ← 普通业务弹窗一律继承它
```

命名约定（2026-10-16 定稿）：项目自定义的 Dialog/Toast **组件**一律 Fv 前缀，与 FvTable/FvSwitch 同族——`shared/dialog/` 的 `FvBaseDialog` / `FvInteractiveDialog` / `FvModalDialogHost` / `FvInteractiveDialogHost`，`shared/toast/` 的 `FvAlertToastHost` / `FvAlertToastItem`；**API 函数名不加前缀**（`openInteractiveDialog`、`useModalDialog`、`useAlertToast`、`useInteractiveDialogLauncher`）。

- **`shared/dialog/FvBaseDialog.vue` 是基座基类**：只有「派生其他 Dialog 基类」时才可以直接继承它（现状仅两处：`FvModalDialogHost`、`FvInteractiveDialog`）。FvBaseDialog 不可作为成品弹窗直接使用，**业务弹窗不得直接导入 FvBaseDialog**。
- **普通业务 Dialog 两个侧面，缺一不成体系**：
  - **实现时（写组件）**：继承 `shared/dialog/FvInteractiveDialog.vue`（FvInteractiveDialogHost 体系业务基类，纯透传基座能力）——业务弹窗**不得**直接导入 FvBaseDialog；
  - **打开时（用组件）**：调 `openInteractiveDialog(组件, props)`，由 `FvInteractiveDialogHost`（App.vue 单例宿主）装载渲染：props 进 / resolve 出 / **层叠**（已有弹窗展示中再开=叠于其上，支持弹窗内开子弹窗，2026-10-20 由排队改层叠；Esc 多层让位见 FvBaseDialog）——**禁止**业务弹窗在页面里 v-model 自挂载，**禁止**裸 `v-dialog`。
  - 注意区分：**继承的是 FvInteractiveDialog（基类）**，**经 Host 打开的是 FvInteractiveDialogHost（宿主）**——两者不是一回事、不可合并（语义弹窗的 FvModalDialogHost 之所以宿主自带基座，是因为其内容是同构纯数据；业务弹窗是异构有状态组件，宿主只调度、不套壳）。
- **`openInteractiveDialog` 只允许打开 FvInteractiveDialogHost 体系的弹窗**：运行时守卫已内置——打开后在组件 DOM 子树检测不到 `.vui-base-dialog` 即报错并自动关闭。
- 语义弹窗（成功/错误/警告/信息/确认）一律 `useModalDialog()` 五件套；非关键提示一律 `useAlertToast()`。禁止各页面自建 `v-snackbar` / 裸 `v-dialog` / alert。
- **Dialog 组件一律放在 `dialogs/` 文件夹下**：应用级放 `src/app/dialogs/`，模块级放 `src/modules/<模块>/dialogs/`；不得散落在 `components/`、`views/` 等其他目录。

## 后端交互对象命名（2026-10-17 定稿，2026-10-20 晚目录化补注）

与后端交互的对象：**请求体以 `Ro` 结尾**（Request Object，如 `RoleRo` / `SrvHangCfgRo` / `RuleSearchRo`），
**返回对象以 `Dto` 结尾**（如 `RoleDto` / `PageDto` / `LoginDto` / `RuleInfoDto`）。
类型定义落在各服务 `src/api/<服务>/types/<域>Types.ts`（2026-10-20 晚目录化：各服务下 requests/types/mocks 三目录按域分文件、文件名不变；服务公共壳在 `types/types.ts`，`config.ts` 与 `rolePolicyNameCollection.ts` 等服务级公共件留服务外层）；
UI 层复用同一套类型、不另建视图模型；
i18n 展示文案与传输基础设施（`ApiError` 等）不受此约束。
