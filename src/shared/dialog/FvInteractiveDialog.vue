<script setup lang="ts">
import FvBaseDialog from './FvBaseDialog.vue'

/**
 * FvInteractiveDialogHost 体系 · 业务弹窗基类（用户定稿 2026-10-16）。
 * Dialog 层级三分——
 *   FvBaseDialog（全局基座：三区布局/拖动/开合动画/尺寸上限；仅「派生 Dialog 基类」可继承）
 *     ├─ FvModalDialogHost（语义弹窗基类：成功/错误/警告/信息/确认，useModalDialog 消费）
 *     └─ FvInteractiveDialog（本组件：业务弹窗基类）← 普通业务弹窗一律继承本组件
 * 业务弹窗经 openInteractiveDialog() 编程式打开、由 FvInteractiveDialogHost（App.vue 挂载的
 * 单例宿主）承载：props 进 / resolve 出 / 排队。
 * 本组件纯透传：props、插槽、v-model、@closed 契约与 FvBaseDialog 完全一致，不加任何额外行为。
 */
withDefaults(
  defineProps<{
    /** 标题文案（需完全自定义标题区时用 #title 插槽覆盖） */
    title?: string
    /** 标题前缀图标（FA 类名）；颜色经 --vui-dialog-icon 变量由调用方下发 */
    titleIcon?: string
    /** 弹窗最大宽度（px） */
    maxWidth?: number
    /** 标题居中（默认左对齐；拖动能力不受影响） */
    centerTitle?: boolean
    /** 遮罩透明度（Vuetify 默认 0.32；调大 = 遮罩加深，如 0.5） */
    scrimOpacity?: number
    /** 整卡最小高度（px，透传基座）：字段多的表单弹窗用更舒展的固定档 */
    minHeight?: number
    /** 整卡最大高度（CSS 长度，透传基座）：缺省 80vh，字段多的表单弹窗可放大自适应范围 */
    maxHeight?: string
  }>(),
  { title: '', maxWidth: 420, centerTitle: false, scrimOpacity: undefined, minHeight: undefined, maxHeight: undefined },
)

const open = defineModel<boolean>({ required: true })

/** 关闭广播：透传基座 @closed——宿主 finish() 与调用方「关闭清空」都依赖此契约 */
const emit = defineEmits<{ closed: [] }>()
</script>

<template>
  <FvBaseDialog
    v-model="open"
    :title="title"
    :title-icon="titleIcon"
    :max-width="maxWidth"
    :center-title="centerTitle"
    :scrim-opacity="scrimOpacity"
    :min-height="minHeight"
    :max-height="maxHeight"
    @closed="emit('closed')"
  >
    <!-- 条件转发：未提供插槽时必须让基座自己的默认内容（标题回退等）生效 -->
    <template v-if="$slots.title" #title><slot name="title" /></template>
    <slot />
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </FvBaseDialog>
</template>
