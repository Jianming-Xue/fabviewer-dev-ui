<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvStringListEditor from '@/shared/components/FvStringListEditor.vue'

import type { AlarmCfgRo } from '@/api/telemetry-hub/types/alarmCfgTypes'

/**
 * 告警通知配置编辑器（模块2 · 01 §3.4 公共组件，2026-11-10 新建）：MES日志监控配置弹窗 Tab2 与
 * MES服务挂起监控配置行内编辑卡右区共用。三段分隔线布局（自上而下）：
 * ① 通知间隔（分）——必填整数 1~99999，默认值 5（由消费方播种）；
 * ② 邮件通知——收件人 To / 抄送 CC；③ 飞书通知——群 webhook / @人：**四字段统一 FvStringListEditor
 *   行式列表**（2026-11-11 用户定稿换掉 chips/textarea 形态）：行提交固化、末行加号增、trash 删；
 *   email 逐条格式校验、webhook 逐行 ^https://open.feishu.cn/open-apis/bot/v2/hook/ 前缀校验
 *   （chips 时代的即时 rules 气泡改为**提交固化时点的 computed 红字**——编辑器出参只在提交/删除时同步）；
 *   @人（**2026-11-11 用户定稿更名「特别提醒」**）不做硬校验（后端校验规则第 8 条只查 email/webhook）；
 *   原飞书群格下常驻灰提示退役、文案转特别提醒字段的问号 Hint（feishuAtHint 原样迁移）。
 *   全可空（空=不发邮件/不推飞书）。序列化 ≤4000 校验保留（computed 红字同轨）。
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
    feishuWebhooks: model.value.feishuWebhooks ?? [],
    feishuAtUsers: model.value.feishuAtUsers ?? [],
    notifyInterval: model.value.notifyInterval,
    ...patch,
  }
  lastEmitted = JSON.stringify(next)
  model.value = next
}

/* ===== 列表四字段代理（To / CC / webhook / @人）：读写直通 model ===== */
function listProxy(key: 'mailToUsers' | 'mailCCUsers' | 'feishuAtUsers' | 'feishuWebhooks') {
  return computed<string[]>({
    get: () => model.value[key] ?? [],
    set: (v) => commit({ [key]: v }),
  })
}
const mailToModel = listProxy('mailToUsers')
const mailCcModel = listProxy('mailCCUsers')
const feishuAtModel = listProxy('feishuAtUsers')
const webhooksModel = listProxy('feishuWebhooks')

/* ===== 间隔草稿即输即提交（非法文本留框内由 rules 红字拦，validate() 兜底） ===== */
watch(intervalText, (s) => {
  if (INT_RE.test(s.trim()) && s.trim()) commit({ notifyInterval: parseInt(s.trim(), 10) })
})

/* ===== 校验（文档 §3.4/§4.3-8：全组件内收口） ===== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WEBHOOK_RE = /^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\//

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

/** 列表字段红字（2026-11-11 列表化后）：FvStringListEditor 出参只在行提交/删除时同步，
 *  校验改 computed 跟 model 走——固化行落地即评，空串=通过；validate() 汇总同一批 computed */
function firstErr(...results: (true | string)[]): string {
  for (const r of results) if (r !== true) return r
  return ''
}
const mailToError = computed(() => firstErr(mailRule(model.value.mailToUsers), serializedOk(model.value.mailToUsers)))
const mailCcError = computed(() => firstErr(mailRule(model.value.mailCCUsers), serializedOk(model.value.mailCCUsers)))
const webhookError = computed(() => {
  const list = model.value.feishuWebhooks ?? []
  const bad = list.filter((u) => !WEBHOOK_RE.test(u))
  return firstErr(
    bad.length ? t('monitorAlarm.alarm.validation.webhookInvalid', { list: bad.join('、') }) : true,
    serializedOk(list),
  )
})
const feishuAtError = computed(() => firstErr(serializedOk(model.value.feishuAtUsers)))
const listErrors = computed(() => [mailToError.value, mailCcError.value, webhookError.value, feishuAtError.value])

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
    <!-- To/CC/webhook/@人四字段统一 FvStringListEditor（2026-11-11 用户定稿）；
         **To+CC 一行、webhook+@人 一行**（同日用户定稿两列排布，vui-form-grid 通用栅格）；
         校验红字跟 computed 走（编辑器出参在行提交/删除时同步），红字挂各自格内 -->
    <div class="vui-form-grid">
      <div>
        <FvStringListEditor
          v-model="mailToModel"
          :label="t('monitorAlarm.alarm.mailTo')"
          height="140px"
          :disabled="props.disabled"
        />
        <p v-if="mailToError" class="ace__error">{{ mailToError }}</p>
      </div>
      <div>
        <FvStringListEditor
          v-model="mailCcModel"
          :label="t('monitorAlarm.alarm.mailCc')"
          height="140px"
          :disabled="props.disabled"
        />
        <p v-if="mailCcError" class="ace__error">{{ mailCcError }}</p>
      </div>
    </div>

    <div class="ace__divider"><span>{{ t('monitorAlarm.alarm.feishuSection') }}</span></div>
    <div class="vui-form-grid">
      <div>
        <!-- 飞书群 webhook：一行一地址（列表化后天然一行一条，textarea 形态退役） -->
        <FvStringListEditor
          v-model="webhooksModel"
          :label="t('monitorAlarm.alarm.feishuWebhooks')"
          :hint="t('monitorAlarm.alarm.webhookHint')"
          show-hint
          height="140px"
          :disabled="props.disabled"
        />
        <p v-if="webhookError" class="ace__error">{{ webhookError }}</p>
      </div>
      <!-- 特别提醒（原 @ 人，2026-11-11 用户定稿更名）：原 webhook 格下常驻灰提示转为
           本字段问号 Hint（feishuAtHint 文案原样迁移） -->
      <div>
        <FvStringListEditor
          v-model="feishuAtModel"
          :label="t('monitorAlarm.alarm.feishuAtUsers')"
          :hint="t('monitorAlarm.alarm.feishuAtHint')"
          show-hint
          height="140px"
          :disabled="props.disabled"
        />
        <p v-if="feishuAtError" class="ace__error">{{ feishuAtError }}</p>
      </div>
    </div>
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

/* 列表字段校验红字（computed 跟 model 走，2026-11-11 列表化后取代 rules 气泡） */
.ace__error {
  margin: 4px 3px 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--vui-error);
}
</style>
