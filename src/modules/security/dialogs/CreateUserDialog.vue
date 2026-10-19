<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvSwitch from '@/shared/components/FvSwitch.vue'
import FvTextSelect from '@/shared/components/FvTextSelect.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTimer from '@/shared/components/FvTimer.vue'
import { showOpError } from '@/shared/api/opError'
import { createUser } from '@/api/security-management/userRequest'
import { fetchRolesPage } from '@/api/security-management/roleRequest'
import { fetchLoginPolicies } from '@/api/security-management/policyRequest'
import type { CreateUserRo, UserDto } from '@/api/security-management/userTypes'

interface SelectOption {
  title: string
  value: string
}

/**
 * 新增用户弹窗（经 openInteractiveDialog 打开，2026-10-19 自 UserEditDialog 拆分定稿）：
 * 字段=用户名/密码/昵称/邮箱/电话/角色(多选)/登录策略/账户激活日期/是否启用；
 * 必填：用户名、密码、角色、策略、激活日期。校验规则（用户定稿 2026-10-19）：
 * 用户名=大小写字母/数字/下划线；**密码创建场景无复杂度限制**；电话=纯数字（选填）；
 * 邮箱=格式校验（选填）。启用开关联动：激活日期>今天 → 自动停用且开关锁定不可改；
 * ≤今天（含未填）→ 开启、可手动调整。
 * 提交收口本组件（同 RoleEditDialog 模式）：成功 → emit('resolve', UserDto)+关窗；
 * 失败（用户名重复等）→ showOpError，弹窗保留可改可重试。
 */
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: UserDto] }>()

const { t } = useI18n()
const formRef = ref()
const saving = ref(false)
const dateTouched = ref(false)

const form = reactive({
  userName: '',
  password: '',
  nickName: '',
  email: '',
  phoneNumber: '',
  roleIds: [] as string[],
  policyId: '',
  /** 账户激活日期 'YYYY-MM-DD'（FvTimer mode=date） */
  accountActiveAt: '',
  enabled: true,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/
const DIGITS_PATTERN = /^\d+$/
const rules = {
  required: (v: unknown) =>
    (Array.isArray(v) ? v.length > 0 : !!String(v ?? '').trim()) || t('validation.required'),
  userName: (v: string) =>
    USERNAME_PATTERN.test(v.trim()) || t('security.users.form.userNamePattern'),
  email: (v: string) =>
    !v.trim() || EMAIL_PATTERN.test(v.trim()) || t('security.users.form.emailInvalid'),
  phone: (v: string) =>
    !v.trim() || DIGITS_PATTERN.test(v.trim()) || t('security.users.form.phoneDigitsOnly'),
}

/* ===== 选项数据（挂载角色/策略下拉，FvTextSelect 消费 {title,value}） ===== */
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
  } catch (e) {
    showOpError(e) // 选项拉取失败：弹窗可用但下拉为空，错误已由全局呈现
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

/* ===== 启用开关联动（用户定稿 2026-10-19）：激活日期>今天 → 停用+锁定；否则开启可调 ===== */
const activeLocked = computed(
  () => !!form.accountActiveAt && form.accountActiveAt > dayjs().format('YYYY-MM-DD'),
)
watch(activeLocked, (locked) => (form.enabled = !locked))
const activeAtErrors = computed(() =>
  dateTouched.value && !form.accountActiveAt ? [t('validation.required')] : [],
)

async function save() {
  const { valid } = await formRef.value.validate()
  dateTouched.value = true
  if (!valid || !form.accountActiveAt || saving.value) return
  const ro: CreateUserRo = {
    userName: form.userName.trim(),
    password: form.password,
    nickName: form.nickName.trim(),
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim(),
    roleIds: [...form.roleIds],
    policyId: form.policyId,
    accountActiveAt: form.accountActiveAt,
    enabled: form.enabled ? 1 : 0,
  }
  saving.value = true
  try {
    const saved = await createUser(ro)
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
    :title="t('security.users.add')"
    center-title
    :max-width="600"
  >
    <!-- 两列布局（用户定稿 2026-10-19）：用户名+昵称 / 邮箱+密码 / 角色+策略 / 激活日期单列；
         电话未在行分配中点名，单独半列置于密码行后；grid 天然保证左右列与上一行首列控件对齐 -->
    <v-form ref="formRef" class="vui-create-user-grid pt-1" @submit.prevent="save">
      <FvTextInput
        v-model="form.userName"
        :label="t('security.users.form.userName')"
        :rules="[rules.required, rules.userName]"
        :hint="t('security.users.form.userNameHint')"
        persistent-hint
        prepend-icon="fas fa-user"
        autocomplete="off"
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
        v-model="form.password"
        type="password"
        :label="t('security.users.form.password')"
        :rules="[rules.required]"
        autocomplete="new-password"
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
        :rules="[rules.required]"
        prepend-icon="fas fa-user-shield"
        class="vui-user-form__new-row"
      />
      <FvTextSelect
        v-model="policyModel"
        :items="policyOptions"
        :label="t('security.users.form.policy')"
        :rules="[rules.required]"
        prepend-icon="fas fa-file-shield"
      />
      <FvTimer
        v-model="form.accountActiveAt"
        mode="date"
        :label="t('security.users.form.activeAt')"
        :hint="t('security.users.form.activeAtHint')"
        :error-messages="activeAtErrors"
        class="vui-user-form__new-row"
      />
      <!-- 启用开关：默认开启；激活日期晚于今天 → 停用且锁定（联动见 activeLocked） -->
      <div class="vui-user-form__switch vui-user-form__switch--span">
        <FvSwitch v-model="form.enabled" :disabled="activeLocked" />
        <span class="text-body-2">{{ t('security.users.form.enabled') }}</span>
      </div>
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 两列栅格：列等宽、间距统一；行高随最高项，hint/错误在字段下方不影响列对齐 */
.vui-create-user-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  row-gap: 4px;
  align-items: start;
}

/* 强制换行（用户定稿行分配：角色+策略 / 激活日期单列，电话独占密码行后半列）：
   落在该行首控件上，grid 自动把它拨到下一行第一列 */
.vui-user-form__new-row {
  grid-column-start: 1;
}

/* 状态开关行：与字段区同距，开关 + 文案左对齐（口径同编辑弹窗） */
.vui-user-form__switch {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.vui-user-form__switch--span {
  grid-column: 1 / -1;
}
</style>
