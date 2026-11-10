<script setup lang="ts">
/**
 * 全局页内警示横条（shared，2026-11-10 收敛批；前身 HANDOVER 缺件记录 FvWarnStrip）：
 * 页面/表格内**持久**内联横幅一律用本组件，禁止裸 v-alert（登录页登出原因、结果表错误态+重试等）。
 * 预设 variant="tonal" + density="compact"；kind → 语义色（info/error/warning/success）；
 * 简讯经 text prop、带标题经 title prop、动作钮（重试等）走默认插槽。
 * 与 FvAlertToastHost 分工：本组件=页内持久横条，toast=瞬时浮层提示。
 * 单根薄包装：class（ma-4/mb-4 等外边距档）等 attrs 自动透传 v-alert。
 */
withDefaults(
  defineProps<{
    /** 语义色档 */
    kind?: 'info' | 'error' | 'warning' | 'success'
    /** 标题行（加粗档） */
    title?: string
    /** 单行简讯（与默认插槽二选一） */
    text?: string
  }>(),
  { kind: 'info', title: undefined, text: undefined },
)
</script>

<template>
  <v-alert :type="kind" variant="tonal" density="compact" :title="title" :text="text">
    <slot />
  </v-alert>
</template>
