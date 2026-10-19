<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import FvTextInput from '@/shared/components/FvTextInput.vue'
import { showOpError } from '@/shared/api/opError'
import { createRole, updateRole } from '@/api/security-management/roleRequest'
import type { RoleDto } from '@/api/security-management/roleTypes'

/**
 * 角色信息弹窗（新增/编辑二合一，经 openInteractiveDialog 打开）：
 * 标题随进入方式切换；只编辑基本信息（角色 ID 编辑时只读 / 名称 / 描述）——
 * 启用状态走表格行内开关，权限走「权限」单元格的权限分配弹窗（2026-10-15 定稿）。
 * 提交收口在本组件（2026-10-17 定稿，同 ChangePasswordDialog 模式）：Confirm 即调接口，
 * 成功 → emit('resolve', 落库后的 RoleDto) + 关窗（页面只做 Toast/重拉）；
 * 失败 → 弹窗保留可重试，表单不丢。入参 RoleRo（roleId/roleName/description），
 * 非空在此（UI 调用前）经表单规则校验，不通过不提交——接口层不设守卫。
 */
const props = defineProps<{ role?: RoleDto }>()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: RoleDto] }>()

const { t } = useI18n()
const formRef = ref()
const editing = !!props.role
const saving = ref(false)

const form = reactive({
  roleId: props.role?.roleId ?? '',
  roleName: props.role?.roleName ?? '',
  description: props.role?.description ?? '',
})

const ID_PATTERN = /^[A-Z0-9_-]+$/
const rules = {
  required: (v: string) => !!v.trim() || t('validation.required'),
  id: (v: string) => ID_PATTERN.test(v.trim()) || t('security.roles.form.idInvalid'),
}

async function save() {
  const { valid } = await formRef.value.validate()
  if (!valid || saving.value) return
  const input = {
    roleId: form.roleId.trim(),
    roleName: form.roleName.trim(),
    description: form.description.trim(),
  }
  saving.value = true
  try {
    const saved = editing ? await updateRole(input) : await createRole(input)
    emit('resolve', saved)
    open.value = false
  } catch (e) {
    // 传输失败已由全局 Dialog 呈现；业务失败 Toast（如 ID 重复），弹窗保留可改可重试
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="editing ? t('security.roles.edit') : t('security.roles.add')"
    center-title
  >
    <v-form ref="formRef" class="pt-1" @submit.prevent="save">
      <FvTextInput
        v-model="form.roleId"
        :label="t('security.roles.form.id')"
        :rules="[rules.required, rules.id]"
        :disabled="editing"
        :hint="editing ? undefined : t('security.roles.form.idHint')"
        persistent-hint
        prepend-icon="fas fa-id-badge"
      />
      <FvTextInput v-model="form.roleName" :label="t('security.roles.form.name')" :rules="[rules.required]" clear />
      <FvTextInput v-model="form.description" :label="t('security.roles.form.description')" type="comment" />
    </v-form>
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <v-btn color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
