<script setup lang="ts">
/**
 * 全局页面容器卡（shared，2026-11-10 收敛批）：页面/区块容器一律用本组件，禁止裸 v-card。
 * 预设 elevation="0"（页面卡统一无阴影，用户定稿 2026-10-14 口径）；border  opting-in——
 * 搜索卡/结果表外框等描边形态传 `border`，布局卡/表格内卡不传；
 * 圆角走 tokens.css `.v-card` 10px !important 全局档，本组件不另设。
 * 单根薄包装：class / :key 等 attrs 自动透传 v-card。
 */
withDefaults(defineProps<{ border?: boolean }>(), { border: false })
</script>

<template>
  <v-card elevation="0" :border="border">
    <slot />
  </v-card>
</template>
