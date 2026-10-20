import { securityRequest } from './request'

import type { PolicyDto, PolicyNameDto, PolicyRo } from '../types/policyTypes'

/**
 * 登录策略接口（security-management 服务，2026-10-20 策略管理扩全）：
 * 读接口不分页（用户定稿）——全量 GET /api/v1/login_policy/list，管理页与用户弹窗下拉同一数据源；
 *   详情 GET /api/v1/login_policy/detail?policyId=… 返回整个 PolicyDto；
 *   名称字典 GET /api/v1/login_policy/name/list（用户侧 ID→Name 翻译，见 ../rolePolicyNameCollection）；
 * 变更三式（用户定稿 2026-10-20，资源根 /api/v1/login_policy）：新建 POST、编辑 PUT 同址无后缀，
 *   入参一律 PolicyRo（非空校验归 UI 调用前——策略编辑弹窗表单规则，接口层不设守卫）；
 *   删除 DELETE 的 policyId 写 URL query（?policyId=…）；
 * 出参 PolicyDto 布尔一律数字 1/0、天数 -1=永不过期。变更类操作走全局 Loading 锁页。
 */

/** 1 · 全量登录策略列表（不分页；策略管理页表格消费） */
export function fetchLoginPolicies(): Promise<PolicyDto[]> {
  return securityRequest<PolicyDto[]>('fetchLoginPolicies', 'GET', '/api/v1/login_policy/list')
}

/** 1b · 全局策略名称字典（用户定稿 2026-10-20：用户侧只存 ID，进入用户界面预载缓存、
 *  点开策略下拉时重拉刷新；出参仅 ID+Name） */
export function fetchPolicyNames(): Promise<PolicyNameDto[]> {
  return securityRequest<PolicyNameDto[]>('fetchPolicyNames', 'GET', '/api/v1/login_policy/name/list')
}

/** 1c · 策略详情（policyId 写 URL query，返回整个 PolicyDto 全量字段，用户定稿 2026-10-20） */
export function fetchPolicyDetail(policyId: string): Promise<PolicyDto> {
  return securityRequest<PolicyDto>('fetchPolicyDetail', 'GET', '/api/v1/login_policy/detail', {
    params: { policyId },
  })
}

/** 2 · 新增策略（入参 PolicyRo） */
export function createPolicy(input: PolicyRo): Promise<PolicyDto> {
  return securityRequest<PolicyDto>('createPolicy', 'POST', '/api/v1/login_policy', { body: input, loading: true })
}

/** 3 · 编辑策略（入参 PolicyRo；policyId 定位不可改） */
export function updatePolicy(input: PolicyRo): Promise<PolicyDto> {
  return securityRequest<PolicyDto>('updatePolicy', 'PUT', '/api/v1/login_policy', { body: input, loading: true })
}

/** 4 · 删除策略（policyId 写 URL query） */
export function deletePolicy(policyId: string): Promise<null> {
  return securityRequest<null>('deletePolicy', 'DELETE', '/api/v1/login_policy', {
    params: { policyId },
    loading: true,
  })
}
