<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import FvIconButton from './FvIconButton.vue'

/**
 * 全局新增按钮（shared，2026-10-15；2026-11-10 换基 FvIconButton，对外 API/视觉不变）：
 * 主题色实底圆形 + 加号图标。32px（标准 48 的 2/3，用户调优 2026-10-15）；
 * 圆形需 !important 覆盖 tokens.css 的全局按钮圆角（6px 控件档）。
 * 水波纹走全局图标按钮口径（浅灰涟漪）。
 * **variant 必须显式覆盖**（2026-11-10 用户报圆形底色丢）：FvIconButton 基座默认 variant=text
 * （透明底+着色图标），换基后不覆盖则主题色实底圆形退化为透明圈绿加号；
 * **取 elevated 而非 flat**（2026-11-11 用户报「没有立体感」）：投影口径对齐 FvPrimaryButton
 * （其 variant 缺省走 v-btn 默认 elevated 带 Vuetify 投影），flat 无投影缺立体感。
 */
withDefaults(defineProps<{ label?: string }>(), { label: undefined })

const emit = defineEmits<{ click: [] }>()
const { t } = useI18n()
</script>

<template>
  <FvIconButton
    icon="fas fa-plus"
    :icon-size="12"
    :size="32"
    variant="elevated"
    color="primary"
    :ripple="true"
    :label="label ?? t('common.add')"
    class="vui-new-btn"
    @click="emit('click')"
  />
</template>

<style scoped>
.vui-new-btn {
  border-radius: 50% !important; /* 覆盖全局按钮 6px 圆角（tokens.css !important） */
}
</style>
