<script setup lang="ts">
/**
 * 全局普通按钮基座（shared，2026-11-10 按钮收敛批）：非主操作、非纯图标的文字钮一律用本组件，
 * 禁止裸 v-btn（弹窗取消/关闭、重置、Export、outlined 次按钮等）。
 * 不预设 color——吃 tokens.css 全局普通钮档（透明底 + 主色边框，用户定稿 2026-10-14）；
 * 语义色文字钮（如错误态重试 color=error）经 color/variant 透传覆盖，不另立组件。
 * - 单根薄包装：未声明的 attrs（type、to、prepend-icon、tooltip activator 的 v-bind、class 等）
 *   自动落到 v-btn；tokens.css 全局按钮规则挂在 .v-btn 类名上，包装后像素不变。
 * - 插槽：默认（文案）+ #prepend/#append 显式转发。
 * - 注意：包装组件自身不得挂含 'bg-'/'text-' 子串的 class（tokens.css 普通钮守卫按子串匹配）。
 */
/** v-btn 变体联合（Vuetify 4 字面量口径） */
type BtnVariant = 'text' | 'flat' | 'elevated' | 'outlined' | 'plain' | 'tonal'

withDefaults(
  defineProps<{
    /** 按钮色；默认不指定（无色档=透明底+主色边框），语义场景可覆盖（error 等） */
    color?: string
    variant?: BtnVariant
    size?: string | number
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    color: undefined,
    variant: undefined,
    size: undefined,
    block: false,
    loading: false,
    disabled: false,
  },
)
</script>

<template>
  <v-btn
    :color="color"
    :variant="variant"
    :size="size"
    :block="block"
    :loading="loading"
    :disabled="disabled"
  >
    <template v-if="$slots.prepend" #prepend><slot name="prepend" /></template>
    <slot />
    <template v-if="$slots.append" #append><slot name="append" /></template>
  </v-btn>
</template>
