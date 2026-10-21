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
import { fetchPolicyDetail } from '@/api/security-management/requests/policyRequest'
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
 * 日期默认值（2026-10-21 改版）：激活=当天（段被清空失焦自动回填当天值，fillOnEmptyBlur）；
 * 到期初始为空，仅选定登录策略后由策略账户有效期驱动（-1 清空 / N=激活+N，激活或策略变动即重算；
 * 原「激活+365 自动填充」已删）。
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
  /** 账户到期日期：初始为空（2026-10-21 删「激活+365 自动填充」，到期仅由所选策略账户有效期驱动）；空 = 永不过期 */
  accountExpiresAt: '',
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

/* ===== 到期日期策略驱动（用户定稿 2026-10-20 晚，替代原固定"激活+365"）=====
   选中策略 → fetchPolicyDetail 取账户有效期天数 accountValidDays：
   -1 = 永不过期 → 清空到期日期；N>0 → 到期日期 = 激活日期 + N 天；
   激活日期或策略任一变动都重算；未选策略时沿用 365 天缺省；
   detail 拉取失败保持当前到期值不动（带过期响应守卫，防快速切换策略错值）。 */
const policyAccountDays = ref<number | null>(null)
/** 所选策略的密码有效天数（null=未选/未取到）：驱动密码框 Hint 图标显隐与文案 */
const policyPasswdDays = ref<number | null>(null)

function recalcExpires() {
  // 2026-10-21 改版：未选/未取到策略不动到期（原「激活+365」自动填充已删）；仅策略驱动重算
  const days = policyAccountDays.value
  if (days === null || !form.accountActiveAt) return
  form.accountExpiresAt =
    days === -1 ? '' : dayjs(form.accountActiveAt, 'YYYY-MM-DD').add(days, 'day').format('YYYY-MM-DD')
}

watch(
  () => form.policyId,
  (id) => {
    if (!id) {
      policyAccountDays.value = null
      policyPasswdDays.value = null
      recalcExpires()
      return
    }
    fetchPolicyDetail(id).then(
      (p) => {
        if (form.policyId !== id) return // 过期响应丢弃
        policyAccountDays.value = p.accountValidDays
        policyPasswdDays.value = p.passwdValidDays
        recalcExpires()
      },
      () => {
        /* 详情失败：到期日期保持现值（下拉清理另有 @open 通道） */
      },
    )
  },
)
watch(() => form.accountActiveAt, recalcExpires)

/* ===== 到期日期手动调整约束（用户定稿 2026-10-20 晚）=====
   任何情况下：到期必须晚于激活日期（不得 ≤）；
   策略 accountValidDays ≠ -1 时：到期不得大于 激活日期 + 策略天数（上限=策略窗口）。
   经 FvTimer errorMessages 外部通道呈现（红描边+错误徽标），save 拦截提交。 */
const expiresCap = computed(() => {
  if (policyAccountDays.value === null || policyAccountDays.value <= 0) return ''
  if (!form.accountActiveAt) return ''
  return dayjs(form.accountActiveAt, 'YYYY-MM-DD').add(policyAccountDays.value, 'day').format('YYYY-MM-DD')
})
const expiresErrors = computed(() => {
  const v = form.accountActiveAt && form.accountExpiresAt
  if (!v) return []
  if (form.accountExpiresAt <= form.accountActiveAt) return [t('security.users.form.expiresAfterActive')]
  if (expiresCap.value && form.accountExpiresAt > expiresCap.value)
    return [t('security.users.form.expiresOverPolicy', { n: policyAccountDays.value, cap: expiresCap.value })]
  return []
})

/* ===== 策略联动 Hint（用户定稿 2026-10-20 深夜）=====
   密码框：取到策略详情才显示问号图标——密码有效天数 N 天 / -1 永不过期；清空策略自动隐藏。
   到期框：取到账户有效天数后 hint 换为策略口径文案（-1 永不过期 / N 天数），未取到沿用通用约束提示。 */
const pwdHint = computed(() => {
  if (policyPasswdDays.value === null) return ''
  return policyPasswdDays.value === -1
    ? t('security.users.form.policyPwdNever')
    : t('security.users.form.policyPwdDays', { n: policyPasswdDays.value })
})
const expiresHint = computed(() => {
  if (policyAccountDays.value === null) return t('security.users.form.expiresAtPolicyHint')
  return policyAccountDays.value === -1
    ? t('security.users.form.policyAcctNever')
    : t('security.users.form.policyAcctDays', { n: policyAccountDays.value })
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
  if (expiresErrors.value.length) return // 到期日期违反激活/策略窗口约束（错误已经徽标呈现）
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
        :hint="pwdHint"
        :show-hint="policyPasswdDays !== null"
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
        fill-on-empty-blur
        :error-messages="activeAtErrors"
      />
      <FvTimer
        v-model="form.accountExpiresAt"
        mode="date"
        :label="t('security.users.form.expiresAt')"
        :hint="expiresHint"
        :error-messages="expiresErrors"
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
