<script setup lang="ts">
import { computed } from 'vue'

/**
 * 全局下拉选择（shared，2026-10-19 定稿）：与 FvTextInput 同族同规格——
 * 边框/焦点主题色/圆角/36px 高全部继承 Vuetify 全局默认（outlined+compact，同 VTextField
 * 走 tokens.css 统一口径），本组件不再逐实例传 variant/density。
 * - mode：'single'（默认）/ 'multiple'
 * - 单选清理（用户定稿 2026-10-19 两次修订）：右侧 clearable 图标清除（默认开启）；
 *   下拉不加空白哨兵行（有清除钮即够）
 * - 多选展示（用户定稿 2026-10-19）：框内最多显示 1 个所选标签，其余以「[+剩余数量]」弱色文本表示；
 *   删除当前标签后下一个已选项自动顶上（chip 按选中序位渲染，天然满足）
 * - prependIcon：框内前缀图标（FA 类名），可选；chip 关闭图标与字段图标同 15px/currentColor 口径
 * - items：字符串数组或 { title, value } 对象数组；rules/hint/error-messages 等经 attrs 透传
 */
const props = withDefaults(
  defineProps<{
    items?: (string | { title: string; value: string })[]
    mode?: 'single' | 'multiple'
    prependIcon?: string
  }>(),
  { items: () => [], mode: 'single', prependIcon: undefined },
)

const model = defineModel<string | string[] | undefined>()

const isMulti = computed(() => props.mode === 'multiple')

const normItems = computed(() =>
  props.items.map((it) => (typeof it === 'object' ? it : { title: String(it), value: String(it) })),
)
const multiCount = computed(() => (Array.isArray(model.value) ? model.value.length : 0))

function onSelect(v: string | string[] | null | undefined) {
  if (isMulti.value) {
    model.value = Array.isArray(v) ? v : []
    return
  }
  model.value = !v ? undefined : (v as string)
}
</script>

<template>
  <v-select
    :model-value="model"
    :items="normItems"
    item-title="title"
    item-value="value"
    :multiple="isMulti"
    :chips="isMulti"
    :closable-chips="isMulti"
    :clearable="!isMulti"
    :prepend-inner-icon="props.prependIcon"
    class="fv-text-select"
    v-bind="$attrs"
    @update:model-value="onSelect"
  >
    <!-- 多选 chip 定制：首项显真实标签（关闭行为经 chip props 透传），第二位显 [+剩余数]，其余不渲染 -->
    <template v-if="isMulti" #chip="{ item, index, props: chipProps }">
      <v-chip v-if="index === 0" v-bind="chipProps" closable size="small" :text="item.title" />
      <span v-else-if="index === 1 && multiCount > 1" class="fv-text-select__overflow">[+{{ multiCount - 1 }}]</span>
    </template>
  </v-select>
</template>

<style scoped>
/* 溢出计数文本：弱化灰（同表格多值 [+N] 观感） */
.fv-text-select__overflow {
  font-size: 12px;
  color: var(--vui-text-secondary);
  white-space: nowrap;
}

/* chip 关闭图标与框内前缀图标同规（用户定稿 2026-10-19）：15px 同尺寸、currentColor 同色
   （Vuetify 4 字段图标即正文色，勿再压灰） */
.fv-text-select :deep(.v-chip__close),
.fv-text-select :deep(.v-chip__close .v-icon) {
  font-size: 15px;
  width: 15px;
  height: 15px;
}
</style>
