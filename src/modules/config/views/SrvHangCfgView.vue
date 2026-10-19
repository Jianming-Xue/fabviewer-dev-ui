<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiError, errCodeToI18nKey } from '@/shared/api/errors'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import {
  createSrvHangCfg,
  deleteSrvHangCfg,
  fetchSrvHangCfgPage,
  toggleSrvHangCfgState,
  updateSrvHangCfg,
} from '@/api/log-service/srvHangCfg'
import { applyMatchMode, splitMatchMode, type MatchMode } from '../matchMode'
import type { SrvHangCfgDto } from '@/api/log-service/types'

const { t } = useI18n()
const dialog = useModalDialog()
const toast = useAlertToast()

// ===== 表格区 =====
const rows = ref<SrvHangCfgDto[]>([])
const total = ref(0)
const totalPage = ref(1)
const pageIndex = ref(1)
const pageSize = 20 // 默认每页 20 条（§4.1）
const loading = ref(false)
const selectedId = ref<string | null>(null)

async function loadPage(page = pageIndex.value) {
  loading.value = true
  try {
    const data = await fetchSrvHangCfgPage(page, pageSize)
    rows.value = data.contents
    total.value = data.total
    totalPage.value = data.totalPage
    pageIndex.value = data.pageIndex
  } catch {
    showError()
  } finally {
    loading.value = false
  }
}

onMounted(() => loadPage(1))

function onRowClick(_event: Event, { item }: { item: SrvHangCfgDto }) {
  selectedId.value = selectedId.value === item.id ? null : item.id
}

/** Enabled 开关：调 state 成功后就地改该格，失败回滚（§4.1） */
const switching = ref<Record<string, boolean>>({})
async function onToggle(row: SrvHangCfgDto, next: boolean | null) {
  switching.value[row.id] = true
  const prev = row.enabled
  row.enabled = next === true
  try {
    await toggleSrvHangCfgState(row.id, row.enabled)
  } catch {
    row.enabled = prev
    showError()
  } finally {
    switching.value[row.id] = false
  }
}

// ===== 删除（§4.1：弹框确认后调用；公共确认 Dialog，2026-10-16 迁自裸 v-dialog） =====
async function onDelete(row: SrvHangCfgDto) {
  const ok = await dialog.confirm({
    title: t('common.delete'),
    message: t('common.deleteConfirm'),
    okText: t('common.delete'),
  })
  if (!ok) return
  try {
    await deleteSrvHangCfg(row.id)
    rows.value = rows.value.filter((r) => r.id !== row.id)
    total.value = Math.max(0, total.value - 1)
    showSuccess()
  } catch (e) {
    showError(e)
  }
}

// ===== 配置控件区（表单） =====
const form = reactive({
  ruleName: '',
  hangReason: '',
  startText: '',
  startMode: 'bothFuzzy' as MatchMode,
  endText: '',
  endMode: 'bothFuzzy' as MatchMode,
})
const editingId = ref<string | null>(null)
const formRef = ref()

const ruleNameRules = [
  (v: string) => !!v || t('validation.required'),
  (v: string) => v.length <= 255 || t('validation.lengthLimit', { n: 255 }),
  (v: string) => /^[A-Za-z0-9]+$/.test(v) || t('validation.charLimit', { chars: '0-9 A-Z a-z' }),
]
const hangReasonRules = [
  (v: string) => !!v || t('validation.required'),
  (v: string) => v.length <= 255 || t('validation.lengthLimit', { n: 255 }),
  (v: string) => /^[A-Za-z0-9,._-]+$/.test(v) || t('validation.charLimit', { chars: '0-9 A-Z a-z , . _ -' }),
]
const lineLikeRules = [
  (v: string) => !!v || t('validation.required'),
  (v: string) => v.length <= 4000 || t('validation.lengthLimit', { n: 4000 }),
]

function fillForm(row: SrvHangCfgDto) {
  editingId.value = row.id
  selectedId.value = row.id
  form.ruleName = row.ruleName
  form.hangReason = row.hangReason
  const start = splitMatchMode(row.startLineLike)
  form.startText = start.text
  form.startMode = start.mode
  const end = splitMatchMode(row.endLineLike)
  form.endText = end.text
  form.endMode = end.mode
}

const saving = ref(false)
async function onConfirm() {
  const { valid } = await formRef.value.validate()
  if (!valid) return
  saving.value = true
  const input = {
    id: editingId.value,
    ruleName: form.ruleName,
    hangReason: form.hangReason,
    startLineLike: applyMatchMode(form.startText, form.startMode),
    endLineLike: applyMatchMode(form.endText, form.endMode),
  }
  try {
    if (editingId.value) {
      const updated = await updateSrvHangCfg(input)
      const idx = rows.value.findIndex((r) => r.id === editingId.value)
      if (idx >= 0) rows.value[idx] = updated // 出参更新选中行每个单元格（§4.3）
    } else {
      const created = await createSrvHangCfg(input)
      rows.value.unshift(created) // 表格第一行插入出参内容（§4.3）
      total.value += 1
    }
    showSuccess()
    onCancel()
  } catch (e) {
    showError(e)
  } finally {
    saving.value = false
  }
}

/** Cancel：清空全部控件值（回到新增模式）+ 取消表格选中（§4.3） */
function onCancel() {
  form.ruleName = ''
  form.hangReason = ''
  form.startText = ''
  form.startMode = 'bothFuzzy'
  form.endText = ''
  form.endMode = 'bothFuzzy'
  editingId.value = null
  selectedId.value = null
  formRef.value?.resetValidation()
}

// ===== 反馈（公共 Toast，2026-10-16 迁自自建 v-snackbar） =====
function showSuccess() {
  toast.success(t('common.opSuccess'))
}
function showError(e?: unknown) {
  // 传输层非 200 已由 shared/http 全局错误 Dialog 呈现，此处不叠 Toast
  if (e instanceof ApiError && e.transport) return
  const key = e instanceof ApiError ? errCodeToI18nKey(e.errCode) : null
  toast.error(key ? t(key) : t('common.opFailed'))
}

const headers = [
  { title: t('config.columns.ruleName'), key: 'ruleName' },
  { title: t('config.columns.startLineLike'), key: 'startLineLike' },
  { title: t('config.columns.endLineLike'), key: 'endLineLike' },
  { title: t('config.columns.hangReason'), key: 'hangReason' },
  { title: t('config.columns.enabled'), key: 'enabled' },
  { title: t('config.columns.updatedAt'), key: 'updatedAt' },
  { title: t('config.columns.updatedBy'), key: 'updatedBy' },
  { title: t('common.operation'), key: 'actions', sortable: false, fixed: true, align: 'end' as const },
]

const matchOptions: { value: MatchMode; label: string }[] = [
  { value: 'leadingFuzzy', label: t('config.match.leading') },
  { value: 'trailingFuzzy', label: t('config.match.trailing') },
  { value: 'bothFuzzy', label: t('config.match.both') },
  { value: 'exact', label: t('config.match.exact') },
]
</script>

<template>
  <section>
    <!-- 上：配置表格区（§4.1） -->
    <v-card elevation="0" border class="mb-6">
      <v-card-title class="d-flex align-center ga-2 py-3">
        <span class="text-body-1 font-weight-bold">{{ t('config.title') }}</span>
        <v-spacer />
        <v-tooltip location="bottom">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon
              variant="text"
              size="small"
              :loading="loading"
              :aria-label="t('common.refresh')"
              @click="loadPage()"
            >
              <v-icon icon="fas fa-rotate-right" />
            </v-btn>
          </template>
          {{ t('common.refresh') }}
        </v-tooltip>
      </v-card-title>
      <v-divider />

      <v-data-table
        :headers="headers"
        :items="rows"
        :loading="loading"
        :items-per-page="-1"
        hide-default-footer
        hover
        density="comfortable"
        class="vui-table--comfortable"
        :no-data-text="t('common.empty')"
        :row-props="({ item }: { item: SrvHangCfgDto }) => ({ class: { 'vui-row--selected': item.id === selectedId } })"
        @click:row="onRowClick"
      >
        <template #[`item.ruleName`]="{ value }">
          <span class="vui-mono text-body-2">{{ value }}</span>
        </template>
        <template #[`item.startLineLike`]="{ value }">
          <span class="vui-mono text-body-2 text-medium-emphasis">{{ value }}</span>
        </template>
        <template #[`item.endLineLike`]="{ value }">
          <span class="vui-mono text-body-2 text-medium-emphasis">{{ value }}</span>
        </template>
        <template #[`item.enabled`]="{ item }">
          <v-switch
            :model-value="item.enabled"
            :loading="switching[item.id]"
            color="primary"
            density="compact"
            hide-details
            @click.stop
            @update:model-value="onToggle(item, $event)"
          />
        </template>
        <template #[`item.updatedAt`]="{ value }">
          <span class="vui-mono text-body-2">{{ value }}</span>
        </template>
        <template #[`item.updatedBy`]="{ value }">
          <span class="vui-mono text-body-2">{{ value }}</span>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-btn variant="text" size="small" color="primary" @click.stop="fillForm(item)">
            {{ t('common.edit') }}
          </v-btn>
          <v-btn
            variant="text"
            size="small"
            color="error"
            @click.stop="onDelete(item)"
          >
            {{ t('common.delete') }}
          </v-btn>
        </template>
      </v-data-table>

      <v-divider />
      <div class="d-flex align-center pa-3">
        <span class="text-body-2 text-medium-emphasis">{{ t('common.total', { n: total }) }}</span>
        <v-spacer />
        <v-pagination
          v-model="pageIndex"
          :length="totalPage"
          total-visible="7"
          density="comfortable"
          @update:model-value="loadPage()"
        />
      </div>
    </v-card>

    <!-- 下：配置控件区（§4.2） -->
    <v-card elevation="0" border>
      <v-card-title class="d-flex align-center ga-2 py-3">
        <span class="text-body-1 font-weight-bold">
          {{ editingId ? t('config.form.titleEditing') : t('config.form.title') }}
        </span>
        <v-chip v-if="editingId" size="x-small" color="primary" label>
          {{ t('config.form.editingTag') }}
        </v-chip>
      </v-card-title>
      <v-divider />

      <v-form ref="formRef" class="pa-6" @submit.prevent="onConfirm">
        <v-row density="compact">
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.ruleName"
              :label="t('config.form.ruleName')"
              :rules="ruleNameRules"
              :hint="t('config.form.ruleNameHint')"
              persistent-hint
              counter="255"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.hangReason"
              :label="t('config.form.hangReason')"
              :rules="hangReasonRules"
              :hint="t('config.form.hangReasonHint')"
              persistent-hint
              counter="255"
            />
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.startText"
              :label="t('config.form.startLine')"
              :rules="lineLikeRules"
              :hint="t('config.form.lineLikeHint')"
              persistent-hint
              counter="4000"
            />
            <v-radio-group v-model="form.startMode" inline hide-details density="compact" class="mt-1">
              <template #label>
                <span class="text-body-2 text-medium-emphasis">{{ t('config.form.matchMode') }}</span>
              </template>
              <v-radio v-for="opt in matchOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </v-radio-group>
          </v-col>

          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.endText"
              :label="t('config.form.endLine')"
              :rules="lineLikeRules"
              counter="4000"
            />
            <v-radio-group v-model="form.endMode" inline hide-details density="compact" class="mt-1">
              <template #label>
                <span class="text-body-2 text-medium-emphasis">{{ t('config.form.matchMode') }}</span>
              </template>
              <v-radio v-for="opt in matchOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
            </v-radio-group>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ t('config.form.exactHint') }}
            </div>
          </v-col>
        </v-row>

        <div class="d-flex justify-end ga-3 mt-4">
          <v-btn :disabled="saving" @click="onCancel">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn color="primary" type="submit" :loading="saving">
            {{ t('common.confirm') }}
          </v-btn>
        </div>
      </v-form>
    </v-card>

  </section>
</template>
