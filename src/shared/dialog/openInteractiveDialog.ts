import { markRaw, reactive, type Component } from 'vue'

/**
 * 只接受 FvInteractiveDialogHost 体系的弹窗组件（即继承业务基类 FvInteractiveDialog 的组件，
 * 层级定稿 2026-10-16）：结构上约束其 $props 含 modelValue（v-model 开关是基座契约的一部分），
 * 未接基座的普通组件在类型层即被拒绝；运行时守卫见 FvInteractiveDialogHost
 * （打开后检测不到基座卡片则报错并自动关闭）。
 */
export type FvBaseDialogComponent = new (...args: never[]) => {
  $props: { modelValue?: boolean }
}

/**
 * 编程式弹窗调用（用户定稿 2026-10-14 架构，基类层级按 2026-10-16 定稿走 FvInteractiveDialog）：
 * FvBaseDialog 不可直接使用，业务弹窗继承 FvInteractiveDialog 做成独立组件后经本方法打开
 * ——跨界面传参（props 进 / resolve 出）由此统一组织。
 *
 * **层叠语义（2026-10-20 改版，原为排队）**：已有弹窗展示中再开新弹窗 → 直接叠放在上层
 * （栈顶=最新），支持"弹窗内再开子弹窗"（如用户信息弹窗内点编辑开 EditUserAttributeDialog）；
 * 关闭即出栈并 resolve 其结果，下层弹窗继续展示。Esc 让位规则见 FvBaseDialog
 * （存在多层激活 overlay 时不关自己，防一键连穿）。
 *
 * 弹窗组件契约（继承 FvInteractiveDialog 的组件自动满足前两条）：
 * 1. `v-model<boolean>` 开关
 * 2. `@closed` 关闭广播（清理表单等）
 * 3. 可选 `emit('resolve', payload)`：关闭时经 Promise 回传结果（未 emit 则 resolve undefined）
 *
 * 用法：`const result = await openInteractiveDialog(ChangePasswordDialog, { someProp })`
 */

interface ActiveDialog {
  id: number
  component: Component
  props: Record<string, unknown>
  /** 关闭前最后一次 resolve 事件携带的结果 */
  result?: unknown
  resolve: (value: unknown) => void
  open: boolean
}

/** 模块级单例：宿主 FvInteractiveDialogHost 与调用方共享（与 useModalDialog/useAlertToast 同模式） */
let seq = 0
const state = reactive<{ stack: ActiveDialog[] }>({ stack: [] })

/** 栈顶（当前最上层展示中的弹窗） */
function topDialog(): ActiveDialog | null {
  return state.stack[state.stack.length - 1] ?? null
}

/** 关闭并出栈（宿主接线用；缺省关栈顶）。出栈即 resolve 调用方 Promise */
function finish(item?: ActiveDialog) {
  const dialog = item ?? topDialog()
  if (!dialog) return
  const i = state.stack.indexOf(dialog)
  if (i < 0) return
  state.stack.splice(i, 1)
  dialog.resolve(dialog.result)
}

/**
 * 打开一个弹窗组件；已有弹窗在展示时**叠放于其上**（层叠语义见文件头，2026-10-20）。
 * 关闭（按钮 / Esc / v-model 任一路径）时 resolve，值为组件最后 emit('resolve', ...) 的载荷。
 */
export function openInteractiveDialog<P extends object = object, R = unknown>(
  component: FvBaseDialogComponent,
  props?: P,
): Promise<R | undefined> {
  return new Promise((resolve) => {
    state.stack.push({
      id: ++seq,
      // 组件定义入 reactive 栈会被 Proxy 包裹（Vue warn: made a reactive object）——markRaw 豁免
      component: markRaw(component),
      props: (props ?? {}) as Record<string, unknown>,
      result: undefined,
      resolve: (value) => resolve(value as R | undefined),
      open: true,
    })
  })
}

/**
 * 关闭全部业务弹窗（2026-10-27，登出/会话失效收口调用）：与 Esc 仲裁器/取消按钮同一通路
 * 逐层收栈（open 置 false、走关闭动画，@closed 出栈时唤醒 Promise，调用方 await 得 undefined）。
 * 宿主挂 App.vue 不随路由切换卸载——防残留必须收口在会话清理处，调用方不得各自处理。
 */
export function closeAllInteractiveDialogs(): void {
  for (const item of [...state.stack]) if (item.open) item.open = false
}

/** 供宿主消费的内部状态与回调（应用代码请勿直接使用） */
export function useInteractiveDialogLauncher() {
  return { state, finish, topDialog }
}
