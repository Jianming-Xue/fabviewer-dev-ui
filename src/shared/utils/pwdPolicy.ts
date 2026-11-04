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
      if (policy.passwdRequireDigit && !/\d/.test(v)) return t('validation.pwdNeedDigit')
      if (policy.passwdRequireUpperChar && !/[A-Z]/.test(v)) return t('validation.pwdNeedUpper')
      if (policy.passwdRequireLowerChar && !/[a-z]/.test(v)) return t('validation.pwdNeedLower')
      if (
        policy.passwdRequireSpecialChar &&
        !v
          .split('')
          .some((c) => policy.passwdSpecials.includes(c))
      )
        return t('validation.pwdNeedSpecial', { chars: policy.passwdSpecials.join('') })
    }
    return true
  }
}

/**
 * 新密码要求提示文案（2026-11-04 统一口径）：与 newPwdPolicyRule 同源生成——
 * 有策略按策略（长度上下限 + 四个开关逐项），无策略即基础长度限制；
 * 每项一行、行首「* 」，行间以 \n 分隔（FvTextInput 问号 tooltip 经
 * vui-field-hint-tip 的 white-space: pre-line 按行渲染）。
 * 登录页改密卡与顶栏改密弹窗共用，保证两处提示一致。
 */
export function newPwdPolicyHint(
  getPolicy: () => PolicyDto | null | undefined,
  t: (key: string, named?: Record<string, unknown>) => string,
): string {
  const policy = getPolicy()
  const bits = [
    t('validation.pwdLen', {
      min: policy?.passwdMinLength ?? FALLBACK_PWD_MIN,
      max: policy?.passwdMaxLength ?? FALLBACK_PWD_MAX,
    }),
  ]
  if (policy) {
    if (policy.passwdRequireDigit) bits.push(t('validation.pwdNeedDigit'))
    if (policy.passwdRequireUpperChar) bits.push(t('validation.pwdNeedUpper'))
    if (policy.passwdRequireLowerChar) bits.push(t('validation.pwdNeedLower'))
    // 特殊字符行带出策略字符集（2026-11-04 增强）：连排展示，同 PolicyEditDialog 的 SPECIAL_CHARS 惯例
    if (policy.passwdRequireSpecialChar)
      bits.push(t('validation.pwdNeedSpecial', { chars: policy.passwdSpecials.join('') }))
  }
  return bits.map((bit) => `* ${bit}`).join('\n')
}
