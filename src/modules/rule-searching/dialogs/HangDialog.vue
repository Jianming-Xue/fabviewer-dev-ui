<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { fetchHangList } from '@/api/log-service/requests/ruleInfo'
import type {
  HangEntryDto,
  RuleInfoDto,
} from '@/api/log-service/types/types'
import { msToSeconds } from '@/shared/utils/time'

/**
 * Server Hang 弹框（§3.6，经 openInteractiveDialog 打开）：本期 Hang 未落库，
 * 入口按钮恒置灰、弹框开不了；组件与数据链路先建好，落库后把 ResultTable 中
 * 按钮的 disabled 移除、点击处调 openInteractiveDialog(HangDialog, { row }) 即可启用。
 * 宿主每次打开都是全新挂载 → onMounted 拉取列表，天然等效旧版「重开重拉」。
 */
const props = defineProps<{ row: RuleInfoDto }>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()

const entries = ref<HangEntryDto[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    entries.value = await fetchHangList(props.row.id) // 按开始行时间正序返回
  } finally {
    loading.value = false
  }
})

const headers = [
  { title: t('ruleSearch.hang.startRow'), key: 'startTime' },
  { title: t('ruleSearch.hang.endRow'), key: 'endTime' },
  { title: t('ruleSearch.hang.cost'), key: 'hangCostMs' },
  { title: t('ruleSearch.hang.startLog'), key: 'startLineLog' },
  { title: t('ruleSearch.hang.endLog'), key: 'endLineLog' },
]
</script>

<template>
  <FvInteractiveDialog v-model="open" :title="t('ruleSearch.hang.title')" :max-width="980">
    <v-data-table
      :headers="headers"
      :items="entries"
      :loading="loading"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
      class="vui-table--comfortable"
      :no-data-text="t('common.empty')"
    >
      <template #[`item.startTime`]="{ value }">
        <span class="vui-mono text-body-2">{{ value }}</span>
      </template>
      <template #[`item.endTime`]="{ value }">
        <span class="vui-mono text-body-2">{{ value }}</span>
      </template>
      <!-- 耗时：秒，3 位小数（§3.6） -->
      <template #[`item.hangCostMs`]="{ value }">
        <span class="vui-mono vui-numeric text-body-2">{{ msToSeconds(value) }} s</span>
      </template>
      <template #[`item.startLineLog`]="{ value }">
        <div class="vui-mono vui-hang-log">{{ value }}</div>
      </template>
      <template #[`item.endLineLog`]="{ value }">
        <div class="vui-mono vui-hang-log">{{ value }}</div>
      </template>
    </v-data-table>
    <template #actions>
      <!-- 弹框只有「关闭」按钮（§3.6） -->
      <v-btn @click="open = false">{{ t('common.close') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
.vui-hang-log {
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-width: 320px;
}
</style>
