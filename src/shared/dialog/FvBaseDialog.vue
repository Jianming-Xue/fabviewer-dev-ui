<script lang="ts">
/**
 * 全局最后一次指针按下位置（视口坐标）：本组件展开动画的原点来源（2026-10-16）。
 * 原独立文件 clickTracker.ts，因仅 FvBaseDialog 一处消费并入本组件模块作用域——
 * 普通 <script> 块与 <script setup> 编译进同一模块，模块加载即挂监听
 * （两个弹窗 Host 应用启动就导入本组件 = 监听启动就位）；若首次读取才装监听，
 * 弹窗由第一次点击打开时 pointerdown 已错过，原点恒回退中心（2026-10-16 实测踩坑）。
 * capture + passive，pointerdown 先于 click 与任何打开逻辑。
 * 从未点击（页面加载即自动弹出等）→ null，调用方回退视口中心。
 */
let lastPointer: { x: number; y: number } | null = null

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointer = { x: e.clientX, y: e.clientY }
    },
    { capture: true, passive: true },
  )
}

function getLastPointer(): { x: number; y: number } | null {
  return lastPointer
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

/**
 * 全局基础 Dialog（公共组件）：上（标题）/ 中（正文）/ 下（按钮区）三区布局。
 * 内置能力（语义弹窗与各页面直接复用）：按住标题拖动、尺寸上限（宽默认 420 / 高 80vh，
 * 超长内容正文区内部滚动、标题与按钮恒显）、10px 圆角、Esc/遮罩关闭（v-model）。
 * 开合动画（2026-10-16）：打开=从最后一次鼠标按下点 scale 展开（无点击记录回退视口中心）；
 * 关闭=四周向中心快速淡出（径向遮罩收拢 + 微缩 + 淡出）。动画在内建，所有基座弹窗自动获得。
 * 语义弹窗（成功/错误/警告/信息/确认）见同目录 FvModalDialogHost，基于本组件实现。
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
  }>(),
  { title: '', maxWidth: 420, centerTitle: false, scrimOpacity: undefined },
)

const visible = defineModel<boolean>({ required: true })

/** 关闭广播（用户定稿 2026-10-14）：任一关闭路径（按钮/Esc/v-model）统一触发一次，
 *  调用方在此清空自己的表单模型——「关闭清空」的组件级契约；卡片随关闭卸载，
 *  弹窗内部（子组件/校验态）本就自动重置 */
const emit = defineEmits<{ closed: [] }>()

// ===== 按住标题拖动（用户定稿 2026-10-14）：指针捕获 + transform 位移 =====
const dragOffset = ref({ x: 0, y: 0 })
/** 拖动进行中标记（抖动修复 2026-10-16）：卡片挂 --dragging 类，期间禁掉消息区全部过渡动画 */
const dragging = ref(false)
let dragStart: { px: number; py: number; ox: number; oy: number } | null = null
const dragStyle = computed(() => `translate(${dragOffset.value.x}px, ${dragOffset.value.y}px)`)

function onDragStart(e: PointerEvent) {
  if (e.button !== 0) return // 仅主键拖动
  // preventDefault（抖动修复 2026-10-16）：阻止按下标题引发的焦点转移——否则聚焦中的
  // 输入框失焦 → Vuetify blur 重校验 → .v-messages 内容变化触发 slide-y-transition
  // （0.3s 进出场 + 0.5s move FLIP）与 .v-messages__message 的 all 150ms 过渡，
  // 错误提示在拖动起手瞬间「迟一拍落位」，视觉上就是抖动/拖尾
  e.preventDefault()
  dragging.value = true
  dragStart = { px: e.clientX, py: e.clientY, ox: dragOffset.value.x, oy: dragOffset.value.y }
  // 指针捕获：移出标题仍持续跟随（合成事件下可能抛错，忽略即可）
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    /* noop */
  }
}

function onDragMove(e: PointerEvent) {
  if (!dragStart) return
  dragOffset.value = {
    x: dragStart.ox + e.clientX - dragStart.px,
    y: dragStart.oy + e.clientY - dragStart.py,
  }
}

function onDragEnd() {
  dragStart = null
  dragging.value = false
}

/** 重置拖拽位移（供语义层在弹窗队列轮换时调用） */
function resetDrag() {
  dragOffset.value = { x: 0, y: 0 }
  dragStart = null
  dragging.value = false
}

/* ===== 开合动画状态机（2026-10-16）=====
   v-model(visible) 是「逻辑开合」，open 是「物理渲染开关」：关闭时卡片多留 LEAVE_MS
   播完淡出才卸载（宿主据此延迟卸载/队列轮换，closed 广播也推到动画后——
   动画期间表单内容保持可见不闪空）。immediate：宿主挂载时模型已是 true，
   需要首帧就带展开动画 */
const LEAVE_MS = 180 // 与 CSS fv-dialog-out 时长一致

const open = ref(false)
const phase = ref<'idle' | 'enter' | 'leave'>('idle')
const origin = ref<{ x: number; y: number } | null>(null)
let leaveTimer: ReturnType<typeof setTimeout> | null = null

watch(
  visible,
  (shown, prev) => {
    if (shown) {
      if (leaveTimer) {
        clearTimeout(leaveTimer) // 关闭动画未完成即重开：取消卸载，不发 closed
        leaveTimer = null
      }
      origin.value = getLastPointer() // 本次 pointerdown 先于打开逻辑被记录
      phase.value = 'enter'
      open.value = true
    } else if (prev) {
      resetDrag() // 关闭即归位
      phase.value = 'leave'
      leaveTimer = setTimeout(() => {
        leaveTimer = null
        open.value = false
        phase.value = 'idle'
        emit('closed')
      }, LEAVE_MS)
    }
  },
  { immediate: true },
)

/** 卡片相对视口中心的展开原点（v-dialog 内容恒居中 → 卡中心≈视口中心） */
const cardStyle = computed(() => {
  const dx = origin.value ? origin.value.x - window.innerWidth / 2 : 0
  const dy = origin.value ? origin.value.y - window.innerHeight / 2 : 0
  return {
    transform: dragStyle.value,
    '--fv-dialog-ox': `${dx}px`,
    '--fv-dialog-oy': `${dy}px`,
  }
})

const cardClass = computed(() => [
  'vui-base-dialog',
  phase.value !== 'idle' ? `vui-base-dialog--${phase.value}` : '',
  dragging.value ? 'vui-base-dialog--dragging' : '',
])

/** enter 动画播完即摘类。判「事件目标=卡片自身」而非动画名全等——
 *  scoped CSS 会给 keyframes 名加哈希后缀（fv-dialog-in-954ee4a9，2026-10-16 实测），
 *  且后代 ripple 等动画会冒泡上来，目标判定一并挡掉 */
function onAnimationEnd(e: AnimationEvent) {
  if (phase.value === 'enter' && e.target === e.currentTarget) phase.value = 'idle'
}

onUnmounted(() => {
  if (leaveTimer) clearTimeout(leaveTimer)
})

/** Esc 关闭（内置 persistent 挡掉了 Vuetify 原生 Esc，此处补回）；
 *  上层还有其他激活弹窗/菜单时让给它，避免一次 Esc 连关多层。
 *  只数 .v-overlay--active：已关闭的菜单会在容器里留惰性 DOM，不能计入 */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !visible.value) return
  if (document.querySelectorAll('.v-overlay--active').length > 1) return
  visible.value = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

defineExpose({ resetDrag })
</script>

<template>
  <!-- persistent 内置（用户定稿 2026-10-14）：点击遮罩不关闭，仅 Esc 或调用方退出按钮可关；
       Vuetify persistent 连 Esc 一起禁掉，Esc 由脚本侧 onKeydown 补回。
       transition=none：关闭 v-dialog 自带的居中缩放动画——开合动效由卡片自身状态机负责
       （展开原点必须相对点击点，wrapper 动画会叠一层中心缩放干扰它）。
       :model-value 绑 open（物理渲染）而非 visible（逻辑开关）——关闭时留住 overlay 播完淡出 -->
  <v-dialog
    class="vui-base-overlay"
    :model-value="open"
    :max-width="maxWidth"
    :opacity="scrimOpacity"
    transition="none"
    persistent
    @update:model-value="visible = $event"
  >
    <v-card v-if="open" :class="cardClass" :style="cardStyle" @animationend="onAnimationEnd">
      <div
        class="vui-base-dialog__title"
        :class="{ 'vui-base-dialog__title--center': centerTitle }"
        @pointerdown="onDragStart"
        @pointermove="onDragMove"
        @pointerup="onDragEnd"
        @pointercancel="onDragEnd"
      >
        <slot name="title">
          <v-icon v-if="titleIcon" :icon="titleIcon" size="16" class="vui-base-dialog__title-icon" />
          {{ title }}
        </slot>
      </div>
      <div class="vui-base-dialog__body">
        <slot />
      </div>
      <div class="vui-base-dialog__actions">
        <slot name="actions" />
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* 尺寸上限（用户定稿 2026-10-14）：宽 ≤ maxWidth（默认 420）、高 ≤80vh——
   超长内容只撑正文区内部滚动，标题/按钮恒显，弹窗不撑爆视口 */
.vui-base-dialog {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  /* 展开原点：--fv-dialog-ox/oy 为最后点击点相对视口中心（≈卡中心）的偏移（JS 下发） */
  transform-origin: calc(50% + var(--fv-dialog-ox, 0px)) calc(50% + var(--fv-dialog-oy, 0px));
  /* 合成层提升（拖动抖动修复 2026-10-16）：拖动/开合的 transform 全程只走合成器，
     不再逐帧重栅格化子内容——半透明错误文字（.v-messages 带 medium-emphasis opacity）
     在快速拖动时不会因重栅格跟不上而拖尾、滞后于卡片 */
  will-change: transform;
}

/* 拖动期间消息区动画清零（抖动修复 2026-10-16）：即使异步校验/状态变化恰好在拖动
   中途落到 .v-messages 上，slide-y-transition（TransitionGroup：0.3s 进出场 +
   0.5s move FLIP）、.v-messages__message 的 all 150ms 过渡、.v-input__details 的
   height/padding/opacity 150ms 过渡全部禁用——内容即时落位，绝不滞后于卡片。
   Vuetify 组件样式在 @layer vuetify-components 里，此处无层级 + !important 稳赢 */
.vui-base-dialog--dragging :deep(.v-input__details),
.vui-base-dialog--dragging :deep(.v-messages),
.vui-base-dialog--dragging :deep(.v-messages__message) {
  transition: none !important;
  animation: none !important;
}

/* 打开：从鼠标按下点 scale 展开（240ms ease-out；无点击记录=原点居中，等效中心展开） */
.vui-base-dialog--enter {
  animation: fv-dialog-in 240ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

@keyframes fv-dialog-in {
  from {
    opacity: 0;
    transform: scale(0.15);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 关闭：四周向中心快速淡出——径向遮罩收拢（可见区从边缘消退到中心）+ 微缩聚拢 + 淡出。
   时长与脚本 LEAVE_MS 同步改 */
.vui-base-dialog--leave {
  animation: fv-dialog-out 180ms cubic-bezier(0.4, 0, 1, 1) both;
  /* 遮罩半径随 mask-size 从全覆盖收到 0：边缘先没、中心最后 */
  mask-image: radial-gradient(circle at center, #000 45%, transparent 72%);
  mask-repeat: no-repeat;
  mask-position: center;
}

@keyframes fv-dialog-out {
  from {
    opacity: 1;
    transform: scale(1);
    mask-size: 320% 320%;
  }
  to {
    opacity: 0;
    transform: scale(0.92);
    mask-size: 0% 0%;
  }
}

/* 标题区（用户调优 2026-10-14：16px/700 紧凑档），emoji/图标与文字同基线；按住可拖动整卡 */
.vui-base-dialog__title {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px 10px;
  font-size: 16px;
  font-weight: 700;
  color: var(--vui-text);
  cursor: grab;
  user-select: none; /* 拖动不选中文本 */
  touch-action: none; /* 触屏拖动不被页面滚动劫持 */
}

.vui-base-dialog__title:active {
  cursor: grabbing;
}

.vui-base-dialog__title--center {
  justify-content: center;
}

/* 标题前缀图标：颜色经 --vui-dialog-icon 变量由调用方（语义层）下发 */
.vui-base-dialog__title-icon {
  color: var(--vui-dialog-icon, var(--vui-text));
}

/* 正文区：超高时本区内部滚动（不推高整卡） */
.vui-base-dialog__body {
  flex: 1 1 auto;
  min-height: 0; /* flex 子项允许收缩，滚动才生效 */
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 14px 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vui-text);
}

/* 按钮区：右对齐 */
.vui-base-dialog__actions {
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px 12px;
}
</style>
