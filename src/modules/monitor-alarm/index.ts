import type { FvModule } from '@/shared/module'

import zhCN from './i18n/zh-CN'
import enUS from './i18n/en-US'

/**
 * 模块 · 监控告警（2026-11-11 用户定稿新建：自 config 模块搬迁 MES 日志关键字监控 /
 * MES 服务挂起监控两功能，并改**组+叶子**菜单树）：
 * - 二级组：MES日志关键字监控 / MES服务挂起监控（功能组无路由，children 承载叶子）；
 * - 三级叶子：本期仅「配置」（原页面整体迁入，URL 换 /monitor-alarm/<域>/config）；
 *   **查看 / 解决叶子规划中**（用户定稿预留位，落地时往 children 追加即可）；
 * - 菜单级权限（文档 §3.1：无细粒度只读/编辑之分，不注册 controls，两域同口径）。
 * 自描述 manifest：模块名/图标/URL + 功能树（菜单/路由/权限目录由此派生，registry 聚合）。
 */
const monitorAlarmModule: FvModule = {
  id: 'monitor-alarm',
  key: 'monitorAlarm.nav.root',
  icon: 'fas fa-bell',
  url: '/monitor-alarm',
  version: '1.0.0',
  order: 30,
  features: [
    {
      // 功能组（无路由）：MES 日志关键字监控（模块2 · 01）
      id: 'monitor-alarm.log-monitor',
      key: 'monitorAlarm.logMonitor.nav.label',
      order: 10,
      children: [
        {
          id: 'monitor-alarm.log-monitor.config',
          key: 'monitorAlarm.logMonitor.nav.config',
          url: '/monitor-alarm/log-monitor/config',
          order: 10,
          component: () => import('./views/LogMonitorCfgView.vue'),
        },
        // 规划中：查看 / 解决叶子（用户定稿预留）
      ],
    },
    {
      // 功能组（无路由）：MES 服务挂起监控（模块2 · 03）
      id: 'monitor-alarm.srv-hang-monitor',
      key: 'monitorAlarm.srvHangMonitor.nav.label',
      order: 20,
      children: [
        {
          id: 'monitor-alarm.srv-hang-monitor.config',
          key: 'monitorAlarm.srvHangMonitor.nav.config',
          url: '/monitor-alarm/srv-hang-monitor/config',
          order: 10,
          component: () => import('./views/SrvHangMonitorCfgView.vue'),
        },
        // 规划中：查看 / 解决叶子（用户定稿预留）
      ],
    },
  ],
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
}

export default monitorAlarmModule
