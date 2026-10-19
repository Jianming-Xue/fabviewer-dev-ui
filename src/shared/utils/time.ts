import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

/** 查询条件：精确到分钟、无秒（05 §4.6） */
export const MINUTE_FORMAT = 'YYYY-MM-DD HH:mm'
/** 结果展示：精确到毫秒（05 §4.6） */
export const RESULT_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS'
/** 检索入参：yyyyMMddHHmm（模块 1 · 01 §5.3-9） */
export const API_TIME_FORMAT = 'YYYYMMDDHHmm'

export function isValidMinute(value: string): boolean {
  if (!value) return false
  return dayjs(value, MINUTE_FORMAT, true).isValid()
}

/** 当前时刻（分钟精度字符串） */
export function nowMinute(): string {
  return dayjs().format(MINUTE_FORMAT)
}

/** 相对当前时刻偏移 n 分钟后的字符串（负数=过去） */
export function minutesAgo(n: number): string {
  return dayjs().subtract(n, 'minute').format(MINUTE_FORMAT)
}

/** 查询条件串 → 入参 yyyyMMddHHmm */
export function toApiTime(value: string): string {
  return dayjs(value, MINUTE_FORMAT).format(API_TIME_FORMAT)
}

export interface TimeIssue {
  /** 出错位置：开始 / 结束 / 整体 */
  field: 'start' | 'end' | 'both'
  /** i18n 词典键 */
  key: string
}

/**
 * 时间范围校验（模块 1 · 01 §2.8）：
 * 成对必填、格式精确到分钟、开始 ≤ 结束（同分钟合法）、差值 ≤ 1 天。即时校验用。
 */
export function validateTimeRange(start: string, end: string): TimeIssue[] {
  const issues: TimeIssue[] = []
  if (!start && !end) return [{ field: 'both', key: 'validation.timeRequired' }]
  if (!start || !end) return [{ field: 'both', key: 'validation.timeRequired' }]
  if (!isValidMinute(start)) return [{ field: 'start', key: 'validation.timeFormat' }]
  if (!isValidMinute(end)) return [{ field: 'end', key: 'validation.timeFormat' }]

  const s = dayjs(start, MINUTE_FORMAT, true)
  const e = dayjs(end, MINUTE_FORMAT, true)
  // 区间语义按分钟解释（05 §4.8）；模块 1 口径：开始 ≤ 结束，同分钟合法
  if (s.isAfter(e)) return [{ field: 'both', key: 'validation.timeOrder' }]
  if (e.diff(s, 'minute') > 24 * 60) return [{ field: 'both', key: 'validation.timeSpan' }]
  return issues
}

/**
 * 星号规则（模块 1 · 01 §2.2）：空=不过滤；`ABC`=精确；`ABC*`=前缀；
 * `*` / `*ABC` / `AB*C` / `ABC**` 判非法。返回 true = 合法。
 */
export function isValidStarPattern(value: string): boolean {
  if (!value) return true
  if (!value.includes('*')) return true
  return /^[^*]+\*$/.test(value)
}

/** 数值校验：0 ~ 99999.99，最多 2 位小数（Min / Max Cost Time） */
export function isValidCostValue(value: string): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false
  const n = Number(value)
  return n >= 0 && n <= 99999.99
}

/**
 * Server Number 校验与规范化（模块 1 · 01 §2.2）：只在点 Search 时调用。
 * 英文逗号分隔 → trim → 逐段验 1~1000 正整数 → 去重；空段 / 非法返回 null。
 */
export function normalizeServerNumbers(raw: string): string[] | null {
  if (!raw.trim()) return []
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  // 输入了内容但拆不出任何段（如 ",,,"）→ 非法
  if (parts.length === 0) return null
  const valid = parts.every((p) => /^(0|[1-9]\d{0,3})$/.test(p) && Number(p) >= 1 && Number(p) <= 1000)
  if (!valid) return null
  return [...new Set(parts)]
}

/** 千分位（05 §4.6：行数 12,480） */
export function formatThousands(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

/** 毫秒 → 秒显示（模块 1 · 01 §3.2：字段存毫秒、显示秒） */
export function msToSeconds(ms: number | string): string {
  const v = typeof ms === 'string' ? Number(ms) : ms
  if (!Number.isFinite(v)) return ''
  return (v / 1000).toFixed(3)
}
