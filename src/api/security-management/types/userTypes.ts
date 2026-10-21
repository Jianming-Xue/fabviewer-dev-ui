/**
 * 用户业务对象（security-management 服务，2026-10-18）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 CLAUDE.md）；
 * 布尔一律数字 1/0（服务口径，同角色）。
 * 公用对象（PageRo / PageDto / SecurityReplyDto）在 ./types。
 * 列表不展示：createdAt / passwordChangedAt / lastLoginTime / lastLoginIp（查看弹窗全量展示）。
 */
import type { PageRo } from './types'

export interface UserDto {
  userId: string
  userName: string
  nickName: string
  email: string
  phoneNumber: string
  /** 头像（小图）：base64 图像内容（data URL 可直接渲染）；2026-10-20 自 LoginDto 迁入，
   *  仅随档案展示（顶栏/用户信息弹窗），用户管理界面不编辑 */
  avatar: string
  /** 用户状态：1=启用 / 0=停用 */
  enabled: number
  /** 挂载角色 id 清单（用户定稿 2026-10-20：后端只存/发 ID，
   *  展示名由前端名称字典翻译，见 ./rolePolicyNameCollection） */
  roleIds: string[]
  /** 挂载登录策略 id；空串 = 未挂（前端呈现为「默认策略」） */
  policyId: string
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
  /** 账户激活日期 'YYYY-MM-DD'（必填，UI 默认=当天；晚于今天 → 提交时 enabled 必为 0，表单已联动锁定） */
  accountActiveAt: string
  /** 账户到期日期 'YYYY-MM-DD'（UI 初始默认=激活+365 天；空串 = 永不过期） */
  accountExpiresAt: string
  /** 1=启用 / 0=停用 */
  enabled: number
}

/** 编辑用户入参（2026-10-19 拆分改造：稀疏语义——userId 定位，其余字段**传则改、不传保持**，
 *  由 EditUserDialog（昵称/邮箱/电话）与 EditUserRolePolicyDialog（角色/策略/两有效期天数/账户到期日）
 *  各自只提交自己维护的字段；userName 锁定仅作定位与查重辅助；enabled 由表格开关经 /users/enabled
 *  独立维护，编辑不经手 */
export interface UserRo {
  userId: string
  userName?: string
  nickName?: string
  email?: string
  phoneNumber?: string
  /** 挂载角色 id 清单（空数组 = 不挂） */
  roleIds?: string[]
  /** 登录策略 id；空串 = 默认策略 */
  policyId?: string
  /** 密码有效期天数（-1 = 不限） */
  passwordValidDays?: number
  /** 账户有效期天数（-1 = 不限） */
  accountValidDays?: number
  /** 账户到期日期 'YYYY-MM-DD'；空串 = 永不过期 */
  accountExpiresAt?: string
  /** 1=启用 / 0=停用（编辑表单不展示，由页面透传当前值） */
  enabled?: number
}

/** 重置密码入参（管理员侧，2026-10-19 More 菜单新增：ResetPasswordDialog 提交；
 *  复杂度按创建口径不校验（用户定稿），仅非空由表单规则保证） */
export interface ResetPasswordRo {
  userId: string
  /** 新密码明文（经 TLS） */
  password: string
}

/** 单属性修改入参（POST /users/attribute，用户定稿 2026-10-20：用户信息弹窗行内编辑）：
 *  userId = 登录用户名（与 /auth/change_password 同口径显式带身份，不走请求头）；
 *  可编辑白名单：nickName / email / phoneNumber（头像与账号字段不在此列） */
export interface UserAttributeRo {
  /** 登录用户名 */
  userId: string
  attName: 'nickName' | 'email' | 'phoneNumber'
  attValue: string
}

/** 账户延期入参（POST /users/expire，用户定稿 2026-10-21：more 菜单「账户延期」，
 *  ChangeAccountDateDialog 按所选策略 accountValidDays 计算新到期后提交——
 *  preAccountExpiresAt = 延期前到期串（'YYYY-MM-DD HH:mm:ss'，''=原永不过期）；
 *  newAccountExpiresAt = 新到期日期 'YYYY-MM-DD'，''=永不过期（策略天数 -1） */
export interface UserExpireRo {
  userId: string
  preAccountExpiresAt: string
  newAccountExpiresAt: string
}

/** 变更启用状态入参（2026-10-19 改造：开关点击不再即时提交，
 *  经 ChangeUserStateDialog 录入备注后整体提交；enabled 严格 0/1 服务口径不变） */
export interface UserStateRo {
  userId: string
  /** 目标状态：1=启用 / 0=停用 */
  enabled: number
  /** 操作备注（必填由表单规则保证） */
  remark: string
}
