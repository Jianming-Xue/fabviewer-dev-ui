<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { showOpError } from '@/shared/api/opError'
import { useAlertToast } from '@/shared/toast/useAlertToast'
import { updateUserAttribute } from '@/api/security-management/requests/userRequest'
import { useAuthStore } from '@/app/stores/auth'

import type { UserAttributeRo } from '@/api/security-management/types/userTypes'

/**
 * 用户信息展示弹窗（顶栏用户菜单「用户信息」入口，经 openInteractiveDialog 打开，2026-10-18）：
 * 列表形式展示登录时下发的档案（LoginDto.user = UserDto）+ 登录足迹（上次登录时间/IP；
 * 本次登录时间 2026-10-20 随 LoginDto.loginTime 移除）；不可编辑且为空的行不显示。
 * 行内编辑（用户定稿 2026-10-20）：昵称/邮箱/电话三行行尾编辑钮（pen）→ 行内输入框 + 提交钮（check）
 * → POST /users/attribute {userId=登录用户名, attName, attValue} → 成功回写会话档案（auth.patchUser）
 * + Toast；失败 showOpError、保留编辑态可重试。编辑中再点其它行编辑钮则切换目标行（草稿丢弃）。
 * 数据直读 auth store（会话档案即唯一事实源，无需跨界面传参）。
 */
const open = defineModel<boolean>({ required: true })

const { t } = useI18n()
const auth = useAuthStore()
const toast = useAlertToast()

/** 行内编辑态：属性名（null=无行在编辑）+ 草稿值 + 提交中标记 */
const editing = ref<UserAttributeRo['attName'] | null>(null)
const draft = ref('')
const submitting = ref(false)

interface ProfileRow {
  icon: string
  label: string
  /** 展示值（编辑态行由输入框接管） */
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

function startEdit(att: UserAttributeRo['attName']) {
  editing.value = att
  draft.value = att === 'nickName' ? auth.user.nickName : att === 'email' ? auth.user.email : auth.user.phoneNumber
}

async function submitEdit(att: UserAttributeRo['attName']) {
  if (submitting.value) return
  const value = draft.value.trim()
  submitting.value = true
  try {
    await updateUserAttribute({ userId: auth.userName, attName: att, attValue: value })
    auth.patchUser({ [att]: value }) // 会话档案同步（唯一事实源）
    editing.value = null
    toast.success(t('topbar.profileUpdated'))
  } catch (e) {
    showOpError(e) // 失败保留编辑态可重试
  } finally {
    submitting.value = false
  }
}
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
      <!-- 信息列表：左图标 + 标签，右值（编辑态换行内输入框）+ 行尾钮 -->
      <v-list density="compact">
        <v-list-item v-for="row in rows" :key="row.label" class="vui-profile__row px-0">
          <template #prepend>
            <v-icon :icon="row.icon" size="15" class="mr-3 text-medium-emphasis" />
          </template>
          <v-list-item-title class="text-body-2 text-medium-emphasis font-regular">{{ row.label }}</v-list-item-title>
          <template #append>
            <div v-if="row.att && editing === row.att" class="vui-profile__editing">
              <v-text-field
                v-model="draft"
                density="compact"
                variant="outlined"
                hide-details
                autofocus
                class="vui-profile__input"
                @keyup.enter="submitEdit(row.att)"
              />
              <!-- 提交钮（check，主题色）；取消=再点行外/关闭弹窗（窄弹窗放不下三钮，2026-10-20 定稿去取消钮） -->
              <v-btn icon variant="text" size="x-small" color="primary" :loading="submitting" :title="t('topbar.profileSubmit')" @click="submitEdit(row.att)">
                <v-icon size="15">fas fa-check</v-icon>
              </v-btn>
            </div>
            <template v-else>
              <span class="vui-profile__value text-body-2">{{ row.value || '—' }}</span>
              <v-btn
                v-if="row.att"
                icon
                variant="text"
                size="x-small"
                color="primary"
                class="ml-1"
                :title="t('common.edit')"
                @click="startEdit(row.att)"
              >
                <v-icon size="14">fas fa-pen</v-icon>
              </v-btn>
            </template>
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

/* 行内编辑态：输入框 + 提交钮一组；宽度受 380 弹窗行剩余空间约束（防溢出右缘） */
.vui-profile__editing {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 190px;
}

.vui-profile__input {
  flex: 1 1 auto;
  min-width: 0;
}

/* 行内输入框贴 append 区，label 浮动无位（无 label）时上下内衬收紧 */
.vui-profile__input :deep(.v-field) {
  min-height: 28px;
  height: 28px;
}
</style>
