import type { FvModule } from '@/shared/module'

import zhCN from './i18n/zh-CN'
import enUS from './i18n/en-US'

/**
 * 模块 1 · 日志检索与分析 —— MES Rule 信息检索（功能 1，需求已冻结）
 * 按条件从已落成的 MES 块日志中检索 Rule 信息，回显列表并支持
 * Export / Rule Log（游标式日志弹窗）/ Full Log（文件级 zip 下载）。
 * 自描述 manifest（2026-10-15）：模块名/图标/URL + 功能树（菜单/路由/权限目录由此派生）。
 */
const ruleSearchingModule: FvModule = {
  id: 'rule-searching',
  key: 'ruleSearch.nav.root',
  icon: 'fas fa-magnifying-glass',
  // 模块组 URL 与唯一功能的路由 URL 分离（2026-10-16）：同串会让模块授权串同时成为
  // 功能的"自身授权"，权限树中该行无法呈现被动选中（用户定稿改注册表）
  url: '/log-searching',
  version: '1.0.0',
  order: 10,
  features: [
    {
      id: 'rule-searching.mes-rule-info',
      key: 'ruleSearch.nav.label',
      url: '/log-searching/mes-rule-info',
      order: 10,
      component: () => import('./views/RuleSearchView.vue'),
      // 页内受管控控件（权限系统按 id 管控）
      controls: [
        { id: 'rule-searching.export', key: 'ruleSearch.control.export', type: 'button' },
        { id: 'rule-searching.rule-log', key: 'ruleSearch.control.ruleLog', type: 'button' },
        { id: 'rule-searching.full-log', key: 'ruleSearch.control.fullLog', type: 'button' },
        { id: 'rule-searching.columns', key: 'ruleSearch.control.columns', type: 'button' },
      ],
    },
  ],
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
}

export default ruleSearchingModule
