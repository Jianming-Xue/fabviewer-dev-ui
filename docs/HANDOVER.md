# vui 项目交接文档（2026-10-16，2026-10-19 更新）

> 本文记录项目当前状态，供交接使用。事实性信息以本文为准；架构决策背景另见持久记忆（`vui-project-decisions`）。所有"实测 ✅"均通过 CDP 驱动真实浏览器验证过。`npm run type-check` / `lint` / `build` 全绿。dev server 运行中（:5173）。**git 仓库已建**（2026-10-19 首推）：`git@github.com:Jianming-Xue/fabviewer-dev-ui.git`（main，仓库根=本 vui 目录，`services/` Go 代码不在库内；本机 22 端口被代理阻断，`~/.ssh/config` 已配 GitHub SSH over 443 回落）。资产文件未清理。AI 生成的艺术组件在 `src/app/images/` 下。

---

## 一、项目定位

**vui** — FabViewer（半导体工厂日志检索/诊断平台）的前端。当前完成：应用壳 + 登录/修改密码 + 两个业务模块（全部 Mock 驱动）。后端 `.NET` 服务（`../webui/`）尚未对接。

## 二、快速上手

```bash
npm install        # Node 24 / npm 11
npm run dev       # :5173，默认 VITE_MOCK=true，无需后端
npm run type-check / lint / build   # 全绿
```

- **换 Mock/真实后端**：`.env.development` 的 `VITE_MOCK`
- 登录：任意非空用户名/密码；修改密码：旧密码非空、新密码 ≥8 位
- 账号：`MORRISLI` 可复现记住用户名；权限演示账号 `admin`（全功能）/ `test`（仅角色+Server Hang）

## 三、架构（src/）

| 路径 | 职责 |
|---|---|
| `app/views/LoginView.vue` | 登录 + 修改密码（URL 驱动：`/login` ⇄ `/change-password`；2026-10-15 由 src/views 并入 app/） |
| `app/views/HomeView.vue` | 首页（空白页） |
| `shared/module/` | 模块注册契约实体（Fv 前缀，2026-10-15 定稿、2026-10-16 收敛为三件套）：`FvModule`（id/key/icon/url/order/features/messages）、`FvFeature`（**id 全局唯一**/key/url/order/children=功能组/controls/component；children 非空=功能组且其 controls 一律失效）、`FvManagedControl`（id/**key**/type）；派生投影类型 FvNavNode/FvPermissionEntry/FvPermissionFeatureNode/FvPermissionModuleNode 已删——导航与权限树直接消费核心模型 |
| `modules/registry.ts` | ★ 唯一插拔点：只暴露 4 个方法——`getNavModules(isGranted?)`（过滤后的 FvModule 清单：URL 命中模块/功能组放行整棵子树、命中功能仅该功能、组下无放行功能整组隐藏）/ `getRoutes()`（路由）/ `getModules()`（原样清单，权限树适配器消费）/ `getMessages()`（词典聚合），全部由功能树派生（URL 单源不双写）；modules 数组为内部 |
| `modules/config/` | Server Hang Reason Config（5 接口 CRUD） |
| `modules/rule-searching/` | Log Searching 模块（url `/log-searching`）/ MES Rule Info Searching 功能（url `/log-searching/mes-rule-info`，2026-10-16 模块组 URL 与功能路由 URL 分离）：16 条件检索+结果表+列设置+Export/RuleLog/FullLog；RuleLogDialog/HangDialog 在 `dialogs/`，FvInteractiveDialog 体系 |
| `modules/security/` | 用户和安全（2026-10-15 新增）：用户/角色/登录策略注册，角色管理与用户管理已实现（用户页详见 §4.3，2026-10-19 过期列/角色列定稿）；`dialogs/` 下 RoleEditDialog/RolePermissionDialog（FvInteractiveDialog 体系） |
| `app/layouts/FvShell.vue` | 壳：侧栏（多级、选中/悬停规则、折叠）+ 顶栏（48px）（曾用名 AppShell） |
| `app/layouts/FvMainLayout.vue` | 壳布局包裹主界面路由（曾用名 MainLayout） |
| `shared/plugins/vuetify.ts` | Vuetify 实例与全局配置：FA 图标集+aliases、light/dark 双主题色板、组件默认值（outlined+compact 控件、btn 不大写）（2026-10-15 由 app/plugins 下沉——纯基础设施，不依赖 app/modules） |
| `app/i18n/index.ts` | i18n 薄装配层：shared 工厂 + app 词典 + 各模块词典合并出实例（2026-10-15 由 plugins/ 并入） |
| `app/router/index.ts` | 路由 + 守卫（未登录跳 /login） |
| `app/stores/auth.ts` | 认证（token 持久化、8h 有效期；登录成功拉权限、登出/过期清权限） |
| `app/stores/permission.ts` | 权限（2026-10-15）：登录后拉取字符串清单（`Function:<URL>` / `Control:<URL>:<控件ID>`，后端不管格式），拆分功能 URL 集合与控件键集合；`isGranted(url)` 供导航过滤、`hasControl(url,id)` 供控件管控；localStorage `vui.permissions` 持久化、fail-closed；`fetchPermissions(username)` 按登录用户名拉取（2026-10-16 参数化）；Mock 口径：`admin` 全功能（三模块级 Function 串+控件通配）、`test` 仅角色+Server Hang 两功能、其他用户名空清单 |
| `app/images/` | 图像类组件：`FvLogo.vue`（全局 logo，曾用名 AppLogo）+ `LoginArt*.vue`（登录页两幅内联 SVG 插画，防拷贝） |
| `app/dialogs/ChangePasswordDialog.vue` | 顶栏修改密码弹窗（继承 FvInteractiveDialog，经 openInteractiveDialog 打开；表单/提交/清空全部内聚） |
| `shared/components/FvSearchButton.vue` | 全局搜索按钮：主题色实底 + 搜索图标，type=submit（表单内 Enter 即触发 click），文案默认 common.search 可用 label/插槽覆盖（2026-10-15） |
| `shared/components/FvNewButton.vue` | 全局新增按钮：主题色实底圆形 + 加号图标，32px（标准 2/3，2026-10-15 调优）+ 浅灰水波纹，border-radius 50% !important 覆盖全局 6px 圆角，aria-label 默认 common.add |
| `shared/components/FvTable.vue` | 全局表格（2026-10-15 声明式定稿，泛型 `Row`）：**列由 `FvTableHeader` 声明**（`data` 传当前页数据、`pageContent` 传服务端分页信息——不传隐藏分页条：总数/«/‹/页码≤10/›/»）；headerType=text（headerClass 调样式）/switch（FvSwitch，@switch-change）/multiValue（FvMultiValueCell 多值单元格，2026-10-19 新增）/custom（default 插槽）/action（固定末列，actions=edit(pen 主题色)/delete(trash 危险红)/view(eye 信息蓝) 图标钮，@edit/@delete/@view 回调；不声明则无此列）；`sort` 布尔=表头三态排序（正→倒→恢复，箭头自带）；`insert` 回调→右上角 FvNewButton，返回新行回显首行（@inserted）；`selectMode`：single=点行选中（整行主题色+首格左 3px 主题色竖条）/multiple=第一列复选框（v-model:selected）；空数据恒显 5 空白行；表头恒显示（sticky，需配 .v-table__wrapper overflow 放行）；表头深灰底（文字色 14% 混入容器底色，双主题自适应，同用于 sticky 吸顶底色）；insert 工具行与表头间距 2px；容器内边距 3px + 圆角 --vui-radius-s（内层 v-table 同心 3px，需 !important 压 tokens）；排序箭头 = chevron 上/下 12px、文字左·箭头贴右（作用于 .v-data-table-header__content）；switch 列点击即写回行数据（视觉即时更新）再抛 @switch-change（落库失败由调用方重拉覆盖）；selectMode 默认 single；坑：插槽 vnode props 是 kebab 原名需双拼写读、无值布尔属性是空串、路由视图根不带壳层 scope id（跨边界选择器必须全局层）；**表内一律 v-tooltip `content-class="vui-table-tip"`**（2026-10-19 统一底框：`--vui-tooltip-bg` 浅 #5a5a5a/深 #000、白字；禁用提示/多值展开/过期状态皆此口径） |
| `shared/components/FvTableHeader.vue` | 表头声明组件（无渲染，被 FvTable 收集）：title/dataKey/headerType/headerClass/align/sort/actions |
| `shared/components/FvMultiValueCell.vue` | 多值单元格（2026-10-19 由 MultiValueCell 更名加 Fv 前缀并定稿 v5）：一律主题色标签（v-chip small label primary）显示首值，标签后跟「**[+值的总数−1]**」——空值=空白标签+[+0]、单值=[+0]、多值悬停多行展开全部值（vui-table-tip）；经 `FvTable header-type="multiValue"` 内置或独立挂载（MES 结果表 6 列沿用） |
| `shared/components/FvSwitch.vue` | 全局开关（Apple 风格，2026-10-15 定稿）：轨道 34×20 胶囊（实色，开=主题色/关=文字色 45% 中性灰——surface-variant 太淡，2026-10-15 调优）、白色 14px 滑块内嵌 3px（与主题色分离）、滑行 ±7px 按新轨道校准；坑：track 为 content-box（width 须 border-box）、v4 滑块与轨道是兄弟节点（滑行 = input 槽 translateX）、scoped 下不能用组件根类做前缀 |
| `shared/components/FvNavItem.vue` | 递归菜单组件（通用输出到 shared，当前仅 AppShell 使用；曾用名 AppNavItem/NavItem，AppShell 内与 registry 的 NavItem 类型撞名故加 Fv 前缀） |
| `shared/components/FvTimer.vue` | 全局日期时间输入（**2026-10-19 v3 定稿**，前史见下）：分段输入框（年/月/日/时/分/秒独立段、满位跳格、唯一解自动补零）+ 尾部图标弹面板（日历 + 时/分/秒虚拟滚轮）；mode=date/time/datetime；**`precision='second'|'minute'`**（minute=秒段/秒轮/model 秒位整体隐藏，model 变 'HH:mm'，2026-10-19 为 MES 检索加）；**外部三通道**（同日加，供检索表单替换自建控件）：`errorMessages`（跨字段校验与内部红提示同消息行/红描边）、`hint`（弱化提示占同一行）、`clearable`+`clear` 事件（MES 两处定稿**不启用**清除钮）；model 一律后端规范串；**面板选择走草稿态**：日历/滚轮点选只进 draft，点「确认」才落段回显，未确认关面板=草稿丢弃，`confirmDisabled` 可禁用；**开面板即补齐草稿显示值**（用户定稿 2026-10-19：日期缺=今天、滚轮居中缺=00，不作任何选择直接确认也整体回显）；**虚拟滚轮**（同日重写）：自持连续浮点 pos+target、rAF 缓动吸附、显示值取 idx mod n → 时/分/秒双向无限循环（23 后续 00）、与日历面板同宽 328px、点可视行即吸附该行；坑①：原生 scrollTop+复制份回收方案在惯性甩动下越界断档+guard 吞事件丢选中，勿回退；坑②：**setPointerCapture 会把 click 重定向到捕获元素——行上 @click 不触发，点选须在 pointerup 判 moved 自行处理**；坑③：onBoxClick 原无条件聚焦首空段会把「点月/日」焦点抢回年——点在段输入上须放行原生聚焦。日历面板规格见 §五；`UserManagementView` 临时测试位四例已删（2026-10-19 验收完成） |
| `shared/api/http.ts` | fetch 封装（统一响应壳、Mock 分流） |
| `shared/api/mock/core.ts` | Mock 注册核心 |
| `shared/toast/` | ★ 公共 Toast（4 类语义，`useAlertToast()` 全局调用；组件 `FvAlertToastHost.vue`（挂 App.vue）+ `FvAlertToastItem.vue`，2026-10-16 定稿 Fv 前缀） |
| `shared/dialog/` | ★ 公共 Dialog（2026-10-16 层级定稿，完整规则见 CLAUDE.md）：**`FvBaseDialog.vue` 全局基座（三区布局/拖动/开合动画/尺寸上限），仅允许被派生 Dialog 基类继承**——① `FvModalDialogHost.vue` 语义五件套基类/宿主（`useModalDialog()`：成功/错误/警告/信息/确认）② `FvInteractiveDialog.vue` 业务弹窗基类（纯透传）← **普通业务弹窗一律继承它**，经 `openInteractiveDialog(组件, props)` 编程式打开、`FvInteractiveDialogHost.vue` 单例宿主承载（props 进/`resolve` 出/自动排队；类型约束 `FvBaseDialogComponent` + 运行时守卫检测基座卡片）。业务弹窗不得直接导入 FvBaseDialog、不得页面内 v-model 自挂载、不得裸 `v-dialog`；Dialog 组件统一放 `dialogs/` 目录（app/dialogs、modules/<模块>/dialogs） |
| `shared/utils/time.ts` | 时间/数值/格式化工具 |
| `shared/styles/tokens.css` | 设计令牌（色板、圆角、布局、动效、组件定制） |
| `shared/i18n/` | i18n 机制 + shared 层词典：`createVuiI18n` 工厂（LOCALE_KEY/AppLocale）、common/dialog/time/validation 键（app 与模块共用）（2026-10-15 由全局词典拆分） |
| `app/i18n/` | app 层词典：app/nav/theme/topbar/login/home 键（壳与登录/首页） |
| `modules/*/api/` | 各模块 Mock + 接口客户端 |

## 四、当前完成度

> **布局总纲（2026-10-15 定稿）**：任何载入主内容区的视图**自动纵向铺满、四向 3px 边距**——由布局层统一提供（tokens `--vui-content-padding: 3px`；FvShell 内容区 flex 列 + `.vui-content > * { flex: 1 0 auto }`：自然高度不足则撑满、超出则内容区滚动），**模块页面不再自行调边距/高度**。全局滚动约束：页面级（html/body）零滚动；纵向滚动只出现在主内容区；横向全站禁止。

### 4.1 应用壳
- 路由/登录守卫/面包屑/多级菜单/明暗切换/中英切换 ✅；菜单按功能权限过滤（登录拉权限清单，limited 用户演示：Config 整模块隐藏，2026-10-15） ✅;
  **权限配置树**（2026-10-16 拆分：`shared/components/FvTree` 通用树外壳+递归 FvTreeList + `modules/security/components/PermissionTree` 适配器 + registry.getPermissionTree；原 FvPermissionTree/FvPermissionFeatureBranch/shared/permission/treeModel 已删，treeModel 仅存两函数并入适配器）：三态勾选（选中=对号/被动选中=框内小方块/不选=空框，主题色）——被动=被主动祖先覆盖；操作只影响本级及下级；祖先授权期取消落 `Deny:<URL>[:<控件ID>]` 排除串（store 做减法）；全选=全部主动选中；工具条（虚线下居中）全选/折叠两枚状态联动钮；Control 只存功能级——通配 `Control:<功能URL>`、精确 `Control:<功能URL>:<控件ID>`；演示入口 `app/dialogs/PermissionConfigDialog` 已删除（2026-10-16：孤儿文件且违反 Dialog 体系，备份 /tmp/PermissionConfigDialog.vue.bak）；权限编辑经 RolePermissionDialog（角色表格「权限」单元格） ✅；Home 为空白页（2026-10-15 内容清空）；Home 菜单不走 router-link（/ 是全部模块路由父记录，router-link 恒判 active）——点击导航 + `:active` 精确匹配 ✅
- 顶栏修改密码：独立组件 `ChangePasswordDialog`（继承 FvInteractiveDialog，菜单点击经 `openInteractiveDialog()` 编程式打开）——无图标、标题居中、遮罩加深 scrimOpacity=0.5、取消=普通按钮/确认=主题色；表单按登录页形式——顶部居中 logo(64px)、用户名只读（取登录用户，fa-user 图标）、三个密码框带 fa-lock 前缀与 fa-eye/fa-eye-slash 明文切换；成功→emit('resolve', true)+关窗+成功 Toast+**清空登录态回登录页**（用新密码重登），失败→失败 Dialog（接口 errMsg）且弹窗保留可重试；`@closed` 统一清空表单（2026-10-14 迁移/完善） ✅
- 菜单选中：底色主题色10%透明+文字变主题色，悬停不变底色 ✅
- 侧栏底色随主题（浅色白/#090909） ✅
- 登录页背景固定浅色渐变(#e1ebe7→#f9fafb)，不随主题切换 ✅
- 全局浅色主题渐变背景（fixed 视口） ✅

### 4.2 登录页
- 品牌区 logo(88px) + 主题色标题 ✅
- 记住我（复选框、主题色、持久化用户名） ✅
- 登录成功跳 redirect 页 ✅
- 左侧展示区：内联 SVG 图（380px 居中） + 下方两圆圈（主题色，当前项拉长为胶囊） ✅
- 图下主题色 15px 加粗居中简述 ✅
- 10s 自动轮换，圆圈点击重置计时 ✅
- 切换动画：仅卡片翻转（页面背景静止） ✅
- 修改密码成功 / 登录成功：全局成功 Toast（圆形实体图标前缀 + 成功色边框 + 20% 透明底 + 5s 自动消失，2026-10-14 由顶部 Alert 迁移） ✅
- 登录失败 / 修改密码失败：全局失败 Dialog（错误图标标题 + 复制 + OK，正文优先取接口 errMsg，2026-10-14 由卡片内 v-alert 迁移） ✅
- Mock 失败模拟：登录密码输 `fail` → 401；修改密码旧密码输 `fail` → 400（均带 errMsg，供失败 Dialog 演示） ✅

### 4.3 业务模块
- **Config**：分页列表、行选择、编辑回显、状态切换、增删改查全链路 ✅
- **用户和安全（security，2026-10-15 新增）**：用户/角色/登录策略三个功能注册；**角色管理已实现**——搜索卡片（Label=Role 的 480px 输入框 + `FvSearchButton` 底边齐平，Enter/点击查询）+ 结果卡片（仅表格 + `FvNewButton` 圆形加号新增；卡片间距 3px、结果卡片铺满（四向 3px 与纵向铺满由布局层自动提供）、表格区内部滚动（2026-10-15 定稿）；v-data-table 分页，列 = ID/名称/描述/启用开关（`FvSwitch` 行内切换落库）/权限（点击开 RolePermissionDialog 分配树）/操作（编辑+删除，删除先 confirm））；`RoleEditDialog`（新增/编辑共用、标题随入口变）只编辑基本信息，启用与权限分列维护；受控按钮（新增/编辑/删除）按控件权限显隐；接口 `GET /api/v1/security/roles/page`（keyword 模糊匹配 ID/名称/描述，服务端分页）；**用户管理已实现**（`UserManagementView`：搜索卡+用户表格全链路，行内 FvSwitch 状态开关、FvTableHeader custom/action；2026-10-19 定稿两处列显示：**角色列=header-type="multiValue"**（首值主题色标签+[+总数−1]，悬停全列，见 §三 FvMultiValueCell）；**过期两列（账户/密码）v5=纯文字**——只显示到日期（截 'YYYY-MM-DD'）、无图标不着色，空值显示 `neverExpire` 文案且悬停不出状态，有日期悬停下方浮 `vui-table-tip` 黑底状态 tooltip：**过期=日期<今天 / 临近过期=今天≤日期<今天+3 / 未过期=≥今天+3**（`security.users.expireStatus*` 键，文字取深底亮色档 `--vui-tip-*`）；本视图 FvTimer 临时测试位四例已删）；登录策略为占位页 ✅
- **Rule Searching**：条件联动、即时校验、拦截非法提交、分页、列设置记忆、本地存储恢复、Rule Log 弹窗、Export(xlsx)、Full Log(zip)、水波纹统一浅灰 ✅；**时间字段已迁 FvTimer**（2026-10-19：`modules/rule-searching/components/DateTimeField.vue` 删除；start/end = `<FvTimer mode="datetime" precision="minute">`，model 'YYYY-MM-DD HH:mm' 与 store `MINUTE_FORMAT`/`toApiTime` 口径无缝；跨字段校验经 `error-messages` 通道即时标红、end 的 hint 经 `hint` 通道；两字段不启用清除钮（用户定稿，旧「清空自动补 ±1h」联动随 DateTimeField 移除）；默认值不变：End=now、Start=now−1h（`stores/search` `nowMinute()/minutesAgo(60)`））；**检索区控件统一化**（2026-10-19）：8 个 `v-text-field`→`FvTextInput`（透传 label/error-messages/hint/persistent-hint/inputmode/disabled，clear 属性化）、Desc Time `v-switch`→`FvSwitch`；v-select 不动

## 五、UI 定稿速查（全量详见 tokens.css / 各组件）

- 主题色：#2F7D5A(浅) / #4CAA84(深)
- 菜单图标 15px，行高 44px
- 字段 Label 在输入框上方（左对齐框左缘）
- 输入框 36px(compact)
- 圆角阶梯（用户定稿 2026-10-14 收敛）：控件统一 6px（输入框、下拉、按钮、分页钮，`--vui-radius-s`）；卡片/表格/弹窗/抽屉/浮层（Toast、菜单面板）合档 10px（`--vui-radius`）；头像/状态点/开关全圆；标签徽标 6px（`--vui-radius-xs`）。注：Vuetify 4 把 .v-btn / .v-card 等圆角写死 4px 且不消费 v3 的 `--v-*-border-radius` 变量，须直接 `border-radius` 覆盖 + !important
- 全局按钮（2026-10-14 定稿）：**普通按钮 = 凡未指定颜色的按钮**（重置/取消/复制信息等），统一透明底 + 主色边框（守卫 bg-/text- 工具类、图标按钮、分页钮）；实底彩钮不变；点击反馈统一水波纹——非实底彩钮（普通/文字/图标/菜单/选择控件）一律浅灰令牌 `--vui-ripple`，实底彩钮保持白色 currentColor 涟漪
- 公共 Toast（`shared/toast`，顶部居中向下堆叠，2026-10-14 定稿）：边框=语义色、底色=语义色 20% 透明；前缀 FA 圆形实体图标（`fas fa-circle-check / circle-xmark / circle-exclamation / circle-info`，语义色着色，15px）；**高度由文字行高驱动**（单行 41px：内边距 18 + 行高 21 + 边框 2；动作按钮行锁定 21px、按钮垂直居中溢出显示，不推高卡片）；自动消失 成功 5s/失败 10s/警告 10s/信息 5s；失败与信息带「复制信息+关闭」，成功与警告仅关闭；调用 `useAlertToast().success/error/warning/info(msg)`，可选 `{ duration }` 覆盖时长（≤0 常驻）
- 公共 Dialog（`shared/dialog`，2026-10-16 层级定稿：**FvBaseDialog 基座 → FvModalDialogHost（语义五件套基类/宿主）/ FvInteractiveDialog（业务弹窗基类，纯透传）← 业务弹窗继承**；规则全文见 CLAUDE.md）：**`FvBaseDialog` 基础组件**——三区布局（无分割线，纯留白分区）、开合动画内置（打开=从最后鼠标按下点 scale 展开 240ms，关闭=径向遮罩向中心收拢淡出 180ms，原点追踪器已并入组件模块作用域）、props `title / titleIcon（色经 --vui-dialog-icon 变量下发）/ maxWidth(默认420) / centerTitle（标题居中）/ scrimOpacity（遮罩透明度，默认 0.32；遮罩色主题化：浅色黑、深色浅色令牌 --vui-scrim，黑遮黑不可见）`；**内置 persistent**（点击遮罩一律不关闭，仅 Esc / 退出按钮可关；Esc 为组件自补监听，上层有激活弹窗时让位）、插槽 `#title / 默认(正文) / #actions`、v-model 开关（关闭统一走 Esc/按钮通道）、**`@closed` 关闭广播**（任一关闭路径触发一次，「关闭清空」的组件级契约：调用方在此清自己的表单模型；弹窗内部状态随卡片卸载自动重置）、按住标题拖动（expose `resetDrag()`）、高 ≤80vh 正文内部滚动、圆角 10px；**语义五件套（FvModalDialogHost）组合实现**，标题 FA 圆形实体图标（语义色，16px）+词典文案；正文 message（保留换行）/html（v-html 富文本）二选一或同显；按钮 成功=OK(成功色)、错误=复制+OK(失败色)、警告=OK(警告色)、信息=复制+OK(信息色)、确认=取消+OK(主题色)（复制/取消均为普通按钮样式）；OK/取消/Esc 关闭（点遮罩不关；确认类 resolve true/false），复制不关窗（message+html 拼纯文本入剪贴板）；调用 `useModalDialog().success/error/warning/info(msg|opts)` / `await dialog.confirm(...)`，同时多个自动排队
- **日期时间面板**（v-date-picker 弹层，2026-10-18 定稿、**2026-10-19 v3 增补**，唯一入口 FvTimer（DateTimeField 已删），规格落 `tokens.css`）：`hide-header`（去 Select date 标题行）、星期简写随语言（`weekday-format="short"`，Vuetify locale 由 i18n 同步）、周日起始；标题栏 `#controls` 插槽＝双箭头翻年+单箭头翻月+中间某年某月文字（中文=年+月/英文=月+年），钮组 `space-between` 贴左右两侧，与日期间横分割线；**箭头钮与 FvTable 分页箭头完全同规格**（icon/text variant、x-small、FA chevron/angles 14px、圆角 6px、实测 32×32）——坑：**VDatePickerControls 经 VDefaultsProvider 给插槽内 VBtn 下发 `density=comfortable`（钮被压至 20×20），插槽按钮必须显式 `density="default"` 覆盖**；选中日期主题色实底（原生 flat primary + tokens.css 兜底覆盖，实测浅 #2F7D5A/深 #4CAA84）；**面板选择走草稿、确认才回显**（draft + 右下「确认」普通文字钮 + `confirmDisabled`；**开面板时段缺失以面板显示值起稿**——日历=今天、滚轮居中=00，不选直接确认也整体回显，2026-10-19）；**时/分/秒虚拟滚轮**（2026-10-19）：双向无限循环（23 后接 00）、点可视行吸附该行、与日历同宽 328px 三列均分，列头/行字与日历星期/日期格统一 14px `--vui-text`；**邻月补白日**：`show-adjacent-months` 显示、文字浅灰（`--vui-text` 28%），点击**不选日期、跳到该月**（捕获层拦 click + `v-model:month/year` 受控）；**整行皆邻月的网格行隐藏**（`:has()` 选择器，去掉日历与确认钮间的凑行空档）
- **表格悬浮提示底框**（2026-10-19 定稿，全局 `.vui-table-tip`@tokens.css）：FvTable 内所有 v-tooltip 一律 `content-class="vui-table-tip"`；底色 `--vui-tooltip-bg`（浅 #5a5a5a / 深 #000）、白字；tooltip 内状态文字用深底亮色档 `--vui-tip-success/warning/error`（正文语义色压深底对比不足，用户报"绿看不清"后单独设档）
- 全局下拉列表项 40px 高
- 图标按钮水波纹浅灰 rgba(6,13,17,.12)/rgba(226,230,232,.16)
- 切换动画仅卡片(0.25s 交叉淡入淡出)
- 展示区图片浮动动画 6s

## 六、遗留事项 / 已知问题

1. **HMR 偶发失效**：多次连续编辑后 dev server 可能进入脏状态（表现为页面元素缺失、样式丢失）。重启 `npm run dev` 即恢复。
2. **CDP 测试脚本坑**：在同步代码块填值后立即 `requestSubmit` 会被 Vuetify 渲染批处理吞掉（提交"卡住"的假象）。**脚本中 requestSubmit 需延迟 ≥300ms**。另三坑（2026-10-18 实测）：① `el.click()`/`dispatchEvent` **绕过命中测试**——会出现"脚本能选中、真实用户点不中"的假象，验证点击类问题必须用 `Input.dispatchMouseEvent` 真实鼠标事件并以 `elementFromPoint` 断言命中的就是目标；② 菜单/弹层开合动画（scaleY）未结束时量几何得到 4px 高假值，**动画后等 ≥1s 再测**；③ `Runtime.evaluate` 表达式里 NodeList 无 `.map/.find`，先 `Array.from`。
3. `src/assets/login_bk_*.svg` 原文件仍在（登录页已不引用，可删）。
4. Chrome 版本升级（153→155）后 CDP `/json/new` 偶发无 `webSocketDebuggerUrl`，加 retry 即可。
5. 未做单元测试。
6. 后端对接：`shared/api/http.ts` 已留真实 fetch 分支，关 `VITE_MOCK` 即切换。
7. ~~旧提示待统一~~（**2026-10-16 已清零**）：登出确认与顶栏修改密码（10-14）→ Config 删除确认 `v-dialog`→`dialog.confirm()`、两处自建 `v-snackbar`→`useAlertToast()`、RuleLogDialog/HangDialog 裸 `v-dialog`+v-model 自挂载→继承 FvInteractiveDialog+`openInteractiveDialog`；全 src 已无裸 v-dialog/v-snackbar 业务弹窗。同定稿：Dialog 组件归位 `dialogs/` 目录、Dialog 基类加 Fv 前缀（详见 CLAUDE.md）。
8. **拖动抖动修复（2026-10-16）**：弹窗带错误提示时拖动标题滞后——根因两层：① Vuetify `.v-input__details`/`.v-messages__message` 的 150ms 过渡 + 消息外层 VSlideYTransition（TransitionGroup 0.3s 进出场/0.5s move FLIP），拖动起手聚焦输入框失焦重校验触发；② 逐帧改 transform 未提合成层、半透明提示文字重栅格拖尾。修复（FvBaseDialog 内置）：卡片 `will-change: transform` + 标题 pointerdown `preventDefault`（保住焦点）+ 拖动中 `--dragging` 类清零消息区过渡。CDP 逐帧实测：消息 transform 恒 none、相对位移恒定、blurCount=0。

## 七、外部依赖

- 视觉规范：`/Users/xuejianming/Documents/FAB Viewer项目/docs/05-视觉与交互规范.md`
- 模块需求：同目录下 `模块1-日志检索与分析/01-MES Rule信息检索.md`、`模块5-系统管理/01-Server Hang Reason Config.md`
- 后端参考：`/Users/xuejianming/Documents/source/fab-viewer-dev/webui/`（.NET，未对接）

## 八、开发者注意

- **命名规则（2026-10-15 定稿，2026-10-16 扩展）**：功能页面组件以 `View` 结尾（如 `RoleManagementView.vue`）；弹窗组件以 `Dialog` 结尾（如 `RoleEditDialog.vue`、`ChangePasswordDialog.vue`）；树/单元格等公共组件以 `Fv` 前缀 + 语义命名（`FvPermissionTree`、`FvNavItem`）；**Dialog/Toast 组件也统一 Fv 前缀**——`FvBaseDialog`/`FvInteractiveDialog`/`FvModalDialogHost`/`FvInteractiveDialogHost`/`FvAlertToastHost`/`FvAlertToastItem`（原 BaseDialog/ModalDialogHost/InteractiveDialogHost/AlertToast* 已同日更名）；**API 函数名不加前缀**（`openInteractiveDialog`/`useModalDialog`/`useAlertToast`）。存量 `*Page.vue` 已于同日统一为 `View` 结尾（RuleSearchView / SrvHangCfgView）。
- **新模块**：复制现有模块目录，在 `registry.ts` 数组加一行即完成接入（菜单/路由/词典/Mock/权限目录全自动）。模块 manifest（`FvModule`，实体在 shared/module）自描述：模块名(i18n键)/图标/URL/order + `features`（`FvFeature`）功能树；叶子功能必填完整 URL 与组件，带 `children` 即为功能组（无路由）；`controls`（`FvManagedControl`）登记页内受管控控件（id 建议『模块.功能.控件』命名空间，name 为 i18n 键），权限系统按 URL+控件 ID 管控。
- **视觉改动**一律走 `tokens.css` 或组件内令牌，禁止硬编码颜色。
- **文案**一律走 i18n 词典，新增必须同时补 zh-CN/en-US；键按归属落位——公共组件/跨模块文案进 `shared/i18n`，壳与登录/首页进 `app/i18n`，模块私有进 `modules/<m>/i18n`（src 根不再放词典）。
- **提示反馈**一律走 `useAlertToast()`（success/error/warning/info），不要各页面自建 snackbar/alert；**重要信息**用 `useModalDialog()`（含 `await dialog.confirm()`），正文富文本走 `html` 选项（须为可信内容）。
- **弹窗内表单防残留**（FvBaseDialog 的 `@closed` 契约）：表单状态放进弹窗插槽内则随卡片卸载自动重置；放父作用域则在 `@closed` 里一行清空（取消/Esc/成功任一路径都会触发）。
- **新增弹窗的正确姿势**（层级定稿 2026-10-16，规则全文在项目根 CLAUDE.md，每会话自动加载）：业务弹窗**继承 FvInteractiveDialog**（不是组合 FvBaseDialog——基座只允许被 Dialog 基类派生继承）做成独立组件，文件放该级 `dialogs/` 目录（app/dialogs 或 modules/<模块>/dialogs），经 `openInteractiveDialog(组件, props)` 编程式打开、FvInteractiveDialogHost 承载；传参走 props、结果经组件 `emit('resolve', payload)` 在关闭时回传到 await 的 Promise；禁止页面 v-model 自挂载、禁止裸 v-dialog。
- **重命名/删除 shared 组件文件后必须重启 dev server**（2026-10-16 实测：HMR 对文件增删易进脏状态，表现为元素消失/旧模块仍在）。
- 验证 UI 行为用 CDP 驱动无头 Chrome（`/tmp/vui-*.mjs` 为模式参考），注意 requestSubmit 延迟与 §六.2 三坑；**点击/选择类交互一律用 `Input.dispatchMouseEvent` 真实事件验证**（合成 click 不算数）。
