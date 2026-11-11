import { registerMock } from '@/shared/api/mock'

import type { PageDto, TelemetryReplyDto } from '../types/types'
import type { AlarmCfgRo } from '../types/alarmCfgTypes'
import type { LogMonitorCfgDto, LogMonitorCfgRo } from '../types/logMonitorCfgTypes'

/**
 * MES 日志监控配置 Mock（telemetry-hub 服务，模块2 · 01，2026-11-10 新建）：
 * 出参统一壳 { code, success, errMsg, data, txId }（srvHangConfigMock 同口径，txId 一律空串回显）。
 * 内存态即 wire 视角：审计时间说 wire（YYYYMMDDHHmmss，入站解码归请求层）；内部键 id/alarmCfgId
 * 不出参（文档 §2.1），响应前经 toDto 剥除并深拷贝（防消费方改动污染内存态）。
 * page 实现 keyword 四列模糊（item/description/environment/keyword，大小写不敏感子串）+ env→item 升序 + 服务端切片；
 * POST/PUT 按文档 §4.3 八条校验规则演练（候选集/唯一键/长度/序列化 4000/交叉两项/间隔/邮箱），
 * 业务失败以 success:false + errMsg（含错误码注记）返回。候选集与 systemMiscMock 种子对齐
 * （env=mes.global.environments、priority=system.global.priority）；真实后端源 Misc，Mock 硬编码同源值。
 */
const ok = <T>(data: T): TelemetryReplyDto<T> => ({ code: 'OK', success: true, errMsg: '', data, txId: '' })
const fail = (errMsg: string): TelemetryReplyDto<null> => ({ code: 'FAIL', success: false, errMsg, data: null, txId: '' })

/** 内存行：Dto + 内部键（不出参、不进 Ro） */
interface Row extends LogMonitorCfgDto {
  id: string
  alarmCfgId: string
}

/* ===== 校验常量（与 systemMiscMock 种子同源） ===== */
const ENVS = ['PIRUN', 'PROD']
const PRIORITIES = ['P1', 'P2', 'P3', 'P4']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const GROUP_MES_ONCALL = 'MES On-call Group'
const GROUP_DBA_TEAM = 'DBA Team Group'

function alarm(over: Partial<AlarmCfgRo> = {}): AlarmCfgRo {
  return {
    mailToUsers: [],
    mailCCUsers: [],
    feishuGroups: {},
    notifyInterval: 5,
    ...over,
  }
}

let seq = 0
function mk(
  environment: string,
  item: string,
  keyword: string,
  priority: string,
  over: Partial<Omit<Row, 'id' | 'alarmCfgId' | 'environment' | 'item' | 'keyword' | 'priority'>> = {},
): Row {
  seq += 1
  return {
    id: `lmc-${String(seq).padStart(4, '0')}`,
    alarmCfgId: `acfg-${String(seq).padStart(4, '0')}`,
    environment,
    item,
    keyword,
    priority,
    description: null,
    excludeKeywords: [],
    followRuleNames: [],
    excludeRuleNames: [],
    alarmCfg: alarm(),
    lastUpdatedAt: '20261013162011',
    lastUpdatedBy: 'DBA',
    ...over,
  }
}

/** 种子 24 行（业务命名真实、不用占位符）：覆盖多值 [+N]/空灰-/alarmCfg null/各优先级/双环境 */
const cfgRows: Row[] = [
  mk('PROD', 'PROD-ORA-EXCEPTION', 'ORA-00600', 'P1', {
    description: 'Oracle 内部错误，DBA 立即介入',
    alarmCfg: alarm({ mailToUsers: ['mes-dba@example.com'], mailCCUsers: ['it-manager@example.com'], feishuGroups: { [GROUP_DBA_TEAM]: ['ou_7d3a91c2e4f6'] }, notifyInterval: 5 }),
    lastUpdatedAt: '20261108093012', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PROD', 'PROD-OOM-KILLER', 'OutOfMemoryError', 'P1', {
    description: 'JVM 内存溢出，服务可能已不可用',
    alarmCfg: alarm({ mailToUsers: ['mes-oncall@example.com'], feishuGroups: { [GROUP_MES_ONCALL]: ['ou_1a2b3c4d5e6f', 'ou_7d3a91c2e4f6'] }, notifyInterval: 5 }),
    lastUpdatedAt: '20261107184530', lastUpdatedBy: 'TANYU',
  }),
  mk('PROD', 'PROD-DISK-FULL', 'No space left on device', 'P1', {
    description: '磁盘写满：日志归档与落库都会失败',
    alarmCfg: alarm({ mailToUsers: ['infra-alert@example.com'], feishuGroups: { [GROUP_MES_ONCALL]: [] }, notifyInterval: 10 }),
    lastUpdatedAt: '20261105112233', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PROD', 'PROD-CONN-REFUSED', 'Connection refused', 'P2', {
    description: '下游端口拒连（服务未起或防火墙）',
    excludeKeywords: ['HEARTBEAT'],
    alarmCfg: alarm({ mailToUsers: ['mes-oncall@example.com'], notifyInterval: 10 }),
    lastUpdatedAt: '20261104091500', lastUpdatedBy: 'ZHANGWEI',
  }),
  mk('PROD', 'PROD-DEADLOCK', 'Deadlock found', 'P2', {
    description: 'MySQL 死锁回滚，关注是否高频',
    excludeKeywords: ['TRACE', 'REPLAY'],
    alarmCfg: alarm({ mailToUsers: ['mes-dba@example.com'], mailCCUsers: ['mes-dev@example.com'], notifyInterval: 15 }),
    lastUpdatedAt: '20261103140021', lastUpdatedBy: 'TANYU',
  }),
  mk('PROD', 'PROD-TNS-TIMEOUT', 'TNS-12535', 'P2', {
    description: 'Oracle 连接超时（网络或监听过载）',
    alarmCfg: alarm({ mailToUsers: ['mes-dba@example.com'], feishuGroups: { [GROUP_DBA_TEAM]: [] }, notifyInterval: 10 }),
    lastUpdatedAt: '20261102103344', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PROD', 'PROD-EQP-IFERROR', 'EQP IF ERROR', 'P2', {
    description: '设备接口报文异常，仅盯设备状态 Rule',
    followRuleNames: ['EQPSTATUSRULE'],
    alarmCfg: alarm({ mailToUsers: ['eqp-eng@example.com'], notifyInterval: 5 }),
    lastUpdatedAt: '20261101160809', lastUpdatedBy: 'ZHANGWEI',
  }),
  mk('PROD', 'PROD-MCS-REJECT', 'MCS REJECT', 'P3', {
    description: 'MCS 拒单：天车调度异常',
    followRuleNames: ['LOTHOLDRULE', 'EQPSTATUSRULE', 'CARRIERBINDRULE'],
    alarmCfg: alarm({ feishuGroups: { [GROUP_MES_ONCALL]: ['ou_9f8e7d6c5b4a'] }, notifyInterval: 30 }),
    lastUpdatedAt: '20261030114512', lastUpdatedBy: 'TANYU',
  }),
  mk('PROD', 'PROD-SPC-LINKDOWN', 'SPC LINK DOWN', 'P3', {
    description: null,
    alarmCfg: alarm({ mailToUsers: ['spc-support@example.com'], notifyInterval: 30 }),
    lastUpdatedAt: '20261029093311', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PROD', 'PROD-R2R-TIMEOUT', 'R2R CALL TIMEOUT', 'P3', {
    description: 'R2R 调用超时，排除心跳噪声',
    excludeKeywords: ['HEARTBEAT'],
    excludeRuleNames: ['CARRIERBINDRULE'],
    alarmCfg: alarm({ mailToUsers: ['r2r-team@example.com'], notifyInterval: 15 }),
    lastUpdatedAt: '20261028151200', lastUpdatedBy: 'ZHANGWEI',
  }),
  mk('PROD', 'PROD-RETRY-STORM', 'RETRY STORM', 'P3', {
    description: '重试风暴：短时间同错误高频重试',
    excludeRuleNames: ['LOTHOLDRULE'],
    alarmCfg: alarm({ feishuGroups: { [GROUP_MES_ONCALL]: [] }, notifyInterval: 5 }),
    lastUpdatedAt: '20261027172233', lastUpdatedBy: 'TANYU',
  }),
  mk('PROD', 'PROD-NULL-POINTER', 'NullPointerException', 'P4', {
    description: '空指针堆栈，开发跟进而非值守拉响',
    alarmCfg: alarm({ mailToUsers: ['mes-dev@example.com'], notifyInterval: 60 }),
    lastUpdatedAt: '20261026101010', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PROD', 'PROD-SOCKET-CLOSE', 'socket closed', 'P4', {
    description: null,
    alarmCfg: alarm({ mailToUsers: ['mes-dev@example.com'], notifyInterval: 60 }),
    lastUpdatedAt: '20261025143322', lastUpdatedBy: 'ZHANGWEI',
  }),
  mk('PROD', 'PROD-SLOW-SQL', 'SLOW SQL', 'P4', {
    description: '慢 SQL 留痕，周报口径',
    alarmCfg: alarm({ mailToUsers: ['mes-dba@example.com'], notifyInterval: 60 }),
    lastUpdatedAt: '20261024110045', lastUpdatedBy: 'TANYU',
  }),
  mk('PIRUN', 'PIRUN-ORA-EXCEPTION', 'ORA-00600', 'P2', {
    description: '试运行环境 Oracle 内部错误',
    alarmCfg: alarm({ mailToUsers: ['mes-dba@example.com'], notifyInterval: 10 }),
    lastUpdatedAt: '20261109084412', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PIRUN', 'PIRUN-OOM-KILLER', 'OutOfMemoryError', 'P2', {
    description: '试运行 JVM 内存溢出',
    alarmCfg: alarm({ mailToUsers: ['mes-oncall@example.com'], feishuGroups: { [GROUP_MES_ONCALL]: [] }, notifyInterval: 10 }),
    lastUpdatedAt: '20261108162233', lastUpdatedBy: 'TANYU',
  }),
  mk('PIRUN', 'PIRUN-DISK-FULL', 'No space left on device', 'P2', {
    description: null,
    alarmCfg: alarm({ mailToUsers: ['infra-alert@example.com'], notifyInterval: 15 }),
    lastUpdatedAt: '20261106101530', lastUpdatedBy: 'ZHANGWEI',
  }),
  mk('PIRUN', 'PIRUN-CONN-REFUSED', 'Connection refused', 'P3', {
    description: '试运行下游拒连',
    alarmCfg: alarm({ notifyInterval: 30 }),
    lastUpdatedAt: '20261105092211', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PIRUN', 'PIRUN-DEADLOCK', 'Deadlock found', 'P3', {
    description: '试运行死锁留痕',
    excludeKeywords: ['TRACE'],
    alarmCfg: alarm({ mailToUsers: ['mes-dba@example.com'], notifyInterval: 30 }),
    lastUpdatedAt: '20261104140833', lastUpdatedBy: 'TANYU',
  }),
  mk('PIRUN', 'PIRUN-TNS-TIMEOUT', 'TNS-12535', 'P3', {
    description: null,
    alarmCfg: alarm({ mailToUsers: ['mes-dba@example.com'], notifyInterval: 30 }),
    lastUpdatedAt: '20261102095544', lastUpdatedBy: 'ZHANGWEI',
  }),
  mk('PIRUN', 'PIRUN-MCS-REJECT', 'MCS REJECT', 'P4', {
    description: '试运行 MCS 拒单观察',
    followRuleNames: ['CARRIERBINDRULE'],
    alarmCfg: alarm({ feishuGroups: { [GROUP_MES_ONCALL]: [] }, notifyInterval: 60 }),
    lastUpdatedAt: '20261101153312', lastUpdatedBy: 'MORRISLI',
  }),
  mk('PIRUN', 'PIRUN-LOGIN-FAIL', 'LOGIN FAILED', 'P4', {
    description: '接口账号登录失败（口令过期演练）',
    alarmCfg: alarm({ mailToUsers: ['sec-ops@example.com'], notifyInterval: 60 }),
    lastUpdatedAt: '20261030101010', lastUpdatedBy: 'TANYU',
  }),
  mk('PIRUN', 'PIRUN-CFG-RELOAD', 'CONFIG RELOAD FAILED', 'P3', {
    description: '配置热加载失败，仍跑旧配置',
    alarmCfg: alarm({ mailToUsers: ['mes-oncall@example.com'], mailCCUsers: ['mes-dev@example.com'], notifyInterval: 15 }),
    lastUpdatedAt: '20261029172244', lastUpdatedBy: 'ZHANGWEI',
  }),
  // 遗留行演练 alarmCfg=null（Dto 契约：无通知行时 null；编辑弹窗按默认值补种）
  mk('PIRUN', 'PIRUN-LEGACY-TRACE', 'TRACE BUFFER OVERRUN', 'P4', {
    description: '历史遗留规则（未挂通知配置）',
    alarmCfg: null,
    lastUpdatedAt: '20261020120000', lastUpdatedBy: 'DBA',
  }),
]

/** 审计时间：Mock 扮演后端直接说 wire（YYYYMMDDHHmmss，srvHangConfigMock 同口径），入站解码归请求层 */
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

function normAlarm(a: AlarmCfgRo): AlarmCfgRo {
  return {
    mailToUsers: [...(a.mailToUsers ?? [])],
    mailCCUsers: [...(a.mailCCUsers ?? [])],
    feishuGroups: Object.fromEntries(Object.entries(a.feishuGroups ?? {}).map(([k, v]) => [k, [...v]])),
    notifyInterval: a.notifyInterval,
  }
}

/** 出参：剥内部键 + 深拷贝（防消费方引用改动污染内存态） */
function toDto(r: Row): LogMonitorCfgDto {
  return {
    item: r.item,
    environment: r.environment,
    keyword: r.keyword,
    description: r.description,
    excludeKeywords: [...r.excludeKeywords],
    followRuleNames: [...r.followRuleNames],
    excludeRuleNames: [...r.excludeRuleNames],
    priority: r.priority,
    alarmCfg: r.alarmCfg ? normAlarm(r.alarmCfg) : null,
    lastUpdatedAt: r.lastUpdatedAt,
    lastUpdatedBy: r.lastUpdatedBy,
  }
}

/** 八条校验（文档 §4.3 实现逻辑；错误码注记入 errMsg 便于前端演练辨识） */
function validateRo(input: LogMonitorCfgRo): string | null {
  if (!input || !input.environment || !input.item || !input.keyword || !input.priority || !input.alarmCfg) {
    return '缺少必填参数（RequireParameterMissing）'
  }
  if (!ENVS.includes(input.environment)) {
    return `环境不在候选集（EnvironmentNotAllowed）：${input.environment}，请先在 System Misc 的 mes.global.environments 维护`
  }
  if (!PRIORITIES.includes(input.priority)) {
    return `优先级不在候选集（PriorityNotAllowed）：${input.priority}，请先在 System Misc 的 system.global.priority 维护`
  }
  if (input.item.length > 30) return 'Item 不合法（ParameterInvalid）：≤30 字符'
  if (input.keyword.length > 30) return 'Keyword 超长（ParameterInvalid）：≤30 字符'
  if ((input.description ?? '').length > 255) return 'Description 超长（ParameterInvalid）：≤255 字符'
  const lists: [string, string[] | undefined][] = [
    ['ExcludeKeywords', input.excludeKeywords],
    ['FollowRuleNames', input.followRuleNames],
    ['ExcludeRuleNames', input.excludeRuleNames],
  ]
  for (const [name, list] of lists) {
    if (list && JSON.stringify(list).length > 4000) return `${name} 序列化超长（ParameterInvalid）：≤4000 字符`
  }
  const follow = input.followRuleNames ?? []
  const exclude = input.excludeRuleNames ?? []
  const conflict = follow.filter((n) => exclude.includes(n))
  if (conflict.length) return `关注与排除 Rule 名交集冲突（RuleNameConflict）：${conflict.join('、')}`
  const badEx = (input.excludeKeywords ?? []).filter((k) => k && input.keyword.includes(k))
  if (badEx.length) return `排除词是 Keyword 的子串、规则将永不触发（ExcludeKeywordInvalid）：${badEx.join('、')}`
  const iv = input.alarmCfg.notifyInterval
  if (!Number.isInteger(iv) || iv < 1 || iv > 99999) return '通知间隔须为 1~99999 的整数（ParameterInvalid）'
  const badMail = [...(input.alarmCfg.mailToUsers ?? []), ...(input.alarmCfg.mailCCUsers ?? [])].filter((m) => !EMAIL_RE.test(m))
  if (badMail.length) return `邮箱格式不合法（ParameterInvalid）：${badMail.join('、')}`
  return null
}

function findRow(item: unknown, environment: unknown): Row | undefined {
  return cfgRows.find((r) => r.item === String(item ?? '') && r.environment === String(environment ?? ''))
}

/* ===== handlers ===== */

// 1 · 分页：keyword 四列模糊（大小写不敏感子串，任一命中即返回）+ env→item 升序 + 服务端切片
registerMock('GET', '/telemetry-hub/api/v1/log_monitor/cfg/page', ({ params }) => {
  const pageIndex = Number(params?.pageIndex ?? 1)
  const pageSize = Number(params?.pageSize ?? 20)
  const kw = String(params?.keyword ?? '').trim().toLowerCase()
  const hit = (r: Row) =>
    !kw || [r.item, r.description ?? '', r.environment, r.keyword].some((s) => s.toLowerCase().includes(kw))
  const sorted = cfgRows.filter(hit).sort(
    (a, b) => a.environment.localeCompare(b.environment) || a.item.localeCompare(b.item),
  )
  const start = (pageIndex - 1) * pageSize
  const page: PageDto<LogMonitorCfgDto> = {
    pageSize,
    pageIndex,
    totalSize: sorted.length,
    totalPage: Math.max(1, Math.ceil(sorted.length / pageSize)),
    data: sorted.slice(start, start + pageSize).map(toDto),
  }
  return ok(page)
})

// 2 · 详情（编辑回填）：行键定位，未找到即拒
registerMock('GET', '/telemetry-hub/api/v1/log_monitor/cfg/detail', ({ params }) => {
  const row = findRow(params?.item, params?.environment)
  if (!row) return fail('规则不存在或已被删除（LogMonitorCfgNotFound），列表已刷新')
  return ok(toDto(row))
})

// 3 · 新增：八条校验 + item+environment 唯一键即拒；AlarmCfg 与规则行同事务插入
registerMock('POST', '/telemetry-hub/api/v1/log_monitor/cfg', ({ body }) => {
  const input = body as unknown as LogMonitorCfgRo
  const verr = validateRo(input)
  if (verr) return fail(verr)
  if (findRow(input.item, input.environment)) {
    return fail(`环境 ${input.environment} 下已存在 Item 为「${input.item}」的规则（LogMonitorCfgExists）`)
  }
  seq += 1
  const created: Row = {
    id: `lmc-${String(seq).padStart(4, '0')}`,
    alarmCfgId: `acfg-${String(seq).padStart(4, '0')}`,
    environment: input.environment,
    item: input.item,
    keyword: input.keyword,
    description: input.description ?? null,
    excludeKeywords: [...(input.excludeKeywords ?? [])],
    followRuleNames: [...(input.followRuleNames ?? [])],
    excludeRuleNames: [...(input.excludeRuleNames ?? [])],
    priority: input.priority,
    alarmCfg: normAlarm(input.alarmCfg),
    lastUpdatedAt: now(),
    lastUpdatedBy: currentUser(),
  }
  cfgRows.unshift(created)
  return ok(toDto(created))
})

// 4 · 编辑：行键定位（不可改），通知配置同事务就地更新；出参落库后整条
registerMock('PUT', '/telemetry-hub/api/v1/log_monitor/cfg', ({ body }) => {
  const input = body as unknown as LogMonitorCfgRo
  const verr = validateRo(input)
  if (verr) return fail(verr)
  const row = findRow(input.item, input.environment)
  if (!row) return fail('规则不存在或已被删除（LogMonitorCfgNotFound），列表已刷新')
  Object.assign(row, {
    keyword: input.keyword,
    description: input.description ?? null,
    excludeKeywords: [...(input.excludeKeywords ?? [])],
    followRuleNames: [...(input.followRuleNames ?? [])],
    excludeRuleNames: [...(input.excludeRuleNames ?? [])],
    priority: input.priority,
    alarmCfg: normAlarm(input.alarmCfg),
    lastUpdatedAt: now(),
    lastUpdatedBy: currentUser(),
  })
  return ok(toDto(row))
})

// 5 · 删除：行键 query 定位，连带通知配置行；历史告警保留（Mock 无告警态，语义注记）
registerMock('DELETE', '/telemetry-hub/api/v1/log_monitor/cfg', ({ params }) => {
  const idx = cfgRows.findIndex(
    (r) => r.item === String(params?.item ?? '') && r.environment === String(params?.environment ?? ''),
  )
  if (idx < 0) return fail('规则不存在或已被删除（LogMonitorCfgNotFound），列表已刷新')
  cfgRows.splice(idx, 1)
  return ok(null)
})
