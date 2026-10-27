<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * 全局客服悬浮球（FvSupportBot，2026-10-22 先行造型稿，聊天功能后补）：
 * 主界面右下角圆形浮钮（52px，当日由 64 收小）；机器人图标（2026-10-27 用户提供 iconfont 造型定稿）=
 * 实心剪影（底座+双耳+天线头壳），静止=闭眼眠弧（∩ 镂空带）、悬停=睁眼圆孔（iconfont 原 path），两全图 cross-fade；
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
    <!-- 机器人（2026-10-27 定稿造型，currentColor 实心剪影）：镂空眼随 hover 互换——
         静止=闭眼眠弧（∩ 镂空带，反向绕向成孔），悬停=睁眼圆孔（用户给定 iconfont 原 path） -->
    <svg viewBox="0 0 1024 1024" width="30" height="30" fill="currentColor" aria-hidden="true">
      <path
        class="fv-support-bot__face fv-support-bot__face-wink"
        d="M857.6 906.65H166.4c-25.6 0-42.65 17.1-42.65 42.7S140.8 992 166.4 992h691.2c25.6 0 42.65-17.05 42.65-42.65a42.752 42.752 0 0 0-42.65-42.7zM42.65 462.95C17.05 462.95 0 480 0 505.6v170.65c0 25.6 17.05 42.7 42.65 42.7s42.7-17.1 42.7-42.7V505.6c0-25.6-17.1-42.65-42.7-42.65zm938.7 0c-25.6 0-42.7 17.05-42.7 42.65v170.65c0 25.6 17.1 42.7 42.7 42.7s42.65-17.1 42.65-42.7V505.6c0-25.6-17.05-42.65-42.65-42.65zM640 309.35h-85.35V236.8a107.52 107.52 0 0 0 64-98.15A105.626 105.626 0 0 0 512 32c-59.75 0-106.65 51.2-106.65 106.65a107.52 107.52 0 0 0 64 98.15v72.55H384A277.35 277.35 0 1 0 384 864h256a277.35 277.35 0 1 0 0-554.65zM362.65 672A85.35 85.35 0 1 1 448 586.65c0 51.2-38.4 85.35-85.35 85.35zm298.7 0a85.35 85.35 0 1 1 85.3-85.35c0 51.2-38.4 85.35-85.3 85.35z"
      />
      <path
        class="fv-support-bot__face fv-support-bot__face-rest"
        d="M857.6 906.65H166.4c-25.6 0-42.65 17.1-42.65 42.7S140.8 992 166.4 992h691.2c25.6 0 42.65-17.05 42.65-42.65a42.752 42.752 0 0 0-42.65-42.7zM42.65 462.95C17.05 462.95 0 480 0 505.6v170.65c0 25.6 17.05 42.7 42.65 42.7s42.7-17.1 42.7-42.7V505.6c0-25.6-17.1-42.65-42.7-42.65zm938.7 0c-25.6 0-42.7 17.05-42.7 42.65v170.65c0 25.6 17.1 42.7 42.7 42.7s42.65-17.1 42.65-42.7V505.6c0-25.6-17.05-42.65-42.65-42.65zM640 309.35h-85.35V236.8a107.52 107.52 0 0 0 64-98.15A105.626 105.626 0 0 0 512 32c-59.75 0-106.65 51.2-106.65 106.65a107.52 107.52 0 0 0 64 98.15v72.55H384A277.35 277.35 0 1 0 384 864h256a277.35 277.35 0 1 0 0-554.65zM368 690A80 80 0 0 1 528 690L500 690A52 52 0 0 0 416 690ZM666.7 690A80 80 0 0 1 826.7 690L798.7 690A52 52 0 0 0 714.7 690Z"
      />
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

/* 眼态悬停互换：缺省闭眼眠弧（静止），hover 睁眼圆孔，移开回闭眼 */
.fv-support-bot__face {
  transition: opacity 0.15s ease;
}

.fv-support-bot__face-wink {
  opacity: 0;
}

.fv-support-bot:hover .fv-support-bot__face-wink {
  opacity: 1;
}

.fv-support-bot:hover .fv-support-bot__face-rest {
  opacity: 0;
}
</style>
