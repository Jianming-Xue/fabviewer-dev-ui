import { securityRequest } from './request'

import type { PolicyDto } from './policyTypes'

/**
 * 登录策略接口（security-management 服务，前缀 /api/v1/login-policies，2026-10-19 首版）：
 * 本期只有全量列表 GET（策略条数少，不分页；新增/编辑用户弹窗下拉消费）。
 */

/** 1 · 全量登录策略列表 */
export function fetchLoginPolicies(): Promise<PolicyDto[]> {
  return securityRequest<PolicyDto[]>('fetchLoginPolicies', 'GET', '/api/v1/login-policies')
}
