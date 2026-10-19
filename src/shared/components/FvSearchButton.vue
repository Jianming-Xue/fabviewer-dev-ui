<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * 全局搜索按钮（shared，2026-10-15）：主题色实底 + 搜索图标。
 * type="submit"——置于 v-form / form 内时，输入框按 Enter 即触发本按钮 click（原生表单语义）；
 * 按钮自身聚焦时按 Enter 亦触发（原生按钮行为）。文案默认词典 common.search，可用 label/插槽覆盖。
 */
withDefaults(defineProps<{ label?: string }>(), { label: undefined })

const emit = defineEmits<{ click: [] }>()
const { t } = useI18n()
</script>

<template>
  <v-btn type="submit" color="primary" @click="emit('click')">
    <template #prepend>
      <v-icon icon="fas fa-magnifying-glass" size="15" />
    </template>
    <slot>{{ label ?? t('common.search') }}</slot>
  </v-btn>
</template>
