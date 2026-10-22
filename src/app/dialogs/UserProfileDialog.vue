<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvUserAvatar from '@/shared/components/FvUserAvatar.vue'
import { openInteractiveDialog } from '@/shared/dialog/openInteractiveDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import ChangeUserAvatarDialog from './ChangeUserAvatarDialog.vue'
import EditUserAttributeDialog from './EditUserAttributeDialog.vue'
import { useAuthStore } from '@/app/stores/auth'

import type { UserAttributeRo } from '@/api/security-management/types/userTypes'

/**
 * 用户信息展示弹窗（顶栏用户菜单「用户信息」入口，经 openInteractiveDialog 打开，2026-10-18）：
 * 列表形式展示登录时下发的档案（LoginDto.user = UserDto）+ 登录足迹（上次登录时间/IP；
 * 本次登录时间 2026-10-20 随 LoginDto.loginTime 移除）；不可编辑且为空的行不显示。
 * 数据直读 auth store（会话档案即唯一事实源，无需跨界面传参）。
 * 编辑（2026-10-20 二次定稿，替代短暂尝试的行内编辑）：昵称/邮箱/电话三行行尾编辑钮（pen）
 * → 经 openInteractiveDialog 弹 EditUserAttributeDialog（宿主层叠机制置于本弹窗之上），
 * Confirm 提交成功后结果回显到原行（auth.patchUser + Toast）；Cancel 取消无改动。
 * 头像编辑（2026-10-22 二次定稿，替代短暂存在的下缘弧带修改钮）：点击头像整体
 * → 层叠弹 ChangeUserAvatarDialog，Confirm 提交成功后回写 auth.patchUser({ avatar })（顶栏头像随 store 响应式更新）。
 */
const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const auth = useAuthStore()
const toast = useAlertToast()

interface ProfileRow {
  icon: string
  label: string
  value: string
  /** 可编辑属性名；undefined = 只读行 */
  att?: UserAttributeRo['attName']
}

const rows = computed<ProfileRow[]>(() => {
  const list: ProfileRow[] = [
    { icon: 'fas fa-user', label: t('topbar.profileUser'), value: auth.profile.name },
    { icon: 'fas fa-id-badge', label: t('topbar.profileNickName'), value: auth.user.nickName, att: 'nickName' },
    { icon: 'fas fa-envelope', label: t('topbar.profileEmail'), value: auth.user.email, att: 'email' },
    { icon: 'fas fa-phone', label: t('topbar.profilePhone'), value: auth.user.phoneNumber, att: 'phoneNumber' },
    { icon: 'fas fa-clock-rotate-left', label: t('topbar.profileLastLoginTime'), value: auth.user.lastLoginTime },
    { icon: 'fas fa-network-wired', label: t('topbar.profileLastLoginIp'), value: auth.user.lastLoginIp },
  ]
  // 可编辑行恒显（值可为空待补），只读空行不显示
  return list.filter((r) => r.att || r.value)
})

/** 行编辑：弹 EditUserAttributeDialog（层叠于本弹窗之上）；Confirm 回传新值→回写会话档案回显原行 */
async function editRow(att: UserAttributeRo['attName']) {
  const from = att === 'nickName' ? auth.user.nickName : att === 'email' ? auth.user.email : auth.user.phoneNumber
  const saved = await openInteractiveDialog<{ attName: UserAttributeRo['attName']; value: string }, string | undefined>(
    EditUserAttributeDialog,
    { attName: att, value: from },
  )
  if (saved === undefined) return // Cancel/直接关闭：无改动
  auth.patchUser({ [att]: saved })
  toast.success(t('topbar.profileUpdated'))
}

/** 头像编辑：弹 ChangeUserAvatarDialog（层叠于本弹窗之上）；Confirm 回传新头像 dataURL
 *  → 回写会话档案（auth.profile.avatar，用户信息弹窗与主界面右上角头像随 store 响应式更新） */
async function editAvatar() {
  const saved = await openInteractiveDialog<{ current: string }, string | undefined>(ChangeUserAvatarDialog, {
    current: auth.profile.avatar,
  })
  if (saved === undefined) return // Cancel/直接关闭：无改动
  auth.patchUser({ avatar: saved })
  toast.success(t('topbar.profileUpdated'))
}
</script>

<template>
  <FvInteractiveDialog v-model="open" :title="t('topbar.profileTitle')" :max-width="380" center-title>
    <div class="vui-profile">
      <!-- 档案头：头像 + 昵称（无头像退化为首字符） -->
      <div class="vui-profile__head">
        <!-- 头像（2026-10-22 二次定稿）：点击头像整体弹 ChangeUserAvatarDialog -->
        <FvUserAvatar
          class="vui-profile__avatar"
          :avatar="auth.profile.avatar"
          :user-name="auth.user.userName"
          :fallback-name="auth.profile.nickName || auth.profile.name"
          :size="64"
          :title="t('topbar.avatarEdit')"
          @click="editAvatar"
        />
        <div class="text-body-1 font-weight-medium mt-2">{{ auth.profile.nickName || auth.profile.name }}</div>
      </div>
      <!-- 信息列表：左图标 + 标签，右值 + 可编辑行行尾编辑钮 -->
      <v-list density="compact">
        <v-list-item v-for="row in rows" :key="row.label" class="vui-profile__row px-0">
          <template #prepend>
            <v-icon :icon="row.icon" size="15" class="mr-3 text-medium-emphasis" />
          </template>
          <v-list-item-title class="text-body-2 text-medium-emphasis font-regular">{{ row.label }}</v-list-item-title>
          <template #append>
            <span class="vui-profile__value text-body-2">{{ row.value || '—' }}</span>
            <v-btn
              v-if="row.att"
              icon
              variant="text"
              size="x-small"
              color="primary"
              class="ml-1"
              :title="t('common.edit')"
              @click="editRow(row.att)"
            >
              <v-icon size="14">fas fa-pen</v-icon>
            </v-btn>
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

/* 头像即入口（2026-10-22）：点击弹修改弹窗 */
.vui-profile__avatar {
  cursor: pointer;
}

.vui-profile__row :deep(.v-list-item__append) {
  margin-inline-start: 16px;
}

.vui-profile__value {
  display: block;
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: end;
}
</style>
