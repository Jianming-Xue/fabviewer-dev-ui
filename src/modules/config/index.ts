import type { FvModule } from '@/shared/module'

import zhCN from './i18n/zh-CN'
import enUS from './i18n/en-US'

/**
 * 模块 5 · 系统管理 —— Server Hang Reason Config + System Misc
 * 前者维护「哪个 Rule、按什么标志行、判成什么 Hang 原因」的判定配置；
 * 后者维护平台级全局变量（环境/IP 清单等，2026-11-09 新增，模块5 · 02）。
 * 2026-11-10 增模块2「日志监控与告警」配置侧两功能：MES日志监控配置（关键字告警规则，模块2 · 01）
 * + MES服务挂起监控配置（环境级阈值，模块2 · 03）——文档定稿均为菜单级权限，无细粒度 controls。
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
    {
      // System Misc（模块5 · 02）：双层权限——功能权限（Function:/config/sys-misc，菜单过滤承载）
      // + 编辑权限（control edit：无则 Editable 总开关与编辑入口全隐藏，页面只读）
      id: 'config.sys-misc',
      key: 'config.misc.nav.label',
      url: '/config/sys-misc',
      order: 20,
      component: () => import('./views/SystemMiscView.vue'),
      controls: [
        { id: 'config.sys-misc.edit', key: 'config.misc.control.edit', type: 'button' },
      ],
    },
    // MES 日志关键字监控 / MES 服务挂起监控两功能 2026-11-11 迁出至 monitor-alarm 模块
    // （组+叶子菜单树：配置叶子本期、查看/解决规划），本模块仅余 srv-hang + sys-misc
  ],
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
}

export default configModule
