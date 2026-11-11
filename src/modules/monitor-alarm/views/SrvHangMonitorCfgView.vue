<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { showOpError } from '@/shared/api/opError'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import FvTable from '@/shared/components/FvTable.vue'
import FvTableHeader from '@/shared/components/FvTableHeader.vue'
import FvCard from '@/shared/components/FvCard.vue'
import FvAlertStrip from '@/shared/components/FvAlertStrip.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTextSelect from '@/shared/components/FvTextSelect.vue'
import FvNormalButton from '@/shared/components/FvNormalButton.vue'
import FvPrimaryButton from '@/shared/components/FvPrimaryButton.vue'
import AlarmCfgEditor from '../components/AlarmCfgEditor.vue'
import AlarmPriorityBadge from '../components/AlarmPriorityBadge.vue'
import {
  createSrvHangMonitorCfg,
  deleteSrvHangMonitorCfg,
  fetchSrvHangMonitorCfgList,
  updateSrvHangMonitorCfg,
} from '@/api/telemetry-hub/requests/srvHangMonitorCfgRequest'
import { fetchMiscEnvList, fetchPriorityList } from '@/api/telemetry-hub/requests/systemMiscRequest'

import type { AlarmCfgRo } from '@/api/telemetry-hub/types/alarmCfgTypes'
import type {
  ServerHangMonitorCfgDto,
  ServerHangMonitorCfgRo,
} from '@/api/telemetry-hub/types/srvHangMonitorCfgTypes'

/**
 * 模块2 · 03 MES 服务挂起监控配置（文档 2026-11-10 配置侧定稿，同日前端实现）：
 * 环境级阈值（MaxDelay=日志断流秒数→Server Hang；MaxRuleCost=单 Rule 写日志秒数→Endless Rule）
 * + 优先级 + 通知配置。无 Enabled 字段——「配置即启用」；environment 唯一键（一行一环境）。
 * 单页两卡纵排（文档 §3.2，**非弹窗**）：
 * - 上表格卡：list 全量无分页（env 升序归后端），工具行刷新+New；6 列（阈值带 s 后缀、
 *   Priority 色标徽标）；操作列 修改/查看/删除；
 * - 下行内编辑卡：左区四字段（Environment 编辑态锁定/Priority/Max Delay/Max Rule Cost）+
 *   右区 AlarmCfgEditor 公共组件 + 右下 取消/确认。
 * 四态机（文档 §3.3 核心交互）：idle=全禁用（含确认）仅取消可点、值清空；add=清空+启用、
 * Environment 可选；edit=**list 行数据直接回填**（含 alarmCfg，无 detail 接口）、Environment 锁定；
 * view=回填+全禁用。取消=清空回 idle（无二次确认，文档口径）；确认=左区 v-form + 编辑器 validate()
 * 双校验（仅行内红字、不弹全局），成功 POST/PUT → **重拉 list** 回 idle（无 toast，文档口径）；
 * 删除 Warning 确认框（非立即生效——待告警服务下次配置加载；已产生告警保留）。
 */
const { t } = useI18n()
const dialog = useModalDialog()

/* ===== 表格区（list 全量无分页） ===== */
const rows = ref<ServerHangMonitorCfgDto[]>([])
const loading = ref(false)
const loadError = ref(false)
const selected = ref<ServerHangMonitorCfgDto | null>(null)

async function loadList() {
  loading.value = true
  loadError.value = false
  try {
    rows.value = await fetchSrvHangMonitorCfgList()
  } catch {
    loadError.value = true // 错误条+重试承载（LogMonitorCfgView 同口径）
  } finally {
    loading.value = false
  }
}

onMounted(() => loadList())

/* ===== 候选字典（环境=mes.global.environments / 优先级=system.global.priority；silent 失败→空候选） ===== */
const envOptions = ref<string[]>([])
const priorityOptions = ref<string[]>([])
onMounted(async () => {
  const [envs, prios] = await Promise.allSettled([fetchMiscEnvList(), fetchPriorityList()])
  if (envs.status === 'fulfilled') envOptions.value = envs.value
  if (prios.status === 'fulfilled') priorityOptions.value = prios.value
})

/* ===== 行内编辑卡四态机（文档 §3.3） ===== */
type Mode = 'idle' | 'add' | 'edit' | 'view'
const mode = ref<Mode>('idle')
const formRef = ref()
const editorRef = ref<InstanceType<typeof AlarmCfgEditor> | null>(null)
const saving = ref(false)

/** idle/view：全控件禁用（含确认钮，防误提交）；仅取消可点 */
const disabled = computed(() => mode.value === 'idle' || mode.value === 'view')
/** Environment：编辑态额外锁定（定位键，改则删了重建） */
const envDisabled = computed(() => disabled.value || mode.value === 'edit')

const INT_RE = /^\d+$/
const form = reactive({ environment: '', priority: '', maxDelay: '', maxRuleCost: '' })

function emptyAlarm(): AlarmCfgRo {
  return { mailToUsers: [], mailCCUsers: [], feishuWebhooks: [], feishuAtUsers: [], notifyInterval: 5 }
}
const alarmDraft = ref<AlarmCfgRo>(emptyAlarm())

/** 编辑/查看回填：直接用 list 行数据（含嵌套 alarmCfg；null=遗留行按默认播种） */
function fillFrom(row: ServerHangMonitorCfgDto) {
  form.environment = row.environment
  form.priority = row.priority
  form.maxDelay = String(row.maxDelay)
  form.maxRuleCost = String(row.maxRuleCost)
  const a = row.alarmCfg
  alarmDraft.value = {
    mailToUsers: [...(a?.mailToUsers ?? [])],
    mailCCUsers: [...(a?.mailCCUsers ?? [])],
    feishuWebhooks: [...(a?.feishuWebhooks ?? [])],
    feishuAtUsers: [...(a?.feishuAtUsers ?? [])],
    notifyInterval: a?.notifyInterval ?? 5,
  }
}

function resetForm() {
  form.environment = ''
  form.priority = ''
  form.maxDelay = ''
  form.maxRuleCost = ''
  alarmDraft.value = emptyAlarm()
}

/** 切态后清残留红字（两表单各自独立校验闭环） */
function clearValidation() {
  void nextTick(() => {
    formRef.value?.resetValidation()
    editorRef.value?.resetValidation()
  })
}

/** 新增（FvTable insert → FvNewButton）：进 add 态（清空+启用），不产行故恒回 null */
function onInsert(): null {
  enterAdd()
  return null
}
function enterAdd() {
  mode.value = 'add'
  selected.value = null
  resetForm()
  clearValidation()
}
function enterEdit(row: ServerHangMonitorCfgDto) {
  mode.value = 'edit'
  selected.value = row
  fillFrom(row)
  clearValidation()
}
function enterView(row: ServerHangMonitorCfgDto) {
  mode.value = 'view'
  selected.value = row
  fillFrom(row)
  clearValidation()
}
/** 取消：清空回 idle（文档 §3.3——无二次确认，与日志监控弹窗的放弃确认口径不同） */
function cancel() {
  mode.value = 'idle'
  selected.value = null
  resetForm()
  clearValidation()
}

/* ===== 校验与提交 ===== */
const requiredRule = (v: unknown) =>
  (typeof v === 'string' ? !!v.trim() : Array.isArray(v) ? v.length > 0 : !!v) || t('validation.required')
const thresholdRules = [
  requiredRule,
  (v: string) => {
    const s = String(v ?? '').trim()
    const n = parseInt(s, 10)
    return (INT_RE.test(s) && n >= 1 && n <= 65535) || t('monitorAlarm.srvHangMonitor.validation.thresholdRange')
  },
]

const envModel = computed<string | undefined>({
  get: () => form.environment || undefined,
  set: (v) => {
    form.environment = typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
  },
})
const priorityModel = computed<string | undefined>({
  get: () => form.priority || undefined,
  set: (v) => {
    form.priority = typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
  },
})

/** 确认：左区+通知编辑器双校验（仅行内红字）→ 新增 POST / 编辑 PUT → 成功重拉 list 回 idle（无 toast，文档口径） */
async function confirm() {
  if (saving.value || disabled.value) return
  const { valid } = await formRef.value.validate()
  if (!valid) return
  const alarmOk = await editorRef.value?.validate()
  if (!alarmOk) return
  saving.value = true
  const input: ServerHangMonitorCfgRo = {
    environment: form.environment,
    maxDelay: parseInt(form.maxDelay.trim(), 10),
    maxRuleCost: parseInt(form.maxRuleCost.trim(), 10),
    priority: form.priority,
    alarmCfg: { ...alarmDraft.value },
  }
  try {
    if (mode.value === 'add') await createSrvHangMonitorCfg(input)
    else await updateSrvHangMonitorCfg(input)
    cancel() // 回 idle（清空+全禁用）
    await loadList()
  } catch (e) {
    // 传输失败已由全局 Dialog 呈现；业务失败（唯一键冲突等）Toast，卡片保留可改可重试
    showOpError(e)
  } finally {
    saving.value = false
  }
}

/* ===== 删除：Warning 确认框（非立即生效+告警保留，文案与文档01 同口径） ===== */
async function onDelete(row: ServerHangMonitorCfgDto) {
  const okDel = await dialog.confirm({
    title: t('common.delete'),
    message: t('monitorAlarm.srvHangMonitor.warn.deleteMsg'),
    okText: t('common.delete'),
    tone: 'warning',
  })
  if (!okDel) return
  try {
    await deleteSrvHangMonitorCfg(row.environment)
    // 删除的正是卡片在编/在看行 → 回 idle
    if (form.environment === row.environment && mode.value !== 'idle') cancel()
    await loadList()
  } catch (e) {
    showOpError(e)
  }
}
</script>

<template>
  <section class="shm-page vui-fill">
    <!-- 表格卡：全量清单（无分页条），错误条+重试恒显于表格上方 -->
    <FvCard class="shm-result">
      <FvAlertStrip
        v-if="loadError"
        kind="error"
        class="ma-4"
        :title="t('monitorAlarm.srvHangMonitor.states.errorTitle')"
      >
        <FvNormalButton size="small" color="error" variant="text" @click="loadList()">
          {{ t('common.retry') }}
        </FvNormalButton>
      </FvAlertStrip>
      <div class="shm-table">
        <FvTable
          v-model:selected="selected"
          :data="rows"
          :loading="loading"
          :insert="onInsert"
          refresh
          select-mode="single"
          @refresh="loadList()"
          @edit="enterEdit"
          @view="enterView"
          @delete="onDelete"
        >
          <FvTableHeader :title="t('monitorAlarm.srvHangMonitor.columns.environment')" data-key="environment" />
          <!-- 阈值列：数值 + s 后缀（文档 §3.2） -->
          <FvTableHeader :title="t('monitorAlarm.srvHangMonitor.columns.maxDelay')" data-key="maxDelay" header-type="custom">
            <template #default="{ item }">
              <span class="shm-cell-seconds">{{ (item as ServerHangMonitorCfgDto).maxDelay }}{{ t('common.seconds') }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader
            :title="t('monitorAlarm.srvHangMonitor.columns.maxRuleCost')"
            data-key="maxRuleCost"
            header-type="custom"
          >
            <template #default="{ item }">
              <span class="shm-cell-seconds">{{ (item as ServerHangMonitorCfgDto).maxRuleCost }}{{ t('common.seconds') }}</span>
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('monitorAlarm.srvHangMonitor.columns.priority')" data-key="priority" header-type="custom">
            <template #default="{ item }">
              <AlarmPriorityBadge :priority="(item as ServerHangMonitorCfgDto).priority" />
            </template>
          </FvTableHeader>
          <FvTableHeader :title="t('monitorAlarm.srvHangMonitor.columns.lastUpdatedBy')" data-key="lastUpdatedBy" />
          <FvTableHeader :title="t('monitorAlarm.srvHangMonitor.columns.lastUpdatedAt')" data-key="lastUpdatedAt" />
          <FvTableHeader header-type="action" :actions="['edit', 'view', 'delete']" />
        </FvTable>
      </div>
    </FvCard>

    <!-- 行内编辑卡（非弹窗，文档 §3.2/§3.3）：左区四字段 + 右区通知配置 + 右下 取消/确认 -->
    <FvCard border class="shm-editor">
      <div class="shm-editor__body">
        <v-form ref="formRef" class="shm-editor__fields" @submit.prevent="confirm">
          <FvTextSelect
            v-model="envModel"
            :items="envOptions"
            :label="t('monitorAlarm.srvHangMonitor.columns.environment')"
            :hint="t('monitorAlarm.srvHangMonitor.form.environmentHint')"
            show-hint
            :rules="[requiredRule]"
            required
            :disabled="envDisabled"
          />
          <FvTextSelect
            v-model="priorityModel"
            :items="priorityOptions"
            :label="t('monitorAlarm.srvHangMonitor.columns.priority')"
            :rules="[requiredRule]"
            required
            :disabled="disabled"
          />
          <FvTextInput
            v-model="form.maxDelay"
            :label="t('monitorAlarm.srvHangMonitor.columns.maxDelay')"
            :hint="t('monitorAlarm.srvHangMonitor.form.maxDelayHint')"
            show-hint
            :rules="thresholdRules"
            required
            :disabled="disabled"
          />
          <FvTextInput
            v-model="form.maxRuleCost"
            :label="t('monitorAlarm.srvHangMonitor.columns.maxRuleCost')"
            :hint="t('monitorAlarm.srvHangMonitor.form.maxRuleCostHint')"
            show-hint
            :rules="thresholdRules"
            required
            :disabled="disabled"
          />
        </v-form>
        <div class="shm-editor__alarm">
          <AlarmCfgEditor ref="editorRef" v-model="alarmDraft" :disabled="disabled" />
        </div>
      </div>
      <div class="shm-editor__actions">
        <FvNormalButton @click="cancel">{{ t('common.cancel') }}</FvNormalButton>
        <FvPrimaryButton :loading="saving" :disabled="disabled" @click="confirm">
          {{ t('common.confirm') }}
        </FvPrimaryButton>
      </div>
    </FvCard>
  </section>
</template>

<style scoped>
/* 满高布局链：表格卡吃掉剩余高（内部滚动），编辑卡自然高度恒显底部 */
.shm-page {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* 表格卡保底高（2026-11-11 修：编辑卡列表化长高后把 min-height:0 的表格卡挤到 2px、
   表头整行不可见——用户报「默认不显示表头」；保底 280px = 表头+数行+分页条） */
.shm-result {
  flex: 1 1 auto;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--vui-radius-s);
}

.shm-table {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.shm-table :deep(.fv-table) {
  margin: 5px;
}

.shm-cell-seconds {
  font-variant-numeric: tabular-nums;
}

/* 编辑卡：左右两区 + 底部右对齐按钮行；**超高可收缩+body 内部滚动**（2026-11-11：
   四字段列表化后自然高超一屏，原 flex:0 0 auto 不收缩会挤死表格卡）；按钮行在滚动区外恒显 */
.shm-editor {
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--vui-radius-s);
}

.shm-editor__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  align-items: flex-start;
  gap: 24px;
  padding: 12px 16px 0;
}

.shm-editor__fields {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
}

.shm-editor__alarm {
  flex: 1 1 auto;
  min-width: 0;
}

.shm-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 16px 12px;
}
</style>
