import '@fortawesome/fontawesome-free/css/all.css'
// v4 按需样式注入不含工具类：显式引入间距/布局 utilities（mt-* / mr-* / pa-* / ga-* 等）
import 'vuetify/lib/styles/utilities.css'

import { createVuetify, type ThemeDefinition } from 'vuetify'
import { aliases, fa } from 'vuetify/iconsets/fa'
import { en, zhHans } from 'vuetify/locale'

import { LOCALE_KEY } from '@/shared/i18n'

/**
 * vue-i18n 语言 → Vuetify 内置 locale 键（用户定稿 2026-10-18）：
 * 日历星期等 Intl 呈现随语言——中文=周一~周日，英文=三字母 Mon~Sun（weekday-format="short"）。
 */
export function toVuetifyLocale(appLocale: string | null): 'en' | 'zhHans' {
  return appLocale === 'en-US' ? 'en' : 'zhHans'
}

/**
 * 主题令牌 —— 05-视觉与交互规范 §2.2 / §2.3 / §2.4
 * 主色高级绿：浅色 #2F7D5A / 深色 #4CAA84；深色下主色提亮两档。
 * 交互定制（圆角阶梯 / 焦点环 / 表格行高等）见 shared/styles/tokens.css。
 */
const light: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#F9FAFB',
    surface: '#FFFFFF',
    'surface-variant': '#EFF2F4',
    primary: '#2F7D5A',
    'primary-hover': '#3A9169',
    'primary-darken-1': '#256847',
    secondary: '#616B70',
    success: '#1E7406',
    warning: '#ED9A30',
    error: '#E7180B',
    info: '#1677FF',
    'on-primary': '#FFFFFF',
    // on-* 显式声明：自定义 surface-variant 时 Vuetify 派生的 on 色不可用
    // （曾导致浅色模式 tooltip 白字白底隐形），一律取规范文字令牌（05 §2.4）
    'on-background': '#060D11',
    'on-surface': '#060D11',
    'on-surface-variant': '#616B70',
  },
}

const dark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#010101',
    surface: '#141414',
    'surface-variant': '#1E1E1E',
    primary: '#4CAA84',
    'primary-hover': '#5FBC96',
    'primary-darken-1': '#3B8C6B',
    secondary: '#869197',
    success: '#2F9F3D',
    warning: '#ED9A30',
    error: '#FF3A37',
    info: '#4096FF',
    'on-primary': '#04120B',
    'on-background': '#E2E6E8',
    'on-surface': '#E2E6E8',
    'on-surface-variant': '#869197',
  },
}

export default createVuetify({
  locale: {
    // 初始值按已存应用语言（默认中文）；运行期切换由 main.ts watch i18n 同步
    locale: toVuetifyLocale(localStorage.getItem(LOCALE_KEY)),
    fallback: 'en',
    messages: { en, zhHans },
  },
  icons: {
    defaultSet: 'fa',
    aliases, // 缺了它，$expand / $prev 等内部别名会回退成 mdi-* 类名（MDI 字体未加载 → 图标隐形）
    sets: { fa },
  },
  theme: {
    defaultTheme: 'light',
    themes: { light, dark },
  },
  defaults: {
    // 圆角由 tokens.css 的 --v-btn-border-radius（8px · S 档）统一控制
    VBtn: { style: 'text-transform: none' },
    // 控件高度按 05 §2.5（默认 36px），compact + tokens.css 覆盖 --v-input-control-height 实现
    VTextField: { variant: 'outlined', density: 'compact' },
    VSelect: { variant: 'outlined', density: 'compact' },
    VAutocomplete: { variant: 'outlined', density: 'compact' },
  },
})
