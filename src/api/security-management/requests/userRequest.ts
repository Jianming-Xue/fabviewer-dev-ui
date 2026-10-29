import { securityRequest } from './request'

import type { PageDto } from '../types/types'
import type { CreateUserRo, ModifyUserRo, ModifyUserRolePolicyRo, ResetPasswordRo, UserAttributeRo, UserDto, UserExpireRo, UserPageRo, UserStateRo } from '../types/userTypes'

/**
 * 用户接口（security-management 服务，前缀 /api/v1/users，2026-10-18 首版，文件分类同角色口径）：
 * 分页 GET /page（URL query = UserPageRo：公用 PageRo + keyword）；
 * 新建 POST 入参 CreateUserRo（2026-10-19 拆分：含密码/角色/策略/激活日期/启用）、
 *   编辑 PUT 入参 ModifyUserRo（昵称/邮箱/电话全量替换；2026-10-28 双接口拆分，
 *   角色与策略走 PUT /users/role-policy 入参 ModifyUserRolePolicyRo），
 *   非空与格式校验归 UI 调用前——Create/EditUserDialog 表单规则，接口层不设守卫；
 * 删除 DELETE 的 userName 写 URL query（?userName=…；2026-10-28 userId 退役、用户名即唯一标识）。
 * 变更类操作走全局 Loading 锁页；查看为纯前端展示（数据已在分页行内），无独立接口。
 */

/** 1 · 分页取用户（keyword 模糊匹配 userName/nickName/email；默认按 userName 升序） */
export function fetchUsersPage(ro: UserPageRo): Promise<PageDto<UserDto>> {
  return securityRequest<PageDto<UserDto>>('fetchUsersPage', 'GET', '/api/v1/users/page', {
    params: { pageIndex: ro.pageIndex, pageSize: ro.pageSize, keyword: ro.keyword || undefined },
  })
}

/** 2 · 新增用户（CreateUserRo；2026-10-19 含密码/角色/策略/激活日期） */
export function createUser(ro: CreateUserRo): Promise<UserDto> {
  return securityRequest<UserDto>('createUser', 'POST', '/api/v1/users', { body: ro, loading: true })
}

/** 3 · 编辑用户档案（PUT /api/v1/users，ModifyUserRo 全量替换昵称/邮箱/电话；
 *    2026-10-28 双接口拆分：角色与策略迁 /users/role-policy） */
export function updateUser(ro: ModifyUserRo): Promise<UserDto> {
  return securityRequest<UserDto>('updateUser', 'PUT', '/api/v1/users', { body: ro, loading: true })
}

/** 3b · 编辑用户角色与策略（PUT /api/v1/users/role-policy，ModifyUserRolePolicyRo 全量替换；
 *    内置 ADMIN 用户由服务端拒收；2026-10-28 双接口拆分自 /users） */
export function updateUserRolePolicy(ro: ModifyUserRolePolicyRo): Promise<UserDto> {
  return securityRequest<UserDto>('updateUserRolePolicy', 'PUT', '/api/v1/users/role-policy', {
    body: ro,
    loading: true,
  })
}

/** 6 · 重置密码（管理员侧 ResetPasswordRo，2026-10-19 More 菜单） */
export function resetUserPassword(ro: ResetPasswordRo): Promise<null> {
  return securityRequest<null>('resetUserPassword', 'PUT', '/api/v1/users/password', { body: ro, loading: true })
}

/** 4 · 删除用户（userName 写 URL query） */
export function deleteUser(userName: string): Promise<null> {
  return securityRequest<null>('deleteUser', 'DELETE', '/api/v1/users', { params: { userName }, loading: true })
}

/** 5 · 变更启用状态（2026-10-19 改造：原 URL query 即时提交 → UserStateRo body 经
 *    ChangeUserStateDialog 录备注后提交；enabled 严格 0/1 口径不变） */
export function setUserEnabled(ro: UserStateRo): Promise<null> {
  return securityRequest<null>('setUserEnabled', 'POST', '/api/v1/users/enabled', { body: ro, loading: true })
}

/** 6 · 单属性修改（POST /users/attribute，用户定稿 2026-10-20：用户信息弹窗行内编辑昵称/邮箱/电话；头像并入 avatar 2026-10-22；
 *    入参 UserAttributeRo{userName=登录用户名, attName, attValue}，同改密接口显式带身份口径） */
export function updateUserAttribute(ro: UserAttributeRo): Promise<null> {
  return securityRequest<null>('updateUserAttribute', 'POST', '/api/v1/users/attribute', { body: ro, loading: true })
}

/** 7 · 账户延期（POST /users/expire，用户定稿 2026-10-21：userName + 延期前到期串 +
 *    新到期日期（前端按策略账户天数计算，''=永不过期），成功后页面重拉刷新到期列） */
export function extendUserExpire(ro: UserExpireRo): Promise<null> {
  return securityRequest<null>('extendUserExpire', 'POST', '/api/v1/users/expire', { body: ro, loading: true })
}
