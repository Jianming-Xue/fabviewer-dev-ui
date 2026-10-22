import { registerMock } from '@/shared/api/mock'

import { policies } from './policyMock'
import { rows as userRows } from './userMock'

import type { ChangePasswordRo, LoginDto, LoginFailCode, LoginRo } from '../types/authTypes'
import type { SecurityReplyDto } from '../types/types'
import type { UserDto } from '../types/userTypes'

/**
 * 认证/权限 Mock（security-management 服务出参壳口径，2026-10-16 自 app/api 迁入，
 * 2026-10-17 类型归口 ./authTypes + 登录特殊壳/新 Dto）：
 * - 登录成功：返回 token + 用户档案 + 登录足迹（LoginDto 全字段）
 * - 登录失败（新壳 success:0）+ errMsg 机器码特殊口径，密码输触发词演示：
 *   `fail`=AUTH_FAILED（密码错误）/ `invalid`=ACCOUNT_INVALID / `expired`=ACCOUNT_EXPIRED /
 *   `locked`=ACCOUNT_LOCKED / `pwdexpired`=PASSWORD_EXPIRED
 * - 修改密码：旧密码输 `fail` 常规壳失败（success:0 + 文案）
 * - 权限清单：`admin` 全功能 / `test` 仅角色+Server Hang / 其他用户名空清单（fail-closed 演示）
 */
const ok = <T>(data: T): SecurityReplyDto<T> => ({ code: 'OK', success: 1, errMsg: '', data, txId: '' })
const fail = <T>(errMsg: string): SecurityReplyDto<T> => ({ code: 'FAIL', success: 0, errMsg, data: null as unknown as T, txId: '' })
/** 登录失败：新壳 success=0 + errMsg 携机器码（特殊点仅在 errMsg 为码非文案，UI 按码映射 i18n） */
const authFail = (code: LoginFailCode): SecurityReplyDto<null> => ({ code: 'FAIL', success: 0, errMsg: code, data: null, txId: '' })

/** 密码触发词 → 登录失败码（演示各分支；键一律小写比较） */
const LOGIN_FAIL_TRIGGERS: Record<string, LoginFailCode> = {
  fail: 'AUTH_FAILED',
  invalid: 'ACCOUNT_INVALID',
  expired: 'ACCOUNT_EXPIRED',
  locked: 'ACCOUNT_LOCKED',
  pwdexpired: 'PASSWORD_EXPIRED',
}

const p2 = (n: number) => String(n).padStart(2, '0')
const fmtTime = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`

/** 演示用小头像：通用人像剪影内联 SVG（data URL base64） */
const AVATAR_DATA_URL =
  'data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#4CAA84"/>' +
      '<circle cx="20" cy="15" r="6.5" fill="#fff"/><path d="M7 34c2.5-7.5 8-9.5 13-9.5s10.5 2 13 9.5z" fill="#fff"/></svg>',
  )

registerMock('POST', '/security-management/api/v1/auth/login', ({ body }) => {
  const ro = body as unknown as LoginRo
  const username = String(ro?.username ?? '').trim()
  const password = String(ro?.password ?? '')
  const trigger = LOGIN_FAIL_TRIGGERS[password.toLowerCase()]
  if (trigger) return authFail(trigger)
  if (!username || !password) return fail<LoginDto>('用户名或密码不能为空')
  const now = new Date()
  // 演示口径（2026-10-20 嵌套改版）：admin 挂标准策略 P001、test 挂强策略 P002、其余不挂——
  // user.policyId 非空时前端登录成功后拉策略详情（改密按策略限制），为空/拉取失败走基础限制
  const policyId = username === 'admin' ? 'P001' : username === 'test' ? 'P002' : ''
  const fallbackUser: UserDto = {
    userId: username === 'admin' ? 'U0001' : username === 'test' ? 'U0003' : 'U9000',
    userName: username,
    nickName: username === 'admin' ? '系统管理员' : username === 'test' ? '测试工程师' : `${username}（演示）`,
    email: `${username.toLowerCase()}@fabcorp.example`,
    phoneNumber: '138-0000-1234',
    avatar: AVATAR_DATA_URL,
    enabled: 1,
    roleIds: username === 'admin' ? ['ADMIN'] : username === 'test' ? ['VIEWER'] : [],
    policyId,
    createdAt: '2025-01-15 09:00:00',
    accountActiveAt: '',
    accountExpiresAt: '',
    passwordChangedAt: fmtTime(new Date(now.getTime() - 30 * 24 * 3600 * 1000)),
    passwordExpiresAt: '',
    lastLoginTime: fmtTime(new Date(now.getTime() - 7 * 24 * 3600 * 1000)), // 演示：上次登录 = 7 天前
    lastLoginIp: '10.20.33.121',
    passwordValidDays: 90,
    accountValidDays: -1,
  }
  // 种子用户真实档案合并（2026-10-21）：到期/角色/策略取用户表真行，守卫日期卡点方可演示
  const seed = userRows.find((r) => r.userName.toLowerCase() === username.toLowerCase())
  const user: UserDto = { ...fallbackUser, ...(seed ? {
    userId: seed.userId, nickName: seed.nickName, email: seed.email, phoneNumber: seed.phoneNumber,
    roleIds: [...seed.roleIds], policyId: seed.policyId, accountExpiresAt: seed.accountExpiresAt,
    passwordExpiresAt: seed.passwordExpiresAt, passwordValidDays: seed.passwordValidDays,
    accountValidDays: seed.accountValidDays,
  } : {}) }
  const login: LoginDto = {
    token: `mock-token-${Date.now().toString(36)}`,
    // 未活动登出分钟：按所挂策略解析（未挂/查不到 → 默认 30，用户定稿 2026-10-21）
    idleLogoutMinutes: policies.find((p) => p.policyId === user.policyId)?.idleLogoutMinutes ?? 30,
    user,
  }
  return ok(login)
})

registerMock('POST', '/security-management/api/v1/auth/logout', () => ok(null))

registerMock('GET', '/security-management/api/v1/auth/permissions', ({ params }) => {
  const username = String(params?.username ?? '').toLowerCase()
  if (username === 'admin') {
    return ok([
      'Function:/log-searching', // 模块级放行（其下全部功能）
      'Function:/security', // 模块级放行（用户和安全管理）
      'Function:/config', // 模块级放行（系统管理）
      'Control:/log-searching/mes-rule-info', // 功能级通配：检索页全部控件
      'Control:/security/roles', // 功能级通配：角色页全部控件
      'Control:/security/users', // 功能级通配：用户页全部控件
      'Control:/security/login-policy', // 功能级通配：登录策略页全部控件
      'Control:/config/srv-hang', // 功能级通配：配置页全部控件
    ])
  }
  if (username === 'test') {
    return ok([
      'Function:/security/roles', // 功能级放行：仅角色功能
      'Function:/config/srv-hang', // 功能级放行：仅 Server Hang 功能
    ])
  }
  return ok([])
})

/** 修改密码：入参 ChangePasswordRo（username + oldPassword + newPassword）；
 *  服务端基础守卫（2026-10-20 口径对齐前端无策略退化）：旧密码非空 + 新密码 6~18 位；
 *  策略级复杂度以前端 LoginPolicy 校验为主 */
registerMock('POST', '/security-management/api/v1/auth/change_password', ({ body }) => {
  const ro = body as unknown as ChangePasswordRo
  const username = String(ro?.username ?? '')
  const oldPassword = String(ro?.oldPassword ?? '')
  const newPassword = String(ro?.newPassword ?? '')
  if (!username.trim() || !oldPassword) return fail('用户名与旧密码不能为空')
  if (oldPassword.toLowerCase() === 'fail') {
    return fail('旧密码不正确（Mock：旧密码为 fail 时模拟校验失败）')
  }
  if (newPassword.length < 6 || newPassword.length > 18) return fail('新密码长度需为 6~18 位')
  return ok(null)
})
