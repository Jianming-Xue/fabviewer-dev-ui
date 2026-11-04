/**
 * 登录策略业务对象（security-management 服务，2026-10-20 策略管理迭代扩全）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 AGENTS.md）。
 * 字段口径（用户定稿 2026-10-20）：密码段 = 最小/最大长度 + 四类字符必含开关 + 特殊字符集合
 * （字符串数组，须含特殊字符时必填）+ 有效天数；账户段 = 有效天数。
 * 布尔字段一律 true/false（2026-11-03 联调定案全局布尔口径）；天数 -1 = 永不过期。
 * 读接口不分页（用户定稿 2026-10-20：策略量小，全量返回 GET /api/v1/login_policy/list，
 * 管理页与用户弹窗下拉同一数据源、客户端自行展示）。
 */

export interface PolicyDto {
  policyId: string
  policyName: string
  description: string
  /** 密码最小长度 */
  passwdMinLength: number
  /** 密码最大长度 */
  passwdMaxLength: number
  /** 密码须含数字（2026-11-03 联调定案布尔） */
  passwdRequireDigit: boolean
  /** 密码须含小写字母（同上布尔） */
  passwdRequireLowerChar: boolean
  /** 密码须含大写字母（同上布尔） */
  passwdRequireUpperChar: boolean
  /** 密码须含特殊字符（同上布尔） */
  passwdRequireSpecialChar: boolean
  /** 须含特殊字符时的字符集合（字符串数组，每元素一个特殊字符；
   *  passwdRequireSpecialChar=0 时为空数组。用户定稿 2026-10-20） */
  passwdSpecials: string[]
  /** 密码有效天数；-1=永不过期 */
  passwdValidDays: number
  /** 账户有效天数；-1=永不过期 */
  accountValidDays: number
  /** 未活动登出时间（分钟）：登录后页面持续无操作达该时长自动登出；
   *  -1=不开启，默认 30（用户定稿 2026-10-21，登录时经 LoginDto 下发） */
  idleLogoutMinutes: number
}

/** 名称字典项（GET /login_policy/name/list 出参，用户定稿 2026-10-20）：
 *  用户侧只存/传 policyId，展示名由前端经该全局字典 ID→Name 翻译并缓存 */
export interface PolicyNameDto {
  policyId: string
  policyName: string
}

/** 内置策略编码（种子数据，2026-11-03 联调定稿 UI-16）：不可编辑、不可删除——
 *  其长度特权值（0~255=不限密码长度）不属常规校验 6≤min<max≤18 范围，编辑即违约；
 *  口径对齐 roleTypes 的 BUILTIN_ROLE_ID（前端菜单置灰 + 处理函数双保险 + Mock 拒收） */
export const BUILTIN_POLICY_ID = 'Admin-Policy'

/** 新建/修改共用入参（policyId 定位、编辑时不可改；非空校验归 UI 调用前：策略编辑弹窗表单规则，
 *  接口层不设守卫——同 RoleRo 口径） */
export interface PolicyRo {
  policyId: string
  policyName: string
  description: string
  passwdMinLength: number
  passwdMaxLength: number
  passwdRequireDigit: boolean
  passwdRequireLowerChar: boolean
  passwdRequireUpperChar: boolean
  passwdRequireSpecialChar: boolean
  /** 须含特殊字符时的字符集合；不要求时传空数组 */
  passwdSpecials: string[]
  /** 密码有效天数；-1=永不过期 */
  passwdValidDays: number
  /** 账户有效天数；-1=永不过期 */
  accountValidDays: number
  /** 未活动登出时间（分钟）；-1=不开启 */
  idleLogoutMinutes: number
}
