<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'

import type { UserDto } from '@/api/security-management/userTypes'

/**
 * 用户信息查看弹窗（用户表格「查看」入口，经 openInteractiveDialog 打开，2026-10-18）：
 * 只读列表展示用户全量档案（含列表不展示的 创建时间/上次密码修改/上次登录时间/上次登录IP）；
 * 数据已在分页行内，无独立接口、不受权限管控；关闭即结束，无 resolve 载荷。
 */
const props = defineProps<{ user: UserDto }>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()

const dash = (v: string) => v || '—'
const expireText = (v: string) => (v ? v : t('security.users.neverExpire'))
const daysText = (n: number) => (n > 0 ? String(n) : t('security.users.forever'))

/** 全量字段行（顺序 = 定义清单序；空值按语义给占位文案） */
const rows = computed(() => [
  { label: t('security.users.col.userName'), value: props.user.userName },
  { label: t('security.users.col.nickName'), value: dash(props.user.nickName) },
  { label: t('security.users.col.email'), value: dash(props.user.email) },
  { label: t('security.users.col.phoneNumber'), value: dash(props.user.phoneNumber) },
  {
    label: t('security.users.col.status'),
    value: props.user.enabled === 1 ? t('security.users.enabledOn') : t('security.users.enabledOff'),
  },
  { label: t('security.users.col.roles'), value: props.user.roles.length ? props.user.roles.join('、') : '—' },
  { label: t('security.users.col.policy'), value: props.user.policyName || t('security.users.defaultPolicy') },
  { label: t('security.users.col.createdAt'), value: dash(props.user.createdAt) },
  { label: t('security.users.col.accountExpiresAt'), value: expireText(props.user.accountExpiresAt) },
  { label: t('security.users.col.passwordChangedAt'), value: dash(props.user.passwordChangedAt) },
  { label: t('security.users.col.passwordExpiresAt'), value: expireText(props.user.passwordExpiresAt) },
  { label: t('security.users.col.lastLoginTime'), value: dash(props.user.lastLoginTime) },
  { label: t('security.users.col.lastLoginIp'), value: dash(props.user.lastLoginIp) },
  { label: t('security.users.col.passwordValidDays'), value: daysText(props.user.passwordValidDays) },
  { label: t('security.users.col.accountValidDays'), value: daysText(props.user.accountValidDays) },
])
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="t('security.users.view') + ' · ' + props.user.userName"
    :max-width="400"
    center-title
  >
    <div class="vui-user-view">
      <div v-for="row in rows" :key="row.label" class="vui-user-view__row">
        <span class="vui-user-view__label">{{ row.label }}</span>
        <span class="vui-user-view__value">{{ row.value }}</span>
      </div>
    </div>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.close') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 只读档案列表：左标签（弱化）右值，行分隔细线 */
.vui-user-view {
  display: flex;
  flex-direction: column;
  max-height: 60vh;
  overflow-y: auto;
}

.vui-user-view__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 2px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.18);
}

.vui-user-view__row:last-child {
  border-bottom: none;
}

.vui-user-view__label {
  flex: 0 0 auto;
  font-size: 13px;
  color: var(--vui-text-secondary, rgba(0, 0, 0, 0.6));
}

.vui-user-view__value {
  min-width: 0;
  text-align: end;
  overflow-wrap: anywhere;
}
</style>
