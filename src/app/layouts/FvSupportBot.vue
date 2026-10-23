<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 全局客服悬浮球（FvSupportBot，2026-10-22 先行造型稿，聊天功能后补）：
 * 主界面右下角圆形浮钮（52px，当日由 64 收小），机器人图标=缺省闭眼、悬停睁眼、移开回闭眼（CSS 眼组透明度互换）；
 * 可拖拽沿视口下缘/右缘滑动——拖动时就近吸附到边距更近的那条边（另一边贴边），
 * 位置只有一维自由度，天然不会飘离边缘；未移动直接松手=点击（后续接客服会话开合）。
 * 贴边留 10px 呼吸位；resize 时钳回可视范围；弹窗/遮罩层级恒压其上（overlay z≈2400）。
 */
const SIZE = 52
const EDGE_GAP = 10

const { t } = useI18n()

type DockMode = 'right' | 'bottom'
const dock = ref<DockMode>('right')
/** 贴边滑位（right 档=视口 y / bottom 档=视口 x，px） */
const along = ref(0)
const dragging = ref(false)

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi))
}

function applyInitial() {
  dock.value = 'right'
  along.value = clamp(window.innerHeight - SIZE - EDGE_GAP, EDGE_GAP, window.innerHeight - SIZE - EDGE_GAP)
}

/* 拖拽：按下记录起点，位移 >4px 才算拖（避免误吞点击）；全程只随指针改吸附边与滑位 */
let start = { x: 0, y: 0, moved: false }

function onPointerDown(e: PointerEvent) {
  start = { x: e.clientX, y: e.clientY, moved: false }
  dragging.value = true
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  if (!start.moved) {
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 4) return
    start.moved = true
  }
  e.preventDefault()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cx = e.clientX - SIZE / 2
  const cy = e.clientY - SIZE / 2
  // 就近吸附：距右缘 vs 距下缘，输者贴边、赢轴跟指针
  if (vw - (cx + SIZE) <= vh - (cy + SIZE)) {
    dock.value = 'right'
    along.value = clamp(cy, EDGE_GAP, vh - SIZE - EDGE_GAP)
  } else {
    dock.value = 'bottom'
    along.value = clamp(cx, EDGE_GAP, vw - SIZE - EDGE_GAP)
  }
}

function onPointerUp() {
  dragging.value = false
  // start.moved=false 即纯点击：客服会话功能接入处（TODO 后补）
}

const fabStyle = computed(() => {
  return dock.value === 'right'
    ? { right: `${EDGE_GAP}px`, top: `${along.value}px` }
    : { bottom: `${EDGE_GAP}px`, left: `${along.value}px` }
})

function onResize() {
  const span = dock.value === 'right' ? window.innerHeight : window.innerWidth
  along.value = clamp(along.value, EDGE_GAP, span - SIZE - EDGE_GAP)
}

onMounted(() => {
  applyInitial()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <button
    type="button"
    class="fv-support-bot"
    :class="{ 'fv-support-bot--drag': dragging }"
    :style="fabStyle"
    :title="t('app.support')"
    :aria-label="t('app.support')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- 机器人头（自绘内联 SVG，currentColor 随钮前景）：闭眼=双弧线，睁眼=双圆点 -->
    <svg
      viewBox="0 0 24 24"
      width="30"
      height="30"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="7.5" width="17" height="12.5" rx="3.2" />
      <line x1="12" y1="7.5" x2="12" y2="4.4" />
      <circle cx="12" cy="3.3" r="1.1" fill="currentColor" stroke="none" />
      <!-- 闭眼（缺省）：两条大眠弧 ∩，粗圆头描边 -->
      <g class="fv-support-bot__eyes fv-support-bot__eyes-closed" stroke-width="2.2">
        <path d="M5 13.6a3.4 3.4 0 0 1 6.8 0" />
        <path d="M12.2 13.6a3.4 3.4 0 0 1 6.8 0" />
      </g>
      <!-- 睁眼（hover）：两只大白眼+主题色瞳仁（瞳色=钮底色，视觉上“镂空”） -->
      <g class="fv-support-bot__eyes fv-support-bot__eyes-open" fill="currentColor" stroke="none">
        <circle cx="8.4" cy="12.9" r="3.4" />
        <circle cx="15.6" cy="12.9" r="3.4" />
        <circle class="fv-support-bot__pupil" cx="8.4" cy="12.9" r="1.5" />
        <circle class="fv-support-bot__pupil" cx="15.6" cy="12.9" r="1.5" />
      </g>
      <line x1="10.1" y1="16.9" x2="13.9" y2="16.9" />
    </svg>
  </button>
</template>

<style scoped>
.fv-support-bot {
  position: fixed;
  z-index: 1100;
  width: 52px;
  height: 52px;
  padding: 0;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  cursor: pointer;
  user-select: none;
  touch-action: none; /* 触屏拖动不被页面滚动劫持 */
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.28),
    0 2px 4px rgba(0, 0, 0, 0.2);
  transition:
    top 0.18s ease,
    right 0.18s ease,
    bottom 0.18s ease,
    left 0.18s ease,
    box-shadow 0.2s ease;
}

/* 拖拽中关位置过渡：钮跟手不拖影 */
.fv-support-bot--drag {
  transition: box-shadow 0.2s ease;
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.36),
    0 3px 6px rgba(0, 0, 0, 0.24);
}

.fv-support-bot:hover {
  box-shadow:
    0 8px 20px rgba(0, 0, 0, 0.32),
    0 2px 6px rgba(0, 0, 0, 0.22);
}

/* 眼组悬停互换：缺省闭眼，hover 睁眼，移开回闭眼 */
.fv-support-bot__eyes {
  transition: opacity 0.15s ease;
}

.fv-support-bot__eyes-open {
  opacity: 0;
}

.fv-support-bot:hover .fv-support-bot__eyes-open {
  opacity: 1;
}

.fv-support-bot:hover .fv-support-bot__eyes-closed {
  opacity: 0;
}

/* 瞳仁取钮底色（主题 primary），大白眼上呈“镂空”瞳效果 */
.fv-support-bot__pupil {
  fill: rgb(var(--v-theme-primary));
}
</style>
