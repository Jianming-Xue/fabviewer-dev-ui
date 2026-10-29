import type { UserDto } from './types/userTypes'

/**
 * security-management 服务日期时间 wire 格式编解码（用户定稿 2026-10-28）：
 * 请求仅日期 = `YYYYMMDD`（如 20261021）；请求含日期时间 = `YYYYMMDDHHmmss`（如 20261021100000）；
 * **响应总是 `YYYYMMDDHHmmss`**。UI 层与类型保持人类可读格式（'YYYY-MM-DD' / 'YYYY-MM-DD HH:mm:ss'），
 * 换算收口在本 codec、由请求层出站编码/入站解码；Mock 扮演后端直接说 wire 格式。
 * 空串语义不变（永不过期 / 未发生）；不可识别串原样透传（防御）。
 */
const UI_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const UI_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/

/** UI 日期（'YYYY-MM-DD'）→ wire 仅日期（YYYYMMDD） */
export function toWireDate(v: string): string {
  const m = UI_DATE.exec(v.trim())
  return m ? `${m[1]}${m[2]}${m[3]}` : v.trim()
}

/** UI 日期时间（'YYYY-MM-DD HH:mm:ss'；容忍仅日期补 000000）→ wire（YYYYMMDDHHmmss） */
export function toWireDateTime(v: string): string {
  const t = v.trim()
  const md = UI_DATETIME.exec(t)
  if (md) return `${md[1]}${md[2]}${md[3]}${md[4]}${md[5]}${md[6]}`
  const m = UI_DATE.exec(t)
  return m ? `${m[1]}${m[2]}${m[3]}000000` : t
}

/** wire（8 位=仅日期 / 14 位=日期时间）→ UI 格式 */
export function fromWire(v: string): string {
  const t = v.trim()
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
  if (/^\d{14}$/.test(t))
    return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`
  return t
}

const USER_DT_FIELDS = [
  'createdAt',
  'accountActiveAt',
  'accountExpiresAt',
  'passwordChangedAt',
  'passwordExpiresAt',
  'lastLoginTime',
] as const

/** UserDto 全部日期时间字段为响应口径 → 统一解码为 UI 格式 */
export function decodeUserDto(u: UserDto): UserDto {
  const out = { ...u }
  for (const k of USER_DT_FIELDS) out[k] = fromWire(out[k])
  return out
}
