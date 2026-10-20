/**
 * 登录策略业务对象（security-management 服务，2026-10-20 策略管理迭代扩全）：
 * 命名遵循项目规则——请求体 Ro 结尾、返回对象 Dto 结尾（见 CLAUDE.md）。
 * 字段口径（用户定稿 2026-10-20）：密码段 = 最小/最大长度 + 四类字符必含开关 + 特殊字符集合
 * （字符串数组，须含特殊字符时必填）+ 有效天数；账户段 = 有效天数。
 * 布尔一律数字 1/0（同 RoleDto.enabled 后端口径）；天数 -1 = 永不过期。
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
  /** 密码须含数字：1=是 / 0=否 */
  passwdRequireDigit: number
  /** 密码须含小写字母：1=是 / 0=否 */
  passwdRequireLowerChar: number
  /** 密码须含大写字母：1=是 / 0=否 */
  passwdRequireUpperChar: number
  /** 密码须含特殊字符：1=是 / 0=否 */
  passwdRequireSpecialChar: number
  /** 须含特殊字符时的字符集合（字符串数组，每元素一个特殊字符；
   *  passwdRequireSpecialChar=0 时为空数组。用户定稿 2026-10-20） */
  passwdSpecials: string[]
  /** 密码有效天数；-1=永不过期 */
  passwdValidDays: number
  /** 账户有效天数；-1=永不过期 */
  accountValidDays: number
}

/** 名称字典项（GET /login_policy/name/list 出参，用户定稿 2026-10-20）：
 *  用户侧只存/传 policyId，展示名由前端经该全局字典 ID→Name 翻译并缓存 */
export interface PolicyNameDto {
  policyId: string
  policyName: string
}

/** 新建/修改共用入参（policyId 定位、编辑时不可改；非空校验归 UI 调用前：策略编辑弹窗表单规则，
 *  接口层不设守卫——同 RoleRo 口径） */
export interface PolicyRo {
  policyId: string
  policyName: string
  description: string
  passwdMinLength: number
  passwdMaxLength: number
  passwdRequireDigit: 0 | 1
  passwdRequireLowerChar: 0 | 1
  passwdRequireUpperChar: 0 | 1
  passwdRequireSpecialChar: 0 | 1
  /** 须含特殊字符时的字符集合；不要求时传空数组 */
  passwdSpecials: string[]
  /** 密码有效天数；-1=永不过期 */
  passwdValidDays: number
  /** 账户有效天数；-1=永不过期 */
  accountValidDays: number
}
