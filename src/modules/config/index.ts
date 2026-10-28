import type { FvModule } from '@/shared/module'

import zhCN from './i18n/zh-CN'
import enUS from './i18n/en-US'

/**
 * 模块 5 · 系统管理 —— Server Hang Reason Config
 * 维护「哪个 Rule、按什么标志行、判成什么 Hang 原因」的判定配置。
 * 自描述 manifest（2026-10-15）：模块名/图标/URL + 功能树（菜单/路由/权限目录由此派生）。
 */
const configModule: FvModule = {
  id: 'config',
  key: 'config.nav.root',
  icon: 'fas fa-screwdriver-wrench',
  url: '/config',
  version: '1.0.0',
  order: 20,
  features: [
    {
      id: 'config.srv-hang',
      key: 'config.nav.label',
      url: '/config/srv-hang',
      order: 10,
      component: () => import('./views/ServerHangReasonConfigView.vue'),
      // 页内受管控控件（权限系统按 id 管控）
      controls: [
        { id: 'config.srv-hang.add', key: 'config.control.add', type: 'button' },
        { id: 'config.srv-hang.edit', key: 'config.control.edit', type: 'button' },
        { id: 'config.srv-hang.delete', key: 'config.control.delete', type: 'button' },
        { id: 'config.srv-hang.toggle-status', key: 'config.control.toggleStatus', type: 'button' },
      ],
    },
  ],
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
}

export default configModule
