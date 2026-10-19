/**
 * 认证业务对象（security-management 服务，2026-10-17 口径）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 CLAUDE.md）。
 * 公用对象（PageRo / PageDto / SecurityReplyDto）在 ./types。
 *
 * 登录壳的特殊口径（2026-10-17 后端定）：success = 0 且 errMsg 非空 = 登录业务失败，
 * errMsg 携带 LoginFailCode 机器码（展示文案由 UI 层按码映射 i18n）；
 * 常规壳规则（success ≠ 0 = 失败）同样成立——拆解逻辑见 ./authRequest 的 loginRequest。
 */
import { ApiError } from '@/shared/api/errors'

/** 登录入参（POST /auth/login）：账密之外透传本机 IP 与设备指纹（见 shared/utils/device） */
export interface LoginRo {
  username: string
  password: string
  /** 本机（内网）IP，前端尽力获取，可为空串 */
  clientIp: string
  /** 设备指纹：首启生成并持久化的设备 ID */
  deviceId: string
}

/** 登录返回对象：token + 用户档案 + 登录足迹 */
export interface LoginDto {
  token: string
  /** 有效期（秒） */
  expiresIn: number
  userName: string
  nickName: string
  email: string
  phoneNumber: string
  /** 头像（小图）：base64 图像内容（data URL 可直接渲染） */
  avatar: string
  /** 本次登录时间 */
  loginTime: string
  /** 上次登录时间 */
  lastLoginTime: string
  /** 上次登录 IP */
  lastLoginIp: string
}

/** 登录业务失败机器码（特殊壳口径下经 errMsg 下发） */
export type LoginFailCode =
  | 'AUTH_FAILED' // 密码错误
  | 'ACCOUNT_INVALID' // 账户不存在
  | 'ACCOUNT_EXPIRED' // 账户过期
  | 'ACCOUNT_LOCKED' // 账户锁定
  | 'PASSWORD_EXPIRED' // 密码过期

const LOGIN_FAIL_CODES: readonly LoginFailCode[] = [
  'AUTH_FAILED',
  'ACCOUNT_INVALID',
  'ACCOUNT_EXPIRED',
  'ACCOUNT_LOCKED',
  'PASSWORD_EXPIRED',
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

/** 登出（POST /auth/logout）：无业务入参，空对象体；出参 contents 恒 null——不建 Ro/Dto */

/** 权限清单（GET /auth/permissions?username=…）：contents = 字符串数组，
 *  格式约定（Function:/Control: 前缀）见 app/stores/permission.ts——非对象，不建 Dto */
