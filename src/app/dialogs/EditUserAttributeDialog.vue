<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { showOpError } from '@/shared/api/opError'
import { updateUserAttribute } from '@/api/security-management/requests/userRequest'
import { useAuthStore } from '@/app/stores/auth'

import type { UserAttributeRo } from '@/api/security-management/types/userTypes'

/**
 * 用户单属性编辑弹窗（2026-10-20 定稿，经 openInteractiveDialog 从用户信息弹窗行尾编辑钮打开，
 * 宿主层叠机制下叠于其上方）：
 * 只有一个输入框，标题即字段名——昵称进改昵称、邮箱进改邮箱、电话进改电话；
 * 样式与限制规则逐项对齐 EditUserDialog 同名字段（昵称 ≤30 不限字符 / 邮箱填了才校验格式 /
 * 电话仅数字、inputmode=numeric；均 clear、无 required）。
 * Confirm → POST /users/attribute（userId=登录用户名，读 auth store）→ emit('resolve', 新值)+关窗，
 * 调用方（用户信息弹窗）把结果回显到原行；Cancel/关闭=弃改动（无结果）。
 * 提交收口本组件（同 EditUserDialog 模式）：失败 showOpError、弹窗保留可重试。
 */
const props = defineProps<{ attName: UserAttributeRo['attName']; value: string }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: string] }>()

const { t } = useI18n()
const auth = useAuthStore()
const formRef = ref()
const saving = ref(false)

const form = reactive({ value: props.value })

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DIGITS_PATTERN = /^\d+$/

/** 三属性元数据（label/图标/输入模式/长度/规则全对齐 EditUserDialog 对应字段） */
const meta = computed(() => {
  if (props.attName === 'nickName') {
    return {
      label: t('security.users.form.nickName'),
      prependIcon: undefined,
      inputmode: undefined,
      maxlength: '30',
      rules: [] as ((v: string) => true | string)[],
    }
  }
  if (props.attName === 'email') {
    return {
      label: t('security.users.form.email'),
      prependIcon: 'fas fa-envelope',
      inputmode: undefined,
      maxlength: undefined,
      rules: [
        (v: string) => !v.trim() || EMAIL_PATTERN.test(v.trim()) || t('security.users.form.emailInvalid'),
      ],
    }
  }
  return {
    label: t('security.users.form.phoneNumber'),
    prependIcon: 'fas fa-phone',
    inputmode: 'numeric',
    maxlength: undefined,
    rules: [(v: string) => !v.trim() || DIGITS_PATTERN.test(v.trim()) || t('security.users.form.phoneDigitsOnly')],
  }
})

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const value = form.value.trim()
  saving.value = true
  try {
    await updateUserAttribute({ userId: auth.userName, attName: props.attName, attValue: value })
    emit('resolve', value)
    open.value = false
  } catch (e) {
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog v-model="open" :title="meta.label" center-title>
    <v-form ref="formRef" class="vui-form-col pt-1" @submit.prevent="save">
      <FvTextInput
        v-model="form.value"
        :label="meta.label"
        :rules="meta.rules"
        :prepend-icon="meta.prependIcon"
        :inputmode="meta.inputmode"
        :maxlength="meta.maxlength"
        clear
      />
    </v-form>
    <template #actions>
      <v-btn :disabled="saving" @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
