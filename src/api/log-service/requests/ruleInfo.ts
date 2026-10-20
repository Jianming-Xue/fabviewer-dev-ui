import { baseOf, createServiceRequest, MOCK_ENABLED, resolveUrl } from '@/shared/api/http'

import config from '../config'

import type { RuleDetailDto, HangEntryDto, PageDto, RuleInfoDto, RuleSearchRo } from '../types/types'

/** 微服务绑定 request：URL = 服务 Host + /log-service + 后端给定接口路径 */
const request = createServiceRequest(config)


/** 分页查询请求体（§5.3-9） */
export interface PageRequest {
  pageIndex: number
  pageSize: number
  parameters: RuleSearchRo
}
// ===== 候选类接口 1~6（进页面加载；ipaddress 随 Environment 变化重取） =====

export function fetchEnvList(): Promise<{ env: string[] }> {
  return request('GET', '/api/v1/env/list')
}

export function fetchIpList(environment?: string): Promise<{ ipaddress: string[] }> {
  return request('GET', '/api/v1/ipaddress/list', {
    params: { environment },
  })
}

export function fetchServerCategoryList(): Promise<{ serverCategory: string[] }> {
  return request('GET', '/api/v1/server_category/list')
}

export function fetchRuleResultList(): Promise<{ ruleResult: string[] }> {
  return request('GET', '/api/v1/rule_result/list')
}

export function fetchLockObjectList(): Promise<{ lockObject: string[] }> {
  return request('GET', '/api/v1/lock_object/list')
}

export function fetchCallSysList(): Promise<{ calledSystem: string[] }> {
  return request('GET', '/api/v1/call_sys/list')
}

// ===== 业务接口 7~10 =====

/** 7 · Rule Info Detail 弹窗日志（游标分页；首次 lastFingerprint/lastOffset 留空） */
export function fetchRuleInfoDetail(
  id: string,
  lastFingerprint?: string,
  lastOffset?: number,
): Promise<RuleDetailDto> {
  return request<RuleDetailDto>('GET', '/api/v1/rule_info/detail', {
    params: { id, lastFingerprint, lastOffset },
  })
}

/** 8 · Full Log 打包下载（.zip，不走统一响应包） */
export async function downloadFullLog(id: string): Promise<Blob> {
  if (MOCK_ENABLED) {
    return request<Blob>('POST', '/api/v1/rule_info/full_log', { body: { id } })
  }
  const res = await fetch(resolveUrl(baseOf(config), '/api/v1/rule_info/full_log'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) throw new Error(`full_log failed: ${res.status}`)
  return res.blob()
}

/** 9 · 结果分页查询 */
export function fetchRuleInfoPage(req: PageRequest): Promise<PageDto<RuleInfoDto>> {
  return request<PageDto<RuleInfoDto>>('POST', '/api/v1/rule_info/page', { body: req })
}

/** 10 · Server Hang 弹框明细（本期按钮置灰；落库后启用） */
export function fetchHangList(id: string): Promise<HangEntryDto[]> {
  return request<HangEntryDto[]>('GET', '/api/v1/rule_info/hang_list', { params: { id } })
}
