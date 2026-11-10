<script setup lang="ts">
/**
 * 全局主操作按钮基座（shared，2026-11-10 按钮收敛批）：页面/弹窗主操作一律用本组件，禁止裸 v-btn。
 * 预设 color="primary"（实底）；语义弹窗 ok 钮等场景经 color prop 覆盖为 success/error/warning/info，
 * 不另立组件。variant/size/block 可覆盖（如 404 页 outlined 描边档、文字钮档）。
 * - 单根薄包装：未声明的 attrs（type="submit"、to="/"、prepend-icon、tooltip activator 的 v-bind、
 *   class 等）自动落到 v-btn；tokens.css 全局按钮规则挂在 .v-btn 类名上，包装后像素不变。
 * - 插槽：默认（文案）+ #prepend/#append 显式转发（FvSearchButton 内芯要用）。
 * - 注意：包装组件自身不得挂含 'bg-'/'text-' 子串的 class（tokens.css 普通钮守卫按子串匹配）。
 */
/** v-btn 变体联合（Vuetify 4 字面量口径） */
type BtnVariant = 'text' | 'flat' | 'elevated' | 'outlined' | 'plain' | 'tonal'

withDefaults(
  defineProps<{
    /** 按钮色；默认主题色实底，语义场景可覆盖（success/error/warning/info） */
    color?: string
    variant?: BtnVariant
    size?: string | number
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    color: 'primary',
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
