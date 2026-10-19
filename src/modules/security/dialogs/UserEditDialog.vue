<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import FvSwitch from '@/shared/components/FvSwitch.vue'
import { showOpError } from '@/shared/api/opError'
import { createUser, updateUser } from '@/api/security-management/userRequest'
import type { UserDto } from '@/api/security-management/userTypes'

/**
 * 用户信息弹窗（新增/编辑二合一，经 openInteractiveDialog 打开，2026-10-18 首版）：
 * 提交收口在本组件（同 RoleEditDialog 定稿模式）：Confirm 即调接口，
 * 成功 → emit('resolve', 落库后的 UserDto) + 关窗（页面只做 Toast/重拉）；
 * 失败（用户名重复等）→ Toast 出接口 errMsg，弹窗保留可重试、表单不丢。
 * 入参 UserRo：新增 userId 留空由后端生成；编辑 userName 锁定不可改。
 */
const props = defineProps<{ user?: UserDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: UserDto] }>()

const { t } = useI18n()
const formRef = ref()
const editing = !!props.user
const saving = ref(false)

const form = reactive({
  userName: props.user?.userName ?? '',
  nickName: props.user?.nickName ?? '',
  email: props.user?.email ?? '',
  phoneNumber: props.user?.phoneNumber ?? '',
  /** 服务口径数字 1/0，表单侧布尔（UserRo.enabled 提交时换算） */
  enabled: props.user ? props.user.enabled === 1 : true,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const rules = {
  required: (v: string) => !!v.trim() || t('validation.required'),
  email: (v: string) => !v.trim() || EMAIL_PATTERN.test(v.trim()) || t('security.users.form.emailInvalid'),
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const input = {
    userId: props.user?.userId ?? '',
    userName: form.userName.trim(),
    nickName: form.nickName.trim(),
    email: form.email.trim(),
    phoneNumber: form.phoneNumber.trim(),
    enabled: form.enabled ? 1 : 0,
  }
  saving.value = true
  try {
    const saved = editing ? await updateUser(input) : await createUser(input)
    emit('resolve', saved)
    open.value = false
  } catch (e) {
    // 传输失败已由全局 Dialog 呈现；业务失败（如用户名重复）Toast，弹窗保留可改可重试
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="editing ? t('security.users.edit') : t('security.users.add')"
    center-title
  >
    <v-form ref="formRef" class="pt-1" @submit.prevent="save">
      <FvTextInput
        v-model="form.userName"
        :label="t('security.users.form.userName')"
        :rules="[rules.required]"
        :disabled="editing"
        :hint="editing ? undefined : t('security.users.form.userNameHint')"
        persistent-hint
        prepend-icon="fas fa-user"
      />
      <FvTextInput v-model="form.nickName" :label="t('security.users.form.nickName')" clear />
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
        prepend-icon="fas fa-phone"
        clear
      />
      <!-- 用户状态：服务口径 1/0，表单侧布尔 -->
      <div class="vui-user-form__switch">
        <FvSwitch v-model="form.enabled" />
        <span class="text-body-2">{{ t('security.users.form.enabled') }}</span>
      </div>
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>

<style scoped>
/* 状态开关行：与字段区同距，开关 + 文案左对齐 */
.vui-user-form__switch {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}
</style>
