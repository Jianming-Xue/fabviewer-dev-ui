<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { fetchRuleInfoDetail } from '@/api/log-service/ruleInfo'
import type { RuleInfoDto } from '@/api/log-service/types'
import { downloadBlob } from '@/shared/utils/download'

/**
 * Rule Info Detail 弹窗（§4.2，经 openInteractiveDialog 打开）：游标式按需加载
 * （fingerprint, offset 触底续拉）、全局过滤（仅已加载部分）、全部加载完毕后出现「全量下载」。
 * 宿主每次打开都是全新挂载 → 状态天然归零 + onMounted 拉首屏，等效旧版「重开从头加载」。
 */
const props = defineProps<{ row: RuleInfoDto }>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()

const lines = ref<string[]>([])
const finished = ref(false)
const loading = ref(false)
const fingerprint = ref('')
const offset = ref<number | undefined>(undefined)
const filterText = ref('')
const scrollEl = ref<HTMLElement | null>(null)

async function loadMore() {
  if (loading.value || finished.value) return
  loading.value = true
  try {
    const batch = await fetchRuleInfoDetail(
      props.row.id,
      fingerprint.value || undefined,
      offset.value,
    )
    lines.value.push(...batch.raw.split('\n'))
    finished.value = batch.finished
    fingerprint.value = batch.fingerprint
    offset.value = batch.offset
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadMore()
  await nextTick()
  if (scrollEl.value) scrollEl.value.scrollTop = 0
})

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) loadMore()
}

const filtered = computed(() =>
  filterText.value ? lines.value.filter((l) => l.includes(filterText.value)) : lines.value,
)

/** 全量下载：全部日志加载完毕后出现；把全部已加载行拼成 .log（§4.2） */
function downloadAll() {
  const blob = new Blob([lines.value.join('\n')], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, `${props.row.ruleName}.log`)
}
</script>

<template>
  <FvInteractiveDialog v-model="open" :max-width="920">
    <template #title>
      <span>{{ t('ruleSearch.ruleLog.title') }}</span>
      <span class="vui-mono text-body-2 text-medium-emphasis">{{ row.ruleName }}</span>
    </template>

    <v-text-field
      v-model="filterText"
      :placeholder="t('ruleSearch.ruleLog.searchPlaceholder')"
      density="compact"
      variant="outlined"
      prepend-inner-icon="fas fa-filter"
      clearable
      hide-details
      class="mb-3"
    />

    <!-- 日志行滚动区：原文一行一条、长行折行、触底加载 -->
    <div ref="scrollEl" class="vui-log-pane" @scroll="onScroll">
      <div
        v-for="(line, i) in filtered"
        :key="i"
        class="vui-mono vui-log-line"
      >{{ line }}</div>
      <div v-if="loading" class="text-center py-3">
        <v-progress-circular indeterminate size="20" width="2" color="primary" />
      </div>
      <div v-if="finished" class="text-center text-body-2 text-medium-emphasis py-3">
        {{ t('ruleSearch.ruleLog.finished') }}
      </div>
    </div>

    <template #actions>
      <!-- Root Cause 居左（本期置灰），下载/关闭居右（基座 actions 默认右对齐） -->
      <v-tooltip location="top">
        <template #activator="{ props: tipProps }">
          <span v-bind="tipProps" class="fv-rule-log__cause">
            <v-btn variant="text" disabled>{{ t('ruleSearch.ruleLog.rootCause') }}</v-btn>
          </span>
        </template>
        {{ t('ruleSearch.hang.disabledTip') }}
      </v-tooltip>
      <v-btn v-if="finished" variant="outlined" @click="downloadAll">
        {{ t('common.fullDownload') }}
      </v-btn>
      <v-btn @click="open = false">{{ t('common.close') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 日志正文：等宽、深底浮层档（05 §五·深色要求；浅色模式同样给深底代码块观感可选，这里跟随令牌） */
.vui-log-pane {
  height: min(480px, calc(80vh - 220px));
  overflow-y: auto;
  border-radius: var(--vui-radius);
  background: var(--vui-bg-elevated);
  border: 1px solid var(--vui-border);
  padding: 12px 16px;
}

.vui-log-line {
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--vui-text);
}

.fv-rule-log__cause {
  margin-right: auto;
}
</style>
