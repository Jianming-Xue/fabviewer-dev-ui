<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FvInteractiveDialog from '@/shared/dialog/FvInteractiveDialog.vue'
import PermissionTree from '../components/PermissionTree.vue'
import { showOpError } from '@/shared/api/opError'
import { assignRolePermissions } from '@/api/security-management/requests/roleRequest'
import type { RoleDto } from '@/api/security-management/types/roleTypes'

/**
 * 权限分配弹窗（角色表格「权限」单元格入口，经 openInteractiveDialog 打开）：
 * 只编辑该角色的功能+控件权限树；提交收口在本组件（2026-10-17 定稿）：
 * Confirm 即调 assignRolePermissions（AssignRolePermissionRo），成功 → emit(resolve true) + 关窗
 * （页面只做 Toast/重拉），失败 → 弹窗保留可重试，勾选不丢。
 */
/** readonly = 查看态（无 security.roles.edit 权限时由页面下发）：树只读、Confirm 隐藏 */
const props = withDefaults(defineProps<{ role: RoleDto; readonly?: boolean }>(), { readonly: false })

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ resolve: [saved: boolean] }>()

const { t } = useI18n()
const permissions = ref<string[]>([...props.role.permissions])
const saving = ref(false)

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    await assignRolePermissions({ roleId: props.role.roleId, permissions: [...permissions.value] })
    emit('resolve', true)
    open.value = false
  } catch (e) {
    // 传输失败已由全局 Dialog 呈现；业务失败 Toast，弹窗保留可重试
    showOpError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FvInteractiveDialog
    v-model="open"
    :title="t('security.roles.permTitle') + ' · ' + role.roleId"
    :max-width="520"
    center-title
  >
    <PermissionTree v-model="permissions" :readonly="props.readonly" />
    <template #actions>
      <v-btn @click="open = false">{{ t('common.cancel') }}</v-btn>
      <!-- 只读查看态：Confirm 隐藏（用户定稿 2026-10-16，仅保留取消/关闭路径） -->
      <v-btn v-if="!props.readonly" color="primary" :loading="saving" @click="save">{{ t('common.confirm') }}</v-btn>
    </template>
  </FvInteractiveDialog>
</template>
