<script setup lang="ts">
/**
 * 告警优先级徽标（模块2 · 01 §3.2 / 03 §3.2，2026-11-10 新建）：
 * P1 红 / P2 橙 / P3 黄 / P4 灰——两配置页表格 Priority 列共用，后续告警展示页（模块2 · 04）
 * 落地时沿用同一色板（文档口径「与运行展示页同色板」）。未知值兜底灰、空值灰 -。
 * 模块级小组件（消费方均在 config 模块内，按 shared/Fv 门槛惯例不升 shared）。
 */
const props = defineProps<{ priority?: string | null }>()

const COLORS: Record<string, string> = {
  P1: 'error',
  P2: 'warning',
  P3: 'yellow-darken-2',
  P4: 'grey',
}
</script>

<template>
  <v-chip
    v-if="props.priority"
    size="small"
    label
    variant="flat"
    :color="COLORS[props.priority] ?? 'grey'"
    class="apb"
  >
    {{ props.priority }}
  </v-chip>
  <span v-else class="apb__dash">-</span>
</template>

<style scoped>
.apb {
  font-variant-numeric: tabular-nums;
}

.apb__dash {
  color: var(--vui-text-secondary);
}
</style>
