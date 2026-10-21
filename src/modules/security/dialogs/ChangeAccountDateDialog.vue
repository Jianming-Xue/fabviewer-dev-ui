<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { showOpError } from '@/shared/api/opError'
import { extendUserExpire } from '@/api/security-management/requests/userRequest'
import { fetchPolicyDetail } from '@/api/security-management/requests/policyRequest'

import type { UserDto } from '@/api/security-management/types/userTypes'

/**
 * 账户延期弹窗（用户表格 more 菜单「账户延期」入口，经 openInteractiveDialog 打开，
 * 2026-10-21 用户定稿）：Title=「账户延期 · 用户名」，Title 下按策略口径出一行说明；
 * 三行只读 Label——当前到期日期 / 账户有效天数（所选策略 accountValidDays）/ 新的到期日期，
 * 全部为展示值：打开时经 policyId 取策略详情计算——
 * - 天数 -1：新到期=永不过期，说明「账户将设定为永不到期」，提交新到期传空串；
 * - 天数 N>0：延期起点 =（当前到期 ≤ 当天或永不过期 ? 当天 : 当前到期），
 *   新到期 = 起点 + N 天，说明「延期起点为 xxx」。
 * 无策略/详情拉取失败：三行回落占位、说明提示不可延期、Confirm 禁用。
 * Confirm → POST /users/expire {userId, preAccountExpiresAt, newAccountExpiresAt}，
 * 成功 emit('resolve', true)+关窗（页面 Toast+重拉）；失败 showOpError 留窗重试。
 */
const props = defineProps<{ user: UserDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [done: boolean] }>()

const { t } = useI18n()
const saving = ref(false)
/** 策略账户有效天数（null=未取到/无策略：不可延期） */
const policyDays = ref<number | null>(null)
const loaded = ref(false)

const today = dayjs().format('YYYY-MM-DD')
/** 当前到期日期（'YYYY-MM-DD'；'' = 永不过期） */
const current = props.user.accountExpiresAt ? props.user.accountExpiresAt.slice(0, 10) : ''

/** 延期起点：当前到期存在且晚于今天 → 当前到期；否则（已过期/当天/永不过期）→ 今天 */
const start = computed(() => (current && current > today ? current : today))
/** 新到期日期（'' = 永不过期；null = 不可计算） */
const newDate = computed<string | null>(() => {
  if (policyDays.value === null) return null
  return policyDays.value === -1 ? '' : dayjs(start.value, 'YYYY-MM-DD').add(policyDays.value, 'day').format('YYYY-MM-DD')
})

const currentText = computed(() => current || t('security.users.neverExpire'))
const daysText = computed(() =>
  policyDays.value === null ? '—' : policyDays.value === -1 ? t('security.users.forever') : String(policyDays.value),
)
const newText = computed(() =>
  newDate.value === null ? '—' : newDate.value === '' ? t('security.users.neverExpire') : newDate.value,
)
/** Title 下说明行（用户定稿文案口径） */
const note = computed(() => {
  if (policyDays.value === null) return t('security.users.expireNoPolicy')
  return policyDays.value === -1
    ? t('security.users.expireNeverNote')
    : t('security.users.expireStartNote', { date: start.value })
})
const canConfirm = computed(() => policyDays.value !== null)

onMounted(() => {
  if (!props.user.policyId) {
    loaded.value = true
    return
  }
  fetchPolicyDetail(props.user.policyId).then(
    (p) => {
      if (p.policyId === props.user.policyId) policyDays.value = p.accountValidDays
      loaded.value = true
    },
    () => {
      loaded.value = true // 失败保持不可延期态
    },
  )
})

async function save() {
  if (!canConfirm.value || newDate.value === null || saving.value) return
  saving.value = true
  try {
    await extendUserExpire({
      userId: props.user.userId,
      preAccountExpiresAt: props.user.accountExpiresAt,
      newAccountExpiresAt: newDate.value,
    })
    emit('resolve', true)
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
    :title="t('security.users.ctlExpire') + ' · ' + props.user.userName"
    center-title
  >
    <!-- Title 下说明行（策略口径）+ 三行只读 Label（禁用字段形态，同 EditUserDialog 用户名行） -->
    <div class="vui-expire__note">{{ note }}</div>
    <v-form class="vui-user-form-grid vui-user-form-grid--one-col pt-1" @submit.prevent="save">
      <FvTextInput :model-value="currentText" :label="t('security.users.expireCurrent')" disabled />
      <FvTextInput :model-value="daysText" :label="t('security.users.expireDays')" disabled />
      <FvTextInput :model-value="newText" :label="t('security.users.expireNew')" disabled />
    </v-form>
    <template #actions>
      <v-btn :disabled="saving" @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" :disabled="!canConfirm" @click="save">
        {{ t('common.confirm') }}
      </v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
.vui-expire__note {
  margin: 2px 0 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vui-text-secondary);
  text-align: center;
}
</style>
