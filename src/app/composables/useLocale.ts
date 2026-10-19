import { useI18n } from 'vue-i18n'
import { useLocale as useVuetifyLocale } from 'vuetify'

import { LOCALE_KEY, type AppLocale } from '@/app/i18n'
import { toVuetifyLocale } from '@/shared/plugins/vuetify'

/**
 * 中英切换（05 §4.6）：顶栏下拉框选择，选择持久化（用户定稿 2026-10-14：下拉框替代切换按钮）。
 * 同步 Vuetify 内置 locale（用户定稿 2026-10-18）：日历星期随语言——中文=周一~周日 / 英文=三字母。
 */
export function useLocale() {
  const { locale } = useI18n()
  const vuetifyLocale = useVuetifyLocale()

  function setLocale(next: AppLocale) {
    locale.value = next
    localStorage.setItem(LOCALE_KEY, next)
    vuetifyLocale.current.value = toVuetifyLocale(next)
  }

  return { locale, setLocale }
}
