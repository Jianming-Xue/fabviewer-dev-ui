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
import { createUser } from '@/api/security-management/requests/userRequest'
import {
  roleOptions,
  policyOptions,
  ensureRoleNames,
  ensurePolicyNames,
  knownRoleIds,
  knownPolicyIds,
} from '@/api/security-management/rolePolicyNameCollection'
import type {
  CreateUserRo,
  UserDto,
} from '@/api/security-management/types/userTypes'

/**
 * 新增用户弹窗（经 openInteractiveDialog 打开，2026-10-19 自 UserEditDialog 拆分；
 * 同日晚间改版定稿）：
 * 行分配=用户名+昵称 / 密码跨两列 / 邮箱+电话 / 角色+策略 / 激活日期+到期日期（激活在前）/
 * 启用开关跨行；长度限制（用户定稿）：用户名 ≤30 且仅数字/大小写字母/下划线，昵称 ≤30 不限字符类型，
 * 初始密码不做任何限制（仅必填）。
 * 日期默认值：激活=当天；到期=激活+365 天（打开弹窗时的初始值，改激活日期不自动跟随）。
 * 启用开关联动：激活日期>今天 → 关闭且禁用；≤今天（含清空）→ 打开且解除禁用。
 * 提交收口本组件（同 RoleEditDialog 模式）：成功 → emit('resolve', UserDto)+关窗；
 * 失败（用户名重复等）→ showOpError，弹窗保留可改可重试。
 */
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: UserDto] }>()

const { t } = useI18n()
const formRef = ref()
const saving = ref(false)
const dateTouched = ref(false)

const DAY_FORMAT = 'YYYY-MM-DD'

const form = reactive({
  userName: '',
  password: '',
  nickName: '',
  email: '',
  phoneNumber: '',
  roleIds: [] as string[],
  policyId: '',
  /** 账户激活日期：默认当天（用户定稿 2026-10-19） */
  accountActiveAt: dayjs().format(DAY_FORMAT),
  /** 账户到期日期：初始默认=激活日期+365 天；空 = 永不过期 */
  accountExpiresAt: dayjs().add(365, 'day').format(DAY_FORMAT),
  enabled: true,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[A-Za-z0-9_]+$/
const DIGITS_PATTERN = /^\d+$/
const rules = {
  required: (v: unknown) =>
    (Array.isArray(v) ? v.length > 0 : !!String(v ?? '').trim()) || t('validation.required'),
  userName: (v: string) => {
    const s = v.trim()
    return (USERNAME_PATTERN.test(s) && s.length <= 30) || t('security.users.form.userNamePattern')
  },
  email: (v: string) =>
    !v.trim() || EMAIL_PATTERN.test(v.trim()) || t('security.users.form.emailInvalid'),
  phone: (v: string) =>
    !v.trim() || DIGITS_PATTERN.test(v.trim()) || t('security.users.form.phoneDigitsOnly'),
}

/* ===== 选项数据（用户定稿 2026-10-20 改名称字典制）：角色/策略下拉一律消费 rolePolicyNameCollection 的
   name/list 全局缓存（进入用户页已预载，此处兜底再保）；点开下拉→强刷缓存→
   按新字典清理查无此名的已选 ID：角色逐个清、策略整体清空 ===== */
onMounted(() => {
  void ensureRoleNames()
  void ensurePolicyNames()
})

function onRolesOpen() {
  void ensureRoleNames(true).then(() => {
    const known = knownRoleIds()
    const kept = form.roleIds.filter((id) => known.has(id))
    if (kept.length !== form.roleIds.length) form.roleIds = kept
  })
}
function onPolicyOpen() {
  void ensurePolicyNames(true).then(() => {
    if (form.policyId && !knownPolicyIds().has(form.policyId)) form.policyId = ''
  })
}

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

/* ===== 启用开关联动（用户定稿 2026-10-19）：激活日期>今天 → 关闭+禁用；否则打开+可改 ===== */
const activeLocked = computed(
  () => !!form.accountActiveAt && form.accountActiveAt > dayjs().format(DAY_FORMAT),
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
    accountExpiresAt: form.accountExpiresAt,
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
    <!-- 两列布局（用户定稿 2026-10-19 晚间改版）：用户名+昵称 / 密码跨两列 / 邮箱+电话 /
         角色+策略 / 激活+到期 / 开关跨行——DOM 顺序即行分配，无需强制换行类 -->
    <v-form ref="formRef" class="vui-user-form-grid pt-1" @submit.prevent="save">
      <FvTextInput
        v-model="form.userName"
        :label="t('security.users.form.userName')"
        :rules="[rules.required, rules.userName]"
        :hint="t('security.users.form.userNameHint')"
        show-hint
        required
        prepend-icon="fas fa-user"
        maxlength="30"
        autocomplete="off"
      />
      <FvTextInput
        v-model="form.nickName"
        :label="t('security.users.form.nickName')"
        maxlength="30"
        clear
      />
      <FvTextInput
        v-model="form.password"
        type="password"
        :label="t('security.users.form.password')"
        :rules="[rules.required]"
        required
        autocomplete="new-password"
        class="vui-user-form--span"
      />
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
        :rules="[rules.required]"
        required
        prepend-icon="fas fa-user-shield"
        @open="onRolesOpen"
      />
      <FvTextSelect
        v-model="policyModel"
        :items="policyOptions"
        :label="t('security.users.form.policy')"
        :rules="[rules.required]"
        required
        prepend-icon="fas fa-file-shield"
        @open="onPolicyOpen"
      />
      <FvTimer
        v-model="form.accountActiveAt"
        mode="date"
        :label="t('security.users.form.activeAt')"
        :hint="t('security.users.form.activeAtHint')"
        show-hint
        :error-messages="activeAtErrors"
      />
      <FvTimer
        v-model="form.accountExpiresAt"
        mode="date"
        :label="t('security.users.form.expiresAt')"
        :hint="t('security.users.form.expiresAtHint')"
        show-hint
      />
      <!-- 启用开关：默认开启；激活日期晚于今天 → 关闭且禁用（联动见 activeLocked） -->
      <div class="vui-user-form__switch vui-user-form--span">
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
/* 状态开关行：与字段区同距，开关 + 文案左对齐；
   栅格/跨列/FvTimer 拉满均在 tokens.css 共用段（.vui-user-form-grid） */
.vui-user-form__switch {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
</style>
