import { registerMock } from '@/shared/api/mock'

import type { SecurityReplyDto } from './types'
import type { PolicyDto } from './policyTypes'

/**
 * 登录策略接口 Mock（2026-10-19）：全量列表返回（不分页）；
 * 种子名与用户种子 policyName 对齐（标准策略/强策略；另备合规审计策略演示选项充足）。
 * policies 导出给用户 Mock 做 policyId→policyName 换算（同服务内存态互查，仅 Mock 层）。
 */
const ok = <T>(contents: T): SecurityReplyDto<T> => ({ code: 200, success: 0, errMsg: '', contents })

export const policies: PolicyDto[] = [
  { policyId: 'P001', policyName: '标准策略', description: '密码 90 天有效，账户 365 天有效' },
  { policyId: 'P002', policyName: '强策略', description: '密码 60 天有效，账户 180 天有效，锁定阈值 3 次' },
  { policyId: 'P003', policyName: '合规审计策略', description: '密码 30 天有效，登录全量审计' },
]

registerMock('GET', '/security-management/api/v1/login-policies', () => ok(policies.map((p) => ({ ...p }))))
