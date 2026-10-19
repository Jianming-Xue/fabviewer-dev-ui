<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextSelect from '@/shared/components/FvTextSelect.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTimer from '@/shared/components/FvTimer.vue'
import { showOpError } from '@/shared/api/opError'
import { updateUser } from '@/api/security-management/userRequest'
import { fetchRolesPage } from '@/api/security-management/roleRequest'
import { fetchLoginPolicies } from '@/api/security-management/policyRequest'
import type { UserDto, UserRo } from '@/api/security-management/userTypes'

interface SelectOption {
  title: string
  value: string
}

/**
 * 编辑用户弹窗（经 openInteractiveDialog 打开，2026-10-19 自二合一 UserEditDialog 拆分定稿）：
 * 可编辑集（用户定稿）= 昵称/邮箱/电话/角色/登录策略/密码有效期天数/账户有效期天数/账户到期日期；
 * 用户名锁定只读；enabled 由表格行开关维护（此处透传不改）。
 * 空值语义：邮箱/电话选填（填了校验）；策略空=默认策略；有效期天数空=不限(-1)；
 * 到期日期空=永不过期。回显：角色/策略按名称反查 id（选项接口到达后填充）。
 * 提交收口本组件（同 RoleEditDialog 模式）：成功 → emit('resolve', UserDto)+关窗；
 * 失败 → showOpError，弹窗保留可改可重试。
 */
const props = defineProps<{ user: UserDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: UserDto] }>()

const { t } = useI18n()
const formRef = ref()
const saving = ref(false)

const form = reactive({
  userName: props.user.userName,
  nickName: props.user.nickName,
  email: props.user.email,
  phoneNumber: props.user.phoneNumber,
  roleIds: [] as string[],
  policyId: '',
  /** 有效期天数字符串表单态；'' = 不限（提交换算 -1） */
  passwordValidDays: props.user.passwordValidDays > 0 ? String(props.user.passwordValidDays) : '',
  accountValidDays: props.user.accountValidDays > 0 ? String(props.user.accountValidDays) : '',
  /** 账户到期日期 'YYYY-MM-DD'（Dto 带时间串截断回显）；'' = 永不过期 */
  accountExpiresAt: props.user.accountExpiresAt ? props.user.accountExpiresAt.slice(0, 10) : '',
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIGITS_PATTERN = /^\d+$/
const rules = {
  email: (v: string) =>
    !v.trim() || EMAIL_PATTERN.test(v.trim()) || t('security.users.form.emailInvalid'),
  phone: (v: string) =>
    !v.trim() || DIGITS_PATTERN.test(v.trim()) || t('security.users.form.phoneDigitsOnly'),
  days: (v: string) =>
    !v.trim() || (/^\d+$/.test(v.trim()) && Number(v) > 0) || t('security.users.form.positiveInt'),
}

/* ===== 选项数据 + 名称→id 回显（角色/策略按挂载名反查；FvTextSelect 消费 {title,value}） ===== */
const roleOptions = ref<SelectOption[]>([])
const policyOptions = ref<SelectOption[]>([])
onMounted(async () => {
  try {
    const [rolesPage, policies] = await Promise.all([
      fetchRolesPage({ pageIndex: 1, pageSize: 200 }),
      fetchLoginPolicies(),
    ])
    roleOptions.value = rolesPage.data.map((r) => ({ title: r.roleName, value: r.roleId }))
    policyOptions.value = policies.map((p) => ({ title: p.policyName, value: p.policyId }))
    form.roleIds = props.user.roles
      .map((name) => rolesPage.data.find((r) => r.roleName === name)?.roleId)
      .filter((id): id is string => !!id)
    form.policyId = policies.find((p) => p.policyName === props.user.policyName)?.policyId ?? ''
  } catch (e) {
    showOpError(e)
  }
})

/* FvTextSelect model 为联合类型（单/多选共用），表单窄化包装 */
const roleModel = computed({
  get: () => form.roleIds as string | string[] | undefined,
  set: (v: string | string[] | undefined) => {
    form.roleIds = Array.isArray(v) ? v : v ? [v] : []
  },
})
const policyModel = computed({
  get: () => form.policyId || undefined,
  set: (v: string | string[] | undefined) => {
    form.policyId = typeof v === 'string' ? v : ''
  },
})

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const ro: UserRo = {
    userId: props.user.userId,
    userName: props.user.userName,
    nickName: form.nickName.trim(),
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim(),
    roleIds: [...form.roleIds],
    policyId: form.policyId,
    passwordValidDays: form.passwordValidDays.trim() ? Number(form.passwordValidDays) : -1,
    accountValidDays: form.accountValidDays.trim() ? Number(form.accountValidDays) : -1,
    accountExpiresAt: form.accountExpiresAt,
    enabled: props.user.enabled, // 状态由表格开关维护，编辑透传
  }
  saving.value = true
  try {
    const saved = await updateUser(ro)
    emit('resolve', saved)
    open.value = false
  } catch (e) {
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="t('security.users.edit') + ' · ' + props.user.userName"
    center-title
  >
    <v-form ref="formRef" class="pt-1" @submit.prevent="save">
      <FvTextInput
        v-model="form.userName"
        :label="t('security.users.form.userName')"
        :disabled="true"
        prepend-icon="fas fa-user"
      />
      <FvTextInput v-model="form.nickName" :label="t('security.users.form.nickName')" clear />
      <FvTextInput
        v-model="form.email"
        :label="t('security.users.form.email')"
        :rules="[rules.email]"
        prepend-icon="fas fa-envelope"
        clear
      />
      <FvTextInput
        v-model="form.phoneNumber"
        :label="t('security.users.form.phoneNumber')"
        :rules="[rules.phone]"
        prepend-icon="fas fa-phone"
        inputmode="numeric"
        clear
      />
      <FvTextSelect
        v-model="roleModel"
        mode="multiple"
        :items="roleOptions"
        :label="t('security.users.form.roles')"
        prepend-icon="fas fa-user-shield"
      />
      <FvTextSelect
        v-model="policyModel"
        :items="policyOptions"
        :label="t('security.users.form.policy')"
        clearable
        prepend-icon="fas fa-file-shield"
      />
      <FvTextInput
        v-model="form.passwordValidDays"
        :label="t('security.users.form.passwordValidDays')"
        :rules="[rules.days]"
        :hint="t('security.users.form.positiveInt')"
        persistent-hint
        inputmode="numeric"
        clear
      />
      <FvTextInput
        v-model="form.accountValidDays"
        :label="t('security.users.form.accountValidDays')"
        :rules="[rules.days]"
        inputmode="numeric"
        clear
      />
      <FvTimer
        v-model="form.accountExpiresAt"
        mode="date"
        :label="t('security.users.form.expiresAt')"
        :hint="t('security.users.form.expiresAtHint')"
      />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
