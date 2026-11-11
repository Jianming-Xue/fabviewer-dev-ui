import { registerMock } from '@/shared/api/mock'

import type { TelemetryReplyDto } from '../types/types'
import type { AlarmCfgRo } from '../types/alarmCfgTypes'
import type { ServerHangMonitorCfgDto, ServerHangMonitorCfgRo } from '../types/srvHangMonitorCfgTypes'

/**
 * MES 服务挂起监控配置 Mock（telemetry-hub 服务，模块2 · 03，文档 2026-11-10 配置侧定稿，同日新建）：
 * 出参统一壳 { code, success, errMsg, data, txId }（logMonitorCfgMock 同口径）。
 * list 全量无分页（env 升序）；environment 唯一键——POST 已存在即拒（SrvHangMonitorCfgExists）、
 * PUT/DELETE 不存在即拒（SrvHangMonitorCfgNotFound）；DELETE 走 URL query（srv_hang_cfg 实测口径）。
 * 阈值校验：maxDelay/maxRuleCost 整数 >0 且 ≤65535；通知配置校验与 logMonitorCfgMock 同源
 * （间隔 1~99999 整数 / 邮箱格式）。审计时间说 wire（YYYYMMDDHHmmss），解码归请求层。
 */
const ok = <T>(data: T): TelemetryReplyDto<T> => ({ code: 'OK', success: true, errMsg: '', data, txId: '' })
const fail = (errMsg: string): TelemetryReplyDto<null> => ({ code: 'FAIL', success: false, errMsg, data: null, txId: '' })

/** 内存行：Dto + 内部键（不出参、不进 Ro） */
interface Row extends ServerHangMonitorCfgDto {
  id: string
  alarmCfgId: string
}

const ENVS = ['PIRUN', 'PROD'] // 与 systemMiscMock 种子 mes.global.environments 同源
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] // 与 system.global.priority 种子同源
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

let seq = 0
function mk(environment: string, maxDelay: number, maxRuleCost: number, priority: string, alarmCfg: AlarmCfgRo, updatedAt: string, updatedBy: string): Row {
  seq += 1
  return {
    id: `shmc-${String(seq).padStart(4, '0')}`,
    alarmCfgId: `acfg-hm-${String(seq).padStart(4, '0')}`,
    environment,
    maxDelay,
    maxRuleCost,
    priority,
    alarmCfg,
    lastUpdatedAt: updatedAt,
    lastUpdatedBy: updatedBy,
  }
}

/** 种子两行（一行一环境；业务命名真实）：PROD 值守严口径（P1、间隔 5 分）、PIRUN 放宽（P3、间隔 15 分） */
const cfgRows: Row[] = [
  mk('PROD', 120, 1800, 'P1', {
    mailToUsers: ['mes-oncall@example.com'],
    mailCCUsers: ['it-manager@example.com'],
    feishuGroups: { 'MES On-call Group': ['ou_1a2b3c4d5e6f'] },
    notifyInterval: 5,
  }, '20261109103312', 'MORRISLI'),
  mk('PIRUN', 300, 3600, 'P3', {
    mailToUsers: ['mes-dev@example.com'],
    mailCCUsers: [],
    feishuGroups: {},
    notifyInterval: 15,
  }, '20261108154421', 'TANYU'),
]

/** 审计时间：Mock 扮演后端直接说 wire（YYYYMMDDHHmmss），入站解码归请求层 */
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
function toDto(r: Row): ServerHangMonitorCfgDto {
  return {
    environment: r.environment,
    maxDelay: r.maxDelay,
    maxRuleCost: r.maxRuleCost,
    priority: r.priority,
    alarmCfg: r.alarmCfg ? normAlarm(r.alarmCfg) : null,
    lastUpdatedAt: r.lastUpdatedAt,
    lastUpdatedBy: r.lastUpdatedBy,
  }
}

/** 校验（文档 §4.2 前后端同源五条）：必填 / 阈值整数 1~65535 / 候选集 / 唯一键归 handler / 通知配置格式 */
function validateRo(input: ServerHangMonitorCfgRo): string | null {
  if (!input || !input.environment || !input.priority || !input.alarmCfg) {
    return '缺少必填参数（RequireParameterMissing）'
  }
  for (const [name, v] of [['MaxDelay', input.maxDelay], ['MaxRuleCost', input.maxRuleCost]] as const) {
    if (!Number.isInteger(v) || v <= 0 || v > 65535) {
      return `${name} 须为大于 0 且不超过 65535 的整数（ParameterInvalid）`
    }
  }
  if (!ENVS.includes(input.environment)) {
    return `环境不在候选集（EnvironmentNotAllowed）：${input.environment}，请先在 System Misc 的 mes.global.environments 维护`
  }
  if (!PRIORITIES.includes(input.priority)) {
    return `优先级不在候选集（PriorityNotAllowed）：${input.priority}，请先在 System Misc 的 system.global.priority 维护`
  }
  const iv = input.alarmCfg.notifyInterval
  if (!Number.isInteger(iv) || iv < 1 || iv > 99999) return '通知间隔须为 1~99999 的整数（ParameterInvalid）'
  const badMail = [...(input.alarmCfg.mailToUsers ?? []), ...(input.alarmCfg.mailCCUsers ?? [])].filter((m) => !EMAIL_RE.test(m))
  if (badMail.length) return `邮箱格式不合法（ParameterInvalid）：${badMail.join('、')}`
  return null
}

/* ===== handlers ===== */

// 1 · 全量清单（无分页无过滤；env 升序）
registerMock('GET', '/telemetry-hub/api/v1/srv_hang_monitor/cfg/list', () =>
  ok([...cfgRows].sort((a, b) => a.environment.localeCompare(b.environment)).map(toDto)),
)

// 2 · 新增：environment 唯一键已存在即拒（配置即启用，无 Enabled 字段）
registerMock('POST', '/telemetry-hub/api/v1/srv_hang_monitor/cfg', ({ body }) => {
  const input = body as unknown as ServerHangMonitorCfgRo
  const verr = validateRo(input)
  if (verr) return fail(verr)
  if (cfgRows.some((r) => r.environment === input.environment)) {
    return fail(`环境 ${input.environment} 的配置已存在（SrvHangMonitorCfgExists），一个环境仅一行`)
  }
  seq += 1
  const created: Row = {
    id: `shmc-${String(seq).padStart(4, '0')}`,
    alarmCfgId: `acfg-hm-${String(seq).padStart(4, '0')}`,
    environment: input.environment,
    maxDelay: input.maxDelay,
    maxRuleCost: input.maxRuleCost,
    priority: input.priority,
    alarmCfg: normAlarm(input.alarmCfg),
    lastUpdatedAt: now(),
    lastUpdatedBy: currentUser(),
  }
  cfgRows.unshift(created)
  return ok(toDto(created))
})

// 3 · 编辑：environment 定位（锁定不可改）；通知配置同事务就地更新
registerMock('PUT', '/telemetry-hub/api/v1/srv_hang_monitor/cfg', ({ body }) => {
  const input = body as unknown as ServerHangMonitorCfgRo
  const verr = validateRo(input)
  if (verr) return fail(verr)
  const row = cfgRows.find((r) => r.environment === input.environment)
  if (!row) return fail(`环境 ${input.environment} 的配置不存在（SrvHangMonitorCfgNotFound），列表已刷新`)
  Object.assign(row, {
    maxDelay: input.maxDelay,
    maxRuleCost: input.maxRuleCost,
    priority: input.priority,
    alarmCfg: normAlarm(input.alarmCfg),
    lastUpdatedAt: now(),
    lastUpdatedBy: currentUser(),
  })
  return ok(toDto(row))
})

// 4 · 删除：environment 写 URL query；连带通知配置行，历史告警保留（Mock 无告警态，语义注记）
registerMock('DELETE', '/telemetry-hub/api/v1/srv_hang_monitor/cfg', ({ params }) => {
  const env = String(params?.environment ?? '')
  const idx = cfgRows.findIndex((r) => r.environment === env)
  if (idx < 0) return fail(`环境 ${env} 的配置不存在（SrvHangMonitorCfgNotFound），列表已刷新`)
  cfgRows.splice(idx, 1)
  return ok(null)
})
