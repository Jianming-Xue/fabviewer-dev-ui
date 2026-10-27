<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import FvNotFoundArt from '@/app/images/FvNotFoundArt.vue'

/**
 * 404 页（2026-10-27）：壳层外全屏独立页（与 LoginView 同级待遇，不进 FvMainLayout）。
 * 路由 catch-all `/:pathMatch(.*)*` 指向本页，meta.public + allowAuthed——登录与否都可见
 * （普通 public 路由已登录会被弹回首页，本页经 allowAuthed 豁免，见 router/index.ts）。
 * 动效插画在 app/images/FvNotFoundArt.vue（机器人 404，双主题令牌着色）。
 */
const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <div class="nf-page">
    <div class="nf-card">
      <FvNotFoundArt class="nf-art" />
      <h1 class="nf-title">{{ t('notFound.title') }}</h1>
      <p class="nf-desc">{{ t('notFound.description') }}</p>
      <div class="nf-actions">
        <!-- 普通按钮全局规范：透明底 + 主色边框（outlined primary 即是） -->
        <v-btn variant="outlined" color="primary" to="/" size="large">
          {{ t('notFound.backHome') }}
        </v-btn>
        <v-btn variant="text" color="primary" size="large" @click="router.back()">
          {{ t('notFound.goBack') }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nf-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  /* 主题令牌微渐变：主色淡底 → 布局底色（双主题自适应，零硬编码） */
  background: linear-gradient(160deg, var(--vui-primary-bg), var(--vui-bg-layout) 58%);
}

.nf-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  max-width: 420px;
  width: 100%;
  animation: nf-card-in 0.45s cubic-bezier(0.4, 0, 0.2, 1) both 0.1s;
}

@keyframes nf-card-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nf-art {
  max-width: 360px;
}

.nf-title {
  margin: 8px 0 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--vui-text);
}

.nf-desc {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vui-text-secondary);
}

.nf-actions {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .nf-card {
    animation: none;
  }
}
</style>
