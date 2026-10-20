import type { PolicyDto } from '@/api/security-management/types/policyTypes'

/**
 * 新密码策略校验（2026-10-20 定稿）：
 * - 有登录策略 → 长度取策略 passwdMinLength/passwdMaxLength；四个开关开启时按策略强制
 *   至少含 1 数字 / 1 大写 / 1 小写 / 1 策略定义特殊字符（passwdSpecials 命中其一）。
 * - 无策略（loginPolicyId 为空 或 PolicyDetail 拉取失败）→ 退化为**基础限制**：
 *   最短不小于 6、最长不超过 18（长度之外不额外约束）。
 * 规则工厂按 getPolicy 取值时实时读取，改密弹窗（有策略）与登录页改密卡（无策略）共用。
 */

/** 无策略时基础长度限制（用户定稿：≥6、≤18） */
export const FALLBACK_PWD_MIN = 6
export const FALLBACK_PWD_MAX = 18

/**
 * 生成新密码规则函数（配合表单 :rules，空值交由 required 规则处理）。
 * @param getPolicy 当前登录策略读取器（返回 null/undefined 走基础限制）
 * @param t i18n 翻译
 */
export function newPwdPolicyRule(
  getPolicy: () => PolicyDto | null | undefined,
  t: (key: string, named?: Record<string, unknown>) => string,
): (v: string) => true | string {
  return (v: string) => {
    if (!v) return true
    const policy = getPolicy()
    const min = policy?.passwdMinLength ?? FALLBACK_PWD_MIN
    const max = policy?.passwdMaxLength ?? FALLBACK_PWD_MAX
    if (v.length < min || v.length > max) return t('validation.pwdLen', { min, max })
    if (policy) {
      if (policy.passwdRequireDigit === 1 && !/\d/.test(v)) return t('validation.pwdNeedDigit')
      if (policy.passwdRequireUpperChar === 1 && !/[A-Z]/.test(v)) return t('validation.pwdNeedUpper')
      if (policy.passwdRequireLowerChar === 1 && !/[a-z]/.test(v)) return t('validation.pwdNeedLower')
      if (
        policy.passwdRequireSpecialChar === 1 &&
        !v
          .split('')
          .some((c) => policy.passwdSpecials.includes(c))
      )
        return t('validation.pwdNeedSpecial')
    }
    return true
  }
}
