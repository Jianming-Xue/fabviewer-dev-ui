<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvRadioGroup from '@/shared/components/FvRadioGroup.vue'
import FvRadio from '@/shared/components/FvRadio.vue'
import { showOpError } from '@/shared/api/opError'
import { createSrvHangCfg, updateSrvHangCfg } from '@/api/log-service/requests/srvHangCfg'
import { applyMatchMode, splitMatchMode, type MatchMode } from '../matchMode'
import type { SrvHangCfgDto } from '@/api/log-service/types/types'

/**
 * 服务挂起原因配置 新增/编辑二合一弹窗（2026-10-27 定稿：原页面底部配置控件区表单迁入弹窗，
 * 经 openInteractiveDialog 打开；标题随进入方式切换；单列自上而下布局，宽度走基座默认 420）。
 * 提交收口在本组件（同 RoleEditDialog 模式）：Confirm 即调接口（新增 id=null / 编辑 id=选中行），
 * 成功 → emit('resolve', 落库后的 Dto) + 关窗（页面只做表格回显）；失败 → showOpError 留窗可重试。
 * 匹配方式四选单选（§4.2）：% 拼装提交 / 回显拆分（matchMode.ts）；任一组选「精确匹配」显现三后果警告条（§3）；
 * 5 分钟生效提示（§6）置弹窗正文尾部。
 */
const props = defineProps<{ row?: SrvHangCfgDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: SrvHangCfgDto] }>()

const { t } = useI18n()
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

/** 精确匹配三后果警告（§3）：任一标志行单选落在「精确匹配」即显现 */
const showExactWarn = computed(() => form.startMode === 'exact' || form.endMode === 'exact')

const matchOptions: { value: MatchMode; label: string }[] = [
  { value: 'leadingFuzzy', label: t('config.match.leading') },
  { value: 'trailingFuzzy', label: t('config.match.trailing') },
  { value: 'bothFuzzy', label: t('config.match.both') },
  { value: 'exact', label: t('config.match.exact') },
]

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  saving.value = true
  const input = {
    id: props.row?.id ?? null,
    ruleName: form.ruleName,
    hangReason: form.hangReason,
    startLineLike: applyMatchMode(form.startText, form.startMode),
    endLineLike: applyMatchMode(form.endText, form.endMode),
  }
  try {
    const saved = editing ? await updateSrvHangCfg(input) : await createSrvHangCfg(input)
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
      <FvTextInput
        v-model="form.ruleName"
        :label="t('config.form.ruleName')"
        :rules="ruleNameRules"
        :hint="t('config.form.ruleNameHint')"
        show-hint
        required
        counter="255"
      />
      <FvTextInput
        v-model="form.hangReason"
        :label="t('config.form.hangReason')"
        :rules="hangReasonRules"
        :hint="t('config.form.hangReasonHint')"
        show-hint
        required
        counter="255"
      />
      <FvTextInput
        v-model="form.startText"
        :label="t('config.form.startLine')"
        :rules="lineLikeRules"
        :hint="t('config.form.lineLikeHint')"
        show-hint
        required
        counter="4000"
      />
      <!-- 匹配方式单选（§4.2）：FvRadio 族（选中色/尺寸内部收口；label 走 FvTextInput 同套组织） -->
      <FvRadioGroup v-model="form.startMode" inline :label="t('config.form.matchMode')">
        <FvRadio v-for="opt in matchOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
      </FvRadioGroup>
      <FvTextInput
        v-model="form.endText"
        :label="t('config.form.endLine')"
        :rules="lineLikeRules"
        :hint="t('config.form.lineLikeHint')"
        show-hint
        required
        counter="4000"
      />
      <FvRadioGroup v-model="form.endMode" inline :label="t('config.form.matchMode')">
        <FvRadio v-for="opt in matchOptions" :key="opt.value" :value="opt.value" :label="opt.label" />
      </FvRadioGroup>

      <!-- 精确匹配三后果警告（§3）：任一组选「精确匹配」即显现 -->
      <div v-if="showExactWarn" class="shc-exact-warn" role="note">
        <v-icon icon="fas fa-circle-exclamation" color="warning" size="small" />
        <ul>
          <li>{{ t('config.form.exactWarn1') }}</li>
          <li>{{ t('config.form.exactWarn2') }}</li>
          <li>{{ t('config.form.exactWarn3', { chars: '%…%' }) }}</li>
        </ul>
      </div>

      <!-- 5 分钟生效提示（§6）：动作发生处告知 -->
      <div class="text-caption text-medium-emphasis d-flex align-center ga-1">
        <v-icon icon="fas fa-clock" size="x-small" />
        {{ t('config.delayHint') }}
      </div>
    </v-form>

    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 精确匹配警告条：警告色 12% 混透明底 + 控件档圆角，颜色全走令牌 */
.shc-exact-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 3px 7px;
  padding: 8px 12px;
  border-radius: var(--vui-radius-s);
  background: color-mix(in srgb, var(--vui-warning) 12%, transparent);
}

.shc-exact-warn ul {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vui-text);
}
</style>
