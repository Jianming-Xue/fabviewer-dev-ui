import { createI18n } from 'vue-i18n'

import type { FvDict } from '@/shared/module'

import zhCN from './zh-CN'
import enUS from './en-US'

/**
 * i18n 机制（shared 层，2026-10-15 下沉）：shared 词典为基底，
 * 调用方（app 插件层）把 app 词典与各模块词典按语言合并后传入。
 */
export type { FvDict as Dict }

export type AppLocale = 'zh-CN' | 'en-US'

export const LOCALE_KEY = 'vui.locale'

/** 模块级实例登记（结构子集，避开 vue-i18n 泛型实例赋值不兼容）：
 *  供非组件共享代码（如 http 全局错误呈现）取当前语言文案 */
interface SharedI18nLike {
  global: { t: (key: string, params?: Record<string, unknown>) => string }
}
let sharedI18n: SharedI18nLike | null = null

/** 非组件上下文翻译（实例未就绪时回退键名）；组件内一律 useI18n() */
export function tShared(key: string, params?: Record<string, unknown>): string {
  return sharedI18n ? sharedI18n.global.t(key, params) : key
}

/** shared 词典 + 调用方词典（app/模块）逐语言合并创建 i18n 实例 */
export function createVuiI18n(extra: Record<AppLocale, FvDict>) {
  const instance = createI18n({
    legacy: false,
    locale: localStorage.getItem(LOCALE_KEY) === 'en-US' ? 'en-US' : 'zh-CN', // 默认中文（05 §4.6）
    fallbackLocale: 'zh-CN',
    messages: {
      'zh-CN': { ...zhCN, ...extra['zh-CN'] },
      'en-US': { ...enUS, ...extra['en-US'] },
    },
  })
  sharedI18n = instance as unknown as SharedI18nLike
  return instance
}
