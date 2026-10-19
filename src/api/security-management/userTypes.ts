/**
 * 用户业务对象（security-management 服务，2026-10-18）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 CLAUDE.md）；
 * 布尔一律数字 1/0（服务口径，同角色）。
 * 公用对象（PageRo / PageDto / SecurityReplyDto）在 ./types。
 * 列表不展示：createdAt / passwordChangedAt / lastLoginTime / lastLoginIp（查看弹窗全量展示）。
 */
import type { PageRo } from './types'

/** 用户返回对象（档案 + 状态 + 挂载 + 到期足迹全量） */
export interface UserDto {
  userId: string
  userName: string
  nickName: string
  email: string
  phoneNumber: string
  /** 用户状态：1=启用 / 0=停用 */
  enabled: number
  /** 挂载角色名清单（v1 直接下发名称用于展示；改挂功能上线后切 roleId 关联） */
  roles: string[]
  /** 挂载登录策略名；空串 = 未挂（前端呈现为「默认策略」） */
  policyName: string
  /** 账户创建时间（列表不展示） */
  createdAt: string
  /** 账户过期时间；空串 = 永不过期 */
  accountExpiresAt: string
  /** 上次密码修改时间（列表不展示） */
  passwordChangedAt: string
  /** 密码过期时间；空串 = 永不过期 */
  passwordExpiresAt: string
  /** 上次登录时间（列表不展示） */
  lastLoginTime: string
  /** 上次登录 IP（列表不展示） */
  lastLoginIp: string
  /** 密码有效期天数（-1 = 不限，策略折算存档） */
  passwordValidDays: number
  /** 账户有效期天数（-1 = 不限，策略折算存档） */
  accountValidDays: number
}

/** 分页查询入参：公用 PageRo + 关键字（keyword 模糊匹配 userName/nickName/email） */
export interface UserPageRo extends PageRo {
  keyword?: string
}

/** 新增/修改共用入参（新增 userId 留空由后端生成；编辑以 userId 定位、userName 锁定；
 *  角色/策略/到期日编辑后续迭代开通，当前 Ro 不含） */
export interface UserRo {
  userId: string
  userName: string
  nickName: string
  email: string
  phoneNumber: string
  /** 1=启用 / 0=停用（新增表单默认 1） */
  enabled: number
}
