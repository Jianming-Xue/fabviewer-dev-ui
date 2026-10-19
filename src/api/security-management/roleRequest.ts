import { securityRequest } from './request'

import type { PageDto } from './types'
import type { AssignRolePermissionRo, RoleDto, RolePageRo, RoleRo } from './roleTypes'

/**
 * 角色接口（security-management 服务，前缀 /api/v1/roles，2026-10-17 后端口径）：
 * 分页 GET /page（URL query = RolePageRo：公用 PageRo + keyword）；
 * 新建 POST / 编辑 PUT 无后缀，入参一律 RoleRo（roleId/roleName/description；
 *   二者非空校验归 UI 调用前——RoleEditDialog 表单规则，接口层不设守卫）；
 * 删除 DELETE 的 roleId 写 URL query（?roleId=…）；
 * 是否启用 POST /enabled 也走 URL query（enabled 严格 0/1，签名以类型锁定、调用方由布尔换算）；
 * 分配权限 POST /permissions 传对象 AssignRolePermissionRo（roleId + permissions）。
 * 出参 RoleDto 布尔一律数字 1/0。
 */

/** 1 · 分页取角色（keyword 模糊匹配 roleId/roleName/description；默认按 roleId 升序） */
export function fetchRolesPage(ro: RolePageRo): Promise<PageDto<RoleDto>> {
  return securityRequest<PageDto<RoleDto>>('fetchRolesPage', 'GET', '/api/v1/roles/page', {
    params: { pageIndex: ro.pageIndex, pageSize: ro.pageSize, keyword: ro.keyword || undefined },
  })
}

/** 2 · 新增角色（入参 RoleRo；非空校验归 UI 调用前；变更类操作走全局 Loading 锁页） */
export function createRole(input: RoleRo): Promise<RoleDto> {
  return securityRequest<RoleDto>('createRole', 'POST', '/api/v1/roles', { body: input, loading: true })
}

/** 3 · 编辑角色（入参 RoleRo；roleId 定位不可改；内置 ADMIN 仅名称/描述可改；非空校验归 UI 调用前） */
export function updateRole(input: RoleRo): Promise<RoleDto> {
  return securityRequest<RoleDto>('updateRole', 'PUT', '/api/v1/roles', { body: input, loading: true })
}

/** 4 · 删除角色（roleId 写 URL query） */
export function deleteRole(roleId: string): Promise<null> {
  return securityRequest<null>('deleteRole', 'DELETE', '/api/v1/roles', { params: { roleId }, loading: true })
}

/** 5 · 分配权限（AssignRolePermissionRo 请求体：roleId + 权限串清单） */
export function assignRolePermissions(ro: AssignRolePermissionRo): Promise<null> {
  return securityRequest<null>('assignRolePermissions', 'POST', '/api/v1/roles/permissions', { body: ro, loading: true })
}

/** 6 · 是否启用（URL query：enabled 严格 0/1——1=启用、0=停用；调用方由布尔换算后传入） */
export function setRoleEnabled(roleId: string, enabled: 0 | 1): Promise<null> {
  return securityRequest<null>('setRoleEnabled', 'POST', '/api/v1/roles/enabled', { params: { roleId, enabled }, loading: true })
}
