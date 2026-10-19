<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * 全局新增按钮（shared，2026-10-15）：主题色实底圆形 + 加号图标。
 * 32px（标准 48 的 2/3，用户调优 2026-10-15）；圆形需 !important 覆盖
 * tokens.css 的全局按钮圆角（6px 控件档）。水波纹走全局图标按钮口径（浅灰涟漪）。
 */
withDefaults(defineProps<{ label?: string }>(), { label: undefined })

const emit = defineEmits<{ click: [] }>()
const { t } = useI18n()
</script>

<template>
  <v-btn
    icon
    :size="32"
    color="primary"
    :ripple="true"
    :aria-label="label ?? t('common.add')"
    class="vui-new-btn"
    @click="emit('click')"
  >
    <v-icon icon="fas fa-plus" size="12" />
  </v-btn>
</template>

<style scoped>
.vui-new-btn {
  border-radius: 50% !important; /* 覆盖全局按钮 6px 圆角（tokens.css !important） */
}
</style>
