<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { useInteractiveDialogLauncher } from './openInteractiveDialog'

/**
 * 编程式弹窗宿主（App.vue 挂载一次）：渲染 openInteractiveDialog() 打开的弹窗组件，
 * 按 v-model / @resolve / @closed 契约接线（见 openInteractiveDialog.ts 注释）。
 * 运行时守卫：openInteractiveDialog 只接受组合了 FvBaseDialog 的组件——打开后在
 * **本组件实例的 DOM 子树**里检测不到基座卡片（.vui-base-dialog）即报错并自动关闭
 * （类型层约束之外的兜底；按子树判定，不误认其他宿主正开着的基座弹窗）。
 */
const { state, finish } = useInteractiveDialogLauncher()

/** 当前渲染的弹窗组件实例的根元素（$el = v-dialog 根元素，含遮罩与卡片） */
const currentEl = ref<Element | null>(null)

/** 模板方法 ref：优先拿组件实例根元素（v-dialog 会把根传给 $el）。
 *  script-setup 未 defineExpose 或多根（fragment）组件拿不到 Element → null，
 *  守卫退回全局查找，不误杀合法弹窗 */
function setCurrentInstance(v: unknown) {
  const el = (v as { $el?: unknown } | null)?.$el ?? v
  currentEl.value = el instanceof Element ? el : null
}

/** 基座卡片存在性：scoped（本组件子树）优先，拿不到实例时全局兜底 */
function hasFvBaseDialog(): boolean {
  return !!currentEl.value?.querySelector('.vui-base-dialog') || !!document.querySelector('.vui-base-dialog')
}

watch(
  () => state.current,
  async (dialog) => {
    if (!dialog) return
    await nextTick()
    await new Promise((r) => requestAnimationFrame(r))
    if (state.current === dialog && !hasFvBaseDialog()) {
      console.error('[openInteractiveDialog] 目标组件不是基于 FvBaseDialog 的弹窗，已自动关闭')
      finish()
    }
  },
)
</script>

<template>
  <component
    :is="state.current.component"
    :ref="setCurrentInstance"
    v-if="state.current"
    v-bind="state.current.props"
    v-model="state.current.open"
    @resolve="state.current.result = $event"
    @closed="finish"
  />
</template>
