import { zipSync, strToU8 } from 'fflate'

import { ApiError } from '@/shared/api/errors'
import { registerMock } from '@/shared/api/mock'

import type { PageDto, SrvHangCfgDto, SrvHangCfgRo, CostBreakDownDto, HangEntryDto, RuleInfoDto, RuleSearchRo } from './types'

// ===== 可复现的种子随机（演示数据稳定，刷新不漂移） =====
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260922)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)] as T
const int = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1))

const RULES = [
  'LOTHOLDRULE',
  'EQPSTATUSRULE',
  'CARRIERBINDRULE',
  'BATCHSTARTRULE',
  'PRODUCTCHANGERULE',
  'MESHEARTBEATRULE',
]
const TXNS = ['TXN_LOTMOVE', 'TXN_LOTSTART', 'TXN_EQPSTATUS', 'TXN_CARRIERBIND']
const CATEGORIES = ['LIST', 'QUERY', 'FAB', 'IDE', 'XSITE']
const ENVS = ['PROD', 'PIRUN'] as const
const IPS: Record<'PROD' | 'PIRUN', string[]> = {
  PROD: ['10.18.100.1', '10.18.100.3', '10.18.100.2'],
  PIRUN: ['10.28.8.11', '10.28.8.12'],
}
const LOCK_OBJECTS = ['EQP', 'CARRIER', 'LOT']
const CALL_SYS = ['MCS', 'R2R', 'RMS', 'SPC', 'RTD']
const OTHER_RESULTS = ['REOPEN', 'PARTIAL']
const ERR_CODES = ['E1001', 'E2103', 'E3050', 'W0004']
const USERS = ['MORRISLI', 'TANYU', 'CHENWEI', 'SYSBATCH']

const BASE = Date.now() - 24 * 3600 * 1000 // 数据落在最近 24h 内

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0')
}

function msTime(ms: number): string {
  const d = new Date(ms)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}` +
    ` ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}.${pad(d.getMilliseconds(), 3)}`
  )
}

function buildBreakdown(totalSummary: number): CostBreakDownDto[] {
  const items: CostBreakDownDto[] = []
  const locks = LOCK_OBJECTS.filter(() => rand() < 0.5)
  const calls = CALL_SYS.filter(() => rand() < 0.5)
  const parts = [...locks, ...calls]
  if (parts.length === 0) return items
  const weight = totalSummary / parts.length
  for (const o of locks) {
    items.push({ item: o, group: 'LOCK', summary: Math.round(weight * (0.6 + rand() * 0.8)) })
  }
  for (const c of calls) {
    items.push({ item: c, group: 'CALL', summary: Math.round(weight * (0.6 + rand() * 0.8)) })
  }
  return items
}

function buildRows(): RuleInfoDto[] {
  const rows: RuleInfoDto[] = []
  for (let i = 0; i < 187; i++) {
    const isTxn = rand() < 0.3
    const env = pick(ENVS)
    const category = pick(CATEGORIES)
    const serverId = `${category}srv.${int(1, 5)}`
    const cost = Math.round(50 + rand() * 480000) // ms
    const startMs = BASE + Math.floor(rand() * 24 * 3600 * 1000) // 覆盖最近 24h（含默认 1h 查询窗口）
    const multi = (gen: () => string): string[] =>
      rand() < 0.25 ? [gen(), gen()] : [gen()]

    rows.push({
      id: `blk-${pad(i + 1, 4)}`,
      env,
      ipaddress: pick(IPS[env]),
      serverId,
      ruleName: isTxn ? pick(TXNS) : pick(RULES),
      requestType: isTxn ? 'TXN' : 'Rule',
      startTime: msTime(startMs),
      endTime: msTime(startMs + cost),
      ruleResult: rand() < 0.82 ? 'PASS' : rand() < 0.8 ? 'CANCELRULE' : pick(OTHER_RESULTS),
      errorCode: rand() < 0.3 ? multi(() => pick(ERR_CODES)) : [],
      eqpId: multi(() => `CT${pick(['BC', 'GR', 'PR'])}${pad(int(1, 40), 2)}`),
      lotId: multi(() => `P${pad(int(100000000, 999999999), 9)}`),
      carrierId: multi(() => `FOSB${pad(int(100000, 999999), 6)}`),
      userId: multi(() => pick(USERS)),
      tid: multi(() => `T${pad(int(1000000, 9999999), 7)}${int(100, 999)}`),
      totalCostTime: cost,
      costSummary: Math.round(cost * 0.82),
      unaccountedCost: Math.max(0, cost - Math.round(cost * 0.82)),
      execStatus: rand() < 0.06 ? '进行中' : rand() < 0.05 ? '中断' : rand() < 0.04 ? '超时封口' : '已完成',
      hangCount: rand() < 0.12 ? int(1, 3) : 0,
      costBreakDown: buildBreakdown(Math.round(cost * 0.82)),
    })
  }
  return rows.sort((a, b) => a.startTime.localeCompare(b.startTime))
}

const ALL_ROWS = buildRows()

// ===== 过滤（实现全部 16 个条件，口径见 §2.2 / §2.3） =====
function starMatch(value: string, pattern: string): boolean {
  if (!pattern) return true
  if (pattern.endsWith('*')) return value.startsWith(pattern.slice(0, -1))
  return value === pattern
}

function applyFilters(rows: RuleInfoDto[], p: RuleSearchRo): RuleInfoDto[] {
  const { env, serverId, ipaddress, ruleName, tid, eqpId, carrierId, lotId, userId, errorCode, ruleResult } = p
  return rows.filter((r) => {
    if (env && r.env !== env) return false
    if (serverId && serverId.length > 0 && !serverId.includes(r.serverId)) return false
    if (ipaddress && r.ipaddress !== ipaddress) return false
    if (ruleName && !starMatch(r.ruleName, ruleName)) return false
    if (tid && !r.tid.includes(tid)) return false
    if (eqpId && !r.eqpId.some((v) => starMatch(v, eqpId))) return false
    if (carrierId && !r.carrierId.some((v) => starMatch(v, carrierId))) return false
    if (lotId && !r.lotId.some((v) => starMatch(v, lotId))) return false
    if (userId && !r.userId.includes(userId)) return false
    if (errorCode && !r.errorCode.includes(errorCode)) return false
    if (ruleResult && r.ruleResult !== ruleResult) return false
    const min = Number(p.minCost) * 1000
    const max = Number(p.maxCost) * 1000
    if (r.totalCostTime < min || r.totalCostTime > max) return false
    // 时间闭区间按分钟语义：开始时间 = 该分钟起点，结束时间 = 该分钟末尾（05 §4.8）
    const rowStart = Number(r.startTime.slice(0, 16).replace(/[-: ]/g, '') + '00')
    const startBound = p.startTime ? Number(p.startTime + '00') : -Infinity
    const endBound = p.endTime ? Number(p.endTime + '59') : Infinity
    if (rowStart < startBound || rowStart > endBound) return false
    return true
  })
}

// ===== 候选类接口（§5.3 · 1~6，出参即文档示例值） =====
registerMock('GET', '/log-service/api/v1/env/list', () => ({ env: [...ENVS] }))
registerMock('GET', '/log-service/api/v1/ipaddress/list', ({ params }) => {
  const env = String(params?.environment ?? '') as 'PROD' | 'PIRUN' | ''
  return { ipaddress: env && env in IPS ? [...IPS[env]] : [...IPS.PROD, ...IPS.PIRUN] }
})
registerMock('GET', '/log-service/api/v1/server_category/list', () => ({ serverCategory: [...CATEGORIES] }))
registerMock('GET', '/log-service/api/v1/rule_result/list', () => ({ ruleResult: ['PASS', 'CANCELRULE'] }))
registerMock('GET', '/log-service/api/v1/lock_object/list', () => ({ lockObject: [...LOCK_OBJECTS] }))
registerMock('GET', '/log-service/api/v1/call_sys/list', () => ({ calledSystem: [...CALL_SYS] }))

// ===== 9 · rule_info/page =====
registerMock('POST', '/log-service/api/v1/rule_info/page', ({ body }) => {
  const req = (body ?? {}) as { pageIndex?: number; pageSize?: number; parameters?: RuleSearchRo }
  const pageIndex = req.pageIndex ?? 1
  const pageSize = req.pageSize ?? 20
  const params: RuleSearchRo = {
    startTime: '',
    endTime: '',
    minCost: '0',
    maxCost: '99999.99',
    descTime: false,
    ...req.parameters,
  }
  // serverCategory 未单列过滤字段，由 serverId[] 承载（§5.3-9）
  let result = applyFilters(ALL_ROWS, params)
  if (params.descTime) result = [...result].reverse()
  const start = (pageIndex - 1) * pageSize
  return {
    totalPage: Math.max(1, Math.ceil(result.length / pageSize)),
    total: result.length,
    pageIndex,
    pageSize,
    contents: result.slice(start, start + pageSize),
  }
})

// ===== 7 · rule_info/detail（游标分页：每批 150 行，fingerprint 恒定、offset 为行号） =====
const DETAIL_CHUNK = 150

function detailTotal(id: string): number {
  const seed = mulberry32([...id].reduce((a, c) => a + c.charCodeAt(0), 0))
  return 800 + Math.floor(seed() * 700)
}

const LOG_BODIES = [
  'LOT MOVE START, FROM STK TO EQP',
  'CALL AMA INTERFACE SEND, WAIT REPLY',
  'CARRIER BIND CHECK OK',
  'EQP STATUS POLLING, STATE = IDLE',
  'RULE CONDITION EVALUATE, RESULT = TRUE',
  'MCS SYNC CARRIER INFO, RET = 0',
]

function detailLine(id: string, i: number): string {
  const t = msTime(BASE + i * 137)
  const tid = `T${pad(int2(id, i) % 10000000, 7)}`
  const body = LOG_BODIES[(i * 31 + id.charCodeAt(4)) % LOG_BODIES.length]
  return `${t} ${id.replace('blk-', 'FABsrv.')} [${tid}] INFO  ${body}`
}

function int2(id: string, i: number): number {
  return (id.charCodeAt(4) * 31 + i * 7) % 10000000
}

registerMock('GET', '/log-service/api/v1/rule_info/detail', ({ params }) => {
  const id = String(params?.id ?? '')
  const offset = params?.lastOffset !== undefined && params?.lastOffset !== ''
    ? Number(params.lastOffset)
    : 0
  const total = detailTotal(id)
  const end = Math.min(offset + DETAIL_CHUNK, total)
  const lines: string[] = []
  for (let i = offset; i < end; i++) lines.push(detailLine(id, i))
  return {
    raw: lines.join('\n'),
    finished: end >= total,
    fingerprint: `FP-${id}`,
    offset: end,
  }
})

// ===== 8 · rule_info/full_log（fflate 现场打 zip：每个文件一个 .log） =====
registerMock('POST', '/log-service/api/v1/rule_info/full_log', ({ body }) => {
  const id = String(body?.id ?? 'blk-0001')
  const mkLog = (fileIdx: number): Uint8Array => {
    const lines: string[] = []
    for (let i = 0; i < 120; i++) lines.push(detailLine(id, i + fileIdx * 120))
    return strToU8(lines.join('\n'))
  }
  const zipped = zipSync({
    'FABsrv.log.1': mkLog(0),
    'FABsrv.log.2': mkLog(1),
  })
  return new Blob([zipped as BlobPart], { type: 'application/zip' })
})

// ===== 10 · rule_info/hang_list（本期按钮置灰；结构与数据先备好） =====
registerMock('GET', '/log-service/api/v1/rule_info/hang_list', ({ params }): HangEntryDto[] => {
  const id = String(params?.id ?? '')
  return [0, 1].map((n) => {
    const t = BASE + n * 3600_000
    return {
      startTime: msTime(t),
      endTime: msTime(t + int(800, 5200)),
      hangCostMs: int(800, 5200),
      startLineLog: detailLine(id, n * 10),
      endLineLog: detailLine(id, n * 10 + 5),
      hangReason: 'AMACALL_TIMEOUT',
      startLineId: `${id}-s-${n}`,
      endLineId: `${id}-e-${n}`,
    }
  })
})

/* ===== Server Hang Reason Config（config 模块后端并入 log-service，2026-10-16） ===== */

/** 内存态配置集（初始 3 条，业务命名真实、不用占位符 —— 05 §六） */
const cfgRows: SrvHangCfgDto[] = [
  {
    id: 'cfg-1001',
    ruleName: 'LOTHOLDRULE',
    hangReason: 'AMACALL_TIMEOUT',
    startLineLike: '%CALL AMA SEND LOT HOLD%',
    endLineLike: '%AMA REPLY LOT HOLD%',
    enabled: true,
    updatedAt: '2026-10-11 14:32:05',
    updatedBy: 'MORRISLI',
  },
  {
    id: 'cfg-1002',
    ruleName: 'EQPSTATUSRULE',
    hangReason: 'EQP_IF_RETRY',
    startLineLike: 'EQP IF RETRY START%',
    endLineLike: 'EQP IF RETRY END%',
    enabled: true,
    updatedAt: '2026-10-09 09:18:44',
    updatedBy: 'TANYU',
  },
  {
    id: 'cfg-1003',
    ruleName: 'CARRIERBINDRULE',
    hangReason: 'MCS_SYNC_SLOW',
    startLineLike: '%MCS CARRIER SYNC BEGIN%',
    endLineLike: '%MCS CARRIER SYNC END',
    enabled: false,
    updatedAt: '2026-10-02 17:41:12',
    updatedBy: 'MORRISLI',
  },
]

function assertUnique(input: SrvHangCfgRo, excludeId: string | null): void {
  const dup = cfgRows.some(
    (r) =>
      r.ruleName === input.ruleName &&
      r.hangReason === input.hangReason &&
      r.id !== excludeId,
  )
  if (dup) throw new ApiError(409) // 业务唯一键冲突（§4.4 联动口径）
}

function now(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}


registerMock('GET', '/log-service/api/v1/srv_hang_cfg/page', ({ params }) => {
  const pageIndex = Number(params?.pageIndex ?? 1)
  const pageSize = Number(params?.pageSize ?? 20)
  const sorted = [...cfgRows].sort(
    (a, b) => `${a.ruleName}+${a.hangReason}`.localeCompare(`${b.ruleName}+${b.hangReason}`),
  )
  const start = (pageIndex - 1) * pageSize
  const data: PageDto<SrvHangCfgDto> = {
    totalPage: Math.max(1, Math.ceil(sorted.length / pageSize)),
    total: sorted.length,
    pageIndex,
    pageSize,
    contents: sorted.slice(start, start + pageSize),
  }
  return data
})

registerMock('POST', '/log-service/api/v1/srv_hang_cfg/state', ({ body }) => {
  const row = cfgRows.find((r) => r.id === body?.id)
  if (!row) throw new ApiError(404)
  row.enabled = Boolean(body?.enabled)
  row.updatedAt = now()
  row.updatedBy = 'MOCK_USER'
})

registerMock('POST', '/log-service/api/v1/srv_hang_cfg', ({ body }) => {
  const input = body as unknown as SrvHangCfgRo
  assertUnique(input, null)
  const created: SrvHangCfgDto = {
    id: `cfg-${1000 + cfgRows.length + 1}`,
    ruleName: input.ruleName,
    hangReason: input.hangReason,
    startLineLike: input.startLineLike,
    endLineLike: input.endLineLike,
    enabled: true, // 新增默认值由后端定（§4.3）
    updatedAt: now(),
    updatedBy: 'MOCK_USER',
  }
  cfgRows.unshift(created)
  return created
})

registerMock('PUT', '/log-service/api/v1/srv_hang_cfg', ({ body }) => {
  const input = body as unknown as SrvHangCfgRo
  const row = cfgRows.find((r) => r.id === input.id)
  if (!row) throw new ApiError(404)
  assertUnique(input, row.id)
  Object.assign(row, {
    ruleName: input.ruleName,
    hangReason: input.hangReason,
    startLineLike: input.startLineLike,
    endLineLike: input.endLineLike,
    updatedAt: now(),
    updatedBy: 'MOCK_USER',
  })
  return row
})

registerMock('DELETE', '/log-service/api/v1/srv_hang_cfg', ({ body }) => {
  const idx = cfgRows.findIndex((r) => r.id === body?.id)
  if (idx < 0) throw new ApiError(404)
  cfgRows.splice(idx, 1)
})
