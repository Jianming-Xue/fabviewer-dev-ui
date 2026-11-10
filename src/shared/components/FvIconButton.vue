<script setup lang="ts">
/**
 * 全局图标按钮基座（shared，2026-11-10 按钮收敛批）：纯图标钮一律用本组件，禁止裸 v-btn。
 * 预设 icon + variant="text" + size="small"（全局图标钮现状口径）；语义色经 color 透传
 * （如表格删除钮 error、勾选钮 primary），不另立组件。
 * - 给 icon 即内置渲染 <v-icon>（iconSize 调尺寸）；复杂内容（头像/分页页码/特殊尺寸图标）走默认插槽。
 * - 单根薄包装：未声明的 attrs（tooltip/menu activator 的 v-bind、aria-label、density、ripple、
 *   type、class 等）自动落到 v-btn；tokens.css 全局按钮规则挂在 .v-btn 类名上，包装后像素不变。
 * - label → aria-label（无障碍）；调用方直接传 aria-label 亦可（attrs 覆盖本绑定）。
 * - 注意：包装组件自身不得挂含 'bg-'/'text-' 子串的 class（tokens.css 普通钮守卫按子串匹配）。
 */
/** v-btn 变体联合（Vuetify 4 字面量口径） */
type BtnVariant = 'text' | 'flat' | 'elevated' | 'outlined' | 'plain' | 'tonal'

withDefaults(
  defineProps<{
    /** 图标名（fa 字体口径）；给了即内置渲染 v-icon */
    icon?: string
    /** 内置图标尺寸（配合 icon prop；缺省走 v-icon 默认） */
    iconSize?: string | number
    /** 无障碍文案 → aria-label */
    label?: string
    size?: string | number
    variant?: BtnVariant
    color?: string
    loading?: boolean
    disabled?: boolean
  }>(),
  {
    icon: undefined,
    iconSize: undefined,
    label: undefined,
    size: 'small',
    variant: 'text',
    color: undefined,
    loading: false,
    disabled: false,
  },
)
</script>

<template>
  <v-btn
    icon
    :variant="variant"
    :size="size"
    :color="color"
    :loading="loading"
    :disabled="disabled"
    :aria-label="label"
  >
    <slot>
      <v-icon v-if="icon" :icon="icon" :size="iconSize" />
    </slot>
  </v-btn>
</template>
