import { registerMock } from '@/shared/api/mock'

import { BUILTIN_ROLE_ID } from '../types/roleTypes'

import type { PageDto, SecurityReplyDto } from '../types/types'
import type { CreateUserRo, ResetPasswordRo, UserAttributeRo, UserDto, UserExpireRo, UserRo, UserStateRo } from '../types/userTypes'

/**
 * 用户接口 Mock（2026-10-18，壳/分页/URL query 口径同角色）：
 * 挂载一律存/发 ID（roleIds/policyId，用户定稿 2026-10-20）——名称翻译不再由本 Mock 跨域换算，
 * 前端名称字典见 ../rolePolicyNameCollection；种子 ID 与 roleMock/policyMock 种子对齐。
 * keyword 模糊匹配 userName/nickName/email；userName 唯一（重复返回业务失败，演练前端失败分支）；
 * 用户名即唯一标识（userId 2026-10-28 退役）；布尔一律 1/0，日期为 'YYYY-MM-DD HH:mm:ss' 串，
 * 空串 = 永不过期 / 未发生，-1 = 有效期不限。
 */
const ok = <T>(data: T): SecurityReplyDto<T> => ({ code: 'OK', success: 1, errMsg: '', data, txId: '' })
const fail = (errMsg: string): SecurityReplyDto<null> => ({ code: 'FAIL', success: 0, errMsg, data: null, txId: '' })
/** 有效期天数规范：只有正整数合法，其余（未传保持现值判断同理由调用侧给）→ -1 = 不限（用户定稿 2026-10-21） */
const normDays = (v: number | undefined, cur: number): number => {
  if (v === undefined) return cur > 0 ? cur : -1
  return v > 0 ? v : -1
}
const p2 = (n: number) => String(n).padStart(2, '0')
const fmtTime = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
const dayStart = (d: string) => (d ? `${d} 00:00:00` : '')
/** 'YYYY-MM-DD' → 当日 23:59:59（到期含当天）；空串原样 = 永不过期 */
const dayEnd = (d: string) => (d ? `${d} 23:59:59` : '')

/**
 * 用户接口 Mock（2026-10-18，壳/分页/URL query 口径同角色）：
 * 挂载一律存/发 ID（roleIds/policyId，用户定稿 2026-10-20）——名称翻译不再由本 Mock 跨域换算，
 * 前端名称字典见 ./rolePolicyNameCollection；种子 ID 与 roleMock/policyMock 种子对齐。
 * keyword 模糊匹配 userName/nickName/email；userName 唯一（重复返回业务失败，演练前端失败分支）；
 * 用户名即唯一标识（userId 2026-10-28 退役）；布尔一律 1/0，日期为 'YYYY-MM-DD HH:mm:ss' 串，
 * 空串 = 永不过期 / 未发生，-1 = 有效期不限。
 */


/** 内存态用户集（业务命名真实，10 条 = pageSize 10 下两页；含永不过期/已过期/停用/未登录等演示形态） */
export const rows: UserDto[] = [
  {
    userName: 'admin', nickName: '系统管理员', email: 'admin@fabcorp.example', phoneNumber: '138-0000-0001',
    avatar: '', enabled: 1, roleIds: ['ADMIN'], policyId: 'P001',
    createdAt: '2025-01-15 09:00:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-08-01 10:00:00', passwordExpiresAt: '',
    lastLoginTime: '2026-10-17 08:55:12', lastLoginIp: '10.20.33.101', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'zhang.xiaofeng', nickName: '张小峰', email: 'zhang.xf@fabcorp.example', phoneNumber: '138-0000-0002',
    avatar: '', enabled: 1, roleIds: ['OPR-ENGINEER'], policyId: 'P001',
    createdAt: '2025-06-03 10:30:00', accountActiveAt: '', accountExpiresAt: '2027-06-02 23:59:59', passwordChangedAt: '2026-08-25 09:12:00', passwordExpiresAt: '2026-11-23 09:12:00',
    lastLoginTime: '2026-10-16 20:41:33', lastLoginIp: '10.20.33.121', passwordValidDays: 365, accountValidDays: 365,
  },
  {
    userName: 'li.na', nickName: '李娜', email: 'li.na@fabcorp.example', phoneNumber: '138-0000-0003',
    avatar: '', enabled: 0, roleIds: ['VIEWER'], policyId: '',
    createdAt: '2025-09-18 14:05:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-03-02 11:20:00', passwordExpiresAt: '',
    lastLoginTime: '2026-09-30 17:26:40', lastLoginIp: '10.20.33.88', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'wang.jianguo', nickName: '王建国', email: '', phoneNumber: '138-0000-0004',
    avatar: '', enabled: 1, roleIds: ['AUDITOR'], policyId: 'P001',
    createdAt: '2024-10-01 08:00:00', accountActiveAt: '', accountExpiresAt: '2026-10-01 00:00:00', passwordChangedAt: '2026-06-11 15:30:00', passwordExpiresAt: '2026-12-15 15:30:00',
    lastLoginTime: '2026-09-28 09:02:11', lastLoginIp: '10.20.34.17', passwordValidDays: 365, accountValidDays: 730,
  },
  {
    userName: 'chen.siya', nickName: '陈思雅', email: 'chen.sy@fabcorp.example', phoneNumber: '',
    avatar: '', enabled: 1, roleIds: ['EQUIP-ENGINEER', 'PROCESS-ENGINEER'], policyId: 'P002',
    createdAt: '2026-02-14 13:45:00', accountActiveAt: '', accountExpiresAt: '2026-08-13 13:45:00', passwordChangedAt: '2026-09-20 10:05:00', passwordExpiresAt: '2026-11-19 10:05:00',
    lastLoginTime: '2026-10-17 07:58:03', lastLoginIp: '10.20.35.62', passwordValidDays: 60, accountValidDays: 180,
  },
  {
    userName: 'liu.dehua', nickName: '刘德华', email: 'liu.dh@fabcorp.example', phoneNumber: '138-0000-0006',
    avatar: '', enabled: 1, roleIds: ['MAINT-TECH'], policyId: '',
    createdAt: '2026-07-01 09:30:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-07-01 09:30:00', passwordExpiresAt: '',
    lastLoginTime: '', lastLoginIp: '', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'zhao.min', nickName: '赵敏', email: 'zhao.min@fabcorp.example', phoneNumber: '138-0000-0007',
    avatar: '', enabled: 0, roleIds: ['PROCESS-ENGINEER'], policyId: 'P001',
    createdAt: '2025-03-22 16:20:00', accountActiveAt: '', accountExpiresAt: '2027-03-21 23:59:59', passwordChangedAt: '2025-12-30 14:10:00', passwordExpiresAt: '2026-12-24 14:10:00',
    lastLoginTime: '2026-08-15 11:47:29', lastLoginIp: '10.20.33.140', passwordValidDays: 365, accountValidDays: 730,
  },
  {
    userName: 'sunlei.etl', nickName: '孙磊', email: 'sun.lei@fabcorp.example', phoneNumber: '138-0000-0008',
    avatar: '', enabled: 1, roleIds: ['ETL-OPERATOR'], policyId: '',
    createdAt: '2025-11-08 10:00:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-10-10 09:00:00', passwordExpiresAt: '',
    lastLoginTime: '2026-10-17 08:30:55', lastLoginIp: '10.20.36.9', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'zhou.yajing', nickName: '周雅静', email: '', phoneNumber: '',
    avatar: '', enabled: 1, roleIds: [], policyId: 'P003',
    createdAt: '2026-10-15 15:20:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-10-15 15:20:00', passwordExpiresAt: '',
    lastLoginTime: '', lastLoginIp: '', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'wu.qiang', nickName: '吴强', email: 'wu.qiang@fabcorp.example', phoneNumber: '138-0000-0010',
    avatar: '', enabled: 1, roleIds: ['QA-VIEWER'], policyId: 'P002',
    createdAt: '2026-05-06 11:11:00', accountActiveAt: '', accountExpiresAt: '2026-11-02 11:11:00', passwordChangedAt: '2026-09-01 08:45:00', passwordExpiresAt: '2026-10-31 08:45:00',
    lastLoginTime: '2026-10-16 16:20:07', lastLoginIp: '10.20.33.203', passwordValidDays: 60, accountValidDays: 180,
  },
]

registerMock('GET', '/security-management/api/v1/users/page', ({ params }) => {
  const pageIndex = Number(params?.pageIndex ?? 1)
  const pageSize = Number(params?.pageSize ?? 10)
  const kw = String(params?.keyword ?? '').trim().toLowerCase()
  const filtered = kw
    ? rows.filter((r) => [r.userName, r.nickName, r.email].some((v) => v.toLowerCase().includes(kw)))
    : [...rows]
  const sorted = filtered.sort((a, b) => a.userName.localeCompare(b.userName))
  const start = (pageIndex - 1) * pageSize
  const page: PageDto<UserDto> = {
    pageSize,
    pageIndex,
    totalSize: sorted.length,
    totalPage: Math.max(1, Math.ceil(sorted.length / pageSize)),
    data: sorted.slice(start, start + pageSize),
  }
  return ok(page)
})

registerMock('POST', '/security-management/api/v1/users', ({ body }) => {
  const ro = body as unknown as CreateUserRo
  if (!ro?.userName?.trim()) return fail('用户名不能为空')
  if (rows.some((r) => r.userName === ro.userName.trim())) return fail('该用户名已存在')
  const now = new Date()
  const activeAt = dayStart(ro.accountActiveAt ?? '')
  const created: UserDto = {
    userName: ro.userName.trim(),
    nickName: ro.nickName?.trim() ?? '',
    email: ro.email?.trim() ?? '',
    phoneNumber: ro.phoneNumber?.trim() ?? '',
    avatar: '',
    enabled: ro.enabled === 0 ? 0 : 1,
    roleIds: [...(ro.roleIds ?? [])],
    policyId: ro.policyId ?? '',
    createdAt: fmtTime(now),
    accountActiveAt: activeAt,
    accountExpiresAt: dayEnd(ro.accountExpiresAt ?? ''),
    passwordChangedAt: fmtTime(now),
    passwordExpiresAt: '',
    lastLoginTime: '',
    lastLoginIp: '',
    passwordValidDays: -1,
    accountValidDays: -1,
  }
  rows.unshift(created)
  return ok({ ...created })
})

/** 编辑用户（2026-10-19 拆分改造）：稀疏更新——body 携带的字段才覆盖，未携带保持原值；
 *  EditUserDialog 只提交 昵称/邮箱/电话，EditUserRolePolicyDialog 只提交 角色/策略/两有效期天数/到期日 */
registerMock('PUT', '/security-management/api/v1/users', ({ body }) => {
  const ro = body as unknown as UserRo
  const row = rows.find((r) => r.userName === ro?.userName)
  if (!row) return fail('用户不存在')
  // 内置管理员用户（2026-10-21）：挂 ADMIN 角色者角色/策略不可改（档案三件套不受限）
  if (row.roleIds.includes(BUILTIN_ROLE_ID) && (ro.roleIds !== undefined || ro.policyId !== undefined))
    return fail('内置管理员用户的角色与策略不可修改')
  const uname = ro.userName?.trim()
  if (uname && uname !== row.userName && rows.some((r) => r.userName === uname && r.userName !== row.userName))
    return fail('该用户名已存在')
  const updated: UserDto = {
    ...row,
    userName: row.userName, // 创建后锁定，改名忽略
    ...(ro.nickName !== undefined ? { nickName: ro.nickName.trim() } : {}),
    ...(ro.email !== undefined ? { email: ro.email.trim() } : {}),
    ...(ro.phoneNumber !== undefined ? { phoneNumber: ro.phoneNumber.trim() } : {}),
    ...(ro.enabled !== undefined ? { enabled: ro.enabled === 0 ? 0 : 1 } : {}),
    ...(ro.roleIds !== undefined ? { roleIds: [...ro.roleIds] } : {}),
    ...(ro.policyId !== undefined ? { policyId: ro.policyId } : {}),
    ...(ro.accountExpiresAt !== undefined ? { accountExpiresAt: dayEnd(ro.accountExpiresAt) } : {}),
    // 有效期天数规范（2026-10-21）：非正值（空/0/负）一律落 -1 = 不限
    passwordValidDays: normDays(ro.passwordValidDays, row.passwordValidDays),
    accountValidDays: normDays(ro.accountValidDays, row.accountValidDays),
  }
  rows[rows.indexOf(row)] = updated
  return ok({ ...updated })
})

/** 重置密码（管理员侧，2026-10-19 More 菜单）：仅更新上次密码修改时间戳，密码明文 mock 不落档 */
registerMock('PUT', '/security-management/api/v1/users/password', ({ body }) => {
  const ro = body as unknown as ResetPasswordRo
  const row = rows.find((r) => r.userName === ro?.userName)
  if (!row) return fail('用户不存在')
  if (!ro?.password) return fail('密码不能为空')
  rows[rows.indexOf(row)] = { ...row, passwordChangedAt: fmtTime(new Date()) }
  return ok(null)
})

/** 单属性修改（2026-10-20 用户信息弹窗行内编辑）：白名单 attName 四选（含 avatar，2026-10-22），
 *  按 body.userName（登录用户名）定位当前用户（显式入参口径，同 change_password） */
registerMock('POST', '/security-management/api/v1/users/attribute', ({ body }) => {
  const ro = body as unknown as UserAttributeRo
  const userName = String(ro?.userName ?? '').trim()
  const row = rows.find((r) => r.userName.toLowerCase() === userName.toLowerCase())
  if (!row) return fail('用户不存在')
  if (!['nickName', 'email', 'phoneNumber', 'avatar'].includes(String(ro?.attName)))
    return fail('不支持的属性名')
  const value = String(ro.attValue ?? '').trim()
  if (ro.attName === 'nickName' && value.length > 30) return fail('昵称不超过 30 个字符')
  if (ro.attName === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return fail('邮箱格式不正确')
  if (ro.attName === 'phoneNumber' && value && !/^[\d-]*$/.test(value)) return fail('电话仅允许数字与连字符')
  rows[rows.indexOf(row)] = { ...row, [ro.attName]: value }
  return ok(null)
})

/** 账户延期（2026-10-21）：新到期存 dayEnd（含当天，口径同创建）；''=永不过期；
 *  账户有效天数按「今日→新到期日」重算落库（永不过期记 -1） */
registerMock('POST', '/security-management/api/v1/users/expire', ({ body }) => {
  const ro = body as unknown as UserExpireRo
  const row = rows.find((r) => r.userName === ro?.userName)
  if (!row) return fail('用户不存在')
  const d = String(ro.newAccountExpiresAt ?? '').trim()
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return fail('到期日期格式应为 YYYY-MM-DD')
  const days = d
    ? Math.max(0, Math.round((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000))
    : -1
  rows[rows.indexOf(row)] = { ...row, accountExpiresAt: dayEnd(d), accountValidDays: days }
  return ok(null)
})

/** 删除：userName 经 URL query */
registerMock('DELETE', '/security-management/api/v1/users', ({ params }) => {
  const userName = String(params?.userName ?? '')
  const row = rows.find((r) => r.userName === userName)
  if (!row) return fail('用户不存在')
  if (row.roleIds.includes(BUILTIN_ROLE_ID)) return fail('内置管理员用户不可删除')
  rows.splice(rows.indexOf(row), 1)
  return ok(null)
})

/** 变更启用状态（2026-10-19 改造）：UserStateRo body——enabled 严格 0/1（口径同角色 /roles/enabled）
 *  + 操作备注必填（服务端守卫，前端表单规则之外双保险；备注仅校验，内存态不落档） */
registerMock('POST', '/security-management/api/v1/users/enabled', ({ body }) => {
  const ro = body as unknown as UserStateRo
  const enabled = Number(ro?.enabled)
  if (enabled !== 0 && enabled !== 1) return fail('enabled 必须为 0 或 1')
  if (!ro?.remark?.trim()) return fail('备注不能为空')
  const row = rows.find((r) => r.userName === ro?.userName)
  if (!row) return fail('用户不存在')
  rows[rows.indexOf(row)] = { ...row, enabled }
  return ok(null)
})
