<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import FvMultiValueCell from '@/shared/components/FvMultiValueCell.vue'
import { formatThousands, msToSeconds } from '@/shared/utils/time'
import { useSearchStore } from '../stores/search'
import { buildResultColumns, type ResultColumn } from './resultColumns'
import type { RuleInfoDto } from '@/api/log-service/types'

const { t } = useI18n()
const store = useSearchStore()
const { rows, total, totalPage, pageIndex, pageSize, loading, loadError, searched, selected, columns, dynamicColumns } =
  storeToRefs(store)

const emit = defineEmits<{
  export: []
  'open-rule-log': []
  /** Server Hang 弹框（§3.6）：本期按钮恒置灰发不出；落库启用后移除 disabled 即通 */
  'open-hang': []
  'full-log': []
  'open-columns': []
}>()

/** 可见业务列（不含单选与 Server Hang 末列；Export 复用） */
const visibleColumns = computed<ResultColumn[]>(() =>
  buildResultColumns(columns.value, dynamicColumns.value, t),
)

const MONO_KEYS = new Set([
  'env',
  'ipaddress',
  'serverId',
  'ruleName',
  'startTime',
  'endTime',
  'totalCostTime',
  'costSummary',
  'unaccountedCost',
])

const headers = computed(() => [
  { key: '__select', title: '', sortable: false, width: 48 },
  ...visibleColumns.value.map((c) => ({
    key: c.key,
    title: c.title,
    sortable: false,
    width: c.width,
  })),
  // Server Hang：固定末列，永远最后（§3.6）
  {
    key: 'hang',
    title: t('ruleSearch.columns.hang'),
    sortable: false,
    fixed: true,
    align: 'end' as const,
  },
])

function headerValue(col: ResultColumn): (item: RuleInfoDto) => string {
  return (item: RuleInfoDto) => breakdownText(item, col)
}

function breakdownText(item: RuleInfoDto, col: ResultColumn): string {
  if (col.kind === 'breakdown-lock' || col.kind === 'breakdown-call') {
    const group = col.kind === 'breakdown-lock' ? 'LOCK' : 'CALL'
    const hit = item.costBreakDown.find((b) => b.group === group && b.item === col.breakdownName)
    return hit ? `${msToSeconds(hit.summary)} s` : ''
  }
  if (col.kind === 'seconds') {
    return `${msToSeconds(Number(item[col.key as keyof RuleInfoDto]))} s`
  }
  return String(item[col.key as keyof RuleInfoDto] ?? '')
}

/** 把 value 选择器挂到动态 / 耗时列（named slot 只服务静态列） */
const headerList = computed(() =>
  headers.value.map((h) => {
    const col = visibleColumns.value.find((c) => c.key === h.key)
    if (col && (col.kind === 'seconds' || col.kind === 'breakdown-lock' || col.kind === 'breakdown-call')) {
      return { ...h, value: headerValue(col) }
    }
    return h
  }),
)

// ===== 选中（§3.7：单选，行首单选框 + 点击整行都生效；再点一次取消） =====
function toggleSelect(row: RuleInfoDto) {
  selected.value = selected.value?.id === row.id ? null : row
}

function rowProps({ item }: { item: RuleInfoDto }) {
  return {
    class: {
      'vui-row--selected': selected.value?.id === item.id,
      'vui-row--running': item.execStatus === '进行中', // 进行中的块：整行标记底色
    },
  }
}

function cellProps({ column }: { column: { key: string } }) {
  return { class: { 'vui-mono vui-numeric': MONO_KEYS.has(column.key) } }
}

const hasRows = computed(() => rows.value.length > 0)
const canAct = computed(() => !!selected.value && !loading.value)

const pageSizeItems = [20, 50, 100] // 档位（§3.1）
</script>

<template>
  <v-card elevation="0" border>
    <!-- 错误态：请求失败 + 重试（05 §4.3 六件套） -->
    <v-alert
      v-if="loadError"
      type="error"
      variant="tonal"
      density="compact"
      class="ma-4"
      :title="t('ruleSearch.states.errorTitle')"
    >
      <v-btn size="small" color="error" variant="text" @click="store.changePage(pageIndex)">
        {{ t('common.retry') }}
      </v-btn>
    </v-alert>

    <v-data-table
      :headers="headerList"
      :items="rows"
      :loading="loading"
      :items-per-page="-1"
      hide-default-footer
      hover
      density="comfortable"
        class="vui-table--comfortable"
      :row-props="rowProps"
      :cell-props="cellProps"
      @click:row="(_e: Event, { item }: { item: RuleInfoDto }) => toggleSelect(item)"
    >
      <!-- 未查询引导态 / 空态（05 §4.3） -->
      <template #no-data>
        <v-empty-state
          :icon="searched ? 'fas fa-inbox' : 'fas fa-magnifying-glass'"
          :text="searched ? t('ruleSearch.states.emptyTitle') : t('ruleSearch.states.notSearched')"
        />
      </template>

      <template #[`item.__select`]="{ item }">
        <v-radio
          :model-value="selected?.id === item.id"
          :value="true"
          density="compact"
          hide-details
          @click.stop="toggleSelect(item)"
        />
      </template>

      <!-- Rule Result：仅 CANCELRULE 单元格标红（§3.4；Error Code 不驱动标红） -->
      <template #[`item.ruleResult`]="{ value }">
        <span v-if="value === 'CANCELRULE'" class="vui-cell--cancel">{{ value }}</span>
        <span v-else>{{ value }}</span>
      </template>

      <!-- 多值列：首值 + 角标（§3.5） -->
      <template #[`item.errorCode`]="{ item }"><FvMultiValueCell :values="item.errorCode" /></template>
      <template #[`item.eqpId`]="{ item }"><FvMultiValueCell :values="item.eqpId" /></template>
      <template #[`item.lotId`]="{ item }"><FvMultiValueCell :values="item.lotId" /></template>
      <template #[`item.carrierId`]="{ item }"><FvMultiValueCell :values="item.carrierId" /></template>
      <template #[`item.userId`]="{ item }"><FvMultiValueCell :values="item.userId" /></template>
      <template #[`item.tid`]="{ item }"><FvMultiValueCell :values="item.tid" /></template>

      <!-- Server Hang 末列：本期未落库，按钮恒置灰（§3.6） -->
      <template #[`item.hang`]="{ item }">
        <v-tooltip location="top">
          <template #activator="{ props }">
            <span v-bind="props">
              <v-btn size="small" variant="tonal" color="error" disabled @click="emit('open-hang')">
                Hang ({{ item.hangCount }})
              </v-btn>
            </span>
          </template>
          {{ t('ruleSearch.hang.disabledTip') }}
        </v-tooltip>
      </template>
    </v-data-table>

    <!-- 分页：右下角，切页大小 20/50/100，始终显示（§3.1） -->
    <v-divider />
    <div class="d-flex align-center pa-3">
      <span class="text-body-2 text-medium-emphasis">
        {{ t('common.total', { n: formatThousands(total) }) }}
      </span>
      <v-spacer />
      <v-select
        :model-value="pageSize"
        :items="pageSizeItems"
        density="compact"
        variant="outlined"
        hide-details
        :label="t('common.perPage', { n: '' })"
        class="mr-4"
        max-width="150"
        @update:model-value="store.changePageSize($event as number)"
      />
      <v-pagination
        :model-value="pageIndex"
        :length="totalPage"
        total-visible="7"
        density="comfortable"
        @update:model-value="store.changePage($event)"
      />
    </div>

    <!-- 下方操作按钮（§四）：次按钮组 | 主按钮组（不超过 2 个主按钮，05 §4.7） -->
    <v-divider />
    <div class="d-flex align-center ga-3 pa-3">
      <v-btn variant="outlined" :disabled="!hasRows || loading" @click="emit('export')">
        Export
      </v-btn>
      <v-btn variant="outlined" :disabled="loading" @click="emit('open-columns')">
        {{ t('common.optionalColumns') }}
      </v-btn>
      <v-divider vertical class="mx-2 my-1" />
      <v-btn color="primary" :disabled="!canAct" @click="emit('open-rule-log')">
        {{ t('ruleSearch.buttons.ruleLog') }}
      </v-btn>
      <v-btn color="primary" :disabled="!canAct" @click="emit('full-log')">
        {{ t('ruleSearch.buttons.fullLog') }}
      </v-btn>
    </div>
  </v-card>
</template>

<style scoped>
/* CANCELRULE 单元格标红（§3.4）：文字 + 底色（05 §2.3 两种呈现） */
.vui-cell--cancel {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--vui-radius-xs);
  background: var(--vui-error-bg);
  color: var(--vui-error);
  font-size: 13px;
}
</style>
