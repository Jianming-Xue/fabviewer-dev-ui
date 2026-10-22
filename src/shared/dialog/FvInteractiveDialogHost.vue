<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'

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

/* ===== 全局 Esc 仲裁器（2026-10-22 落地定稿）=====
   闪烁正源（VOverlay.js:317 源码考据）：persistent 弹窗收到 Escape，Vuetify 原生不关窗、
   只跑 animateClick()——卡片 scale(1.03) 脉冲 150ms=那一下"闪"。治法不掐事件，改用
   Vuetify 官方开关 no-click-animation（:318 命中即 return）令原生对 Escape 彻底无操作，
   传导全程归还。历史弯路勿再引入：stopImmediatePropagation（治标且误伤菜单原生关闭，
   引发关不掉/幻影点击/底层僵尸吞键连锁）、合成点击代关、CSS 强制可见。
   规则：
   ① 有 v-menu 激活（下拉/日期面板/顶栏菜单——原生 Esc 关闭本来就是对的）→ 不碰；
   ② 语义弹窗盖顶（非本宿主装载）→ 不碰（其基座自听处理）；
   ③ 业务弹窗栈自尾取最后一个 open 置 false——与取消按钮同一模型通路同一动画，逐层关；
      leave ~180ms 内连按不吞键（跳过未出栈僵尸取下一 open 者）。
   v-tooltip 不参与任何让位判定（悬停被动层不响应 Esc，让它挡道=问号上悬停时永远关不掉）。 */
function onEscArbitrate(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.type !== 'keydown') return
  if (document.querySelector('.v-menu.v-overlay--active')) return
  const stack = state.stack
  if (stack.length) {
    // 语义弹窗（非本宿主装载、persistent 同源但走自听兜底）盖在业务栈之上时让位
    if (document.querySelector('.v-dialog.v-overlay--active:not(.fv-stack-dialog)')) return
    for (let i = stack.length - 1; i >= 0; i--) {
      const it = stack[i]
      if (it?.open) {
        it.open = false
        break
      }
    }
  }
}
onMounted(() => window.addEventListener('keydown', onEscArbitrate, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onEscArbitrate, true))
</script>

<template>
  <component
    :is="item.component"
    v-for="item in state.stack"
    :key="item.id"
    :ref="bindInstance(item)"
    class="fv-stack-dialog"
    v-bind="{ ...item.props, escHandledByHost: true }"
    v-model="item.open"
    @resolve="item.result = $event"
    @closed="instances.delete(item.id); finish(item)"
  />
</template>
