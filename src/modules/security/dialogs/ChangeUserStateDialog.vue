<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { showOpError } from '@/shared/api/opError'
import { setUserEnabled } from '@/api/security-management/requests/userRequest'
import type {
  UserDto,
  UserStateRo,
} from '@/api/security-management/types/userTypes'

/**
 * 变更启用状态弹窗（经 openInteractiveDialog 打开，2026-10-19 改造：表格开关点击不再即时提交，
 * 先在此录入操作备注再落库）：
 * 标题随方向切换——目标停用（true→false）=「禁用用户」、目标启用 =「启用用户」（用户定稿）；
 * 单列布局、禁用用户名居首（用户弹窗拆分家族统一，宽度走 FvInteractiveDialog 默认 420）；
 * 备注=comment 形态（必填，口径同 RoleEditDialog 描述框）。
 * 提交收口本组件（同 RoleEditDialog 模式）：成功 → emit('resolve', true)+关窗（页面 Toast+归一开关）；
 * 失败 → showOpError，弹窗保留可改可重试（用户关闭则页面回拨开关）。
 */
const props = defineProps<{ user: UserDto; enabled: number }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [ok: boolean] }>()

const { t } = useI18n()
const formRef = ref()
const saving = ref(false)

const title = computed(
  () =>
    (props.enabled === 1 ? t('security.users.enableUser') : t('security.users.disableUser')) +
    ' · ' +
    props.user.userName,
)

const form = reactive({ remark: '' })

const rules = {
  required: (v: unknown) => !!String(v ?? '').trim() || t('validation.required'),
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const ro: UserStateRo = { userId: props.user.userId, enabled: props.enabled, remark: form.remark.trim() }
  saving.value = true
  try {
    await setUserEnabled(ro)
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
  <FvInteractiveDialog v-model="open" :title="title" center-title>
    <!-- 单列栅格（用户弹窗拆分家族统一）：禁用用户名居首，下排操作备注 -->
    <v-form ref="formRef" class="vui-user-form-grid vui-user-form-grid--one-col pt-1" @submit.prevent="save">
      <FvTextInput
        :model-value="props.user.userName"
        :label="t('security.users.form.userName')"
        disabled
        prepend-icon="fas fa-user"
      />
      <FvTextInput
        v-model="form.remark"
        type="comment"
        :label="t('security.users.form.remark')"
        :rules="[rules.required]"
        required
        maxlength="200"
      />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
