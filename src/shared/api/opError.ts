import { tShared } from '@/shared/i18n'
import { useAlertToast } from '@/shared/toast/useAlertToast'

import { ApiError } from './errors'

/**
 * 接口操作失败统一呈现（2026-10-17 抽自 RoleManagementView）：
 * 传输层非 200 / 超时已由 shared/http 全局错误 Dialog 呈现（去重，此处跳过）；
 * 业务失败（壳 success≠0）Toast 直出接口 errMsg，无则通用兜底。
 * 组件/弹窗组件/接口调用方均可用（useAlertToast 为模块级单例）。
 */
export function showOpError(e: unknown): void {
  if (e instanceof ApiError && e.transport) return
  useAlertToast().error(e instanceof ApiError && e.errMsg ? e.errMsg : tShared('common.opFailed'))
}
