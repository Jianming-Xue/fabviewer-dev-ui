import type { FvModule } from '@/shared/module'

import zhCN from './i18n/zh-CN'
import enUS from './i18n/en-US'

/**
 * 用户和安全管理（2026-10-15 新增）：用户管理 / 角色管理 / 登录策略管理。
 * 角色管理已实现（角色 ID/名称/描述/启用 + 功能控件权限树）；另两个功能占位。
 */
const securityModule: FvModule = {
  id: 'security',
  key: 'security.nav.root',
  icon: 'fas fa-shield-halved',
  url: '/security',
  version: '1.0.0',
  order: 15,
  features: [
    {
      id: 'security.users',
      key: 'security.nav.users',
      url: '/security/users',
      order: 10,
      component: () => import('./views/UserManagementView.vue'),
      controls: [
        { id: 'security.users.new', key: 'security.users.ctlNew', type: 'button' },
        { id: 'security.users.edit', key: 'security.users.ctlEdit', type: 'button' },
        { id: 'security.users.delete', key: 'security.users.ctlDelete', type: 'button' },
      ],
    },
    {
      id: 'security.roles',
      key: 'security.nav.roles',
      url: '/security/roles',
      order: 20,
      component: () => import('./views/RoleManagementView.vue'),
      controls: [
        { id: 'security.roles.new', key: 'security.control.add', type: 'button' },
        { id: 'security.roles.edit', key: 'security.control.edit', type: 'button' },
        { id: 'security.roles.delete', key: 'security.control.delete', type: 'button' },
      ],
    },
    {
      id: 'security.login-policy',
      key: 'security.nav.loginPolicy',
      url: '/security/login-policy',
      order: 30,
      component: () => import('./views/LoginPolicyView.vue'),
      controls: [],
    },
  ],
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
}

export default securityModule
