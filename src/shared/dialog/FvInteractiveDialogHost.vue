<script setup lang="ts">
import { nextTick, watch } from 'vue'

import { useInteractiveDialogLauncher } from './openInteractiveDialog'

/**
 * 编程式弹窗宿主（App.vue 挂载一次）：渲染 openInteractiveDialog() 打开的弹窗组件栈
 * （层叠语义 2026-10-20：后开叠上、关闭出栈，支持弹窗内开子弹窗），
 * 按 v-model / @resolve / @closed 契约接线（见 openInteractiveDialog.ts 注释）。
 * 运行时守卫：openInteractiveDialog 只接受组合了 FvBaseDialog 的组件——打开后在
 * **该弹窗实例的 DOM 子树**里检测不到基座卡片（.vui-base-dialog）即报错并自动关闭
 * （类型层约束之外的兜底；拿不到实例根元素时退回全局查找）。
 */
const { state, finish, topDialog } = useInteractiveDialogLauncher()

interface StackItem {
  id: number
}

/** 各弹窗组件实例的根元素（$el = v-dialog 根元素，含遮罩与卡片；v-for 下按 id 归档） */
const instances = new Map<number, Element | null>()

/** 模板方法 ref：优先拿组件实例根元素（v-dialog 会把根传给 $el）。
 *  script-setup 未 defineExpose 或多根（fragment）组件拿不到 Element → null，
 *  守卫退回全局查找，不误杀合法弹窗 */
function setInstance(item: StackItem, v: unknown) {
  const el = (v as { $el?: unknown } | null)?.$el ?? v
  instances.set(item.id, el instanceof Element ? el : null)
}

/** 模板 ref 工厂（模板表达式不容 TS 注解，参数类型在此收口） */
function bindInstance(item: StackItem) {
  return (v: unknown) => setInstance(item, v)
}

/** 基座卡片存在性：scoped（该实例子树）优先，拿不到实例时全局兜底 */
function hasFvBaseDialog(item: StackItem): boolean {
  return !!instances.get(item.id)?.querySelector('.vui-base-dialog') || !!document.querySelector('.vui-base-dialog')
}

// 新栈顶出现时守卫：下一帧仍未渲染出基座卡片 → 报错并关闭该弹窗
watch(
  () => topDialog()?.id ?? 0,
  async (id) => {
    if (!id) return
    await nextTick()
    await new Promise((r) => requestAnimationFrame(r))
    const cur = topDialog()
    if (cur && cur.id === id && !hasFvBaseDialog(cur)) {
      console.error('[openInteractiveDialog] 目标组件不是基于 FvBaseDialog 的弹窗，已自动关闭')
      finish(cur)
    }
  },
)
</script>

<template>
  <component
    :is="item.component"
    v-for="item in state.stack"
    :key="item.id"
    :ref="bindInstance(item)"
    v-bind="item.props"
    v-model="item.open"
    @resolve="item.result = $event"
    @closed="instances.delete(item.id); finish(item)"
  />
</template>
