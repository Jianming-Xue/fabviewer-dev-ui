<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import FvLogo from '@/app/images/FvLogo.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { changePasswordRequest } from '@/api/security-management/authRequest'
import { useAuthStore } from '@/app/stores/auth'
import { ApiError } from '@/shared/api/errors'
import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'

/**
 * 修改密码弹窗（主界面顶栏入口）：继承业务弹窗基类 FvInteractiveDialog（2026-10-16 定稿，
 * 此前直接组合 FvBaseDialog），经 openInteractiveDialog() 打开、FvInteractiveDialogHost 承载。
 * 表单与提交逻辑全部收在本组件内，调用方只管 await 结果。
 */
const open = defineModel<boolean>({ required: true })

/** 结果回传（openInteractiveDialog 契约）：关闭时 Promise resolve 到最后 emit 的载荷 */
const emit = defineEmits<{ resolve: [changed: boolean] }>()

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const dialog = useModalDialog()
const toast = useAlertToast()

const pwdForm = reactive({ old: '', next: '', confirm: '' })
const pwdFormRef = ref()
const saving = ref(false)

const pwdRules = {
  required: (v: string) => !!v || t('validation.required'),
  min: (v: string) => v.length >= 8 || t('topbar.passwordMin'),
  match: (v: string) => v === pwdForm.next || t('topbar.passwordMismatch'),
}

/**
 * 提交：成功 → 关窗 + 全局成功 Toast；失败 → 失败 Dialog 展示接口 errMsg（弹窗保留可重试）
 */
async function submit() {
  const { valid } = await pwdFormRef.value.validate()
  if (!valid) return
  saving.value = true
  try {
    await changePasswordRequest({ username: auth.userName, oldPassword: pwdForm.old, newPassword: pwdForm.next })
    emit('resolve', true) // 修改成功：经 openInteractiveDialog 的 Promise 回传
    open.value = false
    toast.success(t('topbar.passwordChanged'))
    // 密码已变更：清空登录态并回登录页，用新密码重新登录（用户定稿 2026-10-14）
    await auth.logout()
    router.replace('/login')
  } catch (e) {
    // 传输层非 200 已由 shared/http 全局呈现；业务失败保留此处（弹窗保留可重试）
    if (!(e instanceof ApiError && e.transport)) {
      void dialog.error(
        e instanceof ApiError && e.errMsg
          ? e.errMsg
          : e instanceof ApiError && (e.errCode === 400 || e.errCode === 401)
            ? t('login.invalidCredentials')
            : t('login.failed'),
      )
    }
  } finally {
    saving.value = false
  }
}

/** 关闭广播（FvInteractiveDialog 的 @closed 契约）：取消/Esc/成功任一路径统一清空表单模型 */
function reset() {
  pwdForm.old = ''
  pwdForm.next = ''
  pwdForm.confirm = ''
}
</script>

<template>
  <!-- 无图标、标题居中、遮罩加深；表单按登录页形式：顶部 logo、用户名只读、密码框带锁与明文切换 -->
  <FvInteractiveDialog
    v-model="open"
    :title="t('topbar.changePassword')"
    center-title
    :scrim-opacity="0.5"
    @closed="reset"
  >
    <div class="vui-pwd-brand">
      <FvLogo :size="64" />
    </div>
    <v-form ref="pwdFormRef" class="pt-2" @submit.prevent="submit">
      <FvTextInput
        :model-value="auth.userName"
        :label="t('login.username')"
        disabled
        prepend-icon="fas fa-user"
        autocomplete="username"
      />
      <FvTextInput
        v-model="pwdForm.old"
        type="password"
        :label="t('topbar.oldPassword')"
        :rules="[pwdRules.required]"
        autocomplete="current-password"
      />
      <FvTextInput
        v-model="pwdForm.next"
        type="password"
        :label="t('topbar.newPassword')"
        :rules="[pwdRules.required, pwdRules.min]"
        autocomplete="new-password"
      />
      <FvTextInput
        v-model="pwdForm.confirm"
        type="password"
        :label="t('topbar.confirmPassword')"
        :rules="[pwdRules.required, pwdRules.match]"
        autocomplete="new-password"
      />
    </v-form>
    <template #actions>
      <!-- 取消 = 普通按钮（关窗）、确认 = 主题色按钮（提交） -->
      <v-btn :disabled="saving" @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="submit">
        {{ t('common.confirm') }}
      </v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 顶部 logo 居中（登录页品牌区的缩小版） */
.vui-pwd-brand {
  display: flex;
  justify-content: center;
  padding-top: 2px;
}
</style>
