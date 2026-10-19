<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { copyText } from '@/shared/utils/clipboard'
import FvBaseDialog from './FvBaseDialog.vue'
import { useModalDialog, type DialogKind } from './useModalDialog'

/** 标题前缀（用户定稿 2026-10-14）：FA 圆形实体图标；确认类不加图标 */
const ICONS: Record<DialogKind, string> = {
  success: 'fas fa-circle-check',
  error: 'fas fa-circle-xmark',
  warning: 'fas fa-circle-exclamation',
  info: 'fas fa-circle-info',
  confirm: '',
}

/** 图标语义色：经 --vui-dialog-icon 变量下发给基础组件 */
const ICON_COLORS: Record<DialogKind, string> = {
  success: 'var(--vui-success)',
  error: 'var(--vui-error)',
  warning: 'var(--vui-warning)',
  info: 'var(--vui-info)',
  confirm: 'var(--vui-text)',
}

/** 按钮区配置（用户定稿 2026-10-14）：成功仅 OK(成功色)；错误 复制+OK(失败色)；
 *  警告仅 OK(警告色)；信息 复制+OK(信息色)；确认 Cancel+OK(主题色) */
const BUTTONS: Record<DialogKind, { copy: boolean; cancel: boolean; okColor: string }> = {
  success: { copy: false, cancel: false, okColor: 'success' },
  error: { copy: true, cancel: false, okColor: 'error' },
  warning: { copy: false, cancel: false, okColor: 'warning' },
  info: { copy: true, cancel: false, okColor: 'info' },
  confirm: { copy: false, cancel: true, okColor: 'primary' },
}

const { t } = useI18n()
const { state, settle } = useModalDialog()

const current = computed(() => state.current)
const kind = computed<DialogKind | null>(() => current.value?.kind ?? null)
const icon = computed(() => (kind.value ? ICONS[kind.value] : ''))
const iconColor = computed(() => (kind.value ? ICON_COLORS[kind.value] : 'var(--vui-text)'))
const buttons = computed(() => (kind.value ? BUTTONS[kind.value] : null))
// 无队列项时 kind=null，跳过 t('dialog.null') 评估（避免 intlify 缺键告警）
const title = computed(() => current.value?.options.title ?? (kind.value ? t(`dialog.${kind.value}`) : ''))
const okText = computed(() => current.value?.options.okText ?? t('common.ok'))

/** 开关：Esc/遮罩等关闭（false）→ settle(false)；队列轮换时保持开 */
const visible = computed({
  get: () => !!current.value,
  set: (open: boolean) => {
    if (!open) settle(false)
  },
})

const commonRef = ref<InstanceType<typeof FvBaseDialog>>()

// 复制成功后按钮文案短暂换成「已复制」，弹窗保持打开（用户定稿：复制不关窗）
const copied = ref(false)
let copiedTimer: number | undefined

/** 复制正文纯文本：message 与 html（剥标签、<br> 还原换行）同时存在时用换行拼接 */
const plainText = computed(() => {
  const o = current.value?.options
  if (!o) return ''
  const strip = (html: string) =>
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim()
  return [o.message, o.html ? strip(o.html) : ''].filter(Boolean).join('\n')
})

async function copyContent() {
  if (!(await copyText(plainText.value))) return
  copied.value = true
  window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copied.value = false), 1500)
}

onUnmounted(() => window.clearTimeout(copiedTimer))

// 队列轮换到下一个弹窗时：重置复制反馈，并让基础组件归位拖拽位移
watch(current, () => {
  copied.value = false
  window.clearTimeout(copiedTimer)
  commonRef.value?.resetDrag()
})
</script>

<template>
  <FvBaseDialog ref="commonRef" v-model="visible" :title="title"
    :title-icon="icon || undefined"
    :style="{ '--vui-dialog-icon': iconColor }"
  >
    <div v-if="current?.options.message" class="vui-dialog__message">
      {{ current.options.message }}
    </div>
    <!-- 富文本：内容须为应用内可信来源（见 useModalDialog DialogOptions 注释） -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-if="current?.options.html" class="vui-dialog__rich" v-html="current.options.html" />

    <template #actions>
      <!-- 复制/取消均为普通按钮（无色 → 全局透明底 + 主色边框，见 tokens.css） -->
      <v-btn v-if="buttons?.copy" @click="copyContent">
        {{ copied ? t('common.copied') : t('common.copy') }}
      </v-btn>
      <v-btn v-if="buttons?.cancel" @click="settle(false)">
        {{ current?.options.cancelText ?? t('common.cancel') }}
      </v-btn>
      <v-btn v-if="buttons" :color="buttons.okColor" @click="settle(true)">
        {{ okText }}
      </v-btn>
    </template>
  </FvBaseDialog>
</template>

<style scoped>
.vui-dialog__message {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

/* 富文本基础样式（令牌取色，不硬编码） */
.vui-dialog__rich :deep(a) {
  color: var(--vui-primary);
}

.vui-dialog__rich :deep(code) {
  font-family: var(--vui-font-mono);
  background: var(--vui-fill-alter);
  padding: 0 4px;
  border-radius: 4px;
}

.vui-dialog__rich :deep(img) {
  max-width: 100%; /* 富文本图片不撑破弹窗宽度 */
  height: auto;
}
</style>
