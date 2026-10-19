import { createRouter, createWebHistory } from 'vue-router'

import { APP_VERSION, getModuleVersion } from '@/modules/registry'
import { setUiVersion } from '@/shared/utils/tx'

import HomeView from '@/app/views/HomeView.vue'
import LoginView from '@/app/views/LoginView.vue'
import FvMainLayout from '@/app/layouts/FvMainLayout.vue'
import { getRoutes } from '@/modules/registry'
import { useAuthStore } from '@/app/stores/auth'

/**
 * 路由：登录页（公共，不在壳层内）+ 主界面（FvMainLayout 包裹，含模块路由）。
 * 守卫：未登录或登录失效 → 登录页（带 redirect 回跳）；已登录访问登录页 → 回首页。
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/change-password',
      name: 'login-change-password',
      component: LoginView,
      meta: { public: true },
    },
    {
      path: '/',
      component: FvMainLayout,
      children: [
        { path: '', name: 'home', component: HomeView, meta: { titleKey: 'nav.home' } },
        ...getRoutes(),
      ],
    },
  ],
})

// 交易头版本上下文（2026-10-17）：txId 末段 = 发起请求的 UI 模块版本（FvModule.version），
// 非模块路由（登录/首页）回退 app 壳版本
router.afterEach((to) => {
  const moduleId = to.meta.moduleId as string | undefined
  setUiVersion(moduleId ? getModuleVersion(moduleId) : APP_VERSION)
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const expired = auth.expireIfNeeded() // 过期就地清理并记录

  if (to.meta.public) {
    return auth.isLoggedIn ? { path: '/' } : true
  }
  if (!auth.isLoggedIn) {
    return {
      path: '/login',
      query: { redirect: to.fullPath, ...(expired ? { reason: 'expired' } : {}) },
    }
  }
  return true
})

export default router
