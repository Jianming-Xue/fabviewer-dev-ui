<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { loadingVisible } from './loadingState'

/**
 * 全局接口 Loading 宿主（App.vue 单例挂载，2026-10-17）：
 * shared/http 请求层在 RequestOptions.loading=true 的调用发出时显示、落定后消失。
 * 覆盖整个页面：z-index 压过 Toast（10000）与一切弹层；Teleport 到 body，
 * 显示期间给 #app 置 inert——页面所有控件（含 Tab 焦点、屏幕阅读器）一律不可交互。
 */
const { t } = useI18n()

watch(loadingVisible, (visible) => {
  document.getElementById('app')?.toggleAttribute('inert', visible)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fv-loading">
      <div v-if="loadingVisible" class="fv-loading-host" role="status" aria-live="polite">
        <div class="fv-loading-inner">
          <v-progress-circular indeterminate :size="44" :width="4" color="primary" />
          <span>{{ t('common.loading') }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fv-loading-host {
  position: fixed;
  inset: 0;
  z-index: 10500; /* 压过 Toast（10000）与全部 Vuetify 弹层：加载期间页面任何控件不可点（用户定稿 2026-10-17） */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 13, 17, 0.42); /* 取 --vui-ripple 同色系，明暗主题通用遮罩 */
  cursor: progress;
  user-select: none;
  touch-action: none; /* 触屏滚动/缩放手势一并吞掉 */
}

.fv-loading-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: #fff;
}

.fv-loading-enter-active,
.fv-loading-leave-active {
  transition: opacity 0.18s ease;
}

.fv-loading-enter-from,
.fv-loading-leave-to {
  opacity: 0;
}
</style>
