<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextSelect from '@/shared/components/FvTextSelect.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTimer from '@/shared/components/FvTimer.vue'
import { showOpError } from '@/shared/api/opError'
import { updateUser } from '@/api/security-management/requests/userRequest'
import {
  roleOptions,
  policyOptions,
  ensureRoleNames,
  ensurePolicyNames,
  knownRoleIds,
  knownPolicyIds,
} from '@/api/security-management/rolePolicyNameCollection'
import type {
  UserDto,
  UserRo,
} from '@/api/security-management/types/userTypes'

/**
 * 角色和策略弹窗（经 openInteractiveDialog 打开，2026-10-19 自 EditUserDialog 二次拆分而来，
 * 用户表格 More 菜单「角色和策略」入口）：
 * 在管字段 = 角色/登录策略/密码有效期天数/账户有效期天数/账户到期日期；
 * 提交走 UserRo 稀疏语义（只传在管字段，昵称/邮箱/电话/enabled 等一概不经手）。
 * 空值语义：策略空=默认策略；有效期天数空=不限(-1)；到期日期空=永不过期。
 * 回显：Dto 直发 ID，按名称字典（rolePolicyNameCollection）显名；点开下拉刷新字典并清理失效 ID。
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
  /** Dto 直发 ID，回显零换算（2026-10-20 名称字典制） */
  roleIds: [...(props.user.roleIds ?? [])],
  policyId: props.user.policyId ?? '',
  /** 有效期天数字符串表单态；'' = 不限（提交换算 -1） */
  passwordValidDays: props.user.passwordValidDays > 0 ? String(props.user.passwordValidDays) : '',
  accountValidDays: props.user.accountValidDays > 0 ? String(props.user.accountValidDays) : '',
  /** 账户到期日期 'YYYY-MM-DD'（Dto 带时间串截断回显）；'' = 永不过期 */
  accountExpiresAt: props.user.accountExpiresAt ? props.user.accountExpiresAt.slice(0, 10) : '',
})

const rules = {
  days: (v: string) =>
    !v.trim() || (/^\d+$/.test(v.trim()) && Number(v) > 0) || t('security.users.form.positiveInt'),
}

/* ===== 名称字典制（用户定稿 2026-10-20，替换旧"分页加载+名称反查 id"机制）=====
   Dto 直发 ID（roleIds/policyId），回显零换算；选项= rolePolicyNameCollection 全局缓存
   （进页已预载，此处兜底）；未开下拉按 ID 从缓存显名；点开下拉强刷字典并清理
   查无此名的已选 ID：角色逐个清、策略查不到清空下拉。 */
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

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const ro: UserRo = {
    userId: props.user.userId,
    roleIds: [...form.roleIds],
    policyId: form.policyId,
    passwordValidDays: form.passwordValidDays.trim() ? Number(form.passwordValidDays) : -1,
    accountValidDays: form.accountValidDays.trim() ? Number(form.accountValidDays) : -1,
    accountExpiresAt: form.accountExpiresAt,
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
    :title="t('security.users.ctlRolesPolicy') + ' · ' + props.user.userName"
    center-title
    max-height="92vh"
  >
    <!-- 单列栅格（用户定稿 2026-10-19 拆分改版）：禁用用户名居首，下排 角色/策略/两有效天数/账户到期 -->
    <v-form ref="formRef" class="vui-user-form-grid vui-user-form-grid--one-col pt-1" @submit.prevent="save">
      <FvTextInput
        :model-value="props.user.userName"
        :label="t('security.users.form.userName')"
        disabled
        prepend-icon="fas fa-user"
      />
      <FvTextSelect
        v-model="roleModel"
        mode="multiple"
        :items="roleOptions"
        :label="t('security.users.form.roles')"
        prepend-icon="fas fa-user-shield"
        @open="onRolesOpen"
      />
      <FvTextSelect
        v-model="policyModel"
        :items="policyOptions"
        :label="t('security.users.form.policy')"
        clearable
        prepend-icon="fas fa-file-shield"
        @open="onPolicyOpen"
      />
      <FvTextInput
        v-model="form.passwordValidDays"
        :label="t('security.users.form.passwordValidDays')"
        :rules="[rules.days]"
        :hint="t('security.users.form.positiveInt')"
        show-hint
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
        show-hint
      />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
