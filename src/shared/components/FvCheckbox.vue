<script setup lang="ts">
/**
 * 全局 Checkbox（Fv 族，2026-10-20 用户定稿）：包装 Vuetify v-checkbox（带 label）/
 * v-checkbox-btn（iconOnly 纯勾，树/表格选择列场景），统一规格：
 * - 选中色=主题色：color 固定 primary 内部收口（调用点不传色）；
 * - 悬停不变色：Vuetify 选择控件 hover 圆形垫层（__input::before）已由 tokens.css
 *   全局交互基线统一摘除（同按钮/菜单项不悬停变底），组件不再逐处压制；
 * - 点击反馈=全局浅灰水波纹（.v-selection-control ripple 令牌既有）。
 * density=compact + hide-details 内置；label/v-model/indeterminate/disabled/事件等
 * 经 attrs 原样透传（inheritAttrs:false + v-bind="$attrs" 手动挂到内层，多根安全）。
 */
defineOptions({ inheritAttrs: false })

const props = defineProps<{ iconOnly?: boolean }>()
</script>

<template>
  <v-checkbox-btn v-if="props.iconOnly" color="primary" density="compact" hide-details v-bind="$attrs" />
  <v-checkbox v-else color="primary" density="compact" hide-details v-bind="$attrs" />
</template>
