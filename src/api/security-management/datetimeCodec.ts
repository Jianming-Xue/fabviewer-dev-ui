import { fromWire } from '@/shared/utils/datetimeCodec'

import type { UserDto } from './types/userTypes'

/**
 * security-management 服务日期时间 wire 格式薄层（用户定稿 2026-10-28）：
 * 通用编解码（toWireDate/toWireDateTime/fromWire）2026-11-04 提升至 shared/utils/datetimeCodec
 * （telemetry-hub 联调同需此口径），本文件转出口保持服务内既有 import 路径不变，
 * 只留本服务专属的按对象解码器（decodeUserDto）。wire 口径详见 shared 层头注。
 */
export { toWireDate, toWireDateTime, fromWire } from '@/shared/utils/datetimeCodec'

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
