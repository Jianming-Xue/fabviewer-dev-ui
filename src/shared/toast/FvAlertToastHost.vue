<script setup lang="ts">
import FvAlertToastItem from './FvAlertToastItem.vue'
import { useAlertToast } from './useAlertToast'

/** 全局 Toast 宿主：App.vue 挂载一次；顶部居中纵向堆叠，驻留计时与增删见 useAlertToast */
const { items, dismiss } = useAlertToast()
</script>

<template>
  <div class="vui-toast-host">
    <TransitionGroup name="vui-toast">
      <FvAlertToastItem v-for="it in items" :key="it.id" :item="it" @close="dismiss(it.id)" />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.vui-toast-host {
  position: fixed;
  top: var(--vui-space-4);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000; /* 压过 Vuetify 弹层（对话框/菜单自 2000 递增），弹层内触发的 Toast 仍在最上 */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--vui-space-2);
  pointer-events: none; /* 条带本身不拦截页面点击；单条 Toast 内部恢复 */
}

/* 进出 / 重排统一 --vui-transition 节奏；入场自上方 8px 滑入 */
.vui-toast-enter-active,
.vui-toast-leave-active {
  transition:
    opacity var(--vui-transition),
    transform var(--vui-transition);
}

.vui-toast-enter-from,
.vui-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.vui-toast-leave-active {
  position: absolute; /* 离场项脱流，余下项平滑上移（flex 容器静态位置仍居中） */
}

.vui-toast-move {
  transition: transform var(--vui-transition);
}
</style>
