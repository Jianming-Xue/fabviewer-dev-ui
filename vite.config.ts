import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [vue(), vueDevTools(), vuetify({ autoImport: true })],
    // FV_ 前缀 env 暴露给 import.meta.env（全局后端 Host FV_APP_HOST，2026-10-16）
    envPrefix: ['VITE_', 'FV_'],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // 2026-10-16：请求直连绝对 Host（env FV_APP_HOST + 服务 service 前缀），不走 dev proxy
    server: {},
  }
})
