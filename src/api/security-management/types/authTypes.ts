import { ApiError } from '@/shared/api/errors'

import type { UserDto } from './userTypes'

/**
 * 认证业务对象（security-management 服务，2026-10-17 口径）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 AGENTS.md）。
 * 公用对象（PageRo / PageDto / SecurityReplyDto）在 ./types。
 *
 * 登录壳的特殊口径（2026-10-22 随新壳对齐）：登录业务失败 = success 0（新壳常规判据）
 * 且 errMsg 携带 LoginFailCode 机器码（展示文案由 UI 层按码映射 i18n）；
 * success=1 但 errMsg 非空仍防御性按失败处理——拆解逻辑见 ./authRequest 的 loginRequest。
 */

export interface LoginRo {
  username: string
  password: string
  /** 本机（内网）IP，前端尽力获取，可为空串 */
  clientIp: string
  /** 设备指纹：首启生成并持久化的设备 ID */
  deviceId: string
}

/** 登录返回对象（2026-10-20 嵌套改版，消除与 UserDto 的档案字段双写）：
 *  会话件仅 token（原 expiresIn/loginTime 移除——有效期口径后续并入登录策略统一）；
 *  档案整体嵌套 UserDto（头像 avatar 亦迁入，展示不编辑）；
 *  登录策略即 user.policyId（用户指出不设双字段）：非空 → 登录成功后前端调 fetchPolicyDetail
 *  取 PolicyDto 存 auth store 供修改密码按策略限制；为空或拉取失败 = 修改密码只保留基础限制 */
export interface LoginDto {
  token: string
  /** 未活动登出分钟数（用户定稿 2026-10-21）：后端按用户所挂策略解析下发，
   *  未挂策略取默认 30；-1=不开启——前端壳层看门狗据此侦测无操作自动登出 */
  idleLogoutMinutes: number
  /** 用户档案全量（含头像、登录足迹与挂载策略 policyId） */
  user: UserDto
}

/** 登录业务失败机器码（特殊壳口径下经 errMsg 下发） */
export type LoginFailCode =
  | 'AUTH_FAILED' // 密码错误
  | 'ACCOUNT_INVALID' // 账户不存在
  | 'ACCOUNT_EXPIRED' // 账户过期
  | 'ACCOUNT_LOCKED' // 账户锁定
  | 'PASSWORD_EXPIRED' // 密码过期
  | 'FIRST_LOGIN' // 首次登录须修改密码

const LOGIN_FAIL_CODES: readonly LoginFailCode[] = [
  'AUTH_FAILED',
  'ACCOUNT_INVALID',
  'ACCOUNT_EXPIRED',
  'ACCOUNT_LOCKED',
  'PASSWORD_EXPIRED',
  'FIRST_LOGIN',
]

/** errMsg 是否为登录失败机器码 */
export function isLoginFailCode(v: string): v is LoginFailCode {
  return (LOGIN_FAIL_CODES as readonly string[]).includes(v)
}

/** 登录业务失败错误：failCode 携带机器码（errMsg 同码），
 *  展示文案与点掉 Dialog 后的前端动作由 UI 层按码处理（LoginView 定稿 2026-10-17） */
export class LoginFailError extends ApiError {
  constructor(public readonly failCode: LoginFailCode) {
    super(200, failCode)
    this.name = 'LoginFailError'
  }
}

/** 修改密码入参（POST /auth/change_password）：
 *  登录页入口 = 未登录场景须显式带 username；主界面入口由调用方取登录态用户名传入，两口径同构 */
export interface ChangePasswordRo {
  username: string
  oldPassword: string
  newPassword: string
}

/** 登出（POST /auth/logout）：无业务入参，空对象体；出参 data 恒 null——不建 Ro/Dto */

/** 权限清单（GET /auth/permissions?username=…）：data = 字符串数组，
 *  格式约定（Function:/Control: 前缀）见 app/stores/permission.ts——非对象，不建 Dto */
