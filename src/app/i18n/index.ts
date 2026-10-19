import { createVuiI18n, type AppLocale } from '@/shared/i18n'
import type { FvDict } from '@/shared/module'
import zhCN from './zh-CN'
import enUS from './en-US'
import { getMessages } from '@/modules/registry'

const moduleMessages = getMessages()

export type { AppLocale }
export { LOCALE_KEY } from '@/shared/i18n'

/** app 词典 + 各注册模块私有词典合并（shared 词典在 createVuiI18n 内作基底；模块卸载时其词条随之消失） */
export const i18n = createVuiI18n({
  'zh-CN': { ...zhCN, ...moduleMessages['zh-CN'] },
  'en-US': { ...enUS, ...moduleMessages['en-US'] },
} satisfies Record<AppLocale, FvDict>)
