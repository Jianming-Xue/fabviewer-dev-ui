<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { showOpError } from '@/shared/api/opError'
import { resetUserPassword } from '@/api/security-management/userRequest'
import type { ResetPasswordRo, UserDto } from '@/api/security-management/userTypes'

/**
 * 重置密码弹窗（经 openInteractiveDialog 打开，2026-10-19 用户表格 More 菜单「重置密码」入口）：
 * 仅两字段单列排布——禁用用户名居首 + 新密码（必填，复杂度按创建口径不校验，用户定稿）。
 * 提交收口本组件（同 RoleEditDialog 模式）：成功 → emit('resolve', true)+关窗（页面 Toast）；
 * 失败 → showOpError，弹窗保留可改可重试。
 */
const props = defineProps<{ user: UserDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [ok: boolean] }>()

const { t } = useI18n()
const formRef = ref()
const saving = ref(false)

const form = reactive({
  password: '',
})

const rules = {
  required: (v: unknown) => !!String(v ?? '').trim() || t('validation.required'),
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const ro: ResetPasswordRo = { userId: props.user.userId, password: form.password }
  saving.value = true
  try {
    await resetUserPassword(ro)
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
    :title="t('security.users.ctlResetPwd') + ' · ' + props.user.userName"
    center-title
  >
    <!-- 单列栅格（用户定稿 2026-10-19 拆分改版）：禁用用户名居首，下排新密码 -->
    <v-form ref="formRef" class="vui-user-form-grid vui-user-form-grid--one-col pt-1" @submit.prevent="save">
      <FvTextInput
        :model-value="props.user.userName"
        :label="t('security.users.form.userName')"
        disabled
        prepend-icon="fas fa-user"
      />
      <FvTextInput
        v-model="form.password"
        type="password"
        :label="t('security.users.form.newPassword')"
        :rules="[rules.required]"
        prepend-icon="fas fa-key"
        autocomplete="new-password"
      />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
