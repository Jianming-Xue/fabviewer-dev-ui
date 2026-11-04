import type { App } from 'vue'

import { useAlertToast } from '@/shared/toast/useAlertToast'
import { tShared } from '@/shared/i18n'

/**
 * 全局错误守卫（2026-10-27）：兜住三类未处理异常——Vue 渲染/组件错误、
 * window error、未处理 Promise 拒绝。此前一律静默失败（控制台都不留痕）。
 * 处置：console.error 全量留痕 + 错误 Toast（可复制）给用户可见反馈；
 * Toast 5s 节流——错误风暴（如 render 循环抛错）只弹第一条，不刷屏。
 * 文案经 tShared（非组件上下文翻译），词典键 app.unexpectedError。
 */

const TOAST_THROTTLE_MS = 5000
const DETAIL_MAX = 200

let lastToastAt = 0

function brief(detail: unknown): string {
  const text = detail instanceof Error ? `${detail.name}: ${detail.message}` : String(detail ?? '')
  return text.length > DETAIL_MAX ? `${text.slice(0, DETAIL_MAX)}…` : text
}

/**
 * 浏览器良性噪音过滤（2026-11-04）：ResizeObserver loop 告警——布局观察回调在一帧内
 * 未派发完，浏览器下一帧自动重试，无功能影响（窗口尺寸变化时 Vuetify 组件常见）。
 * 命中即不弹用户 Toast，只留控制台痕迹。
 */
function isResizeObserverNoise(detail: unknown): boolean {
  const text = detail instanceof Error ? detail.message : typeof detail === 'string' ? detail : ''
  return text.includes('ResizeObserver loop')
}

function notify(detail: unknown) {
  if (isResizeObserverNoise(detail)) return
  const now = Date.now()
  if (now - lastToastAt < TOAST_THROTTLE_MS) return
  lastToastAt = now
  const summary = brief(detail)
  useAlertToast().error(summary ? `${tShared('app.unexpectedError')}: ${summary}` : tShared('app.unexpectedError'))
}

export function installGlobalErrorGuard(app: App) {
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[vui] 组件/渲染错误', info, err)
    notify(err)
  }

  window.addEventListener('error', (e) => {
    console.error('[vui] 全局错误', e.error ?? e.message)
    notify(e.error ?? e.message)
  })

  window.addEventListener('unhandledrejection', (e) => {
    console.error('[vui] 未处理 Promise 拒绝', e.reason)
    notify(e.reason)
  })
}
