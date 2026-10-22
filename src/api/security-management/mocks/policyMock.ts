import { registerMock } from '@/shared/api/mock'

import type { PolicyDto, PolicyNameDto, PolicyRo } from '../types/policyTypes'
import type { SecurityReplyDto } from '../types/types'

/**
 * 登录策略接口 Mock（2026-10-20 策略管理扩全）：全量 GET /login_policy/list（不分页，用户定稿）+
 * 名称字典 GET /login_policy/name/list + POST 新建、PUT 编辑、DELETE 删除（policyId 经 URL query）——
 * 口径对齐角色 Mock。种子备三条（标准策略/强策略/合规审计策略）；用户 Mock 只存 policyId
 * （2026-10-20 名称字典制，不再跨域换算，前端翻译见 ../rolePolicyNameCollection）。
 * policies 数组增删改一律**原地变更**（unshift/splice/整行替换），保字典接口活引用同步。
 * 布尔一律数字 1/0、天数 -1=永不过期；业务失败（ID 重复/未找到）以 success:0 + errMsg 返回（壳口径 2026-10-22 改版）。
 */
const ok = <T>(data: T): SecurityReplyDto<T> => ({ code: 'OK', success: 1, errMsg: '', data, txId: '' })
const fail = (errMsg: string): SecurityReplyDto<null> => ({ code: 'FAIL', success: 0, errMsg, data: null, txId: '' })
/** 内存态策略集（种子描述与字段逐字对齐；P003 账户 -1 演示永不过期） */
export const policies: PolicyDto[] = [
  {
    policyId: 'P001',
    policyName: '标准策略',
    description: '密码 8–16 位（数字+大小写）、90 天有效；账户 365 天有效',
    passwdMinLength: 8,
    passwdMaxLength: 16,
    passwdRequireDigit: 1,
    passwdRequireLowerChar: 1,
    passwdRequireUpperChar: 1,
    passwdRequireSpecialChar: 0,
    passwdSpecials: [],
    passwdValidDays: 90,
    accountValidDays: 365,
    idleLogoutMinutes: 30,
  },
  {
    policyId: 'P002',
    policyName: '强策略',
    description: '密码 10–18 位（四类字符全含）、60 天有效；账户 180 天有效',
    passwdMinLength: 10,
    passwdMaxLength: 18,
    passwdRequireDigit: 1,
    passwdRequireLowerChar: 1,
    passwdRequireUpperChar: 1,
    passwdRequireSpecialChar: 1,
    passwdSpecials: ['!', '@', '#', '$', '%', '&', '*', '~'],
    passwdValidDays: 60,
    accountValidDays: 180,
    idleLogoutMinutes: 15,
  },
  {
    policyId: 'P003',
    policyName: '合规审计策略',
    description: '密码 12–18 位（四类字符全含）、30 天有效；账户永不过期',
    passwdMinLength: 12,
    passwdMaxLength: 18,
    passwdRequireDigit: 1,
    passwdRequireLowerChar: 1,
    passwdRequireUpperChar: 1,
    passwdRequireSpecialChar: 1,
    passwdSpecials: ['!', '@', '#', '$', '%', '&', '*', '?', '-', '_', '+', '=', '~'],
    passwdValidDays: 30,
    accountValidDays: -1,
    idleLogoutMinutes: -1,
  },
]

/** 出入参隔离：数组字段深拷一层，防调用方改写内存态 */
const copy = (p: PolicyDto): PolicyDto => ({ ...p, passwdSpecials: [...p.passwdSpecials] })

/** 全量列表（不分页，用户定稿 2026-10-20；管理页 + 用户弹窗下拉共用；默认按 policyId 升序） */
registerMock('GET', '/security-management/api/v1/login_policy/list', () =>
  ok([...policies].sort((a, b) => a.policyId.localeCompare(b.policyId)).map(copy)),
)

/** 全局策略名称字典（活引用 policies：增删改即时反映到用户侧下拉/缓存刷新） */
registerMock('GET', '/security-management/api/v1/login_policy/name/list', () =>
  ok<PolicyNameDto[]>(policies.map((p) => ({ policyId: p.policyId, policyName: p.policyName }))),
)

/** 策略详情：policyId 经 URL query，整行 PolicyDto 返回（深拷隔离）；查无业务失败 */
registerMock('GET', '/security-management/api/v1/login_policy/detail', ({ params }) => {
  const row = policies.find((p) => p.policyId === String(params?.policyId ?? ''))
  if (!row) return fail('策略不存在')
  return ok(copy(row))
})

/** 新建：入参 PolicyRo（校验归 UI 前置，Mock 仅守非空/ID 唯一，演练失败分支） */
registerMock('POST', '/security-management/api/v1/login_policy', ({ body }) => {
  const input = body as unknown as PolicyRo
  if (!input?.policyId?.trim()) return fail('policyId 不能为空')
  if (!input?.policyName?.trim()) return fail('policyName 不能为空')
  if (policies.some((p) => p.policyId === input.policyId)) return fail('该策略 ID 已存在')
  const created: PolicyDto = {
    ...input,
    policyId: input.policyId.trim(),
    policyName: input.policyName.trim(),
    passwdSpecials: [...(input.passwdSpecials ?? [])],
  }
  policies.unshift(created)
  return ok(copy(created))
})

/** 编辑：入参 PolicyRo（policyId 定位不可改；整行字段全量覆盖） */
registerMock('PUT', '/security-management/api/v1/login_policy', ({ body }) => {
  const input = body as unknown as PolicyRo
  const row = policies.find((p) => p.policyId === input?.policyId)
  if (!row) return fail('策略不存在')
  if (!input?.policyName?.trim()) return fail('policyName 不能为空')
  const updated: PolicyDto = {
    ...input,
    policyName: input.policyName.trim(),
    description: input.description ?? '',
    passwdSpecials: [...(input.passwdSpecials ?? [])],
  }
  policies[policies.indexOf(row)] = updated
  return ok(copy(updated))
})

/** 删除：policyId 经 URL query */
registerMock('DELETE', '/security-management/api/v1/login_policy', ({ params }) => {
  const policyId = String(params?.policyId ?? '')
  const row = policies.find((p) => p.policyId === policyId)
  if (!row) return fail('策略不存在')
  policies.splice(policies.indexOf(row), 1)
  return ok(null)
})
