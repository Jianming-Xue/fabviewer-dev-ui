<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvSwitch from '@/shared/components/FvSwitch.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { showOpError } from '@/shared/api/opError'
import {
  createPolicy,
  updatePolicy,
} from '@/api/security-management/requests/policyRequest'
import type {
  PolicyDto,
  PolicyRo,
} from '@/api/security-management/types/policyTypes'

/**
 * 登录策略弹窗（新增/编辑二合一，经 openInteractiveDialog 打开，2026-10-20 随策略管理页定稿；
 * 提交收口模式同 RoleEditDialog）：标题随进入方式切换；policyId 编辑时只读。
 * 两列栅格（12 字段，宽 600 同 CreateUserDialog，走 tokens.css 共用类 .vui-user-form-grid）：
 * ID+名称 / 描述跨两列 / 密码长度上下限 / 四类字符要求开关一行（两两分列，2026-10-20 定稿）/
 * 特殊字符集合跨两列 / 密码+账户有效天数（-1=永不过期）。
 * 布尔表单态用布尔、提交换算 1/0（后端口径）；特殊字符集合 UI=逗号分隔文本、传输=string[]
 * （勾选须含时必填、未勾选提交空数组）。
 * 表单规则（用户定稿 2026-10-20 晚）：ID/名称 ≤20 字符、描述 ≤255（不限字符类型）、
 * 长度 6≤min<max≤18（双向交叉报）、天数 -1 或 1–999、特殊字符仅可设定 SPECIAL_CHARS 集合；
 * 非空校验归 UI 调用前，接口层不设守卫。
 * 成功 → emit('resolve', 落库后的 PolicyDto) + 关窗（页面只做 Toast/重拉）；
 * 失败 → showOpError，弹窗保留可改可重试。
 */
const props = defineProps<{ policy?: PolicyDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: PolicyDto] }>()

const { t } = useI18n()
const formRef = ref()
const editing = !!props.policy
const saving = ref(false)

/** 数值字段表单态存字符串（文本框直编辑），提交时 Number() 换算 */
const form = reactive({
  policyId: props.policy?.policyId ?? '',
  policyName: props.policy?.policyName ?? '',
  description: props.policy?.description ?? '',
  passwdMinLength: String(props.policy?.passwdMinLength ?? 8),
  passwdMaxLength: String(props.policy?.passwdMaxLength ?? 16),
  requireDigit: (props.policy?.passwdRequireDigit ?? 1) === 1,
  requireLowerChar: (props.policy?.passwdRequireLowerChar ?? 1) === 1,
  requireUpperChar: (props.policy?.passwdRequireUpperChar ?? 1) === 1,
  requireSpecialChar: (props.policy?.passwdRequireSpecialChar ?? 0) === 1,
  /** 特殊字符集合：UI 以英文逗号分隔文本编辑，传输换算 string[]（去空白/去重；
   *  用户定稿 2026-10-20：勾选须含特殊字符后必填） */
  passwdSpecials: (props.policy?.passwdSpecials ?? []).join(','),
  passwdValidDays: String(props.policy?.passwdValidDays ?? 90),
  accountValidDays: String(props.policy?.accountValidDays ?? 365),
})

/* ===== 校验口径常量（用户定稿 2026-10-20 晚，单一真源） ===== */
const POLICY_ID_MAX_LEN = 20
const POLICY_NAME_MAX_LEN = 20
const DESC_MAX_LEN = 255
/** 密码最小长度下限 */
const PASSWD_MIN_FLOOR = 6
/** 密码最大长度上限 */
const PASSWD_MAX_CEIL = 18
/** 有效天数上限（-1=永不过期 之外的最大天数） */
const VALID_DAYS_MAX = 999
/** 可设定的特殊字符集合（勾选须含后仅允许这些字符；文案经 {chars} 命名插值下发、
 *  不入词典原文——@/% 为 vue-i18n 保留语法字符） */
const SPECIAL_CHARS = '-_+=!@#$%&*~?'

const ID_PATTERN = /^[A-Z0-9_-]+$/
const POS_INT_PATTERN = /^\d+$/
const isPosInt = (v: string) => POS_INT_PATTERN.test(v.trim()) && Number(v) >= 1
/** 天数：-1（永不过期）或 1–999 */
const isDays = (v: string) => v.trim() === '-1' || (isPosInt(v) && Number(v) <= VALID_DAYS_MAX)

const rules = {
  required: (v: string) => !!v.trim() || t('validation.required'),
  /** ID：字符集 + ≤20（maxlength 硬截，规则兜底） */
  id: (v: string) => (ID_PATTERN.test(v.trim()) && v.trim().length <= POLICY_ID_MAX_LEN) || t('security.loginPolicy.form.idInvalid'),
  nameLen: (v: string) => v.trim().length <= POLICY_NAME_MAX_LEN || t('security.loginPolicy.form.nameTooLong'),
  /** 描述：≤255 不限字符类型 */
  descLen: (v: string) => v.length <= DESC_MAX_LEN || t('security.loginPolicy.form.descTooLong'),
  minLen: (v: string) => (isPosInt(v) && Number(v) >= PASSWD_MIN_FLOOR) || t('security.loginPolicy.form.minLenInvalid'),
  maxLen: (v: string) => (isPosInt(v) && Number(v) <= PASSWD_MAX_CEIL) || t('security.loginPolicy.form.maxLenInvalid'),
  /** 双向交叉：min 须 < max（伙伴字段自身非法时不重复报，归其自身规则） */
  minGtMax: (v: string) =>
    (!isPosInt(v) || !isPosInt(form.passwdMaxLength) || Number(v) < Number(form.passwdMaxLength)) ||
    t('security.loginPolicy.form.minGtMaxInvalid'),
  maxLtMin: (v: string) =>
    (!isPosInt(v) || !isPosInt(form.passwdMinLength) || Number(v) > Number(form.passwdMinLength)) ||
    t('security.loginPolicy.form.maxLtMinInvalid'),
  days: (v: string) => isDays(v) || t('security.loginPolicy.form.daysInvalid'),
  /** 特殊字符集合：仅勾选时校验——必填、逐项单字符、限 SPECIAL_CHARS */
  specials: (v: string) => {
    if (!form.requireSpecialChar) return true
    const toks = v.split(',').map((s) => s.trim()).filter(Boolean)
    if (toks.length === 0) return t('security.loginPolicy.form.specialsRequired')
    const legal = toks.every((tk) => tk.length === 1 && SPECIAL_CHARS.includes(tk))
    return legal || t('security.loginPolicy.form.specialsInvalid', { chars: SPECIAL_CHARS })
  },
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const ro: PolicyRo = {
    policyId: form.policyId.trim(),
    policyName: form.policyName.trim(),
    description: form.description.trim(),
    passwdMinLength: Number(form.passwdMinLength.trim()),
    passwdMaxLength: Number(form.passwdMaxLength.trim()),
    passwdRequireDigit: form.requireDigit ? 1 : 0,
    passwdRequireLowerChar: form.requireLowerChar ? 1 : 0,
    passwdRequireUpperChar: form.requireUpperChar ? 1 : 0,
    passwdRequireSpecialChar: form.requireSpecialChar ? 1 : 0,
    passwdSpecials: form.requireSpecialChar
      ? [...new Set(form.passwdSpecials.split(',').map((s) => s.trim()).filter(Boolean))]
      : [],
    passwdValidDays: Number(form.passwdValidDays.trim()),
    accountValidDays: Number(form.accountValidDays.trim()),
  }
  saving.value = true
  try {
    const saved = editing ? await updatePolicy(ro) : await createPolicy(ro)
    emit('resolve', saved)
    open.value = false
  } catch (e) {
    // 业务失败（ID 重复/策略不存在）Toast，弹窗保留可改可重试；传输失败已由全局呈现
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="editing ? t('security.loginPolicy.edit') : t('security.loginPolicy.add')"
    center-title
    :max-width="600"
  >
    <!-- 两列栅格（DOM 顺序即行分配，同 CreateUserDialog 口径）：ID+名称 / 描述跨列 /
         长度上下限 / 四类字符开关 2×2 / 天数两列 -->
    <v-form ref="formRef" class="vui-user-form-grid pt-1" @submit.prevent="save">
      <FvTextInput
        v-model="form.policyId"
        :label="t('security.loginPolicy.form.id')"
        :rules="[rules.required, rules.id]"
        :disabled="editing"
        :hint="editing ? undefined : t('security.loginPolicy.form.idHint')"
        :show-hint="!editing"
        required
        prepend-icon="fas fa-id-badge"
        maxlength="20"
      />
      <FvTextInput
        v-model="form.policyName"
        :label="t('security.loginPolicy.form.name')"
        :rules="[rules.required, rules.nameLen]"
        required
        prepend-icon="fas fa-file-shield"
        maxlength="20"
        clear
      />
      <FvTextInput
        v-model="form.description"
        :label="t('security.loginPolicy.form.description')"
        :rules="[rules.descLen]"
        type="comment"
        maxlength="255"
        class="vui-user-form--span"
      />
      <FvTextInput
        v-model="form.passwdMinLength"
        :label="t('security.loginPolicy.form.passwdMinLen')"
        :rules="[rules.required, rules.minLen, rules.minGtMax]"
        required
        inputmode="numeric"
      />
      <FvTextInput
        v-model="form.passwdMaxLength"
        :label="t('security.loginPolicy.form.passwdMaxLen')"
        :rules="[rules.required, rules.maxLen, rules.maxLtMin]"
        required
        inputmode="numeric"
      />
      <!-- 四类字符要求开关：两两成对、一对占一栅格列——四个合一行（2026-10-20 定稿，
           不再 2×2 占两行挤掉下方空间） -->
      <div class="vui-policy-form__switches">
        <div class="vui-policy-form__switch">
          <FvSwitch v-model="form.requireDigit" />
          <span class="text-body-2">{{ t('security.loginPolicy.form.reqDigit') }}</span>
        </div>
        <div class="vui-policy-form__switch">
          <FvSwitch v-model="form.requireLowerChar" />
          <span class="text-body-2">{{ t('security.loginPolicy.form.reqLowerChar') }}</span>
        </div>
      </div>
      <div class="vui-policy-form__switches">
        <div class="vui-policy-form__switch">
          <FvSwitch v-model="form.requireUpperChar" />
          <span class="text-body-2">{{ t('security.loginPolicy.form.reqUpperChar') }}</span>
        </div>
        <div class="vui-policy-form__switch">
          <FvSwitch v-model="form.requireSpecialChar" />
          <span class="text-body-2">{{ t('security.loginPolicy.form.reqSpecialChar') }}</span>
        </div>
      </div>
      <!-- 特殊字符集合：跨两列；仅在勾选须含特殊字符时可编辑（勾选后必填，见 rules.specials） -->
      <FvTextInput
        v-model="form.passwdSpecials"
        :label="t('security.loginPolicy.form.passwdSpecials')"
        :rules="[rules.specials]"
        :hint="t('security.loginPolicy.form.specialsHint', { chars: SPECIAL_CHARS })"
        show-hint
        :disabled="!form.requireSpecialChar"
        class="vui-user-form--span"
      />
      <FvTextInput
        v-model="form.passwdValidDays"
        :label="t('security.loginPolicy.form.passwdValidDays')"
        :rules="[rules.required, rules.days]"
        :hint="t('security.loginPolicy.form.daysHint')"
        show-hint
        required
        inputmode="numeric"
      />
      <FvTextInput
        v-model="form.accountValidDays"
        :label="t('security.loginPolicy.form.accountValidDays')"
        :rules="[rules.required, rules.days]"
        :hint="t('security.loginPolicy.form.daysHint')"
        show-hint
        required
        inputmode="numeric"
      />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 开关对容器：占栅格一列，内部两枚开关横排（形态同 CreateUserDialog 开关行，scoped 不外溢） */
.vui-policy-form__switches {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  min-width: 0;
}

.vui-policy-form__switch {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
</style>
