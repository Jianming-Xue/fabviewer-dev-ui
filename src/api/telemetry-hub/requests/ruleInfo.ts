import { baseOf, createServiceRequest, MOCK_ENABLED, resolveUrl } from '@/shared/api/http'
import { currentLocale } from '@/shared/i18n'
import { useAuthStore } from '@/app/stores/auth'

import config from '../config'
import { telemetryRequest, txHeaders } from './request'

import type { RuleDetailDto, HangEntryDto, PageDto, RuleInfoDto, RuleSearchRo } from '../types/types'

/**
 * MES Rule 信息检索接口（telemetry-hub 服务）：2026-11-04 对齐 security-management 口径——
 * 统一走 telemetryRequest（交易头 txId/txName/userName/txTime + 回复壳 { code, success, errMsg, data, txId } 拆解）；
 * 分页出参 PageDto 与 security-management 同构（totalSize/totalPage 后端直发 + data 行数组）。
 * 例外：Full Log 打包下载（§5.3-8）出参为 zip 二进制、不走统一回复壳——真实分支 raw fetch
 * 自行补齐同套头（交易头 + Authorization Bearer + Accept-Language，与 shared/http 注入口径一致）。
 */

/** Full Log 下载专用裸绑定（仅 Mock 分支使用；Mock handler 直接回 Blob，无壳可拆） */
const rawRequest = createServiceRequest(config)

/** 分页查询请求体（§5.3-9） */
export interface PageRequest {
  pageIndex: number
  pageSize: number
  parameters: RuleSearchRo
}
// ===== 候选类接口 1~6（进页面加载；ipaddress 随 Environment 变化重取） =====

export function fetchEnvList(): Promise<{ env: string[] }> {
  return telemetryRequest('fetchEnvList', 'GET', '/api/v1/env/list')
}

export function fetchIpList(environment?: string): Promise<{ ipaddress: string[] }> {
  return telemetryRequest('fetchIpList', 'GET', '/api/v1/ipaddress/list', {
    params: { environment },
  })
}

export function fetchServerCategoryList(): Promise<{ serverCategory: string[] }> {
  return telemetryRequest('fetchServerCategoryList', 'GET', '/api/v1/server_category/list')
}

export function fetchRuleResultList(): Promise<{ ruleResult: string[] }> {
  return telemetryRequest('fetchRuleResultList', 'GET', '/api/v1/rule_result/list')
}

export function fetchLockObjectList(): Promise<{ lockObject: string[] }> {
  return telemetryRequest('fetchLockObjectList', 'GET', '/api/v1/lock_object/list')
}

export function fetchCallSysList(): Promise<{ calledSystem: string[] }> {
  return telemetryRequest('fetchCallSysList', 'GET', '/api/v1/call_sys/list')
}

// ===== 业务接口 7~10 =====

/** 7 · Rule Info Detail 弹窗日志（游标分页；首次 lastFingerprint/lastOffset 留空） */
export function fetchRuleInfoDetail(
  id: string,
  lastFingerprint?: string,
  lastOffset?: number,
): Promise<RuleDetailDto> {
  return telemetryRequest<RuleDetailDto>('fetchRuleInfoDetail', 'GET', '/api/v1/rule_info/detail', {
    params: { id, lastFingerprint, lastOffset },
  })
}

/** 8 · Full Log 打包下载（.zip，不走统一回复壳；真实分支手工补齐交易头/令牌/语言头） */
export async function downloadFullLog(id: string): Promise<Blob> {
  if (MOCK_ENABLED) {
    return rawRequest<Blob>('POST', '/api/v1/rule_info/full_log', { body: { id } })
  }
  const auth = useAuthStore()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': currentLocale(),
    ...txHeaders('downloadFullLog'),
  }
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`
  const res = await fetch(resolveUrl(baseOf(config), '/api/v1/rule_info/full_log'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(`full_log failed: ${res.status}`)
  return res.blob()
}

/** 9 · 结果分页查询 */
export function fetchRuleInfoPage(req: PageRequest): Promise<PageDto<RuleInfoDto>> {
  return telemetryRequest<PageDto<RuleInfoDto>>('fetchRuleInfoPage', 'POST', '/api/v1/rule_info/page', { body: req })
}

/** 10 · Server Hang 弹框明细（本期按钮置灰；落库后启用） */
export function fetchHangList(id: string): Promise<HangEntryDto[]> {
  return telemetryRequest<HangEntryDto[]>('fetchHangList', 'GET', '/api/v1/rule_info/hang_list', { params: { id } })
}
