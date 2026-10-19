<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { copyText } from '@/shared/utils/clipboard'
import type { ToastItem } from './useAlertToast'

/** 前缀图标（用户定稿 2026-10-14）：FA 圆形实体图标，颜色随语义色（--vui-toast-accent）；15px 与侧栏菜单图标同档 */
const ICONS: Record<ToastItem['kind'], string> = {
  success: 'fas fa-circle-check',
  error: 'fas fa-circle-xmark',
  warning: 'fas fa-circle-exclamation',
  info: 'fas fa-circle-info',
}

const props = defineProps<{ item: ToastItem }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const icon = computed(() => ICONS[props.item.kind])

// 复制成功后按钮短暂换成 ✓ 并切换提示文案
const copied = ref(false)
let copiedTimer: number | undefined

async function copyMessage() {
  if (!(await copyText(props.item.message))) return
  copied.value = true
  window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copied.value = false), 1500)
}

onUnmounted(() => window.clearTimeout(copiedTimer))
</script>

<template>
  <div
    class="vui-toast"
    :class="`vui-toast--${item.kind}`"
    :role="item.kind === 'error' ? 'alert' : 'status'"
  >
    <v-icon :icon="icon" size="15" class="vui-toast__icon" />
    <div class="vui-toast__message">{{ item.message }}</div>
    <div class="vui-toast__actions">
      <v-tooltip v-if="item.copyable" location="top" open-delay="300">
        <template #activator="{ props: tipProps }">
          <v-btn
            v-bind="tipProps"
            icon
            variant="text"
            size="small"
            :aria-label="t('common.copy')"
            @click="copyMessage"
          >
            <v-icon :icon="copied ? 'fas fa-check' : 'fas fa-copy'" size="15" />
          </v-btn>
        </template>
        {{ copied ? t('common.copied') : t('common.copy') }}
      </v-tooltip>
      <v-tooltip location="top" open-delay="300">
        <template #activator="{ props: tipProps }">
          <v-btn
            v-bind="tipProps"
            icon
            variant="text"
            size="small"
            :aria-label="t('common.close')"
            @click="emit('close')"
          >
            <v-icon icon="fas fa-xmark" size="15" />
          </v-btn>
        </template>
        {{ t('common.close') }}
      </v-tooltip>
    </div>
  </div>
</template>

<style scoped>
/* 语义色经 --vui-toast-accent 组件内令牌注入（禁硬编码颜色）：
   边框实色 + 20% 透明底 + 令牌文字色（浅色近黑 / 深色近白，双主题可读） */
.vui-toast {
  --vui-toast-accent: var(--vui-info);
  display: flex;
  align-items: flex-start;
  gap: var(--vui-space-2);
  min-width: 288px;
  max-width: min(480px, calc(100vw - 32px));
  padding: 9px 6px 9px 12px;
  border: 1px solid var(--vui-toast-accent);
  border-radius: var(--vui-radius); /* 浮层面板（与卡片同 10px，用户定稿 2026-10-14） */
  background: color-mix(in srgb, var(--vui-toast-accent) 20%, transparent);
  color: var(--vui-text);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--vui-text) 14%, transparent);
  font-size: 14px;
  pointer-events: auto; /* 宿主条带 pointer-events:none，单条恢复交互 */
}

.vui-toast--success {
  --vui-toast-accent: var(--vui-success);
}

.vui-toast--error {
  --vui-toast-accent: var(--vui-error);
}

.vui-toast--warning {
  --vui-toast-accent: var(--vui-warning);
}

/* 前缀图标：圆形实体图标本体用语义色（--vui-toast-accent 随 kind 注入），与首行文字对齐 */
.vui-toast__icon {
  color: var(--vui-toast-accent);
  margin-top: 3px; /* (21px 行高 - 15px 图标) / 2，与首行文字光学居中 */
}

.vui-toast__message {
  flex: 1;
  line-height: 21px;
  white-space: pre-line; /* 保留调用方主动换行 */
  overflow-wrap: anywhere; /* 长 ID / 路径不断行溢出 */
}

/* 动作按钮行：高度锁定首行文字（21px），按钮本体（透明底，仅 15px 图标可见）垂直居中、
   超出部分溢出显示——单行 toast 的高度由文字行高决定，不被按钮的 40px 盒高推高 */
.vui-toast__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 21px;
}
</style>
