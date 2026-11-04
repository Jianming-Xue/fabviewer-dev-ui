import { createServiceRequest, type RequestOptions } from '@/shared/api/http'
import { ApiError } from '@/shared/api/errors'
import { formatTxTime, getUiVersion, makeTxId } from '@/shared/utils/tx'
import { useAuthStore } from '@/app/stores/auth'

import config from '../config'

import type { TelemetryReplyDto } from '../types/types'

/**
 * telemetry-hub 服务私有请求层（2026-11-04 定稿：与 security-management ./request.ts 同构）：
 * shared/api/http 只做拼 URL/发请求/等回复等公共事务；本服务的私有事在此——
 * - 请求头：txId（方法名 16 位哈希_时间戳_模块版本号）/ txName（调用方法名）/
 *   userName（登录用户名）/ txTime（yyyyMMDDHH24mmss），生成工具在 shared/utils/tx；
 *   Authorization: Bearer 令牌由 shared/http 统一注入（2026-10-29，全服务同口径），本层不重复挂
 * - 出参壳：{ code, success, errMsg, data, txId }（security-management 2026-10-22 后端口径，本服务对齐）——
 *   code 字符串（成功恒 'OK'，失败默认 'FAIL'、可指定业务码）；success 布尔 true=成功/false=失败
 *   （失败 errMsg 携错误信息）；txId 为请求头入参原封回显；业务成败 HTTP 码恒 200，
 *   非 200 属非正常状态已由 shared/http 统一收口；解析后返回 data
 * - 模块版本号：txId 末段，取**发起请求的 UI 模块**版本（FvModule.version，路由上下文注入；
 *   非模块路由回退 app 壳版本）；服务 config 不持有版本（2026-10-17 迁至 UI 模块）
 */
const raw = createServiceRequest(config)

/** 交易头四件套（txId/txName/userName/txTime）：常规请求由 telemetryReply 注入；
 *  raw fetch 场景（Full Log zip 下载等不走统一壳的调用）亦复用本函数补齐同套头 */
export function txHeaders(txName: string): Record<string, string> {
  const auth = useAuthStore()
  return {
    txId: makeTxId(txName, getUiVersion() || '0'),
    txName,
    userName: auth.userName,
    txTime: formatTxTime(),
  }
}

/** 原始回复壳（交易头服务私有包装）：需直接读 code/success/errMsg 组合的场景用 */
export async function telemetryReply<T>(
  txName: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<TelemetryReplyDto<T>> {
  return raw<TelemetryReplyDto<T>>(method, path, {
    ...opts,
    headers: txHeaders(txName),
  })
}

/** 常规壳拆解：success false → ApiError（业务失败，呈现归调用方）；成功返回 data。
 *  业务失败 HTTP 恒 200，ApiError.errCode 记 200；业务码为 code 字符串（'FAIL'/指定码），
 *  错误文案归 errMsg（与 security-management securityRequest 同口径） */
export async function telemetryRequest<T>(
  txName: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const envelope = await telemetryReply<T>(txName, method, path, opts)
  if (!envelope.success) {
    throw new ApiError(200, envelope.errMsg || undefined)
  }
  return envelope.data
}
