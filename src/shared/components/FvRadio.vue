<script setup lang="ts">
/**
 * 全局 Radio（Fv 族，2026-10-27 基础件）：包装 Vuetify v-radio，统一规格同 FvCheckbox 族——
 * - 选中色=主题色：color 固定 primary 内部收口（调用点不传色）；
 * - 圆形选择框收小 + 未选中环同主题色（2026-10-27 用户定稿）：wrapper 20px / 图形 16px，
 *   空心/实心区分选中态；禁用态不染主题色；
 * - 悬停不变色 / 浅灰水波纹：tokens.css 全局交互基线统一保证，组件不逐处压制；
 * - density=compact + hide-details 内置（组内亦随 FvRadioGroup 下发同档）；
 * - value/label/#label 插槽等经 attrs 原样透传（inheritAttrs:false 手动挂内层）；
 *   置于 FvRadioGroup 内时 v-model 由组接管（Vuetify provide/inject），单件不挂模型。
 */
defineOptions({ inheritAttrs: false })
</script>

<template>
  <v-radio color="primary" density="compact" hide-details v-bind="$attrs">
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>
  </v-radio>
</template>

<style scoped>
/* 圆形选择框收小 + 图形主题色（用户定稿 2026-10-27）：wrapper 20px、图形 16px；
   未选中环与选中实心同用主题色（空心/实心区分选中态）；禁用态回落继承色不染主题 */
.v-radio:not(.v-selection-control--disabled) :deep(.v-selection-control__input > .v-icon) {
  font-size: 16px;
  color: rgb(var(--v-theme-primary));
}

.v-radio :deep(.v-selection-control__wrapper) {
  width: 20px;
  height: 20px;
}
</style>
