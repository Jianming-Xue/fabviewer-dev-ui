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
  /** 账户激活时间；空串 = 创建即激活（列表不展示，查看弹窗展示） */
  accountActiveAt: string
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

/** 新增用户入参（2026-10-19 拆分定稿：与编辑分离，userId 由后端生成；
 *  非空/格式校验归 UI 调用前（CreateUserDialog 表单规则），接口层不设守卫） */
export interface CreateUserRo {
  userName: string
  /** 明文经 TLS；创建场景不做复杂度策略（用户定稿 2026-10-19） */
  password: string
  nickName: string
  email: string
  phoneNumber: string
  /** 挂载角色 id 清单（至少 1 个，必填） */
  roleIds: string[]
  /** 登录策略 id（必填） */
  policyId: string
  /** 账户激活日期 'YYYY-MM-DD'（必填；晚于今天 → 提交时 enabled 必为 0，表单已联动锁定） */
  accountActiveAt: string
  /** 1=启用 / 0=停用 */
  enabled: number
}

/** 编辑用户入参（2026-10-19 定稿可编辑集：昵称/邮箱/电话/角色/策略/密码有效期/账户有效期/账户到期日；
 *  userName 锁定仅作定位辅助、enabled 表格行开关维护不在编辑表单内改，透传） */
export interface UserRo {
  userId: string
  userName: string
  nickName: string
  email: string
  phoneNumber: string
  /** 挂载角色 id 清单（空数组 = 不挂） */
  roleIds: string[]
  /** 登录策略 id；空串 = 默认策略 */
  policyId: string
  /** 密码有效期天数（-1 = 不限） */
  passwordValidDays: number
  /** 账户有效期天数（-1 = 不限） */
  accountValidDays: number
  /** 账户到期日期 'YYYY-MM-DD'；空串 = 永不过期 */
  accountExpiresAt: string
  /** 1=启用 / 0=停用（编辑表单不展示，由页面透传当前值） */
  enabled: number
}
