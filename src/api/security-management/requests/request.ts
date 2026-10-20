import { createServiceRequest, type RequestOptions } from '@/shared/api/http'
import { ApiError } from '@/shared/api/errors'
import { formatTxTime, getUiVersion, makeTxId } from '@/shared/utils/tx'
import { useAuthStore } from '@/app/stores/auth'

import config from '../config'

import type { SecurityReplyDto } from '../types/types'




/**
 * security-management 服务私有请求层（2026-10-16 定稿）：
 * shared/api/http 只做拼 URL/发请求/等回复等公共事务；本服务的私有事在此——
 * - 请求头：txId（方法名 16 位哈希_时间戳_模块版本号）/ txName（调用方法名）/
 *   userName（登录用户名）/ txTime（yyyyMMDDHH24mmss），生成工具在 shared/utils/tx
 * - 出参壳：{ code, success, errMsg, contents }——success 数字 0=成功、非 0=失败（失败 errMsg 非空），
 *   非服务问题 code 恒 200；解析后返回 contents
 * - 模块版本号：txId 末段，取**发起请求的 UI 模块**版本（FvModule.version，路由上下文注入；
 *   非模块路由回退 app 壳版本）；服务 config 不再持有版本（2026-10-17 迁至 UI 模块）
 */
const raw = createServiceRequest(config)

/** 原始回复壳（交易头服务私有包装）：需直接读 code/success/errMsg 组合的场景用
 *  （如登录特殊口径——success=0 但 errMsg 携机器码即失败，见 ./requests） */
export async function securityReply<T>(
  txName: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<SecurityReplyDto<T>> {
  const auth = useAuthStore()
  return raw<SecurityReplyDto<T>>(method, path, {
    ...opts,
    headers: {
      txId: makeTxId(txName, getUiVersion() || '0'),
      txName,
      userName: auth.userName,
      txTime: formatTxTime(),
    },
  })
}

/** 常规壳拆解：success ≠ 0 → ApiError（业务失败，呈现归调用方）；成功返回 contents。
 *  登录例外口径不走本函数（用 securityReply 自拆） */
export async function securityRequest<T>(
  txName: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const envelope = await securityReply<T>(txName, method, path, opts)
  if (envelope.success !== 0) {
    throw new ApiError(envelope.code || 500, envelope.errMsg || undefined)
  }
  return envelope.contents
}

