import { securityRequest } from './request'

import type { PageDto } from './types'
import type { CreateUserRo, UserDto, UserPageRo, UserRo } from './userTypes'

/**
 * 用户接口（security-management 服务，前缀 /api/v1/users，2026-10-18 首版，文件分类同角色口径）：
 * 分页 GET /page（URL query = UserPageRo：公用 PageRo + keyword）；
 * 新建 POST 入参 CreateUserRo（2026-10-19 拆分：含密码/角色/策略/激活日期/启用）、
 *   编辑 PUT 入参 UserRo（可编辑集=昵称/邮箱/电话/角色/策略/两有效期天数/到期日期），
 *   非空与格式校验归 UI 调用前——Create/EditUserDialog 表单规则，接口层不设守卫；
 * 删除 DELETE 的 userId 写 URL query（?userId=…）。
 * 变更类操作走全局 Loading 锁页；查看为纯前端展示（数据已在分页行内），无独立接口。
 */

/** 1 · 分页取用户（keyword 模糊匹配 userName/nickName/email；默认按 userName 升序） */
export function fetchUsersPage(ro: UserPageRo): Promise<PageDto<UserDto>> {
  return securityRequest<PageDto<UserDto>>('fetchUsersPage', 'GET', '/api/v1/users/page', {
    params: { pageIndex: ro.pageIndex, pageSize: ro.pageSize, keyword: ro.keyword || undefined },
  })
}

/** 2 · 新增用户（CreateUserRo，userId 由后端生成；2026-10-19 含密码/角色/策略/激活日期） */
export function createUser(ro: CreateUserRo): Promise<UserDto> {
  return securityRequest<UserDto>('createUser', 'POST', '/api/v1/users', { body: ro, loading: true })
}

/** 3 · 编辑用户（UserRo，userId 定位；userName 锁定；可编辑集见 UserRo 注释） */
export function updateUser(ro: UserRo): Promise<UserDto> {
  return securityRequest<UserDto>('updateUser', 'PUT', '/api/v1/users', { body: ro, loading: true })
}

/** 4 · 删除用户（userId 写 URL query） */
export function deleteUser(userId: string): Promise<null> {
  return securityRequest<null>('deleteUser', 'DELETE', '/api/v1/users', { params: { userId }, loading: true })
}

/** 5 · 是否启用（URL query：enabled 严格 0/1——1=启用、0=停用；调用方由布尔换算，口径同角色 setRoleEnabled） */
export function setUserEnabled(userId: string, enabled: 0 | 1): Promise<null> {
  return securityRequest<null>('setUserEnabled', 'POST', '/api/v1/users/enabled', { params: { userId, enabled }, loading: true })
}
