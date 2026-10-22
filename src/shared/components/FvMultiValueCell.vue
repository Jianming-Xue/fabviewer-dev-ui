<script setup lang="ts">
import { computed } from 'vue'

/** 多值字段展示（模块 1 · 01 §3.5；用户定稿 2026-10-19 v5，Fv 前缀同定稿）：
 *  一律主题色标签显示首值 + 「[+值的总数−1]」——单值=[+0]；
 *  **空值=整格空白不渲染**（2026-10-22 改版，原「空标签+[+0]」废止）；
 *  多值悬停多行展开全部值（空/单值无可展开、不挂 tooltip）。
 *  经 FvTable header-type="multiValue" 内置使用，也可独立挂载。 */
const props = defineProps<{ values: string[] | string | undefined }>()

const list = computed<string[]>(() => {
  if (!props.values) return []
  const arr = Array.isArray(props.values) ? props.values : [props.values]
  return arr.filter((v) => v !== '' && v != null)
})
const first = computed(() => list.value[0] ?? '')
</script>

<template>
  <v-tooltip v-if="list.length > 1" location="top" max-width="480" content-class="vui-table-tip">
    <template #activator="{ props: tooltipProps }">
      <span v-bind="tooltipProps" class="d-inline-flex align-center ga-1">
        <v-chip size="small" label color="primary" class="vui-mono">{{ first }}</v-chip>
        <span class="vui-multi-count text-body-2">[+{{ list.length - 1 }}]</span>
      </span>
    </template>
    <div class="vui-mono" style="white-space: pre-line; font-size: 12px">
      {{ list.join('\n') }}
    </div>
  </v-tooltip>
  <span v-else-if="list.length === 1" class="d-inline-flex align-center ga-1">
    <v-chip size="small" label color="primary" class="vui-mono">{{ first }}</v-chip>
    <span class="vui-multi-count text-body-2">[+0]</span>
  </span>
  <!-- 空值=不渲染（2026-10-22 用户定稿）：列表格保持全空，不再摆空标签+[+0] -->
</template>

<style scoped>
/* 总数角标文字：弱化灰，与主题色标签拉开层次 */
.vui-multi-count {
  color: var(--vui-text-secondary);
}
</style>
