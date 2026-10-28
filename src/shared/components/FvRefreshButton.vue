<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * 全局刷新按钮（shared，2026-10-27 抽自 FvTable refresh 内联实现）：
 * 图标钮（fa-rotate-right）+ 悬浮提示，表格/卡片顶刷新等场景通用。
 * `loading` 随调用方取数态原地转圈；tooltip 与 aria-label 默认 common.refresh，label 可覆盖。
 * 水波纹走全局图标按钮口径（浅灰涟漪，tokens 基线）。
 */
withDefaults(
  defineProps<{
    /** 提示与 aria-label 文案（缺省 common.refresh） */
    label?: string
    /** 取数态：原地转圈 */
    loading?: boolean
  }>(),
  { label: undefined, loading: false },
)

const emit = defineEmits<{ click: [] }>()
const { t } = useI18n()
</script>

<template>
  <v-tooltip location="bottom" content-class="vui-table-tip">
    <template #activator="{ props: tipProps }">
      <v-btn
        v-bind="tipProps"
        icon
        variant="text"
        size="small"
        :loading="loading"
        :aria-label="label ?? t('common.refresh')"
        @click="emit('click')"
      >
        <v-icon icon="fas fa-rotate-right" />
      </v-btn>
    </template>
    {{ label ?? t('common.refresh') }}
  </v-tooltip>
</template>
