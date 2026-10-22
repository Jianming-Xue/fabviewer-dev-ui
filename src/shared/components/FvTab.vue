<script lang="ts">
/** Tab 项（FvTab 消费；title 直传展示文案，i18n 由调用方翻译） */
export interface FvTabItem {
  title: string
  value: string
  disabled?: boolean
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 自绘 Tab 条（2026-10-22）：替代 v-tabs 的轻量分段切换——
 * 契约：v-model = 选中 value；items 数组驱动（禁用项置灰不可点）；
 * 值变化经 defineModel 广播 update:model-value，调用方可挂 @update:model-value 感知用户动作。
 * 本体=裸 Tab 条（恒定档高、仅底边细线，无边框盒）；如需 FvTable 档描边圆角/固定高度的
 * 内容框，由消费方包在下方内容区上（ChangeUserAvatarDialog 口径）。
 * 滑块三段式动画（2026-10-22 定稿）：切换时先从原 Tab 收缩为实心圆（左右半圆端合并），
 * 圆点滑至新 Tab 中心，再展开为新 Tab 宽度；几何由 JS 分阶段下发、CSS 过渡承接。
 * 首挂载即在首个选中项**全展开**落位（offsetLeft/offsetWidth 量测，不吃弹框开合 scale 动画的亏）、
 * 容器尺寸变化瞬时跟随不动画；快速连切自动接管（清旧时序、从当前形态续接）。
 */
const props = defineProps<{ items: FvTabItem[] }>()

const model = defineModel<string>({ required: true })

/* 滑块定档：高 6px、端头全圆角（半径=高/2），收缩到宽=高即成实心圆 */
const BAR_H = 6
const SHRINK_MS = 150
const SLIDE_MS = 240
const EXPAND_MS = 180
const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)'
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

const box = ref<HTMLElement>()
/** 选项 DOM 登记表（模板函数 ref 维护，target() 取当前选中项矩形） */
const itemEls = new Map<string, HTMLElement>()

/** 滑块几何+当前段过渡参数：left/width 相对容器 padding-box；show=false 无当前选中项 */
const bar = ref({ left: 0, width: 0, show: false, dur: '0ms', ease: EASE_OUT })

/** 目标几何：走 offsetLeft/offsetWidth（布局系数值，不受弹框开合 scale 动画的视口变换干扰，
 *  首挂载即按真实档宽展开落位；容器 position:relative 即选项的 offsetParent） */
function target(): { left: number; width: number } | null {
  const el = itemEls.get(model.value)
  const boxEl = box.value
  if (!el || !boxEl || el.offsetParent !== boxEl) return null
  return { left: el.offsetLeft, width: el.offsetWidth }
}

/** 瞬时落位（首挂载/尺寸变化/无历史形态） */
function jump() {
  const t = target()
  bar.value = t ? { left: t.left, width: t.width, show: true, dur: '0ms', ease: 'linear' } : { ...bar.value, show: false }
}

let timers: ReturnType<typeof setTimeout>[] = []
function clearSeq() {
  timers.forEach(clearTimeout)
  timers = []
}

/** 切换编排：①原中心收缩成圆 → ②圆滑至新中心 → ③展开成新宽 */
function morph() {
  clearSeq()
  const t = target()
  if (!t) {
    bar.value = { ...bar.value, show: false }
    return
  }
  if (!bar.value.show) {
    jump()
    return
  }
  const cur = bar.value
  const curCenter = cur.left + cur.width / 2
  const newCenter = t.left + t.width / 2
  bar.value = { left: curCenter - BAR_H / 2, width: BAR_H, show: true, dur: `${SHRINK_MS}ms`, ease: EASE_IN }
  timers.push(
    setTimeout(() => {
      bar.value = { left: newCenter - BAR_H / 2, width: BAR_H, show: true, dur: `${SLIDE_MS}ms`, ease: EASE_OUT }
      timers.push(
        setTimeout(() => {
          bar.value = { left: t.left, width: t.width, show: true, dur: `${EXPAND_MS}ms`, ease: EASE_OUT }
        }, SLIDE_MS),
      )
    }, SHRINK_MS),
  )
}

function bindItemEl(value: string, el: unknown) {
  if (el) itemEls.set(value, el as HTMLElement)
  else itemEls.delete(value)
}

function pick(it: FvTabItem) {
  if (!it.disabled) model.value = it.value
}

let ro: ResizeObserver | null = null
onMounted(() => {
  jump()
  ro = new ResizeObserver(() => jump())
  if (box.value) ro.observe(box.value)
})
onBeforeUnmount(() => {
  clearSeq()
  ro?.disconnect()
  ro = null
})

// 切选项/选项表变化 → DOM 落位后走三段式动画
watch([model, () => props.items], () => void nextTick(morph))
</script>

<template>
  <div ref="box" class="fv-tab" role="tablist">
    <button
      v-for="it in items"
      :key="it.value"
      type="button"
      role="tab"
      class="fv-tab__item"
      :class="{ 'fv-tab__item--on': model === it.value, 'fv-tab__item--off': it.disabled }"
      :aria-selected="model === it.value"
      :disabled="it.disabled"
      :ref="(el) => bindItemEl(it.value, el)"
      @click="pick(it)"
    >
      {{ it.title }}
    </button>
    <span
      v-show="bar.show"
      class="fv-tab__bar"
      :style="{
        left: `${bar.left}px`,
        width: `${bar.width}px`,
        transitionDuration: bar.dur,
        transitionTimingFunction: bar.ease,
      }"
    />
  </div>
</template>

<style scoped>
/* 裸 Tab 条：仅底边细线（Vuetify 边框变量、明暗自适应）；滑块骑压细线（bottom:-1px） */
.fv-tab {
  position: relative;
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.fv-tab__item {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 22px; /* 左右留白放宽（2026-10-22），Tab 间距更透气 */
  border: 0;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.2;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.65;
  cursor: pointer;
  user-select: none;
}

.fv-tab__item:hover:not(.fv-tab__item--on):not(:disabled) {
  opacity: 0.95;
}

.fv-tab__item--on {
  color: rgb(var(--v-theme-primary));
  opacity: 1;
}

.fv-tab__item--off {
  opacity: 0.35;
  cursor: not-allowed;
}

.fv-tab__item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
  border-radius: 6px;
}

/* 底部滑块：高 6px、端头半径=高/2（左右半圆，收缩到宽 6px 即实心圆）；
   left/width 过渡时长与缓动由 JS 按三段式逐段下发（dur/ease 内联样式） */
.fv-tab__bar {
  position: absolute;
  bottom: -1px;
  height: 6px;
  border-radius: 3px;
  background: rgb(var(--v-theme-primary));
  transition-property: left, width;
}
</style>
