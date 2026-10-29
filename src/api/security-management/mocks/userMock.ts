import { registerMock } from '@/shared/api/mock'

import { BUILTIN_ROLE_ID } from '../types/roleTypes'
import { policies } from './policyMock'

import type { PageDto, SecurityReplyDto } from '../types/types'
import type { CreateUserRo, ModifyUserRo, ModifyUserRolePolicyRo, ResetPasswordRo, UserAttributeRo, UserDto, UserExpireRo, UserStateRo } from '../types/userTypes'

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
const p2 = (n: number) => String(n).padStart(2, '0')
/** wire 日期时间（YYYYMMDDHHmmss；响应总是 14 位，2026-10-28 口径） */
const fmtTime = (d: Date) =>
  `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`
/** wire 仅日期（8 位）→ 当日 000000（14 位）；空串原样 = 未发生 */
const dayStart = (d: string) => (d ? `${d}000000` : '')
/** wire 仅日期（8 位）→ 当日 235959（到期含当天）；空串原样 = 永不过期 */
const dayEnd = (d: string) => (d ? `${d}235959` : '')
/** wire 仅日期（8 位）→ Date（本地午夜） */
const parseWireDate = (d: string) => new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00`)

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
    createdAt: '20250115090000', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '20260801100000', passwordExpiresAt: '',
    lastLoginTime: '20261017085512', lastLoginIp: '10.20.33.101', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'zhang.xiaofeng', nickName: '张小峰', email: 'zhang.xf@fabcorp.example', phoneNumber: '138-0000-0002',
    avatar: '', enabled: 1, roleIds: ['OPR-ENGINEER'], policyId: 'P001',
    createdAt: '20250603103000', accountActiveAt: '', accountExpiresAt: '20270602235959', passwordChangedAt: '20260825091200', passwordExpiresAt: '20261123091200',
    lastLoginTime: '20261016204133', lastLoginIp: '10.20.33.121', passwordValidDays: 365, accountValidDays: 365,
  },
  {
    userName: 'li.na', nickName: '李娜', email: 'li.na@fabcorp.example', phoneNumber: '138-0000-0003',
    avatar: '', enabled: 0, roleIds: ['VIEWER'], policyId: '',
    createdAt: '20250918140500', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '20260302112000', passwordExpiresAt: '',
    lastLoginTime: '20260930172640', lastLoginIp: '10.20.33.88', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'wang.jianguo', nickName: '王建国', email: '', phoneNumber: '138-0000-0004',
    avatar: '', enabled: 1, roleIds: ['AUDITOR'], policyId: 'P001',
    createdAt: '20241001080000', accountActiveAt: '', accountExpiresAt: '20261001000000', passwordChangedAt: '20260611153000', passwordExpiresAt: '20261215153000',
    lastLoginTime: '20260928090211', lastLoginIp: '10.20.34.17', passwordValidDays: 365, accountValidDays: 730,
  },
  {
    userName: 'chen.siya', nickName: '陈思雅', email: 'chen.sy@fabcorp.example', phoneNumber: '',
    avatar: '', enabled: 1, roleIds: ['EQUIP-ENGINEER', 'PROCESS-ENGINEER'], policyId: 'P002',
    createdAt: '20260214134500', accountActiveAt: '', accountExpiresAt: '20260813134500', passwordChangedAt: '20260920100500', passwordExpiresAt: '20261119100500',
    lastLoginTime: '20261017075803', lastLoginIp: '10.20.35.62', passwordValidDays: 60, accountValidDays: 180,
  },
  {
    userName: 'liu.dehua', nickName: '刘德华', email: 'liu.dh@fabcorp.example', phoneNumber: '138-0000-0006',
    avatar: '', enabled: 1, roleIds: ['MAINT-TECH'], policyId: '',
    createdAt: '20260701093000', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '20260701093000', passwordExpiresAt: '',
    lastLoginTime: '', lastLoginIp: '', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'zhao.min', nickName: '赵敏', email: 'zhao.min@fabcorp.example', phoneNumber: '138-0000-0007',
    avatar: '', enabled: 0, roleIds: ['PROCESS-ENGINEER'], policyId: 'P001',
    createdAt: '20250322162000', accountActiveAt: '', accountExpiresAt: '20270321235959', passwordChangedAt: '20251230141000', passwordExpiresAt: '20261224141000',
    lastLoginTime: '20260815114729', lastLoginIp: '10.20.33.140', passwordValidDays: 365, accountValidDays: 730,
  },
  {
    userName: 'sunlei.etl', nickName: '孙磊', email: 'sun.lei@fabcorp.example', phoneNumber: '138-0000-0008',
    avatar: '', enabled: 1, roleIds: ['ETL-OPERATOR'], policyId: '',
    createdAt: '20251108100000', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '20261010090000', passwordExpiresAt: '',
    lastLoginTime: '20261017083055', lastLoginIp: '10.20.36.9', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'zhou.yajing', nickName: '周雅静', email: '', phoneNumber: '',
    avatar: '', enabled: 1, roleIds: [], policyId: 'P003',
    createdAt: '20261015152000', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '20261015152000', passwordExpiresAt: '',
    lastLoginTime: '', lastLoginIp: '', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userName: 'wu.qiang', nickName: '吴强', email: 'wu.qiang@fabcorp.example', phoneNumber: '138-0000-0010',
    avatar: '', enabled: 1, roleIds: ['QA-VIEWER'], policyId: 'P002',
    createdAt: '20260506111100', accountActiveAt: '', accountExpiresAt: '20261102111100', passwordChangedAt: '20260901084500', passwordExpiresAt: '20261031084500',
    lastLoginTime: '20261016162007', lastLoginIp: '10.20.33.203', passwordValidDays: 60, accountValidDays: 180,
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

/** 编辑用户档案（2026-10-28 双接口拆分）：ModifyUserRo 全量替换昵称/邮箱/电话（空串=清空）；
 *  内置 ADMIN 档案三件套不受限（角色与策略由 /users/role-policy 端点拒收） */
registerMock('PUT', '/security-management/api/v1/users', ({ body }) => {
  const ro = body as unknown as ModifyUserRo
  const row = rows.find((r) => r.userName === ro?.userName)
  if (!row) return fail('用户不存在')
  const updated: UserDto = {
    ...row,
    nickName: String(ro.nickName ?? '').trim(),
    email: String(ro.email ?? '').trim(),
    phoneNumber: String(ro.phoneNumber ?? '').trim(),
  }
  rows[rows.indexOf(row)] = updated
  return ok({ ...updated })
})

/** 编辑用户角色与策略（2026-10-28 新端点）：ModifyUserRolePolicyRo 全量替换（指派语义）；
 *  内置 ADMIN 用户整端点拒收（账户延期另走 /users/expire 审计流）；
 *  账户到期由本"后端"按策略推算落库（2026-10-28 用户定稿：入参不带到期，界面仅呈现推算效果）——
 *  激活日期基准（accountActiveAt 空回落 createdAt 当日）+ 策略 accountValidDays；-1=永不过期落空串 */
registerMock('PUT', '/security-management/api/v1/users/role-policy', ({ body }) => {
  const ro = body as unknown as ModifyUserRolePolicyRo
  const row = rows.find((r) => r.userName === ro?.userName)
  if (!row) return fail('用户不存在')
  if (row.roleIds.includes(BUILTIN_ROLE_ID)) return fail('内置管理员用户的角色与策略不可修改')
  const policy = policies.find((p) => p.policyId === ro.policyId)
  if (!policy) return fail('登录策略不存在')
  const base = (row.accountActiveAt || row.createdAt || '').slice(0, 8)
  const days = policy.accountValidDays
  let expiresAt = ''
  if (days > 0 && base) {
    const d = parseWireDate(base)
    d.setDate(d.getDate() + days)
    expiresAt = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`
  }
  const updated: UserDto = {
    ...row,
    roleIds: [...(ro.roleIds ?? [])],
    policyId: ro.policyId,
    accountValidDays: days,
    accountExpiresAt: dayEnd(expiresAt),
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
  if (d && !/^\d{8}$/.test(d)) return fail('到期日期格式应为 YYYYMMDD')
  const days = d ? Math.max(0, Math.round((parseWireDate(d).getTime() - Date.now()) / 86400000)) : -1
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
