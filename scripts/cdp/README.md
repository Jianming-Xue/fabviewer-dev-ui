# CDP 验证脚本集（十套）

无头 Chrome + Chrome DevTools Protocol 驱动真实浏览器验证 UI 行为（项目验收口径：
点击/悬停类交互一律 `Input.dispatchMouseEvent` 真实事件，合成 click 不算数）。
每套脚本自带登录态清理（`localStorage.clear()`），互不依赖状态。

## 前置

```bash
npm run dev   # :5173，VITE_MOCK=true
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9333 --no-first-run --disable-gpu \
  --user-data-dir=/tmp/vui-chrome-profile about:blank >/dev/null 2>&1 &
```

## 运行

```bash
node scripts/cdp/run-all.mjs          # 全量十套（套件间 2.5s 缓冲）
node scripts/cdp/vui-policy-test.mjs  # 单套
```

> 注：单套各自稳定全绿；run-all 背靠背跑批偶发时序抖动（上一套 Toast/动效未落定即开测下一套），
> 已在 run-all 加 2.5s 套件间隙兜底——批内失败先单跑复核再判定回归。

## 清单

| 脚本 | 覆盖面 | 检查数 |
|---|---|---|
| vui-policy-test.mjs | 登录策略页全链（表列/搜索/单选样式/校验负例/气球徽标/增删改/字段规范） | 43 |
| vui-names-test.mjs | 名称字典制（用户表 ID→Name 显名、弹窗回显、下拉字典、天数「不限」渲染） | 10 |
| vui-timer-test.mjs | FvTimer 字段规范（msg 行废止、问号 tooltip、错误徽标、图标右距、盒高） | 7 |
| vui-policy-link-test.mjs | LoginDto 嵌套登录链 + 策略联动改密（hint/负例/红字 tooltip） | 7 |
| vui-profile-edit-test.mjs | 用户信息弹窗 → EditUserAttributeDialog 层叠编辑（回显/规则/取消/持久化） | 8 |
| vui-checkbox-test.mjs | FvCheckbox（主题色选中、悬停 ::before 透明，登录页+权限树） | 5 |
| vui-expiry-test.mjs | 新增用户到期策略驱动（+180/-1 清空/切换重算）+ 手动双约束徽标 + 段清空失焦回填 | 17 |
| vui-rp-dialog-test.mjs | 角色和策略弹窗（下拉红星必填拦截、天数移除、激活/到期只读、仅 Hint 随策略） | 11 |
| vui-search-align.mjs | 角色/用户/策略三页搜索框与钮底边对齐（Δ≤1px） | 3 |
| vui-expire-account-test.mjs | 账户延期弹窗（起点计算 当前到期/今天、策略 -1 永不过期提交、无策略 Confirm 禁用、到期列回显） | 9 |

## 已知坑（详见 docs/HANDOVER.md §六.2）

- 同步填值后 `requestSubmit`/点击需延迟 ≥300ms；菜单/弹层动画后等 ≥1s 再量几何
- select 浮层列表虚拟化——DOM 行数≠数据量，勿以行数为断言
- 复用 profile 会带上登录态，/login 被守卫重定向——脚本开头必须清 localStorage 再导航
