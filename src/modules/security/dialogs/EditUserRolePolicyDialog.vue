<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextSelect from '@/shared/components/FvTextSelect.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvTimer from '@/shared/components/FvTimer.vue'
import { showOpError } from '@/shared/api/opError'
import { updateUser } from '@/api/security-management/requests/userRequest'
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
  UserDto,
  UserRo,
} from '@/api/security-management/types/userTypes'

/**
 * 角色和策略弹窗（经 openInteractiveDialog 打开，2026-10-19 自 EditUserDialog 二次拆分而来，
 * 用户表格 More 菜单「角色和策略」入口）：
 * 在管字段 = 角色/登录策略/账户到期日期（2026-10-21 改版：两有效期天数移除；
 * 激活日期与到期日期均只读展示——本弹窗【不做】策略↔到期值联动（用户定稿，
 * 与新增用户弹窗不同），策略详情仅驱动到期日期 Hint 文案；到期值改动走用户表列编辑路径）；
 * 激活日期基准 = accountActiveAt（空回落 createdAt 当日）。
 * 提交走 UserRo 稀疏语义（只传在管字段，昵称/邮箱/电话/两天数/enabled 一概不经手）。
 * 必填（2026-10-21 修复）：角色与登录策略均带 required 规则——策略清空不得提交
 * （原「策略空=默认策略」口径作废）。到期日期空=永不过期。
 * 策略 Hint（进页即随携带策略取 detail 更新、切换同步）：-1「策略要求账户永不过期」/
 * N「策略要求账户有效期天数为 N」；未取到回落通用提示。
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
  /** 账户到期日期 'YYYY-MM-DD'（Dto 带时间串截断回显）；'' = 永不过期。
   *  2026-10-21 改版：两有效期天数字段移除，本值切换策略时由 激活日期+策略账户天数 重算 */
  accountExpiresAt: props.user.accountExpiresAt ? props.user.accountExpiresAt.slice(0, 10) : '',
})

/** 激活日期（只读展示 + 到期重算基准）：accountActiveAt 空 = 创建即激活，回落 createdAt 当日 */
const baseActiveAt = ref(
  (props.user.accountActiveAt || props.user.createdAt || '').slice(0, 10),
)

const rules = {
  /** 角色/策略必填（2026-10-21 修复：原缺规则致策略清空仍可提交） */
  required: (v: string | string[]) =>
    (Array.isArray(v) ? v.length > 0 : !!String(v ?? '').trim()) || t('validation.required'),
}

/* ===== 策略详情 → 仅驱动到期 Hint（2026-10-21 用户定稿：本弹窗不改到期值）=====
   policyId 变动或进页携带策略 → fetchPolicyDetail 取 accountValidDays 更新 expiresHint；
   到期日期控件禁用，值保持库内现值提交；详情失败/清空策略 → Hint 回落通用口径。 */
const policyAccountDays = ref<number | null>(null)

watch(
  () => form.policyId,
  (id) => {
    if (!id) {
      policyAccountDays.value = null // 清空策略：Hint 回落、规则拦截提交
      return
    }
    fetchPolicyDetail(id).then(
      (p) => {
        if (form.policyId !== id) return // 过期响应丢弃
        policyAccountDays.value = p.accountValidDays
      },
      () => {
        /* 详情失败：Hint 保持通用 */
      },
    )
  },
)

/** 到期日期 Hint：随策略账户有效天数动态（-1/ N），未取到回落通用口径 */
const expiresHint = computed(() => {
  if (policyAccountDays.value === null) return t('security.users.form.expiresAtHint')
  return policyAccountDays.value === -1
    ? t('security.users.form.policyAcctNever')
    : t('security.users.form.policyAcctDays', { n: policyAccountDays.value })
})

/* ===== 名称字典制（用户定稿 2026-10-20，替换旧"分页加载+名称反查 id"机制）=====
   Dto 直发 ID（roleIds/policyId），回显零换算；选项= rolePolicyNameCollection 全局缓存
   （进页已预载，此处兜底）；未开下拉按 ID 从缓存显名；点开下拉强刷字典并清理
   查无此名的已选 ID：角色逐个清、策略查不到清空下拉。 */
onMounted(() => {
  void ensureRoleNames()
  void ensurePolicyNames()
  // 进页携带策略：只取详情更新到期 Hint（不覆盖现存到期值；切换才重算）
  if (form.policyId) {
    fetchPolicyDetail(form.policyId).then(
      (p) => {
        if (form.policyId === p.policyId) policyAccountDays.value = p.accountValidDays
      },
      () => {},
    )
  }
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
    // 两有效期天数不经手（2026-10-21 改版，稀疏保持库内现值）；到期由策略联动/手动维护
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
        clearable
        prepend-icon="fas fa-file-shield"
        @open="onPolicyOpen"
      />
      <!-- 激活日期只读（到期重算基准）；到期日期 Hint 随策略账户天数动态 -->
      <FvTimer
        v-model="baseActiveAt"
        mode="date"
        :label="t('security.users.form.activeAt')"
        disabled
      />
      <!-- 到期日期禁用（用户定稿 2026-10-21：本弹窗不改到期值，仅 Hint 随策略） -->
      <FvTimer
        v-model="form.accountExpiresAt"
        mode="date"
        :label="t('security.users.form.expiresAt')"
        :hint="expiresHint"
        disabled
        show-hint
      />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
