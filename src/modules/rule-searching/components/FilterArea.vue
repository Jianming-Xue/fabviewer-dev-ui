<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import {
  isValidCostValue,
  isValidStarPattern,
  normalizeServerNumbers,
  validateTimeRange,
} from '@/shared/utils/time'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import FvSwitch from '@/shared/components/FvSwitch.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTimer from '@/shared/components/FvTimer.vue'
import { useSearchStore } from '../stores/search'

const { t } = useI18n()
const toast = useAlertToast()
const store = useSearchStore()
const { filters, options, moreShown } = storeToRefs(store)

const emit = defineEmits<{ search: [] }>()

// ===== 即时校验（§2.8：输入即校验，标红 + 行内文案；Search 被拦住） =====

const timeIssues = computed(() => validateTimeRange(filters.value.startTime, filters.value.endTime))
const startErrors = computed(() =>
  timeIssues.value.filter((i) => i.field === 'start' || i.field === 'both').map((i) => t(i.key)),
)
const endErrors = computed(() =>
  timeIssues.value.filter((i) => i.field === 'end' || i.field === 'both').map((i) => t(i.key)),
)

function starError(value: string): string[] {
  return isValidStarPattern(value) ? [] : [t('validation.starInvalid')]
}
const ruleNameErrors = computed(() => starError(filters.value.ruleName))
const eqpErrors = computed(() => starError(filters.value.eqpId))
const carrierErrors = computed(() => starError(filters.value.carrierId))
const lotErrors = computed(() => starError(filters.value.lotId))

const minCostErrors = computed(() => {
  const v = filters.value.minCost
  return v && !isValidCostValue(v)
    ? [
        t('validation.numberRange', { min: '0', max: '99999.99' }) +
          ' · ' +
          t('validation.decimals', { n: 2 }),
      ]
    : []
})
const maxCostErrors = computed(() => {
  const v = filters.value.maxCost
  const base =
    v && !isValidCostValue(v)
      ? [
          t('validation.numberRange', { min: '0', max: '99999.99' }) +
            ' · ' +
            t('validation.decimals', { n: 2 }),
        ]
      : []
  if (base.length) return base
  const min = Number(filters.value.minCost)
  const max = Number(v)
  if (filters.value.minCost && v && Number.isFinite(min) && Number.isFinite(max) && min > max) {
    return [t('validation.minMax')]
  }
  return []
})

/** Server Number 只在点 Search 那一刻校验（§2.8） */
const serverNumberErrors = ref<string[]>([])

/** 汇总全部校验结果，供 Search 拦截 */
function allIssues(): string[] {
  const errs: string[] = []
  errs.push(...startErrors.value, ...endErrors.value)
  errs.push(...ruleNameErrors.value, ...eqpErrors.value, ...carrierErrors.value, ...lotErrors.value)
  errs.push(...minCostErrors.value, ...maxCostErrors.value)
  serverNumberErrors.value = []
  if (filters.value.serverCategory && filters.value.serverNumber) {
    if (normalizeServerNumbers(filters.value.serverNumber) === null) {
      serverNumberErrors.value = [t('validation.serverNumber')]
      errs.push(t('validation.serverNumber'))
    }
  }
  return errs
}

// ===== 联动（§2.7） =====

async function onEnvChange() {
  await store.reloadIpOptions(filters.value.env) // 内部会清空已选 Host IP
}

function onCategoryChange() {
  if (!filters.value.serverCategory) {
    filters.value.serverNumber = '' // Category 清空 → Number 一并清空
  }
}

function onMinClear() {
  filters.value.minCost = '0'
}

function onMaxClear() {
  filters.value.maxCost = '999'
}

// ===== 按钮（§2.5 / §2.6） =====

function onSearch() {
  const errs = allIssues()
  if (errs.length > 0) {
    // 校验不通过：按钮可点但拦住，弹公共警告 Toast（05 §4.8 提交拦截；2026-10-16 迁自自建 v-snackbar）
    toast.warning(errs[0] ?? '')
    return
  }
  emit('search')
}

function onReset() {
  store.reset()
  serverNumberErrors.value = []
}
</script>

<template>
  <v-card elevation="0" border class="mb-6">
    <div class="pa-6">
      <!-- 栅格 5 列 × N 行（§2.1：平铺 12 项排 5/5/2） -->
      <div class="vui-filter-grid">
        <!-- 行 1 -->
        <v-select
          v-model="filters.env"
          :items="options.env"
          :label="t('ruleSearch.filter.env')"
          :placeholder="t('common.noRestriction')"
          clearable
          @update:model-value="onEnvChange"
        />
        <v-select
          v-model="filters.serverCategory"
          :items="options.serverCategory"
          :label="t('ruleSearch.filter.serverCategory')"
          :placeholder="t('common.noRestriction')"
          clearable
          @update:model-value="onCategoryChange"
        />
        <FvTextInput
          v-model="filters.serverNumber"
          :label="t('ruleSearch.filter.serverNumber')"
          :disabled="!filters.serverCategory"
          :error-messages="serverNumberErrors"
          placeholder="1,2,3"
        />
        <!-- 时间对：FvTimer 分钟精度（秒段/秒轮隐藏，model 'YYYY-MM-DD HH:mm' 同 MINUTE_FORMAT）；
             不启用 clearable（用户定稿 2026-10-19：不要旧控件的清除钮） -->
        <FvTimer
          v-model="filters.startTime"
          mode="datetime"
          precision="minute"
          :label="t('ruleSearch.filter.startTime')"
          :error-messages="startErrors"
        />
        <FvTimer
          v-model="filters.endTime"
          mode="datetime"
          precision="minute"
          :label="t('ruleSearch.filter.endTime')"
          :error-messages="endErrors"
          :hint="t('time.mustLaterThan')"
          show-hint
        />

        <!-- 行 2 -->
        <FvTextInput
          v-model="filters.ruleName"
          :label="t('ruleSearch.filter.ruleName')"
          :error-messages="ruleNameErrors"
        />
        <FvTextInput v-model="filters.tid" :label="t('ruleSearch.filter.tid')" />
        <FvTextInput
          v-model="filters.eqpId"
          :label="t('ruleSearch.filter.eqp')"
          :error-messages="eqpErrors"
        />
        <FvTextInput
          v-model="filters.carrierId"
          :label="t('ruleSearch.filter.carrier')"
          :error-messages="carrierErrors"
        />
        <FvTextInput
          v-model="filters.lotId"
          :label="t('ruleSearch.filter.lot')"
          :error-messages="lotErrors"
        />

        <!-- 行 3：Min / Max Cost Time + Desc Time 开关占一格（§2.4） -->
        <FvTextInput
          v-model="filters.minCost"
          :label="t('ruleSearch.filter.minCost')"
          :error-messages="minCostErrors"
          :hint="t('ruleSearch.filter.unitSeconds')"
          show-hint
          inputmode="decimal"
          clear
          @click:clear="onMinClear"
        />
        <FvTextInput
          v-model="filters.maxCost"
          :label="t('ruleSearch.filter.maxCost')"
          :error-messages="maxCostErrors"
          inputmode="decimal"
          clear
          @click:clear="onMaxClear"
        />
        <FvSwitch
          v-model="filters.descTime"
          :label="t('ruleSearch.filter.descTime')"
          class="mt-1"
        />

        <!-- 折叠区 4 项（默认收起；收起那一刻值已清空） -->
        <template v-if="moreShown">
          <v-select
            v-model="filters.ipaddress"
            :items="options.ipaddress"
            :label="t('ruleSearch.filter.ipaddress')"
            :placeholder="t('common.noRestriction')"
            clearable
          />
          <FvTextInput v-model="filters.userId" :label="t('ruleSearch.filter.userId')" />
          <FvTextInput v-model="filters.errorCode" :label="t('ruleSearch.filter.errorCode')" />
          <v-select
            v-model="filters.ruleResult"
            :items="options.ruleResult"
            :label="t('ruleSearch.filter.ruleResult')"
            :placeholder="t('common.noRestriction')"
            clearable
          />
        </template>
      </div>

      <!-- 操作行：底部右对齐，展开更多（幽灵）最左（05 §4.1） -->
      <div class="d-flex justify-end ga-3 mt-4">
        <v-btn variant="text" color="primary" @click="store.toggleMore()">
          <v-icon :icon="moreShown ? 'fas fa-angles-up' : 'fas fa-angles-down'" start size="14" />
          {{ moreShown ? t('common.collapseMore') : t('common.expandMore') }}
        </v-btn>
        <v-btn @click="onReset">{{ t('common.reset') }}</v-btn>
        <v-btn color="primary" @click="onSearch">{{ t('common.search') }}</v-btn>
      </div>
    </div>
  </v-card>
</template>

<style scoped>
/* 条件区 4 列 × N 行栅格（05 §4.1；窄屏自动降列） */
.vui-filter-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px 16px;
}

@media (max-width: 1280px) {
  .vui-filter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .vui-filter-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
