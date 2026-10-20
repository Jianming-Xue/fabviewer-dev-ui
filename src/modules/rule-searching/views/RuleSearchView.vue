<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import { downloadBlob } from '@/shared/utils/download'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import ColumnSettingsDrawer from '../components/ColumnSettingsDrawer.vue'
import FilterArea from '../components/FilterArea.vue'
import ResultTable from '../components/ResultTable.vue'
import HangDialog from '../dialogs/HangDialog.vue'
import RuleLogDialog from '../dialogs/RuleLogDialog.vue'
import { buildResultColumns, cellText } from '../components/resultColumns'
import { downloadFullLog } from '@/api/log-service/requests/ruleInfo'
import { useSearchStore } from '../stores/search'

const { t } = useI18n()
const store = useSearchStore()
const { rows, selected, columns, dynamicColumns, loading } = storeToRefs(store)

onMounted(() => {
  store.loadOptions()
})

function onSearch() {
  store.search()
}

// ===== 可选列抽屉（§3.3） =====
const columnsOpen = ref(false)

// ===== Rule Log 弹窗（§4.2）：FvInteractiveDialogHost 体系，编程式打开 =====
function openRuleLog() {
  if (selected.value) void openInteractiveDialog(RuleLogDialog, { row: selected.value })
}

// ===== Hang 弹框（§3.6：本期入口置灰，链路先备好——按钮启用后接 open-hang 事件即可） =====
function openHang() {
  if (selected.value) void openInteractiveDialog(HangDialog, { row: selected.value })
}

// ===== Full Log（§4.3）：文件级还原 .zip 下载 =====
const downloading = ref(false)
async function onFullLog() {
  if (!selected.value) return
  downloading.value = true
  try {
    const blob = await downloadFullLog(selected.value.id)
    downloadBlob(blob, `${selected.value.serverId}-fulllog.zip`)
  } finally {
    downloading.value = false
  }
}

// ===== Export（§4.1）：当前页内容 → Excel，只导显示中的列，Server Hang 不导 =====
const exporting = ref(false)
const exportColumns = computed(() => buildResultColumns(columns.value, dynamicColumns.value, t))

async function onExport() {
  exporting.value = true
  try {
    // exceljs 体积大，点 Export 那一刻才加载
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('RuleInfo')
    sheet.columns = exportColumns.value.map((c) => ({ header: c.title, key: c.key, width: 22 }))
    for (const row of rows.value) {
      const record: Record<string, string> = {}
      for (const col of exportColumns.value) record[col.key] = cellText(row, col)
      sheet.addRow(record)
    }
    const buffer = await workbook.xlsx.writeBuffer()
    const ts = dayjs().format('YYYYMMDDHHmmss') // 文件名只带导出时刻（§4.1）
    downloadBlob(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${t('ruleSearch.exportName')}_${ts}.xlsx`,
    )
  } finally {
    exporting.value = false
  }
}

const busy = computed(() => loading.value || exporting.value || downloading.value)
</script>

<template>
  <section :aria-busy="busy">
    <h1 class="text-h5 font-weight-bold mb-4">{{ t('ruleSearch.nav.label') }}</h1>

    <!-- 上：搜索区 -->
    <FilterArea @search="onSearch" />

    <!-- 中：结果列表 / 下：选中行操作按钮（ResultTable 内） -->
    <ResultTable
      @export="onExport"
      @open-rule-log="openRuleLog"
      @open-hang="openHang"
      @full-log="onFullLog"
      @open-columns="columnsOpen = true"
    />

    <ColumnSettingsDrawer v-model="columnsOpen" />
  </section>
</template>
