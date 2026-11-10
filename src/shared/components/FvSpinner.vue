<script setup lang="ts">
/**
 * 全局取数转圈（shared，2026-11-10 收敛批）：列表/日志pane/卡片内联取数态一律用本组件，禁止裸 v-progress-circular。
 * 预设 indeterminate + color=primary + size=24 + width=2（System Misc 卡内联档，用户定稿口径）；
 * 小档（日志 pane 20）/大档（全局遮罩 FvLoadingHost 44/4）经 prop 覆盖。
 */
withDefaults(
  defineProps<{
    size?: string | number
    width?: string | number
    color?: string
  }>(),
  { size: 24, width: 2, color: 'primary' },
)
</script>

<template>
  <v-progress-circular indeterminate :size="size" :width="width" :color="color" />
</template>
