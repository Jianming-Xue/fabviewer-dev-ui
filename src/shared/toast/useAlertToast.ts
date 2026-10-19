import { reactive } from 'vue'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  /** 是否提供「复制信息」按钮（失败 / 信息类） */
  copyable: boolean
}

export interface ToastOptions {
  /** 覆盖默认驻留时长（毫秒）；≤0 表示常驻，直至手动关闭 */
  duration?: number
}

/** 各类默认值（用户定稿 2026-10-14）：边框 = 语义色、底色 = 语义色 20% 透明、
 *  前缀 FA 圆形实体图标（语义色）；驻留 成功 5s / 失败 10s / 警告 10s / 信息 5s；失败与信息带复制按钮 */
const KIND_DEFAULTS: Record<ToastKind, { duration: number; copyable: boolean }> = {
  success: { duration: 5000, copyable: false },
  error: { duration: 10000, copyable: true },
  warning: { duration: 10000, copyable: false },
  info: { duration: 5000, copyable: true },
}

const MAX_VISIBLE = 5 // 防御上限：连发太多时丢弃最旧一条，避免铺满屏幕

/** 模块级单例：宿主组件与所有调用方共享同一份数组（无需 Pinia，无持久化诉求） */
const items = reactive<ToastItem[]>([])
let seq = 0
const timers = new Map<number, number>()

function push(kind: ToastKind, message: string, options?: ToastOptions) {
  const id = ++seq
  const duration = options?.duration ?? KIND_DEFAULTS[kind].duration
  items.push({ id, kind, message, copyable: KIND_DEFAULTS[kind].copyable })
  if (duration > 0) timers.set(id, window.setTimeout(() => dismiss(id), duration))
  while (items.length > MAX_VISIBLE) {
    const oldest = items[0]
    if (!oldest) break
    dismiss(oldest.id)
  }
}

function dismiss(id: number) {
  const index = items.findIndex((it) => it.id === id)
  if (index >= 0) items.splice(index, 1)
  window.clearTimeout(timers.get(id))
  timers.delete(id)
}

/** 公共 Toast 服务：toast.success('…') / toast.error('…') / toast.warning('…') / toast.info('…')。
 *  宿主 FvAlertToastHost 已在 App.vue 全局挂载，任何位置（含登录页）调用即弹，无需各页面自建。 */
export function useAlertToast() {
  return {
    items,
    success: (message: string, options?: ToastOptions) => push('success', message, options),
    error: (message: string, options?: ToastOptions) => push('error', message, options),
    warning: (message: string, options?: ToastOptions) => push('warning', message, options),
    info: (message: string, options?: ToastOptions) => push('info', message, options),
    dismiss,
    /** 清空全部（含常驻项） */
    clear: () => {
      for (const id of items.map((it) => it.id)) dismiss(id)
    },
  }
}
