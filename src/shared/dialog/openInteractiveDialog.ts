import { reactive, type Component } from 'vue'

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
 * 弹窗组件契约（继承 FvInteractiveDialog 的组件自动满足前两条）：
 * 1. `v-model<boolean>` 开关
 * 2. `@closed` 关闭广播（清理表单等）
 * 3. 可选 `emit('resolve', payload)`：关闭时经 Promise 回传结果（未 emit 则 resolve undefined）
 *
 * 用法：`const result = await openInteractiveDialog(ChangePasswordDialog, { someProp })`
 */

interface ActiveDialog {
  component: Component
  props: Record<string, unknown>
  /** 关闭前最后一次 resolve 事件携带的结果 */
  result?: unknown
  resolve: (value: unknown) => void
  open: boolean
}

/** 模块级单例：宿主 FvInteractiveDialogHost 与调用方共享（与 useModalDialog/useAlertToast 同模式） */
const state = reactive<{ current: ActiveDialog | null; queue: ActiveDialog[] }>({
  current: null,
  queue: [],
})

function finish() {
  const dialog = state.current
  if (!dialog) return
  state.current = state.queue.shift() ?? null
  dialog.resolve(dialog.result)
}

/**
 * 打开一个弹窗组件；已有弹窗在展示时自动排队（与语义五件套同口径）。
 * 关闭（按钮 / Esc / v-model 任一路径）时 resolve，值为组件最后 emit('resolve', ...) 的载荷。
 */
export function openInteractiveDialog<P extends object = object, R = unknown>(
  component: FvBaseDialogComponent,
  props?: P,
): Promise<R | undefined> {
  return new Promise((resolve) => {
    const item: ActiveDialog = {
      component,
      props: (props ?? {}) as Record<string, unknown>,
      result: undefined,
      resolve: (value) => resolve(value as R | undefined),
      open: true,
    }
    if (state.current) state.queue.push(item)
    else state.current = item
  })
}

/** 供宿主消费的内部状态与回调（应用代码请勿直接使用） */
export function useInteractiveDialogLauncher() {
  return { state, finish }
}
