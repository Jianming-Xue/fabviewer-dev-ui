import '@/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './app/router'
import vuetify from './shared/plugins/vuetify'
import { i18n } from './app/i18n'
import { loadRuntimeConfig, setAuthTokenGetter } from '@/shared/api/http'
import { installGlobalErrorGuard } from '@/shared/utils/globalError'
import { useAuthStore } from '@/app/stores/auth'

// 部署期运行时配置（public/app-config.json）先于挂载加载：首请求前 Host 优先级已就位
await loadRuntimeConfig()

const app = createApp(App)

// 全局错误守卫：Vue 渲染错误 / window error / 未处理 Promise 拒绝 → console 留痕 + 节流 Toast
installGlobalErrorGuard(app)

app.use(createPinia())

// Authorization: Bearer 令牌供给（2026-10-29）：shared/http 全服务统一注入；登出/未登录返回空即不挂
setAuthTokenGetter(() => useAuthStore().token)
app.use(router)
app.use(vuetify)
app.use(i18n)

app.mount('#app')
