import { computed, ref } from 'vue'

import { fetchRoleNames } from './requests/roleRequest'
import { fetchPolicyNames } from './requests/policyRequest'

import type { RoleNameDto } from './types/roleTypes'
import type { PolicyNameDto } from './types/policyTypes'

/**
 * 角色/策略名称字典缓存（用户定稿 2026-10-20）：
 * 后端用户接口只存/发 ID（roleIds / policyId），展示名一律由前端翻译——
 * 数据源为全局 name/list 两接口：
 * - 进入用户界面时 ensureXxxNames() 预载（表格 ID→Name 展示、弹窗未开下拉按 ID 显名）；
 * - 点开角色/策略下拉时 ensureXxxNames(true) 强刷（"点开下拉列表时更新缓存"），
 *   调用方随后按新字典剔除查无此名的已选 ID（角色清该 ID、策略清下拉）。
 * ref 数组暴露响应式字典（下拉到达即自动重显名），in-flight 去重防并发重复拉取。
 */

export interface NameOption {
  title: string
  value: string
}

const roleList = ref<RoleNameDto[]>([])
const policyList = ref<PolicyNameDto[]>([])
let roleLoading: Promise<void> | null = null
let policyLoading: Promise<void> | null = null

/** 角色选项（下拉 items 直接消费，ID→Name 已就位） */
export const roleOptions = computed<NameOption[]>(() =>
  roleList.value.map((r) => ({ title: r.roleName, value: r.roleId })),
)
/** 策略选项 */
export const policyOptions = computed<NameOption[]>(() =>
  policyList.value.map((p) => ({ title: p.policyName, value: p.policyId })),
)

/** roleId → roleName；字典未载或已删返回 '' */
export function roleNameOf(roleId: string): string {
  return roleList.value.find((r) => r.roleId === roleId)?.roleName ?? ''
}
/** policyId → policyName；同上 */
export function policyNameOf(policyId: string): string {
  return policyList.value.find((p) => p.policyId === policyId)?.policyName ?? ''
}

/** 已载 roleId 集合（下拉刷新后清理失效选中用） */
export function knownRoleIds(): Set<string> {
  return new Set(roleList.value.map((r) => r.roleId))
}
/** 已载 policyId 集合 */
export function knownPolicyIds(): Set<string> {
  return new Set(policyList.value.map((p) => p.policyId))
}

/** 载入角色名称字典；force=true 无视缓存重拉（点开下拉时刷新） */
export function ensureRoleNames(force = false): Promise<void> {
  if (!force && roleList.value.length) return Promise.resolve()
  roleLoading ??= fetchRoleNames()
    .then((list) => {
      roleList.value = list
    })
    .finally(() => {
      roleLoading = null
    })
  return roleLoading
}

/** 载入策略名称字典；force 同上 */
export function ensurePolicyNames(force = false): Promise<void> {
  if (!force && policyList.value.length) return Promise.resolve()
  policyLoading ??= fetchPolicyNames()
    .then((list) => {
      policyList.value = list
    })
    .finally(() => {
      policyLoading = null
    })
  return policyLoading
}
