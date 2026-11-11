<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvStringListEditor from '@/shared/components/FvStringListEditor.vue'
import FvKeyValueEditor from '@/shared/components/FvKeyValueEditor.vue'

import type { AlarmCfgRo } from '@/api/telemetry-hub/types/alarmCfgTypes'

/**
 * 告警通知配置编辑器（模块2 · 01 §3.4 公共组件，2026-11-10 新建）：MES日志监控配置弹窗 Tab2 与
 * MES服务挂起监控配置行内编辑卡右区共用。三段分隔线布局（自上而下）：
 * ① 通知间隔（分）——必填整数 1~99999，默认值 5（由消费方播种）；
 * ② 邮件通知——收件人 To / 抄送 CC 两 FvStringListEditor 行式列表（2026-11-11 用户定稿）：行提交固化、
 *   末行加号增、trash 删；email 逐条格式校验走 **rowRule 提交时点初拦**（2026-11-12 焦点一致性批：
 *   不固化、行留编辑态、焦点保留——此前 computed 跟已固化 model 走，坏 email 先落地丢焦点）；
 *   computed error 兜底外部播种坏数据 + 序列化 ≤4000；
 * ③ 飞书通知——**feishuGroups 单字段 Key-Value 形态**（2026-11-12 后端契约合并：feishuWebhooks+feishuAtUsers→
 *   feishuGroups Json Map；**Key=飞书组名（webhook 地址前端不再经手、原前缀校验退役，后端侧解析组→机器人）**、
 *   Value=该组内需 @ 的人 open_id 列表；UI 走 shared **FvKeyValueEditor**（同日因第二跨模块消费方升回 shared）：
 *   左列组名可选可增删不可改名、右列 @人 可增改删；「@ 的人须在对应群里」文案挂右列问号 Hint（feishuAtHint）。
 *   全可空（空=不发邮件/不推飞书）。序列化 ≤4000 校验保留（computed 红字同轨，Map 走整体序列化）。
 * 校验全收口本组件（间隔字段 rules 行内红字气泡 + 列表字段 computed 红字 + validate() 汇总供消费方提交时调用），
 * 消费方只管读写值——v-model 与 AlarmCfgRo/AlarmCfgDto 同形（文档契约）。
 * 模块级组件（两消费方均在 config 模块内，按 shared/Fv 门槛惯例不升 shared）。
 * 外部整体改写 model（编辑回填/清空复位）即重播种内部文本草稿——挂起监控行内卡同实例反复
 * add/edit/view 切态，防 mount-only-seeding 跨态污染（vue-oneway-model-drift 坑既有契约）。
 */
const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })

const model = defineModel<AlarmCfgRo>({ required: true })

const { t } = useI18n()
const formRef = ref()

/* ===== 内部文本草稿（间隔数值串 ↔ wire 形态互转；webhook 多行文本草稿 2026-11-11 随列表化退役） ===== */
const INT_RE = /^\d+$/
const intervalText = ref(model.value.notifyInterval == null ? '' : String(model.value.notifyInterval))

/** 最近一次本组件主动写出的 model JSON：watch 回声不再播种（防自激循环） */
let lastEmitted = JSON.stringify(model.value)

function seed() {
  intervalText.value = model.value.notifyInterval == null ? '' : String(model.value.notifyInterval)
}

watch(
  model,
  (m) => {
    const snap = JSON.stringify(m)
    if (snap === lastEmitted) return
    lastEmitted = snap
    seed()
  },
  { deep: true },
)

/** 局部写回：整对象替换（defineModel 对象深层直改不发 update） */
function commit(patch: Partial<AlarmCfgRo>) {
  const next: AlarmCfgRo = {
    mailToUsers: model.value.mailToUsers ?? [],
    mailCCUsers: model.value.mailCCUsers ?? [],
    feishuGroups: model.value.feishuGroups ?? {},
    notifyInterval: model.value.notifyInterval,
    ...patch,
  }
  lastEmitted = JSON.stringify(next)
  model.value = next
}

/* ===== 列表两字段代理（To / CC）：读写直通 model ===== */
function listProxy(key: 'mailToUsers' | 'mailCCUsers') {
  return computed<string[]>({
    get: () => model.value[key] ?? [],
    set: (v) => commit({ [key]: v }),
  })
}
const mailToModel = listProxy('mailToUsers')
const mailCcModel = listProxy('mailCCUsers')

/** 飞书组 Map 代理（2026-11-12 feishuGroups 契约）：读写直通 model，FvKeyValueEditor 消费 */
const feishuGroupsModel = computed<Record<string, string[]>>({
  get: () => model.value.feishuGroups ?? {},
  set: (v) => commit({ feishuGroups: v }),
})

/* ===== 间隔草稿即输即提交（非法文本留框内由 rules 红字拦，validate() 兜底） ===== */
watch(intervalText, (s) => {
  if (INT_RE.test(s.trim()) && s.trim()) commit({ notifyInterval: parseInt(s.trim(), 10) })
})

/* ===== 校验（文档 §3.4/§4.3-8：全组件内收口） ===== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const intervalRules = [
  (v: string) => !!String(v ?? '').trim() || t('validation.required'),
  (v: string) => {
    const s = String(v ?? '').trim()
    const n = parseInt(s, 10)
    return (INT_RE.test(s) && n >= 1 && n <= 99999) || t('monitorAlarm.alarm.validation.intervalRange')
  },
]

/** 序列化 ≤4000（三个 JSON 数组字段共用，文档校验规则第 4 条） */
function serializedOk(v: string[] | undefined): true | string {
  return JSON.stringify(v ?? []).length <= 4000 || t('monitorAlarm.alarm.validation.serializedTooLong')
}

function mailRule(v: string[] | undefined): true | string {
  const bad = (v ?? []).filter((m) => !EMAIL_RE.test(m))
  return bad.length ? t('monitorAlarm.alarm.validation.emailInvalid', { list: bad.join('、') }) : true
}

/** email 提交初校验（2026-11-12 焦点一致性批）：单行提交时点拦非法格式——**不固化、行留编辑态、
 *  焦点保留**（与 open_id rowRule 同款交互；此前仅 computed 跟已固化 model 走，坏 email 先落地、
 *  编辑行转只读 input 消失 → 焦点丢，用户报障）；mailRule computed 保留作外部播种坏数据的兜底角标 */
const emailRowRule = (v: string): string =>
  EMAIL_RE.test(v) ? '' : t('monitorAlarm.alarm.validation.emailInvalid', { list: v })

/** 列表字段红字（2026-11-11 列表化后）：FvStringListEditor 出参只在行提交/删除时同步，
 *  校验改 computed 跟 model 走——固化行落地即评，空串=通过；validate() 汇总同一批 computed */
function firstErr(...results: (true | string)[]): string {
  for (const r of results) if (r !== true) return r
  return ''
}
const mailToError = computed(() => firstErr(mailRule(model.value.mailToUsers), serializedOk(model.value.mailToUsers)))
const mailCcError = computed(() => firstErr(mailRule(model.value.mailCCUsers), serializedOk(model.value.mailCCUsers)))
/** open_id 提交初校验（2026-11-12 用户定稿：点勾提交时初步格式校验，不过关不固化+红字）：
 *  ou_ 前缀 + 字母数字尾段（飞书 open_id 口径的宽松前端初筛，严格校验归后端） */
const OPEN_ID_RE = /^ou_[0-9a-zA-Z]+$/
const openIdRule = (v: string): string =>
  OPEN_ID_RE.test(v) ? '' : t('monitorAlarm.alarm.validation.openIdRule')

/** 飞书组 Map 序列化 ≤4000（2026-11-12 feishuGroups 契约；整体序列化含组名与 open_id） */
const feishuGroupsError = computed(() =>
  JSON.stringify(model.value.feishuGroups ?? {}).length <= 4000
    ? ''
    : t('monitorAlarm.alarm.validation.serializedTooLong'),
)
const listErrors = computed(() => [mailToError.value, mailCcError.value, feishuGroupsError.value])

/** 提交前汇总校验（消费方调用）：true=全部通过；false=行内红字已就位、留在原页签/卡片 */
async function validate(): Promise<boolean> {
  const { valid } = await formRef.value.validate()
  return !!valid && !listErrors.value.some(Boolean)
}

/** 清校验红字（消费方复位/切态时可选调用） */
function resetValidation() {
  formRef.value?.resetValidation()
}

defineExpose({ validate, resetValidation })
</script>

<template>
  <!-- 自带 v-form：校验闭环组件内（消费方表单与本组件平级摆放、不嵌套 form） -->
  <v-form ref="formRef" class="ace" @submit.prevent>
    <!-- ① 通知间隔（最上，无节标题，文档 §3.4） -->
    <FvTextInput
      v-model="intervalText"
      clear
      :label="t('monitorAlarm.alarm.interval')"
      :rules="intervalRules"
      :hint="t('monitorAlarm.alarm.intervalHint')"
      show-hint
      required
      :disabled="props.disabled"
    />

    <div class="ace__divider"><span>{{ t('monitorAlarm.alarm.mailSection') }}</span></div>
    <!-- To/CC 两字段 FvStringListEditor（2026-11-11 用户定稿）同行两列（vui-form-grid 通用栅格）；
         rowRule 提交时点拦非法格式（不固化留编辑、焦点保留，2026-11-12 与 open_id 对齐）；
         computed error 兜底外部播种的坏数据（编辑回填），红字挂各自格内 -->
    <div class="vui-form-grid">
      <div>
        <FvStringListEditor
          v-model="mailToModel"
          :label="t('monitorAlarm.alarm.mailTo')"
          height="140px"
          :disabled="props.disabled"
          :row-rule="emailRowRule"
          :error="mailToError"
        />
      </div>
      <div>
        <FvStringListEditor
          v-model="mailCcModel"
          :label="t('monitorAlarm.alarm.mailCc')"
          height="140px"
          :disabled="props.disabled"
          :row-rule="emailRowRule"
          :error="mailCcError"
        />
      </div>
    </div>

    <div class="ace__divider"><span>{{ t('monitorAlarm.alarm.feishuSection') }}</span></div>
    <!-- 飞书组 feishuGroups（2026-11-12 后端契约合并）：Key-Value 双列走 shared FvKeyValueEditor——
         Key=组名（可选/增/删、不可改名），Value=该组 @ 的人 open_id（增/改/删）；webhook 地址前端契约退役 -->
    <FvKeyValueEditor
      v-model="feishuGroupsModel"
      :key-label="t('monitorAlarm.alarm.feishuGroupKey')"
      :value-label="t('monitorAlarm.alarm.feishuGroupValue')"
      :value-hint="t('monitorAlarm.alarm.feishuGroupValueHint')"
      :value-row-rule="openIdRule"
      :error="feishuGroupsError"
      height="160px"
      :disabled="props.disabled"
    />
  </v-form>
</template>

<style scoped>
.ace {
  display: flex;
  flex-direction: column;
}

/* 节分隔线：细线夹居中弱化小节名（文档「── 邮件通知 ──」观感） */
.ace__divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 0 10px;
  font-size: 12px;
  line-height: 18px;
  color: var(--vui-text-secondary);
  user-select: none;
}

.ace__divider::before,
.ace__divider::after {
  content: '';
  flex: 1 1 auto;
  height: 1px;
  background: var(--vui-border);
}

</style>
