/**
 * 角色业务对象（security-management 服务，2026-10-17 后端口径）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 CLAUDE.md）。
 * 公用对象（PageRo / PageDto / SecurityReplyDto）在 ./types。
 */
import type { PageRo } from './types'

export interface RoleDto {
  roleId: string
  roleName: string
  description: string
  /** 1=启用 / 0=停用 */
  enabled: number
  permissions: string[]
}

/** 分页查询入参：公用 PageRo + 角色关键字（keyword 模糊匹配 roleId/roleName/description） */
export interface RolePageRo extends PageRo {
  keyword?: string
}

/** 新建/修改共用入参（roleId、roleName 非空校验归 UI 调用前：RoleEditDialog 表单规则） */
export interface RoleRo {
  roleId: string
  roleName: string
  description: string
}

/** 分配权限入参（POST /permissions 请求体） */
export interface AssignRolePermissionRo {
  roleId: string
  permissions: string[]
}

/** 名称字典项（GET /roles/name/list 出参，用户定稿 2026-10-20）：
 *  用户侧只存/传 roleId，展示名由前端经该全局字典 ID→Name 翻译并缓存 */
export interface RoleNameDto {
  roleId: string
  roleName: string
}

/** 内置角色编码（种子数据）：后端不再下发 builtin 标志，前端按此常量识别——
 *  不可删除/停用/改权限；名称与描述可编辑 */
export const BUILTIN_ROLE_ID = 'ADMIN'
