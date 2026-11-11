<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTextSelect from '@/shared/components/FvTextSelect.vue'
import FvStringListEditor from '@/shared/components/FvStringListEditor.vue'
import FvTab from '@/shared/components/FvTab.vue'
import FvNormalButton from '@/shared/components/FvNormalButton.vue'
import FvPrimaryButton from '@/shared/components/FvPrimaryButton.vue'
import { showOpError } from '@/shared/api/opError'
import AlarmCfgEditor from '../components/AlarmCfgEditor.vue'
import {
  createLogMonitorCfg,
  updateLogMonitorCfg,
} from '@/api/telemetry-hub/requests/logMonitorCfgRequest'
import { fetchMiscEnvList, fetchPriorityList } from '@/api/telemetry-hub/requests/systemMiscRequest'

import type { AlarmCfgRo } from '@/api/telemetry-hub/types/alarmCfgTypes'
import type { LogMonitorCfgDto, LogMonitorCfgRo } from '@/api/telemetry-hub/types/logMonitorCfgTypes'

/**
 * MES 日志监控配置 新增/编辑二合一弹窗（模块2 · 01 §3.3，2026-11-10 新建；FvInteractiveDialog 体系，
 * 经 openInteractiveDialog 打开，提交收口本组件——ServerHangReasonConfigEditDialog 同定式：
 * 成功 emit('resolve', 落库 Dto) + 关窗，失败 showOpError 留窗可重试）。
 * 两 Tab（FvTab 受控切换）：
 * - Tab1「Keyword 配置」：Environment/Item 编辑态锁定（行键不可改，改则删了重建）；
 *   Follow/Exclude 三列表走 FvStringListEditor 行式列表（2026-11-11 用户定稿换掉 chips 形态）；
 *   **交叉校验实时红字**（文档 §4.3-7 前端同源）：排除词为 Keyword 子串（大小写敏感）、
 *   Follow∩Exclude Rule 名交集（两字段同时列冲突项）——不过关 Next 不放行；
 * - Tab2「Alarm 配置」：AlarmCfgEditor 公共组件整段嵌入，校验组件内收口。
 * Tab 守卫：点 Tab2 与 Next 同径——先过 Tab1 校验才切页；Previous 回跳不校验、值保留（文档 §3.3）；
 * 底部钮随页签换位：Tab1=取消+Next / Tab2=Previous+取消+确认。
 * 编辑回填：调用方先经 detail 接口取整条（含 alarmCfg，alarmCfg null 时按默认播种、间隔 5）。
 * Cancel 有未提交修改先弹「放弃修改？」确认（SystemMiscEditDialog 同定式）；基座 X/Esc 直关不拦。
 */
/** `view` = 查看态（2026-11-11 用户定稿：表格操作列查看钮开本弹窗、行内容回填、**全部控件禁用**、
 *  底部去确认钮；页签仍可 Next/Previous 翻看两页，翻页跳过校验） */
const props = withDefaults(defineProps<{ row?: LogMonitorCfgDto; view?: boolean }>(), { view: false })

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: LogMonitorCfgDto] }>()

const { t } = useI18n()
const dialog = useModalDialog()
const formRef = ref()
const editorRef = ref<InstanceType<typeof AlarmCfgEditor> | null>(null)
const editing = !!props.row
const saving = ref(false)

/* ===== Tab1 表单（行数据/detail 出参播种） ===== */
const form = reactive({
  environment: props.row?.environment ?? '',
  item: props.row?.item ?? '',
  keyword: props.row?.keyword ?? '',
  description: props.row?.description ?? '',
  priority: props.row?.priority ?? '',
  followRuleNames: [...(props.row?.followRuleNames ?? [])],
  excludeKeywords: [...(props.row?.excludeKeywords ?? [])],
  excludeRuleNames: [...(props.row?.excludeRuleNames ?? [])],
})

/* ===== Tab2 通知配置草稿（alarmCfg null=遗留行，按默认播种：全空 + 间隔 5） ===== */
function seedAlarm(): AlarmCfgRo {
  const a = props.row?.alarmCfg
  return {
    mailToUsers: [...(a?.mailToUsers ?? [])],
    mailCCUsers: [...(a?.mailCCUsers ?? [])],
    feishuWebhooks: [...(a?.feishuWebhooks ?? [])],
    feishuAtUsers: [...(a?.feishuAtUsers ?? [])],
    notifyInterval: a?.notifyInterval ?? 5,
  }
}
const alarmDraft = ref<AlarmCfgRo>(seedAlarm())

/** 脏检查基线：Cancel 时对比（Tab1 表单或通知草稿任一变动 = 有未提交修改） */
const snapshot = (): string => JSON.stringify({ form, alarm: alarmDraft.value })
const initialSnapshot = snapshot()

/* ===== 候选字典（环境=mes.global.environments / 优先级=system.global.priority；silent 失败→空候选） ===== */
const envOptions = ref<string[]>([])
const priorityOptions = ref<string[]>([])
onMounted(async () => {
  const [envs, prios] = await Promise.allSettled([fetchMiscEnvList(), fetchPriorityList()])
  if (envs.status === 'fulfilled') envOptions.value = envs.value
  if (prios.status === 'fulfilled') priorityOptions.value = prios.value
})

/* ===== FvTextSelect model 代理（单选 string|undefined / 多选 string[] 与表单字段互转） ===== */
function singleProxy(key: 'environment' | 'priority') {
  return computed<string | undefined>({
    get: () => form[key] || undefined,
    set: (v) => {
      form[key] = typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
    },
  })
}
const envModel = singleProxy('environment')
const priorityModel = singleProxy('priority')

function listProxy(key: 'followRuleNames' | 'excludeKeywords' | 'excludeRuleNames') {
  return computed<string[]>({
    get: () => form[key],
    set: (v) => {
      form[key] = Array.isArray(v) ? v : v ? [String(v)] : []
    },
  })
}
const followModel = listProxy('followRuleNames')
const excludeKeywordsModel = listProxy('excludeKeywords')
const excludeRuleNamesModel = listProxy('excludeRuleNames')

/* ===== 校验规则（基础项 rules 气泡 + 交叉项红字 <p> 双轨） ===== */
const requiredRule = (v: unknown) =>
  (typeof v === 'string' ? !!v.trim() : Array.isArray(v) ? v.length > 0 : !!v) || t('validation.required')
// 字符集限制 2026-11-11 用户定稿放开（仅留必填+≤30 长度）；mock 同步放宽、真实后端口径联调核对
const itemRules = [requiredRule]
const serializedRule = (v: string[] | undefined) =>
  JSON.stringify(v ?? []).length <= 4000 || t('monitorAlarm.logMonitor.validation.serializedTooLong')

/** 三列表字段序列化红字（2026-11-11 换 FvStringListEditor 后：出参在行提交/删除时同步，
 *  原 rules 气泡改 computed 红字 <p>，与交叉校验同轨；gate 进 gotoAlarm/submit） */
function serErr(v: string[]): string {
  const r = serializedRule(v)
  return r === true ? '' : r
}
const followSerErr = computed(() => serErr(form.followRuleNames))
const exKwSerErr = computed(() => serErr(form.excludeKeywords))
const exRuleSerErr = computed(() => serErr(form.excludeRuleNames))
const hasListErrors = computed(() => Boolean(followSerErr.value || exKwSerErr.value || exRuleSerErr.value))

/** 交叉校验一（文档 §4.3-7a）：排除词为 Keyword 子串或相等（大小写敏感，与运行侧匹配一致） */
const excludeKeywordViolations = computed(() =>
  form.keyword ? form.excludeKeywords.filter((k) => k && form.keyword.includes(k)) : [],
)
/** 交叉校验二（文档 §4.3-7b）：Follow ∩ Exclude Rule 名非空交集 */
const ruleNameConflicts = computed(() =>
  form.followRuleNames.filter((n) => form.excludeRuleNames.includes(n)),
)
const hasCrossErrors = computed(
  () => excludeKeywordViolations.value.length > 0 || ruleNameConflicts.value.length > 0,
)

/* ===== Tab 受控切换（点 Tab2 与 Next 同径：先过 Tab1 校验） ===== */
const activeTab = ref('keyword')
const tabItems = computed(() => [
  { title: t('monitorAlarm.logMonitor.form.tabKeyword'), value: 'keyword' },
  { title: t('monitorAlarm.logMonitor.form.tabAlarm'), value: 'alarm' },
])

async function gotoAlarm(): Promise<boolean> {
  // 查看态翻页跳过校验（库内数据恒合法，且禁用态不该被校验拦路，2026-11-11）
  if (props.view) {
    activeTab.value = 'alarm'
    return true
  }
  const { valid } = await formRef.value.validate()
  if (!valid || hasCrossErrors.value || hasListErrors.value) return false
  activeTab.value = 'alarm'
  return true
}
async function onTabPick(v: string) {
  if (v === activeTab.value) return
  if (v === 'alarm') {
    await gotoAlarm()
    return
  }
  // 回 Tab1 不校验、值保留（Previous 同径）
  activeTab.value = v
}

/* ===== 提交（确认钮只在 Tab2；交叉错误兜底回跳 Tab1） ===== */
async function submit() {
  if (saving.value || props.view) return
  if (hasCrossErrors.value || hasListErrors.value) {
    activeTab.value = 'keyword'
    return
  }
  const alarmOk = await editorRef.value?.validate()
  if (!alarmOk) return
  saving.value = true
  // Ro：可选字段口径——列表恒发（空 [] = 清空，PUT 全量覆盖语义）；description 空置 undefined（联调核对点）
  const input: LogMonitorCfgRo = {
    environment: form.environment,
    item: form.item,
    keyword: form.keyword,
    priority: form.priority,
    excludeKeywords: [...form.excludeKeywords],
    followRuleNames: [...form.followRuleNames],
    excludeRuleNames: [...form.excludeRuleNames],
    alarmCfg: { ...alarmDraft.value },
  }
  if (form.description.trim()) input.description = form.description.trim()
  try {
    const saved = editing ? await updateLogMonitorCfg(input) : await createLogMonitorCfg(input)
    emit('resolve', saved)
    open.value = false
  } catch (e) {
    // 传输失败已由全局 Dialog 呈现；业务失败（唯一键冲突/校验码）Toast，弹窗保留可改可重试
    showOpError(e)
  } finally {
    saving.value = false
  }
}

/** Cancel：查看态直关不提示（无改动可能，2026-11-11）；编辑态有未提交修改先弹「放弃修改？」确认、无修改直关 */
async function cancel() {
  if (props.view) {
    open.value = false
    return
  }
  if (snapshot() !== initialSnapshot) {
    const discard = await dialog.confirm({
      title: t('monitorAlarm.logMonitor.form.discardTitle'),
      message: t('monitorAlarm.logMonitor.form.discardMsg'),
      okText: t('common.confirm'),
    })
    if (!discard) return
  }
  open.value = false
}
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="view ? t('monitorAlarm.logMonitor.form.titleViewing') : editing ? t('monitorAlarm.logMonitor.form.titleEditing') : t('monitorAlarm.logMonitor.form.title')"
    center-title
    :max-width="800"
    :body-scroll="false"
  >
    <!-- 填充链（2026-11-11 用户定稿：滚动限定在页签内容区，Tab 条恒显不随内容滚走）：
         基座 bodyScroll=false → 正文变 flex 列不自滚，本层接管满高、页签内容区自挂滚动 -->
    <div class="lmc-edit">
    <FvTab :model-value="activeTab" :items="tabItems" class="lmc-edit__tabs" @update:model-value="onTabPick" />

    <div class="lmc-edit__scroll">
    <!-- Tab1 · Keyword 配置（两列栅格，vui-form-grid 通用档；v-show 双面板保活=Previous 回跳值不丢） -->
    <div v-show="activeTab === 'keyword'">
      <v-form ref="formRef" class="lmc-edit__form vui-form-grid" @submit.prevent="gotoAlarm">
        <!-- Environment：候选源 Misc mes.global.environments；编辑态锁定（行键） -->
        <FvTextSelect
          v-model="envModel"
          :items="envOptions"
          :label="t('monitorAlarm.logMonitor.columns.environment')"
          :rules="[requiredRule]"
          required
          :disabled="editing || view"
        />
        <!-- Item：≤30 字符（字符集限制 2026-11-11 用户定稿放开）；编辑态锁定（改则删了重建） -->
        <FvTextInput
          v-model="form.item"
          clear
          :label="t('monitorAlarm.logMonitor.columns.item')"
          :rules="itemRules"
          :hint="t('monitorAlarm.logMonitor.form.itemHint')"
          show-hint
          required
          counter="30"
          :maxlength="30"
          :disabled="editing || view"
        />
        <FvTextInput
          v-model="form.keyword"
          clear
          :label="t('monitorAlarm.logMonitor.columns.keyword')"
          :rules="[requiredRule]"
          :hint="t('monitorAlarm.logMonitor.form.keywordHint')"
          show-hint
          required
          counter="30"
          :maxlength="30"
          :disabled="view"
        />
        <FvTextSelect
          v-model="priorityModel"
          :items="priorityOptions"
          :label="t('monitorAlarm.logMonitor.columns.priority')"
          :rules="[requiredRule]"
          required
          :disabled="view"
        />
        <!-- Description：可选 ≤255，多行软换行（comment 形态 Enter 仍=Next 提交） -->
        <div class="lmc-edit__span2">
          <!-- comment 形态不加清除钮（2026-11-11 用户追加定稿，维持 2026-10-16 口径） -->
          <FvTextInput
            v-model="form.description"
            type="comment"
            :label="t('monitorAlarm.logMonitor.columns.description')"
            :disabled="view"
            counter="255"
            :maxlength="255"
          />
        </div>
        <!-- Follow/Exclude 三列表 2026-11-11 用户定稿换 FvStringListEditor（chips 形态退役）；
             序列化红字改 computed <p>（编辑器出参在行提交/删除时同步），交叉红字照旧 -->
        <!-- Follow/Exclude 三列表 2026-11-11 用户定稿换 FvStringListEditor（chips 形态退役）；
             序列化红字改 computed <p>（编辑器出参在行提交/删除时同步），交叉红字照旧；
             **行分配（2026-11-11 用户定稿二批）：关注 Rule 名称 + 排除 Rule 名称 同行两列、排除关键字单独一行跨两列** -->
<!-- Follow Rule Name：Rule 级白名单（空=不限制）；交集冲突红字同时挂两侧 -->
        <div>
          <FvStringListEditor
            v-model="followModel"
            :label="t('monitorAlarm.logMonitor.columns.followRuleNames')"
            :hint="t('monitorAlarm.logMonitor.form.followHint')"
            show-hint
            height="140px"
            :disabled="view"
          />
          <p v-if="followSerErr" class="lmc-edit__error">{{ followSerErr }}</p>
          <p v-if="ruleNameConflicts.length" class="lmc-edit__error">
            {{ t('monitorAlarm.logMonitor.validation.ruleNameConflict', { list: ruleNameConflicts.join('、') }) }}
          </p>
        </div>
        <div>
          <FvStringListEditor
            v-model="excludeRuleNamesModel"
            :label="t('monitorAlarm.logMonitor.columns.excludeRuleNames')"
            :hint="t('monitorAlarm.logMonitor.form.excludeRuleNamesHint')"
            show-hint
            height="140px"
            :disabled="view"
          />
          <p v-if="exRuleSerErr" class="lmc-edit__error">{{ exRuleSerErr }}</p>
          <p v-if="ruleNameConflicts.length" class="lmc-edit__error">
            {{ t('monitorAlarm.logMonitor.validation.ruleNameConflict', { list: ruleNameConflicts.join('、') }) }}
          </p>
        </div>
<!-- Exclude Keywords：词级黑名单；为 Keyword 子串=规则永不触发，实时红字；**单独一行跨两列**（2026-11-11 用户定稿） -->
        <div class="lmc-edit__span2">
          <FvStringListEditor
            v-model="excludeKeywordsModel"
            :label="t('monitorAlarm.logMonitor.columns.excludeKeywords')"
            :hint="t('monitorAlarm.logMonitor.form.excludeKeywordsHint')"
            show-hint
            height="140px"
            :disabled="view"
          />
          <p v-if="exKwSerErr" class="lmc-edit__error">{{ exKwSerErr }}</p>
          <p v-if="excludeKeywordViolations.length" class="lmc-edit__error">
            {{ t('monitorAlarm.logMonitor.validation.excludeSubstring', { list: excludeKeywordViolations.join('、') }) }}
          </p>
        </div>
      </v-form>
    </div>

    <!-- Tab2 · Alarm 配置：公共组件整段嵌入（校验组件内收口，确认钮经 ref 调 validate） -->
    <div v-show="activeTab === 'alarm'" class="lmc-edit__alarm">
      <AlarmCfgEditor ref="editorRef" v-model="alarmDraft" :disabled="view" />
    </div>
    </div><!-- /.lmc-edit__scroll -->
    </div><!-- /.lmc-edit -->

    <!-- 底部钮随页签换位（文档 §3.3）：Tab1=取消+Next / Tab2=Previous+取消+确认 -->
    <template #actions>
      <template v-if="activeTab === 'keyword'">
        <FvNormalButton @click="cancel">{{ t('common.cancel') }}</FvNormalButton>
        <FvNormalButton @click="gotoAlarm">{{ t('common.next') }}</FvNormalButton>
      </template>
      <template v-else>
        <FvNormalButton @click="activeTab = 'keyword'">{{ t('common.prev') }}</FvNormalButton>
        <FvNormalButton @click="cancel">{{ t('common.cancel') }}</FvNormalButton>
        <FvPrimaryButton v-if="!view" :loading="saving" @click="submit">{{ t('common.confirm') }}</FvPrimaryButton>
      </template>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 填充链（2026-11-11 用户定稿：滚动限定在页签内容区）：基座 bodyScroll=false 下
   根层满高占住正文，Tab 条 flex:none 恒显，内容区 flex:1 内部滚动 */
.lmc-edit {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.lmc-edit__tabs {
  flex: none;
  margin: 4px 3px 0;
}

.lmc-edit__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.lmc-edit__form {
  padding-top: 10px;
}

/* Description 独占整行（comment 形态横贯两列） */
.lmc-edit__span2 {
  grid-column: 1 / -1;
}

/* 描述 comment 框降高（2026-11-11 用户定稿「稍微减小点高度」）：108→72（2×36 档）；
   双类+ :deep 特异度压组件内 .fv-text-input--comment 自声明 */
.lmc-edit__span2 :deep(.fv-text-input--comment) {
  --fv-comment-height: 72px;
}

/* 交叉校验实时红字（文档 §3.3：inline red error text） */
.lmc-edit__error {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--vui-error);
}

.lmc-edit__alarm {
  padding: 10px 3px 0;
}
</style>
