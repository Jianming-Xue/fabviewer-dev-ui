<script setup lang="ts">
import { reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

import FvCheckbox from '@/shared/components/FvCheckbox.vue'

import { useSearchStore, type ColumnSettings } from '../stores/search'

/**
 * 列设置抽屉（§3.3）：右侧 400px；
 * 确认后不重新查询 —— 按当前页已有数据就地重渲列；勾选本地记忆。
 */
const { t } = useI18n()
const store = useSearchStore()
const { columns, options } = storeToRefs(store)

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const draft = reactive<ColumnSettings>({ ...columns.value })

watch(
  () => props.modelValue,
  (open) => {
    if (open) Object.assign(draft, columns.value) // 打开时以当前生效设置为准
  },
)

function confirm() {
  store.applyColumns({ ...draft, lockObjects: [...draft.lockObjects], callSys: [...draft.callSys] })
  emit('update:modelValue', false)
}
</script>

<template>
  <v-navigation-drawer
    :model-value="modelValue"
    location="right"
    width="400"
    temporary
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="pa-5 d-flex flex-column h-100">
      <h3 class="text-subtitle-1 font-weight-bold mb-1">{{ t('common.optionalColumns') }}</h3>
      <!-- 作用域声明（05 §4.4：抽屉首行写明作用于哪张表） -->
      <p class="text-caption text-medium-emphasis mb-4">
        {{ t('common.columnScope', { table: t('ruleSearch.nav.label') }) }}
      </p>

      <div class="text-body-2 text-medium-emphasis mb-1">{{ t('ruleSearch.drawer.hideable') }}</div>
      <FvCheckbox v-model="draft.showTotalCost" :label="t('ruleSearch.columns.totalCostTime')" />
      <FvCheckbox v-model="draft.showCostSummary" :label="t('ruleSearch.columns.costSummary')" />
      <FvCheckbox v-model="draft.showUnaccounted" :label="t('ruleSearch.columns.unaccountedCost')" />

      <div class="text-body-2 text-medium-emphasis mt-4 mb-1">{{ t('ruleSearch.drawer.optional') }}</div>
      <FvCheckbox v-model="draft.showExecStatus" :label="t('ruleSearch.columns.execStatus')" />

      <div class="text-body-2 text-medium-emphasis mt-4 mb-2">{{ t('ruleSearch.drawer.lockObject') }}</div>
      <v-select
        v-model="draft.lockObjects"
        :items="options.lockObject"
        :placeholder="t('common.noRestriction')"
        multiple
        chips
        closable-chips
        hide-details
      />

      <div class="text-body-2 text-medium-emphasis mt-4 mb-2">{{ t('ruleSearch.drawer.callSys') }}</div>
      <v-select
        v-model="draft.callSys"
        :items="options.callSys"
        :placeholder="t('common.noRestriction')"
        multiple
        chips
        closable-chips
        hide-details
      />

      <v-spacer />
      <div class="d-flex justify-end ga-3 mt-6">
        <v-btn @click="emit('update:modelValue', false)">
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn color="primary" @click="confirm">{{ t('common.confirm') }}</v-btn>
      </div>
    </div>
  </v-navigation-drawer>
</template>
