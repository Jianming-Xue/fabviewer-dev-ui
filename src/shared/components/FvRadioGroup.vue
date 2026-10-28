<script setup lang="ts" generic="T extends string | number | boolean = string">
/**
 * 全局 RadioGroup（Fv 族，2026-10-27 基础件）：包装 Vuetify v-radio-group，统一规格同 FvCheckbox 族——
 * - 选中色内部收口（子项 FvRadio 固定 primary，调用点不传色）；
 * - density=compact + hide-details 内置；inline 等其余属性经 attrs 透传（inheritAttrs:false）；
 * - v-model 泛型随调用方（字面量联合等精确回流）；初值由调用方提供（单选语义恒有选中项）；
 * - 子项用 FvRadio 声明（value 定选项）。
 * Label 按 FvTextInput 同套组织（2026-10-27 用户定稿）：`label` prop 渲染组标题（控件上方左对齐），
 * `required` 红星 / `hint`+`showHint` 问号 tooltip 同字段规范；**label 为空则整行不渲染**；
 * 需完全客制标题时仍可以 #label 插槽覆盖。
 * 悬停不变色 / 浅灰水波纹由 tokens.css 全局交互基线统一保证。
 */
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    /** 组标题（FvTextInput 同套组织）；空/不传 = 不渲染标题行 */
    label?: string
    /** 必填标志：label 前红星（单选恒有值场景一般不挂） */
    required?: boolean
    /** 提示词文案（经问号图标 tooltip 展示） */
    hint?: string
    /** 带提示词开关：true 且 hint 非空时 label 后显示问号图标 */
    showHint?: boolean
  }>(),
  { label: undefined, required: false, hint: undefined, showHint: false },
)

const model = defineModel<T>({ set: (v) => v as T })
</script>

<template>
  <v-radio-group v-model="model" density="compact" hide-details v-bind="$attrs">
    <template v-if="label || $slots.label" #label>
      <slot name="label">
        <span v-if="required" class="fv-field__required-star">*</span>
        <span>{{ label }}</span>
        <v-tooltip v-if="showHint && hint" :text="hint" content-class="vui-table-tip">
          <template #activator="{ props: tipProps }">
            <span v-bind="tipProps" class="fv-field__hint-icon"><v-icon size="13">fas fa-circle-question</v-icon></span>
          </template>
        </v-tooltip>
      </slot>
    </template>
    <slot />
  </v-radio-group>
</template>
