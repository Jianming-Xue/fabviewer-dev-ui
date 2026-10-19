<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { showOpError } from '@/shared/api/opError'
import { updateUser } from '@/api/security-management/userRequest'
import type { UserDto, UserRo } from '@/api/security-management/userTypes'

/**
 * 编辑用户弹窗（经 openInteractiveDialog 打开，2026-10-19 自二合一 UserEditDialog 拆分；
 * 同夜二次拆分：角色/策略/两有效期天数/账户到期日 移入 EditUserRolePolicyDialog，
 * 本弹窗只剩档案三件套——昵称/邮箱/电话）：
 * 单列布局、禁用用户名居首（2026-10-19 改版定稿）；提交走 UserRo 稀疏语义
 * （只传在管字段，enabled 由表格开关维护不经手）。
 * 空值语义：邮箱/电话选填（填了校验）。
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
  nickName: props.user.nickName,
  email: props.user.email,
  phoneNumber: props.user.phoneNumber,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIGITS_PATTERN = /^\d+$/
const rules = {
  email: (v: string) =>
    !v.trim() || EMAIL_PATTERN.test(v.trim()) || t('security.users.form.emailInvalid'),
  phone: (v: string) =>
    !v.trim() || DIGITS_PATTERN.test(v.trim()) || t('security.users.form.phoneDigitsOnly'),
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const ro: UserRo = {
    userId: props.user.userId,
    nickName: form.nickName.trim(),
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim(),
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
    :title="t('security.users.edit') + ' · ' + props.user.userName"
    center-title
  >
    <!-- 单列栅格（用户定稿 2026-10-19 拆分改版）：禁用用户名居首，下排 昵称/邮箱/电话 -->
    <v-form ref="formRef" class="vui-user-form-grid vui-user-form-grid--one-col pt-1" @submit.prevent="save">
      <FvTextInput
        :model-value="props.user.userName"
        :label="t('security.users.form.userName')"
        disabled
        prepend-icon="fas fa-user"
      />
      <FvTextInput v-model="form.nickName" :label="t('security.users.form.nickName')" maxlength="30" clear />
      <FvTextInput
        v-model="form.email"
        :label="t('security.users.form.email')"
        :rules="[rules.email]"
        prepend-icon="fas fa-envelope"
        clear
      />
      <FvTextInput
        v-model="form.phoneNumber"
        :label="t('security.users.form.phoneNumber')"
        :rules="[rules.phone]"
        prepend-icon="fas fa-phone"
        inputmode="numeric"
        clear
      />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
