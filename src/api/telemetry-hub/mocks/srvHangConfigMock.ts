import { registerMock } from '@/shared/api/mock'

import type { PageDto, TelemetryReplyDto } from '../types/types'
import type { ServerHangConfigDto, ServerHangConfigRo } from '../types/srvHangConfigTypes'

/**
 * Server Hang Reason Config Mock（telemetry-hub 服务，2026-11-04 自 mock.ts 按域拆出）：
 * 出参统一壳 { code: 'OK'/失败 'FAIL'(字符串), success: 布尔, errMsg, data, txId }
 * （txId 回显——Mock 无请求头上下文，一律空串）；分页 data = { pageSize, pageIndex, totalSize, totalPage, data }。
 * 业务失败（唯一键冲突/未找到）以 success:false + errMsg 返回，演练前端失败分支。
 */
const ok = <T>(data: T): TelemetryReplyDto<T> => ({ code: 'OK', success: true, errMsg: '', data, txId: '' })
const fail = (errMsg: string): TelemetryReplyDto<null> => ({ code: 'FAIL', success: false, errMsg, data: null, txId: '' })

/** 内存态配置集（初始 3 条，业务命名真实、不用占位符 —— 05 §六） */
const cfgRows: ServerHangConfigDto[] = [
  {
    id: 'cfg-1001',
    ruleName: 'LOTHOLDRULE',
    hangReason: 'AMACALL_TIMEOUT',
    startLineLike: '%CALL AMA SEND LOT HOLD%',
    endLineLike: '%AMA REPLY LOT HOLD%',
    enabled: true,
    lastUpdatedAt: '20261011143205',
    lastUpdatedBy: 'MORRISLI',
  },
  {
    id: 'cfg-1002',
    ruleName: 'EQPSTATUSRULE',
    hangReason: 'EQP_IF_RETRY',
    startLineLike: 'EQP IF RETRY START%',
    endLineLike: 'EQP IF RETRY END%',
    enabled: true,
    lastUpdatedAt: '20261009091844',
    lastUpdatedBy: 'TANYU',
  },
  {
    id: 'cfg-1003',
    ruleName: 'CARRIERBINDRULE',
    hangReason: 'MCS_SYNC_SLOW',
    startLineLike: '%MCS CARRIER SYNC BEGIN%',
    endLineLike: '%MCS CARRIER SYNC END',
    enabled: false,
    lastUpdatedAt: '20261002174112',
    lastUpdatedBy: 'MORRISLI',
  },
]

/** 业务唯一键冲突（§4.4 联动口径）：命中返回 errMsg，由 handler 以 success:false 壳回复 */
function uniqueConflict(input: ServerHangConfigRo, excludeId: string | null): string | null {
  const dup = cfgRows.some(
    (r) =>
      r.ruleName === input.ruleName &&
      r.hangReason === input.hangReason &&
      r.id !== excludeId,
  )
  return dup ? '相同 Rule 名称与挂起原因的配置已存在' : null
}

/** 审计时间：Mock 扮演后端直接说 wire（YYYYMMDDHHmmss，2026-11-04 真实后端联调口径），入站解码归请求层 */
function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** 审计用户（演示口径）：取登录会话持久化的用户名，未登录回落 MOCK_USER */
function currentUser(): string {
  try {
    return JSON.parse(localStorage.getItem('vui.auth') ?? '').user?.userName ?? 'MOCK_USER'
  } catch {
    return 'MOCK_USER'
  }
}

registerMock('GET', '/telemetry-hub/api/v1/srv_hang_cfg/page', ({ params }) => {
  const pageIndex = Number(params?.pageIndex ?? 1)
  const pageSize = Number(params?.pageSize ?? 20)
  const sorted = [...cfgRows].sort(
    (a, b) => `${a.ruleName}+${a.hangReason}`.localeCompare(`${b.ruleName}+${b.hangReason}`),
  )
  const start = (pageIndex - 1) * pageSize
  const page: PageDto<ServerHangConfigDto> = {
    pageSize,
    pageIndex,
    totalSize: sorted.length,
    totalPage: Math.max(1, Math.ceil(sorted.length / pageSize)),
    data: sorted.slice(start, start + pageSize),
  }
  return ok(page)
})

// state/delete 走 URL query 传参（2026-11-04 晚真实后端口径，body 形态报 RequireParameterMissing）
registerMock('POST', '/telemetry-hub/api/v1/srv_hang_cfg/state', ({ params }) => {
  const row = cfgRows.find((r) => r.id === String(params?.id ?? ''))
  if (!row) return fail('配置不存在或已被删除')
  row.enabled = params?.enabled === true || params?.enabled === 'true'
  row.lastUpdatedAt = now()
  row.lastUpdatedBy = currentUser()
  return ok(null)
})

registerMock('POST', '/telemetry-hub/api/v1/srv_hang_cfg', ({ body }) => {
  const input = body as unknown as ServerHangConfigRo
  const conflict = uniqueConflict(input, null)
  if (conflict) return fail(conflict)
  const created: ServerHangConfigDto = {
    id: `cfg-${1000 + cfgRows.length + 1}`,
    ruleName: input.ruleName,
    hangReason: input.hangReason,
    startLineLike: input.startLineLike,
    endLineLike: input.endLineLike,
    enabled: true, // 新增默认值由后端定（§4.3）
    lastUpdatedAt: now(),
    lastUpdatedBy: currentUser(),
  }
  cfgRows.unshift(created)
  return ok(created)
})

registerMock('PUT', '/telemetry-hub/api/v1/srv_hang_cfg', ({ body }) => {
  const input = body as unknown as ServerHangConfigRo
  const row = cfgRows.find((r) => r.id === input.id)
  if (!row) return fail('配置不存在或已被删除')
  const conflict = uniqueConflict(input, row.id)
  if (conflict) return fail(conflict)
  Object.assign(row, {
    ruleName: input.ruleName,
    hangReason: input.hangReason,
    startLineLike: input.startLineLike,
    endLineLike: input.endLineLike,
    lastUpdatedAt: now(),
    lastUpdatedBy: currentUser(),
  })
  return ok(row)
})

// 6 · Hang Reason 候选字典（活引用 cfgRows：增改原因即时反映；出参形态对齐真实后端=裸字符串数组，2026-11-05 实测）
registerMock('GET', '/telemetry-hub/api/v1/srv_hang_cfg/hang_reason/list', () =>
  ok([...new Set(cfgRows.map((r) => r.hangReason))].sort()),
)

registerMock('DELETE', '/telemetry-hub/api/v1/srv_hang_cfg', ({ params }) => {
  const idx = cfgRows.findIndex((r) => r.id === String(params?.id ?? ''))
  if (idx < 0) return fail('配置不存在或已被删除')
  cfgRows.splice(idx, 1)
  return ok(null)
})
