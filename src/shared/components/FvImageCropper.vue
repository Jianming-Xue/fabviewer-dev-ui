<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

/**
 * 圆形头像裁剪器（2026-10-22）：图片模式选图后在预览区框圆裁剪——
 * 圆内拖拽平移 + 缩放滑杆（cover 基准 1~3×），松手/拖动结束即自动裁剪提交；
 * 输出=圆形（透明底）图，尺寸×质量双梯度自动压缩，取首个 ≤ maxBytes（默认 2KB，
 * 按 base64 载荷字节计）的结果——浏览器不支持 webp 编码时 toDataURL 自动回退 PNG，
 * 极端压不进预算则取最小档。
 * 契约：props.src=原图 dataURL；emit cropped=裁剪结果 dataURL（无图=空串）。
 */
const props = withDefaults(
  defineProps<{
    src: string
    /** 预览方窗边长 px（圆形裁剪窗口） */
    box?: number
    /** 输出字节预算（base64 载荷，约 2KB=2048） */
    maxBytes?: number
  }>(),
  { box: 112, maxBytes: 2048 },
)

const emit = defineEmits<{ cropped: [dataUrl: string] }>()

const canvas = ref<HTMLCanvasElement>()
const img = ref<HTMLImageElement | null>(null)
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })

const boxStyle = computed(() => `${props.box}px`)

function baseScale(i: HTMLImageElement): number {
  // cover：原图短边贴满方窗
  return Math.max(props.box / i.naturalWidth, props.box / i.naturalHeight)
}

function render() {
  const c = canvas.value
  const i = img.value
  if (!c || !i) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = props.box * dpr
  c.height = props.box * dpr
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, props.box, props.box)
  const s = baseScale(i) * zoom.value
  const dw = i.naturalWidth * s
  const dh = i.naturalHeight * s
  ctx.drawImage(i, (props.box - dw) / 2 + offset.value.x, (props.box - dh) / 2 + offset.value.y, dw, dh)
}

/** 裁剪输出：outPx 边长圆图（destination-in 裁圆），webp 优先（带透明、压缩好），不支持自动回退 PNG */
function circleCrop(outPx: number, quality: number): string | null {
  const i = img.value
  if (!i) return null
  const c = document.createElement('canvas')
  c.width = outPx
  c.height = outPx
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const k = outPx / props.box
  const s = baseScale(i) * zoom.value * k
  const dw = i.naturalWidth * s
  const dh = i.naturalHeight * s
  ctx.drawImage(i, (outPx - dw) / 2 + offset.value.x * k, (outPx - dh) / 2 + offset.value.y * k, dw, dh)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.beginPath()
  ctx.arc(outPx / 2, outPx / 2, outPx / 2, 0, Math.PI * 2)
  ctx.fill()
  return c.toDataURL('image/webp', quality)
}

function payloadBytes(dataUrl: string): number {
  const at = dataUrl.indexOf('base64,')
  return at < 0 ? dataUrl.length : Math.floor(((dataUrl.length - at - 7) * 3) / 4)
}

/** 尺寸×质量梯度：取首个入预算的结果，全超则保底最小档 */
const LADDER: Array<[number, number]> = [
  [128, 0.9],
  [128, 0.7],
  [112, 0.6],
  [96, 0.6],
  [80, 0.5],
  [64, 0.5],
  [48, 0.4],
  [32, 0.4],
]

function commit() {
  let best = ''
  for (const [px, q] of LADDER) {
    const d = circleCrop(px, q)
    if (d === null) return
    best = d
    if (payloadBytes(d) <= props.maxBytes) break
  }
  emit('cropped', best)
}

function load(src: string) {
  if (!src) {
    img.value = null
    emit('cropped', '')
    return
  }
  const i = new Image()
  i.onload = () => {
    img.value = i
    zoom.value = 1
    offset.value = { x: 0, y: 0 }
    render()
    commit()
  }
  i.src = src
}

onMounted(() => load(props.src))
watch(() => props.src, load)

/* 圆内拖拽平移 */
let dragging = false
let last = { x: 0, y: 0 }
function onDown(e: PointerEvent) {
  dragging = true
  last = { x: e.clientX, y: e.clientY }
  ;(e.currentTarget as Element)?.setPointerCapture?.(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging) return
  offset.value = { x: offset.value.x + (e.clientX - last.x), y: offset.value.y + (e.clientY - last.y) }
  last = { x: e.clientX, y: e.clientY }
  render()
}
function onUp() {
  if (!dragging) return
  dragging = false
  commit()
}

function onZoomMove() {
  render()
}

/** ± 按钮缩放（2026-10-22 修：图标档不吃点击→改真实按钮），步进 0.25、端点夹取 */
function nudge(delta: number) {
  const next = Math.min(3, Math.max(1, zoom.value + delta))
  if (next === zoom.value) return
  zoom.value = next
  render()
  commit()
}
</script>

<template>
  <div class="fv-cropper" :style="{ width: boxStyle }">
    <!-- 框圆窗口：canvas 圆裁（border-radius 50% 裁剪）+ primary 圆环 -->
    <div class="fv-cropper__win" :style="{ width: boxStyle, height: boxStyle }">
      <canvas
        ref="canvas"
        class="fv-cropper__canvas"
        :style="{ width: boxStyle, height: boxStyle }"
        @pointerdown.prevent="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      />
    </div>
    <!-- 缩放行：真实 ± 小按钮贴两端但留边距（padding 12px），中缝滑杆 -->
    <div class="fv-cropper__zoom">
      <v-btn icon variant="text" size="x-small" :aria-label="'zoom -'" @click="nudge(-0.25)">
        <v-icon size="12" icon="fas fa-minus" />
      </v-btn>
      <v-slider
        v-model="zoom"
        :min="1"
        :max="3"
        :step="0.05"
        density="compact"
        hide-details
        class="fv-cropper__slider"
        @update:model-value="onZoomMove"
        @end="commit"
      />
      <v-btn icon variant="text" size="x-small" :aria-label="'zoom +'" @click="nudge(0.25)">
        <v-icon size="12" icon="fas fa-plus" />
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.fv-cropper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

/* 缩放行：± 钮尽量贴两端（仅留 4px 呼吸位），与滑杆之间空 14px，中段整幅留给滑杆 */
.fv-cropper__zoom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  width: 100%;
  padding: 0 4px;
  box-sizing: border-box;
}

.fv-cropper__slider {
  flex: 1;
  min-width: 0;
}

/* 圆窗：裁圆 + 圆环=「框一个圆」；圆外面板底色透出 */
.fv-cropper__win {
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-primary));
}

.fv-cropper__canvas {
  display: block;
  cursor: grab;
  touch-action: none; /* 拖拽不被页面滚动劫持 */
}

.fv-cropper__canvas:active {
  cursor: grabbing;
}
</style>
