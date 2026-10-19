<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { useAuthStore } from '@/app/stores/auth'

/**
 * 用户信息展示弹窗（顶栏用户菜单「用户信息」入口，经 openInteractiveDialog 打开，2026-10-18）：
 * 列表形式展示登录时下发的档案（LoginDto）——用户名/昵称/邮箱/电话 + 登录足迹
 * （本次登录时间、上次登录时间、上次登录 IP）；空字段行不显示。
 * 数据直读 auth store（会话档案即唯一事实源，无需跨界面传参）。
 */
const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const auth = useAuthStore()

const rows = computed(() =>
  [
    { icon: 'fas fa-user', label: t('topbar.profileUser'), value: auth.profile.name },
    { icon: 'fas fa-id-badge', label: t('topbar.profileNickName'), value: auth.profile.nickName },
    { icon: 'fas fa-envelope', label: t('topbar.profileEmail'), value: auth.profile.email },
    { icon: 'fas fa-phone', label: t('topbar.profilePhone'), value: auth.profile.phone },
    { icon: 'fas fa-right-to-bracket', label: t('topbar.profileLoginTime'), value: auth.trace.loginTime },
    { icon: 'fas fa-clock-rotate-left', label: t('topbar.profileLastLoginTime'), value: auth.trace.lastLoginTime },
    { icon: 'fas fa-network-wired', label: t('topbar.profileLastLoginIp'), value: auth.trace.lastLoginIp },
  ].filter((r) => r.value),
)
</script>

<template>
  <FvInteractiveDialog v-model="open" :title="t('topbar.profileTitle')" :max-width="380" center-title>
    <div class="vui-profile">
      <!-- 档案头：头像 + 昵称（无头像退化为首字符） -->
      <div class="vui-profile__head">
        <v-avatar size="64" color="primary" variant="tonal">
          <img v-if="auth.profile.avatar" :src="auth.profile.avatar" :alt="auth.profile.name" />
          <span v-else class="text-h5 font-weight-bold">
            {{ (auth.profile.nickName || auth.profile.name).slice(0, 1).toUpperCase() }}
          </span>
        </v-avatar>
        <div class="text-body-1 font-weight-medium mt-2">{{ auth.profile.nickName || auth.profile.name }}</div>
      </div>
      <!-- 信息列表：左图标 + 标签，右值（超宽省略号） -->
      <v-list density="compact">
        <v-list-item v-for="row in rows" :key="row.label" class="vui-profile__row px-0">
          <template #prepend>
            <v-icon :icon="row.icon" size="15" class="mr-3 text-medium-emphasis" />
          </template>
          <v-list-item-title class="text-body-2 text-medium-emphasis font-regular">{{ row.label }}</v-list-item-title>
          <template #append>
            <span class="vui-profile__value text-body-2">{{ row.value }}</span>
          </template>
        </v-list-item>
      </v-list>
    </div>
    <template #actions>
      <!-- 关闭 = 普通按钮（项目约定 2026-10-18：关闭/取消/重置不指定颜色与变体） -->
      <v-btn @click="open = false">{{ t('common.close') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
.vui-profile__head {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0 14px;
}

.vui-profile__row :deep(.v-list-item__append) {
  margin-inline-start: 16px;
}

.vui-profile__value {
  display: block;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: end;
}
</style>
