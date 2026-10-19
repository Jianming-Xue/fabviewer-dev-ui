import { registerMock } from '@/shared/api/mock'

import { policies } from './policyMock'
import { rows as roleRows } from './roleMock'

import type { PageDto, SecurityReplyDto } from './types'
import type { CreateUserRo, UserDto, UserRo } from './userTypes'

/** 角色/策略 id → 名称换算（挂载名与 USER 种子 policyName 同幅；id 查不到原名兜底） */
const roleNamesOf = (ids: string[]) =>
  (ids ?? []).map((id) => roleRows.find((r) => r.roleId === id)?.roleName ?? id)
const policyNameOf = (id: string) => policies.find((p) => p.policyId === id)?.policyName ?? ''
/** 'YYYY-MM-DD' → 当日 00:00:00（激活）；空串原样 */
const dayStart = (d: string) => (d ? `${d} 00:00:00` : '')
/** 'YYYY-MM-DD' → 当日 23:59:59（到期含当天）；空串原样 = 永不过期 */
const dayEnd = (d: string) => (d ? `${d} 23:59:59` : '')

/**
 * 用户接口 Mock（2026-10-18，壳/分页/URL query 口径同角色）：
 * keyword 模糊匹配 userName/nickName/email；userName 唯一（重复返回业务失败，演练前端失败分支）；
 * userId 由后端生成（Mock 以时间戳 36 进制模拟）；布尔一律 1/0，日期为 'YYYY-MM-DD HH:mm:ss' 串，
 * 空串 = 永不过期 / 未发生，-1 = 有效期不限。
 */
const ok = <T>(contents: T): SecurityReplyDto<T> => ({ code: 200, success: 0, errMsg: '', contents })
const fail = (errMsg: string): SecurityReplyDto<null> => ({ code: 200, success: 1, errMsg, contents: null })

const p2 = (n: number) => String(n).padStart(2, '0')
const fmtTime = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`

/** 内存态用户集（业务命名真实，10 条 = pageSize 10 下两页；含永不过期/已过期/停用/未登录等演示形态） */
const rows: UserDto[] = [
  {
    userId: 'U0001', userName: 'admin', nickName: '系统管理员', email: 'admin@fabcorp.example', phoneNumber: '138-0000-0001',
    enabled: 1, roles: ['系统管理员'], policyName: '',
    createdAt: '2025-01-15 09:00:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-08-01 10:00:00', passwordExpiresAt: '',
    lastLoginTime: '2026-10-17 08:55:12', lastLoginIp: '10.20.33.101', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userId: 'U0002', userName: 'zhang.xiaofeng', nickName: '张小峰', email: 'zhang.xf@fabcorp.example', phoneNumber: '138-0000-0002',
    enabled: 1, roles: ['运维工程师'], policyName: '标准策略',
    createdAt: '2025-06-03 10:30:00', accountActiveAt: '', accountExpiresAt: '2027-06-02 23:59:59', passwordChangedAt: '2026-08-25 09:12:00', passwordExpiresAt: '2026-11-23 09:12:00',
    lastLoginTime: '2026-10-16 20:41:33', lastLoginIp: '10.20.33.121', passwordValidDays: 365, accountValidDays: 365,
  },
  {
    userId: 'U0003', userName: 'li.na', nickName: '李娜', email: 'li.na@fabcorp.example', phoneNumber: '138-0000-0003',
    enabled: 0, roles: ['只读用户'], policyName: '',
    createdAt: '2025-09-18 14:05:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-03-02 11:20:00', passwordExpiresAt: '',
    lastLoginTime: '2026-09-30 17:26:40', lastLoginIp: '10.20.33.88', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userId: 'U0004', userName: 'wang.jianguo', nickName: '王建国', email: '', phoneNumber: '138-0000-0004',
    enabled: 1, roles: ['审计角色'], policyName: '标准策略',
    createdAt: '2024-10-01 08:00:00', accountActiveAt: '', accountExpiresAt: '2026-10-01 00:00:00', passwordChangedAt: '2026-06-11 15:30:00', passwordExpiresAt: '2026-12-15 15:30:00',
    lastLoginTime: '2026-09-28 09:02:11', lastLoginIp: '10.20.34.17', passwordValidDays: 365, accountValidDays: 730,
  },
  {
    userId: 'U0005', userName: 'chen.siya', nickName: '陈思雅', email: 'chen.sy@fabcorp.example', phoneNumber: '',
    enabled: 1, roles: ['设备工程师', '工艺工程师'], policyName: '强策略',
    createdAt: '2026-02-14 13:45:00', accountActiveAt: '', accountExpiresAt: '2026-08-13 13:45:00', passwordChangedAt: '2026-09-20 10:05:00', passwordExpiresAt: '2026-11-19 10:05:00',
    lastLoginTime: '2026-10-17 07:58:03', lastLoginIp: '10.20.35.62', passwordValidDays: 60, accountValidDays: 180,
  },
  {
    userId: 'U0006', userName: 'liu.dehua', nickName: '刘德华', email: 'liu.dh@fabcorp.example', phoneNumber: '138-0000-0006',
    enabled: 1, roles: ['维护技术员'], policyName: '',
    createdAt: '2026-07-01 09:30:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-07-01 09:30:00', passwordExpiresAt: '',
    lastLoginTime: '', lastLoginIp: '', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userId: 'U0007', userName: 'zhao.min', nickName: '赵敏', email: 'zhao.min@fabcorp.example', phoneNumber: '138-0000-0007',
    enabled: 0, roles: ['工艺工程师'], policyName: '标准策略',
    createdAt: '2025-03-22 16:20:00', accountActiveAt: '', accountExpiresAt: '2027-03-21 23:59:59', passwordChangedAt: '2025-12-30 14:10:00', passwordExpiresAt: '2026-12-24 14:10:00',
    lastLoginTime: '2026-08-15 11:47:29', lastLoginIp: '10.20.33.140', passwordValidDays: 365, accountValidDays: 730,
  },
  {
    userId: 'U0008', userName: 'sunlei.etl', nickName: '孙磊', email: 'sun.lei@fabcorp.example', phoneNumber: '138-0000-0008',
    enabled: 1, roles: ['ETL 操作员'], policyName: '',
    createdAt: '2025-11-08 10:00:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-10-10 09:00:00', passwordExpiresAt: '',
    lastLoginTime: '2026-10-17 08:30:55', lastLoginIp: '10.20.36.9', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userId: 'U0009', userName: 'zhou.yajing', nickName: '周雅静', email: '', phoneNumber: '',
    enabled: 1, roles: [], policyName: '',
    createdAt: '2026-10-15 15:20:00', accountActiveAt: '', accountExpiresAt: '', passwordChangedAt: '2026-10-15 15:20:00', passwordExpiresAt: '',
    lastLoginTime: '', lastLoginIp: '', passwordValidDays: -1, accountValidDays: -1,
  },
  {
    userId: 'U0010', userName: 'wu.qiang', nickName: '吴强', email: 'wu.qiang@fabcorp.example', phoneNumber: '138-0000-0010',
    enabled: 1, roles: ['质量查看员'], policyName: '强策略',
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
  const contents: PageDto<UserDto> = {
    pageSize,
    pageIndex,
    totalSize: sorted.length,
    data: sorted.slice(start, start + pageSize),
  }
  return ok(contents)
})

registerMock('POST', '/security-management/api/v1/users', ({ body }) => {
  const ro = body as unknown as CreateUserRo
  if (!ro?.userName?.trim()) return fail('用户名不能为空')
  if (rows.some((r) => r.userName === ro.userName.trim())) return fail('该用户名已存在')
  const now = new Date()
  const activeAt = dayStart(ro.accountActiveAt ?? '')
  const created: UserDto = {
    userId: `U${Date.now().toString(36).toUpperCase()}`,
    userName: ro.userName.trim(),
    nickName: ro.nickName?.trim() ?? '',
    email: ro.email?.trim() ?? '',
    phoneNumber: ro.phoneNumber?.trim() ?? '',
    enabled: ro.enabled === 0 ? 0 : 1,
    roles: roleNamesOf(ro.roleIds),
    policyName: policyNameOf(ro.policyId ?? ''),
    createdAt: fmtTime(now),
    accountActiveAt: activeAt,
    accountExpiresAt: '',
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

registerMock('PUT', '/security-management/api/v1/users', ({ body }) => {
  const ro = body as unknown as UserRo
  const row = rows.find((r) => r.userId === ro?.userId)
  if (!row) return fail('用户不存在')
  if (!ro?.userName?.trim()) return fail('用户名不能为空')
  if (rows.some((r) => r.userName === ro.userName.trim() && r.userId !== row.userId)) return fail('该用户名已存在')
  const updated: UserDto = {
    ...row,
    userName: row.userName, // 创建后锁定，改名忽略
    nickName: ro.nickName?.trim() ?? '',
    email: ro.email?.trim() ?? '',
    phoneNumber: ro.phoneNumber?.trim() ?? '',
    enabled: ro.enabled === 0 ? 0 : 1,
    roles: roleNamesOf(ro.roleIds ?? row.roles),
    policyName: policyNameOf(ro.policyId ?? ''),
    accountExpiresAt: dayEnd(ro.accountExpiresAt ?? ''),
    passwordValidDays: Number.isFinite(ro.passwordValidDays) ? ro.passwordValidDays : row.passwordValidDays,
    accountValidDays: Number.isFinite(ro.accountValidDays) ? ro.accountValidDays : row.accountValidDays,
  }
  rows[rows.indexOf(row)] = updated
  return ok({ ...updated })
})

/** 删除：userId 经 URL query */
registerMock('DELETE', '/security-management/api/v1/users', ({ params }) => {
  const userId = String(params?.userId ?? '')
  const row = rows.find((r) => r.userId === userId)
  if (!row) return fail('用户不存在')
  rows.splice(rows.indexOf(row), 1)
  return ok(null)
})

/** 是否启用：URL query 传参，enabled 严格 0/1（口径同角色 /roles/enabled） */
registerMock('POST', '/security-management/api/v1/users/enabled', ({ params }) => {
  const userId = String(params?.userId ?? '')
  const enabled = Number(params?.enabled)
  if (enabled !== 0 && enabled !== 1) return fail('enabled 必须为 0 或 1')
  const row = rows.find((r) => r.userId === userId)
  if (!row) return fail('用户不存在')
  rows[rows.indexOf(row)] = { ...row, enabled }
  return ok(null)
})
