import { reactive } from 'vue'

export type DialogKind = 'success' | 'error' | 'warning' | 'info' | 'confirm'

export interface DialogOptions {
  /** 覆盖默认标题（默认：图标+成功 / 图标+错误 / 图标+警告 / 图标+信息 / 确认，图标为 FA 圆形实体） */
  title?: string
  /** 正文纯文本（保留换行） */
  message?: string
  /** 正文富文本（v-html 渲染，内容须为应用内可信来源，勿直接拼用户输入） */
  html?: string
  /** 覆盖 OK / Confirm 按钮文案（默认 OK） */
  okText?: string
  /** 覆盖 Cancel 按钮文案（仅确认类，默认 取消） */
  cancelText?: string
}

interface PendingDialog {
  kind: DialogKind
  options: DialogOptions
  /** 确认类：true = 点了 Confirm，false = 取消 / Esc / 点遮罩；其余四类关闭即 resolve(true) */
  resolve: (value: boolean) => void
}

/** 模块级单例：宿主组件与所有调用方共享同一份状态（与 useAlertToast 同模式） */
const state = reactive<{ current: PendingDialog | null; queue: PendingDialog[] }>({
  current: null,
  queue: [],
})

function normalize(options: string | DialogOptions): DialogOptions {
  return typeof options === 'string' ? { message: options } : options
}

function show(kind: DialogKind, options: string | DialogOptions): Promise<boolean> {
  const normalized = normalize(options)
  return new Promise((resolve) => {
    const pending: PendingDialog = { kind, options: normalized, resolve }
    // 已有弹窗在展示 → 排队，关闭后自动轮到（重要信息不丢）
    if (state.current) state.queue.push(pending)
    else state.current = pending
  })
}

/** 关闭当前弹窗并唤醒 Promise；由宿主在 OK / Cancel / Esc / 遮罩关闭时调用 */
function settle(result: boolean) {
  const dialog = state.current
  if (!dialog) return
  state.current = state.queue.shift() ?? null
  dialog.resolve(result)
}

/**
 * 公共 Dialog 服务（重要信息的强反馈；不关键信息用 useAlertToast）：
 * - `await dialog.confirm('…删除？')` → true=确认 / false=取消
 * - `dialog.success/error/warning/info('…' | { message | html })` → 关闭时 resolve
 * 同一时刻只展示一个，后续调用自动排队。
 */
export function useModalDialog() {
  return {
    state,
    settle,
    confirm: (options: string | DialogOptions) => show('confirm', options),
    success: (options: string | DialogOptions) => show('success', options).then(() => undefined),
    error: (options: string | DialogOptions) => show('error', options).then(() => undefined),
    warning: (options: string | DialogOptions) => show('warning', options).then(() => undefined),
    info: (options: string | DialogOptions) => show('info', options).then(() => undefined),
  }
}
