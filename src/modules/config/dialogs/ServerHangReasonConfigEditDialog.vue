<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvRadioGroup from '@/shared/components/FvRadioGroup.vue'
import FvRadio from '@/shared/components/FvRadio.vue'
import { showOpError } from '@/shared/api/opError'
import { createSrvHangConfig, updateSrvHangConfig } from '@/api/telemetry-hub/requests/srvHangConfigRequest'
import { applyMatchMode, splitMatchMode, type MatchMode } from '../matchMode'
import type { ServerHangConfigDto } from '@/api/telemetry-hub/types/srvHangConfigTypes'

/**
 * 服务挂起原因配置 新增/编辑二合一弹窗（2026-10-27 定稿：原页面底部配置控件区表单迁入弹窗，
 * 经 openInteractiveDialog 打开；标题随进入方式切换；单列自上而下布局，宽度走基座默认 420）。
 * 提交收口在本组件（同 RoleEditDialog 模式）：Confirm 即调接口（新增 id=null / 编辑 id=选中行），
 * 成功 → emit('resolve', 落库后的 Dto) + 关窗（页面只做表格回显）；失败 → showOpError 留窗可重试。
 * 匹配方式四选单选（§4.2）：% 拼装提交 / 回显拆分（matchMode.ts）；精确匹配三后果说明（§3）改由
 * 匹配方式 Hint 问号 tooltip 承载（2026-11-05 用户定稿移除底部警告条）；Start/End 标志行改 comment 多行形态（同日）；
 * 编辑态禁改 Rule Name（输入框禁用，2026-11-05 定稿）；Hang Reason 维持自由文本输入
 * （候选下拉 manualInput 方案同日回滚，用户另想办法；/hang_reason/list 请求函数保留在接口层备用）。
 * 5 分钟生效提醒（§6，2026-11-05 用户定稿改版）：原正文尾部静态文案移除，改 Confirm 时先弹
 * Warning 确认框（语义五件套 confirm + tone:'warning'，层叠于本弹窗之上）——确认才提交、取消不提交留窗。
 */
const props = defineProps<{ row?: ServerHangConfigDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: ServerHangConfigDto] }>()

const { t } = useI18n()
const dialog = useModalDialog()
const formRef = ref()
const editing = !!props.row
const saving = ref(false)

const startSeed = props.row ? splitMatchMode(props.row.startLineLike) : null
const endSeed = props.row ? splitMatchMode(props.row.endLineLike) : null

const form = reactive({
  ruleName: props.row?.ruleName ?? '',
  hangReason: props.row?.hangReason ?? '',
  startText: startSeed?.text ?? '',
  startMode: (startSeed?.mode ?? 'bothFuzzy') as MatchMode,
  endText: endSeed?.text ?? '',
  endMode: (endSeed?.mode ?? 'bothFuzzy') as MatchMode,
})

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

const matchOptions: { value: MatchMode; label: string }[] = [
  { value: 'leadingFuzzy', label: t('config.match.leading') },
  { value: 'trailingFuzzy', label: t('config.match.trailing') },
  { value: 'bothFuzzy', label: t('config.match.both') },
  { value: 'exact', label: t('config.match.exact') },
]

/** 匹配方式 Hint（用户定稿 2026-11-05）：问号 tooltip 说明当前选中方式的提交语义，随选择切换 */
const MATCH_HINT_KEYS: Record<MatchMode, string> = {
  leadingFuzzy: 'config.matchHint.leading',
  trailingFuzzy: 'config.matchHint.trailing',
  bothFuzzy: 'config.matchHint.both',
  exact: 'config.matchHint.exact',
}
const matchHint = (mode: MatchMode): string => t(MATCH_HINT_KEYS[mode])

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  // 5 分钟生效提醒（2026-11-05 用户定稿）：Confirm 先弹 Warning 确认框——确认才提交，取消不提交、弹窗保留
  const warned = await dialog.confirm({
    title: t('config.warn.effectTitle'),
    message: t('config.warn.effectMsg'),
    okText: t('common.confirm'),
    tone: 'warning',
  })
  if (!warned) return
  saving.value = true
  const input = {
    id: props.row?.id ?? null,
    ruleName: form.ruleName,
    hangReason: form.hangReason,
    startLineLike: applyMatchMode(form.startText, form.startMode),
    endLineLike: applyMatchMode(form.endText, form.endMode),
  }
  try {
    const saved = editing ? await updateSrvHangConfig(input) : await createSrvHangConfig(input)
    emit('resolve', saved)
    open.value = false
  } catch (e) {
    // 传输失败已由全局 Dialog 呈现；业务失败（如唯一键冲突）Toast，弹窗保留可改可重试
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="editing ? t('config.form.titleEditing') : t('config.form.title')"
    center-title
  >
    <!-- 单列自上而下（用户定稿 2026-10-27）：Rule Name → Hang Reason → Start 输入 → Start 匹配方式
         → End 输入 → End 匹配方式；块级堆叠走 .vui-form-col（与栅格同节奏）；宽度走基座默认 420 -->
    <v-form ref="formRef" class="pt-1 vui-form-col" @submit.prevent="save">
      <!-- 编辑态禁改 Rule Name（用户定稿 2026-11-05）：禁用输入框，仅新增可录 -->
      <FvTextInput
        v-model="form.ruleName"
        :label="t('config.columns.ruleName')"
        :rules="ruleNameRules"
        :hint="t('config.form.ruleNameHint')"
        show-hint
        required
        counter="255"
        :disabled="editing"
      />
      <FvTextInput
        v-model="form.hangReason"
        :label="t('config.columns.hangReason')"
        :rules="hangReasonRules"
        :hint="t('config.form.hangReasonHint')"
        show-hint
        required
        counter="255"
      />
      <!-- Start/End 标志行改多行（comment 形态，用户定稿 2026-11-05）：长日志文本软换行可视 -->
      <FvTextInput
        v-model="form.startText"
        :label="t('config.columns.startLineLike')"
        :rules="lineLikeRules"
        :hint="t('config.form.lineLikeHint')"
        show-hint
        required
        counter="4000"
        type="comment"
      />
      <!-- 匹配方式单选（§4.2）：FvRadio 族（选中色/尺寸内部收口；label 走 FvTextInput 同套组织） -->
      <FvRadioGroup v-model="form.startMode" inline :label="t('config.form.matchMode')" show-hint :hint="matchHint(form.startMode)">
        <FvRadio v-for="opt in matchOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
      </FvRadioGroup>
      <FvTextInput
        v-model="form.endText"
        :label="t('config.columns.endLineLike')"
        :rules="lineLikeRules"
        :hint="t('config.form.lineLikeHint')"
        show-hint
        required
        counter="4000"
        type="comment"
      />
      <FvRadioGroup v-model="form.endMode" inline :label="t('config.form.matchMode')" show-hint :hint="matchHint(form.endMode)">
        <FvRadio v-for="opt in matchOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
      </FvRadioGroup>

    </v-form>

    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

