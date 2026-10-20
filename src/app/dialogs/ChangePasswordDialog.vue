<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import FvLogo from '@/app/images/FvLogo.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { changePasswordRequest } from '@/api/security-management/requests/authRequest'
import { useAuthStore } from '@/app/stores/auth'
import { FALLBACK_PWD_MAX, FALLBACK_PWD_MIN, newPwdPolicyRule } from '@/shared/utils/pwdPolicy'
import { ApiError } from '@/shared/api/errors'
import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import { useModalDialog } from '@/shared/dialog/useModalDialog'
import { useAlertToast } from '@/shared/toast/useAlertToast'

/**
 * 修改密码弹窗（主界面顶栏入口）：继承业务弹窗基类 FvInteractiveDialog（2026-10-16 定稿，
 * 此前直接组合 FvBaseDialog），经 openInteractiveDialog() 打开、FvInteractiveDialogHost 承载。
 * 表单与提交逻辑全部收在本组件内，调用方只管 await 结果。
 * 新密码限制（2026-10-20）：按登录策略（auth.loginPolicy，登录时按 policyId 拉取）——
 * 长度取策略上下限、四个开关开启强制含数字/大写/小写/指定特殊字符各至少一个；
 * 无策略（未挂或详情拉取失败）→ 基础限制：长度 6~18。
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
  /** 新密码策略校验（见 shared/utils/pwdPolicy） */
  policy: newPwdPolicyRule(() => auth.loginPolicy, t),
  match: (v: string) => v === pwdForm.next || t('topbar.passwordMismatch'),
}

/** 新密码要求提示（问号 tooltip）：随策略动态生成，无策略时即基础 6~18 */
const policyHint = computed(() => {
  const p = auth.loginPolicy
  const bits = [t('validation.pwdLen', { min: p?.passwdMinLength ?? FALLBACK_PWD_MIN, max: p?.passwdMaxLength ?? FALLBACK_PWD_MAX })]
  if (p) {
    if (p.passwdRequireDigit === 1) bits.push(t('validation.pwdNeedDigit'))
    if (p.passwdRequireUpperChar === 1) bits.push(t('validation.pwdNeedUpper'))
    if (p.passwdRequireLowerChar === 1) bits.push(t('validation.pwdNeedLower'))
    if (p.passwdRequireSpecialChar === 1) bits.push(t('validation.pwdNeedSpecial'))
  }
  return bits.join('；')
})

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
    <v-form ref="pwdFormRef" class="pt-2 vui-form-col" @submit.prevent="submit">
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
        required
        autocomplete="current-password"
      />
      <FvTextInput
        v-model="pwdForm.next"
        type="password"
        :label="t('topbar.newPassword')"
        :rules="[pwdRules.required, pwdRules.policy]"
        :hint="policyHint"
        show-hint
        required
        autocomplete="new-password"
      />
      <FvTextInput
        v-model="pwdForm.confirm"
        type="password"
        :label="t('topbar.confirmPassword')"
        :rules="[pwdRules.required, pwdRules.match]"
        required
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
