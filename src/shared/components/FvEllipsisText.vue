<script setup lang="ts">
import { computed } from 'vue'

/**
 * 截断文本（Fv 族，2026-11-09 System Misc 首抽）：纯展示件——
 * 传 `maxChars` 且文本超出时按**字符数**截断加省略号，hover 出 v-tooltip 显全文
 * （System Misc 卡片值 20 字 / 编辑器显示 30 字口径，模块5 · 02 §3.3/§3.5）；
 * 不传 `maxChars` 则整串原样渲染，溢出交给调用方 CSS（如卡片 description 单行省略）。
 * 空值渲染为空串（不占 tooltip）。
 */
const props = withDefaults(
  defineProps<{
    text?: string | null
    /** 截断阈值（字符数）；不传 = 不截断 */
    maxChars?: number
  }>(),
  { text: '', maxChars: undefined },
)

const full = computed(() => props.text ?? '')
const truncated = computed(
  () => props.maxChars !== undefined && full.value.length > props.maxChars,
)
const display = computed(() =>
  truncated.value ? `${full.value.slice(0, props.maxChars)}…` : full.value,
)
</script>

<template>
  <v-tooltip v-if="truncated" location="top" :text="full">
    <template #activator="{ props: tipProps }">
      <span v-bind="tipProps" class="fv-ellipsis-text">{{ display }}</span>
    </template>
  </v-tooltip>
  <span v-else class="fv-ellipsis-text">{{ display }}</span>
</template>

<style scoped>
.fv-ellipsis-text {
  min-width: 0;
}
</style>
